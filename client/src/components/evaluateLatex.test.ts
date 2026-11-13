import { describe, it, expect } from "vitest";
import { evaluateLatex } from "./NumberInputCanvas";

/** (25/10, richiesta utente) RISULTATI MULTIPLI EQUIVALENTI: la verifica è
 *  a VALORE, non alla forma — per (1/3)^-4 : (1/3)^-2 l'app accetta 9,
 *  3^2, (1/3)^-2 (tutti valutano 9). Copre anche gli esponenti tra graffe
 *  del riconoscimento a mano (3^{2}) e l'esponente dopo la frazione
 *  impilata (\frac{1}{3}^{-2}). */
describe("evaluateLatex: più risultati validi equivalenti a valore", () => {
  it("9 = 3^2 = 3^{2} = (1/3)^-2 = \\frac{1}{3}^{-2} = \\left(\\frac{1}{3}\\right)^{-2}", () => {
    // confronto con arrotondamento come fa l'app (Math.round(v*100))
    const eq = (v: number | null, x: number) => v !== null && Math.round(v * 100) === Math.round(x * 100);
    expect(eq(evaluateLatex("9"), 9)).toBe(true);
    expect(eq(evaluateLatex("3^2"), 9)).toBe(true);
    expect(eq(evaluateLatex("3^{2}"), 9)).toBe(true);
    expect(eq(evaluateLatex("(1/3)^-2"), 9)).toBe(true);
    expect(eq(evaluateLatex("\\frac{1}{3}^{-2}"), 9)).toBe(true);
    expect(eq(evaluateLatex("\\left(\\frac{1}{3}\\right)^{-2}"), 9)).toBe(true);
  });

  it("valutazioni di base restano corrette", () => {
    expect(evaluateLatex("2^3")).toBe(8);
    expect(evaluateLatex("2^{3}")).toBe(8);
    expect(evaluateLatex("\\frac{3}{4}")).toBe(0.75);
    expect(evaluateLatex("1+2")).toBe(3);
    expect(evaluateLatex("(1+2)^2")).toBe(9);
    expect(evaluateLatex("-2^2")).toBe(-4);
  });
});
