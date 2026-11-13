/** Fixture esclusivamente sintetiche: nessuna richiesta IA e nessun database.
 * Le risposte del finto modello passano dal VERO riparatore server prima
 * dell'uso nel collaudo browser. La traccia algebrica riprende l'immagine
 * fornita dall'utente; i dati personali sono soltanto segnaposto QA. */
import { writeFileSync } from "node:fs";
import { riparaEsercizio, trascrizioneFedele } from "../server/costruisci";
import { costruisciSommaFrazioniLetterali } from "../server/frazioniLetteraliGuidate";
import { normalizeInput, rationalPolyEquals } from "../client/src/lib/espressioni";
import { formaDidatticaValida } from "../client/src/lib/criteriDidattici";

type Box = { op: string; answerLatex: string; prompt?: string; extraLatex?: string };
type Definition = {
  name: string;
  input: string;
  latex: string;
  boxes: Box[];
  final: string;
  wrong: string;
  answers: string[];
};
const definitions: Definition[] = [
  {
    name: "aritmetica-progressiva",
    input: "2+3*4",
    latex: "2+3\\cdot4",
    boxes: [
      { op: "3\\cdot4", answerLatex: "12", prompt: "Moltiplico: il risultato è 12.", extraLatex: "12" },
      { op: "2+12", answerLatex: "14", prompt: "Sommo i termini." },
    ],
    final: "14",
    wrong: "0",
    answers: ["12", "14"],
  },
  {
    name: "frazioni-letterali-foto",
    input: "x/(x+1)+2*x/(4-x)",
    latex: "\\dfrac{x}{x+1}+2\\cdot\\dfrac{x}{4-x}",
    boxes: [{ op: "\\dfrac{x}{x+1}+2\\cdot\\dfrac{x}{4-x}", answerLatex: "\\dfrac{x^2+6x}{-x^2+3x+4}", prompt: "Porto le frazioni allo stesso denominatore." }],
    final: "\\dfrac{x^2+6x}{-x^2+3x+4}",
    wrong: "(x)/(4-x)",
    // Le risposte effettive vengono ricavate dai singoli box del percorso
    // deterministico, come farebbe uno studente, non mostrate nell'app.
    answers: [],
  },
  {
    name: "radicale-esatto",
    input: "rad2(8)",
    latex: "\\sqrt{8}",
    boxes: [{ op: "\\sqrt{8}", answerLatex: "2\\sqrt{2}", prompt: "Semplifico la radice." }],
    final: "2\\sqrt{2}",
    wrong: "2,828427124",
    answers: ["2rad2(2)"],
  },
  {
    name: "frazione-equivalente",
    input: "1/3+1/6",
    latex: "\\dfrac{1}{3}+\\dfrac{1}{6}",
    boxes: [{ op: "\\dfrac{1}{3}+\\dfrac{1}{6}", answerLatex: "\\dfrac{1}{2}", prompt: "Porto le frazioni allo stesso denominatore." }],
    final: "\\dfrac{1}{2}",
    wrong: "2/3",
    answers: ["5/10"],
  },
  {
    name: "numero-negativo",
    input: "-3+1",
    latex: "-3+1",
    boxes: [{ op: "-3+1", answerLatex: "-2", prompt: "Calcolo rispettando i segni." }],
    final: "-2",
    wrong: "2",
    answers: ["-2"],
  },
  {
    name: "quadre-graffe",
    input: "{[2+3]}*4",
    latex: "\\left\\{\\left[2+3\\right]\\right\\}\\cdot4",
    boxes: [
      { op: "2+3", answerLatex: "5", prompt: "Sommo i termini." },
      { op: "5\\cdot4", answerLatex: "20", prompt: "Moltiplico." },
    ],
    final: "20",
    wrong: "6",
    answers: ["5", "20"],
  },
  {
    name: "decimali-con-virgola",
    input: "2,5+1/2",
    latex: "2,5+\\dfrac{1}{2}",
    boxes: [
      { op: "2,5", answerLatex: "\\dfrac{5}{2}", prompt: "Trasformo il decimale in frazione." },
      { op: "\\dfrac{5}{2}+\\dfrac{1}{2}", answerLatex: "3", prompt: "Sommo le frazioni." },
    ],
    final: "3",
    wrong: "2",
    answers: ["5/2", "3"],
  },
];
const fixtures = definitions.map((d) => {
  if (!trascrizioneFedele(d.input, d.latex)) throw new Error(`${d.name}: traccia non fedele`);
  const raw = d.name === "frazioni-letterali-foto"
    ? costruisciSommaFrazioniLetterali(d.input)
    : {
      espressioneLatex: d.latex,
      sezioni: [{ title: "CALCOLO", boxes: d.boxes }],
      // Volutamente sospette: il riparatore deve ricostruirle autonomamente.
      righeProgressive: [d.latex, d.final],
      risultatoFinaleLatex: d.final,
    };
  const repaired = riparaEsercizio(raw);
  if (!repaired.esercizio) throw new Error(`${d.name}: ${repaired.problemi.join("; ")}`);
  const boxEffettivi = repaired.esercizio.sezioni.flatMap(s => s.boxes);
  if (repaired.esercizio.righeProgressive.length !== boxEffettivi.length + 1) {
    throw new Error(`${d.name}: numero righe non coerente`);
  }
  const answers = d.name === "frazioni-letterali-foto"
    ? boxEffettivi.map(b => normalizeInput(b.answerLatex, true).replace(/⁄/g, "/"))
    : d.answers;
  if (d.name === "frazioni-letterali-foto") {
    answers[0] = "[2x]/{4-x}";
    answers[1] = "[x*(4-x)+2*x*(x+1)]/{(x+1)*(4-x)}";
    for (let i = 0; i < answers.length; i++) {
      if (rationalPolyEquals(boxEffettivi[i].answerLatex, answers[i]) !== true ||
          !formaDidatticaValida(boxEffettivi[i].criterioDidattico, answers[i])) {
        throw new Error(`${d.name}: risposta sintetica ${i + 1} non verificabile`);
      }
    }
  }
  if (d.name === "quadre-graffe" && !repaired.esercizio.righeProgressive[1].includes("\\left\\{\\left[")) {
    throw new Error(`${d.name}: una parentesi annidata è stata persa`);
  }
  if (d.name === "frazioni-letterali-foto" && !repaired.esercizio.righeProgressive[1].includes("\\dfrac")) {
    throw new Error(`${d.name}: la frazione letterale risolta non è impilata`);
  }
  return { ...d, answers, esercizio: repaired.esercizio };
});
const output = process.argv[2] || "/tmp/widget-student-flow-fixtures.json";
writeFileSync(output, JSON.stringify(fixtures, null, 2) + "\n");
console.log(`Fixture sintetiche validate dal server: ${fixtures.length}; salvate in ${output}`);

