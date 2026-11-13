import { describe, expect, it } from "vitest";
import katex from "katex";
import { scritturaConModuliSottintesi } from "./moduliSottintesi";
import { soluzioneInFormatoCalcolatrice } from "./soluzioneCalcolatrice";
import { evaluateNumericExpression } from "./espressioni";
import { verificaPerSostituzione } from "./verificaSostituzione";
import { conteggioPrimoColpo, rispostaCompatibileConModuliSottintesi, stessaForma } from "../pages/EsercizioFrazioni";

const S = String.raw;

describe("scrittura convenzionale dei moduli — solo nei box", () => {
  it.each([
    [S`\left|x+1\right|`, "x+1"],
    [S`|x-7|`, "x-7"],
    [S`\lvert 2a-3 \rvert`, "2a-3"],
    [S`\left\lvert x+2\right\rvert`, "x+2"],
    [S`|-8|`, "-8"],
  ])("mostra soltanto il contenuto di un intero modulo: %s", (sorgente, contenuto) => {
    const scrittura = scritturaConModuliSottintesi(sorgente);
    expect(scrittura.moduliOmissi).toBe(true);
    expect(scrittura.unSoloModuloIntero).toBe(true);
    expect(scrittura.latex.trim()).toBe(contenuto);
    expect(scrittura.latex).not.toContain("|");
    expect(katex.renderToString(scrittura.latex, {throwOnError: true})).toBeTruthy();
  });

  it.each([
    S`\dfrac{1}{3|x+1|}`,
    S`\dfrac{4\left|x+1\right|+x-1}{3(x-1)\left|x+1\right|}`,
    S`(\left|x+1\right|)^{-1}\cdot\dfrac{1}{3}`,
    S`\left|x+\left|y-2\right|\right|+|z|`,
    S`\dfrac{|x-1|}{2|x+3|}\cdot\sqrt[6]{900}`,
  ])("rimuove tutte le barre mantenendo parentesi e struttura della formula: %s", (sorgente) => {
    const risultato = scritturaConModuliSottintesi(sorgente);
    expect(risultato.moduliOmissi).toBe(true);
    expect(risultato.unSoloModuloIntero).toBe(false);
    expect(risultato.latex).not.toMatch(/\||\\(?:lvert|rvert|vert)\b/);
    expect(katex.renderToString(risultato.latex, {throwOnError: true})).toBeTruthy();
    const daDigitare = soluzioneInFormatoCalcolatrice(risultato.latex);
    expect(daDigitare).not.toBeNull();
    expect(daDigitare).not.toContain("|");
  });

  it("non cambia le formule senza moduli e non indovina su barre spaiate", () => {
    for (const testo of [S`\dfrac{x+1}{x-3}`, "|x+3", S`\left|x+2`]) {
      expect(scritturaConModuliSottintesi(testo)).toEqual({latex:testo, moduliOmissi:false, unSoloModuloIntero:false});
    }
  });

  it.each([
    [S`\left|x+1\right|`, "x+1"],
    [S`\left|x+1\right|`, "1+x"],
    [S`\left|3a-4\right|`, "3*a-4"],
    [S`\left|x-7\right|`, "x-7"],
    [S`|-8|`, "-8"],
    [S`\dfrac{1}{3|x+1|}`, "(1)/(3*(x+1))"],
    [S`\dfrac{4|x+1|+x-1}{3(x-1)|x+1|}`, "(4*(x+1)+x-1)/(3*(x-1)*(x+1))"],
  ])("accetta nel box la scrittura senza barre: %s", (attesa, scritta) => {
    expect(rispostaCompatibileConModuliSottintesi("", attesa, scritta)).toBe(true);
  });

  it.each([
    [S`|x+1|`, "x+2"],
    [S`|x+1|`, "-x-1"],
    [S`\dfrac{1}{3|x+1|}`, "(1)/(3*(x+2))"],
    [S`|-x|+|x|`, "0"],
    [S`|x+1|-|x+1|`, "2"],
  ])("respinge input errati o cancellazioni improprie: %s", (attesa, scritta) => {
    expect(rispostaCompatibileConModuliSottintesi("", attesa, scritta)).toBe(false);
  });

  it("la risposta scritta è contata al primo colpo senza cambiare l'attesa matematica", () => {
    const attesa = S`\left|x-7\right|`;
    const box = { id:"b1", op:S`\sqrt{(x-7)^{2}}`, answer:NaN, answerLatex:attesa, simbolico:true, rispostaAttesa:attesa };
    expect(conteggioPrimoColpo([box], {b1:{valore:null, testo:"x-7"}})).toEqual({primoColpo:1, totale:1});
    expect(conteggioPrimoColpo([box], {b1:{valore:null, testo:"x+7"}})).toEqual({primoColpo:0, totale:1});
    expect(box.answerLatex).toBe(attesa);
  });

  it("non degrada i calcoli: il modulo matematico resta distinto dal contenuto", () => {
    expect(evaluateNumericExpression("|-3|")).toBe(3);
    expect(evaluateNumericExpression("-3")).toBe(-3);
    expect(verificaPerSostituzione(S`\sqrt{(x+1)^2}`, S`\left|x+1\right|`)).toBe(true);
    expect(verificaPerSostituzione(S`\sqrt{(x+1)^2}`, "x+1")).toBe(false);
    expect(stessaForma("", S`\left|x+1\right|`, "x+1")).toBe(false);
  });
});

