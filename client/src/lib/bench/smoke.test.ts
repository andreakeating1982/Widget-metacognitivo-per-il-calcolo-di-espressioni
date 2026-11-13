// Prova rapida del banco: genera alcune espressioni sintetiche, ne salva il PNG
// (per ispezione visiva) e le legge col modello reale.
import { describe, expect, it } from "vitest";
import { loadNodeEngine } from "./nodeEngine";
import { strokesToPng, synthExpression } from "./synthInk";
import { recognizePieceWith } from "../recognizePiece";

const ON = !!process.env.MODEL_BENCH;

describe.skipIf(!ON)("banco: smoke col modello reale", () => {
  it("legge alcune espressioni sintetiche", { timeout: 600_000 }, async () => {
    const { deps, canvas } = await loadNodeEngine();
    const cases = ["3(2+1)", "[(2+3)*4]", "{[(1+2)*3]-4}", "(x+1)(x-1)", "2+3", "12-5"];
    const out: string[] = [];
    for (const [i, e] of cases.entries()) {
      for (const style of ["normal", "tight"] as const) {
        const strokes = synthExpression(e, { seed: 100 + i, style });
        if (process.env.DUMP_DIR) {
          await strokesToPng(strokes, canvas, `${process.env.DUMP_DIR}/smoke_${i}_${style}.png`);
        }
        const t0 = Date.now();
        const got = await recognizePieceWith(deps, strokes as any);
        out.push(`${e.padEnd(16)} ${style.padEnd(7)} → ${JSON.stringify(got)}  (${Date.now() - t0} ms)`);
      }
    }
    console.log("\n" + out.join("\n"));
    expect(out.length).toBe(cases.length * 2);
  });
});
