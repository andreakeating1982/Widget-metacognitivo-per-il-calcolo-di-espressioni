// Un solo caso, col modello reale, con la traccia dei passaggi:
//   ONE=1 ONE_EXPR="12-5" ONE_STYLE=normal ONE_SEED=1352 CANVAS_MODULE=… npx vitest run src/lib/bench/oneCase.test.ts
// Stampa: lettura grezza del modello sull'inchiostro originale, LaTeX del modello sull'inchiostro
// RIMASTO (prima dei reinserimenti), risultato finale della pipeline.
import { describe, it } from "vitest";
import { loadNodeEngine } from "./nodeEngine";
import { synthExpression, type SpacingStyle } from "./synthInk";
import { finalizePiece, recognizePieceWith } from "../recognizePiece";
import { recognizeInk } from "../recognizePipeline";
import { detectBracketKinds } from "../squareBrackets";

const ON = !!process.env.ONE;
describe.skipIf(!ON)("un caso", () => {
  it("legge", { timeout: 300_000 }, async () => {
    const { deps } = await loadNodeEngine();
    // lista di casi «expr|style|seed;expr|style|seed»
    const specs = (process.env.ONE_LIST ?? `${process.env.ONE_EXPR}@${process.env.ONE_STYLE ?? "normal"}@${process.env.ONE_SEED ?? 1000}`).split(";");
    for (const sp of specs) {
      const [expr, style, seed] = sp.split(sp.includes("@") ? "@" : "|") as [string, SpacingStyle, string];
      let strokes = synthExpression(expr, { seed: Number(seed), style, ...(process.env.BENCH_H ? { H: Number(process.env.BENCH_H) } : {}) });
      if (process.env.BENCH_ROUND) strokes = (strokes as any).map((st: any) => ({ ...st, points: st.points.map((q: any) => ({ ...q, x: Math.round(q.x), y: Math.round(q.y) })) })) as any;
      const rr = await deps.engine.recognize(deps.preprocessStrokes(strokes as any), deps.vocab, "expression");
      const raw = finalizePiece({ latex: rr?.latex ?? "" } as any, strokes as any);
      const res = await recognizeInk(deps, strokes as any, "expression");
      const got = await recognizePieceWith(deps, strokes as any);
      const kinds = detectBracketKinds(strokes as any);
      console.log(`ONE «${expr}» ${style} ${seed}\n   forme:         aperte [${kinds.opens.join(",")}] chiuse [${kinds.closes.join(",")}]\n   grezzo:        «${raw}»\n   modello-resto: «${res?.debugModelLatex ?? "(nessuna lettura)"}»\n   finale:        «${got}»`);
    }
  });
});
