import { describe, it, expect } from "vitest";
import { analyzeExpression, auditProgressivita, parsePolyLoose } from "./espressioni";

/** (25/10, punto 3) POTENZA DI PRODOTTO E QUOZIENTE: (2x)³, (x/2)² —
 *  la proprietà «la potenza si applica a ogni fattore» al posto dello
 *  sviluppo ripetuto. Stesso schema dei due tempi: spiegazione, poi UN
 *  SOLO inserimento del risultato in forma equivalente. */
describe("punto 3 — potenza di prodotto e quoziente", () => {
  it("(2x)³ → spiegazione della proprietà, poi UN solo risultato 8x³", () => {
    const a = analyzeExpression("(2x)^3");
    expect(a.steps[1].kind).toBe("pow-prod");
    expect(a.steps[1].latex).toBe("\\left(2x\\right)^{3}");
    expect(a.steps[1].detail).toContain("Potenza di un prodotto");
    const fin = a.steps[2];
    expect(fin.kind).toBe("pow-prod-final");
    expect(fin.answerPoly).toEqual([{ c: { n: 8, d: 1 }, vars: [{ v: "x", e: 3 }] }]);
    expect(a.finalLatex).toBe("8x^{3}");
    // niente sviluppo ripetuto (2x)(2x)(2x)
    expect(a.steps.some((s) => s.kind === "paren-mul")).toBe(false);
  });

  it("(x/2)² → quoziente → x²/4 (frazione impilata)", () => {
    const a = analyzeExpression("(x/2)^2");
    expect(a.steps[1].kind).toBe("pow-prod");
    expect(a.steps[1].detail).toContain("quoziente");
    expect(a.finalLatex).toBe("\\dfrac{x^{2}}{4}");
  });

  it("(2x)^-2 → capovolgimento → (2x)² allo studente → 1/(4x²)", () => {
    const a = analyzeExpression("(2x)^-2");
    expect(a.steps.some((s) => s.kind === "pow-flip")).toBe(true);
    expect(a.steps.some((s) => s.kind === "pow-prod")).toBe(true);
    expect(a.finalLatex).toBe("\\dfrac{1}{4x^{2}}");
  });

  it("parsePolyLoose accetta le forme equivalenti 8x^3 e 2^3x^3", () => {
    const atteso = [{ c: { n: 8, d: 1 }, vars: [{ v: "x", e: 3 }] }];
    expect(parsePolyLoose("8x^3")).toEqual(atteso);
    expect(parsePolyLoose("2^3x^3")).toEqual(atteso);
  });

  it("(x+1)² resta sullo sviluppo ripetuto (NON è un monomio)", () => {
    const a = analyzeExpression("(x+1)^2");
    expect(a.steps.some((s) => s.kind === "pow-prod")).toBe(false);
  });

  it("continuazione: (2x)³ · x → 8x⁴", () => {
    const a = analyzeExpression("(2x)^3 \\cdot x");
    expect(a.finalLatex).toBe("8x^{4}");
  });

  it("audit progressività pulito", () => {
    for (const c of ["(2x)^3", "(x/2)^2", "(2x)^-2", "(2x)^3 \\cdot x"]) {
      const a = analyzeExpression(c);
      expect(auditProgressivita(a.steps)).toEqual([]);
    }
  });
});
