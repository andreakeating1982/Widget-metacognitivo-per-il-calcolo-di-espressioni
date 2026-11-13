import { describe, expect, it } from "vitest";
import { costruisciPerfettiSottoRadice } from "./guida-radicali";
import { canonizzaEspressione, riparaEsercizio } from "./costruisci";
import { parseExpression, normalizeInput } from "../client/src/lib/espressioni";

/* Il percorso conserva il valore assoluto quando è richiesto dalle radici
 * pari: non assume che il binomio sia positivo nel dominio dell'esercizio. */
describe("perfetti sotto radice con dominio reale corretto", () => {
  const FOTO_TASTIERA = "(√(x^2+6x+9)+∛(x^3-3x^2+3x-1))⁄√(x+7)";
  const FOTO_DUEPUNTI = "(√(x^2+6x+9)+∛(x^3-3x^2+3x-1)):√(x+7)";

  it("il denominatore della frazione impilata può essere una radice", () => {
    expect(() => parseExpression(normalizeInput("2⁄√(x+7)"))).not.toThrow();
    expect(() => parseExpression(normalizeInput("(x+1)⁄√(x+7)"))).not.toThrow();
    expect(() => parseExpression(normalizeInput("(√9+∛8)⁄√(x+7)"))).not.toThrow();
    expect(() => parseExpression(normalizeInput(FOTO_TASTIERA))).not.toThrow();
  });

  it("la frazione impilata conserva il raggruppamento: 16⁄(2⁄4) ≠ (16⁄2)⁄4", () => {
    const v1 = parseExpression(normalizeInput("16⁄(2⁄4)"));
    const v2 = parseExpression(normalizeInput("(16⁄2)⁄4"));
    /* il raggruppamento resta DIVERSO: la correzione del denominatore non
       appiattisce le frazioni impilate annidate */
    expect(JSON.stringify(v1)).not.toBe(JSON.stringify(v2));
  });

  it.each([FOTO_TASTIERA, FOTO_DUEPUNTI])(
    "costruttore deterministico conserva il modulo per %s",
    (espressione) => {
      const canonica = canonizzaEspressione(espressione);
      const candidato = costruisciPerfettiSottoRadice(canonica);
      expect(candidato).not.toBeNull();
      const rip = riparaEsercizio(candidato);
      expect(rip.esercizio).not.toBeNull();
      expect(rip.problemi).toEqual([]);
      const boxes = rip.esercizio!.sezioni.flatMap((s) => s.boxes);
      expect(boxes.some((b) => b.answerLatex.includes("|"))).toBe(true);
      expect(rip.esercizio!.risultatoFinaleLatex).toContain("|");
      expect(rip.esercizio!.risultatoFinaleLatex.replace(/[\s{}\\]/g, "")).toContain("x+7");
    },
  );
});
