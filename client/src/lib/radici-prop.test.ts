import { describe, it, expect } from "vitest";
import { analyzeExpression, auditProgressivita, parsePolyLoose } from "./espressioni";

/** (25/10, punto 4) RADICE DI RADICE e RADICE DI POTENZA: le due proprietà
 *  mancanti. Stessa filosofia: riscrittura SEGNALATA con l'espressione
 *  intera, poi UN SOLO calcolo per lo studente. */
describe("punto 4 — radice di radice e radice di potenza", () => {
  it("√√16 → «moltiplico gli indici 2 · 2» → ∜16 allo studente → 2", () => {
    const a = analyzeExpression("√√16");
    const rr = a.steps.find((s) => s.kind === "rad-rad");
    expect(rr).toBeTruthy();
    expect(rr!.latex).toBe("\\sqrt[4]{16}");
    expect(rr!.detail).toContain("moltiplico gli indici");
    expect(a.steps.some((s) => s.kind === "root")).toBe(true);
    expect(a.finalLatex).toBe("2");
  });

  it("∛√64 → indici 3 · 2 = 6 → ⁶√64 = 2 (indici MISTI)", () => {
    const a = analyzeExpression("∛√64");
    const rr = a.steps.find((s) => s.kind === "rad-rad");
    expect(rr!.detail).toContain("3");
    expect(rr!.detail).toContain("2");
    expect(a.finalLatex).toBe("2");
  });

  it("∛∛27 → NON è una radice esatta (27^(1/9)): errore chiaro", () => {
    expect(() => analyzeExpression("∛∛27")).toThrow(/non è esatta/);
  });

  it("√(x⁶) richiede |x³| se non è nota la positività di x", () => {
    expect(() => analyzeExpression("√(x^6)")).toThrow(/valore assoluto/i);
  });

  it("√(2⁶) → UN solo risultato: accetta 8 oppure 2^3 (verifica a valore)", () => {
    const a = analyzeExpression("√(2^6)");
    const fin = a.steps.find((s) => s.kind === "rad-pow-final");
    expect(fin!.opLatex).toBe("\\sqrt{\\left(2^{6}\\right)}");
    expect(parsePolyLoose("8")).toEqual(parsePolyLoose("2^3"));
    expect(a.finalLatex).toBe("8");
  });

  it("√((2x)⁶) non diventa 8x³ se x può essere negativa", () => {
    expect(() => analyzeExpression("√((2x)^6)")).toThrow(/valore assoluto/i);
  });

  it("√(x⁵) → la radice resta INDICATA (10/11, non più errore)", () => {
    // (10/11) esponente non divisibile per l'indice: la radice resta indicata
    const a = analyzeExpression("√(x^5)");
    expect(a.originalLatex).toContain("\\sqrt");
  });

  it("audit progressività pulito sui nuovi flussi", () => {
    for (const c of ["√√16", "∛√64", "√(x^4)", "√(2^6)", "√((2x)^4)"]) {
      const a = analyzeExpression(c);
      expect(auditProgressivita(a.steps)).toEqual([]);
    }
  });
});
