import { describe, expect, it } from "vitest";
import { contiNumericiSaltati, individuaPassiMancanti } from "./passiMancanti";
import { replaceExpressionStep, sameExpressionStructure } from "../client/src/lib/progressiveExpression";
import { contoGiusto, riparaEsercizio } from "./costruisci";

const volta = (a: number, b: number, k: number) => {
  const den = String.raw`36\left|x-${k}\right|`;
  const num = String.raw`9\left|x-${k}\right|(x+2)`;
  const nonCalcolato = String.raw`\dfrac{${num}+${a}\cdot${b}}{${den}}`;
  const calcolato = String.raw`\dfrac{${num}+${a*b}}{${den}}`;
  const separato = String.raw`\dfrac{${num}}{${den}}+\dfrac{${a}\cdot${b}}{${den}}`;
  const riga = (s: string) => String.raw`\dfrac{\left(${s}\right)}{\sqrt[-4]{\dfrac{1}{16}}\cdot x+\sqrt[4]{(x-${k})^4}}`;
  return { nonCalcolato, calcolato, separato, riga };
};

describe("passaggi numerici mancanti in un'espressione letterale", () => {
  it.each([[4, 19, 3], [3, 11, 2], [7, 12, 5], [8, 9, 4]])(
    "aggiunge un box numerico, senza sostituire la risposta dello studente: %i × %i", (a,b,k) => {
      const v = volta(a,b,k);
      const steps = individuaPassiMancanti(v.riga(v.nonCalcolato), v.calcolato, v.calcolato);
      expect(steps).not.toBeNull();
      expect(steps!.length).toBe(1);
      expect(contoGiusto(steps![0].op, steps![0].answerLatex).ok).toBe(true);
      const after = replaceExpressionStep(v.riga(v.nonCalcolato), steps![0].op, steps![0].answerLatex);
      expect(after).not.toBeNull();
      expect(replaceExpressionStep(after!, v.calcolato, v.calcolato)).not.toBeNull();
    });

  it.each([[4, 19, 3], [3, 11, 2]])(
    "aggiunge anche il box per unire frazioni con identico denominatore: %i × %i", (a,b,k) => {
      const v = volta(a,b,k);
      const steps = individuaPassiMancanti(v.riga(v.separato), v.calcolato, v.calcolato);
      expect(steps?.length).toBe(2);
      let riga = v.riga(v.separato);
      for (const step of steps!) {
        expect(contoGiusto(step.op, step.answerLatex).ok).toBe(true);
        riga = replaceExpressionStep(riga, step.op, step.answerLatex)!;
        expect(riga).toBeTruthy();
      }
      expect(sameExpressionStructure(steps![1].answerLatex, v.calcolato)).toBe(true);
      expect(replaceExpressionStep(riga, v.calcolato, v.calcolato)).not.toBeNull();
    });

  it.each([[4,19], [3,11], [7,12]])("integra il box guidato nella costruzione completa con coefficienti %i e %i", (a,b) => {
    const calcolo = `${a}\\cdot${b}`;
    const originale = String.raw`\dfrac{x+${calcolo}}{\left|x+3\right|}`;
    const finale = String.raw`\dfrac{x+${a*b}}{\left|x+3\right|}`;
    const esito = riparaEsercizio({ espressioneLatex: originale,
      sezioni: [{ title: "PASSAGGI", boxes: [{ op: finale, answerLatex: finale, prompt: "Scrivo il risultato." }] }],
      righeProgressive: [], risultatoFinaleLatex: finale });
    expect(esito.problemi).toEqual([]);
    expect(esito.esercizio).not.toBeNull();
    const boxes = esito.esercizio!.sezioni.flatMap(s => s.boxes).filter(b => !b.condizioniEsistenza);
    expect(boxes).toHaveLength(1);
    expect(sameExpressionStructure(boxes[0].op, calcolo)).toBe(true);
    expect(boxes[0].prompt).not.toContain(String(a*b));
    expect(esito.esercizio!.righeProgressive).toHaveLength(2);
  });

  it.each([[3,8],[4,11],[7,13]])("crea il numeratore previsto riunendo frazioni già allo stesso denominatore: %i e %i", (a,b) => {
    const denominatore = String.raw`12\left|x-2\right|`;
    const primo = String.raw`${a}\left|x-2\right|(x+1)`;
    const numeratore = String.raw`${primo}+${b}`;
    const riga = String.raw`\dfrac{\dfrac{${primo}}{${denominatore}}+\dfrac{${b}}{${denominatore}}}{2x+\left|x-2\right|}`;
    const passi = individuaPassiMancanti(riga, numeratore, numeratore);
    expect(passi?.length).toBe(1);
    expect(contoGiusto(passi![0].op, passi![0].answerLatex).ok).toBe(true);
    const dopo = replaceExpressionStep(riga, passi![0].op, passi![0].answerLatex);
    expect(dopo).not.toBeNull();
    expect(replaceExpressionStep(dopo!, numeratore, numeratore)).not.toBeNull();
    expect(passi![0].prompt).not.toContain(String(b));
  });

  it("integra sia il prodotto sia l'unione delle frazioni, senza box identitari", () => {
    const originale = String.raw`\dfrac{x}{\left|x+3\right|}+\dfrac{4\cdot19}{\left|x+3\right|}`;
    const finale = String.raw`\dfrac{x+76}{\left|x+3\right|}`;
    const esito = riparaEsercizio({ espressioneLatex: originale,
      sezioni: [{ title: "PASSAGGI", boxes: [{ op: finale, answerLatex: finale }] }],
      righeProgressive: [], risultatoFinaleLatex: finale });
    expect(esito.problemi).toEqual([]);
    expect(esito.esercizio).not.toBeNull();
    const boxes = esito.esercizio!.sezioni.flatMap(s => s.boxes).filter(b => !b.condizioniEsistenza);
    expect(boxes).toHaveLength(2);
    expect(sameExpressionStructure(boxes[0].op, String.raw`4\cdot19`)).toBe(true);
    expect(sameExpressionStructure(boxes[1].op, boxes[1].answerLatex)).toBe(false);
    expect(esito.esercizio!.righeProgressive).toHaveLength(3);
  });

  it("ricostruisce due conti consecutivi invece di saltare l'intero denominatore", () => {
    const riga = String.raw`\dfrac{\sqrt{2}-2-\sqrt{6}}{2\cdot\left[4-6\right]}`;
    const op = String.raw`\dfrac{\sqrt{2}-2-\sqrt{6}}{-4}`;
    const steps = individuaPassiMancanti(riga, op, op);
    expect(steps?.length).toBe(2);
    let successiva = riga;
    for (const step of steps!) {
      expect(contoGiusto(step.op, step.answerLatex).ok).toBe(true);
      successiva = replaceExpressionStep(successiva, step.op, step.answerLatex)!;
      expect(successiva).toBeTruthy();
    }
    expect(replaceExpressionStep(successiva, op, op)).not.toBeNull();
  });

  it.each([
    [2, 18, 1], [3, 27, 3], [4, 16, 2], [5, 32, 2], [7, 128, 2], [13, 8192, 2],
  ])("recupera la radice perfetta non svolta nella frazione, indice %i", (indice, radicando, risultato) => {
    const radice = indice === 2 ? String.raw`\sqrt{${radicando}}` : String.raw`\sqrt[${indice}]{${radicando}}`;
    const uno = indice === 2 ? String.raw`\sqrt{1}` : String.raw`\sqrt[${indice}]{1}`;
    const riga = String.raw`\dfrac{x+1}{\dfrac{1}{\dfrac{${uno}}{${radice}}}\cdot x+\left|x-2\right|}`;
    const op = String.raw`\dfrac{1}{\dfrac{1}{${radice}}}`;
    const passi = individuaPassiMancanti(riga, op, radice);
    expect(passi?.length).toBe(1);
    expect(sameExpressionStructure(passi![0].op, uno)).toBe(true);
    expect(contoGiusto(passi![0].op, passi![0].answerLatex).ok).toBe(true);
    const dopo = replaceExpressionStep(riga, passi![0].op, passi![0].answerLatex);
    expect(dopo).not.toBeNull();
    expect(replaceExpressionStep(dopo!, op, radice)).not.toBeNull();
    if (indice !== 2) {
      const piuSemplice = String.raw`\dfrac{1}{\dfrac{1}{${risultato}}}`;
      const ponte2 = individuaPassiMancanti(dopo!, piuSemplice, String(risultato));
      expect(ponte2?.length).toBe(1);
      expect(contoGiusto(ponte2![0].op, ponte2![0].answerLatex).ok).toBe(true);
    }
  });

  it("il costruttore aggiunge il box della radice di uno e poi collega il reciproco", () => {
    const originale = String.raw`\dfrac{x+1}{\dfrac{1}{\dfrac{\sqrt{1}}{\sqrt{9}}}+\left|x-2\right|}`;
    const finale = String.raw`\dfrac{x+1}{3+\left|x-2\right|}`;
    const esito = riparaEsercizio({ espressioneLatex: originale,
      sezioni: [{ title: "PASSAGGI", boxes: [
        { op: String.raw`\dfrac{1}{\dfrac{1}{\sqrt{9}}}`, answerLatex: String.raw`\sqrt{9}` },
        { op: String.raw`\sqrt{9}`, answerLatex: "3" },
      ] }], righeProgressive: [], risultatoFinaleLatex: finale });
    expect(esito.problemi).toEqual([]);
    expect(esito.esercizio).not.toBeNull();
    const boxes = esito.esercizio!.sezioni.flatMap(s => s.boxes).filter(b => !b.condizioniEsistenza);
    expect(boxes).toHaveLength(3);
    expect(sameExpressionStructure(boxes[0].op, String.raw`\sqrt{1}`)).toBe(true);
    expect(boxes.every(b => contoGiusto(b.op, b.answerLatex).ok)).toBe(true);
    expect(boxes[0].prompt).not.toContain("1");
  });

  it("non scambia una riscrittura equivalente per un calcolo già svolto", () => {
    expect(contiNumericiSaltati(String.raw`\dfrac{x+4\cdot19}{\left|x+3\right|}`, String.raw`\dfrac{x+76}{\left|x+3\right|}`)).toBe(true);
    expect(contiNumericiSaltati(String.raw`\dfrac{x+4\cdot19}{\left|x+3\right|}`, String.raw`\dfrac{4\cdot19+x}{\left|x+3\right|}`)).toBe(false);
  });

  it("non unisce frazioni con denominatori differenti", () => {
    const attuale = String.raw`\dfrac{x+1}{x-2}+\dfrac{2}{x+2}`;
    const errato = String.raw`\dfrac{x+3}{x-2}`;
    expect(individuaPassiMancanti(attuale, errato, errato)).toBeNull();
  });

  it("non inventa un collegamento quando il risultato scritto non è quello numerico", () => {
    const v = volta(4,19,3);
    const sbagliato = v.calcolato.replace("76", "77");
    expect(individuaPassiMancanti(v.riga(v.nonCalcolato), sbagliato, sbagliato)).toBeNull();
  });
});

