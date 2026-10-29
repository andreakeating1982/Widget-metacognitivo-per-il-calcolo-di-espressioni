/**
 * Sonda della pipeline COMPLETA col modello reale: per ogni caso stampa quali tratti restano al modello,
 * la lettura GREZZA del modello su quei tratti e il risultato finale. Serve a capire se un errore nasce
 * nel modello o nei passi successivi (ricoloramento delle parentesi, composizione).
 *
 * Sorgenti dei tratti:
 *  - PIPE_LIST="expr|stile|seme;…" (+ PIPE_H=<px> altezza cifre, PIPE_ROUND=1 punti interi) → sintetizzati;
 *  - PIPE_JSON=<file>[:<idx>] → tratti esportati (public/__test/strokes.json); senza idx TUTTI i casi.
 *    PIPE_MODE=raw,round,trunc,jitter,phase (default raw,round,trunc):
 *      round/trunc = quantizzazione a pixel interi; jitter = rumore uniforme ±0,5 px;
 *      phase = 16 FASI di quantizzazione `floor(x+fx)-fx` con fx,fy ∈ {0; 0,25; 0,5; 0,75}: è ciò che
 *      fa il browser (clientX/clientY interi, canvas con offset frazionario) ⇒ misura la SENSIBILITÀ
 *      di un caso a ±1 px di rumore. PIPE_QUIET=1 stampa le letture del modello solo per i casi errati.
 *
 *   PIPE=1 MODEL_BENCH=1 CANVAS_MODULE=/home/user/ocr-bench/node_modules/@napi-rs/canvas/index.js \
 *   PIPE_JSON=public/__test/strokes.json PIPE_MODE=phase PIPE_QUIET=1 \
 *   npx vitest run src/lib/bench/pipeProbe.test.ts | grep ^PIPE
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { loadNodeEngine } from "./nodeEngine";
import { canon } from "./cases";
import { synthExpression, type SpacingStyle } from "./synthInk";
import { recognizePieceWith } from "../recognizePiece";

type St = { points: { x: number; y: number }[]; lineWidth?: number };
type Case = { expr: string; style: string; seed: number; strokes: St[] };
type Item = { label: string; expr?: string; strokes: St[] };

const ON = !!process.env.PIPE && !!process.env.MODEL_BENCH;
const expectedOf = (expr: string) => expr.replace(/\*/g, "\\cdot");
const PHASES = [0, 0.25, 0.5, 0.75];

const mapPoints = (strokes: St[], f: (p: { x: number; y: number }) => { x: number; y: number }): St[] =>
  strokes.map((st) => ({ ...st, points: st.points.map(f) }));

describe.skipIf(!ON)("sonda pipeline completa", () => {
  it("stampa lettura grezza dei tratti rimasti e finale", { timeout: 1_800_000 }, async () => {
    const { deps } = await loadNodeEngine();
    const H = process.env.PIPE_H ? Number(process.env.PIPE_H) : undefined;
    const quiet = !!process.env.PIPE_QUIET;
    const items: Item[] = [];

    if (process.env.PIPE_JSON) {
      const [file, idx] = process.env.PIPE_JSON.split(":") as [string, string | undefined];
      const all = JSON.parse(fs.readFileSync(file, "utf8")) as Case[];
      const sel: [Case, number][] = idx ? [[all[Number(idx)]!, Number(idx)]] : all.map((c, i) => [c, i]);
      const modes = (process.env.PIPE_MODE ?? "raw,round,trunc").split(",");
      let rs = 12345;
      const rnd = () => (rs = (Math.imul(rs, 1103515245) + 12345) >>> 0) / 4294967296 - 0.5;
      for (const [c, i] of sel) {
        for (const m of modes) {
          const tag = `#${i} ${c.expr} ${c.style} s${c.seed}`;
          if (m === "phase") {
            for (const fx of PHASES) for (const fy of PHASES) {
              items.push({ label: `${tag} [fase ${fx},${fy}]`, expr: c.expr, strokes: mapPoints(c.strokes, (p) => ({ x: Math.floor(p.x + fx) - fx, y: Math.floor(p.y + fy) - fy })) });
            }
          } else {
            const f =
              m === "round" ? (p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) })
              : m === "trunc" ? (p: { x: number; y: number }) => ({ x: Math.trunc(p.x), y: Math.trunc(p.y) })
              : m === "jitter" ? (p: { x: number; y: number }) => ({ x: p.x + rnd(), y: p.y + rnd() })
              : (p: { x: number; y: number }) => ({ x: p.x, y: p.y });
            items.push({ label: `${tag} [${m}]`, expr: c.expr, strokes: mapPoints(c.strokes, f) });
          }
        }
      }
    }
    for (const item of (process.env.PIPE_LIST ?? "").split(";").filter(Boolean)) {
      const [expr, style, seed] = item.split("|");
      let strokes = synthExpression(expr!, { seed: Number(seed), style: style as SpacingStyle, ...(H ? { H } : {}) }) as St[];
      if (process.env.PIPE_ROUND) strokes = mapPoints(strokes, (p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
      items.push({ label: `${expr} ${style} s${seed}`, expr, strokes });
    }

    const lines: string[] = [];
    let okN = 0;
    const perCase = new Map<string, { ok: number; n: number; bad: string[] }>();
    for (const { label, expr, strokes } of items) {
      const engine = deps.engine as { recognize: (...a: unknown[]) => Promise<{ latex?: string } | null> };
      const orig = engine.recognize.bind(engine);
      const seen: string[] = [];
      engine.recognize = async (...a: unknown[]) => {
        const r = await orig(...a);
        const arr = a[0] as unknown[];
        seen.push(`${Array.isArray(arr) ? arr.length : "?"} tratti → ${JSON.stringify(r?.latex ?? "")}`);
        return r;
      };
      const final = (await recognizePieceWith(deps, strokes as never)) as unknown;
      engine.recognize = orig;
      const got = typeof final === "string" ? final : JSON.stringify(final);
      const ok = expr === undefined ? undefined : canon(got) === canon(expectedOf(expr));
      if (ok) okN++;
      const key = label.replace(/ \[.*$/, "");
      const pc = perCase.get(key) ?? { ok: 0, n: 0, bad: [] };
      pc.n++;
      if (ok) pc.ok++;
      else if (ok === false) pc.bad.push(`${label.replace(/^.*\[/, "[")}→${got}`);
      perCase.set(key, pc);
      if (!quiet || ok === false) {
        lines.push(`PIPE ${ok === undefined ? "   " : ok ? "OK " : "ERR"} «${label}»: ${strokes.length} tratti`);
        for (const s of seen) lines.push(`PIPE      modello: ${s}`);
        lines.push(`PIPE      FINALE: ${JSON.stringify(got)}`);
      }
    }
    lines.push(`PIPE ===== RIEPILOGO per caso (giusti/totali)`);
    for (const [k, v] of perCase) lines.push(`PIPE   ${v.ok}/${v.n}  ${k}${v.bad.length ? "   ERRATE: " + v.bad.slice(0, 6).join(" | ") : ""}`);
    lines.push(`PIPE ===== TOTALE ${okN}/${items.filter((i) => i.expr !== undefined).length}`);
    console.log("\n" + lines.join("\n"));
    expect(lines.length).toBeGreaterThan(0);
  });
});
