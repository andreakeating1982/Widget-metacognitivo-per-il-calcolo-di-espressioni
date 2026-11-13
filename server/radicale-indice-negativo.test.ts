/** (12/11, foto utente) REGRESSIONE: radici con INDICE NEGATIVO.
 *  Prima della correzione la verifica di √[−2]{1/90} bloccava il server in un
 *  loop infinito di kthExtract (30 minuti di CPU): l'app «non risolveva»
 *  l'espressione della foto. Ora:
 *   - forme IDENTICHE con indice negativo si verificano esattamente;
 *   - forme equivalenti (√[−2]{1/90} = 3√10) si verificano esattamente;
 *   - qualunque k < 2 arriva a kthExtract solo dopo la guardia anti-blocco. */
import { describe, it, expect } from "vitest";
import { contoGiusto, riparaEsercizio } from "./costruisci";
import {
  radicaleNegativaAPotenza,
  radicalePotenzaANegativa,
  risultatoRadicaleLatex,
} from "../client/src/lib/numericRadicalEquality";
import { replaceExpressionStep } from "../client/src/lib/progressiveExpression";

describe("radicale con indice negativo (foto utente 12/11)", () => {
  it("finale IDENTITARIO con conti pendenti: bocciato (collaudo n.6, «SOSTITUISCI FRAZIONI»)", () => {
    const candidato = {
      espressioneLatex: "2+3",
      sezioni: [{ title: "SOMMA", boxes: [{ op: "2+3", answerLatex: "5", prompt: "Sommo." }] }],
      righeProgressive: ["2+3", "5"],
      risultatoFinaleLatex: "2+3",
    };
    const esito = riparaEsercizio(candidato);
    expect(esito.esercizio).toBeNull();
    expect(esito.problemi.join(" ")).toContain("identico all'espressione di partenza");
  });

  it("ULTIMO BOX identitario su riga con conti da svolgere: bocciato (collaudo n.8, foto)", () => {
    /* L'IA converte i decimali ma poi lascia un box «SOSTITUISCI FRAZIONI»
     * che copia l'intera riga senza svolgere prodotti e divisioni: il finale
     * è la forma INTERMEDIA, non il risultato svolto. */
    const expr = "\\dfrac{0{,}6}{\\sqrt{0{,}01}}\\cdot \\dfrac{1}{x-1}";
    const intermedia = "\\dfrac{0{,}6}{0{,}1}\\cdot \\dfrac{1}{x-1}";
    const candidato = {
      espressioneLatex: expr,
      sezioni: [
        { title: "RADICALI", boxes: [{ op: "\\sqrt{0,01}", answerLatex: "0,1", prompt: "Calcolo la radice." }] },
        { title: "SOSTITUISCI FRAZIONI", boxes: [{ op: intermedia, answerLatex: intermedia, prompt: "Sostituisco le frazioni." }] },
      ],
      righeProgressive: [expr, intermedia],
      risultatoFinaleLatex: intermedia,
    };
    const esito = riparaEsercizio(candidato);
    expect(esito.esercizio).toBeNull();
    expect(esito.problemi.join(" ")).toContain("ripete l'espressione senza svolgere nulla");
  });

  it("finale GIUSTO dello stesso esercizio: accettato", () => {
    const candidato = {
      espressioneLatex: "2+3",
      sezioni: [{ title: "SOMMA", boxes: [{ op: "2+3", answerLatex: "5", prompt: "Sommo." }] }],
      righeProgressive: ["2+3", "5"],
      risultatoFinaleLatex: "5",
    };
    const esito = riparaEsercizio(candidato);
    expect(esito.esercizio).not.toBeNull();
    expect(esito.problemi).toEqual([]);
  });

  it("espressione GIÀ in forma minima con box identitario: accettata (nessun conto pendente)", () => {
    /* (12/11, collaudo n.8) il box identitario è lecito quando la riga è
     * già in forma minima («frazione finale pulita», 08/11): viene respinto
     * solo se nella riga restano conti da svolgere. */
    const candidato = {
      espressioneLatex: "\\sqrt{2}",
      sezioni: [{ title: "RADICALE", boxes: [{ op: "\\sqrt{2}", answerLatex: "\\sqrt{2}", prompt: "Già in forma minima." }] }],
      righeProgressive: ["\\sqrt{2}"],
      risultatoFinaleLatex: "\\sqrt{2}",
    };
    const esito = riparaEsercizio(candidato);
    expect(esito.esercizio).not.toBeNull();
    expect(esito.problemi).toEqual([]);
  });

  it("√[−2]{1/90} confrontato con se stesso si verifica in tempo finito (era un loop infinito)", () => {
    const esito = contoGiusto("\\sqrt[-2]{\\dfrac{1}{90}}", "\\sqrt[-2]{\\dfrac{1}{90}}");
    expect(esito.ok).toBe(true);
  });

  it("√[−2]{1/90} = 3√10 (reciproco con indice positivo)", () => {
    const esito = contoGiusto("\\sqrt[-2]{\\dfrac{1}{90}}", "3\\sqrt{10}");
    expect(esito.ok).toBe(true);
  });

  it("√[−3]{64} = 1/∛64 = 1/4", () => {
    const esito = contoGiusto("\\sqrt[-3]{64}", "\\dfrac{1}{4}");
    expect(esito.ok).toBe(true);
  });

  it("risultatoRadicaleLatex calcola √[−2]{1/90} → 3√10 (riparazione dei box)", () => {
    expect(risultatoRadicaleLatex("\\sqrt[-2]{\\dfrac{1}{90}}")).toBe("3\\sqrt{10}");
  });

  it("una radice con indice negativo DIVERSA non è accettata (niente falsi positivi)", () => {
    const esito = contoGiusto("\\sqrt[-2]{\\dfrac{1}{90}}", "2\\sqrt{10}");
    expect(esito.ok).toBe(false);
  });

  it("giustapposizione dopo \\dfrac con radice: (3√10/10)(x+1)² = 3√10(x+1)²/10 (box 25 della foto)", () => {
    const esito = contoGiusto("\\dfrac{3\\sqrt{10}}{10}\\left(x+1\\right)^{2}", "\\dfrac{3\\sqrt{10}\\left(x+1\\right)^{2}}{10}");
    expect(esito.ok).toBe(true);
  });

  it("giustapposizione (x+1)² senza \\left dopo \\dfrac con radice (box 21 della foto)", () => {
    const esito = contoGiusto("\\dfrac{3\\sqrt{10}}{10}\\cdot (x+1)^{2}", "\\dfrac{3\\sqrt{10}}{10}(x+1)^{2}");
    expect(esito.ok).toBe(true);
  });

  it("frazione di frazioni con giustapposizioni (box 22 della foto)", () => {
    const esito = contoGiusto(
      "\\dfrac{\\dfrac{5x-8}{3(x-2)}}{\\dfrac{3\\sqrt{10}}{10}(x+1)^{2}}",
      "\\dfrac{5x-8}{3(x-2)}\\cdot \\dfrac{10}{3\\sqrt{10}(x+1)^{2}}",
    );
    expect(esito.ok).toBe(true);
  });

  it("il LaTeX con graffa finale mancante si bilancia e si verifica (finale della foto)", () => {
    const esito = contoGiusto(
      "\\dfrac{\\sqrt{10}(5x-8)}{9(x-2)(x-1)(x+1)^{2}}",
      "\\dfrac{\\sqrt{10}(5x-8)}{9(x-2)(x-1)(x+1)^{2",
    );
    expect(esito.ok).toBe(true);
  });

  it("il bilanciamento non crea falsi positivi: risposta sbagliata resta bocciata", () => {
    const esito = contoGiusto(
      "\\dfrac{\sqrt{10}(5x-8)}{9(x-2)(x-1)(x+1)^{2}}",
      "\\dfrac{\sqrt{10}(5x-9)}{9(x-2)(x-1)(x+1)^{2",
    );
    expect(esito.ok).toBe(false);
  });

  it("il box degenere con radice negativa identica non blocca riparaEsercizio", () => {
    const candidato = {
      espressioneLatex: "\\sqrt[-2]{\\dfrac{1}{90}}\\cdot\\left(x+1\\right)",
      risultatoFinaleLatex: "\\dfrac{3\\sqrt{10}\\left(x+1\\right)}{1}",
      sezioni: [
        {
          title: "SVOLGIMENTO",
          boxes: [
            { op: "\\left(x+1\\right)", answerLatex: "x+1", prompt: "Copio il fattore letterale." },
            { op: "\\sqrt[-2]{\\dfrac{1}{90}}", answerLatex: "3\\sqrt{10}", prompt: "Trasformo la radice con indice negativo." },
          ],
        },
      ],
    };
    const esito = riparaEsercizio(candidato);
    expect(esito.esercizio).not.toBeNull();
  });

  it("giustapposizione davanti a \\left|: 2/(3|x−2|) si verifica (box 15 della foto)", () => {
    const esito = contoGiusto(
      "\\dfrac{1}{x-1}\\cdot \\dfrac{5}{3} + \\dfrac{1}{\\left|x-2\\right|} \\cdot \\dfrac{2}{3}",
      "\\dfrac{5}{3\\left(x-1\\right)} + \\dfrac{2}{3\\left|x-2\\right|}",
    );
    expect(esito.ok).toBe(true);
  });

  it("il box 9 si collega anche nel verso opposto: (∜((x−2)⁴))⁻¹ ↔ √[−4]{(x−2)⁴} (foto utente)", () => {
    // la riga ha (∜...)⁻¹, l'op la forma √[−4]: la conversione pot→neg dell'op
    // non serve qui (op già negativa); serve che la forma alternativa esista
    const op = "\\sqrt[-4]{\\left(x-2\\right)^{4}}";
    expect(radicaleNegativaAPotenza(op)).toBe("\\left(\\sqrt[4]{\\left(x-2\\right)^{4}}\\right)^{-1}");
  });

  it("collegamento box 9: √[−4]{(x−2)⁴} si collega alla riga con (∜((x−2)⁴))⁻¹ (foto utente)", () => {
    const riga = "\\dfrac{\\dfrac{1}{\\sqrt[3]{\\left(x-1\\right)^{3}}}\\cdot \\dfrac{5}{3}+\\left(\\sqrt[4]{\\left(x-2\\right)^{4}}\\right)^{-1}\\cdot \\dfrac{2}{3}}{\\sqrt[-2]{\\dfrac{1}{90}}\\cdot \\left(x+1\\right)^{2}\\cdot \\dfrac{1}{10}}";
    const op = "\\sqrt[-4]{\\left(x-2\\right)^{4}}";
    const alt = radicaleNegativaAPotenza(op);
    expect(alt).toContain("^{-1}");
    const successiva = replaceExpressionStep(riga, alt, "\\dfrac{1}{\\sqrt[4]{\\left(x-2\\right)^{4}}}");
    expect(successiva).not.toBeNull();
    // e il verso opposto: op con esponente −1, riga con indice negativo
    const alt2 = radicalePotenzaANegativa("x+\\left(\\sqrt[3]{\\left(x-1\\right)^{3}}\\right)^{-1}");
    expect(alt2).toContain("\\sqrt[-3]");
    expect(replaceExpressionStep("x+\\sqrt[-3]{\\left(x-1\\right)^{3}}", alt2, "x+\\dfrac{1}{x-1}")).not.toBeNull();
  });

  it("kthExtract con k < 2 non può più essere raggiunto (guardia anti-blocco)", () => {
    // kthExtract non è esportato: la guardia si verifica per via indiretta,
    // con il caso che UN TEMPO bloccava tutto (adesso finisce in tempo).
    const esito = contoGiusto("\\sqrt[-2]{\\dfrac{1}{90}}", "\\sqrt[-2]{\\dfrac{1}{90}}");
    expect(esito.ok).toBe(true);
  });
});
