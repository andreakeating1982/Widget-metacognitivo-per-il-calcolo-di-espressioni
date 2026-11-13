import { describe, expect, it } from "vitest";
import { soluzioneInFormatoCalcolatrice } from "./soluzioneCalcolatrice";
import { rationalPolyEquals } from "./espressioni";
import { stessaForma } from "../pages/EsercizioFrazioni";
import { formaDidatticaValida } from "./criteriDidattici";

describe("soluzione su una riga, digitabile da calcolatrice", () => {
  it.each([
    ["0", "0"],
    ["-3", "-3"],
    ["\\dfrac{1}{3}", "(1)/(3)"],
    ["2,5", "2.5"],
    ["0,\\overline{3}", "(1)/(3)"],
  ])("converte %s senza arrotondare", (latex, attesa) => {
    expect(soluzioneInFormatoCalcolatrice(latex)).toBe(attesa);
  });
  it.each([
    "\\dfrac{x^2+6x}{-x^2+3x+4}",
    "\\frac{x(4-x)+2x(x+1)}{(x+1)(4-x)}",
    "\\left(\\frac{3}{5}\\right)^{-2}",
    "\\frac{\\frac{1}{2}+x}{x+1}",
  ])("mantiene la struttura matematica: %s", latex => {
    const risultato = soluzioneInFormatoCalcolatrice(latex)!;
    expect(risultato).not.toMatch(/[\\{}\n]/);
    expect(rationalPolyEquals(latex, risultato)).toBe(true);
  });
  it.each([
    "\\dfrac{\\sqrt{3}}{3}+2",
    "2\\sqrt{2}",
    "\\sqrt{ab+1}+3",
    "\\sqrt{a+b+c+x}",
    "\\sqrt{\\dfrac{a+1}{b+2}}",
    "\\sqrt[-3]{\\dfrac{a+1}{b+2}}",
    "\\sqrt{\\dfrac{\\sqrt{a+1}}{b+2}}",
  ])("restituisce un radicale accettato dal box: %s", latex => {
    const risultato = soluzioneInFormatoCalcolatrice(latex)!;
    expect(risultato).not.toMatch(/[\\{}\n]/);
    expect(stessaForma("", latex, risultato)).toBe(true);
  });
  it.each([3, 4, 5, 6, 7, 12, -2, -3])("mostra la radice di indice %i in una forma accettata dal box", (indice) => {
    const attesa = `\\sqrt[${indice}]{a+1}`;
    const testo = soluzioneInFormatoCalcolatrice(attesa)!;
    expect(testo).toContain(`^(${indice < 0 ? "-" : ""}1/${Math.abs(indice)})`);
    expect(stessaForma("", attesa, testo)).toBe(true);
  });
  it("conserva l'indice negativo senza trasformarlo in indice positivo", () => {
    const risultato = soluzioneInFormatoCalcolatrice("\\sqrt[-3]{a+1}");
    expect(risultato).toContain("^(-1/3)");
    expect(stessaForma("", "\\sqrt[-3]{a+1}", risultato!)).toBe(true);
  });
  it("non confonde formule diverse con più di tre variabili", () => {
    expect(stessaForma("", "\\sqrt{a+b+c+x}", "(a+b+c+y)^(1/2)")).toBe(false);
    expect(stessaForma("", "\\sqrt{a+b+c+x}", "(a+b+c+x)^(1/2)+1")).toBe(false);
  });
  it("non accetta input sconosciuti e non restituisce una formula inventata", () => {
    expect(soluzioneInFormatoCalcolatrice("\\nonvalida{?}")).toBeNull();
  });
  it("è utilizzabile come risposta del box guidato, senza cambiare la forma didattica", () => {
    const op = "\\dfrac{ab+1}{\\sqrt{ab+1}}+3";
    const attesa = "\\sqrt{ab+1}+3";
    const scritto = soluzioneInFormatoCalcolatrice(attesa)!;
    expect(formaDidatticaValida("radicale_trasformato", scritto, op)).toBe(true);
    expect(stessaForma(op, attesa, scritto)).toBe(true);
  });
});

