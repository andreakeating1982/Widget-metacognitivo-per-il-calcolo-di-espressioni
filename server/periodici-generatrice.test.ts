/** (12/11, foto utente «the_end») FRAZIONE GENERATRICE calcolata dal motore:
 *  l'IA scriveva il box del periodico con la frazione SBAGLIATA
 *  (0,0\overline{1} → 1/99) e il motore non poteva ripararlo perché non
 *  sapeva calcolare la generatrice. Ora la calcola (formula generale) e la
 *  riparazione vale per QUALUNQUE numero periodico. */
import { describe, expect, it } from "vitest";
import { riparaEsercizio } from "./costruisci";

function boxRiparato(op: string, sbagliata: string, giusta: string): string | null {
  const candidato = {
    espressioneLatex: op,
    sezioni: [{ title: "PERIODICI IN FRAZIONE", boxes: [{ op, answerLatex: sbagliata, prompt: "Scrivo la frazione generatrice." }] }],
    righeProgressive: [op, giusta],
    risultatoFinaleLatex: giusta,
  };
  const esito = riparaEsercizio(candidato as never);
  const b = esito.esercizio?.sezioni?.[0]?.boxes?.[0];
  return b?.answerLatex ?? null;
}

describe("frazione generatrice dei periodici (foto utente 12/11)", () => {
  it("0,0\\overline{1} = 1/90 (l'IA scriveva 1/99)", () => {
    expect(boxRiparato("0,0\\overline{1}", "\\dfrac{1}{99}", "\\dfrac{1}{90}")).toBe("\\dfrac{1}{90}");
  });

  it("0,\\overline{6} = 2/3 (l'IA scriveva 3/9, sbagliata)", () => {
    expect(boxRiparato("0,\\overline{6}", "\\dfrac{3}{9}", "\\dfrac{2}{3}")).toBe("\\dfrac{2}{3}");
  });

  it("6/9 è uguale a 0,\\overline{6}: box corretto (non ridotto) lasciato dall'IA", () => {
    // riga coerente con la risposta NON ridotta dell'IA
    expect(boxRiparato("0,\\overline{6}", "\\dfrac{6}{9}", "\\dfrac{6}{9}")).toBe("\\dfrac{6}{9}");
  });

  it("1,\\overline{2} = 11/9", () => {
    expect(boxRiparato("1,\\overline{2}", "\\dfrac{10}{9}", "\\dfrac{11}{9}")).toBe("\\dfrac{11}{9}");
  });

  it("0,58\\overline{3} = 7/12", () => {
    expect(boxRiparato("0,58\\overline{3}", "\\dfrac{8}{12}", "\\dfrac{7}{12}")).toBe("\\dfrac{7}{12}");
  });

  it("la risposta sbagliata dell'IA non passa mai come buona", () => {
    // 0,0\overline{1} ≠ 1/99: se il motore non sapesse calcolare, il box
    // resta bocciato (nessun falso positivo).
    expect(boxRiparato("0,0\\overline{1}", "\\dfrac{1}{99}", "\\dfrac{1}{90}")).not.toBe("\\dfrac{1}{99}");
  });
});
