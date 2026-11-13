/** Come valuta il motore le radici con INDICE NEGATIVO? */
import { evaluateNumericExpression } from "./client/src/lib/espressioni";
import { verificaPerSostituzione } from "./client/src/lib/verificaSostituzione";

const casi: [string, string][] = [
  ["\\sqrt[-3]{64}", "atteso 0.25"],
  ["\\sqrt[3]{64}", "atteso 4"],
  ["\\sqrt[-2]{\\dfrac{1}{90}}", "atteso ≈3.1623 (√10)"],
];
for (const [e, note] of casi) {
  let v: number | null = null;
  try { v = evaluateNumericExpression(e); } catch (err) { console.log(e, "→ ERRORE", (err as Error).message.slice(0, 50)); continue; }
  console.log(e, "→", v, `(${note})`);
}
const s = verificaPerSostituzione("\\sqrt[-3]{\\left(x-1\\right)^{3}}", "\\dfrac{1}{x-1}");
console.log("sostituzione √[−3]{(x−1)³} vs 1/(x−1):", JSON.stringify(s));
