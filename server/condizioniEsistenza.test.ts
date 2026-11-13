import { describe, expect, it } from "vitest";
import {
  riparaEsercizio,
  sezioneCondizioniEsistenza,
  valoriVietatiPolinomio,
  validoPerArchivio,
} from "./costruisci";
import { costruisciSommaFrazioniLetterali } from "./frazioniLetteraliGuidate";
import { parsePolyLoose } from "../client/src/lib/espressioni";

const sezioneCe = (esercizio: ReturnType<typeof riparaEsercizio>["esercizio"]) =>
  esercizio?.sezioni.find((s) => s.boxes.some((b) => b.condizioniEsistenza));

describe("valori vietati esatti di un denominatore", () => {
  it("grado 1: 2x+3 → -3/2", () => {
    expect(valoriVietatiPolinomio(parsePolyLoose("2x+3")!)).toEqual([
      { lettera: "x", valore: "-3/2" },
    ]);
  });
  it("grado 2 con discriminante quadrato perfetto: x^2-1 → -1 e 1", () => {
    expect(valoriVietatiPolinomio(parsePolyLoose("x^{2}-1")!)).toEqual([
      { lettera: "x", valore: "-1" },
      { lettera: "x", valore: "1" },
    ]);
  });
  it("fattore x^k: x^3-x → -1, 0, 1 (ordine crescente)", () => {
    expect(valoriVietatiPolinomio(parsePolyLoose("x^{3}-x")!)).toEqual([
      { lettera: "x", valore: "-1" },
      { lettera: "x", valore: "0" },
      { lettera: "x", valore: "1" },
    ]);
  });
  it("radici irrazionali: x^2-2 → null (niente C.E. incompleta)", () => {
    expect(valoriVietatiPolinomio(parsePolyLoose("x^{2}-2")!)).toBeNull();
  });
  it("sempre positiva: x^2+1 → null", () => {
    expect(valoriVietatiPolinomio(parsePolyLoose("x^{2}+1")!)).toBeNull();
  });
  it("non polinomio (esponente negativo): 1/x+1 → null", () => {
    expect(valoriVietatiPolinomio(parsePolyLoose("1/x+1")!)).toBeNull();
  });
  it("denominatore numerico: nessuna C.E.", () => {
    expect(valoriVietatiPolinomio(parsePolyLoose("3")!)).toBeNull();
  });
  it("monomio a due lettere: xy → 0 per ogni lettera", () => {
    expect(valoriVietatiPolinomio(parsePolyLoose("xy")!)).toEqual([
      { lettera: "x", valore: "0" },
      { lettera: "y", valore: "0" },
    ]);
  });
});

describe("sezione CONDIZIONI DI ESISTENZA dell'espressione", () => {
  it("somma di fratte: un box per denominatore distinto", () => {
    const s = sezioneCondizioniEsistenza(
      "\\dfrac{1}{\\left(x + 1\\right)} + \\dfrac{1}{\\left(x + 2\\right)} + \\dfrac{1}{\\left(x + 3\\right)}",
    );
    expect(s?.title).toBe("CONDIZIONI DI ESISTENZA (C.E.)");
    expect(s?.boxes.map((b) => [b.op, b.answerLatex])).toEqual([
      ["(x + 1) \\ne 0", "-1"],
      ["(x + 2) \\ne 0", "-2"],
      ["(x + 3) \\ne 0", "-3"],
    ]);
    expect(s?.boxes.every((b) => b.simbolico)).toBe(true);
    expect(s?.boxes.map((b) => b.soluzioneCe)).toEqual([
      "x \\ne -1",
      "x \\ne -2",
      "x \\ne -3",
    ]);
  });
  it("denominatore prodotto: (x+1)(x+2) → -2 e -1 (ordine crescente)", () => {
    const s = sezioneCondizioniEsistenza(
      "\\dfrac{1}{\\left(x + 1\\right) \\cdot \\left(x + 2\\right)}",
    );
    expect(s?.boxes.map((b) => b.answerLatex)).toEqual(["-2", "-1"]);
  });
  it("esponente negativo: (x+1)^{-1}+2 → C.E. x ≠ -1", () => {
    const s = sezioneCondizioniEsistenza("\\left(x + 1\\right)^{-1} + 2");
    expect(s?.boxes.map((b) => b.answerLatex)).toEqual(["-1"]);
  });
  it("espressione senza fratte: nessuna sezione", () => {
    expect(sezioneCondizioniEsistenza("2+3 \\cdot 4")).toBeNull();
    expect(sezioneCondizioniEsistenza("x + 2")).toBeNull();
  });
});

describe("riparaEsercizio prepende la C.E. e sopravvive all'archivio", () => {
  const base = () => {
    const candidato = costruisciSommaFrazioniLetterali("1/(x+1)+1/(x+2)+1/(x+3)")!;
    return riparaEsercizio(JSON.parse(JSON.stringify(candidato)));
  };

  it("la prima sezione è la C.E. con i valori vietati", () => {
    const { esercizio, problemi, avvertenze } = base();
    expect(problemi).toEqual([]);
    expect(avvertenze.some((a) => a.includes("CONDIZIONI DI ESISTENZA"))).toBe(true);
    expect(esercizio?.sezioni[0]!.title).toBe("CONDIZIONI DI ESISTENZA (C.E.)");
    expect(esercizio?.sezioni[0]!.boxes.map((b) => b.answerLatex)).toEqual(["-1", "-2", "-3"]);
    // le sezioni dei conti seguono, invariate
    expect(esercizio?.sezioni[1]!.title).toBe("DENOMINATORE COMUNE");
  });

  it("rilettura dall'archivio: C.E. idempotente e intacta", () => {
    const prima = base().esercizio!;
    const seconda = riparaEsercizio(JSON.parse(JSON.stringify(prima)));
    expect(seconda.problemi).toEqual([]);
    const ceIniziali = seconda.esercizio!.sezioni[0]!.boxes.filter((b) => b.condizioniEsistenza);
    expect(seconda.esercizio!.sezioni[0]!.title).toBe("CONDIZIONI DI ESISTENZA (C.E.)");
    expect(ceIniziali).toHaveLength(3);
    const quanteSezioniCe = seconda.esercizio!.sezioni.filter((s) =>
      s.boxes.some((b) => b.condizioniEsistenza),
    );
    expect(quanteSezioniCe).toHaveLength(1);
  });

  it("validoPerArchivio conserva la C.E. e il risultato finale", () => {
    const prima = base().esercizio!;
    const riletto = validoPerArchivio(JSON.parse(JSON.stringify(prima)));
    expect(riletto).not.toBeNull();
    expect(riletto!.sezioni[0]!.boxes.some((b) => b.condizioniEsistenza)).toBe(true);
    expect(riletto!.risultatoFinaleLatex).toBe(prima.risultatoFinaleLatex);
  });

  it("espressione senza lettere al denominatore: nessuna sezione C.E.", () => {
    const { esercizio } = riparaEsercizio({
      espressioneLatex: "2+3 \\cdot 4",
      sezioni: [{ title: "CALCOLI", boxes: [
        { op: "3 \\cdot 4", answerLatex: "12" },
        { op: "2+12", answerLatex: "14" },
      ] }],
      righeProgressive: ["2+3 \\cdot 4", "2+12", "14"],
      risultatoFinaleLatex: "14",
    });
    expect(esercizio).not.toBeNull();
    expect(esercizio!.sezioni.some((s) => s.boxes.some((b) => b.condizioniEsistenza))).toBe(false);
  });
});
