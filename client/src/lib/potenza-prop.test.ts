import { describe, it, expect } from "vitest";
import { analyzeExpression, auditProgressivita } from "./espressioni";

/** (25/10, richiesta utente) Presentazione delle proprietà delle potenze:
 *  sotto la sezione parentesi l'app mostra ENTRAMBE le potenze (stato
 *  invariato) + la spiegazione «Applico le proprietà delle potenze:
 *  riscrivo la stessa base 1/3 e poi eseguo il calcolo degli esponenti
 *  (-4) - (-2).» — niente valore della parentesi, niente passi intermedi:
 *  POI un SOLO inserimento del risultato finale, accettando qualsiasi
 *  forma equivalente a valore (9 = 3^2 = (1/3)^-2). */
describe("pow-prop: espressione intera + spiegazione, poi risultato finale unico", () => {
  it("(1/3)^-4 : (1/3)^-2 → 3 passi: espressione intera, spiegazione, risultato 9", () => {
    const a = analyzeExpression("\\left(\\frac{1}{3}\\right)^{-4} : \\left(\\frac{1}{3}\\right)^{-2}");
    expect(a.steps).toHaveLength(3);
    // passo 1: stato INVARIATO (entrambe le frazioni) + spiegazione esatta
    const prop = a.steps[1];
    expect(prop.kind).toBe("pow-prop");
    expect(prop.latex).toBe("\\left(\\dfrac{1}{3}\\right)^{-4} : \\left(\\dfrac{1}{3}\\right)^{-2}");
    expect(prop.detail).toContain("Applico le proprietà delle potenze");
    expect(prop.detail).toContain("riscrivo la stessa base");
    expect(prop.detail).toContain("(-4) - (-2)");
    expect(prop.inParen).toBe(true);
    // niente valore della parentesi né passi intermedi in vista
    expect(a.steps.some((s) => s.kind === "paren-value")).toBe(false);
    expect(a.steps.some((s) => s.kind === "pow-flip")).toBe(false);
    // passo 2: UN SOLO risultato finale, 9
    const fin = a.steps[2];
    expect(fin.kind).toBe("pow-prop-final");
    expect(fin.answer?.n).toBe(9);
    expect(fin.opLatex).toBe("\\left(\\dfrac{1}{3}\\right)^{-2}");
    expect(a.finalLatex).toBe("9");
  });

  it("x⁶ : x² → spiegazione con esponenti 6 - 2, risultato x⁴ scritto dallo studente", () => {
    const a = analyzeExpression("x^6 : x^2");
    expect(a.steps[1].kind).toBe("pow-prop");
    expect(a.steps[1].detail).toContain("6 - 2");
    expect(a.steps[1].inParen).toBeUndefined();
    const fin = a.steps[2];
    expect(fin.kind).toBe("pow-prop-final");
    expect(fin.answerPoly?.[0]?.vars?.[0]).toEqual({ v: "x", e: 4 });
    expect(a.finalLatex).toBe("x^{4}");
  });

  it("2⁶ : 2² → opLatex 2⁴ (mai 64 : 4), risultato 16", () => {
    const a = analyzeExpression("2^6 : 2^2");
    expect(a.steps.some((s) => s.opLatex === "2^{6}")).toBe(false);
    const fin = a.steps.find((s) => s.kind === "pow-prop-final");
    expect(fin?.opLatex).toBe("2^{4}");
    expect(fin?.answer?.n).toBe(16);
  });

  it("(1/3)² · (1/3)³ → esponenti 2 + 3, risultato 1/243", () => {
    const a = analyzeExpression("\\left(\\frac{1}{3}\\right)^{2} \\cdot \\left(\\frac{1}{3}\\right)^{3}");
    expect(a.steps[1].detail).toContain("2 + 3");
    const fin = a.steps[2];
    expect(fin.kind).toBe("pow-prop-final");
    expect(fin.answer?.n).toBe(1);
    expect(fin.answer?.d).toBe(243);
    expect(a.finalLatex).toBe("\\dfrac{1}{243}");
  });

  it("espressione che prosegue dopo il segmento: il pow-prop-final resta un passo come gli altri", () => {
    const a = analyzeExpression("\\left(\\frac{1}{3}\\right)^{-4} : \\left(\\frac{1}{3}\\right)^{-2} \\cdot 2");
    const fin = a.steps.find((s) => s.kind === "pow-prop-final");
    expect(fin).toBeTruthy();
    expect(fin!.answer?.n).toBe(9);
    expect(a.finalLatex).toBe("18");
  });

  it("audit progressività: zero violazioni sui nuovi flussi", () => {
    for (const c of [
      "\\left(\\frac{1}{3}\\right)^{-4} : \\left(\\frac{1}{3}\\right)^{-2}",
      "x^6 : x^2",
      "x^6 : x^4",
      "2^6 : 2^2",
      "\\left(\\frac{1}{3}\\right)^{2} \\cdot \\left(\\frac{1}{3}\\right)^{3}",
      "\\left(\\frac{1}{3}\\right)^{-4} : \\left(\\frac{1}{3}\\right)^{-2} \\cdot 2",
    ]) {
      const a = analyzeExpression(c);
      expect(auditProgressivita(a.steps)).toEqual([]);
    }
  });
});
