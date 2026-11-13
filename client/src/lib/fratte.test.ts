import { describe, it, expect } from "vitest";
import {
  analyzeExpression,
  canParseExpression,
  parseExpression,
  normalizeInput,
  printLatex,
  term,
  fr,
  type ExprStep,
} from "./espressioni";
import {
  analyzeFratte,
  isFratte,
  evalRat,
  ratAdd,
  solveZeros,
  type FrattaStep,
} from "./fratte";

function stepAnswer(steps: ExprStep[] | FrattaStep[], opLatex: string): number {
  const s = (steps as ExprStep[]).find((st) => (st as ExprStep).opLatex === opLatex);
  expect(s, `manca il passo «${opLatex}»`).toBeDefined();
  return (s as ExprStep).answer!.n / (s as ExprStep).answer!.d;
}

describe("riconoscimento fratte (giro 21)", () => {
  it("3:(x+1) è fratta; 2x+1 e x⁴:x² NON lo sono", () => {
    expect(isFratte(parseExpression(normalizeInput("3:(x+1)")))).toBe(true);
    expect(isFratte(parseExpression(normalizeInput("2x+1")))).toBe(false);
    expect(isFratte(parseExpression(normalizeInput("x^4:x^2")))).toBe(false);
    expect(isFratte(parseExpression(normalizeInput("3:x")))).toBe(true);
  });

  it("valutazione razionale: 3:(x+1) + 2:(x+1) = 5/(x+1)", () => {
    const a = analyzeFratte("3:(x+1) + 2:(x+1)");
    expect(a.finalIsRational).toBe(true);
    expect(a.finalLatex).toBe("\\dfrac{5}{x + 1}");
  });

  it("denominatori diversi: 3:x + 2:(x+1) con denominatore comune x(x+1)", () => {
    const a = analyzeFratte("3:x + 2:(x+1)");
    expect(a.finalLatex).toBe("\\dfrac{5x + 3}{x^{2} + x}");
  });

  it("campo di esistenza lineare: x ≠ −1", () => {
    const a = analyzeFratte("3:(x+1) + 2:(x+1)");
    expect(a.ce.length).toBe(1);
    expect(a.ce[0].exact).toBe(true);
    expect(a.ce[0].roots[0].n / a.ce[0].roots[0].d).toBe(-1);
    expect(a.ceLatex).toContain("x \\ne -1");
  });

  it("campo di esistenza quadratico con Δ perfetto: (x+2)(x−3)", () => {
    const a = analyzeFratte("1:((x+2)(x-3))");
    expect(a.ce.length).toBe(1);
    const roots = a.ce[0].roots.map((r) => r.n / r.d).sort();
    expect(roots).toEqual([-2, 3]);
  });

  it("monomio al denominatore: 5:x → C.E. x ≠ 0, risultato 5/x", () => {
    const a = analyzeFratte("5:x");
    expect(a.ceLatex).toContain("x \\ne 0");
    expect(a.finalLatex).toBe("\\dfrac{5}{x}");
  });

  it("semplificazione con fattore comune: (x²−1):(x+1) = x−1 (C.E. resta x ≠ −1)", () => {
    const a = analyzeFratte("(x^2-1):(x+1)");
    expect(a.finalIsRational).toBe(false);
    expect(a.finalLatex).toBe("x - 1");
    expect(a.ceLatex).toContain("x \\ne -1");
    expect(a.ce[0].denLatex).toBe("x + 1");
  });

  it("semplificazione polinomiale: (6x+3x²):(x+2) = 3x (grado decrescente)", () => {
    const a = analyzeFratte("(6x+3x^2):(x+2)");
    expect(a.finalLatex).toBe("3x");
  });

  it("prodotto e potenza razionale: (1:(x+1))² → 1/(x+1)²", () => {
    const a = analyzeFratte("(1:(x+1))^(2)");
    expect(a.finalLatex).toBe("\\dfrac{1}{x^{2} + 2x + 1}");
  });

  it("moltiplicazione: (2:(x+1))·3 = 6/(x+1)", () => {
    const a = analyzeFratte("(2:(x+1))*3");
    expect(a.finalLatex).toBe("\\dfrac{6}{x + 1}");
  });

  it("fratta mista con numeri: 2 + 1:(x−2), C.E. x ≠ 2", () => {
    const a = analyzeFratte("2 + 1:(x-2)");
    expect(a.finalLatex).toBe("\\dfrac{2x - 3}{x - 2}");
    expect(a.ceLatex).toContain("x \\ne 2");
  });

  it("i passi mostrano UNA operazione per volta (mai valori già svolti)", () => {
    const a = analyzeFratte("3:(x+1) + 2:(x+1)");
    // il primo passo è l'espressione intera, poi le due conversioni, poi la somma
    expect(a.steps.length).toBeGreaterThanOrEqual(4);
    expect(a.steps[0].latex).toBe("3 : \\left(x + 1\\right) + 2 : \\left(x + 1\\right)");
  });

  it("frazione dentro la frazione (divisore) → errore chiaro", () => {
    expect(() => analyzeFratte("1:(1:x)")).toThrow(/dentro le frazioni/i);
  });

  it("denominatore con Δ negativo: nessun valore escluso", () => {
    const a = analyzeFratte("1:(x^2+1)");
    expect(a.ce[0].roots.length).toBe(0);
    expect(a.ce[0].exact).toBe(true);
    expect(a.ceLatex).toContain("nessun valore escluso");
  });

  it("denominatore con Δ non perfetto: condizione generica den ≠ 0", () => {
    const a = analyzeFratte("1:(x^2+x-1)");
    expect(a.ce[0].exact).toBe(false);
    expect(a.ceLatex).toContain("\\ne 0");
  });

  it("canParseExpression accetta le fratte da tastiera", () => {
    expect(canParseExpression("3:(x+1)+2:(x+1)")).toBe(true);
    expect(canParseExpression("(x^2-1):(x+1)")).toBe(true);
  });

  it("analyzeExpression (polinomiale) fallisce per le fratte → la UI le devia", () => {
    expect(() => analyzeExpression("3:(x+1)")).toThrow();
  });

  it("aritmetica razionale di base", () => {
    const x = (e: number) => term([{ v: "x", e }], fr(1));
    const a = { num: [term([], fr(3))], den: [x(1)] };
    const b = { num: [term([], fr(2))], den: [x(1)] };
    expect(printLatex({ k: "rat", ...ratAdd(a, b, false) })).toBe("\\dfrac{5}{x}");
    expect(evalRat(parseExpression(normalizeInput("(2:(x+1))*3"))).num[0].c).toEqual(fr(6));
  });

  it("solveZeros di grado 3 con radice razionale: x³−x = 0 → 0, 1, −1", () => {
    const den = [term([], fr(0)), term([{ v: "x", e: 1 }], fr(-1)), term([], fr(0)), term([{ v: "x", e: 3 }], fr(1))];
    const s = solveZeros(den, "x");
    expect(s.exact).toBe(true);
    const vals = s.roots.map((r) => r.n / r.d).sort((a, b) => a - b);
    expect(vals).toEqual([-1, 0, 1]);
  });
});
