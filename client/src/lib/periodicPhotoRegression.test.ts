import { describe, expect, it } from "vitest";
import katex from "katex";
import { cleanAiExpression } from "./aiClean";
import { normalizeExpressionOcr, groupRadicalNumerators } from "./exprOcr";
import { appNotationToLatex } from "./appNotationLatex";
import { normalizeKeyboardNotation, sanitizeLatexNotation } from "./keyboardNotation";
import { analyzeExpression, normalizeInput, parseExpression, printLatex } from "./espressioni";

// Riproduce TUTTA la catena che va dalla risposta della foto al riquadro
// «CONTROLLA PRIMA DI CONFERMARE». Non propone né mostra soluzioni.
function fromPhoto(raw: string): string {
  const fromVision = cleanAiExpression(raw);
  return groupRadicalNumerators(normalizeExpressionOcr(fromVision, true, { keepDivision: true }));
}

function previewLatex(expression: string): string {
  try {
    return appNotationToLatex(analyzeExpression(expression).originalLatex);
  } catch {
    return appNotationToLatex(expression);
  }
}

describe("foto e riquadro di conferma: periodici fedeli", () => {
  it.each([
    ["1,3per", String.raw`1,\overline{3}`],
    ["0,1_6per", String.raw`0,1\overline{6}`],
    ["0,16̅", String.raw`0,1\overline{6}`],
    ["0,1̄2̄", String.raw`0,\overline{12}`],
    [String.raw`0{,}\bar{3}`, String.raw`0,\overline{3}`],
  ])("mantiene il periodo esatto di %s", (raw, expected) => {
    const out = fromPhoto(raw);
    expect(out).toBe(expected);
    const latex = previewLatex(out);
    expect(latex).toContain(expected.replace(",", "{,}"));
    // KaTeX deve generare una linea del periodo, non solo una annotazione.
    const html = katex.renderToString(latex, { throwOnError: true });
    expect(html).toContain("overline-line");
  });

  it("la foto con radice di frazione e 1,3 periodico resta fedele in ogni passaggio", () => {
    const photo = String.raw`[(3⁄2-0,5)^2*√(9⁄4)+1,3per]:(2-1⁄3)`;
    const raw = fromPhoto(photo);
    expect(raw).toContain(String.raw`1,\overline{3}`);
    expect(raw).toContain("√(9⁄4)");
    const latex = previewLatex(raw);
    expect(latex).toContain(String.raw`\overline{3}`);
    expect(latex).toMatch(/\\sqrt\{.*\\(?:d)?frac\{9\}\{4\}.*\}/);
    expect(katex.renderToString(latex, { throwOnError: true })).toContain("overline-line");
  });

  it("non inventa un periodo per un decimale normale", () => {
    const raw = fromPhoto("1,3+0,5");
    expect(raw).not.toMatch(/overline|per|\u0304|\u0305/);
  });

  it("il comando da tastiera rimane stabile dopo successive normalizzazioni", () => {
    const raw = normalizeKeyboardNotation("1,3per");
    expect(raw).toBe(String.raw`1,\overline{3}`);
    expect(normalizeKeyboardNotation(raw)).toBe(raw);
    expect(sanitizeLatexNotation(raw)).toBe(raw);
    expect(previewLatex(raw)).toContain(String.raw`\overline{3}`);
  });
});

describe("foto: radice nel solo numeratore o su tutta la frazione", () => {
  it("conserva il puntino tra le due radici anche nella traccia costruita", () => {
    const originale = "√(9x^3)·√(x)-2x√(4x^2)+(√(25x^4))⁄x";
    const latex = printLatex(parseExpression(normalizeInput(originale)));
    expect(latex).toMatch(/\}\s*\\cdot\s*\\sqrt\{x\}/);
    // Il coefficiente di un monomio resta giustapposto alla lettera.
    expect(latex).toContain("2x");
  });

  it("raggruppa la radice al numeratore, senza cambiare il radicando", () => {
    expect(groupRadicalNumerators("√(25x^4)⁄x")).toBe("(√(25x^4))⁄x");
    expect(groupRadicalNumerators("(√(25x^4))⁄x")).toBe("(√(25x^4))⁄x");
    expect(groupRadicalNumerators("√((25x^4)⁄x)")).toBe("√((25x^4)⁄x)");
    expect(appNotationToLatex("(√(25x^4))⁄x")).toBe(String.raw`\frac{\sqrt{25x^{4}}}{x}`);
  });

  it("converte la frazione LaTeX con radice al numeratore, comprese le graffe annidate", () => {
    const raw = fromPhoto(String.raw`\frac{\sqrt{25x^{4}}}{x}`);
    expect(raw).toBe("(√(25x^4))⁄(x)");
    expect(printLatex(parseExpression(normalizeInput(raw)))).toMatch(/\\(?:d)?frac\{.*\\sqrt\{/);
  });

  it("una radice su tutta la frazione non diventa una radice sul solo numeratore", () => {
    const raw = fromPhoto(String.raw`\sqrt{\frac{9}{4}}`);
    expect(raw).toBe("√((9)⁄(4))");
    expect(previewLatex(raw)).toMatch(/\\sqrt\{.*\\(?:d)?frac\{9\}\{4\}.*\}/);
  });
});
