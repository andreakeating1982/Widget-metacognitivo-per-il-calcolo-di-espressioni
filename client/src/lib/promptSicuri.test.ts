import { describe, it, expect } from "vitest";
import { ripulisciPrompt } from "./promptSicuri";
import { riparaEsercizio } from "../../../server/costruisci";

/** 26/10 — foto utente «non dire mai la soluzione neanche per iscritto»:
 *  il box diceva «… = RADICE DI 6» regalando il risultato √6. La frase
 *  didattica guida il METODO, mai il RISULTATO. I dati del box (numeri
 *  visibili) si possono nominare; il resto si taglia. */

describe("ripulisciPrompt: mai la soluzione nella frase (foto utente)", () => {
  it("FOTO: «RADICE DI (3/4 PER 8) = RADICE DI 6» → via il risultato", () => {
    const r = ripulisciPrompt(
      "MOLTIPLICO SOTTO RADICE: RADICE DI (3/4 PER 8) = RADICE DI 6.",
      "\\sqrt{\\dfrac{3}{4}}\\cdot\\sqrt{8}",
      "\\sqrt{6}",
    );
    expect(r.ripulito).toBe(true);
    expect(r.testo.toUpperCase()).not.toContain("RADICE DI 6");
    expect(r.testo.toUpperCase()).not.toContain("SEI");
    expect(r.testo).toMatch(/moltiplico/i);
  });

  it("la risposta in cifre dopo «=» si taglia, il metodo resta", () => {
    const r = ripulisciPrompt(
      "Sommo le frazioni allo stesso denominatore: 9/8 - 6/8 = 3/8.",
      "\\dfrac{9}{8}-\\dfrac{6}{8}",
      "\\dfrac{3}{8}",
    );
    expect(r.testo).not.toContain("3/8");
    expect(r.testo).toMatch(/stesso denominatore/i);
  });

  it("«mcm(2,3)=6» è METODO e resta intatto (esempio del prompt IA)", () => {
    const r = ripulisciPrompt(
      "Porto allo stesso denominatore: mcm(2,3)=6.",
      "\\dfrac{1}{2}+\\dfrac{1}{3}",
      "\\dfrac{5}{6}",
    );
    expect(r.ripulito).toBe(false);
    expect(r.testo).toBe("Porto allo stesso denominatore: mcm(2,3)=6.");
  });

  it("«radice di 9» con √9 nei dati resta (lo studente calcola da solo)", () => {
    const r = ripulisciPrompt(
      "Calcolo la radice di 9.",
      "\\sqrt{9}+1",
      "4",
    );
    expect(r.ripulito).toBe(false);
    expect(r.testo).toBe("Calcolo la radice di 9.");
  });

  it("«radice di sei» a parole si taglia se è la risposta", () => {
    const r = ripulisciPrompt(
      "Moltiplico sotto radice e ottengo radice di sei.",
      "\\sqrt{\\dfrac{3}{4}}\\cdot\\sqrt{8}",
      "\\sqrt{6}",
    );
    expect(r.ripulito).toBe(true);
    expect(r.testo.toLowerCase()).not.toContain("sei");
  });

  it("risposta con lettere «5x» scritta tale e quale si cancella", () => {
    const r = ripulisciPrompt("Sommo i termini simili: 5x.", "2x+3x", "5x");
    expect(r.ripulito).toBe(true);
    expect(r.testo.toLowerCase()).not.toContain("5x");
  });

  it("lettere già nell'operazione restano («2x+3x» è metodo)", () => {
    const r = ripulisciPrompt("Sommo 2x+3x.", "2x+3x", "5x");
    expect(r.ripulito).toBe(false);
  });

  it("«tre quarti» con numeri visibili resta; con numeri derivati si taglia", () => {
    const resta = ripulisciPrompt(
      "Moltiplico tre quarti per otto.",
      "\\dfrac{3}{4}\\cdot 8",
      "6",
    );
    expect(resta.ripulito).toBe(false);
    const via = ripulisciPrompt(
      "Semplifico: tre quarti per otto fa sei interi.",
      "\\dfrac{3}{4}\\cdot 8",
      "6",
    );
    expect(via.ripulito).toBe(true);
    expect(via.testo.toLowerCase()).not.toContain("sei");
  });

  it("frase vuota dopo il taglio → invito al metodo, mai vuota", () => {
    const r = ripulisciPrompt("= 6.", "1+2+3", "6");
    expect(r.testo.length).toBeGreaterThan(0);
    expect(r.testo).not.toContain("6");
  });
});

const L2 = (s: string) => s;

/* 26/10 — foto utente «non dire mai la soluzione neanche per iscritto»:
   il box diceva «MOLTIPLICO SOTTO RADICE: RADICE DI (3/4 PER 8) = RADICE DI 6».
   riparaEsercizio ripulisce la frase (via il risultato, resta il metodo). */
describe("riparaEsercizio: la frase non rivela mai il risultato", () => {
  const base = {
    espressioneLatex: L2("\\sqrt{\\dfrac{3}{4}}\\cdot\\sqrt{8}"),
    sezioni: [
      {
        title: "MOLTIPLICO",
        boxes: [
          {
            op: L2("\\sqrt{\\dfrac{3}{4}}\\cdot\\sqrt{8}"),
            prompt: "MOLTIPLICO SOTTO RADICE: RADICE DI (3/4 PER 8) = RADICE DI 6.",
            answerLatex: L2("\\sqrt{6}"),
          },
        ],
      },
    ],
    righeProgressive: [
      L2("\\sqrt{\\dfrac{3}{4}}\\cdot\\sqrt{8}"),
      L2("\\sqrt{6}"),
    ],
    risultatoFinaleLatex: L2("\\sqrt{6}"),
  };
  it("la frase della foto viene ripulita (via «RADICE DI 6»)", () => {
    const esito = riparaEsercizio(structuredClone(base));
    expect(esito.esercizio).not.toBeNull();
    const frase = esito.esercizio!.sezioni[0].boxes[0].prompt ?? "";
    expect(frase.toUpperCase()).not.toContain("RADICE DI 6");
    expect(frase.toUpperCase()).not.toContain("SEI");
    expect(frase).toMatch(/moltiplico/i);
    expect(esito.avvertenze.some((a) => /frase didattica ripulita/i.test(a))).toBe(true);
  });
  it("una frase di solo metodo resta intatta (mcm protetto)", () => {
    const copia = structuredClone(base);
    copia.sezioni[0].boxes[0].prompt = "Porto allo stesso denominatore: mcm(2,3)=6.";
    copia.sezioni[0].boxes[0].op = L2("\\dfrac{1}{2}+\\dfrac{1}{3}");
    copia.sezioni[0].boxes[0].answerLatex = L2("\\dfrac{5}{6}");
    const esito = riparaEsercizio(copia);
    expect(esito.esercizio).not.toBeNull();
    expect(esito.esercizio!.sezioni[0].boxes[0].prompt).toBe("Porto allo stesso denominatore: mcm(2,3)=6.");
  });
});

/* 26/10 — caso reale IA: «(3/4)·8 = 6» con risposta √6 (frazione × numero). */
describe("ripulisciPrompt: frazione × numero che dà la risposta", () => {
  it("«(3/4)·8 = 6» con risposta √6 → via «= 6», resta il metodo con i dati", () => {
    const r = ripulisciPrompt(
      "Moltiplico i radicandi sotto un'unica radice: (3/4)·8 = 6.",
      "\\sqrt{\\dfrac{3}{4}}\\cdot\\sqrt{8}",
      "\\sqrt{6}",
    );
    expect(r.ripulito).toBe(true);
    expect(r.testo).not.toContain("= 6");
    expect(r.testo.toUpperCase()).not.toContain("RADICE DI 6");
    expect(r.testo).toMatch(/unica radice/i);
  });
  it("«2+3» nel box «2+3» resta (tutti i numeri visibili: è metodo)", () => {
    const r = ripulisciPrompt("Sommo 2+3.", "2+3", "5");
    expect(r.ripulito).toBe(false);
  });
});
