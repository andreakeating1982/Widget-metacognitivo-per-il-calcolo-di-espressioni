/** (7/10) Scrittura PICCOLA: sotto ~44 px di altezza mediana dei tratti la lettura è sensibilmente
 *  meno sicura (banco: 77% contro 88%; `{[(3+2)]}` 6/12 a 38 px, 9/12 a 50 px). Serve solo a
 *  mostrare un suggerimento NON bloccante: non cambia mai la lettura. */
export const SMALL_WRITING_PX = 44;

type Pt = { x: number; y: number };

export function medianStrokeHeight(strokes: { points: Pt[] }[]): number {
  const hs = strokes
    .map((s) => {
      if (s.points.length < 2) return 0;
      let lo = Infinity;
      let hi = -Infinity;
      for (const p of s.points) {
        if (p.y < lo) lo = p.y;
        if (p.y > hi) hi = p.y;
      }
      return hi - lo;
    })
    // i tratti piccoli (puntini, trattini, apici) non rappresentano l'altezza delle cifre
    .filter((h) => h >= 15)
    .sort((a, b) => a - b);
  if (hs.length === 0) return 0;
  return hs[Math.floor(hs.length / 2)]!;
}

export function isSmallWriting(strokes: { points: Pt[] }[]): boolean {
  const m = medianStrokeHeight(strokes);
  return m > 0 && m < SMALL_WRITING_PX;
}
