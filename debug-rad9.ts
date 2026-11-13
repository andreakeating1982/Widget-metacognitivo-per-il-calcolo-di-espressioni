/** Box 25: giustapposizione dopo \dfrac è verificabile? */
import { contoGiusto } from "./server/costruisci";

const casi: [string, string][] = [
  ["\\dfrac{3\\sqrt{10}}{10}\\left(x+1\\right)^{2}", "\\dfrac{3\\sqrt{10}\\left(x+1\\right)^{2}}{10}"],
  ["\\dfrac{3\\sqrt{10}}{10}\\cdot \\left(x+1\\right)^{2}", "\\dfrac{3\\sqrt{10}\\left(x+1\\right)^{2}}{10}"],
  ["\\dfrac{1}{2}x^{2}", "\\dfrac{x^{2}}{2}"],
  ["\\dfrac{1}{2}\\left(x+1\\right)", "\\dfrac{\\left(x+1\\right)}{2}"],
];
for (const [a, b] of casi) {
  console.log(JSON.stringify(a), "→", JSON.stringify(contoGiusto(a, b)));
}
