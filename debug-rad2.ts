/** Caso minimo 2: risultatoMotore / risultatoRadicaleLatex sulla radice bloccata. */
import { risultatoRadicaleLatex } from "./client/src/lib/numericRadicalEquality";
import { parseExpression, normalizeInput, evalRat } from "./client/src/lib/espressioni";

const op = process.argv[2] ?? "\\sqrt[-2]{\\dfrac{1}{90}}";
const t0 = Date.now();
console.log("risultatoRadicaleLatex:", risultatoRadicaleLatex(op), "in", Date.now() - t0, "ms");
