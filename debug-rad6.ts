/** Test pulito: chiama la FUNZIONE reale, nessun regex locale. */
import { radicaleIndiceNegativoAPositivo } from "./client/src/lib/numericRadicalEquality";

const s = String.raw`\sqrt[-2]{\dfrac{1}{90}}`;
console.log("input :", JSON.stringify(s));
console.log("output:", JSON.stringify(radicaleIndiceNegativoAPositivo(s)));
