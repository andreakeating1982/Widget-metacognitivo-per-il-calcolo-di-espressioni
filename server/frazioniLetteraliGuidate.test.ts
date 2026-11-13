import { describe, expect, it } from "vitest";
import { costruisciSommaFrazioniLetterali } from "./frazioniLetteraliGuidate";
import { contoGiusto, riparaEsercizio, trascrizioneFedele } from "./costruisci";
import { sameResultStructure } from "../client/src/lib/progressiveExpression";
import { formaDidatticaValida } from "../client/src/lib/criteriDidattici";

const fotografata = "x/(x+1)+2*x/(4-x)";

describe("somma guidata di due frazioni letterali", () => {
  it("costruisce la forma della foto in passi distinti e verificati", () => {
    const candidato = costruisciSommaFrazioniLetterali(fotografata);
    expect(candidato).not.toBeNull();
    const result = riparaEsercizio(candidato);
    expect(result.problemi).toEqual([]);
    const esercizio = result.esercizio!;
    const boxes = esercizio.sezioni.flatMap(s => s.boxes);
    /* (12/11) i box CONDIZIONI DI ESISTENZA non sono conti: si verificano
       a parte (valore vietato giusto), contoGiusto non si applica. */
    const conti = boxes.filter(b => !b.condizioniEsistenza);
    expect(boxes.filter(b => b.condizioniEsistenza).map(b => [b.op, b.answerLatex])).toEqual([
      ["(x + 1) \\ne 0", "-1"], ["(4 - x) \\ne 0", "4"],
    ]);
    expect(trascrizioneFedele(fotografata, esercizio.espressioneLatex)).toBe(true);
    expect(esercizio.espressioneLatex).toContain("\\cdot");
    expect(conti).toHaveLength(7);
    expect(esercizio.righeProgressive).toHaveLength(conti.length + 1);
    expect(esercizio.sezioni.map(s => s.title)).toEqual([
      "CONDIZIONI DI ESISTENZA (C.E.)", "FATTORE ESTERNO", "DENOMINATORE COMUNE", "SVOLGO IL NUMERATORE", "SVOLGO IL DENOMINATORE",
    ]);
    expect(conti[0].criterioDidattico).toBe("frazione_unica");
    expect(conti[1].criterioDidattico).toBe("frazione_unica");
    expect(conti.every(b => contoGiusto(b.op, b.answerLatex).ok)).toBe(true);
    expect(contoGiusto(esercizio.espressioneLatex, esercizio.risultatoFinaleLatex).ok).toBe(true);
    expect(sameResultStructure(esercizio.righeProgressive.at(-1)!, esercizio.risultatoFinaleLatex)).toBe(true);
    const indicazioni = esercizio.sezioni.map(s => [s.title, ...s.boxes.map(b => b.prompt ?? "")].join(" ")).join(" ");
    for (const b of conti) expect(indicazioni).not.toContain(b.answerLatex);
  });

  it.each([
    "x⁄(x+1)+2·x⁄(4-x)",
    String.raw`\dfrac{x}{x+1}+2\cdot\dfrac{x}{4-x}`,
    "1/(x+1)+1/(x+3)",
    "2*x/(x+1)+3*y/(x+3)",
    "1/(x+1)-2/(x+3)",
    "2*x/(x+1)-3/(4-x)",
    "1/(x+1)+2/(x+1)",
    "{[x/(x+1)+2*x/(4-x)]}",
  ])("conserva la traccia e verifica i calcoli di %s", (input) => {
    const candidato = costruisciSommaFrazioniLetterali(input);
    expect(candidato).not.toBeNull();
    expect(trascrizioneFedele(input, candidato!.espressioneLatex)).toBe(true);
    const checked = riparaEsercizio(candidato);
    expect(checked.problemi).toEqual([]);
    const ex = checked.esercizio!;
    expect(ex.sezioni.flatMap(s => s.boxes).filter(b => !b.condizioniEsistenza).every(b => contoGiusto(b.op, b.answerLatex).ok)).toBe(true);
    /* (12/11) i valori vietati della C.E. sono giusti per costruzione:
       controllo che ogni denominatore originale abbia il SUO box. */
    expect(ex.sezioni[0]!.title).toBe("CONDIZIONI DI ESISTENZA (C.E.)");
    expect(ex.sezioni[0]!.boxes.every(b => b.condizioniEsistenza && /^-?\d+(\/\d+)?$/.test(b.answerLatex))).toBe(true);
    expect(contoGiusto(ex.espressioneLatex, ex.risultatoFinaleLatex).ok).toBe(true);
    expect(sameResultStructure(ex.righeProgressive.at(-1)!, ex.risultatoFinaleLatex)).toBe(true);
  });

  it("mantiene il prodotto notevole per i coniugati dopo il fattore esterno", () => {
    const candidato = costruisciSommaFrazioniLetterali("2*x/(x-2)+3/(x+2)");
    const checked = riparaEsercizio(candidato);
    expect(checked.esercizio).not.toBeNull();
    expect(checked.esercizio!.sezioni.at(-1)?.title).toBe("PRODOTTO NOTEVOLE AL DENOMINATORE");
    expect(checked.esercizio!.sezioni.at(-1)?.boxes[0].criterioDidattico).toBe("prodotto_svolto");
  });

  it.each([
    "1/(x-x)+1/(x+3)", // denominatore nullo
    "x/(x+1)+1/(x+1)", // cancellazione: non saltare la semplificazione
    "1:(x+1)+1:(x+2)", // non reinterpretare i due punti come frazioni impilate
    "1/(x+1)+1/0",
    "1/((a+b)*(c+d)*(e+f)*(g+h)*(i+j))+1/(x+1)", // espansione troppo grande
  ])("non forza un percorso che richiederebbe assunzioni: %s", (input) => {
    expect(costruisciSommaFrazioniLetterali(input)).toBeNull();
  });

  /* (12/11) FRATTE GENERICHE: N addendi, numeratori polinomiali, addendi
   * interi, prodotto e quoziente di due frazioni. */
  it.each([
    "1/(x+1)+1/(x+2)+1/(x+3)", // tre addendi
    "1/(x+1)+1/(x+2)+1/(x+3)+1/(x+5)", // quattro addendi
    "(x^2+1)/(x+1)+(x-1)/(x+2)", // numeratori polinomiali
    "2+1/(x+1)", // addendo intero (denominatore 1)
    "2*x/(x+1)-3/(4-x)+1/(x+5)", // mix di segni e tre addendi
    "(x+1)/(x+2)*(x+3)/(x+4)", // prodotto di due frazioni
    "x/(x+1):(x+2)/(x+3)", // quoziente di due frazioni
  ])("costruisce le fratte generiche senza IA: %s", (input) => {
    const candidato = costruisciSommaFrazioniLetterali(input);
    expect(candidato).not.toBeNull();
    expect(trascrizioneFedele(input, candidato!.espressioneLatex)).toBe(true);
    const checked = riparaEsercizio(candidato);
    expect(checked.problemi).toEqual([]);
    const ex = checked.esercizio!;
    expect(ex.sezioni.flatMap(s => s.boxes).filter(b => !b.condizioniEsistenza).every(b => contoGiusto(b.op, b.answerLatex).ok)).toBe(true);
    expect(ex.sezioni[0]!.title).toBe("CONDIZIONI DI ESISTENZA (C.E.)");
    expect(ex.sezioni[0]!.boxes.every(b => b.condizioniEsistenza && /^-?\d+(\/\d+)?$/.test(b.answerLatex))).toBe(true);
    expect(contoGiusto(ex.espressioneLatex, ex.risultatoFinaleLatex).ok).toBe(true);
    expect(sameResultStructure(ex.righeProgressive.at(-1)!, ex.risultatoFinaleLatex)).toBe(true);
    const conti = ex.sezioni.flatMap(s => s.boxes).filter(b => !b.condizioniEsistenza);
    const indicazioni = ex.sezioni.map(s => [s.title, ...s.boxes.map(b => b.prompt ?? "")].join(" ")).join(" ");
    for (const b of conti) expect(indicazioni).not.toContain(b.answerLatex);
  });

  it("non accetta come frazione unica la ripetizione del prodotto esterno", () => {
    expect(formaDidatticaValida("frazione_unica", "2*x/(4-x)")).toBe(false);
    expect(formaDidatticaValida("frazione_unica", "(2x)/(4-x)")).toBe(true);
    expect(formaDidatticaValida("frazione_unica", "[2x]/{4-x}")).toBe(true);
  });
});

