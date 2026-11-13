import { describe, it, expect } from "vitest";
import { cleanAiExpression, aiExpressionPlausible } from "./aiClean";
import { normalizeExpressionOcr } from "./exprOcr";

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

describe("(9/11-fix bis, collaudo utente 9094) il periodico della FOTO non si cancella più", () => {
  it("la barra combinante U+0305 della IA diventa \\overline{} (cleanAiExpression)", () => {
    expect(
      cleanAiExpression("[(3⁄2-0,5)^2*√(9⁄4)+1,3̅]:(2-1⁄3)"),
    ).toBe("[(3⁄2-0,5)^2*√(9⁄4)+1,\\overline{3}]:(2-1⁄3)");
  });
  it("la stessa barra sopravvive anche a normalizeExpressionOcr (light, keepDivision)", () => {
    expect(
      normalizeExpressionOcr("[(3⁄2-0,5)^2*√(9⁄4)+1,3̅]:(2-1⁄3)", true, { keepDivision: true }),
    ).toBe("[(3⁄2-0,5)^2*√(9⁄4)+1,\\overline{3}]:(2-1⁄3)");
  });
  it("la virgola LaTeX del periodico misto viene normalizzata senza perdere antiperiodo o periodo", () => {
    expect(
      normalizeExpressionOcr("1{,}3\\overline{3}", true, { keepDivision: true }),
    ).toBe("1,3\\overline{3}");
  });
});

describe("(9/11-fix ter, foto «radicali con lettere e esponenti») LaTeX con graffe annidate", () => {
  it("\\sqrt{9x^{3}} e \\frac{25x^{4}}{x} si convertono senza lasciare LaTeX grezzo", () => {
    expect(
      cleanAiExpression(
        "\\sqrt{9x^{3}}\\cdot\\sqrt{x}-2x\\sqrt{4x^{2}}+\\sqrt{\\frac{25x^{4}}{x}}",
      ),
    ).toBe("√(9x^3)*√(x)-2x√(4x^2)+√((25x^4)⁄(x))");
  });
  it("\\sqrt[3]{81} si converte in ∛(81)", () => {
    expect(cleanAiExpression("2\\sqrt[3]{81}-5\\sqrt[3]{32}")).toBe("2∛(81)-5∛(32)");
  });
});
