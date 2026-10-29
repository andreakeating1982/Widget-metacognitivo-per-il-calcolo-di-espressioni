// Test del flusso esponente negativo (25/10)
import { analyzeExpression } from "../client/src/lib/espressioni.ts";

const cases = [
  "2^-2",
  "3 · 2^-2",
  "2^3 · 2^-2",
  "5 : 2^-2",
  "2^-2 + 1",
  "(2^-2)",
  "2^-2 : 5",
];

for (const raw of cases) {
  console.log("=".repeat(60));
  console.log("ESPRESSIONE:", raw);
  try {
    const a = analyzeExpression(raw);
    console.log("  originale:", a.originalLatex);
    for (const s of a.steps) {
      console.log(
        `  [${s.kind}] latex=${s.latex}` +
          (s.opLatex ? ` | op=${s.opLatex}` : "") +
          (s.answer ? ` | answer=${s.answer.n}/${s.answer.d}` : "") +
          (s.answerPoly ? ` | answerPoly=${JSON.stringify(s.answerPoly)}` : "") +
          (s.detail ? ` | detail=${s.detail}` : "")
      );
    }
    console.log("  RISULTATO FINALE:", a.finalLatex);
  } catch (e) {
    console.log("  ERRORE:", e instanceof Error ? e.message : String(e));
  }
}
