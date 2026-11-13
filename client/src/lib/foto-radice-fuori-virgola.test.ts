import { describe, expect, it } from "vitest";
import { normalizeInput, parseExpression, printLatex, evaluateNumericExpression } from "./espressioni";
import { replaceExpressionStep, sameSourceStructure, sameExpressionStructure, sameResultStructure, haContoPendente } from "./progressiveExpression";
import { appNotationToLatex, uniformaVirgoleDecimaliLatex } from "./appNotationLatex";
import { normalizeExpressionOcr } from "./exprOcr";
import { cleanAiExpression } from "./aiClean";
import { sostituisciLettere } from "./verificaSostituzione";

const src = String.raw`(∛(x^3+3x^2+3x+1)*0,5+(√(x^2-4x+4))^-1*1,\overline{3})⁄(⁻²√(0,0\overline{5})*x+∜(x^4-8x^3+24x^2-32x+16))`;
const stampa = (s: string) => printLatex(parseExpression(normalizeInput(s, true)));

describe("foto del 12/11: radicale al denominatore e virgole", () => {
  it.each([-13, -5, -2, 2, 3, 4, 7, 13])("la radice con indice %i non assorbe un fattore esterno neppure dopo stampa e lettura", (indice) => {
    const expr = `\\sqrt[${indice}]{9}\\cdot x+1`;
    const rendered = stampa(expr);
    const original = evaluateNumericExpression(sostituisciLettere(expr, { x: 4 }));
    const after = evaluateNumericExpression(sostituisciLettere(rendered, { x: 4 }));
    expect(original).not.toBeNull();
    expect(after).toBeCloseTo(original!, 10);
    expect(sameSourceStructure(expr, rendered)).toBe(true);
  });

  it("un radicando esplicitamente chiuso resta distinto dalla lettera giustapposta", () => {
    const espressione = String.raw`\sqrt[-2]{9}x`;
    expect(evaluateNumericExpression(sostituisciLettere(espressione, { x: 4 }))).toBeCloseTo(4/3);
  });

  it("la convenzione √9x² senza delimitatori continua a includere la lettera", () => {
    expect(sameSourceStructure("√9x^2", "√(9x^2)")).toBe(true);
  });

  it("collega i passaggi reali al fattore esterno senza modificare il radicando", () => {
    const printed = stampa(src);
    expect(sameSourceStructure(src, printed)).toBe(true);
    const first = replaceExpressionStep(src, String.raw`0,0\overline{5}`, String.raw`\dfrac{1}{18}`);
    expect(first).not.toBeNull();
    const next = replaceExpressionStep(first!, String.raw`\sqrt[-2]{\dfrac{1}{18}}\cdot x`, String.raw`3\sqrt{2}\cdot x`);
    expect(next).not.toBeNull();
    let verificati = 0;
    for (const x of [-13, -4, -0.5, 0, 1, 3, 4, 9]) {
      const valore = (espressione: string) => evaluateNumericExpression(sostituisciLettere(espressione, {x}));
      const iniziale = valore(src), intermedio = valore(first!), finale = valore(next!);
      if (iniziale === null || intermedio === null || finale === null) continue;
      expect(intermedio).toBeCloseTo(iniziale, 8);
      expect(finale).toBeCloseTo(iniziale, 8);
      verificati++;
    }
    expect(verificati).toBeGreaterThanOrEqual(3);
  });

  it.each([0, 1, 3, -2, -13])("la giustapposizione lettera-numero conserva il prodotto dopo la sostituzione, x=%i", (x) => {
    const espressione = String.raw`x2+3(2x)`;
    const sostituita = sostituisciLettere(espressione, { x });
    expect(evaluateNumericExpression(sostituita)).toBe(8*x);
  });

  it("stampa esplicitamente il prodotto prima di un fattore composto che inizia con una cifra", () => {
    const n = parseExpression(normalizeInput(String.raw`x\cdot(2\left|x+9\right|)`, true));
    const latex = printLatex(n);
    for (const x of [0, 1, 3, -2]) {
      expect(evaluateNumericExpression(sostituisciLettere(latex, { x }))).toBe(2*x*Math.abs(x+9));
    }
  });

  it("distingue valori assoluti con contenuti differenti e non li scambia", () => {
    const uno = String.raw`\left|x-2\right|`;
    const altro = String.raw`\left|x+2\right|`;
    expect(sameExpressionStructure(uno, altro)).toBe(false);
    expect(sameSourceStructure(uno, altro)).toBe(false);
    expect(sameResultStructure(uno, altro)).toBe(false);
    expect(replaceExpressionStep(uno, altro, "9")).toBeNull();
    expect(sameSourceStructure(uno, String.raw`\left|x-2\right|`)).toBe(true);
  });

  it("un calcolo dentro il modulo si collega senza togliere le barre", () => {
    const risultato = replaceExpressionStep(String.raw`\left|x+2+3\right|`, "2+3", "5");
    expect(risultato).not.toBeNull();
    expect(sameSourceStructure(risultato!, String.raw`\left|x+5\right|`)).toBe(true);
    expect(sameSourceStructure(risultato!, "x+5")).toBe(false);
    expect(haContoPendente(String.raw`\left|x+2+3\right|`)).toBe(true);
  });

  it("OCR mantiene la virgola sia dei decimali ordinari sia dei periodici", () => {
    const out = normalizeExpressionOcr(cleanAiExpression(src), true, { keepDivision: true });
    expect(out).toContain("0,5");
    expect(out).toContain(String.raw`1,\overline{3}`);
    expect(out).toContain(String.raw`0,0\overline{5}`);
    expect(out).not.toContain("0.5");
  });

  it("uniforma le virgole anche nello svolgimento e nel PDF senza cambiare le frazioni", () => {
    const latex = uniformaVirgoleDecimaliLatex(String.raw`0.5+1,\overline{3}+0,0\overline{5}+\dfrac{1}{2}`);
    expect(latex).toBe(String.raw`0{,}5+1{,}\overline{3}+0{,}0\overline{5}+\dfrac{1}{2}`);
    expect(uniformaVirgoleDecimaliLatex(latex)).toBe(latex);
  });

  it("fallback grafico mostra la stessa virgola italiana nei decimali", () => {
    const latex = appNotationToLatex(String.raw`(0.5+1,\overline{3})⁄(⁻²√(0,0\overline{5})*x)`);
    expect(latex).toContain("0{,}5");
    expect(latex).not.toContain("0.5");
    expect(latex).toContain(String.raw`\overline{3}`);
    expect(latex).toContain(String.raw`\overline{5}`);
  });
});

