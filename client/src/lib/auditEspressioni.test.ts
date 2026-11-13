import { describe, expect, it } from "vitest";
import {
  evalPoly, normalizeInput, parseExpression, polyToLatex,
  rationalPolyEquals, evaluateNumericExpression,
} from "./espressioni";
import { evalRat } from "./fratte";
import { contoGiusto, riparaEsercizio } from "../../../server/costruisci";

const ast = (s: string) => parseExpression(normalizeInput(s));
const ratString = (s: string) => {
  const r = evalRat(ast(s));
  return `${polyToLatex(r.num)}/${r.den.length ? polyToLatex(r.den) : "1"}`;
};

describe("audit: decimali esatti, potenze e condizioni di esistenza", () => {
  it.each([
    ["0,1+0,2", "\\dfrac{3}{10}"],
    ["0,25+1,2", "\\dfrac{29}{20}"],
    ["1,05-0,05", "1"],
    ["0,001*1000", "1"],
  ])("%s conserva l'aritmetica esatta", (src, expected) => {
    expect(polyToLatex(evalPoly(ast(src)))).toBe(expected);
  });
  it.each(["1/0", "x/(x-x)", "0^-1", "(x-x)^-1"])("%s non è definita", (src) => {
    expect(() => evalPoly(ast(src))).toThrow(/zero/i);
  });
  it.each(["1/0", "x/(x-x)", "0^-1", "(x-x)^-1"])("evalRat rifiuta %s", (src) => {
    expect(() => evalRat(ast(src))).toThrow(/zero/i);
  });
  it.each(["5^0", "x^0", "x^{0}", "(x+1)^(0)", "(x+1)^0", "(1/(x+1))^0"])("%s = 1 con base definita e non nulla", (src) => {
    expect(ratString(src)).toBe("1/1");
  });
  it("il denominatore nullo non viene mai considerato unitario", () => {
    expect(rationalPolyEquals("1/0", "1")).toBe(false);
    expect(rationalPolyEquals("x/(x-x)", "x")).toBe(false);
    expect(rationalPolyEquals("(x-x)/(x-x)", "0")).toBe(false);
  });
});

describe("audit: equivalenze razionali esatte senza sostituzione occasionale", () => {
  it.each([
    ["x/(x+1)+2x/(4-x)", "(x^2+6x)/(-x^2+3x+4)"],
    ["1/(x+1)+1/(x-1)", "2x/(x^2-1)"],
    ["(x+y)/(x-y)", "(2x+2y)/(2x-2y)"],
    ["(x^2-1)/(x-1)", "x+1"],
    ["1/(1/(x+1))", "x+1"],
    ["(x+1)/(x-1)-(x-1)/(x+1)", "4x/(x^2-1)"],
    ["(x+y)^2", "x^2+2xy+y^2"],
    ["x^-2", "1/x^2"],
    ["0,1+0,2", "3/10"],
    ["x-x", "0"],
  ])("accetta %s ≡ %s", (a,b) => {
    expect(rationalPolyEquals(a,b)).toBe(true);
    expect(contoGiusto(a,b).ok).toBe(true);
  });
  it.each([
    ["x", "2"],
    ["x+1", "3"],
    ["x^2", "4"],
    ["x+y", "5"],
    ["x+y", "x+y+(x-2)(y-3)"],
    ["(x+y)/(x-y)", "(2x+2y)/(2x+2y)"],
    ["1/(x+1)+1/(x-1)", "(2x+1)/(x^2-1)"],
  ])("respinge %s ≠ %s anche se coincide in un punto", (a,b) => {
    expect(rationalPolyEquals(a,b)).toBe(false);
    expect(contoGiusto(a,b).ok).toBe(false);
  });
  it.each([
    ["1/0", "1"], ["x/(x-x)", "x"], ["(x-x)/(x-x)", "0"], ["0^-1", "1"],
  ])("non convalida il non-definito %s = %s", (a,b) => {
    expect(contoGiusto(a,b).ok).toBe(false);
  });
});

describe("audit: calcolo numerico e radici con parsing completo", () => {
  it.each([
    ["2+3*4", 14], ["(2+3)*4",20], ["0,1+0,2", 0.3],
    ["-2^2", -4], ["(-2)^2",4], ["(1/3)^-2",9],
    ["2¹⁰",1024], ["\\frac{2}{3}^{2}",4/9],
    ["√9+2", 5], ["3rad2(15)", 3*Math.sqrt(15)],
    ["∛(-8)", -2], ["\\sqrt[3]{-8}", -2],
    ["\\sqrt{\\dfrac{3}{4}\\cdot8}", Math.sqrt(6)],
    ["\\frac{1}{2}+2", 2.5],
  ])("%s si valuta correttamente", (s, expected) => {
    expect(evaluateNumericExpression(s)).toBeCloseTo(expected, 11);
  });
  it.each(["1/0", "0^-1", "√(-9)", "2garbage", "2+", "1/0+2", "1/2=4", "[2+3)", "{1+2]"])("%s viene rifiutato", (s) => {
    expect(evaluateNumericExpression(s)).toBeNull();
  });
  it("forme irrazionali numeriche equivalenti sono accettate senza approssimare", () => {
    expect(contoGiusto("\\sqrt{8}", "2\\sqrt{2}").ok).toBe(true);
    expect(contoGiusto("2\\sqrt{15}+\\sqrt{15}", "3\\sqrt{15}").ok).toBe(true);
    expect(contoGiusto("\\sqrt[3]{16}", "2\\sqrt[3]{2}").ok).toBe(true);
    expect(contoGiusto("\\sqrt{8}", "3\\sqrt{2}").ok).toBe(false);
    expect(contoGiusto("\\sqrt{2}", "1,414213562").ok).toBe(false);
  });
  /* Senza condizioni esplicite non si può assumere x positivo. */
  it("√x² richiede il modulo; √x⁴ e ∛x³ mantengono le forme equivalenti", () => {
    expect(contoGiusto("\\sqrt{x^2}", "x").ok).toBe(false);
    expect(contoGiusto("\\sqrt{x^2}", "|x|").ok).toBe(true);
    expect(contoGiusto("\\sqrt{x^2}", "-x").ok).toBe(false);
    expect(contoGiusto("\\sqrt{x^4}", "x^2").ok).toBe(true);
    expect(contoGiusto("\\sqrt[3]{x^3}", "x").ok).toBe(true);
  });
});

describe("audit: risposta IA sbagliata e non riparabile", () => {
  it("non consegna come corretta una risposta riconosciuta sbagliata dal motore", () => {
    const fake = {
      espressioneLatex: "\\sqrt{2}",
      sezioni: [{ title: "RADICE", boxes: [{ op: "\\sqrt{2}", prompt: "Trovo la radice.", answerLatex: "1" }] }],
      righeProgressive: ["\\sqrt{2}", "1"], risultatoFinaleLatex: "1",
    };
    const out = riparaEsercizio(fake);
    expect(out.esercizio).toBeNull();
    expect(out.problemi.length).toBeGreaterThan(0);
  });
});

