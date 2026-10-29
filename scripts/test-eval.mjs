import { evaluateLatex } from "../client/src/components/NumberInputCanvas.tsx";
for (const s of ["9", "3^2", "3^{2}", "(1/3)^-2", "\\frac{1}{3}^{-2}", "\\left(\\frac{1}{3}\\right)^{-2}", "2^3", "2^{3}", "(1+2)^2", "-2^2"]) {
  console.log(JSON.stringify(s), "→", evaluateLatex(s));
}
