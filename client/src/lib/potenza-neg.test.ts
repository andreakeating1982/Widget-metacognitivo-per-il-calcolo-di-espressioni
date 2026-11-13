import { describe, it, expect } from "vitest";
import { analyzeExpression, auditProgressivita, parsePolyLoose, fr } from "./espressioni";

/** (25/10, punto 1) ESPONENTI NEGATIVI CON LETTERE — stesso schema dei due
 *  tempi delle proprietà delle potenze: spiegazione con l'espressione intera,
 *  poi UN SOLO inserimento del risultato in forma equivalente (1/x^2 oppure
 *  x^-2). Niente più errore «l'app non la supporta». */
describe("punto 1 — esponenti negativi con lettere", () => {
  it("x² : x⁴ → spiegazione «2 - 4» poi UN solo risultato 1/x² (o x^-2)", () => {
    const a = analyzeExpression("x^2 : x^4");
    expect(a.steps).toHaveLength(3);
    expect(a.steps[1].kind).toBe("pow-prop");
    expect(a.steps[1].latex).toBe("x^{2} : x^{4}");
    expect(a.steps[1].detail).toContain("2 - 4");
    const fin = a.steps[2];
    expect(fin.kind).toBe("pow-prop-final");
    expect(fin.opLatex).toBe("x^{2} : x^{4}");
    expect(fin.answerPoly).toEqual([{ c: fr(1), vars: [{ v: "x", e: -2 }] }]);
    // stato finale: frazione impilata
    expect(a.finalLatex).toBe("\\dfrac{1}{x^{2}}");
  });

  it("parsePolyLoose accetta entrambe le forme equivalenti 1/x^2 e x^-2", () => {
    const atteso = [{ c: fr(1), vars: [{ v: "x", e: -2 }] }];
    expect(parsePolyLoose("1/x^2")).toEqual(atteso);
    expect(parsePolyLoose("x^-2")).toEqual(atteso);
  });

  it("2x⁵ : x⁷ → div-mono con risultato 2/x² (frazione impilata)", () => {
    const a = analyzeExpression("2x^5 : x^7");
    const fin = a.steps.find((s) => s.kind === "div-mono");
    expect(fin).toBeTruthy();
    expect(fin!.answerPoly).toEqual([{ c: fr(2), vars: [{ v: "x", e: -2 }] }]);
    expect(a.finalLatex).toBe("\\dfrac{2}{x^{2}}");
  });

  it("continuazione: x² : x⁴ · x³ → x (i monomi con esponente negativo si moltiplicano)", () => {
    const a = analyzeExpression("x^2 : x^4 \\cdot x^3");
    expect(a.finalLatex).toBe("x");
  });

  it("x^-2 scritta direttamente → capovolgimento segnalato → 1/x²", () => {
    const a = analyzeExpression("x^-2");
    expect(a.steps.some((s) => s.kind === "pow-flip")).toBe(true);
    expect(a.finalLatex).toBe("\\dfrac{1}{x^{2}}");
  });

  it("audit progressività pulito sui nuovi flussi", () => {
    for (const c of ["x^2 : x^4", "2x^5 : x^7", "x^2 : x^4 \\cdot x^3", "x^-2"]) {
      const a = analyzeExpression(c);
      expect(auditProgressivita(a.steps)).toEqual([]);
    }
  });
});
