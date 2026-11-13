// Diagnostica 10/11 (3): verificaPerSostituzione sul box 15 e sul box 10.
import { verificaPerSostituzione } from "../server/costruisci";

console.log("box15 CON spazio   :", JSON.stringify(verificaPerSostituzione("\\sqrt[3]{\\dfrac{a^{-2}b}{x}}", "\\sqrt[3]{a^{-2}b x^{-1}}")));
console.log("box15 SENZA spazio :", JSON.stringify(verificaPerSostituzione("\\sqrt[3]{\\dfrac{a^{-2}b}{x}}", "\\sqrt[3]{a^{-2}bx^{-1}}")));
console.log("box10 identico     :", JSON.stringify(verificaPerSostituzione("0,\\overline{3}\\sqrt[-3]{ab^{-1}}", "0,\\overline{3}\\sqrt[-3]{ab^{-1}}")));
console.log("box13 differenza   :", JSON.stringify(verificaPerSostituzione("0,\\overline{3}\\sqrt[-3]{ab^{-1}}-0,\\overline{3}\\sqrt[-3]{ab^{-1}}", "0")));

