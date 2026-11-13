/** Test isolato della riscrittura (senza escaping di shell). */
import { radicaleIndiceNegativoAPositivo } from "./client/src/lib/numericRadicalEquality";

const s = "\\sqrt[-2]{\\dfrac{1}{90}}";
console.log("input :", JSON.stringify(s));
console.log("guarda:", /\\sqrt\\[-\\d+\\]\{/.test(s));
console.log("output:", JSON.stringify(radicaleIndiceNegativoAPositivo(s)));
