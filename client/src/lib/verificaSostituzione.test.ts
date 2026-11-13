import { describe, expect, it } from "vitest";
import {
  lettereLibere,
  sostituisciLettere,
  verificaPerSostituzione,
} from "./verificaSostituzione";

/* (08/11, foto no.png) I box dell'esercizio √((a²−1)/3):(3a+3) hanno tutte
   risposte con RADICI E LETTERE: prima della verifica a sostituzione il
   client le bocciava tutte («RISULTATO SBAGLIATO» su una risposta giusta). */
describe("verificaPerSostituzione: radicali con lettere (foto no.png)", () => {
  it.each([
    // box 3 — proprietà del quoziente dei radicali
    [
      "\\dfrac{\\sqrt{(a-1)(a+1)}}{\\sqrt{3}}",
      "√((a-1)(a+1))/√3",
    ],
    // la stessa con la radice del numeratore racchiusa fra parentesi
    [
      "\\dfrac{\\sqrt{(a-1)(a+1)}}{\\sqrt{3}}",
      "(√((a-1)(a+1)))/√3",
    ],
    // box 4 — proprietà del prodotto dei radicali
    [
      "\\sqrt{a-1}\\cdot\\sqrt{a+1}",
      "√(a-1)·√(a+1)",
    ],
    // box 5 — semplificazione in croce dei radicali
    [
      "\\dfrac{\\sqrt{a-1}}{3\\sqrt{3}\\sqrt{a+1}}",
      "√(a-1)/(3·√3·√(a+1))",
    ],
    // box 6 — risultato finale razionalizzato
    [
      "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}",
      "√(3(a^2-1))/(9(a+1))",
    ],
    // la frazione impilata scritta come frazione di frazioni
    [
      "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}",
      "√(3a^2-3)/(9a+9)",
    ],
  ])("accetta le forme equivalenti %s ↔ %s", (attesa, scritta) => {
    expect(verificaPerSostituzione(attesa, scritta)).toBe(true);
  });

  it("boccia √(x²) = x sui campioni negativi (regola del modulo)", () => {
    expect(verificaPerSostituzione("\\sqrt{x^{2}}", "x")).toBe(false);
  });

  it("boccia risposte davvero diverse (√(a²−1) ≠ a−1)", () => {
    expect(verificaPerSostituzione("\\sqrt{a^{2}-1}", "a-1")).toBe(false);
  });

  it("non decide con meno di 3 campioni validi (radicando sempre negativo)", () => {
    expect(verificaPerSostituzione("\\sqrt{-(a^{2}+1)}", "0")).toBeNull();
  });

  it("non entra senza lettere (passano gli altri percorsi)", () => {
    expect(verificaPerSostituzione("\\sqrt{8}", "2√2")).toBeNull();
  });

  it("non entra con più di 3 lettere", () => {
    expect(verificaPerSostituzione("a+b+c+d", "a+b+c+d")).toBeNull();
  });
});

describe("sostituisciLettere e lettereLibere", () => {
  it("riconosce le lettere libere ma non quelle dei comandi LaTeX", () => {
    expect(lettereLibere("\\dfrac{\\sqrt{a-1}}{3}")).toEqual(["a"]);
    expect(lettereLibere("\\sqrt{2}+1")).toEqual([]);
  });

  it("parentesizza i valori negativi nelle potenze", () => {
    expect(sostituisciLettere("x^{2}", { x: -2 })).toBe("(-2)^{2}");
    expect(sostituisciLettere("3a+3", { a: 2 })).toBe("3·2+3");
  });
});
