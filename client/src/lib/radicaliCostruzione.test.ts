/** (08/11) Radicali nel flusso di costruzione — foto utente «non funziona»:
 *  (2√3−2√2−2+√18−√12−√6)/(2[(2)²−(√6)²]). Copre il collegamento dei box
 *  (addendi zero tollerati), la valutazione esatta c·√d e la stampa LaTeX. */
import { describe, expect, it } from "vitest";
import {
  replaceExpressionStep,
  sameResultStructure,
} from "./progressiveExpression";
import {
  exactNumericEquality,
  risultatoRadicaleLatex,
} from "./numericRadicalEquality";

const RIGA0 =
  "\\dfrac{2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}}{2\\left[\\left(2\\right)^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]}";

describe("collegamento box → riga con radicali (addendi zero tollerati)", () => {
  const passi: Array<[string, string]> = [
    ["\\left(2\\right)^{2}", "4"],
    ["\\left(\\sqrt{6}\\right)^{2}", "6"],
    ["\\sqrt{18}", "3\\sqrt{2}"],
    ["\\sqrt{12}", "2\\sqrt{3}"],
    ["2\\sqrt{3}-2\\sqrt{3}", "0"],
    ["-2\\sqrt{2}+3\\sqrt{2}", "\\sqrt{2}"],
    ["2\\left[4-6\\right]", "-4"],
    ["\\dfrac{\\sqrt{2}-2-\\sqrt{6}}{-4}", "\\dfrac{\\sqrt{2}-2-\\sqrt{6}}{-4}"],
  ];

  it("tutta la catena della foto si collega senza «non riesco a collegare»", () => {
    let riga = RIGA0;
    for (const [op, an] of passi) {
      const succ = replaceExpressionStep(riga, op, an);
      expect(succ, `op ${op} non collegabile alla riga ${riga}`).not.toBeNull();
      riga = succ as string;
    }
    /* l'ultima riga è la risposta dell'ultimo box (ristampata con le sue
       parentesi): nessun residuo «0 +» e nessuna radicale da svolgere */
    expect(riga).toBe("\\dfrac{\\left(\\sqrt{2} - 2 - \\sqrt{6}\\right)}{\\left(-4\\right)}");
  });

  it("l'addendo zero sparisce dalla riga stampata", () => {
    const r1 = replaceExpressionStep(RIGA0, "\\sqrt{18}", "3\\sqrt{2}") as string;
    const r5 = replaceExpressionStep(
      replaceExpressionStep(r1, "\\sqrt{12}", "2\\sqrt{3}") as string,
      "2\\sqrt{3}-2\\sqrt{3}",
      "0",
    ) as string;
    expect(r5).toContain("0");
    const r6 = replaceExpressionStep(r5, "-2\\sqrt{2}+3\\sqrt{2}", "\\sqrt{2}") as string;
    expect(r6).not.toMatch(/0\s*[+-]/); /* niente «0 + …» dopo la raccolta */
  });

  it("il risultato finale coincide strutturalmente con l'ultima riga", () => {
    let riga = RIGA0;
    for (const [op, an] of passi) riga = replaceExpressionStep(riga, op, an) as string;
    expect(sameResultStructure(riga, "\\dfrac{\\sqrt{2}-2-\\sqrt{6}}{-4}")).toBe(true);
  });
});

describe("risultatoRadicaleLatex (valutazione esatta c·√d)", () => {
  it("trasporto fuori radice: √18 = 3√2, √12 = 2√3", () => {
    expect(risultatoRadicaleLatex("\\sqrt{18}")).toBe("3\\sqrt{2}");
    expect(risultatoRadicaleLatex("\\sqrt{12}")).toBe("2\\sqrt{3}");
  });

  it("radicali simili raccolti: il numeratore della foto vale √2−2−√6", () => {
    expect(risultatoRadicaleLatex("2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}")).toBe(
      "-2 + \\sqrt{2} - \\sqrt{6}",
    );
  });

  it("potenza del radicando: (√6)² + 1 = 7", () => {
    expect(risultatoRadicaleLatex("\\left(\\sqrt{6}\\right)^{2}+1")).toBe("7");
  });

  it("frazione completa della foto: (2−√2+√6)/4 con il meno davanti", () => {
    const r = risultatoRadicaleLatex(RIGA0);
    expect(r).toBe("\\dfrac{2 - \\sqrt{2} + \\sqrt{6}}{4}");
    /* il risultato stampato si riconduce esattamente all'operazione */
    expect(exactNumericEquality(RIGA0, r as string)).toBe(true);
  });

  it("il conto dentro il radicando si svolge, la radice resta indicata", () => {
    /* √(2+3): il radicando è un conto legittimo → √5 (radice indicata) */
    expect(risultatoRadicaleLatex("\\sqrt{2+3}")).toBe("\\sqrt{5}");
    /* le lettere restano fuori dal valutatore numerico: mai falsi positivi */
    expect(risultatoRadicaleLatex("x+\\sqrt{4}")).toBeNull();
  });
});
