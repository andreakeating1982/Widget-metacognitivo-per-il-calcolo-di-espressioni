import { describe, expect, it } from "vitest";
import { contoGiusto, indicazioniFrazioniSbagliate } from "./costruisci";
import { sommaFrazioniConAtomi } from "../client/src/lib/frazioniConAtomi";

describe("feedback esatto all'IA sulle somme fratte", () => {
  it.each([
    [String.raw`\dfrac{x+1}{2}+\dfrac{4}{3\left|x-2\right|}`, String.raw`\dfrac{3(x+1)+8}{6\left|x-2\right|}`],
    [String.raw`\dfrac{x-3}{4}+\dfrac{2}{5\left|x+1\right|}`, String.raw`\dfrac{5(x-3)+8}{20\left|x+1\right|}`],
  ])("rileva il fattore perso e dà una formula generale verificata", (op, errore) => {
    expect(contoGiusto(op, errore).ok).toBe(false);
    const corretta = sommaFrazioniConAtomi(op);
    expect(corretta).not.toBeNull();
    expect(contoGiusto(op, corretta!).via).toBe("razionale esatto con atomi simbolici");
    const suggerimenti = indicazioniFrazioniSbagliate({ sezioni: [{ boxes: [{ op, answerLatex: errore }] }] });
    expect(suggerimenti).toHaveLength(1);
    expect(suggerimenti[0]).toContain(corretta);
    expect(suggerimenti[0]).toContain("RICALCOLA");
    expect(suggerimenti[0]).toContain("answerLatex");
  });

  it("fornisce un'indicazione verificata anche se il primo addendo moltiplica una frazione per un binomio", () => {
    const op = String.raw`\dfrac{9}{12}\left(x-2\right)+\dfrac{8}{12\left|x+1\right|}`;
    const errore = String.raw`\dfrac{9\left|x+1\right|\left(x-2\right)}{12\left|x+1\right|}+\dfrac{8\left(x-2\right)}{12\left|x+1\right|}`;
    expect(contoGiusto(op, errore).ok).toBe(false);
    const indicazioni = indicazioniFrazioniSbagliate({ sezioni: [{ boxes: [{ op, answerLatex: errore }] }] });
    expect(indicazioni.length).toBe(1);
    expect(indicazioni[0]).toContain("RICALCOLA");
  });

  it("non corregge un box già corretto e non inventa valori assoluti", () => {
    const op = String.raw`\dfrac{x+1}{2}+\dfrac{4}{3\left|x-2\right|}`;
    const answer = sommaFrazioniConAtomi(op)!;
    expect(indicazioniFrazioniSbagliate({ sezioni: [{ boxes: [{ op, answerLatex: answer }] }] })).toEqual([]);
  });
});

