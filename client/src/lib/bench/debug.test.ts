// Diagnostica di UN caso: lettura grezza del modello vs pipeline, parentesi
// estratte, PNG. DBG_EXPR="2+3" DBG_SEEDS="1,2,3" DBG_STYLE=normal
import { describe, it } from "vitest";
import { loadNodeEngine } from "./nodeEngine";
import { strokesToPng, synthExpression, type SpacingStyle } from "./synthInk";
import { recognizeInk } from "../recognizePipeline";
import { finalizePiece } from "../recognizePiece";
import { rewriteBrackets } from "../squareBrackets";

const ON = !!process.env.MODEL_BENCH && !!process.env.DBG_EXPR;

describe.skipIf(!ON)("debug caso", () => {
  it("stampa le letture", { timeout: 900_000 }, async () => {
    const { deps, canvas } = await loadNodeEngine();
    const exprs = (process.env.DBG_EXPR ?? "").split(";");
    const seeds = (process.env.DBG_SEEDS ?? "1,2,3").split(",").map(Number);
    const style = (process.env.DBG_STYLE ?? "normal") as SpacingStyle;
    const out: string[] = [];
    for (const expr of exprs) {
      for (const seed of seeds) {
        const strokes = synthExpression(expr, { seed, style });
        if (process.env.DUMP_DIR) await strokesToPng(strokes, canvas, `${process.env.DUMP_DIR}/dbg_${expr.replace(/[^\w]/g, "_")}_${seed}.png`);
        // lettura GREZZA: solo il modello sui tratti originali
        const raw = await deps.engine.recognize(deps.preprocessStrokes(strokes as any), deps.vocab, "expression");
        const rb = rewriteBrackets(strokes as any);
        const res = await recognizeInk(deps, strokes as any, "expression");
        out.push(
          `${expr.padEnd(14)} s${seed} grezzo=${JSON.stringify(raw?.latex)}  parentesi=[${rb.brackets
            .map((b) => (b.isOpen ? "" : "/") + b.kind[0])
            .join(",")}] tratti ${strokes.length}→${rb.strokes.length}  pipeline=${JSON.stringify(res?.latex)}  finale=${JSON.stringify(finalizePiece(res, strokes as any))}`,
        );
      }
    }
    console.log("\n" + out.join("\n"));
  });
});
