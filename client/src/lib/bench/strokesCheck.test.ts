/**
 * [CHECK_ROUND=1 arrotonda i punti a interi come gli eventi mouse.]
 * Verifica in Node (modello reale) una o più espressioni con più semi e altezze di cifra: serve a
 * distinguere un errore del browser da un errore del riconoscimento (es. cifre piccole H=38).
 *
 *   STROKES_CHECK=1 CHECK_EXPRS='["{[(3+2)]}","3*(2+4)"]' [CHECK_SEEDS=12] [CHECK_H='[38,50]'] [CHECK_STYLES='["normal","tight"]']
 *     CANVAS_MODULE=/…/@napi-rs/canvas/index.js npx vitest run src/lib/bench/strokesCheck.test.ts
 */
import { describe, expect, it } from "vitest";
import { canon } from "./cases";
import { loadNodeEngine } from "./nodeEngine";
import { synthExpression, type SpacingStyle } from "./synthInk";
import { finalizePiece, recognizePieceWith } from "../recognizePiece";

const ON = !!process.env.STROKES_CHECK;


describe.skipIf(!ON)("strokesCheck", () => {
  it("espressioni × semi × altezze", { timeout: 3600_000 }, async () => {
    const { deps } = await loadNodeEngine();
    const exprs: string[] = JSON.parse(process.env.CHECK_EXPRS ?? '["{[(3+2)]}"]');
    const seeds = Number(process.env.CHECK_SEEDS ?? 12);
    const hs: number[] = JSON.parse(process.env.CHECK_H ?? "[38,50]");
    const styles: SpacingStyle[] = JSON.parse(process.env.CHECK_STYLES ?? '["normal"]');
    const lines: string[] = [];
    for (const expr of exprs) {
      for (const style of styles) {
        for (const H of hs) {
          let ok = 0;
          let rawOk = 0;
          const bad: string[] = [];
          for (let s = 1; s <= seeds; s++) {
            const seed = 10 + s; // il seme 11 è quello del collaudo nel browser
            let strokes = synthExpression(expr, { seed, H, style, sloppy: 0.35 });
            // CHECK_ROUND=1: coordinate a pixel INTERI, come gli eventi mouse del browser
            if (process.env.CHECK_ROUND) {
              strokes = strokes.map((st) => ({ ...st, points: st.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) }));
            }
            const want = canon(expr.replace(/\*/g, "\\cdot"));
            // lettura del SOLO modello (nessuna riscrittura geometrica), come in handBench
            const rr = await deps.engine.recognize(deps.preprocessStrokes(strokes as any), deps.vocab, "expression");
            if (canon(finalizePiece({ latex: rr?.latex ?? "" } as any, strokes as any)) === want) rawOk++;
            const got = await recognizePieceWith(deps, strokes);
            if (canon(got) === want) ok++;
            else bad.push(`s${seed}:${got}`);
          }
          lines.push(`CHECK${process.env.CHECK_ROUND ? "[int]" : ""} ${expr} ${style} H=${H}: ${ok}/${seeds} (solo modello ${rawOk}/${seeds})${bad.length ? "  ✗ " + bad.slice(0, 6).join(" | ") : ""}`);
        }
      }
    }
    console.log("\n" + lines.join("\n"));
    expect(lines.length).toBeGreaterThan(0);
  });
});
