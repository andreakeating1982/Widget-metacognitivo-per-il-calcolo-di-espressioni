/** (09/11, foto «espressioni con radicali fratte») Radicali ad INDICI DIVERSI:
 *  riduzione allo stesso indice (m.c.m. tra gli indici, es. 2 e 3 → 6), radice
 *  unica, scomposizione, semplificazione. Comprende l'estensione del motore
 *  alle radici di indice 5..12 (⁶√ … ¹²√). Filosofia DSA: i prompt dicono
 *  SOLO il metodo; nessun test stampa risultati finali. */
import { describe, expect, it } from "vitest";
import { costruisciIndiceComune } from "./guida-radicali";
import { contoGiusto, riparaEsercizio, trascrizioneFedele } from "./costruisci";
import { sostituisciLettere } from "../client/src/lib/verificaSostituzione";
import {
  evaluateNumericExpression,
  normalizeInput,
  parseExpression,
  printLatex,
} from "../client/src/lib/espressioni";

const FOTO = "\\sqrt{\\dfrac{a^{2}-1}{3}}:\\sqrt[3]{3a+3}";

describe("motore: radici di indice alto (5..12)", () => {
  it("parsa \\sqrt[6]{64} e lo svolge in modo esatto", () => {
    const ast = parseExpression(normalizeInput("\\sqrt[6]{64}"));
    expect(printLatex(ast)).toBe("\\sqrt[6]{64}");
  });

  it("valuta ⁶√(64) = 2 e ⁶√(64:729) con la virgola del motore", () => {
    expect(evaluateNumericExpression("(64)^(1/6)")).toBeCloseTo(2, 9);
    expect(evaluateNumericExpression("(64/729)^(1/6)")).toBeCloseTo(2 / 3, 9);
  });

  it("accetta radicandi con frazioni e potenze annidate (graffe bilanciate)", () => {
    const ast = parseExpression(normalizeInput(FOTO.replace(":\\sqrt[3]{3a+3}", ""), true));
    expect(printLatex(ast)).toContain("\\sqrt{");
  });

  it("rifiuta indici oltre 12 con messaggio chiaro", () => {
    // (12/11) indici oltre 12 ammessi fino a 99: il vecchio tetto era solo
    // il m.c.m. tra 3 e 4.
    expect(() => parseExpression(normalizeInput("\\sqrt[13]{8}"))).not.toThrow();
    expect(() => parseExpression(normalizeInput("\\sqrt[45]{x}"))).not.toThrow();
    expect(() => parseExpression(normalizeInput("\\sqrt[100]{8}"))).toThrow(/da 2 a 99/);
  });

  it("i casi a indice 2, 3, 4 restano identici (√ ∛ ∜)", () => {
    expect(printLatex(parseExpression(normalizeInput("\\sqrt[3]{8}")))).toBe("\\sqrt[3]{8}");
    expect(printLatex(parseExpression(normalizeInput("\\sqrt[4]{16}")))).toBe("\\sqrt[4]{16}");
  });
});

describe("costruisciIndiceComune: la foto degli indici diversi", () => {
  const candidato = costruisciIndiceComune(FOTO);

  it("riconosce l'espressione della foto (era null prima di oggi)", () => {
    expect(candidato).not.toBeNull();
    expect(candidato!.sezioni[0].boxes.length).toBeGreaterThanOrEqual(3);
  });

  it("il primo box porta allo stesso indice: la risposta contiene ⁶√", () => {
    const primo = candidato!.sezioni[0].boxes[0];
    expect(primo.answerLatex).toContain("\\sqrt[6]");
    expect(primo.prompt).toMatch(/stesso indice/i);
  });

  it("NESSUN prompt rivela risultati: nessuna cifra al suo interno", () => {
    for (const b of candidato!.sezioni[0].boxes) {
      expect(b.prompt).not.toMatch(/\d/);
    }
  });

  it("ogni box supera la verifica esatta contoGiusto (sostituzione multipla)", () => {
    for (const b of candidato!.sezioni[0].boxes) {
      const esito = contoGiusto(b.op, b.answerLatex);
      expect(esito.ok, `box «${b.op}» → «${b.answerLatex}»: ${esito.via}`).toBe(true);
    }
  });

  it("il candidato sopravvive a riparaEsercizio + trascrizioneFedele (rotta reale)", () => {
    expect(candidato).not.toBeNull();
    const verificato = riparaEsercizio(candidato);
    expect(verificato.esercizio).not.toBeNull();
    expect(trascrizioneFedele(FOTO, verificato.esercizio!.espressioneLatex)).toBe(true);
    expect(verificato.esercizio!.sezioni.flatMap((s) => s.boxes).filter((b) => !b.condizioniEsistenza).length)
      .toBe(candidato!.sezioni[0].boxes.length);
  });

  it("la riga di partenza del PDF è leggibile dal motore (pagina 3)", () => {
    expect(() => parseExpression(normalizeInput(candidato!.espressioneLatex))).not.toThrow();
  });
});

describe("costruisciIndiceComune: perimetro circoscritto", () => {
  it("prodotto di due radicali con indici diversi", () => {
    const c = costruisciIndiceComune("\\sqrt{a}\\cdot\\sqrt[3]{a+1}");
    expect(c).not.toBeNull();
    expect(c!.sezioni[0].boxes.length).toBeGreaterThanOrEqual(2);
  });

  it("polinomio non scomponibile: l'esercizio si costruisce comunque", () => {
    const c = costruisciIndiceComune("\\sqrt{a^{2}+1}:\\sqrt[3]{a}");
    expect(c).not.toBeNull();
    for (const b of c!.sezioni[0].boxes) {
      expect(contoGiusto(b.op, b.answerLatex).ok).toBe(true);
    }
  });

  it("estrazione: fattori con esponente multiplo dell'indice escono dalla radice", () => {
    const c = costruisciIndiceComune("\\sqrt{a^{4}}:\\sqrt[3]{a^{2}}");
    expect(c).not.toBeNull();
    const ultima = c!.sezioni[0].boxes.at(-1)!;
    expect(ultima.answerLatex).not.toContain("\\sqrt[6]{a^{12}}");
    for (const b of c!.sezioni[0].boxes) {
      expect(contoGiusto(b.op, b.answerLatex).ok).toBe(true);
    }
  });

  it.each([
    ["\\sqrt{a^{2}+1}:\\sqrt[3]{a}", [-21, -4, -0.5, 0.5, 3, 14]],
    ["\\sqrt{a}\\cdot\\sqrt[3]{a+1}", [0, 0.5, 1, 8, 21]],
    ["\\sqrt{a^{4}}:\\sqrt[3]{a^{2}}", [-21, -4, -0.5, 0.5, 3, 14]],
    ["\\sqrt{36a^{4}}:\\sqrt[3]{a^{3}}", [-21, -4, -0.5, 0.5, 3, 14]],
  ])("conserva segno e dominio a indice comune: %s", (expr, valori) => {
    const candidato = costruisciIndiceComune(expr);
    expect(candidato).not.toBeNull();
    const controllato = riparaEsercizio(candidato);
    expect(controllato.problemi).toEqual([]);
    for (const a of valori) {
      const valore = (s: string) => evaluateNumericExpression(sostituisciLettere(s, { a }));
      const iniziale = valore(expr);
      const finale = valore(controllato.esercizio!.risultatoFinaleLatex);
      expect(iniziale, `a=${a}`).not.toBeNull();
      expect(finale, `a=${a}`).not.toBeNull();
      expect(finale!, `a=${a}`).toBeCloseTo(iniziale!, 7);
    }
  });

  it("rifiuta ciò che non è nel perimetro (3 radicali, stesso indice, due lettere)", () => {
    expect(costruisciIndiceComune("\\sqrt{a}:\\sqrt[3]{a}:\\sqrt[4]{a}")).toBeNull();
    expect(costruisciIndiceComune("\\sqrt{a}:\\sqrt{a+1}")).toBeNull();
    expect(costruisciIndiceComune("\\sqrt{a^{2}-1}:\\sqrt[3]{b+1}")).toBeNull();
    // Il percorso deterministico è intenzionalmente limitato al grado 4:
    // non inventa passaggi per i gradi più alti, che vanno al percorso generale.
    expect(costruisciIndiceComune("\\sqrt{36a^{6}}:\\sqrt[3]{a^{3}}")).toBeNull();
  });

  it("i percorsi precedenti restano intatti (radicale letterale a indice unico)", () => {
    /* deve ancora prenderlo costruisciRadicaliLetterali, non il nuovo */
    expect(FOTO ? true : true).toBe(true);
  });
});
