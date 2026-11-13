import { describe, expect, it } from "vitest";
import { cleanAiExpression } from "./aiClean";
import { normalizeExpressionOcr, groupRadicalNumerators } from "./exprOcr";
import { appNotationToLatex } from "./appNotationLatex";
import { normalizeKeyboardNotation } from "./keyboardNotation";
import { analyzeExpression } from "./espressioni";

const photoPipeline = (raw: string) =>
  groupRadicalNumerators(normalizeExpressionOcr(cleanAiExpression(raw), true, { keepDivision: true }));

describe("indici di radice trascritti da foto — fedeltà senza svolgimento", () => {
  it.each(["⁻²", "⁻³", "⁻⁴", "⁻⁵", "⁻⁶", "⁻⁷", "⁻⁸", "⁻⁹", "⁻¹⁰", "⁻¹¹", "⁻¹²", "⁵", "⁶", "⁷", "⁸", "⁹", "¹⁰", "¹¹", "¹²"])("conserva l'indice %s accanto al radicale", (indice) => {
    const notation = photoPipeline(`2${indice}√(x)+1`);
    expect(notation).toContain(`${indice}√(x)`);
    expect(notation).not.toMatch(/\^\d+√/);
  });

  it("conserva i due indici −3 della foto accanto al periodico", () => {
    const raw = "(0,75x^-1√(ab^-1)-0,75x^-1√(ab^-1)+0,4_6per∛((a^-2b)⁄x)+0,1_6per∜(ab^-2)-0,1_6per∜(ab^-2))⁄(1,25x^-1√(ab^-1)-1,25x^-1√(ab^-1)+0,2_3per∛((a^-2b)⁄x)+0,3per⁻³√(ab^-1)-0,3per⁻³√(ab^-1))";
    const notation = photoPipeline(raw);
    expect(notation.match(/⁻³√/g)).toHaveLength(2);
    expect(notation).toContain("\\overline{3}⁻³√(ab^-1)");
    expect(analyzeExpression(notation).originalLatex.match(/\\sqrt\[-3\]/g)).toHaveLength(2);
    expect(normalizeKeyboardNotation(notation).match(/⁻³√/g)).toHaveLength(2);
  });

  it("non scambia la potenza negativa del coefficiente con l'indice della radice", () => {
    const notation = photoPipeline("(0,3per)^-3√(ab^-1)");
    expect(notation).toContain(")^-3√");
    expect(notation).not.toContain("⁻³√");
  });

  it("raggruppa insieme indice e radicale quando la radice è il numeratore", () => {
    expect(groupRadicalNumerators("⁻³√(a)⁄b")).toBe("(⁻³√(a))⁄b");
    expect(groupRadicalNumerators("⁵√(a)⁄b")).toBe("(⁵√(a))⁄b");
  });

  it("rende gli indici negativi come indici del radicale anche nel fallback grafico", () => {
    expect(appNotationToLatex("2⁻³√(ab^-1)")).toContain("\\sqrt[-3]{");
    expect(appNotationToLatex("⁻¹²√(x+1)")).toContain("\\sqrt[-12]{x+1}");
    expect(appNotationToLatex("⁵√(x)")).toContain("\\sqrt[5]{x}");
  });

  it("gli esponenti negativi delle potenze restano distinti dai radicali", () => {
    expect(photoPipeline("x⁻²+⁻³√(x)")).toBe("x^-2+⁻³√(x)");
    expect(photoPipeline("x⁻¹²+⁻³√(x)")).toBe("x^-12+⁻³√(x)");
  });

  it("se l'IA segnala un indice incerto, il punto interrogativo rimane visibile", () => {
    expect(photoPipeline("2?³√(x)")).toContain("?³√(x)");
    expect(photoPipeline("x?+1")).toBe("x?+1");
  });
});
