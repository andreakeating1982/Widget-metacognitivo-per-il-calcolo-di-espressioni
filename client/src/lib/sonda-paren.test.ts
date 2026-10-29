import { describe, it } from "vitest";
import { analyzeExpression } from "./espressioni";
const ON = !!process.env.SONDA;
describe.skipIf(!ON)("sonda-paren", () => {
  it("paren", () => {
    for (const e of ["(\\frac{1}{2}\\cdot\\frac{1}{5}) : \\frac{1}{3}", "[\\frac{1}{2}\\cdot\\frac{1}{5}] : \\frac{1}{3}", "\\frac{1}{2}\\cdot\\frac{1}{5}\\cdot 3", "(\\frac{1}{2}\\cdot[\\frac{1}{5}]) : \\frac{1}{3}"]) {
      const a = analyzeExpression(e);
      console.log("EXPR", e);
      console.log("  final:", a.finalLatex);
      a.steps.forEach((s, i) => console.log("  passo", i, s.kind, "|", s.latex, "| op:", (s as any).opLatex ?? "-", "| ans:", (s as any).answer ? JSON.stringify((s as any).answer) : "-", "| det:", (s as any).detail ?? "-"));
    }
  });
});
