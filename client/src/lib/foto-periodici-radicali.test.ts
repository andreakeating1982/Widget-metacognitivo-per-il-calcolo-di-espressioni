import { describe, it, expect } from "vitest";
import { canParseExpression, analyzeExpression } from "./espressioni";
import { cleanAiExpression } from "./aiClean";
import { canonicalizePeriodicNotation } from "./periodicNotation";

/* Test di regressione 10/11 — foto «frazione di due somme con radicali ad
 * indici diversi, coefficienti periodici ed esponenti negativi».
 * NESSUN risultato dell'esercizio qui: si verifica SOLO che l'app
 * riconosca e analizzi senza bloccarsi, lasciando INDICATE le radici. */

const latex =
  "\\dfrac{0,75x^{-1}\\sqrt{ab^{-1}} - 0,75x^{-1}\\sqrt{ab^{-1}} + 0,4\\overline{6}\\sqrt[3]{\\dfrac{a^{-2}b}{x}} + 0,1\\overline{6}\\sqrt[4]{ab^{-2}} - 0,1\\overline{6}\\sqrt[4]{ab^{-2}}}{1,25x^{-1}\\sqrt{ab^{-1}} - 1,25x^{-1}\\sqrt{ab^{-1}} + 0,2\\overline{3}\\sqrt[3]{\\dfrac{a^{-2}b}{x}} + 0,\\overline{3}\\sqrt[3]{ab^{-1}} - 0,\\overline{3}\\sqrt[3]{ab^{-1}}}";

const tastiera =
  "(0,75x^-1√(ab^-1) - 0,75x^-1√(ab^-1) + 0,4_6per∛(a^-2b/x) + 0,1_6per∜(ab^-2) - 0,1_6per∜(ab^-2)) : (1,25x^-1√(ab^-1) - 1,25x^-1√(ab^-1) + 0,2_3per∛(a^-2b/x) + 0,3per∛(ab^-1) - 0,3per∛(ab^-1))";

describe("foto 10/11: radicali, periodici ed esponenti negativi", () => {
  it("la trascrizione LaTeX dell'IA vision passa il parse", () => {
    expect(canParseExpression(latex)).toBe(true);
  });

  it("l'analisi NON si blocca su esponenti dispari dentro le radici", () => {
    const a = analyzeExpression(latex);
    expect(a.originalLatex.length).toBeGreaterThan(0);
    // le radici con esponenti dispari restano INDICATE (mai semplificate):
    // il radicando compare ancora sotto radice, con il suo segno meno
    expect(a.originalLatex).toContain("\\sqrt{\\left(a \\cdot b^{-1}\\right)}");
  });

  it("la notazione da tastiera (0,4_6per) passa il parse e l'analisi", () => {
    const canonica = canonicalizePeriodicNotation(tastiera);
    expect(canParseExpression(canonica)).toBe(true);
    expect(() => analyzeExpression(canonica)).not.toThrow();
  });

  it("la fratta con denominatore letterale resta indicata, senza errori", () => {
    // il flusso precedente abortiva con «L'app non supporta la divisione
    // tra espressioni con lettere» sull'intera espressione
    const a = analyzeExpression(latex);
    expect(a.originalLatex).toContain("\\sqrt[3]");
    expect(a.originalLatex).toContain("\\sqrt[4]");
  });
});

describe("radici con indice NEGATIVO (esistono in matematica)", () => {
  it("⁻³√(8) si riconosce dal parser", () => {
    expect(canParseExpression("⁻³√(8) + 2")).toBe(true);
  });

  it("\\sqrt[-3]{8} dal LaTeX si converte in ⁻³√(8)", () => {
    expect(canParseExpression("\\sqrt[-3]{8} + 2")).toBe(true);
  });

  it("l'analisi lascia la radice con indice negativo INDICATA", () => {
    const a = analyzeExpression("⁻³√(8) + 2");
    expect(a.originalLatex).toContain("\\sqrt[-3]");
  });

  it("l'indice negativo non viene mai semplificato dall'app", () => {
    // nemmeno con radicando «perfetto»: resta indicata di proposito
    const a = analyzeExpression("⁻³√(27) + 1");
    expect(a.originalLatex).toContain("\\sqrt[-3]");
  });
});

describe("pulizia trascrizione IA (aiClean)", () => {
  it("converte \\sqrt[-3]{...} in notazione interna", () => {
    expect(cleanAiExpression("\\sqrt[-3]{8}")).toContain("⁻³√(8)");
  });

  it("converte \\sqrt[5]{...} e \\sqrt[12]{...} in notazione interna", () => {
    expect(cleanAiExpression("\\sqrt[5]{x}")).toContain("⁵√(x)");
    expect(cleanAiExpression("\\sqrt[12]{x}")).toContain("¹²√(x)");
  });

  it("non trasforma gli apici dell'indice in potenze ^", () => {
    const c = cleanAiExpression("\\sqrt[5]{x} + 2^2");
    expect(c).toContain("⁵√(x)");
    expect(c).toContain("2^2");
  });
});
