import { writeFileSync } from "node:fs";
import { riparaEsercizio, validoPerArchivio } from "../server/costruisci";

// Solo dati sintetici; le API del browser nel collaudo sono intercettate.
const cases = [
  {
    name: "letterale",
    latex: "\\dfrac{ab+1}{\\sqrt{ab+1}}+3",
    wrong: "(ab+1)/(rad2(ab+1))+3",
    answer: "rad2(ab+1)+3",
  },
  {
    name: "box-preesistente",
    latex: "\\dfrac{ab+1}{\\sqrt{ab+1}}+3",
    wrong: "(ab+1)/(rad2(ab+1))+3",
    answer: "rad2(ab+1)+3",
    esistente: true,
  },
  {
    name: "numerico",
    latex: "\\dfrac{1}{\\sqrt{3}}+2",
    wrong: "1/(rad2(3))+2",
    answer: "rad2(3)/3+2",
  },
];
const fixtures = cases.map(c => {
  const answerLatex = c.esistente ? "\\sqrt{ab+1}+3" : c.latex;
  const raw = { espressioneLatex: c.latex, sezioni: [{ title: "CALCOLO", boxes: [{
    op: c.latex, answerLatex, prompt: c.esistente ? "Divido numeratore e denominatore per la stessa radice." : "Lascio la somma così."
  }] }], righeProgressive: [c.latex, answerLatex], risultatoFinaleLatex: answerLatex };
  const result = riparaEsercizio(raw);
  if (!result.esercizio) throw new Error(result.problemi.join(", "));
  const archived = validoPerArchivio(result.esercizio);
  if (!archived || archived.sezioni.flatMap(s => s.boxes).length !== 1 ||
      archived.sezioni[0].boxes[0].criterioDidattico !== "radicale_trasformato") {
    throw new Error(`Rilettura non valida per ${c.name}`);
  }
  return { ...c, esercizio: archived };
});
writeFileSync(process.argv[2] || "/tmp/qa-razionalizzazione-fixtures.json", JSON.stringify(fixtures));
console.log(`Fixture riparate e rilette correttamente: ${fixtures.length}`);

