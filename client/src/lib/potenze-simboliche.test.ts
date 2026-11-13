import { describe, it, expect } from "vitest";
import { analyzeExpression, auditProgressivita, auditConti } from "./espressioni";

/** (08/11, richiesta utente — foto «potenze con numeri grandi») Le
 *  espressioni di sole POTENZE a base numerica il cui risultato supera
 *  2^53 (es. 2^57) non sono calcolabili con l'aritmetica esatta dell'app:
 *  PRIMA l'app rispondeva «Numeri troppo grandi» e l'esercizio non si
 *  preparava. ORA le proprietà delle potenze restano SIMBOLICHE, come sul
 *  libro: lo studente digita SOLO gli ESPONENTI (numeri piccoli: 18, 72,
 *  64, 7, 57) e lo stato resta una potenza (2^18 → 2^72 → 2^64 → 2^57).
 *  MAI il valore enorme, mai una soluzione anticipata. */
describe("potenze simboliche (08/11): proprietà con numeri oltre 2^53", () => {
  it("espressione della foto con quadre: [(2^15·2^3)^4 : 2^8] : (2^15 : 2^8) → catena di esponenti 18, 72, 64, 7, 57", () => {
    const a = analyzeExpression("[(2^15·2^3)^4:2^8]:(2^15:2^8)");
    // PRIMA di oggi: ExprError «Numeri troppo grandi per mantenere il
    // calcolo esatto» — l'esercizio non si preparava affatto.
    const exponents = a.steps.filter((s) => s.kind === "pow-pow-exp" || s.kind === "pow-prop-exp");
    expect(exponents.map((s) => s.answer?.n)).toEqual([18, 72, 64, 7, 57]);
    // Ogni inserimento è un ESPONENTE piccolo, mai il valore enorme.
    for (const s of exponents) {
      expect(Math.abs(s.answer!.n)).toBeLessThan(1000);
      expect(s.symbolicResultLatex).toMatch(/^\d+\^\{\d+\}$/);
    }
    // Ordine dei kind: spiegazione pow-pow, base riscritta, esponente
    // prodotto, poi le proprietà della stessa base con esponente.
    expect(a.steps[1].kind).toBe("pow-pow");
    expect(a.steps[1].detail).toContain("Potenza di potenza");
    expect(a.steps.map((s) => s.kind)).toEqual([
      "paren-unwrap",
      "pow-pow",
      "pow-pow-exp",
      "pow-pow-exp",
      "pow-prop",
      "pow-prop-exp",
      "paren-unwrap",
      "pow-prop",
      "pow-prop-exp",
      "paren-unwrap",
      "pow-prop",
      "pow-prop-exp",
    ]);
    // Il risultato finale resta la POTENZA (2^57): mai 144.115.188.075.855.872.
    // (finalLatex non conta qui: la UI mostra finalSymbolicLatex.)
    expect(a.finalSymbolicLatex).toBe("2^{57}");
    expect(a.steps.some((s) => s.answer && Math.abs(s.answer.n) > 2 ** 20)).toBe(false);
    // Nessuna violazione di progressività né dei conti (audit del motore).
    expect(auditProgressivita(a.steps)).toEqual([]);
    expect(auditConti(a.steps)).toEqual([]);
  });

  it("stesso flusso senza quadre e con tonde a destra: (2^15·2^3)^4:2^8:(2^15:2^8) → 2^57", () => {
    const a = analyzeExpression("(2^15·2^3)^4:2^8:(2^15:2^8)");
    const exponents = a.steps.filter((s) => s.kind === "pow-pow-exp" || s.kind === "pow-prop-exp");
    expect(exponents.map((s) => s.answer?.n)).toEqual([18, 72, 64, 7, 57]);
    expect(a.finalSymbolicLatex).toBe("2^{57}");
    expect(auditConti(a.steps)).toEqual([]);
    expect(auditProgressivita(a.steps)).toEqual([]);
  });

  it("(2^18)^4 da sola: spiegazione segnalata + UN SOLO esponente 72 → 2^72", () => {
    const a = analyzeExpression("(2^18)^4");
    expect(a.steps[1].kind).toBe("pow-pow");
    expect(a.steps[1].detail).toContain("18 \\cdot 4");
    expect(a.steps[2].kind).toBe("pow-pow-exp");
    expect(a.steps[2].answer?.n).toBe(72);
    expect(a.steps[2].opLatex).toBe("\\left(2^{18}\\right)^{4}");
    expect(a.steps[2].symbolicResultLatex).toBe("2^{72}");
    expect(a.finalSymbolicLatex).toBe("2^{72}");
    expect(auditProgressivita(a.steps)).toEqual([]);
  });

  it("(2^15·2^3)^4: la base si riscrive PRIMA (esponente 18) e poi la potenza di potenza (72)", () => {
    const a = analyzeExpression("(2^15·2^3)^4");
    expect(a.steps[1].kind).toBe("pow-pow");
    // primo inserimento: l'ESPONENTE della base riscritta (15+3)
    expect(a.steps[2].kind).toBe("pow-pow-exp");
    expect(a.steps[2].answer?.n).toBe(18);
    expect(a.steps[2].opLatex).toBe("2^{15} \\cdot 2^{3}");
    expect(a.steps[2].symbolicResultLatex).toBe("2^{18}");
    // secondo inserimento: l'esponente della potenza di potenza (18·4)
    expect(a.steps[3].kind).toBe("pow-pow-exp");
    expect(a.steps[3].answer?.n).toBe(72);
    expect(a.steps[3].opLatex).toBe("\\left(2^{18}\\right)^{4}");
    expect(a.finalSymbolicLatex).toBe("2^{72}");
    expect(auditConti(a.steps)).toEqual([]);
  });

  it("2^72 : 2^8 → proprietà stessa base in modalità simbolica: esponente 64, stato 2^64", () => {
    const a = analyzeExpression("2^72:2^8");
    expect(a.steps[1].kind).toBe("pow-prop");
    expect(a.steps[1].detail).toContain("72 - 8");
    expect(a.steps[2].kind).toBe("pow-prop-exp");
    expect(a.steps[2].answer?.n).toBe(64);
    expect(a.steps[2].opLatex).toBe("2^{72} : 2^{8}");
    expect(a.steps[2].symbolicResultLatex).toBe("2^{64}");
    expect(a.finalSymbolicLatex).toBe("2^{64}");
    expect(auditConti(a.steps)).toEqual([]);
  });

  it("2^64 : (2^15 : 2^8): il segmento tra tonde resta simbolico (2^7) e la divisione finale usa la proprietà → 2^57", () => {
    const a = analyzeExpression("2^64:(2^15:2^8)");
    const exponents = a.steps.filter((s) => s.kind === "pow-prop-exp");
    // 2^64 è già scritto come potenza: le proprietà da applicare sono solo
    // il segmento tra tonde (15−8) e la divisione finale (64−7).
    expect(exponents.map((s) => s.answer?.n)).toEqual([7, 57]);
    // il segmento tra tonde NON si appiattisce mai in 128
    expect(a.steps.some((s) => s.latex.includes("128"))).toBe(false);
    expect(a.finalSymbolicLatex).toBe("2^{57}");
    expect(auditConti(a.steps)).toEqual([]);
  });

  it("REGRESSIONE — potenze PICCOLE: (2^3)^5 resta numerico (prodotto ripetuto → 32768), niente pow-pow", () => {
    const a = analyzeExpression("(2^3)^5");
    expect(a.steps.some((s) => s.kind === "pow-pow" || s.kind === "pow-pow-exp")).toBe(false);
    // percorso storico: (2^3) si svolge a parte (8) e poi 8^5 = 32768
    const pp = a.steps.find((s) => s.kind === "paren-prod");
    expect(pp?.answer?.n).toBe(8);
    const pt = a.steps.find((s) => s.kind === "pow-term");
    expect(pt?.answer?.n).toBe(32768);
    expect(a.finalLatex).toBe("32768");
  });

  it("REGRESSIONE — 2^6 : 2^2 resta a VALORE (risultato 16), non a esponente", () => {
    const a = analyzeExpression("2^6:2^2");
    expect(a.steps.some((s) => s.kind === "pow-prop-exp")).toBe(false);
    const fin = a.steps.find((s) => s.kind === "pow-prop-final");
    expect(fin?.answer?.n).toBe(16);
    expect(a.finalLatex).toBe("16");
  });

  it("REGRESSIONE — (1/3)^-4 : (1/3)^-2 + 1/6 (flusso dorato 25/10) resta identico", () => {
    const a = analyzeExpression("\\left(\\frac{1}{3}\\right)^{-4} : \\left(\\frac{1}{3}\\right)^{-2} + \\frac{1}{6}");
    expect(a.steps.some((s) => s.kind === "pow-prop-exp" || s.kind === "pow-pow")).toBe(false);
    const fin = a.steps.find((s) => s.kind === "pow-prop-final");
    expect(fin?.answer?.n).toBe(9);
  });

  it("potenza grande DA SOLA (3^40): resta l'errore chiaro (nessuna proprietà da applicare)", () => {
    expect(() => analyzeExpression("3^40")).toThrow(/troppo grandi/i);
  });

  it("(2^18)^4 : 2^8 : 128 (divisore già svolto dallo studente): la catena si ferma senza esplodere e senza inventare risultati", () => {
    let a: ReturnType<typeof analyzeExpression> | null = null;
    expect(() => {
      a = analyzeExpression("(2^18)^4:2^8:128");
    }).not.toThrow();
    // niente finale numerico inventato: il motore non può svolgere 2^64 : 128
    // → lo stato finale resta onestamente la catena ferma (mostrato dalla UI).
    expect(a!.finalSymbolicLatex).toContain("2^{64}");
    expect(a!.finalSymbolicLatex).toContain("128");
  });

  it("esponente risultato NEGATIVO in modalità simbolica: 2^3 : 2^70 → flip e valore esatto 1/2^67 non richiesto", () => {
    // 3 - 70 = -67: la proprietà dà un esponente negativo; il valore 1/2^67
    // non è calcolabile esattamente → resta la forma del libro.
    let a: ReturnType<typeof analyzeExpression> | null = null;
    expect(() => {
      a = analyzeExpression("2^3:2^70");
    }).not.toThrow();
    const exp = a!.steps.find((s) => s.kind === "pow-prop-exp");
    expect(exp?.answer?.n).toBe(-67);
    expect(a!.finalSymbolicLatex ?? a!.finalLatex).toContain("2");
  });
});
