// ⚠️ AUDIT DELLA GEOMETRIA (6/10) — SENZA modello, veloce.
// Per ogni espressione sintetica fa girare i 7 stadi geometrici (runGeometry)
// e verifica CHI hanno consumato: un tratto di cifra/lettera/parentesi
// sbagliata non deve mai sparire (falso positivo); i segni veri (graffe,
// quadre, puntini, meno, uguale) devono invece essere trovati (richiamo).
//   GEO_AUDIT=1 [GEO_SEEDS=4] [GEO_DUMP=/tmp/geo] [GEO_ONLY=minus] npx vitest run src/lib/bench/geoAudit.test.ts
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { CASES } from "./cases";
import { synthDetailed, strokesToPng, type Owner, type SpacingStyle } from "./synthInk";
import { runGeometry } from "../recognizePipeline";
import type { SimpleStroke } from "../dotSigns";

const ON = !!process.env.GEO_AUDIT;
const STYLES: SpacingStyle[] = ["normal", "tight", "touch"];
const BR = "([{)]}";

/** Chi PUÒ essere consumato da ciascuno stadio. */
const ALLOWED: Record<string, (o: Owner) => boolean> = {
  brackets: (o) => BR.includes(o.ch),
  dots: (o) => o.ch === "*" || o.ch === ":",
  fractions: () => false,
  radicals: () => false,
  eights: (o) => o.ch === "8",
  equals: (o) => o.ch === "=",
  minus: (o) => o.ch === "-",
};

function expressionSet(): string[] {
  const set = new Set<string>(CASES.map((c) => c.expr));
  const digits = "0123456789".split("");
  for (const d of [...digits, "x", "y", "a", "b"]) set.add(d);
  for (const d of digits) {
    for (const o of ["(", ")", "[", "]", "{", "}", "+", "-", "*", ":", "="]) {
      set.add(d + o);
      set.add(o + d);
    }
    set.add(`(${d})`);
    set.add(`[${d}]`);
    set.add(`{${d}}`);
    set.add(`${d}+${d}`);
    set.add(`${d}-${d}`);
    set.add(`${d}*${d}`);
    set.add(`${d}=${d}`);
    set.add(`${d}^2`);
    set.add(`1${d}`);
    set.add(`${d}1`);
    set.add(`2${d}`);
    set.add(`${d}3`);
  }
  return [...set];
}

interface Finding {
  stage: string;
  kind: "falso-positivo" | "mancato";
  ch: string;
  expr: string;
  style: SpacingStyle;
  seed: number;
}

describe.skipIf(!ON)("audit geometria (senza modello)", () => {
  it("nessuno stadio consuma tratti di glifi sbagliati", { timeout: 1_800_000 }, async () => {
    const seeds = Number(process.env.GEO_SEEDS ?? 3);
    const only = process.env.GEO_ONLY;
    const dump = process.env.GEO_DUMP;
    let canvasMod: any = null;
    if (dump) canvasMod = await import(/* @vite-ignore */ process.env.CANVAS_MODULE ?? "@napi-rs/canvas");
    const findings: Finding[] = [];
    let samples = 0;
    const exprs = expressionSet();
    for (const expr of exprs) {
      for (const style of STYLES) {
        for (let k = 0; k < seeds; k++) {
          const seed = 5000 + k * 104729 + [...expr].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 100000;
          const { strokes, owners } = synthDetailed(expr, { seed, style });
          samples++;
          const ink: SimpleStroke[] = strokes.map((s) => ({ points: s.points.map((p) => ({ x: p.x, y: p.y })), lineWidth: s.lineWidth }));
          const own = new Map<SimpleStroke, Owner>();
          ink.forEach((s, i) => own.set(s, owners[i]!));
          const g = runGeometry(ink);
          const chain: [string, SimpleStroke[], SimpleStroke[]][] = [
            ["brackets", ink, g.brk.strokes],
            ["dots", g.brk.strokes, g.rewritten.strokes],
            ["fractions", g.rewritten.strokes, g.fr.strokes],
            ["radicals", g.fr.strokes, g.rad.strokes],
            ["eights", g.rad.strokes, g.eights.strokes],
            ["equals", g.eights.strokes, g.eq.strokes],
            ["minus", g.eq.strokes, g.minus.strokes],
          ];
          for (const [stage, before, after] of chain) {
            if (only && stage !== only) continue;
            const kept = new Set(after);
            const removed = before.filter((s) => !kept.has(s) && own.has(s));
            const bad = new Set<string>();
            for (const s of removed) {
              const o = own.get(s)!;
              if (!ALLOWED[stage]!(o)) bad.add(o.ch + (o.sup ? "^" : ""));
            }
            for (const ch of bad) findings.push({ stage, kind: "falso-positivo", ch, expr, style, seed });
            // glifo consumato solo in parte (es. una sola barra di «+»)
            const byGlyph = new Map<number, { total: number; gone: number; ch: string }>();
            for (const s of before) {
              const o = own.get(s);
              if (!o) continue;
              const e = byGlyph.get(o.idx) ?? { total: 0, gone: 0, ch: o.ch };
              e.total++;
              if (!kept.has(s)) e.gone++;
              byGlyph.set(o.idx, e);
            }
            for (const e of byGlyph.values()) {
              if (e.gone > 0 && e.gone < e.total && ALLOWED[stage]!({ idx: 0, ch: e.ch, sup: false })) {
                findings.push({ stage, kind: "falso-positivo", ch: e.ch + "(parziale)", expr, style, seed });
              }
            }
          }
          // richiamo: graffe e quadre devono essere estratte
          if (!only || only === "brackets") {
            const wantBr = [...owners.filter((o) => "[]{}".includes(o.ch) && !o.sup).map((o) => o.idx)];
            const uniq = new Set(wantBr).size;
            const got = g.brk.brackets.filter((b) => b.kind !== "round").length;
            if (got < uniq) findings.push({ stage: "brackets", kind: "mancato", ch: "graffa/quadra", expr, style, seed });
          }
          if ((!only || only === "dots") && (expr.includes("*") || expr.includes(":"))) {
            const want = [...expr].filter((c) => c === "*").length;
            const gotDots = g.rewritten.dots.length;
            if (want > 0 && gotDots < want) findings.push({ stage: "dots", kind: "mancato", ch: "puntino", expr, style, seed });
          }
          if (dump && findings.length && findings[findings.length - 1]!.expr === expr && findings[findings.length - 1]!.seed === seed) {
            const f = findings[findings.length - 1]!;
            const tag = `${f.stage}_${f.kind[0]}_${f.ch.replace(/[^\w]/g, "")}`;
            const dir = `${dump}/${tag}`;
            fs.mkdirSync(dir, { recursive: true });
            const count = fs.readdirSync(dir).length;
            if (count < 6) await strokesToPng(strokes, canvasMod, `${dir}/${expr.replace(/[^\w]/g, "_")}_${style}_${seed}.png`);
          }
        }
      }
    }
    // ---- report -----------------------------------------------------------
    const agg = new Map<string, { n: number; ex: string[] }>();
    for (const f of findings) {
      const key = `${f.stage.padEnd(10)} ${f.kind.padEnd(14)} ${f.ch}`;
      const e = agg.get(key) ?? { n: 0, ex: [] };
      e.n++;
      if (e.ex.length < 4) e.ex.push(`${f.expr}/${f.style[0]}${f.seed % 1000}`);
      agg.set(key, e);
    }
    const lines = [`\n=== AUDIT GEOMETRIA: ${exprs.length} espressioni, ${samples} campioni, ${findings.length} problemi ===`];
    for (const [k, v] of [...agg.entries()].sort((a, b) => b[1].n - a[1].n)) {
      lines.push(`${String(v.n).padStart(5)}  ${k}   es: ${v.ex.join("  ")}`);
    }
    console.log(lines.join("\n"));
    if (process.env.GEO_OUT) fs.writeFileSync(process.env.GEO_OUT, JSON.stringify(findings));
    expect(samples).toBeGreaterThan(0);
  });
});
