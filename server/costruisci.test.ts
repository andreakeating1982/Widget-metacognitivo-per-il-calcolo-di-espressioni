import { describe, it, expect } from "vitest";
import { contoGiusto, riparaEsercizio } from "./costruisci";

/** 26/10 — ESONENTI NEGATIVI NELLA COSTRUZIONE IA (foto utente:
 *  «(2ab)^-1 · 4ab + (1/2)^-2 - 4ab - 4» non si costruiva in produzione,
 *  sì in locale: l'IA risponde con forme equivalenti diverse e la vecchia
 *  verifica dichiarava «forme non uguali» appena polyEquals falliva, SENZA
 *  provare i percorsi razionali esatti (evalRat, sostituzione) che reggono
 *  gli esponenti negativi. La correzione: polinomi diversi NON è un
 *  verdetto — si prova anche la via fratta e la sostituzione. */

const L = (s: string) => s.replace(/­/g, "");

describe("contoGiusto con esponenti negativi", () => {
  it("(2ab)^{-1}·4ab = 2 passa (poly uguale)", () => {
    const r = contoGiusto(
      L("\\left(2ab\\right)^{-1}\\cdot4ab"),
      "2",
    );
    expect(r.ok).toBe(true);
  });

  it("(2ab)^{-1}·4ab = 4ab:2ab = 2 (forme div) passa", () => {
    const r = contoGiusto(L("\\dfrac{4ab}{2ab}"), "2");
    expect(r.ok).toBe(true);
  });

  it("(1/2)^{-2} = 4 passa", () => {
    const r = contoGiusto(L("\\left(\\frac{1}{2}\\right)^{-2}"), "4");
    expect(r.ok).toBe(true);
  });

  it("x^{-2}·2x = 2/x (fratta) passa anche se polyEqual fallisce", () => {
    // 2x·x^-2 = 2/x: parsePolyLoose di 2/x → divisione per monomio ok;
    // \dfrac{2}{x} come fratta coincide
    const r = contoGiusto(L("2x\\cdot x^{-2}"), L("\\dfrac{2}{x}"));
    expect(r.ok).toBe(true);
  });

  it("l'espressione intera della foto = 2-4ab passa", () => {
    const r = contoGiusto(
      L("\\left(2ab\\right)^{-1}\\cdot4ab+\\left(\\frac{1}{2}\\right)^{-2}-4ab-4"),
      L("2-4ab"),
    );
    expect(r.ok).toBe(true);
  });

  it("un conto DAVVERO sbagliato resta respinto", () => {
    const r = contoGiusto(
      L("\\left(2ab\\right)^{-1}\\cdot4ab"),
      "4", // sbagliato: vale 2
    );
    expect(r.ok).toBe(false);
  });
});

/* 26/10 — OPZIONE A (richiesta esplicita dell'utente): le regole che
   bocciavano l'esercizio sono TOLTE; il motore locale ripara i conti. */
describe("riparaEsercizio (Opzione A: la pagina 3 si apre sempre)", () => {
  it("risposta dell'IA sbagliata → ricalcolata dal motore (frazione impilata)", () => {
    const raw = {
      espressioneLatex: "\\dfrac{1}{2}+\\dfrac{1}{3}",
      sezioni: [{ title: "SOMMO LE FRAZIONI", boxes: [{ op: "\\dfrac{1}{2}+\\dfrac{1}{3}", prompt: "Porto allo stesso denominatore.", answerLatex: "\\dfrac{2}{5}" }] }],
      righeProgressive: ["\\dfrac{1}{2}+\\dfrac{1}{3}", "\\dfrac{5}{6}"],
      risultatoFinaleLatex: "\\dfrac{5}{6}",
    };
    const esito = riparaEsercizio(raw);
    expect(esito.esercizio).not.toBeNull();
    expect(esito.esercizio!.sezioni[0].boxes[0].answerLatex).toBe("\\dfrac{5}{6}");
  });

  it("4ab·(2ab)^-1 con risposta mancante → il motore calcola 2", () => {
    const raw = {
      espressioneLatex: "4ab\\cdot\\left(2ab\\right)^{-1}",
      sezioni: [{ boxes: [{ op: "4ab\\cdot\\left(2ab\\right)^{-1}" }] }],
      righeProgressive: [],
      risultatoFinaleLatex: "",
    };
    const esito = riparaEsercizio(raw);
    expect(esito.esercizio).not.toBeNull();
    expect(esito.esercizio!.sezioni[0].boxes[0].answerLatex).toBe("2");
    expect(esito.esercizio!.risultatoFinaleLatex).toBe("2");
    expect(esito.esercizio!.righeProgressive[0]).toContain("4ab");
  });

  it("(2ab)^-1 → il motore produce la frazione impilata 1/(2ab) e marca il box simbolico", () => {
    const raw = {
      espressioneLatex: "\\left(2ab\\right)^{-1}",
      sezioni: [{ boxes: [{ op: "\\left(2ab\\right)^{-1}", answerLatex: "sbagliato" }] }],
      righeProgressive: ["\\left(2ab\\right)^{-1}", "\\dfrac{1}{2ab}"],
      risultatoFinaleLatex: "\\dfrac{1}{2ab}",
    };
    const esito = riparaEsercizio(raw);
    expect(esito.esercizio).not.toBeNull();
    expect(esito.esercizio!.sezioni[0].boxes[0].answerLatex).toBe("\\dfrac{1}{2ab}");
    expect(esito.esercizio!.sezioni[0].boxes[0].simbolico).toBe(true);
  });

  it("prompt mancante e righe progressive sbagliate NON bloccano più", () => {
    const raw = {
      espressioneLatex: "2+3",
      sezioni: [{ boxes: [{ op: "2+3", answerLatex: "5" }] }],
      righeProgressive: ["solo una riga"],
      risultatoFinaleLatex: "5",
    };
    const esito = riparaEsercizio(raw);
    expect(esito.esercizio).not.toBeNull();
  });

  it("senza espressioneLatex o senza box → non recuperabile (riprova)", () => {
    expect(riparaEsercizio({}).esercizio).toBeNull();
    expect(
      riparaEsercizio({ espressioneLatex: "2+2", sezioni: [{ boxes: [] }] }).esercizio,
    ).toBeNull();
  });
});
