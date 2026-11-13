import { describe, expect, it } from "vitest";
import { costruisciFrazioniConiugate } from "../../../server/prodottiNotevoli";
import { contoGiusto, riparaEsercizio, trascrizioneFedele } from "../../../server/costruisci";
import { formaDidatticaValida } from "./criteriDidattici";
import { sameExpressionStructure } from "./progressiveExpression";

const fonte = "3/(x-2)+2/(x+2)";

describe("frazioni con denominatori coniugati", () => {
  it("costruisce il caso della foto con un solo conto per box e con prodotto notevole finale", () => {
    const candidato = costruisciFrazioniConiugate(fonte);
    expect(candidato).not.toBeNull();
    const verificato = riparaEsercizio(candidato);
    expect(verificato.problemi).toEqual([]);
    const esercizio = verificato.esercizio!;
    const boxes = esercizio.sezioni.flatMap(s => s.boxes);
    /* (12/11) la sezione CONDIZIONI DI ESISTENZA sta in testa: i conti
       sono gli altri box, le C.E. si verificano coi loro valori vietati. */
    const conti = boxes.filter(b => !b.condizioniEsistenza);
    const ce = boxes.filter(b => b.condizioniEsistenza);
    expect(ce.map(b => [b.op, b.answerLatex])).toEqual([
      ["(x - 2) \\ne 0", "2"], ["(x + 2) \\ne 0", "-2"],
    ]);
    expect(trascrizioneFedele(fonte, esercizio.espressioneLatex)).toBe(true);
    expect(conti).toHaveLength(6);
    expect(esercizio.righeProgressive).toHaveLength(conti.length + 1);
    expect(esercizio.sezioni.at(-1)?.title).toBe("PRODOTTO NOTEVOLE AL DENOMINATORE");
    expect(conti.at(-1)?.criterioDidattico).toBe("prodotto_svolto");
    expect(conti[0].criterioDidattico).toBe("frazione_unica");
    // Le istruzioni restano comprensibili anche dopo il filtro anti-soluzione:
    // «due» potrebbe essere il risultato di un calcolo successivo.
    expect(conti[0].prompt).toBe("Porto le frazioni allo stesso denominatore.");
    const somme = conti.filter(b => b.criterioDidattico === "somma_ridotta");
    expect(somme).toHaveLength(2);
    expect(somme.every(b => b.prompt === "Raggruppo e sommo i termini simili.")).toBe(true);
    expect(conti.every(b => contoGiusto(b.op, b.answerLatex).ok)).toBe(true);
    expect(contoGiusto(esercizio.espressioneLatex, esercizio.risultatoFinaleLatex).ok).toBe(true);
    expect(sameExpressionStructure(esercizio.righeProgressive.at(-1)!, esercizio.risultatoFinaleLatex)).toBe(true);
    // I titoli e le frasi visibili prima dell'input non contengono il risultato.
    expect(esercizio.sezioni.map(s => [s.title, ...s.boxes.map(b => b.prompt)].join(" ")).join(" ")).not.toContain("x^{2}-4");
  });

  it.each([
    "3⁄(x−2)+2⁄(x+2)",
    "2/(x+2)+3/(x-2)",
    "3/(x-2)-2/(x+2)",
    "(2x)/(2x-3)+(3x)/(2x+3)",
    "(2x)/(x+1)-(4x)/(x-1)",
  ])("verifica e mantiene la traccia per %s", (input) => {
    const candidato = costruisciFrazioniConiugate(input);
    expect(candidato).not.toBeNull();
    expect(trascrizioneFedele(input, candidato!.espressioneLatex)).toBe(true);
    const esercizio = riparaEsercizio(candidato).esercizio;
    expect(esercizio).not.toBeNull();
    expect(esercizio!.sezioni[0]!.title).toBe("CONDIZIONI DI ESISTENZA (C.E.)");
    expect(esercizio!.sezioni[0]!.boxes.every(b => b.condizioniEsistenza && /^-?\d+(\/\d+)?$/.test(b.answerLatex))).toBe(true);
    expect(esercizio!.sezioni.flatMap(s => s.boxes).filter(b => !b.condizioniEsistenza).every(b => contoGiusto(b.op, b.answerLatex).ok)).toBe(true);
    expect(esercizio!.sezioni.at(-1)?.title).toBe("PRODOTTO NOTEVOLE AL DENOMINATORE");
  });

  it.each([
    "1/(x-2)+1/(x+3)",
    "(3/(x-2)+2/(x+2))*5",
    "(x+2)/(x-2)+(x-3)/(x+2)",
    "1/(x-x)+1/(x+x)",
    "3:(x-2)+2:(x+2)",
  ])("non forza il percorso su una forma non supportata: %s", (input) => {
    expect(costruisciFrazioniConiugate(input)).toBeNull();
  });
});

describe("forme richieste senza anticipare il calcolo", () => {
  it("richiede una frazione unica ma accetta frazioni equivalenti", () => {
    expect(formaDidatticaValida("frazione_unica", "(5x+2)/(x^2-4)")).toBe(true);
    expect(formaDidatticaValida("frazione_unica", "(2+5x)/((x-2)*(x+2))")).toBe(true);
    expect(formaDidatticaValida("frazione_unica", "3/(x-2)+2/(x+2)")).toBe(false);
  });
  it("non scambia un prodotto ripetuto per un prodotto svolto", () => {
    expect(formaDidatticaValida("prodotto_svolto", "(x-2)*(x+2)")).toBe(false);
    expect(formaDidatticaValida("prodotto_svolto", "(x+2)*(x-2)")).toBe(false);
    expect(formaDidatticaValida("prodotto_svolto", "-4+x^2")).toBe(true);
    expect(formaDidatticaValida("prodotto_svolto", "3x+6")).toBe(true);
    expect(formaDidatticaValida("prodotto_svolto", "3*(x+2)")).toBe(false);
  });
  it("chiede di raggruppare i termini, ma accetta l'ordine equivalente", () => {
    expect(formaDidatticaValida("somma_ridotta", "3x+2x")).toBe(false);
    expect(formaDidatticaValida("somma_ridotta", "2x+3x")).toBe(false);
    expect(formaDidatticaValida("somma_ridotta", "5x")).toBe(true);
    expect(formaDidatticaValida("somma_ridotta", "6-4")).toBe(false);
    expect(formaDidatticaValida("somma_ridotta", "2")).toBe(true);
  });
});

