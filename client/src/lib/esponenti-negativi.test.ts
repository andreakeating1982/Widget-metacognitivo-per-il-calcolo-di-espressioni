import { describe, it, expect } from "vitest";
import { analyzeExpression } from "./espressioni";
import { normalizeKeyboardNotation } from "./keyboardNotation";

/** Foto utente 24/10: l'app non riconosceva in nessun modo gli esponenti
 *  negativi (x^-2, 2^(-2) → errore) e la frazione tastiera (1/2)^2 col
 *  denominatore tra parentesi restava con la barra. Regole:
 *  a^(-k) = 1 : (a^k), svolta passo passo dallo studente (MAI anticipata);
 *  con lettere (x^-2) errore chiaro «col libro»; frazioni semplici da
 *  tastiera SEMPRE impilate. */
describe("esponenti negativi (foto utente 24/10)", () => {
  it("il parser accetta ^-n e ^(-n)", () => {
    expect(analyzeExpression("2^-2").originalLatex).toContain("2^{-2}");
    expect(analyzeExpression("2^(-2)").originalLatex).toContain("2^{-2}");
    expect(analyzeExpression("(1⁄2)^-2").originalLatex).toContain("^{-2}");
  });

  it("il meno binario dopo la potenza NON diventa esponente (x^2-3)", () => {
    expect(analyzeExpression("x^2-3").originalLatex).toBe("x^{2} - 3");
  });

  it("(25/10) 2^-2: trascrizione → CAPOVOLGIMENTO AUTOMATICO segnalato → potenza positiva allo studente → 1/4", () => {
    const a = analyzeExpression("2^-2");
    // passo 1: trascrizione in forma originaria (esponente negativo visibile)
    expect(a.steps[0]!.latex).toContain("2^{-2}");
    // passo 2: capovolgimento AUTOMATICO con segnalazione, SENZA input
    const flip = a.steps.find((s) => s.detail.includes("capovolgo il numero"));
    expect(flip).toBeTruthy();
    expect(flip!.latex).toContain("\\dfrac{1}{2^{2}}");
    expect(flip!.opLatex).toBeUndefined();
    expect(flip!.answer).toBeUndefined();
    // passo 3: SOLO la potenza positiva è input dello studente
    const pow = a.steps.find((s) => s.opLatex === "2^{2}");
    expect(pow).toBeTruthy();
    expect(pow!.answer).toEqual({ n: 4, d: 1 });
    // niente divisione 1:4 da svolgere: la frazione impilata è notazione
    expect(a.steps.some((s) => s.kind === "div-num")).toBe(false);
    expect(a.finalLatex).toBe("\\dfrac{1}{4}");
  });

  it("(25/10) 3 · 2^-2: capovolgimento in mezzo al prodotto, conti allo studente", () => {
    const a = analyzeExpression("3 · 2^-2");
    const flip = a.steps.find((s) => s.detail.includes("capovolgo il numero"));
    expect(flip).toBeTruthy();
    const mul = a.steps.find((s) => s.kind === "mul-terms");
    expect(mul).toBeTruthy();
    expect(mul!.answer).toEqual({ n: 3, d: 4 });
    expect(a.finalLatex).toBe("\\dfrac{3}{4}");
  });

  it("(25/10) 5 : 2^-2: capovolgo il divisore e moltiplico (conto allo studente)", () => {
    const a = analyzeExpression("5 : 2^-2");
    const segnale = a.steps.find((s) => s.detail.includes("capovolgo e moltiplico"));
    expect(segnale).toBeTruthy();
    expect(a.finalLatex).toBe("20");
  });

  it("svolgimento frazione: (1⁄2)^-2 → capovolgimento → (1⁄2)^2 allo studente → 4", () => {
    const a = analyzeExpression("(1⁄2)^-2");
    const flip = a.steps.find((s) => s.detail.includes("capovolgo il numero"));
    expect(flip).toBeTruthy();
    expect(a.finalLatex).toBe("4");
  });

  it("con lettere: capovolgimento segnalato → 1/x² (punto 1, 25/10)", () => {
    // (25/10) x^-2 NON è più un errore: flip segnalato e frazione impilata
    const a = analyzeExpression("x^-2");
    expect(a.steps.some((s) => s.kind === "pow-flip")).toBe(true);
    expect(a.finalLatex).toBe("\\dfrac{1}{x^{2}}");
    // (x+1)^-2 con PIÙ TERMINI resta non supportato (errore chiaro)
    expect(() => analyzeExpression("(x+1)^-2")).toThrow();
  });

  it("limiti: ^-0 rifiutato, oltre 99 rifiutato", () => {
    expect(() => analyzeExpression("x^-0")).toThrow();
    expect(() => analyzeExpression("x^-100")).toThrow();
  });
});

describe("frazione tastiera col denominatore tra parentesi (foto 24/10)", () => {
  it("(1/2)^2 → (1⁄2)^2 impilata (era: barra non riconosciuta)", () => {
    expect(normalizeKeyboardNotation("(1/2)^2")).toBe("(1⁄2)^2");
    expect(analyzeExpression(normalizeKeyboardNotation("(1/2)^2")).originalLatex)
      .toBe("\\left(\\dfrac{1}{2}\\right)^{2}");
  });

  it("(1)/(2) → (1⁄2) dentro le stesse parentesi", () => {
    expect(normalizeKeyboardNotation("(1)/(2)")).toBe("(1⁄2)");
  });

  it("i rapporti complessi restano divisione con la barra", () => {
    expect(normalizeKeyboardNotation("(x+1)/(2x-3)")).toBe("(x+1)/(2x-3)");
  });
});
