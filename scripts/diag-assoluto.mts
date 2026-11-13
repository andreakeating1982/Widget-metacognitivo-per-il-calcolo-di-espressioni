/** Diagnostica rapida del supporto al VALORE ASSOLUTO (12/11). */
import { evaluateNumericExpression, normalizeInput, parseExpression, printLatex } from "../client/src/lib/espressioni";
import { verificaPerSostituzione } from "../server/costruisci";

const prove: Array<[string, string | null]> = [
  ["|-3|", 3],
  ["|5-8|+1", 4],
  ["|x+3|", null], // con lettera: valore null, passa alla sostituzione
];

for (const [s, atteso] of prove) {
  const v = evaluateNumericExpression(normalizeInput(s));
  console.log(`valore(${s}) = ${v} (atteso ${atteso}) ${v === atteso ? "OK" : "<<< DIVERSO"}`);
}

const ast = parseExpression(normalizeInput("|x+3|+x-1"));
console.log("printLatex:", printLatex(ast));

const casi: Array<[string, string, boolean | null]> = [
  ["\\sqrt{\\left(x+3\\right)^{2}}", "|x+3|", true],   // rigore: forma con valore assoluto
  ["\\sqrt{\\left(x+3\\right)^{2}}", "x+3", true],    // convenzione libro di testo
  ["\\sqrt{\\left(x+3\\right)^{2}}", "-(x+3)", false], // scorretta
  ["|x+3|+x-1", "|x+3|+x-1", true],                    // identità
  ["|x-1|", "x-1", false],                             // il valore assoluto NON è il binomio
  ["\\sqrt{(x+3)^{2}}+x-1", "|x+3|+x-1", true],        // l'espressione della foto
];
for (const [op, an, atteso] of casi) {
  const r = verificaPerSostituzione(op, an);
  const ok = r ? r.ok : null;
  console.log(`verifica(${op} vs ${an}) = ${ok} ${r ? `via: ${r.via}` : "(null)"} ${ok === atteso ? "OK" : "<<< DIVERSO"}`);
}
