import { describe, expect, it } from "vitest";
import {
  conteggioPrimoColpo,
  messaggioPerStelle,
  registraPrimoValore,
  rispostaFrazionariaComposta,
  stellePerPrimoColpo,
  type PrimoValore,
} from "./EsercizioFrazioni";
import { costruisciFrazioniConiugate } from "../../../server/prodottiNotevoli";
import { riparaEsercizio } from "../../../server/costruisci";

describe("registraPrimoValore (risposte al primo colpo)", () => {
  it("la prima risposta pubblicata resta quella valida", () => {
    let p: Record<string, PrimoValore> = {};
    p = registraPrimoValore(p, "b1", null, null);
    expect(p["b1"]).toBeUndefined(); // cancellare non è rispondere
    p = registraPrimoValore(p, "b1", 2, null); // primo tentativo sbagliato
    p = registraPrimoValore(p, "b1", 6, null); // correzione: NON sostituisce
    expect(p["b1"]).toEqual({ valore: 2, testo: null });
  });

  it("una risposta vuota non conta come tentativo", () => {
    let p: Record<string, PrimoValore> = {};
    p = registraPrimoValore(p, "b1", null, "   ");
    expect(p["b1"]).toBeUndefined();
    p = registraPrimoValore(p, "b1", null, "x+2");
    expect(p["b1"]).toEqual({ valore: null, testo: "x+2" });
    p = registraPrimoValore(p, "b1", 3, null); // via numerica dopo la simbolica: non cambia
    expect(p["b1"]).toEqual({ valore: null, testo: "x+2" });
  });
});

describe("stellePerPrimoColpo", () => {
  it("proporzione su 5 stelline", () => {
    expect(stellePerPrimoColpo(6, 6)).toBe(5);
    expect(stellePerPrimoColpo(4, 6)).toBe(3);
    expect(stellePerPrimoColpo(10, 11)).toBe(4); // cinque solo se tutte giuste
    expect(stellePerPrimoColpo(1, 20)).toBe(1); // valorizza anche un solo primo colpo
    expect(stellePerPrimoColpo(0, 6)).toBe(0);
    expect(stellePerPrimoColpo(1, 0)).toBe(0);
    expect(stellePerPrimoColpo(-1, 6)).toBe(0);
  });
});

describe("messaggioPerStelle (feedback incoraggiante)", () => {
  it.each([
    [5, "OTTIMO LAVORO!"],
    [4, "HAI FATTO UN BUON LAVORO!"],
    [3, "HAI FATTO UN BUON LAVORO!"],
    [2, "CONTINUA A ESERCITARTI!"],
    [1, "CONTINUA A ESERCITARTI!"],
    [0, "CONTINUA A ESERCITARTI!"],
  ])("con %i stelle mostra %s", (stelle, messaggio) => {
    expect(messaggioPerStelle(stelle)).toBe(messaggio);
  });
  it("riserva ottimo lavoro al punteggio perfetto anche con un solo box", () => {
    expect(messaggioPerStelle(stellePerPrimoColpo(1, 1))).toBe("OTTIMO LAVORO!");
    expect(messaggioPerStelle(stellePerPrimoColpo(5, 6))).toBe("HAI FATTO UN BUON LAVORO!");
    expect(messaggioPerStelle(stellePerPrimoColpo(0, 1))).toBe("CONTINUA A ESERCITARTI!");
  });
});

describe("rispostaFrazionariaComposta (regola di trascrizione)", () => {
  it.each([
    ["\\dfrac{3\\cdot(x+2)+2\\cdot(x-2)}{(x-2)(x+2)}", true],
    ["(x^2+6x)/((x+1)(4-x))", true],
    ["\\dfrac{x^2-4}{1}", true],
    ["(x+2)/3", true],
    ["\\dfrac{2x+3}{x-5}", true],
    ["((x+2)/(x-2))", true],
    ["-(x+2)/(x-2)", true],
    ["3x/(x+2)", true],
  ])("composta: %s → true", (attesa, atteso) => {
    expect(rispostaFrazionariaComposta(attesa)).toBe(atteso);
  });

  it.each([
    ["\\dfrac{1}{6}", false],
    ["\\dfrac{9}{8}", false],
    ["x/2", false],
    ["3x/2", false],
    ["x+\\dfrac{1}{x+2}", false],
    ["x+3/(x+2)", false],
    ["3/(x-2)+2/(x+2)", false],
    ["x^2+6x", false],
    ["(x-2)(x+2)", false],
    ["3rad2(15)", false],
    [undefined, false],
    ["", false],
  ])("semplice o non frazionaria: %s → false", (attesa, atteso) => {
    expect(rispostaFrazionariaComposta(attesa)).toBe(atteso);
  });
});

describe("conteggioPrimoColpo (sui box dell'esercizio)", () => {
  const boxes = [
    { id: "b1", op: "\\dfrac{1}{4}+\\dfrac{7}{8}", answer: 9 / 8, answerLatex: "\\dfrac{9}{8}" },
    { id: "b2", op: "x+2", answer: NaN, answerLatex: "x+2", simbolico: true, rispostaAttesa: "x+2" },
  ];
  it("conta solo le prime risposte giuste", () => {
    const primi: Record<string, PrimoValore> = {
      b1: { valore: 9 / 8, testo: null }, // giusto al primo colpo
      b2: { valore: null, testo: "x+3" }, // primo tentativo sbagliato
    };
    expect(conteggioPrimoColpo(boxes, primi)).toEqual({ primoColpo: 1, totale: 2 });
  });
  it("un box mai risposto non è al primo colpo", () => {
    expect(conteggioPrimoColpo(boxes, {})).toEqual({ primoColpo: 0, totale: 2 });
  });

  it("conta sei primi tentativi validi, inclusa una forma equivalente riordinata", () => {
    const esercizio = riparaEsercizio(costruisciFrazioniConiugate("3/(x-2)+2/(x+2)")).esercizio!;
    /* (12/11) i box C.E. non hanno risposte nel test: si contano solo i conti */
    const guidati = esercizio.sezioni.flatMap(s => s.boxes).filter(b => !b.condizioniEsistenza).map((b, i) => ({
      ...b, id: `b${i+1}`, answer: NaN, simbolico: true, rispostaAttesa: b.answerLatex,
    }));
    const risposte = ["(3*(x+2)+2*(x-2))/((x-2)*(x+2))", "6+3x", "2x-4", "5x", "2", "x^2-4"];
    const primi = Object.fromEntries(risposte.map((testo, i) => [`b${i+1}`, { valore: null, testo }]));
    expect(conteggioPrimoColpo(guidati, primi)).toEqual({ primoColpo: 6, totale: 6 });
    primi.b1.testo = "(2+5x)/((x-2)*(x+2))";
    primi.b6.testo = "-4+x^2";
    expect(conteggioPrimoColpo(guidati, primi)).toEqual({ primoColpo: 6, totale: 6 });
    // Ripetere l'operazione non deve rivelare il risultato calcolato dal motore.
    primi.b1.testo = "3/(x-2)+2/(x+2)";
    primi.b6.testo = "(x+2)*(x-2)";
    expect(conteggioPrimoColpo(guidati, primi)).toEqual({ primoColpo: 4, totale: 6 });
  });
});

