import { analyzeExpression, auditProgressivita } from "../client/src/lib/espressioni.ts";
for (const e of ["2^-2", "5 \\cdot 2^{-2}", "\\left(\\frac{1}{3}\\right)^{-2}"]) {
  const a = analyzeExpression(e);
  console.log("=== ", e, "→", a.finalLatex);
  a.steps.forEach((s, i) => console.log(`  ${i}: ${s.kind} | op=${s.opLatex ?? "-"} | ans=${s.answer ? s.answer.n + "/" + s.answer.d : s.answerPoly ? JSON.stringify(s.answerPoly) : "-"} | ${s.detail ?? ""} | ${s.latex}`));
  console.log("  audit:", JSON.stringify(auditProgressivita(a.steps)));
}
