// Test PERMANENTE (ex diagnostica): la graffa disegnata a mano in CONTESTO
// (con cifre vicine, normali o alte) deve essere estratta come graffa e non
// lasciare nell'inchiostro nulla che il modello possa leggere «\sum».
// Copre le varianti di disegno: estremità-all'estremo, zigzag, DUE TRATTI
// (due metà sovrapposte in x), con cifre normali (~62 px) e ALTE (~100 px).
import { describe, expect, it } from "vitest";
import { detectBracketKinds, detectCurlyResidues, rewriteBrackets } from "./squareBrackets";
import type { SimpleStroke } from "./dotSigns";

function interp(pts: [number, number][]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    for (let t = 0; t < 8; t++) {
      out.push({ x: x0 + ((x1 - x0) * t) / 8, y: y0 + ((y1 - y0) * t) / 8 });
    }
  }
  out.push({ x: pts[pts.length - 1]![0], y: pts[pts.length - 1]![1] });
  return out;
}
const S = (points: { x: number; y: number }[], lineWidth = 3): SimpleStroke => ({ points, lineWidth });

/** Specchia un tratto su un asse verticale: la forma APERTA diventa CHIUSA. */
const mirrorX = (s: SimpleStroke, axis: number): SimpleStroke => ({
  ...s,
  points: s.points.map((p) => ({ x: 2 * axis - p.x, y: p.y })),
});

const VARIANTI: [string, (x0: number, y0: number, y1: number) => SimpleStroke][] = [
  ["estremità-all'estremo", (x0, y0, y1) => {
    const h = y1 - y0;
    const bulgeX = x0 + 0.82 * (y1 - y0) * 0.36;
    return S(interp([
      [x0 + 14, y0],
      [x0 + 14, y0 + 0.12 * h],
      [x0 + 10, y0 + 0.32 * h],
      [x0 + 4, y0 + 0.44 * h],
      [x0, y0 + 0.5 * h],
      [x0 + 4, y0 + 0.56 * h],
      [x0 + 10, y0 + 0.68 * h],
      [x0 + 14, y0 + 0.88 * h],
      [x0 + 14, y1],
    ]));
  }],
  ["zigzag", (x0, y0, y1) => {
    const h = y1 - y0;
    return S([
      { x: x0 + 16, y: y0 },
      { x: x0 + 6, y: y0 + 0.25 * h },
      { x: x0, y: y0 + 0.5 * h },
      { x: x0 + 6, y: y0 + 0.75 * h },
      { x: x0 + 16, y: y1 },
    ]);
  }],
];

// cifre normali (~62 px) e alte (~100 px)
const d2n = (x: number) => S(interp([[x + 12, 40], [x + 38, 44], [x + 44, 58], [x + 22, 72], [x + 46, 94], [x + 14, 102]]));
const d2t = (x: number) => S(interp([[x + 12, 20], [x + 38, 24], [x + 44, 40], [x + 22, 58], [x + 46, 90], [x + 14, 120]]));
const piuH = (x: number) => S(interp([[x, 62], [x + 34, 64]]));
const piuV = (x: number) => S(interp([[x + 17, 46], [x + 18, 80]]));
const d1n = (x: number) => S(interp([[x + 14, 44], [x + 10, 100]]));
const d1t = (x: number) => S(interp([[x + 16, 26], [x + 12, 120]]));

/** Forma AMBIGUA (polilinea quasi dritta = una tonda col tremolio): non estratta
 *  come graffa, ma riparabile se il modello la legge «\\sum». */
function attendiAmbigua(ink: SimpleStroke[]): void {
  const r = rewriteBrackets(ink);
  expect(r.brackets).toHaveLength(0);
  expect(r.strokes).toHaveLength(ink.length);
  const kinds = detectBracketKinds(ink);
  expect(kinds.opens[0]).toBe("round");
  expect(kinds.closes[kinds.closes.length - 1]).toBe("round");
  const res = detectCurlyResidues(ink);
  expect(res.length).toBeGreaterThanOrEqual(2);
  expect(res[0]!.isOpen).toBe(true);
  expect(res[res.length - 1]!.isOpen).toBe(false);
}

describe("graffa disegnata a mano in CONTESTO — mai «\\sum»", () => {
  for (const tag of ["cifre normali", "cifre ALTE"] as const) {
    const d2 = tag === "cifre ALTE" ? d2t : d2n;
    const d1 = tag === "cifre ALTE" ? d1t : d1n;

    for (const [nome, fn] of VARIANTI) {
      const ambigua = nome === "zigzag";
      it(`graffa in un tratto (${nome}, ${tag}): ${ambigua ? "AMBIGUA → tonda debole, \\sum riparabile" : "due graffe estratte, contenuto intatto"}`, () => {
        // a destra la STESSA forma specchiata (graffa CHIUSA)
        const ink = [fn(30, 20, 130), d2(80), piuH(140), piuV(140), d1(190), mirrorX(fn(230, 20, 130), 244)];
        if (ambigua) {
          attendiAmbigua(ink);
          return;
        }
        const r = rewriteBrackets(ink);
        expect(r.brackets).toHaveLength(2);
        expect(r.brackets[0]).toMatchObject({ kind: "curly", isOpen: true });
        expect(r.brackets[1]).toMatchObject({ kind: "curly", isOpen: false });
        // le 2 graffe (1 tratto cadauna) tolte: restano 2, +, +, 1
        expect(r.strokes).toHaveLength(4);
      });
    }

    it(`graffa in DUE TRATTI a polilinea (${tag}): AMBIGUA → tonda debole, \\sum riparabile`, () => {
      // metà SOVRAPPOSTE verticalmente (x condivisa): si uniscono nel gruppo
      // e insieme formano la graffa completa
      const topO = S(interp([[44, 20], [38, 31], [30, 75]]));
      const botO = S(interp([[30, 75], [38, 119], [44, 130]]));
      const topC = S(interp([[216, 20], [222, 31], [230, 75]]));
      const botC = S(interp([[230, 75], [222, 119], [216, 130]]));
      const ink = [topO, botO, d2(80), piuH(140), piuV(140), d1(190), topC, botC];
      attendiAmbigua(ink);
    });

    it(`graffa SINGOLA + cifra (${tag}): graffa estratta, cifra resta per il modello`, () => {
      const ink = [VARIANTI[0]![1](30, 20, 130), d2(80)];
      void mirrorX; // (usata sopra; la variante singola resta aperta di proposito)
      const r = rewriteBrackets(ink);
      expect(r.brackets).toHaveLength(1);
      expect(r.brackets[0]).toMatchObject({ kind: "curly", isOpen: true });
      expect(r.strokes).toHaveLength(1);
    });
  }
});
