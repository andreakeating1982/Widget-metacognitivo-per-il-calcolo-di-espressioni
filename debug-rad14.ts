/** Il motore ripara il box del periodico sbagliato dall'IA (1/99 → 1/90)? */
import { riparaEsercizio } from "./server/costruisci";

const candidato = {
  espressioneLatex: "1,\\overline{6}\\cdot 0,0\\overline{1}",
  sezioni: [
    {
      title: "PERIODICI IN FRAZIONE",
      boxes: [
        { op: "1,\\overline{6}", answerLatex: "\\dfrac{5}{3}", prompt: "Scrivo la frazione generatrice." },
        { op: "0,0\\overline{1}", answerLatex: "\\dfrac{1}{99}", prompt: "Scrivo la frazione generatrice." },
      ],
    },
    {
      title: "SVOLGIMENTO",
      boxes: [
        { op: "\\dfrac{5}{3}\\cdot \\dfrac{1}{90}", answerLatex: "\\dfrac{1}{54}", prompt: "Moltiplico le frazioni." },
      ],
    },
  ],
  righeProgressive: [
    "1,\\overline{6}\\cdot 0,0\\overline{1}",
    "\\dfrac{5}{3}\\cdot 0,0\\overline{1}",
    "\\dfrac{5}{3}\\cdot \\dfrac{1}{90}",
    "\\dfrac{1}{54}",
  ],
  risultatoFinaleLatex: "\\dfrac{1}{54}",
};
const esito = riparaEsercizio(candidato as never);
const boxes = esito.esercizio?.sezioni?.flatMap((s: { boxes?: { op: string; answerLatex: string }[] }) => s.boxes ?? []) ?? [];
for (const b of boxes) console.log(b.op, "→", b.answerLatex);
console.log("esercizio:", esito.esercizio ? "OK" : "null", "| problemi:", esito.problemi);
