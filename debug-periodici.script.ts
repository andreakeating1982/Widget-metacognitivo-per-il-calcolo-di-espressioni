/** Debug del blocco: pezzi piccoli della verifica con periodici e indici negativi. */
import { contoGiusto, valoriVietatiPolinomio } from "./server/costruisci";
import { parsePolyLoose } from "./client/src/lib/espressioni";

const t0 = Date.now();
const t = (label: string) => console.log(label, "→", ((Date.now() - t0) / 1000).toFixed(1) + "s");

console.log("A periodico semplice:", JSON.stringify(contoGiusto("1,\\overline{6}", "\\dfrac{5}{3}")));
t("A");

console.log("B periodico misto:", JSON.stringify(contoGiusto("0,0\\overline{1}", "\\dfrac{1}{90}")));
t("B");

console.log("C radice indice −2 di decimale:", JSON.stringify(contoGiusto("\\sqrt[-2]{0,0\\overline{1}}", "3\\sqrt{10}")));
t("C");

console.log("D quarta radice di quartico:", JSON.stringify(contoGiusto("\\sqrt[4]{x^{4}-8x^{3}+24x^{2}-32x+16}", "x-2")));
t("D");

console.log("E quarta radice con esponente −1:", JSON.stringify(contoGiusto("\\left(\\sqrt[4]{x^{4}-8x^{3}+24x^{2}-32x+16}\\right)^{-1}", "\\dfrac{1}{x-2}")));
t("E");

console.log("F cubica indice −3:", JSON.stringify(contoGiusto("\\sqrt[-3]{x^{3}-3x^{2}+3x-1}", "\\dfrac{1}{x-1}")));
t("F");

console.log("G C.E. quartico:", JSON.stringify(valoriVietatiPolinomio(parsePolyLoose("x^{4}-8x^{3}+24x^{2}-32x+16"))));
t("G");
