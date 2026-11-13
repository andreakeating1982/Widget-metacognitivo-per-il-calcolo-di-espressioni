import { describe, expect, it } from "vitest";
import { stessaForma } from "./EsercizioFrazioni";

describe("audit: verifica delle risposte dello studente", () => {
  it.each([
    ["(6x+x^2)/(-x^2+3x+4)", "(x^2+6x)/((x+1)(4-x))"],
    ["1/(x+1)+1/(x-1)", "2x/(x^2-1)"],
    ["(x+y)^2", "x^2+2xy+y^2"],
    ["x^-2", "1/x^2"],
    ["\\sqrt{8}", "2rad2(2)"],
    ["\\sqrt[3]{-8}", "-2"],
    ["\\sqrt{x^4}", "x^2"],
    ["2\\sqrt{15}+\\sqrt{15}", "3rad2(15)"],
    ["2\\sqrt[3]{2}", "rad3(16)"],
    ["0", "x-x"],
  ])("accetta risposte equivalenti %s e %s", (attesa, testo) => {
    expect(stessaForma("x+2",attesa,testo)).toBe(true);
  });
  it.each([
    /* (08/11, foto no.png) le risposte REALI dei 6 box di √((a²−1)/3):(3a+3),
       digitate con le regole di trascrizione della pagina due */
    ["(a-1)(a+1)", "(a-1)(a+1)"],
    ["3(a+1)", "3(a+1)"],
    ["\\dfrac{\\sqrt{(a-1)(a+1)}}{\\sqrt{3}}", "√((a-1)(a+1))/√3"],
    ["\\dfrac{\\sqrt{(a-1)(a+1)}}{\\sqrt{3}}", "(√((a-1)(a+1)))/√3"],
    ["\\sqrt{a-1}\\cdot\\sqrt{a+1}", "√(a-1)·√(a+1)"],
    ["\\dfrac{\\sqrt{a-1}}{3\\sqrt{3}\\sqrt{a+1}}", "√(a-1)/(3·√3·√(a+1))"],
    ["\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}", "√(3(a^2-1))/(9(a+1))"],
  ])("box radicali-letterali: accetta %s ↔ %s", (attesa, testo) => {
    expect(stessaForma("x+2", attesa, testo)).toBe(true);
  });
  it.each([
    ["x", "2"], ["x+y", "x+y+(x-2)(y-3)"],
    ["x", "x/0"], ["1", "1/0"],
    ["\\sqrt{x^2}", "x"], ["\\sqrt{8}", "3rad2(2)"],
    ["\\sqrt{2}", "1,414213562"], ["\\sqrt[3]{2}", "1,2599210499"],
    ["2", "2abc"], ["2", "2+"],
  ])("non accetta %s e %s se non equivalenti", (attesa, testo) => {
    expect(stessaForma("x+y",attesa,testo)).toBe(false);
  });
});

