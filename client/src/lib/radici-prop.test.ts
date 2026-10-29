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

  it("√(x⁶) → «divido l'esponente 6 per l'indice 2» → UN solo risultato x³", () => {
    const a = analyzeExpression("√(x^6)");
    const rp = a.steps.find((s) => s.kind === "rad-pow");
    expect(rp).toBeTruthy();
    expect(rp!.latex).toBe("\\sqrt{\\left(x^{6}\\right)}");
    expect(rp!.detail).toContain("6");
    expect(rp!.detail).toContain("indice } 2");
    const fin = a.steps.find((s) => s.kind === "rad-pow-final");
    expect(fin!.answerPoly).toEqual([{ c: { n: 1, d: 1 }, vars: [{ v: "x", e: 3 }] }]);
    expect(a.finalLatex).toBe("x^{3}");
    // niente pow-term intermedio (l'esponente non viene mai calcolato a parte)
    expect(a.steps.some((s) => s.kind === "pow-term")).toBe(false);
  });

  it("√(2⁶) → UN solo risultato: accetta 8 oppure 2^3 (verifica a valore)", () => {
    const a = analyzeExpression("√(2^6)");
    const fin = a.steps.find((s) => s.kind === "rad-pow-final");
    expect(fin!.opLatex).toBe("\\sqrt{\\left(2^{6}\\right)}");
    expect(parsePolyLoose("8")).toEqual(parsePolyLoose("2^3"));
    expect(a.finalLatex).toBe("8");
  });

  it("√((2x)⁶) → (2x)³ = 8x³ con la proprietà mostrata", () => {
    const a = analyzeExpression("√((2x)^6)");
    expect(a.steps.some((s) => s.kind === "rad-pow")).toBe(true);
    expect(a.finalLatex).toBe("8x^{3}");
  });

  it("√(x⁵) → errore chiaro (esponente non divisibile per l'indice)", () => {
    expect(() => analyzeExpression("√(x^5)")).toThrow();
  });

  it("audit progressività pulito sui nuovi flussi", () => {
    for (const c of ["√√16", "∛√64", "√(x^6)", "√(2^6)", "√((2x)^6)"]) {
      const a = analyzeExpression(c);
      expect(auditProgressivita(a.steps)).toEqual([]);
    }
  });
});
