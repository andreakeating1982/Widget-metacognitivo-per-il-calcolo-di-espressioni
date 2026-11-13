import type { SimpleStroke } from "./inkSigns";

/** (7/10, giro 7) PIÙ «+» DAI TRATTI. Il modello legge la croce di un «+» come «4» quando tocca la
 *  cifra vicina (`2+3` → `243`, `(x+1)²` → `(x4)²`). La croce però è inconfondibile NEI TRATTI: due
 *  segmenti DRITTI, uno ~orizzontale e uno ~verticale, che si incrociano al CENTRO di entrambi (frazione
 *  0,38–0,62), con bracci simili. Un «4» incrocia a ~70% dell'altezza e a ~75% della larghezza, una «t»
 *  a ~30%, un «1» col piede e un «7» alla base/in cima (frazioni fuori intervallo). Come meno, uguale,
 *  8 e radici, i due tratti vengono TOLTI dall'inchiostro e «+» è reinserito per posizione. */
export interface PlusRewrite {
  strokes: SimpleStroke[];
  centers: number[];
  pluses: number;
}

const FRAC_LO = 0.38;
const FRAC_HI = 0.62;
const STRAIGHT_MIN = 0.85;
const ARM_RATIO_LO = 0.55;
const ARM_RATIO_HI = 1.8;
const AXIS_SLOPE = 0.3;
const MIN_ARM_VS_MAXH = 0.25;

interface Arm {
  idx: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  len: number;
  straight: number;
  dx: number;
  dy: number;
}

function armOf(s: SimpleStroke, idx: number): Arm | null {
  const p = s.points;
  if (p.length < 2) return null;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, path = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i]!;
    if (q.x < x0) x0 = q.x;
    if (q.x > x1) x1 = q.x;
    if (q.y < y0) y0 = q.y;
    if (q.y > y1) y1 = q.y;
    if (i > 0) path += Math.hypot(q.x - p[i - 1]!.x, q.y - p[i - 1]!.y);
  }
  const a = p[0]!;
  const b = p[p.length - 1]!;
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (path < 1) return null;
  return { idx, x0, x1, y0, y1, len: chord, straight: chord / path, dx: Math.abs(b.x - a.x), dy: Math.abs(b.y - a.y) };
}

export function rewritePlusSigns(strokes: SimpleStroke[]): PlusRewrite {
  const arms = strokes.map((s, i) => armOf(s, i));
  const maxH = Math.max(0, ...arms.map((a) => (a ? a.y1 - a.y0 : 0)));
  const hor = arms.filter((a): a is Arm => !!a && a.straight >= STRAIGHT_MIN && a.dy <= AXIS_SLOPE * a.dx && a.len >= MIN_ARM_VS_MAXH * maxH);
  const ver = arms.filter((a): a is Arm => !!a && a.straight >= STRAIGHT_MIN && a.dx <= AXIS_SLOPE * a.dy && a.len >= MIN_ARM_VS_MAXH * maxH);
  const removed = new Set<number>();
  const centers: number[] = [];
  for (const h of hor) {
    if (removed.has(h.idx)) continue;
    const cands = ver.filter((v) => {
      if (removed.has(v.idx) || v.idx === h.idx) return false;
      const r = h.len / v.len;
      if (r < ARM_RATIO_LO || r > ARM_RATIO_HI) return false;
      const vcx = (v.x0 + v.x1) / 2;
      const hcy = (h.y0 + h.y1) / 2;
      const fx = (vcx - h.x0) / Math.max(1, h.x1 - h.x0);
      const fy = (hcy - v.y0) / Math.max(1, v.y1 - v.y0);
      return fx >= FRAC_LO && fx <= FRAC_HI && fy >= FRAC_LO && fy <= FRAC_HI;
    });
    if (cands.length !== 1) continue; // ambiguo: nessuna estrazione
    const v = cands[0]!;
    removed.add(h.idx);
    removed.add(v.idx);
    centers.push((v.x0 + v.x1) / 2);
  }
  if (removed.size === 0) return { strokes, centers: [], pluses: 0 };
  return { strokes: strokes.filter((_, i) => !removed.has(i)), centers: centers.sort((a, b) => a - b), pluses: centers.length };
}
