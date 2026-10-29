import { analyzeExpression } from "../client/src/lib/espressioni.ts";

const exprs = [
  "2·\\sqrt{9}+x",
  "\\sqrt[3]{27} : \\sqrt[3]{8}",
  "\\sqrt{4x^2}",
  "\\sqrt[3]{x^9}",
  "\\sqrt[4]{-16x^4}",
  "\\sqrt[3]{27x^6} : \\sqrt[3]{8}",
  "\\sqrt{9} \\cdot \\sqrt{x^4}",
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
