import { describe, expect, it } from "vitest";
import { uguaglianzaRazionaleConAtomi, sommaFrazioniConAtomi } from "./frazioniConAtomi";
import { evaluateNumericExpression } from "./espressioni";
import { sostituisciLettere } from "./verificaSostituzione";

describe("frazioni con moduli e radicali trattati come fattori", () => {
  it.each([
    String.raw`\dfrac{x+1}{2}+\dfrac{4}{3\left|x-2\right|}`,
    String.raw`\dfrac{2x-3}{5}-\dfrac{7}{4\left|x+1\right|}`,
    String.raw`\dfrac{x+5}{3\sqrt{2}}+\dfrac{1}{4\left|x-8\right|}`,
    String.raw`\dfrac{x+1}{7}+\dfrac{3}{2\sqrt[7]{x+4}}`,
    String.raw`\dfrac{2}{x-1}+\dfrac{x+4}{\left|x+3\right|}`,
    String.raw`x+\dfrac{5}{2\left|x+9\right|}`,
  ])("costruisce la somma senza dimenticare fattori: %s", (op) => {
    const answer = sommaFrazioniConAtomi(op);
    expect(answer).not.toBeNull();
    expect(uguaglianzaRazionaleConAtomi(op, answer!)).toBe(true);
    let campioni = 0;
    for (const x of [-13, -7, -2, 0, 1, 3, 7, 13]) {
      const v = (s: string) => evaluateNumericExpression(sostituisciLettere(s, {x}));
      const a = v(op), b = v(answer!);
      if (a === null || b === null) continue;
      expect(b).toBeCloseTo(a, 9);
      campioni++;
    }
    expect(campioni).toBeGreaterThanOrEqual(3);
  });

  it("non dimostra una somma che ha perso un fattore assoluto", () => {
    const op = String.raw`\dfrac{x+1}{2}+\dfrac{4}{3\left|x-2\right|}`;
    const errata = String.raw`\dfrac{3(x+1)+8}{6\left|x-2\right|}`;
    expect(uguaglianzaRazionaleConAtomi(op, errata)).toBeNull();
  });

  it.each([
    String.raw`\dfrac{9}{12}\left(x-2\right)+\dfrac{8}{12\left|x+1\right|}`,
    String.raw`\dfrac{2}{5}\left(3x+1\right)-\dfrac{7}{4\left|x-2\right|}`,
    String.raw`\dfrac{2x}{3}\cdot\dfrac{5}{7}+\dfrac{1}{\left|x+4\right|}`,
  ])("individua le frazioni anche nei prodotti senza aggiungere fattori: %s", (op) => {
    const answer = sommaFrazioniConAtomi(op);
    expect(answer).not.toBeNull();
    expect(uguaglianzaRazionaleConAtomi(op, answer!)).toBe(true);
    const formula = answer!;
    // Il risultato è UNA frazione: non lascia un coefficiente frazionario
    // annidato al numeratore come faceva il riconoscimento precedente.
    expect((formula.match(/\\dfrac/g) ?? []).length).toBe(1);
  });

  it("non considera identici moduli o radicali diversi", () => {
    expect(uguaglianzaRazionaleConAtomi(String.raw`\left|x-2\right|`, String.raw`\left|x+2\right|`)).toBeNull();
    expect(uguaglianzaRazionaleConAtomi(String.raw`\sqrt{2}`, String.raw`\sqrt{3}`)).toBeNull();
  });

  it("non confonde una lettera già presente con un simbolo temporaneo", () => {
    const op = String.raw`\dfrac{q+w}{3}+\dfrac{t}{2\left|u-v\right|}`;
    const answer = sommaFrazioniConAtomi(op);
    expect(answer).not.toBeNull();
    expect(uguaglianzaRazionaleConAtomi(op, answer!)).toBe(true);
  });

  it("non produce una correzione per prodotti che non sono somme", () => {
    expect(sommaFrazioniConAtomi(String.raw`\dfrac{x}{2}\cdot\dfrac{1}{3}`)).toBeNull();
  });
});

