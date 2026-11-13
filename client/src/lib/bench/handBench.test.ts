// ⚠️ BANCO DI PROVA (6/10) — scrittura a mano col modello REALE.
//   MODEL_BENCH=1 [BENCH_SEEDS=2] [BENCH_SHARD=0/2] [BENCH_FILTER=^P3] [BENCH_OUT=/tmp/x.json]
//   CANVAS_MODULE=/…/@napi-rs/canvas/index.js  npx vitest run src/lib/bench/handBench.test.ts
// Ogni caso del catalogo viene scritto in 3 stili (normale / stretto / a contatto)
// × N semi, letto con la STESSA pipeline dell'app (recognizePieceWith) e
// confrontato con l'atteso. Stampa il tasso per classe e per stile, poi gli
// errori; salva tutto in JSON per confrontare due esecuzioni (prima/dopo).
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { CASES, CLASSES, canon, countElements } from "./cases";
import { loadNodeEngine } from "./nodeEngine";
import { strokesToPng, synthExpression, type SpacingStyle } from "./synthInk";
import { finalizePiece, recognizePieceWith } from "../recognizePiece";

// A/B del flag MINUS_BARS_OUT (recognizePipeline.ts): MINUS_OUT=0 lascia le barre nell'inchiostro del modello
if (process.env.MINUS_OUT !== undefined) (globalThis as { __MINUS_BARS_OUT?: boolean }).__MINUS_BARS_OUT = process.env.MINUS_OUT !== "0";
// A/B dei due-punti come item di posizione (dotSigns.ts): COLON_ITEM=0 = barra sintetica storica
if (process.env.COLON_ITEM !== undefined) (globalThis as { __COLON_AS_ITEM?: boolean }).__COLON_AS_ITEM = process.env.COLON_ITEM !== "0";
// A/B della chiusura dei vuoti larghi (gapClose.ts): GAP_FRAC=0 la disattiva, GAP_FRAC=0.15 … la regola.
if (process.env.GAP_FRAC !== undefined) (globalThis as { __MODEL_GAP_FRAC?: number }).__MODEL_GAP_FRAC = Number(process.env.GAP_FRAC);

const ON = !!process.env.MODEL_BENCH;
const STYLES: SpacingStyle[] = ["normal", "tight", "touch"];

/** Atteso in forma «grezza» (come la pipeline): * → \cdot, ^d resta. */
const expected = (expr: string): string => expr.replace(/\*/g, "\\cdot").replace(/<([^|>]*)\|([^>]*)>/g, "\\frac{$1}{$2}");

interface Row {
  id: string;
  cls: string;
  expr: string;
  style: SpacingStyle;
  seed: number;
  got: string;
  ok: boolean;
  /** lettura del SOLO modello sui tratti originali (senza riscritture) */
  raw: string;
  rawOk: boolean;
  ms: number;
}

/** Chiave di cache della lettura grezza: dipende solo dai tratti. */
function hashStrokes(strokes: { points: { x: number; y: number }[] }[]): string {
  let h = 2166136261;
  for (const s of strokes) {
    for (const p of s.points) {
      h = Math.imul(h ^ Math.round(p.x * 10), 16777619);
      h = Math.imul(h ^ Math.round(p.y * 10), 16777619);
    }
    h = Math.imul(h ^ 0x9e37, 16777619);
  }
  return String(h >>> 0) + ":" + strokes.length;
}

describe.skipIf(!ON)("banco: scrittura a mano — catalogo", () => {
  it("legge il catalogo col modello reale", { timeout: 4 * 3600_000 }, async () => {
    const { deps, canvas } = await loadNodeEngine();
    const [shardI, shardN] = (process.env.BENCH_SHARD ?? "0/1").split("/").map(Number) as [number, number];
    const filter = process.env.BENCH_FILTER ? new RegExp(process.env.BENCH_FILTER) : null;
    const seeds = Number(process.env.BENCH_SEEDS ?? 2);
    const dump = process.env.DUMP_FAILS;
    const rows: Row[] = [];
    const rawCachePath = process.env.BENCH_RAW_CACHE;
    const rawCache: Record<string, string> =
      rawCachePath && fs.existsSync(rawCachePath) ? JSON.parse(fs.readFileSync(rawCachePath, "utf8")) : {};
    const cases = CASES.filter((c, i) => i % shardN === shardI && (!filter || filter.test(c.id + " " + c.expr)));
    for (const c of cases) {
      if (c.cls !== "L" && countElements(c.expr) > 8) console.warn("caso con più di 8 elementi (banco storico):", c.expr);
      for (const style of STYLES) {
        for (let k = 0; k < seeds; k++) {
          const seed = 1000 + k * 7919 + c.id.length * 31 + [...c.expr].reduce((a, ch) => a + ch.charCodeAt(0), 0);
          let strokes = synthExpression(c.expr, { seed, style, ...(process.env.BENCH_H ? { H: Number(process.env.BENCH_H) } : {}) });
          // BENCH_ROUND=1: coordinate a pixel INTERI come gli eventi mouse (prova di sensibilità)
          if (process.env.BENCH_ROUND) {
            strokes = strokes.map((st) => ({ ...st, points: st.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) }));
          }
          // lettura GREZZA (solo modello): serve a distinguere errori della
          // geometria da errori del modello; in cache perché non dipende dal codice
          const hk = hashStrokes(strokes);
          if (rawCache[hk] === undefined) {
            const rr = await deps.engine.recognize(deps.preprocessStrokes(strokes as any), deps.vocab, "expression");
            rawCache[hk] = rr?.latex ?? "";
          }
          const raw = finalizePiece({ latex: rawCache[hk] } as any, strokes as any);
          const t0 = Date.now();
          let got = "";
          try {
            got = await recognizePieceWith(deps, strokes as any);
          } catch (e) {
            got = "ERRORE: " + (e as Error).message;
          }
          const ok = canon(got) === canon(expected(c.expr));
          const rawOk = canon(raw) === canon(expected(c.expr));
          rows.push({ id: c.id, cls: c.cls, expr: c.expr, style, seed, got, ok, raw, rawOk, ms: Date.now() - t0 });
          if (!ok && dump) {
            await strokesToPng(strokes, canvas, `${dump}/${c.id}_${style}_${k}.png`);
          }
        }
      }
    }
    const out = process.env.BENCH_OUT ?? "/tmp/bench-hand.json";
    fs.writeFileSync(out, JSON.stringify(rows, null, 1));
    if (rawCachePath) fs.writeFileSync(rawCachePath, JSON.stringify(rawCache));

    // ---- report ----------------------------------------------------------
    const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(0).padStart(3) + "%" : "  - ");
    const lines: string[] = [];
    lines.push(`\n=== RISULTATI (${rows.length} letture, shard ${shardI}/${shardN}) ===`);
    const clsKeys = Object.keys(CLASSES);
    for (const cls of clsKeys) {
      const rs = rows.filter((r) => r.cls === cls);
      if (!rs.length) continue;
      const per = STYLES.map((s) => {
        const x = rs.filter((r) => r.style === s);
        return `${s}:${pct(x.filter((r) => r.ok).length, x.length)}`;
      }).join("  ");
      lines.push(`${cls} ${CLASSES[cls]!.padEnd(34)} ${pct(rs.filter((r) => r.ok).length, rs.length)}   ${per}`);
    }
    lines.push(`TOTALE ${pct(rows.filter((r) => r.ok).length, rows.length)}`);
    const fails = rows.filter((r) => !r.ok);
    lines.push(`\n--- ERRORI (${fails.length}) ---`);
    // un solo errore per (caso, stile) per brevità: il primo
    const seen = new Set<string>();
    for (const r of fails) {
      const key = r.id + r.style;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`${r.id.padEnd(6)} ${r.style.padEnd(6)} ${r.expr.padEnd(16)} → ${JSON.stringify(r.got)}`);
    }
    console.log(lines.join("\n"));
    expect(rows.length).toBeGreaterThan(0);
  });
});
