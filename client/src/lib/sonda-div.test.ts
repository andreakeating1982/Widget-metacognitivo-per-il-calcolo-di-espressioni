import { describe, it } from "vitest";
import { analyzeExpression } from "./espressioni";
const ON = !!process.env.SONDA;
describe.skipIf(!ON)("sonda-div", () => {
  it("div in paren", () => {
    for (const e of ["(\\frac{3}{7} : \\frac{9}{14})^2 - \\frac{7}{12} \\cdot 2", "(\\frac{3}{7} : \\frac{9}{14}) : \\frac{1}{3}", "9 : (\\frac{3}{7} : \\frac{9}{14})"]) {
      const a = analyzeExpression(e);
      console.log("EXPR", e);
      console.log("  final:", a.finalLatex);
      a.steps.forEach((s, i) => console.log("  passo", i, s.kind, "|", s.latex, "| op:", (s as any).opLatex ?? "-", "| ans:", (s as any).answer ? JSON.stringify((s as any).answer) : "-", "| det:", (s as any).detail ?? "-"));
    }
  });
});
