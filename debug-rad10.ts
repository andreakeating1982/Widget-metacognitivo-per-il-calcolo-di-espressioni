/** Test diretto dei due convertitori di forma. */
import { radicaleNegativaAPotenza, radicalePotenzaANegativa } from "./client/src/lib/numericRadicalEquality";

const a = String.raw`\sqrt[-4]{\left(x-2\right)^{4}}`;
console.log("neg→pot :", JSON.stringify(radicaleNegativaAPotenza(a)));
const b = String.raw`x+\left(\sqrt[3]{\left(x-1\right)^{3}}\right)^{-1}`;
console.log("pot→neg :", JSON.stringify(radicalePotenzaANegativa(b)));
