import { analyzeExpression } from "../client/src/lib/espressioni.ts";
const a = analyzeExpression("x^2 : x^4");
for (const [i, s] of a.steps.entries()) console.log(i, s.kind, "| op=", s.opLatex ?? "-", "| ap=", s.answerPoly ? JSON.stringify(s.answerPoly) : "-", "|", s.latex);
console.log("finale:", a.finalLatex);
