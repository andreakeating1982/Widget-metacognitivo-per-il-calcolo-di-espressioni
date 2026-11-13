import { analyzeExpression } from "../client/src/lib/espressioni.ts";

const exprs = [
  "\\left(\\frac{1}{3}\\right)^{-4} : \\left(\\frac{1}{3}\\right)^{-2}",
  "x^6 : x^2",
  "2^6 : 2^2",
  "(1/3)^-4 : (1/3)^-2",
  "\\left(\\frac{1}{3}\\right)^{2} \\cdot \\left(\\frac{1}{3}\\right)^{3}",
];

for (const e of exprs) {
  console.log("=== ESPRESSIONE:", e);
  try {
    const a = analyzeExpression(e);
    console.log("  finale:", a.finalLatex);
    a.steps.forEach((s, i) => {
      console.log(`  passo ${i}: kind=${s.kind} latex=${s.latex}`);
      if (s.detail) console.log(`          detail=${s.detail}`);
      if (s.opLatex) console.log(`          opLatex=${s.opLatex} answer=${s.answer ? s.answer.n + "/" + s.answer.d : "-"}`);
      if (s.answerPoly) console.log(`          answerPoly=${JSON.stringify(s.answerPoly)}`);
    });
  } catch (err) {
    console.log("  ERRORE:", err instanceof Error ? err.message : String(err));
  }
}
