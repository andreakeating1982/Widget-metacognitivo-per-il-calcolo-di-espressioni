/** Perché il box identitario su √2 passa? (con sonda nel ciclo) */
import { riparaEsercizio } from "./server/costruisci";

const candidato = {
  espressioneLatex: "\\sqrt{2}",
  sezioni: [{ title: "RADICALE", boxes: [{ op: "\\sqrt{2}", answerLatex: "\\sqrt{2}", prompt: "Già in forma minima." }] }],
  righeProgressive: ["\\sqrt{2}"],
  risultatoFinaleLatex: "\\sqrt{2}",
};
const esito = riparaEsercizio(candidato);
console.log("esercizio:", esito.esercizio ? "OK" : "null");
console.log("problemi:", esito.problemi);
console.log("avvertenze:", esito.avvertenze);
