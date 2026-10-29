import { describe, it, expect } from "vitest";
import { analyzeExpression } from "./espressioni";

/** Analizza e restituisce (passi, finale) */
function run(e: string) {
  const a = analyzeExpression(e);
  return { steps: a.steps.map((s) => s.kind), final: a.finalLatex };
}

describe("radici quadrate (quadrati perfetti)", () => {
  it("√9·2 = 6 (prima la radice, poi il prodotto)", () => {
    const r = run("√9·2");
    expect(r.steps).toContain("sqrt");
    expect(r.final).toBe("6");
  });

  it("√16:2 = 2", () => {
    expect(run("√16:2").final).toBe("2");
  });

  it("3+√25 = 8", () => {
    expect(run("3+√25").final).toBe("8");
  });

  it("√(36):2 = 3 (radice di parentesi)", () => {
    expect(run("√(36):2").final).toBe("3");
  });

  it("radice di frazione quadrato perfetto: √(4:9) = 2/3", () => {
    expect(run("√(4:9)").final).toContain("\\dfrac{2}{3}");
  });

  it("radice non esatta → messaggio chiaro", () => {
    expect(() => run("√2+1")).toThrow(/quadrati perfetti/);
  });

  it("radice di numero negativo → errore", () => {
    expect(() => run("√(0-4)")).toThrow(/negativo/);
  });

  it("la V maiuscola (OCR) diventa radice: V9·2 = 6", () => {
    expect(run("V9·2").final).toBe("6");
  });
});

describe("radici di monomi (esponenti pari)", () => {
  it("√x^2 = x", () => {
    expect(run("√x^2").final).toBe("x");
  });

  it("√9x^2 = 3x", () => {
    expect(run("√9x^2").final).toBe("3x");
  });

  it("√x^4 = x^2", () => {
    expect(run("√x^4").final).toBe("x^{2}");
  });

  it("√9x^2·2 = 6x (radice dentro un'espressione letterale)", () => {
    expect(run("√9x^2·2").final).toBe("6x");
  });

  it("esponente dispari → errore chiaro", () => {
    expect(() => run("√x^3")).toThrow(/esponenti pari/);
  });
});

describe("divisione tra monomi (proprietà dei quozienti)", () => {
  it("x^6:x^4 = x^2 via proprietà dei quozienti (pow-prop: 6 − 4, dal 25/10 corretto)", () => {
    // (25/10) le potenze con STESSA base passano ora da pow-prop (esponenti
    // sottratti dall'app, x² lo scrive lo studente): il passo div-mono resta
    // per basi DIVERSE (es. 6x^5:2x^2, test sotto).
    const r = run("x^6:x^4");
    expect(r.steps).toContain("pow-prop");
    expect(r.final).toBe("x^{2}");
  });

  it("6x^5:2x^2 = 3x^3 (coefficienti ed esponenti)", () => {
    expect(run("6x^5:2x^2").final).toBe("3x^{3}");
  });

  it("(6x^5+3x):3x = 2x^4+1 (polinomio : monomio)", () => {
    expect(run("(6x^5+3x):3x").final).toBe("2x^{4} + 1");
  });

  it("xy^2:x = y^2 (si elimina solo la variabile del divisore)", () => {
    expect(run("xy^2:x").final).toBe("y^{2}");
  });

  it("esponente negativo → frazione impilata 1/x² (punto 1, 25/10)", () => {
    expect(run("x^2:x^4").final).toBe("\\dfrac{1}{x^{2}}");
  });

  it("divisore zero → errore", () => {
    expect(() => run("x^2:0")).toThrow(/zero/);
  });
});
