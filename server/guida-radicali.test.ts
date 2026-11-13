/** Test dei tre costruttori deterministici (9/11/2026, foto «ultima spiaggia»):
 *  1. radici n-esime a indice unico, 2. radicali con lettere,
 *  3. catene con decimali periodici. Ogni esercizio generato DEVE passare
 *  la stessa riverifica della rotta: riparaEsercizio + trascrizioneFedele. */
import { describe, it, expect } from "vitest";
import {
  costruisciRadiciNesime,
  costruisciRadicaliLetterali,
  costruisciCatenaEsatta,
  costruisciPerfettiSottoRadice,
} from "./guida-radicali";
import { contoGiusto, riparaEsercizio, trascrizioneFedele, verificaPerSostituzione } from "./costruisci";
import { evaluateNumericExpression, normalizeInput } from "../client/src/lib/espressioni";

const RIGOROSO = (candidato: unknown, input: string) => {
  const { esercizio, problemi } = riparaEsercizio(candidato);
  expect(problemi).toEqual([]);
  expect(esercizio).not.toBeNull();
  expect(trascrizioneFedele(input, esercizio!.espressioneLatex)).toBe(true);
  return esercizio!;
};

describe("1. radici n-esime a indice unico", () => {
  it("foto 10: 2∛81 − 5∛32 − 3∛24 + 4∛108", () => {
    const input = "2∛81 − 5∛32 − 3∛24 + 4∛108";
    const c = costruisciRadiciNesime(input);
    expect(c).not.toBeNull();
    const e = RIGOROSO(c, input);
    // il risultato finale esatto è 2∛4: le risposte sono interne, qui si
    // controlla solo che l'ULTIMA riga coincida con il risultato finale
    const ultima = e.righeProgressive[e.righeProgressive.length - 1];
    expect(ultima.replace(/\\cdot|\s/g, "")).toBe(e.risultatoFinaleLatex.replace(/\\cdot|\s/g, ""));
    expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toBe("2\\sqrt[3]{4}");
  });

  it("radicando già ridotto (nessun box di svolgimento superfluo)", () => {
    const c = costruisciRadiciNesime("3∛2 + 5∛2 − ∛2");
    expect(c).not.toBeNull();
    const e = RIGOROSO(c, "3∛2 + 5∛2 − ∛2");
    expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toBe("7\\sqrt[3]{2}");
  });

  it("quarte radici: 2∜16 + 3∜32 − ∜48", () => {
    const input = "2∜16 + 3∜32 − ∜48";
    const c = costruisciRadiciNesime(input);
    expect(c).not.toBeNull();
    const e = RIGOROSO(c, input);
    // 2·2 + 3·2∜2 − 2∜3 = 4 + 6∜2 − 2∜3 — anche parte razionale
    expect(e.risultatoFinaleLatex).toContain("\\sqrt[4]{2}");
  });

  it("radicandi frazionari con √: 2√(1/2) + √8 − √(1/8)", () => {
    const input = "2√(1/2) + √8 − √(1/8)";
    const c = costruisciRadiciNesime(input);
    expect(c).not.toBeNull();
    const e = RIGOROSO(c, input);
    // 2·(√2/2) + 2√2 − (√2/4) = √2 + 2√2 − √2/4 = 11√2/4
    expect(e.risultatoFinaleLatex).toContain("\\sqrt{2}");
  });
});

describe("2. radicali con lettere", () => {
  it("foto ultima spiaggia: √(9x³)·√x − 2x·√(4x²) + √(25x⁴):x", () => {
    const input = "√(9x^3)·√x − 2x·√(4x^2) + √(25x^4):x";
    const c = costruisciRadicaliLetterali(input);
    expect(c).not.toBeNull();
    const e = RIGOROSO(c, input);
    // La traccia e il primo calcolo conservano il puntino della fotografia.
    expect(e.espressioneLatex).toMatch(/\}\s*\\cdot\s*\\sqrt\{x\}/);
    /* (12/11) l'espressione è fratta (÷ x): la sezione C.E. richiesta
     * dall'utente sta in testa; il primo CALCOLO è nella sezione dopo. */
    const primoCalcolo = e.sezioni.find(
      (s) => !s.boxes.some((b) => (b as { condizioniEsistenza?: boolean }).condizioniEsistenza),
    )!;
    expect(primoCalcolo.boxes[0].op).toMatch(/\}\s*\\cdot\s*\\sqrt\{x\}/);
    // Il valore assoluto non va rimosso da un singolo box senza assumere
    // il segno di x; la forma completa è verificata sul dominio originale.
    expect(e.risultatoFinaleLatex).toContain("|");
    expect(contoGiusto(e.espressioneLatex, e.risultatoFinaleLatex).ok).toBe(true);
  });

  it("residuo radicale identico: 2√(12x²) + √(75x²)", () => {
    const input = "2√(12x^2) + √(75x^2)";
    const c = costruisciRadicaliLetterali(input);
    expect(c).not.toBeNull();
    const e = RIGOROSO(c, input);
    // √(x²) è |x| anche per x negativo: la precedente attesa 9x√3
    // perdeva il valore assoluto e non era valida sull'intero dominio.
    expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toBe("9\\left|x\\right|\\sqrt{3}");
    expect(contoGiusto(input, e.risultatoFinaleLatex).ok).toBe(true);
  });

  it("non prende in carico forme senza radicali", () => {
    expect(costruisciRadicaliLetterali("2x + 3x − x")).toBeNull();
  });
});

describe("3. catene con decimali periodici", () => {
  it("foto 002341: frazioni impilate, decimale, radice e periodico", () => {
    const input = "[(3⁄2 − 0,5)²·√(9⁄4) + 1,3̄] : (2 − 1⁄3)";
    const c = costruisciCatenaEsatta(input);
    expect(c).not.toBeNull();
    const e = RIGOROSO(c, input);
    // [(1)²·(3/2) + 4/3] : 5/3 = (3/2 + 4/3) : 5/3 = (17/6)·(3/5) = 17/10
    expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toBe("\\dfrac{17}{10}");
    // L'espressione della foto non deve diventare un unico calcolo: lo
    // studente svolge prima i calcoli interni e solo alla fine divide.
    const boxes = e.sezioni[0].boxes;
    expect(boxes.length).toBeGreaterThan(5);
    expect(boxes[0].op).toMatch(/^0(?:\{,\}|,)5$/);
    expect(boxes.some((b) => /periodic|frazione generatrice/i.test(b.prompt ?? ""))).toBe(true);
    expect(boxes.at(-1)?.prompt).toMatch(/divid/i);
    // la scritta periodica resta fedele fino al suo box
    expect(e.espressioneLatex).toContain("1,\\overline{3}");
  });

  it("anche le divisioni scritte con barra ASCII rimangono guidate passo passo", () => {
    const input = "[(3/2 − 0,5)²·√(9/4) + 1,3̄] : (2 − 1/3)";
    const e = RIGOROSO(costruisciCatenaEsatta(input), input);
    expect(e.sezioni[0].boxes.length).toBeGreaterThan(5);
    expect(e.sezioni[0].boxes[0].op).not.toBe(e.espressioneLatex);
    expect(e.sezioni[0].boxes.at(-1)?.prompt).toMatch(/divid/i);
  });

  it("periodico puro: 0,3̄ + 1/6", () => {
    const input = "0,3̄ + 1/6";
    const c = costruisciCatenaEsatta(input);
    expect(c).not.toBeNull();
    const e = RIGOROSO(c, input);
    // Il periodo viene trasformato in un box distinto dalla somma.
    expect(e.sezioni[0].boxes.length).toBeGreaterThanOrEqual(2);
    expect(e.sezioni[0].boxes[0].op).toBe("0,\\overline{3}");
    expect(e.sezioni[0].boxes[0].prompt).toMatch(/periodic|frazione generatrice/i);
    expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toBe("\\dfrac{1}{2}");
  });

  it("periodico misto: prima la frazione generatrice e poi la somma", () => {
    const input = String.raw`0,1\overline{6}+1⁄3`;
    const e = RIGOROSO(costruisciCatenaEsatta(input), input);
    const boxes = e.sezioni[0].boxes;
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    expect(boxes[0].op).toBe(String.raw`0,1\overline{6}`);
    expect(boxes[0].prompt).toMatch(/antiperiodo/i);
    expect(boxes.at(-1)?.prompt).toMatch(/somm/i);
  });

  it("non prende in carico catene senza periodici (restano all'IA)", () => {
    expect(costruisciCatenaEsatta("(2 + 3)·4 − 10")).toBeNull();
  });
});


/* ─── 5. PERFETTI SOTTO RADICE (12/11, foto «ma_cos») + VALORE ASSOLUTO ──
 * La foto mostrava (√(x²+6x+9)+∛(x³−3x²+3x−1)):√(x+7) fallita 3 volte su 3:
 * nessun costruttore deterministico la prendeva e l'IA veniva bocciata
 * perché il motore non sapeva leggere il valore assoluto (|x+3|). Ora:
 *  1. il motore verifica |…| con sostituzione numerica (entrambi i segni);
 *  2. la tipologia ha il suo costruttore deterministico, senza IA. */
describe("5. perfetti sotto radice + valore assoluto", () => {
  it("il motore valuta e verifica il VALORE ASSOLUTO", () => {
    expect(evaluateNumericExpression(normalizeInput("|-3|"))).toBe(3);
    expect(evaluateNumericExpression(normalizeInput("|5-8|+1"))).toBe(4);
    // √(quadrato) = |binomio|: la forma RIGOROSA ora è verificabile
    expect(verificaPerSostituzione("\\sqrt{\\left(x+3\\right)^{2}}", "|x+3|")?.ok).toBe(true);
    // identità con valore assoluto (box dell'IA per la foto «ma_cos»)
    expect(verificaPerSostituzione("\\sqrt{(x+3)^{2}}+x-1", "|x+3|+x-1")?.ok).toBe(true);
    // il rigore resta: |x−1| NON è x−1, e −(x+3) non è √((x+3)²)
    expect(verificaPerSostituzione("|x-1|", "x-1")?.ok).toBe(false);
    expect(verificaPerSostituzione("\\sqrt{\\left(x+3\\right)^{2}}", "-(x+3)")?.ok).toBe(false);
  });

  it("foto «ma_cos»: l'espressione fallita ora costruisce l'esercizio SENZA IA", () => {
    const input = "(√(x^2+6x+9)+∛(x^3-3x^2+3x-1)):√(x+7)";
    const c = costruisciPerfettiSottoRadice(input);
    expect(c).not.toBeNull();
    const e = RIGOROSO(c, input);
    const boxes = e.sezioni.flatMap((s) => s.boxes).filter((b) => !b.condizioniEsistenza);
    expect(boxes.length).toBe(4);
    // metodo, mai risultato: le scomposizioni sono nei prompt
    expect(boxes[0].prompt).toMatch(/quadrato perfetto/i);
    expect(boxes[1].prompt).toMatch(/radice quadrata/i);
    expect(boxes[2].prompt).toMatch(/cubo perfetto/i);
    // Il modulo non è un termine simile al binomio, dunque niente somma fittizia.
    // nessuna risposta precotta nel testo mostrato
    for (const b of boxes) expect(b.prompt).not.toContain(b.answerLatex);
    // Il risultato conserva il modulo e il denominatore originale.
    expect(e.risultatoFinaleLatex).toContain("|");
    expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toContain("x+7");
  });

  it("ordine dei radicali invertito (∛ prima, √ dopo)", () => {
    const input = "(∛(x^3+3x^2+3x+1)+√(x^2+4x+4)):√(x+2)";
    const c = costruisciPerfettiSottoRadice(input);
    expect(c).not.toBeNull();
    const e = RIGOROSO(c, input);
    expect(e.sezioni.flatMap((s) => s.boxes).filter((b) => !b.condizioniEsistenza).length).toBe(4);
    expect(e.risultatoFinaleLatex).toContain("|");
  });

  it("coefficiente non perfetto o radicando già scomposto → null (resta all'IA)", () => {
    // √(x²+6x+10): il termine noto 10 non è un quadrato perfetto
    expect(costruisciPerfettiSottoRadice("(√(x^2+6x+10)+∛(x^3-3x^2+3x-1)):√(x+7)")).toBeNull();
    // denominatore già un quadrato perfetto: si semplificherebbe da solo
    expect(costruisciPerfettiSottoRadice("(√(x^2+6x+9)+∛(x^3-3x^2+3x-1)):√(x^2+6x+9)")).toBeNull();
    // un solo radicale al numeratore: tipologia diversa
    expect(costruisciPerfettiSottoRadice("√(x^2+6x+9):√(x+7)")).toBeNull();
  });
});

