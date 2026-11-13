import { describe, it, expect } from "vitest";
import { errorHint, parsePolyLoose, fr } from "./espressioni";

/** (25/10, punto 5) FEEDBACK DIAGNOSTICO ALL'ERRORE: aiuto per TIPO di
 *  sbaglio, MAI il risultato; dal 2º tentativo arriva anche il promemoria
 *  della proprietà (aiuto graduale). */
describe("punto 5 — feedback intelligente all'errore", () => {
  const atteso = [{ c: fr(8), vars: [{ v: "x", e: 3 }] }];

  it("segno sbagliato → parla del SEGNO, mai del risultato", () => {
    const h = errorHint(atteso, parsePolyLoose("-8x^3"), "pow-prod-final", 1);
    expect(h).toContain("SEGNO");
    expect(h).not.toContain("8x");
  });

  it("coefficiente sbagliato (lettere giuste) → parla dei NUMERI", () => {
    const h = errorHint(atteso, parsePolyLoose("6x^3"), "pow-prod-final", 1);
    expect(h).toContain("NUMERI");
    expect(h).not.toContain("8");
  });

  it("esponente sbagliato (coefficiente giusto) → parla degli ESPONENTI", () => {
    const h = errorHint(atteso, parsePolyLoose("8x^2"), "pow-prod-final", 1);
    expect(h).toContain("ESPONENTI");
    expect(h).not.toContain("x^3");
  });

  it("reciproco capovolto → parla del reciproco (frazione)", () => {
    const h = errorHint([{ c: fr(1), vars: [{ v: "x", e: -2 }] }], parsePolyLoose("x^2"), "pow-prop-final", 1);
    expect(h).toContain("reciproco");
  });

  it("valore numerico sbagliato → parla del VALORE", () => {
    const h = errorHint([{ c: fr(8), vars: [] }], parsePolyLoose("64"), "rad-pow-final", 1);
    expect(h).toContain("VALORE");
  });

  it("risposta corretta → nessun aiuto", () => {
    expect(errorHint(atteso, parsePolyLoose("8x^3"), "pow-prod-final", 1)).toBe("");
    expect(errorHint(atteso, parsePolyLoose("2^3x^3"), "pow-prod-final", 1)).toBe("");
  });

  it("aiuto GRADUALE: dal 2º tentativo arriva anche il promemoria della proprietà", () => {
    const h1 = errorHint(atteso, parsePolyLoose("8x^2"), "pow-prod-final", 1);
    const h2 = errorHint(atteso, parsePolyLoose("8x^2"), "pow-prod-final", 2);
    expect(h1).not.toContain("fattore");
    expect(h2).toContain("OGNI fattore");
    // la proprietà non svela il risultato
    expect(h2).not.toContain("8x^3");
  });

  it("promemoria corretto per ogni tipo di passo", () => {
    expect(errorHint(atteso, parsePolyLoose("8x^2"), "mul-terms", 2)).toContain("SOMMANO");
    expect(errorHint(atteso, parsePolyLoose("8x^2"), "div-mono", 2)).toContain("SOTTRAGGONO");
    expect(errorHint(atteso, parsePolyLoose("8x^2"), "rad-pow-final", 2)).toContain("indice");
    expect(errorHint(atteso, parsePolyLoose("8x^2"), "sqrt", 2)).toContain("per 2");
  });

  it("input non interpretabile → nessun aiuto specifico (messaggio generico della UI)", () => {
    expect(errorHint(atteso, parsePolyLoose("abc!!"), "pow-prod-final", 1)).toBe("");
  });
});
