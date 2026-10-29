import { describe, it, expect } from "vitest";
import { analyzeExpression, auditConti, latexValue } from "./espressioni";
import { applicaVerifica, type EsitoVerificaIA } from "./aiVerify";

/** 25/10 — SEZIONE DEI CONTI SEMPRE CORRETTA (richiesta utente con la foto
 *  di (1/3)^-6 : (1/6)^-3 + 1/6): (a) le frazioni impilate scritte
 *  dall'utente dentro le parentesi NON diventano conti finti («(1/3) =»);
 *  (b) auditConti verifica conti vuoti, risultati attesi e catena a valore
 *  costante; (c) applicaVerifica (IA propose, motore dispone). */

const FOTO = "\\left(\\dfrac{1}{3}\\right)^{-6} : \\left(\\dfrac{1}{6}\\right)^{-3} + \\dfrac{1}{6}";
const FOTO_DUE_PUNTI = "(1/3)^-6 : (1/6)^-3 + 1/6";

describe("frazione impilata dentro le parentesi: NON è un conto", () => {
  it("la foto non genera più il falso input «(1/3) =»", () => {
    const a = analyzeExpression(FOTO);
    const falsiConti = a.steps.filter(
      (s) => s.opLatex && s.answer && !/[+\-*/:^·]|\\cdot/.test(s.opLatex.replace(/\\left|\\right/g, "")),
    );
    expect(falsiConti).toEqual([]);
    // nessun paren-value interattivo: la parentesi con solo la frazione è notazione
    expect(a.steps.some((s) => s.kind === "paren-value" && s.opLatex)).toBe(false);
  });

  it("la catena della foto arriva al risultato giusto (85/24) con conti veri", () => {
    const a = analyzeExpression(FOTO);
    const ultimo = a.steps[a.steps.length - 1];
    expect(ultimo.kind).toBe("fold-add-num");
    expect(ultimo.answer).toEqual({ n: 85, d: 24 });
    // restano i VERI conti: (1/3)^6, (1/6)^3, 729·1/216, 27/8 + 1/6
    const op = a.steps.filter((s) => s.opLatex && s.answer).map((s) => s.opLatex);
    expect(op).toContain("\\left(\\dfrac{1}{3}\\right)^{6}");
    expect(op).toContain("729 \\cdot \\dfrac{1}{216}");
  });

  it("scritta coi DUE PUNTI (1 : 3) resta un vero conto per lo studente", () => {
    const a = analyzeExpression(FOTO_DUE_PUNTI);
    expect(a.steps.some((s) => s.kind === "paren-div" && s.opLatex === "1 : 3" && s.answer)).toBe(true);
  });

  it("auditConti pulito su entrambe le varianti", () => {
    expect(auditConti(analyzeExpression(FOTO).steps)).toEqual([]);
    expect(auditConti(analyzeExpression(FOTO_DUE_PUNTI).steps)).toEqual([]);
  });
});

describe("auditConti su un corpus di espressioni (nessuna regressione)", () => {
  const corpus = [
    "27 : 3 + 48 : 28",
    "2^3 · (4 - 6) : 2",
    "(2+3) · 4 - 10 : 5",
    "9 : 5",
    "1 : (3 : 4)",
    "x^2 : x^4",
    "2x^5 : x^7",
    "(2x)^3",
    "√√16",
    "√(x^6)",
    "9^(1/2)",
    "(1/3)^-4 : (1/3)^-2",
    "3/7 : 9/14",
    "5 : \\dfrac{1}{2^2}",
  ];
  for (const e of corpus) {
    it(`audit pulito: ${e}`, () => {
      const a = analyzeExpression(e);
      const viol = auditConti(a.steps);
      // ammesse SOLO segnalazioni di salto su catene con lettere (non valutabili
      // in modo affidabile): i conti vuoti e i risultati sbagliati MAI
      const gravi = viol.filter((v) => v.tipo !== "salto-errato");
      expect(gravi).toEqual([]);
    });
  }
});

describe("latexValue (valutatore del LaTeX del motore)", () => {
  it("valuta frazioni impilate, potenze, radici e divisioni", () => {
    expect(latexValue("\\dfrac{27}{8}")).toBeCloseTo(3.375);
    expect(latexValue("729 \\cdot \\dfrac{1}{216}")).toBeCloseTo(3.375);
    expect(latexValue("\\left(\\dfrac{1}{3}\\right)^{6}")).toBeCloseTo(1 / 729);
    expect(latexValue("1 : 3")).toBeCloseTo(1 / 3);
    expect(latexValue("2^{3}")).toBe(8);
    expect(latexValue("\\sqrt[3]{27}")).toBeCloseTo(3);
    expect(latexValue("\\dfrac{27}{8} + \\dfrac{1}{6}")).toBeCloseTo(85 / 24);
  });
  it("restituisce null su lettere o LaTeX sconosciuto (mai falsi positivi)", () => {
    expect(latexValue("x^{2}")).toBeNull();
    expect(latexValue("\\text{Esponente negativo}")).toBeNull();
    expect(latexValue("")).toBeNull();
  });
});

describe("applicaVerifica (IA propose, motore dispone)", () => {
  const steps = analyzeExpression(FOTO_DUE_PUNTI).steps;

  it("senza IA aplica solo l'audit deterministico (nessun cambiamento qui)", () => {
    expect(applicaVerifica(steps, null)).toBe(steps);
  });

  it("correzione VALIDA dell'IA (stesso valore della catena) → passo riparato", () => {
    // prende il passo mul-terms e simula un suo stato sbagliato corretto dall'IA
    const rotti = steps.map((s, i) =>
      i === steps.length - 2 ? { ...s, latex: "\\dfrac{27}{8} + \\dfrac{1}{5}" } : s,
    );
    const ultimoIdx = steps.length - 1;
    const esito: EsitoVerificaIA = {
      ok: false,
      steps: [{ i: ultimoIdx - 1, ok: false, correzione: "\\dfrac{27}{8} + \\dfrac{1}{6}" }],
    };
    const out = applicaVerifica(rotti, esito);
    expect(out[ultimoIdx - 1].latex).toBe("\\dfrac{27}{8} + \\dfrac{1}{6}");
  });

  it("correzione NON valida → il passo sbagliato viene scartato, mai mostrato", () => {
    const rotti = steps.map((s, i) =>
      i === steps.length - 2 ? { ...s, latex: "\\dfrac{27}{8} + \\dfrac{1}{5}" } : s,
    );
    const ultimoIdx = steps.length - 1;
    const esito: EsitoVerificaIA = {
      ok: false,
      steps: [{ i: ultimoIdx - 1, ok: false, correzione: "\\dfrac{99}{8} + \\dfrac{1}{6}" }],
    };
    const out = applicaVerifica(rotti, esito);
    expect(out.some((s) => s.latex === "\\dfrac{27}{8} + \\dfrac{1}{5}")).toBe(false);
    expect(out[out.length - 1].kind).toBe("fold-add-num");
  });

  it("l'IA che segnala TROPI passi viene ignorata (mai distruggere la catena)", () => {
    const esito: EsitoVerificaIA = {
      ok: false,
      steps: steps.map((_, i) => ({ i, ok: false })),
    };
    expect(applicaVerifica(steps, esito)).toBe(steps);
  });

  it("IA ok → nessun cambiamento (stesso array, nessun re-render)", () => {
    const esito: EsitoVerificaIA = { ok: true, steps: steps.map((_, i) => ({ i, ok: true })) };
    expect(applicaVerifica(steps, esito)).toBe(steps);
  });
});
