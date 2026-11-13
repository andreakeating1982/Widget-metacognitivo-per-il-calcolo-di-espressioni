// Diagnostica 10/11 (4): perché i box dei builder deterministici non si verificano più.
import { riparaEsercizio } from "../server/costruisci";
import { costruisciRadicaliLetterali } from "../server/guida-radicali";

const c = costruisciRadicaliLetterali("2√(12x^2) + √(75x^2)");
const { esercizio, problemi } = riparaEsercizio(c);
console.log("problemi:", problemi);
if (esercizio) {
  for (const s of esercizio.sezioni) {
    for (const b of s.boxes) console.log("box:", JSON.stringify(b.op), "→", JSON.stringify(b.answerLatex));
  }
  console.log("finale:", esercizio.risultatoFinaleLatex);
} else {
  console.log("candidato grezzo:", JSON.stringify(c, null, 1).slice(0, 2000));
}

