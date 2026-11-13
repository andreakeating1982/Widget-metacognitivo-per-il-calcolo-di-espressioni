import { analyzeExpression } from "../client/src/lib/espressioni.ts";
try {
  const a = analyzeExpression("\\sqrt[4]{\\dfrac{1}{16}}");
  console.log("OK:", a.finalLatex);
} catch (e) {
  console.log("ERRORE:", e instanceof Error ? e.message : String(e));
}
try {
  const a = analyzeExpression("\\sqrt[4]{16}");
  console.log("OK sqrt16:", a.finalLatex);
} catch (e) {
  console.log("ERRORE sqrt16:", e instanceof Error ? e.message : String(e));
}
