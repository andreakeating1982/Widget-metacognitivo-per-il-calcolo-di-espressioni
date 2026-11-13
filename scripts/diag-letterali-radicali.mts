/** Diagnosi «espressione letterale con radicali non si costruisce» (no.png).
 *  Senza IA: verifica che la VALUTAZIONE NUMERICA regga le forme LaTeX
 *  dell'IA dopo la sostituzione della lettera, e che i prodotti notevoli
 *  già passino con rationalPolyEquals/polinomio. */
import { evaluateNumericExpression, rationalPolyEquals } from "../client/src/lib/espressioni.ts";
import { valoreBigint } from "../server/costruisci.ts";

const val = (s: string): string => {
  try {
    const v = evaluateNumericExpression(s);
    return v === null || Number.isNaN(v) ? "null/NaN" : String(v);
  } catch (e) { return "throw: " + (e instanceof Error ? e.message : String(e)); }
};

console.log("═══ VALUTAZIONE con a sostituita (valore(op) ↔ valore(answer)) ═══");
const coppie: Array<[string, string, number]> = [
  // [op, answer, a]
  ["\\sqrt{\\dfrac{(a-1)(a+1)}{3}}:[3(a+1)]", "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}", 2],
  ["\\sqrt{\\dfrac{(a-1)(a+1)}{3}}:[3(a+1)]", "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}", 5],
  ["\\sqrt{\\dfrac{(a-1)(a+1)}{3}}:[3(a+1)]", "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}", 11],
  ["\\sqrt{\\dfrac{a^{2}-1}{3}}:(3a+3)", "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}", 5],
  ["\\sqrt{\\dfrac{(a-1)(a+1)}{3}}", "\\dfrac{\\sqrt{(a-1)(a+1)}}{\\sqrt{3}}", 5],
  ["\\sqrt{(a-1)(a+1)}", "\\sqrt{a-1}\\cdot\\sqrt{a+1}", 5],
  ["\\sqrt{a+1}:(a+1)", "\\dfrac{1}{\\sqrt{a+1}}", 5],
  ["\\sqrt{3}\\cdot\\sqrt{a+1}", "\\sqrt{3(a+1)}", 5],
];
for (const [op, an, a] of coppie) {
  const sos = (s: string) => s.replace(/\ba\b/g, String(a));
  const vo = val(sos(op)), va = val(sos(an));
  const ok = vo !== "null/NaN" && !vo.startsWith("throw") && va !== "null/NaN" && !va.startsWith("throw")
    && Math.abs(Number(vo) - Number(va)) <= 1e-9 * Math.max(1, Math.abs(Number(vo)));
  console.log(`${ok ? "✅" : "❌"} a=${a}  op→${vo}  an→${va}`);
}

console.log("\n═══ GIÀ OK OGGI (prodotti notevoli, senza radicali) ═══");
for (const [op, an] of [["a^{2}-1", "(a-1)(a+1)"], ["3a+3", "3(a+1)"]] as Array<[string, string]>) {
  console.log(`rationalPolyEquals("${op}","${an}") =`, rationalPolyEquals(op, an));
}

console.log("\n═══-valoreBigint sui sostituiti (non serve, ma non deve rompere) ═══");
console.log("bigint a²−1 con a=5:", valoreBigint("5^{2}-1"));
