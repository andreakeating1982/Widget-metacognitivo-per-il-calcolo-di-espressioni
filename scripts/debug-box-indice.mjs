// Diagnostica 10/11 (2): perché la verifica dei box con indice negativo fallisce.
import { evaluateNumericExpression } from "../client/src/lib/espressioni";
import { sameSourceStructure } from "../client/src/lib/progressiveExpression";

const casi = [  // [sinistra, destra]
  ["\\sqrt[3]{\\dfrac{a^{-2}b}{x}}", "\\sqrt[3]{a^{-2}b x^{-1}}"],       // box 15 con SPAZIO
  ["\\sqrt[3]{\\dfrac{a^{-2}b}{x}}", "\\sqrt[3]{a^{-2}bx^{-1}}"],        // senza spazio
  ["0,\\overline{3}\\sqrt[-3]{ab^{-1}}", "0,\\overline{3}\\sqrt[-3]{ab^{-1}}"], // box 10 identici
];
for (const [sx, dx] of casi) {
  console.log(JSON.stringify(sx), "vs", JSON.stringify(dx));
  console.log("  sinistra =", evaluateNumericExpression(sx), " destra =", evaluateNumericExpression(dx),
    " stessaStruttura =", sameSourceStructure(sx, dx));
}

