// Diagnostica 10/11: come vengono normalizzati i due lati del confronto.
import { latexToPlainMath, normalizeInput, parseExpression } from "../client/src/lib/espressioni";
import { analyzeExpression } from "../client/src/lib/espressioni";
import { sameSourceStructure } from "../client/src/lib/progressiveExpression";

const app = "0,3per⁻³√(ab^-1)";
const latex = "0,3\\overline{3}\\sqrt[-3]{ab^{-1}}";

console.log("latexToPlainMath(latex):", JSON.stringify(latexToPlainMath(latex)));
console.log("normalizeInput(app):", JSON.stringify(normalizeInput(app)));
try {
  console.log("analyze(app):", analyzeExpression(app).originalLatex);
} catch (e) {
  console.log("parse(app) ERRORE:", e.message);
}
try {
  console.log("analyze(plain):", analyzeExpression(latexToPlainMath(latex)).originalLatex);
} catch (e) {
  console.log("parse(plain) ERRORE:", e.message);
}
console.log("sameSourceStructure:", sameSourceStructure(app, latex));

