/** Debug: giustapposizione numero·\left(...) in evaluateNumericExpression */
import { evaluateNumericExpression } from "./client/src/lib/espressioni";

const casi = [
  ["3\\left(5\\right)", "15"],
  ["3\\left|5\\right|", "15"],
  ["x\\left(5\\right)", "?"],
  ["\\dfrac{2}{3\\left(5\\right)}", "0.1333"],
  ["\\dfrac{2}{3}\\left(5\\right)", "3.333"],
  ["2\\left(3\\right)\\left(4\\right)", "24"],
  ["\\left(2\\right)\\left(3\\right)", "6"],
  ["3\\left(5\\right)^{2}", "75"],
];
for (const [c, atteso] of casi) {
  let v: number | null = null;
  try {
    v = evaluateNumericExpression(c.replace(/x/g, "5"));
  } catch {
    v = null;
  }
  console.log(c, "→", v, "(atteso", atteso + ")");
}
