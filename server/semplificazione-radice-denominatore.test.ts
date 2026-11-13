import { describe, expect, it } from "vitest";
import { contoGiusto } from "./costruisci";

/* Prove di verificabilità per il nuovo box di semplificazione:
 * frazione con radice al denominatore che si riduce da sola perché
 * il numeratore è il quadrato del radicando (o contiene la radice come
 * fattore). Nessun risultato di esercizio: solo verdetto del motore. */
describe("contoGiusto — semplificazione della frazione con radice al denominatore", () => {
  it("accetta (ab+1)/√(ab+1) → √(ab+1)", () => {
    const esito = contoGiusto("\\dfrac{ab+1}{\\sqrt{ab+1}}", "\\sqrt{ab+1}");
    expect(esito.ok).toBe(true);
  });

  it("accetta (ab+1)/√(ab+1)+3 → √(ab+1)+3 con l'espressione intera", () => {
    const esito = contoGiusto("\\dfrac{ab+1}{\\sqrt{ab+1}}+3", "\\sqrt{ab+1}+3");
    expect(esito.ok).toBe(true);
  });

  it("accetta il caso con coefficiente: 3(ab+1)/√(ab+1) → 3√(ab+1)", () => {
    const esito = contoGiusto("\\dfrac{3\\left(ab+1\\right)}{\\sqrt{ab+1}}", "3\\sqrt{ab+1}");
    expect(esito.ok).toBe(true);
  });

  it("accetta il caso con la radice già fuori al numeratore: (2a·√a)/√a → 2a", () => {
    const esito = contoGiusto("\\dfrac{2a\\sqrt{a}}{\\sqrt{a}}", "2a");
    expect(esito.ok).toBe(true);
  });

  it("rifiuta una semplificazione sbagliata: (ab+1)/√(ab+1) ≠ ab+1", () => {
    const esito = contoGiusto("\\dfrac{ab+1}{\\sqrt{ab+1}}", "ab+1");
    expect(esito.ok).toBe(false);
  });

  it("rifiuta la razionalizzazione sbagliata del segno", () => {
    const esito = contoGiusto("\\dfrac{ab+1}{\\sqrt{ab+1}}", "-\\sqrt{ab+1}");
    expect(esito.ok).toBe(false);
  });
});
