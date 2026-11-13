/** Box 21-22 e finale con graffa mancante (foto utente, tentativo 7/11-pm) */
import { contoGiusto } from "./server/costruisci";

const casi: [string, string, string][] = [
  [
    "box 21 (giustapposizione dopo dfrac)",
    "\\dfrac{3\\sqrt{10}}{10}\\cdot (x+1)^{2}",
    "\\dfrac{3\\sqrt{10}}{10}(x+1)^{2}",
  ],
  [
    "box 22 (frazione di frazioni)",
    "\\dfrac{\\dfrac{5x-8}{3(x-2)}}{\\dfrac{3\\sqrt{10}}{10}(x+1)^{2}}",
    "\\dfrac{5x-8}{3(x-2)}\\cdot \\dfrac{10}{3\\sqrt{10}(x+1)^{2}}",
  ],
  [
    "finale con graffa mancante",
    "\\dfrac{\\sqrt{10}(5x-8)}{9(x-2)(x-1)(x+1)^{2}}",
    "\\dfrac{\\sqrt{10}(5x-8)}{9(x-2)(x-1)(x+1)^{2",
  ],
  [
    "finale corretto (con |·| versione)",
    "\\dfrac{10\\left(5\\left|x-2\\right|+2x-2\\right)}{9\\sqrt{10}\\left(x-1\\right)\\left|x-2\\right|\\left(x+1\\right)^{2}}",
    "\\dfrac{10(5|x-2|+2x-2)}{9\\sqrt{10}(x-1)|x-2|(x+1)^{2}}",
  ],
];
for (const [nome, a, b] of casi) {
  console.log(nome, "→", JSON.stringify(contoGiusto(a, b)));
}
