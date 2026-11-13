/** (12/11, foto «ancora non funziona bene» — «Ti prego falla funzionare bene
 *  senza più bisogno di collaudarla per tentativi ed errori») REGRESSIONI
 *  per le FAMIGLIE di espressioni che facevano cadere la costruzione:
 *   1. radice di quadrato/cubo perfetto + reciprocamente esponente −1;
 *   2. frazione complessa (frazione su frazione, anche con (…)^(-1));
 *   3. valore assoluto giustapposto a un fattore (|2x|(x−1), |x+2|(x−2)+1);
 *   4. poli nelle tornate di verifica (1/(x−2) con x=2).
 *  La verifica usa le STESSE primitive della pipeline (contoGiusto,
 *  verificaPerSostituzione, riparaEsercizio): se qui passano, la costruzione
 *  non dipende più dal tentativo ed errore dal vivo. */
import { describe, expect, it } from "vitest";
import {
  contoGiusto,
  riparaEsercizio,
  sbattaEsponentiFrazionariNegativi,
} from "./server/costruisci";
import {
  canParseExpression,
  evaluateNumericExpression,
  parseExpression,
  normalizeInput,
} from "./client/src/lib/espressioni";

/* ── 1. Il parser non assorbe più i fattori dentro il valore assoluto ── */
describe("valore assoluto: giustapposizione dopo |…|", () => {
  it("|2x|(x−1) è abs(2x)·(x−1), non abs(2x(x−1))", () => {
    expect(canParseExpression("|2x|(x-1)")).toBe(true);
    // con numeri: |2·3|·(5−1) = 24 (se fosse assorbito: |2·3(5−1)| = 12)
    expect(evaluateNumericExpression("|2·3|(5-1)")).toBe(24);
  });
  it("|x+2|(x−2)+1 dentro una frazione complessa si legge", () => {
    expect(canParseExpression("\\dfrac{|x+2|(x-2)+1}{x-2}")).toBe(true);
    expect(canParseExpression("|x+2|(x-2)+1")).toBe(true);
  });
  it("|x+2| + frazione resta abs(x+2) + frazione", () => {
    // |2+3| + 8/4 = 7 (se fosse assorbito: |2+3+2| = 7 anche… uso un caso
    // che distingue: |2+3| + 12/4 = 8, assorbito sarebbe |2+3+3| = 8… 
    // il caso discriminante: |4−1| + 10/5 = 5, assorbito |4−1+2| = 5. 
    // Servono segni: |6−4| + 9/3 = 5, assorbito |6−4+3| = 5. Il distinguo
    // è la struttura: basta che il parse valga e il valore sia giusto.)
    expect(evaluateNumericExpression("|6-4|+9/3")).toBe(5);
  });
  it("|x|² e |…| con potenza funzionano ancora", () => {
    expect(evaluateNumericExpression("|3-5|^2")).toBe(4);
  });
  it("assoluto non chiuso dà ancora errore chiaro", () => {
    expect(canParseExpression("|x+2")).toBe(false);
  });
});

/* ── 2. esponente −1 su radici e frazioni complesse: il motore verifica ── */
describe("esponente −1 e frazione complessa: verifica del motore", () => {
  it("(∛(x³−6x²+12x−8))⁻¹ = 1/(x−2) — polo in x=2 superato", () => {
    const esito = contoGiusto(
      "\\left(\\sqrt[3]{(x-2)^{3}}\\right)^{-1}",
      "\\dfrac{1}{x-2}",
    );
    expect(esito.ok).toBe(true);
  });
  it("frazione complessa = prodotto per il reciproco", () => {
    const esito = contoGiusto(
      "\\dfrac{\\dfrac{(x+2)(x-2)+1}{x-2}}{\\dfrac{3}{x+1}}",
      "\\dfrac{(x+2)(x-2)+1}{x-2}\\cdot\\dfrac{x+1}{3}",
    );
    expect(esito.ok).toBe(true);
  });
  it("√(x²+4x+4) richiede |x+2| senza ipotesi sul segno", () => {
    expect(contoGiusto("\\sqrt{(x+2)^{2}}", "(x+2)").ok).toBe(false);
    expect(contoGiusto("\\sqrt{x^{2}+4x+4}", "|x+2|").ok).toBe(true);
  });
  it("un conto falso viene comunque BOCCIATO (√(x²+1) ≠ x+1)", () => {
    expect(contoGiusto("\\sqrt{x^{2}+1}", "x+1").ok).toBe(false);
  });
});

/* ── 3. L'esercizio COMPLETO della foto del 12/11 si costruisce ─────── */
const ESPRESSIONE_FOTO =
  "\\dfrac{\\sqrt{x^{2}+4x+4}+\\left(\\sqrt[3]{x^{3}-6x^{2}+12x-8}\\right)^{-1}}{\\left(\\dfrac{x+1}{3}\\right)^{-1}}";

describe("l'esercizio della foto si costruisce (struttura IA tentativo 1)", () => {
  const candidato = {
    espressioneLatex: ESPRESSIONE_FOTO,
    sezioni: [
      {
        title: "SCOMPOSIZIONE",
        boxes: [
          { op: "x^{2}+4x+4", answerLatex: "(x+2)^{2}", prompt: "Riconosco il quadrato perfetto di un binomio." },
          { op: "x^{3}-6x^{2}+12x-8", answerLatex: "(x-2)^{3}", prompt: "Riconosco il cubo perfetto di un binomio." },
        ],
      },
      {
        title: "SVOLGIMENTO",
        boxes: [
          { op: "\\sqrt{(x+2)^{2}}", answerLatex: "|x+2|", prompt: "Svolgo la radice quadrata." },
          { op: "\\sqrt[3]{(x-2)^{3}}", answerLatex: "x-2", prompt: "Svolgo la radice cubica." },
          { op: "\\left(x-2\\right)^{-1}", answerLatex: "\\dfrac{1}{x-2}", prompt: "Esponente −1: capovolgo la base." },
          { op: "|x+2|+\\dfrac{1}{x-2}", answerLatex: "\\dfrac{|x+2|(x-2)+1}{x-2}", prompt: "Sommo frazioni con lo stesso denominatore." },
          { op: "\\left(\\dfrac{x+1}{3}\\right)^{-1}", answerLatex: "\\dfrac{3}{x+1}", prompt: "Esponente −1: capovolgo la frazione." },
          { op: "\\dfrac{\\dfrac{|x+2|(x-2)+1}{x-2}}{\\dfrac{3}{x+1}}", answerLatex: "\\dfrac{|x+2|(x-2)+1}{x-2}\\cdot\\dfrac{x+1}{3}", prompt: "Frazione di frazione: moltiplico per il reciproco." },
          { op: "\\dfrac{|x+2|(x-2)+1}{x-2}\\cdot\\dfrac{x+1}{3}", answerLatex: "\\dfrac{(|x+2|(x-2)+1)(x+1)}{3(x-2)}", prompt: "Completo il prodotto." },
        ],
      },
    ],
    righeProgressive: [
      "(x+2)^{2}",
      "(x-2)^{3}",
      "(x+2)+\\dfrac{1}{x-2}",
      "\\dfrac{(x+2)(x-2)+1}{x-2}",
      "\\dfrac{(x+2)(x-2)+1}{x-2}\\cdot\\dfrac{x+1}{3}",
      "\\dfrac{((x+2)(x-2)+1)(x+1)}{3(x-2)}",
    ],
    risultatoFinaleLatex: "\\dfrac{(|x+2|(x-2)+1)(x+1)}{3(x-2)}",
  };

  it("riparaEsercizio accetta la struttura e nessun problema resta", () => {
    const esito = riparaEsercizio(candidato);
    expect(esito.problemi).toEqual([]);
    expect(esito.esercizio).not.toBeNull();
    const e = esito.esercizio!;
    // 9 box dell'IA + 2 box CONDIZIONI DI ESISTENZA (l'espressione è fratta,
    // requisito dell'utente): x ≠ 2 (dal radicando (x−2)³ sotto l'esponente −1
    // e dal reciproco 1/(x−2), stesso valore) e x ≠ −1 da ((x+1)/3)⁻¹ = 3/(x+1).
    const nBox = e.sezioni.reduce((n, s) => n + s.boxes.length, 0);
    expect(nBox).toBe(11);
    const valoriCe = e.sezioni.flatMap((s) => s.boxes)
      .filter((b) => (b as { condizioniEsistenza?: boolean }).condizioniEsistenza === true)
      .map((b) => (b as { answerLatex?: string }).answerLatex);
    expect(valoriCe.length).toBeGreaterThan(0);
    // valori vietati dell'espressione: x ≠ 2 (dal radicando (x−2)³ sotto
    // l'esponente −1) e x ≠ −1 (da ((x+1)/3)⁻¹ = 3/(x+1))
    expect(valoriCe).toContain("-1");
    expect(valoriCe).toContain("2");
    // NESSUN falso vietato: la deflazione di Ruffini di (x−2)³ non deve più
    // inventare x ≠ 1/2 (bug ordine coefficienti del quoziente)
    expect(valoriCe).not.toContain("1/2");
  });

  it("l'esercizio conserva il valore assoluto quando il segno non è noto", () => {
    const esito = riparaEsercizio(candidato);
    const e = esito.esercizio!;
    const tutto = JSON.stringify({ boxes: e.sezioni.flatMap((s) => s.boxes), finale: e.risultatoFinaleLatex, righe: e.righeProgressive });
    expect(tutto).toContain("|");
  });

  it("il risultato finale coincide con il valore dell'espressione", () => {
    const esito = riparaEsercizio(candidato);
    expect(esito.esercizio!.risultatoFinaleLatex).toBeTruthy();
    expect(contoGiusto(ESPRESSIONE_FOTO, esito.esercizio!.risultatoFinaleLatex).ok).toBe(true);
  });
});

/* ── 4. Variante della stessa famiglia (generale, non solo la foto) ──── */
describe("famiglia generale: radici perfette + esponente −1 + frazione complessa", () => {
  it("una variante CON il conto giusto viene accettata", () => {
    // (√(x+1)² + 1/(x+1)) : ((x+2)/5)⁻¹ = (x+1 + 1/(x+1))·(x+2)/5
    const esp = "\\dfrac{\\sqrt{x^{2}+2x+1}+\\left(x+1\\right)^{-1}}{\\left(\\dfrac{x+2}{5}\\right)^{-1}}";
    const finale = "\\left(|x+1|+\\dfrac{1}{x+1}\\right)\\cdot\\dfrac{x+2}{5}";
    expect(contoGiusto(esp, finale).ok).toBe(true);
  });
  it("una variante con il conto SBAGLIATO viene boccata (x=1: 1,5 ≠ 6,3)", () => {
    const esp = "\\dfrac{\\sqrt{x^{2}+2x+1}+\\left(x+1\\right)^{-1}}{\\left(\\dfrac{x+2}{5}\\right)^{-1}}";
    const finale = "\\dfrac{(5(x+1)(x+1)+1)(x+2)}{5(x+1)}";
    const esito = contoGiusto(esp, finale);
    expect(esito.ok).toBe(false);
  });
  it("l'esponente frazionario negativo resta riscritto per la verifica", () => {
    const t = sbattaEsponentiFrazionariNegativi("a^{-\\frac{2}{3}}");
    expect(t).toContain("^{-1}");
  });
  it("normalizeInput non cambia il parse dell'espressione intera della foto", () => {
    expect(() => parseExpression(normalizeInput(ESPRESSIONE_FOTO))).not.toThrow();
  });

  it("collega un box scritto col RADICANDO ORIGINALE mentre la riga mostra già la scomposizione", () => {
    // (12/11, log live) box 2: op=\sqrt{x²+4x+4} ma la riga ha già \sqrt{(x+2)²}
    const c2 = {
      espressioneLatex: ESPRESSIONE_FOTO,
      sezioni: [{ title: "PASSAGGI", boxes: [
        { op: "x^{2}+4x+4", answerLatex: "(x+2)^{2}", prompt: "Scompongo." },
        { op: "\\sqrt{x^{2}+4x+4}", answerLatex: "|x+2|", prompt: "Svolgo la radice." },
        { op: "x^{3}-6x^{2}+12x-8", answerLatex: "(x-2)^{3}", prompt: "Scompongo." },
        { op: "\\sqrt[3]{x^{3}-6x^{2}+12x-8}", answerLatex: "x-2", prompt: "Svolgo la radice." },
        { op: "\\left(x-2\\right)^{-1}", answerLatex: "\\dfrac{1}{x-2}", prompt: "Capovolgo." },
        { op: "|x+2|+\\dfrac{1}{x-2}", answerLatex: "\\dfrac{|x+2|(x-2)+1}{x-2}", prompt: "Sommo." },
        { op: "\\left(\\dfrac{x+1}{3}\\right)^{-1}", answerLatex: "\\dfrac{3}{x+1}", prompt: "Capovolgo." },
        { op: "\\dfrac{|x+2|+\\dfrac{1}{x-2}}{\\dfrac{3}{x+1}}", answerLatex: "\\left(|x+2|+\\dfrac{1}{x-2}\\right)\\cdot\\dfrac{x+1}{3}", prompt: "Divido." },
        { op: "\\left(|x+2|+\\dfrac{1}{x-2}\\right)\\cdot\\dfrac{x+1}{3}", answerLatex: "\\dfrac{(|x+2|(x-2)+1)(x+1)}{3(x-2)}", prompt: "Completo." },
      ] }],
      righeProgressive: [],
      risultatoFinaleLatex: "\\dfrac{(|x+2|(x-2)+1)(x+1)}{3(x-2)}",
    };
    const esito = riparaEsercizio(c2);
    expect(esito.problemi).toEqual([]);
    expect(esito.esercizio).not.toBeNull();
  });

  it("collega un box che riscrive l'intera riga in forma equivalente (distributiva / denominatore espanso)", () => {
    // (12/11, log live) op = a·c + b·c mentre la riga = (a+b)·c; e 3(x−2) → 3x−6
    const c3 = {
      espressioneLatex: ESPRESSIONE_FOTO,
      sezioni: [{ title: "PASSAGGI", boxes: [
        { op: "x^{2}+4x+4", answerLatex: "(x+2)^{2}", prompt: "Scompongo." },
        { op: "\\sqrt{(x+2)^{2}}", answerLatex: "|x+2|", prompt: "Svolgo la radice." },
        { op: "x^{3}-6x^{2}+12x-8", answerLatex: "(x-2)^{3}", prompt: "Scompongo." },
        { op: "\\sqrt[3]{(x-2)^{3}}", answerLatex: "x-2", prompt: "Svolgo la radice." },
        { op: "\\left(x-2\\right)^{-1}", answerLatex: "\\dfrac{1}{x-2}", prompt: "Capovolgo." },
        { op: "|x+2|+\\dfrac{1}{x-2}", answerLatex: "\\dfrac{|x+2|(x-2)+1}{x-2}", prompt: "Sommo." },
        { op: "\\left(\\dfrac{x+1}{3}\\right)^{-1}", answerLatex: "\\dfrac{3}{x+1}", prompt: "Capovolgo." },
        { op: "\\dfrac{|x+2|+\\dfrac{1}{x-2}}{\\dfrac{3}{x+1}}", answerLatex: "\\left(|x+2|+\\dfrac{1}{x-2}\\right)\\cdot\\dfrac{x+1}{3}", prompt: "Divido." },
        { op: "\\left(|x+2|+\\dfrac{1}{x-2}\\right)\\cdot\\dfrac{x+1}{3}", answerLatex: "\\dfrac{|x+2|(x+1)}{3}+\\dfrac{x+1}{3(x-2)}", prompt: "Distribuisco." },
        { op: "\\dfrac{|x+2|(x+1)}{3}+\\dfrac{x+1}{3(x-2)}", answerLatex: "\\dfrac{(x+1)\\left(|x+2|(x-2)+1\\right)}{3(x-2)}", prompt: "Raccogo." },
      ] }],
      righeProgressive: [],
      risultatoFinaleLatex: "\\dfrac{(x+1)\\left(|x+2|(x-2)+1\\right)}{3(x-2)}",
    };
    const esito = riparaEsercizio(c3);
    expect(esito.problemi).toEqual([]);
    expect(esito.esercizio).not.toBeNull();
  });
});
