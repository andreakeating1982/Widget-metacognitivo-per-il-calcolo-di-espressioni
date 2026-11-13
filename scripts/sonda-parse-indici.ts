/* Sonda tecnica: parser e valutatore sulle scritture dei futuri box.
 * Nessun calcolo della soluzione: solo forme intermedie meccaniche. */
import {
  evaluateNumericExpression,
  normalizeInput,
  parseExpression,
  printLatex,
} from "../client/src/lib/espressioni";
import { sostituisciLettere } from "../client/src/lib/verificaSostituzione";

const forme = [
  "\\sqrt[6]{\\left(\\dfrac{a^{2}-1}{3}\\right)^{3}}",
  "\\sqrt[6]{\\dfrac{\\left(a^{2}-1\\right)^{3}}{27\\left(3a+3\\right)^{2}}}",
  "\\sqrt[6]{\\dfrac{\\left(a-1\\right)^{3}\\left(a+1\\right)^{3}}{27 \\cdot 9\\left(a+1\\right)^{2}}}",
  "\\sqrt[6]{\\dfrac{\\left(a-1\\right)^{3}\\left(a+1\\right)}{243}}",
];
for (const f of forme) {
  try {
    const ast = parseExpression(normalizeInput(f, true));
    console.log("PARSE OK :", printLatex(parseExpression(normalizeInput(f, true))));
  } catch (e) {
    console.log("PARSE FAIL:", f, (e as Error).message);
  }
}
const formeNumeriche = [
  ["\\sqrt[6]{\\dfrac{\\left(a-1\\right)^{3}\\left(a+1\\right)}{243}}", 5],
  ["\\sqrt[6]{\\dfrac{\\left(a-1\\right)^{3}\\left(a+1\\right)}{243}}", -2],
  ["\\sqrt[6]{\\left(\\dfrac{a^{2}-1}{3}\\right)^{3}}", 5],
  ["\\sqrt[6]{\\left(\\dfrac{a^{2}-1}{3}\\right)^{3}}", -2],
  ["\\sqrt[6]{\\dfrac{\\left(a-1\\right)^{3}\\left(a+1\\right)^{3}}{27 \\cdot 9\\left(a+1\\right)^{2}}}", 5],
] as const;
for (const [f, a] of formeNumeriche) {
  const s = sostituisciLettere(f, { a });
  try {
    console.log(`VAL a=${a}:`, evaluateNumericExpression(s));
  } catch (e) {
    console.log(`VAL a=${a} FAIL:`, (e as Error).message, "←", s);
  }
}
