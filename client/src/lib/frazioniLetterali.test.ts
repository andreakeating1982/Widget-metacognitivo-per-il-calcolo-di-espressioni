/* (7/11) FRAZIONI CON LETTERE NELLE RISPOSTE — confronto tra quozienti di
   polinomi. Segnalazione utente: per x/(x+1) + 2x/(4-x) il risultato
   (6x+x²)/(−x²+3x+4) veniva rifiutato nel box in ogni forma (non è un
   polinomio, non è un numero e la sostituzione non divide espressioni
   letterali). rationalPolyEquals confronta con il prodotto incrociato:
   NUM_A·DEN_B = NUM_B·DEN_A, così anche l'ordine dei termini e il
   denominatore ancora da svolgere sono forme equivalenti accettate.
   Filosofia DSA: il confronto è interno, non mostra mai la soluzione. */
import { describe, expect, it } from "vitest";
import { rationalPolyEquals } from "./espressioni";

const OP = "x/(x+1) + 2x/(4-x)";
const ATTESA = "\\dfrac{6x + x^2}{-x^2 + 3x + 4}";
const ATTESA_ORDINE_INVERSO = "\\dfrac{x^2 + 6x}{-x^2 + 3x + 4}";
const ATTESA_DA_SVOLGERE = "\\frac{x(4-x)+2x(x+1)}{(x+1)(4-x)}";

describe("rationalPolyEquals — frazioni con lettere (7/11)", () => {
  it("accetta il caso segnalato: stessa frazione scritta dallo studente", () => {
    expect(rationalPolyEquals(ATTESA, "(6x + x^2)/(-x^2 + 3x + 4)")).toBe(true);
    expect(rationalPolyEquals(ATTESA, "(6x+x^2)/(-x^2+3x+4)")).toBe(true);
  });

  it("accetta l'ordine dei termini invertito, numeratore e denominatore", () => {
    expect(rationalPolyEquals(ATTESA, "(x^2 + 6x)/(-x^2 + 3x + 4)")).toBe(true);
    expect(rationalPolyEquals(ATTESA_ORDINE_INVERSO, "(6x + x^2)/(3x + 4 - x^2)")).toBe(true);
  });

  it("accetta il denominatore ancora da svolgere (prodotto dei due denominatori)", () => {
    expect(rationalPolyEquals(ATTESA, "(x^2 + 6x)/((x+1)(4-x))")).toBe(true);
    expect(rationalPolyEquals(ATTESA_DA_SVOLGERE, "(x^2 + 6x)/(-x^2 + 3x + 4)")).toBe(true);
  });

  it("accetta la frazione scritta col segno di divisione dell'app (due punti)", () => {
    expect(rationalPolyEquals(ATTESA, "(x^2+6x):(-x^2+3x+4)")).toBe(true);
  });

  it("accetta la forma semplificata del caso segnalato dall'utente", () => {
    // 6x + x² tutto al numeratore, denominatore svolto: la scrittura esatta
    // del messaggio dell'utente, confrontata con la stessa attesa dell'IA
    expect(rationalPolyEquals(ATTESA_ORDINE_INVERSO, "(6x + x^2)/(-x^2 + 3x + 4)")).toBe(true);
  });

  it("rifiuta un numeratore sbagliato (falso conto resta falso)", () => {
    expect(rationalPolyEquals(ATTESA, "(x^2 + 5x)/(-x^2 + 3x + 4)")).toBe(false);
    expect(rationalPolyEquals(ATTESA, "(x^2 + 6x)/(x^2 + 3x + 4)")).toBe(false);
  });

  it("rifiuta la scrittura SENZA parentesi: cambia il valore matematico", () => {
    // «6x + x^2/-x^2 + 3x + 4» vale 6x + (x²/(−x²)) + 3x + 4: NON è la frazione
    expect(rationalPolyEquals(ATTESA, "6x + x^2/-x^2 + 3x + 4")).toBe(false);
  });

  it("rifiuta un polinomio semplice al posto della frazione", () => {
    expect(rationalPolyEquals(ATTESA, "x^2 + 6x")).toBe(false);
    expect(rationalPolyEquals(ATTESA, "-x^2 + 3x + 4")).toBe(false);
  });

  it("accetta polinomi semplici equivalenti (denominatore implicito 1)", () => {
    expect(rationalPolyEquals("3x + 2", "2 + 3x")).toBe(true);
    expect(rationalPolyEquals("3x + 2", "3x + 3")).toBe(false);
  });

  it("restituisce null con radici o scritture non valutabili (percorsi esistenti invariati)", () => {
    expect(rationalPolyEquals("\\dfrac{\\sqrt{x}}{2}", "(x^2+6x)/(-x^2+3x+4)")).toBe(null);
    expect(rationalPolyEquals(ATTESA, "")).toBe(null);
    expect(rationalPolyEquals(ATTESA, "(((")).toBe(null);
  });

  it("rifiuta denominatori nulli scritti dallo studente", () => {
    expect(rationalPolyEquals(ATTESA, "(x^2 + 6x)/0")).toBe(false);
  });

  it("accetta anche l'espressione intera, somma di frazioni equivalenti", () => {
    // La verifica ricorsiva considera somme e frazioni annidate, non solo
    // un quoziente scritto in cima all'albero.
    expect(rationalPolyEquals(OP, ATTESA)).toBe(true);
  });
});
