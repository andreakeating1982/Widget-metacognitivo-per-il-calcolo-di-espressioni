import { describe, it, expect } from "vitest";
import { analyzeExpression, auditProgressivita } from "./espressioni";

/** (25/10, punto 2) ESPONENTI FRAZIONARI = RADICI, con riscrittura
 *  SEGNALATA (prima la trasformazione era silenziosa al parse e valeva
 *  solo per 1/n). La filosofia resta: l'app mostra la trasformazione,
 *  lo studente svolge SOLO la radice e l'eventuale potenza. */
describe("punto 2 — esponenti frazionari come radici", () => {
  it("9^(1/2) → passo segnalato «il denominatore 2 è l'indice» → √9 allo studente → 3", () => {
    const a = analyzeExpression("9^(1/2)");
    const frac = a.steps.find((s) => s.kind === "pow-frac");
    expect(frac).toBeTruthy();
    expect(frac!.latex).toBe("\\sqrt{9}");
    expect(frac!.detail).toContain("\\tfrac{1}{2}");
    expect(frac!.detail).toContain("indice");
    expect(a.steps.some((s) => s.kind === "sqrt" || s.kind === "root")).toBe(true);
    expect(a.finalLatex).toBe("3");
  });

  it("27^(1/3) → ∛27 → 3 (trasformazione ora SEGnalata, risultato invariato)", () => {
    const a = analyzeExpression("27^(1/3)");
    expect(a.steps.some((s) => s.kind === "pow-frac")).toBe(true);
    expect(a.finalLatex).toBe("3");
  });

  it("16^(3/4) → (∜16)³ con numeri PICCOLI: radice prima, potenza dopo → 8", () => {
    const a = analyzeExpression("16^(3/4)");
    const frac = a.steps.find((s) => s.kind === "pow-frac");
    expect(frac!.latex).toBe("\\left(\\sqrt[4]{16}\\right)^{3}");
    expect(frac!.detail).toContain("4");
    expect(frac!.detail).toContain("3");
    // MAI 4096 sotto radice (base^m gigantesco)
    expect(a.steps.some((s) => (s.opLatex ?? s.latex).includes("4096"))).toBe(false);
    expect(a.finalLatex).toBe("8");
  });

  it("x^(1/2) con esponenti dispari → errore chiaro (nessuna radice esatta)", () => {
    expect(() => analyzeExpression("x^(1/2)")).toThrow();
  });

  it("esponente frazionario negativo → messaggio chiaro col consiglio del libro", () => {
    expect(() => analyzeExpression("9^(-1/2)")).toThrow(/capovolgendo/);
  });

  it("audit progressività pulito", () => {
    for (const c of ["9^(1/2)", "27^(1/3)", "16^(3/4)"]) {
      const a = analyzeExpression(c);
      expect(auditProgressivita(a.steps)).toEqual([]);
    }
  });
});
