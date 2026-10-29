import { describe, it, expect } from "vitest";
import { latexToSpeech } from "./useReadAloud";

/** (25/10, punto 5) LETTURA VOCALE dei nuovi casi: radicali con indice,
 *  esponenti negativi, esponenti frazionari, divisioni e prodotti. */
describe("punto 5 — TTS radicali ed esponenti", () => {
  it("√9 → «radice quadrata di nove»", () => {
    expect(latexToSpeech("\\sqrt{9}")).toContain("radice quadrata di nove");
  });

  it("∛27 → «radice cubica di ventisette» (prima: «radice quadrata»!)", () => {
    expect(latexToSpeech("\\sqrt[3]{27}")).toContain("radice cubica di ventisette");
    expect(latexToSpeech("\\sqrt[3]{27}")).not.toContain("quadrata");
  });

  it("∜16 → «radice quarta di sedici»", () => {
    expect(latexToSpeech("\\sqrt[4]{16}")).toContain("radice quarta di sedici");
  });

  it("x^{-2} → «x alla meno due»", () => {
    expect(latexToSpeech("x^{-2}")).toContain("x alla meno due");
  });

  it("frazione col monomio al denominatore: 1/x² → «uno fratto x al quadrato»", () => {
    const s = latexToSpeech("\\dfrac{1}{x^{2}}");
    expect(s).toContain("fratto");
    expect(s).toContain("x al quadrato");
  });

  it("x² : x⁴ → contiene «diviso» (prima i simboli venivano saltati)", () => {
    const s = latexToSpeech("x^{2} : x^{4}");
    expect(s).toContain("diviso");
  });

  it("moltiplicazione esplicita 2·3 → «due per tre»; 2x resta «due x»", () => {
    expect(latexToSpeech("2 \\cdot 3")).toContain("per");
    // la giustapposizione si legge senza «per»: è la lettura scolastica giusta
    expect(latexToSpeech("\\left(2x\\right)^{3}")).toBe("due x al cubo");
  });

  it("esponente frazionario 9^(1/2) → «nove alla uno fratto due»", () => {
    const s = latexToSpeech("9^{\\tfrac{1}{2}}");
    expect(s).toContain("nove");
    expect(s).toContain("fratto");
    expect(s).not.toContain("tfrac");
  });
});
