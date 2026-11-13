/** Il motore semplifica le radici positive perfette con lettere? */
import { risultatoNesimoLatex, risultatoRadicaleLatex } from "./client/src/lib/numericRadicalEquality";

const casi = [
  "\\sqrt[3]{\\left(x-1\\right)^{3}}",
  "\\sqrt[4]{\\left(x-2\\right)^{4}}",
];
for (const c of casi) {
  console.log(c, "→ nesimo:", risultatoNesimoLatex(c), "| radicale:", risultatoRadicaleLatex(c));
}
