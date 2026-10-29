import { describe, it, expect } from "vitest";
import {
  analyzeExpression,
  auditProgressivita,
  canParseExpression,
  normalizeInput,
  parseExpression,
  printLatex,
  isUserSumCorrect,
  type ExprStep,
} from "./espressioni";

/** Trova il passo con l'operazione indicata e verifica la risposta attesa */
function stepAnswer(steps: ExprStep[], opLatex: string): number {
  const s = steps.find((st) => st.opLatex === opLatex);
  expect(s, `manca il passo «${opLatex}»`).toBeDefined();
  return s!.answer!.n / s!.answer!.d;
}

describe("radici n-esime esatte (giro 21)", () => {
  it("radice cubica di un intero: ∛8 = 2 con passo interattivo", () => {
    const a = analyzeExpression("\\sqrt[3]{8}");
    expect(a.finalLatex).toBe("2");
    expect(isUserSumCorrect(stepAnswer(a.steps, "\\sqrt[3]{8}"), { n: 2, d: 1 })).toBe(true);
  });

  it("∛ da tastiera unicode e da esponente frazionario", () => {
    expect(analyzeExpression("∛27").finalLatex).toBe("3");
    expect(analyzeExpression("27^(1/3)").finalLatex).toBe("3");
    expect(canParseExpression("∛27+1")).toBe(true);
  });

  it("radice quarta: ∜16 = 2, ∜(1/16) = 1/2", () => {
    expect(analyzeExpression("\\sqrt[4]{16}").finalLatex).toBe("2");
    const a = analyzeExpression("\\sqrt[4]{\\dfrac{1}{16}}");
    expect(a.finalLatex).toContain("dfrac{1}{2}");
  });

  it("radice cubica di un negativo (indice dispari): ∛(−8) = −2", () => {
    expect(analyzeExpression("∛(-8)").finalLatex).toBe("-2");
  });

  it("radice di un monomio: ∛x³ = x", () => {
    const a = analyzeExpression("\\sqrt[3]{x^3}");
    expect(a.finalLatex).toBe("x");
  });

  it("radice non esatta → messaggio chiaro", () => {
    expect(() => analyzeExpression("\\sqrt[3]{9}")).toThrow(/potenze perfette/i);
    expect(() => analyzeExpression("\\sqrt[4]{9x^4}")).toThrow(/potenze perfette/i);
  });

  it("radice pari di un negativo → errore", () => {
    expect(() => analyzeExpression("\\sqrt[4]{-16}")).toThrow(/pari/i);
  });

  it("radice in un'espressione: ∛8 + √16 = 6", () => {
    const a = analyzeExpression("\\sqrt[3]{8} + \\sqrt{16}");
    expect(a.finalLatex).toBe("6");
  });

  it("esponenti oltre l'indice 4 → messaggio", () => {
    expect(() => normalizeInput("\\sqrt[5]{32}")).toThrow(/indice 5/i);
  });

  it("stampo LaTeX della radice con indice, parentesi triviali via", () => {
    expect(printLatex(parseExpression(normalizeInput("∛8")))).toBe("\\sqrt[3]{8}");
    expect(printLatex(parseExpression(normalizeInput("√(x+1)")))).toBe("\\sqrt{\\left(x + 1\\right)}");
  });
});
