import { describe, expect, it } from "vitest";
import { normalizeInput, parseExpression, analyzeExpression } from "./espressioni";
import { normalizeKeyboardNotation } from "./keyboardNotation";
import { cleanAiExpression } from "./aiClean";

describe("indici radicali fino a 99", () => {
  it("rad13 da tastiera diventa ¹³√", () => {
    expect(normalizeKeyboardNotation("rad13(8192)", false)).toContain("¹³√");
    expect(analyzeExpression(normalizeKeyboardNotation("rad13(8192)", false)).finalLatex).toBe("2");
  });
  it("rad45 e indice negativo rad-21 si scrivono", () => {
    expect(normalizeKeyboardNotation("rad45(x+1)", false)).toContain("⁴⁵√");
  });
  it("\\sqrt[13]{8} e \\sqrt[-21]{x} si leggono", () => {
    expect(() => parseExpression(normalizeInput("\\sqrt[13]{8}"))).not.toThrow();
    expect(() => parseExpression(normalizeInput("\\sqrt[-21]{x}"))).not.toThrow();
    expect(cleanAiExpression("\\sqrt[13]{8}")).toContain("¹³√(8)");
  });
  it("indice 100 e 1 restano errori chiari", () => {
    expect(() => normalizeInput("\\sqrt[100]{8}")).toThrow(/da 2 a 99/);
    expect(() => normalizeInput("\\sqrt[1]{8}")).toThrow(/indice/i);
  });
});
