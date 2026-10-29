// ⚠️ PARENTESI VICINO A UNA FRAZIONE (segnalazione 19/10: «il riconoscimento
// delle varie tipologie di parentesi vicino alle frazioni rimane difficoltoso»).
// Due difetti corretti:
//  1. la soglia d'altezza delle parentesi usava l'altezza PIENA dell'espressione:
//     con una frazione impilata (≈ 2× una cifra) le parentesi scritte alte quanto
//     le cifre restavano sotto soglia e il modello le scambiava per altro;
//  2. rewriteStackedFractions assegnava ai lati della linea QUALSIASI tratto
//     sopra/sotto: una parentesi che tocca la frazione finiva DENTRO il
//     numeratore/denominatore e la lettura della frazione falliva.
import { describe, expect, it } from "vitest";
import { rewriteStackedFractions } from "./inkSigns";
import { shapeCandidates } from "./squareBrackets";
import type { SimpleStroke } from "./inkSigns";

const bar = (x0: number, x1: number, y: number): SimpleStroke => ({
  points: [{ x: x0, y }, { x: x1, y }],
  lineWidth: 3,
});

const digit = (x0: number, x1: number, y0: number, y1: number): SimpleStroke => ({
  points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
  lineWidth: 3,
});

/** Parentesi (verticale con due tick, come una quadra scritta in 3 tratti) */
const squareBracket = (x: number, y0: number, y1: number, tick = 12): SimpleStroke[] => [
  { points: [{ x, y: y0 }, { x, y: y1 }], lineWidth: 3 },
  { points: [{ x, y: y0 }, { x: x + tick, y: y0 }], lineWidth: 3 },
  { points: [{ x, y: y1 }, { x: x + tick, y: y1 }], lineWidth: 3 },
];

describe("rewriteStackedFractions — la parentesi NON finisce nella frazione (19/10)", () => {
  it("una parentesi alta che tocca la frazione resta nell'inchiostro", () => {
    // parentesi a sinistra, frazione «3/7» al centro (linea y=95, num 40–90, den 100–150)
    const bracket = squareBracket(15, 35, 155, 10); // h = 120 ≈ 2,4× la cifra
    const strokes: SimpleStroke[] = [
      ...bracket,
      digit(40, 80, 40, 90), // numeratore
      bar(35, 95, 95), // linea
      digit(40, 80, 100, 150), // denominatore
    ];
    const r = rewriteStackedFractions(strokes);
    expect(r.fracs).toHaveLength(1);
    // la parentesi NON è finita né nel numeratore né nel denominatore
    const all = r.fracs[0]!.numStrokes.length + r.fracs[0]!.denStrokes.length;
    expect(all).toBe(2);
    // ed è rimasta nell'inchiostro (uno strato successivo la riconosce)
    expect(r.strokes).toHaveLength(bracket.length);
  });

  it("una parentesi poco più alta della cifra (arca curva) non è num/den", () => {
    const bracket: SimpleStroke[] = [
      // arco: parte in alto, si curva verso la frazione, scende (w > 0,4·h ma h > 1,25× cifra)
      {
        points: [
          { x: 12, y: 30 },
          { x: 26, y: 60 },
          { x: 24, y: 110 },
          { x: 12, y: 150 },
        ],
        lineWidth: 3,
      },
    ];
    const strokes: SimpleStroke[] = [
      ...bracket,
      digit(40, 80, 55, 95), // numeratore (h = 40)
      bar(35, 95, 100),
      digit(40, 80, 105, 145), // denominatore
    ];
    const r = rewriteStackedFractions(strokes);
    expect(r.fracs).toHaveLength(1);
    expect(r.fracs[0]!.numStrokes.length + r.fracs[0]!.denStrokes.length).toBe(2);
    expect(r.strokes).toHaveLength(1);
  });

  it("le cifre della frazione restano num/den (nessun falso scarto)", () => {
    const strokes: SimpleStroke[] = [
      digit(40, 80, 55, 95),
      bar(35, 95, 100),
      digit(40, 80, 105, 145),
    ];
    const r = rewriteStackedFractions(strokes);
    expect(r.fracs).toHaveLength(1);
    expect(r.strokes).toHaveLength(0);
  });
});

describe("shapeCandidates — soglia d'altezza SENZA la frazione (19/10)", () => {
  it("una quadra alta 1,25× la cifra accanto a una frazione alta il doppio è candidata", () => {
    // Prima del fix: exprH comprendeva la frazione (span 110) → minH = 0,68·110
    // escludeva la quadra di 50. Ora l'altezza di riferimento ignora la frazione.
    const strokes: SimpleStroke[] = [
      ...squareBracket(140, 60, 110), // quadra h = 50
      digit(180, 220, 55, 85), // numeratore (h = 30)
      bar(170, 230, 90), // linea della frazione
      digit(180, 220, 95, 125), // denominatore (frazione: span 55–125)
      digit(280, 320, 50, 90), // cifra fuori dalla frazione (h = 40)
    ];
    const cands = shapeCandidates(strokes);
    const sq = cands.filter((c) => c.kind === "square");
    expect(sq.length).toBeGreaterThan(0);
  });

  it("una cifra alta quanto le altre NON diventa parentesi (niente falsi positivi)", () => {
    const strokes: SimpleStroke[] = [
      digit(100, 140, 50, 90),
      digit(180, 220, 55, 85),
      bar(170, 230, 90),
      digit(180, 220, 95, 125),
      digit(280, 320, 50, 90),
    ];
    const cands = shapeCandidates(strokes);
    expect(cands).toHaveLength(0);
  });

  it("pezzo di sola frazione: nessuna candidata, nessun errore", () => {
    const strokes: SimpleStroke[] = [
      digit(40, 80, 55, 95),
      bar(35, 95, 100),
      digit(40, 80, 105, 145),
    ];
    expect(shapeCandidates(strokes)).toHaveLength(0);
  });
});
