/** Giustapposizione con parentesi tonde semplici e graffe sbilanciate */
import { evaluateNumericExpression } from "./client/src/lib/espressioni";

const casi = [
  "9(5-2)(5-1)(6)^{2}",
  "\\dfrac{3\\sqrt{10}}{10}(6)^{2}",
  "3\\sqrt{10}(6)^{2}",
  "\\dfrac{3\\sqrt{10}}{10}\\left(6\\right)^{2}",
];
for (const c of casi) {
  let v: number | null = null;
  try {
    v = evaluateNumericExpression(c);
  } catch {
    v = null;
  }
  console.log(c, "→", v, "(atteso", (28.4604989 * 36) / 10, ")");
}
