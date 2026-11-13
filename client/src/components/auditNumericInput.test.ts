import { describe, expect, it } from "vitest";
import { evaluateLatex, normalizeTypedValueNotation } from "./NumberInputCanvas";

describe("audit: campo risposta, tutto il testo conta", () => {
  it.each([
    ["1+2",3], ["(1+2)^2",9], ["(1/3)^-2",9],
    ["\\frac{1}{2}+2",2.5], ["\\sqrt{9}+2",5],
    ["∛(-8)",-2], ["√(9)+2",5], ["2*(3+4)",14],
    ["3rad2(15)",3*Math.sqrt(15)],
  ])("%s produce il valore completo", (s,expected) => {
    expect(evaluateLatex(normalizeTypedValueNotation(s))).toBeCloseTo(expected,11);
  });
  it.each(["2+", "2garbage", "1/0", "1/0+2", "2*(3)"])("la valutazione di %s non inventa valori", (s) => {
    const val = evaluateLatex(normalizeTypedValueNotation(s));
    if(s === "2*(3)") expect(val).toBe(6);
    else expect(val).toBeNull();
  });
});

