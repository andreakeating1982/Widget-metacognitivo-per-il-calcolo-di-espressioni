/** Debug: perché il box 15 con |·| non si verifica? */
import { verificaPerSostituzione } from "./server/costruisci";

const op = "\\dfrac{1}{x-1}\\cdot \\dfrac{5}{3} + \\dfrac{1}{\\left|x-2\\right|} \\cdot \\dfrac{2}{3}";
const answer = "\\dfrac{5}{3\\left(x-1\\right)} + \\dfrac{2}{3\\left|x-2\\right|}";
console.log("verificaPerSostituzione:", JSON.stringify(verificaPerSostituzione(op, answer)));

// varianti progressive per isolare la parte che rompe
const varianti: [string, string][] = [
  ["solo primo termine", "\\dfrac{1}{x-1}\\cdot \\dfrac{5}{3}", "\\dfrac{5}{3\\left(x-1\\right)}"],
  ["solo secondo termine", "\\dfrac{1}{\\left|x-2\\right|} \\cdot \\dfrac{2}{3}", "\\dfrac{2}{3\\left|x-2\\right|}"],
  ["somma senza spazi", "\\dfrac{1}{x-1}\\cdot\\dfrac{5}{3}+\\dfrac{1}{\\left|x-2\\right|}\\cdot\\dfrac{2}{3}", "\\dfrac{5}{3\\left(x-1\\right)}+\\dfrac{2}{3\\left|x-2\\right|}"],
];
for (const [n, a, b] of varianti) {
  console.log(n, "→", JSON.stringify(verificaPerSostituzione(a, b)));
}
