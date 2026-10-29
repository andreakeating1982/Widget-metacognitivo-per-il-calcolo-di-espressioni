import { describe, it, expect } from "vitest";
import { cleanAiExpression, aiExpressionPlausible } from "./aiClean";

describe("aiClean: pulizia della trascrizione IA (giro 20)", () => {
  it("notazione già pulita resta identica", () => {
    expect(cleanAiExpression("(3⁄7):(9⁄14)^2-7⁄12*2")).toBe("(3⁄7):(9⁄14)^2-7⁄12*2");
    expect(cleanAiExpression("3*2")).toBe("3*2");
  });

  it("LaTeX frazioni e potenze → notazione interna", () => {
    expect(cleanAiExpression("\\frac{3}{7}")).toBe("(3)⁄(7)");
    expect(cleanAiExpression("\\dfrac{3}{7}:\\dfrac{9}{14}")).toBe("(3)⁄(7):(9)⁄(14)");
    expect(cleanAiExpression("x^{2}+1")).toBe("x^2+1");
    expect(cleanAiExpression("\\sqrt{9}x")).toBe("√(9)x");
    expect(cleanAiExpression("2\\cdot3\\div4")).toBe("2*3:4");
  });

  it("simboli Unicode comuni", () => {
    expect(cleanAiExpression("2 × 3 ÷ 4 − 1")).toBe("2*3:4-1");
    expect(cleanAiExpression("2·3")).toBe("2*3");
    expect(cleanAiExpression("x²y³")).toBe("x^2y^3");
  });

  it("recinti markdown, spazi e $ via", () => {
    expect(cleanAiExpression("```\n(3+2)*4\n```")).toBe("(3+2)*4");
    expect(cleanAiExpression("$3 + 2$")).toBe("3+2");
    expect(cleanAiExpression("  3⁄7 : 2 ")).toBe("3⁄7:2");
  });

  it("simboli spurii TOLTI, ? conservato (mai inventare)", () => {
    expect(cleanAiExpression("3 + £ 2")).toBe("3+2");
    expect(cleanAiExpression("3 ? 2")).toBe("3?2");
    expect(cleanAiExpression("«3+2»")).toBe("3+2"); // le virgolette via
  });

  it("lettere minuscole (convenzione dell'app)", () => {
    expect(cleanAiExpression("2X + 3Y")).toBe("2x+3y");
  });

  it("frazioni annidate", () => {
    expect(cleanAiExpression("\\frac{\\frac{1}{2}}{3}")).toBe("((1)⁄(2))⁄(3)");
  });

  it("plausibilità: numero puro o struttura, MAI solo operatore spurio", () => {
    // (giro 20-fix) il numero PURO è accettato: «42» non dà più il falso
    // «L'IA non ha letto bene»
    expect(aiExpressionPlausible("42")).toBe(true);
    expect(aiExpressionPlausible("3+2")).toBe(true);
    expect(aiExpressionPlausible("(3⁄7)")).toBe(true);
    expect(aiExpressionPlausible("")).toBe(false);
  });

  /* (26/10-bis) risposta SIMBOLICA: le lettere sono utilizzabili senza
     operatori (prima «9a»/«3ab» venivano scartati → falso «IA non ha
     letto bene» anche con trascrizione perfetta) */
  it("plausibilità: risposta simbolica con lettere", () => {
    expect(aiExpressionPlausible("9a")).toBe(true);
    expect(aiExpressionPlausible("3ab")).toBe(true);
    expect(aiExpressionPlausible("22a^3b")).toBe(true);
    expect(aiExpressionPlausible("x")).toBe(true);
    expect(aiExpressionPlausible("?")).toBe(false);
  });
});
