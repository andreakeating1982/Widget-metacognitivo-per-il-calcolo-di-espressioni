import { describe, it, expect } from "vitest";
import { normalizeInput, parseExpression, printLatex } from "./espressioni";

/* (27/10, collaudo) La trascrizione NON converte i decimali in frazione:
   la conversione la fa lo studente (box «DECIMALI IN FRAZIONE»). */
const stampa = (s: string) => printLatex(parseExpression(normalizeInput(s)));

describe("trascrizione fedele dei decimali", () => {
  it("2,5·3 − 1/2 conserva 2,5", () => {
    const l = stampa("2,5*3-1/2");
    expect(l).toContain("2{,}5");
    expect(l).not.toContain("\\dfrac{5}{2}");
  });
  it("0,25 e 1,2 restano decimali", () => {
    expect(stampa("0,25+1,2")).toContain("0{,}25");
    expect(stampa("0,25+1,2")).toContain("1{,}2");
  });
  it("la forma LaTeX 2{,}5 si rilegge come 2,5", () => {
    expect(stampa("2{,}5+1")).toContain("2{,}5");
  });
});
