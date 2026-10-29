import type { SimpleStroke, StackedFraction } from "./inkSigns";

/** (7/10, giro 8) PUNTINO «·» TRA DUE FRAZIONI. Il puntino del PER scritto tra due frazioni impilate
 *  (`1/2 · 3/4`) resta nell'inchiostro e il modello non lo legge: il «·» spariva. Si riconosce
 *  GEOMETRICAMENTE: tratto puntiforme (lato massimo ≤ 12% dell'altezza della frazione), con il centro x
 *  TRA la fine di una frazione e l'inizio della successiva e y nella fascia della barra (±35% dell'altezza).
 *  Solo con ≥ 2 frazioni: altrove non cambia nulla. Il puntino viene TOLTO e «\cdot» reinserito per posizione. */
export interface FracDotsRewrite {
  strokes: SimpleStroke[];
  centers: number[];
}

interface Box { x0: number; x1: number; y0: number; y1: number }
const boxOf = (ss: SimpleStroke[]): Box => {
  const pts = ss.flatMap((s) => s.points);
  return {
    x0: Math.min(...pts.map((p) => p.x)),
    x1: Math.max(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    y1: Math.max(...pts.map((p) => p.y)),
  };
};

export function dotsBetweenFractions(strokes: SimpleStroke[], fracs: StackedFraction[]): FracDotsRewrite {
  if (fracs.length < 2) return { strokes, centers: [] };
  const boxes = fracs
    .map((f) => {
      const b = boxOf([...f.lineStrokes, ...f.numStrokes, ...f.denStrokes]);
      const bar = boxOf(f.lineStrokes);
      return { ...b, barY: (bar.y0 + bar.y1) / 2, h: b.y1 - b.y0 };
    })
    .sort((a, b) => a.x0 - b.x0);
  const removed = new Set<number>();
  const centers: number[] = [];
  strokes.forEach((s, i) => {
    if (s.points.length === 0) return;
    const b = boxOf([s]);
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    for (let k = 0; k + 1 < boxes.length; k++) {
      const L = boxes[k]!;
      const R = boxes[k + 1]!;
      const h = Math.max(L.h, R.h);
      if (Math.max(b.x1 - b.x0, b.y1 - b.y0) > 0.12 * h) continue;
      if (cx <= L.x1 || cx >= R.x0) continue;
      if (Math.abs(cy - (L.barY + R.barY) / 2) > 0.35 * h) continue;
      removed.add(i);
      centers.push(cx);
      return;
    }
  });
  if (removed.size === 0) return { strokes, centers: [] };
  return { strokes: strokes.filter((_, i) => !removed.has(i)), centers: centers.sort((a, b) => a - b) };
}
