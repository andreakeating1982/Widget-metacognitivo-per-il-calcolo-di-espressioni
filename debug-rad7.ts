/** Cosa calcola il motore sulle radici con indice negativo (per il riparo box). */
import { risultatoRadicaleLatex } from "./client/src/lib/numericRadicalEquality";

const casi = [
  "\\sqrt[-2]{\\dfrac{1}{90}}",
  "\\sqrt[-3]{\\left(x-1\\right)^{3}}",
  "\\sqrt[-3]{(x-1)^{3}}",
  "\\dfrac{1}{\\sqrt[3]{\\left(x-1\\right)^{3}}}",
  "\\sqrt[-4]{\\left(x-2\\right)^{4}}",
];
for (const c of casi) {
  console.log(c, "→", risultatoRadicaleLatex(c));
}
