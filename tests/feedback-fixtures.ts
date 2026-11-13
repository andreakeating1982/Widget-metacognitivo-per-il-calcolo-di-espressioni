/** Fixture isolate per il collaudo browser: niente database o modello IA. */
import { writeFileSync } from "node:fs";
import { costruisciFrazioniConiugate } from "../server/prodottiNotevoli";
import { riparaEsercizio } from "../server/costruisci";

const candidato = costruisciFrazioniConiugate("3/(x-2)+2/(x+2)");
const esito = candidato && riparaEsercizio(candidato);
if (!esito?.esercizio) throw new Error(`Percorso non valido: ${esito?.problemi.join("; ")}`);
if (esito.esercizio.sezioni.flatMap(s => s.boxes).length !== 6) throw new Error("Attesi sei passaggi nella fixture");
const numeric = {
  espressioneLatex: "2+3+4+1",
  sezioni: [{ title: "CALCOLO UN PASSAGGIO ALLA VOLTA", boxes: [
    { op: "2+3", answerLatex: "5", prompt: "Sommo i primi due numeri." },
    { op: "5+4", answerLatex: "9", prompt: "Sommo i due numeri." },
    { op: "9+1", answerLatex: "10", prompt: "Sommo i due numeri." },
  ] }],
  righeProgressive: ["2+3+4+1", "5+4+1", "9+1", "10"], risultatoFinaleLatex: "10",
};
const payload = {
  coniugati: esito.esercizio,
  numeric,
  // Risposte sintentiche inserite dal test, non precompilate nell'app.
  risposteConiugati: ["(3*(x+2)+2*(x-2))/((x-2)*(x+2))", "6+3x", "2x-4", "5x", "2", "x^2-4"],
  risposteNumeriche: ["5", "9", "10"],
};
const out = process.argv[2] || "/tmp/widget-feedback-fixtures.json";
writeFileSync(out, JSON.stringify(payload, null, 2));
console.log(`Fixture sintetiche pronte: ${out}`);

