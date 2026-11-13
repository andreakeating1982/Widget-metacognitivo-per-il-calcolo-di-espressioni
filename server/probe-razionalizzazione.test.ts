import { describe, expect, it } from "vitest";
import { contoGiusto } from "./costruisci";

/* Sonda: quali conti di razionalizzazione il motore sa verificare ESATTAMENTE?
 * Serve a decidere quando il box guidato può essere aggiunto in sicurezza. */
describe("sonda verifica conti di razionalizzazione", () => {
  it.each([
    ["\\dfrac{ab+1}{\\sqrt{ab+1}}+3", "\\sqrt{ab+1}+3"],
    ["\\dfrac{2a\\cdot\\sqrt{ab+1}}{\\sqrt{ab+1}}", "2a"],
    ["\\dfrac{1}{\\sqrt{3}}", "\\dfrac{\\sqrt{3}}{3}"],
    ["\\dfrac{2}{\\sqrt{3}}+1", "\\dfrac{2\\sqrt{3}}{3}+1"],
    ["\\dfrac{a+b}{\\sqrt{ab}}", "\\dfrac{\\left(a+b\\right)\\sqrt{ab}}{ab}"],
    ["\\dfrac{\\sqrt{18}}{3}", "\\sqrt{2}"],
    ["\\dfrac{\\sqrt{3}}{3}", "\\dfrac{1}{\\sqrt{3}}"],
    ["1+\\dfrac{1}{\\sqrt{2}}", "1+\\dfrac{\\sqrt{2}}{2}"],
  ])("contoGiusto(%s, %s)", (op, answer) => {
    expect(contoGiusto(op, answer).ok).toBe(true);
  });
});

