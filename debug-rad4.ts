/** Debug: perché √[−2]{1/90} non diventa ancora 3√10? */
import { radicaleIndiceNegativoAPositivo, sommaRadicaleDi } from "./client/src/lib/numericRadicalEquality";
import { parseExpression, normalizeInput } from "./client/src/lib/espressioni";

const op = "\\sqrt[-2]{\\dfrac{1}{90}}";
const riscritta = radicaleIndiceNegativoAPositivo(op);
console.log("riscritta:", riscritta);
const nodo = parseExpression(normalizeInput(riscritta));
console.log("nodo:", JSON.stringify(nodo).slice(0, 300));
const somma = sommaRadicaleDi(riscritta);
console.log("sommaRadicaleDi:", somma ? [...somma.s.entries()] : null);
