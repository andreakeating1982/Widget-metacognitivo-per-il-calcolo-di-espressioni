// ⚠️ CONTESTO DELL'INCHIOSTRO (6/10) — due fatti geometrici che i segni piccoli
// (puntino «·», meno «−», uguale «=») devono rispettare e che le soglie in
// pixel assolute non catturano:
//  1) ISOLAMENTO: un puntino o un meno veri sono segni SEPARATI; un tratto
//     piccolo che TOCCA un altro tratto è una parte di glifo (l'anello di un
//     «9», la barra alta di un «5», il piede di un «1», il tick di una
//     quadra, un braccio della «x») e NON va mai trasformato in segno.
//  2) POSIZIONE: puntino e meno stanno a METÀ altezza della riga; la barra alta
//     di un «5», il piede di un «1» e i tick delle parentesi stanno agli
//     estremi.
// Il banco di prova (lib/bench/geoAudit) misurava ~900 cifre mangiate da
// questi stadi su 4000 campioni sintetici prima di questa guardia.
import type { SimpleStroke } from "./dotSigns";

interface Pt {
  x: number;
  y: number;
}

function dense(points: Pt[], step = 2): Pt[] {
  if (points.length < 2) return points.slice();
  const out: Pt[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

/** Distanza minima fra le polilinee di due tratti. */
function minDist(a: Pt[], b: Pt[]): number {
  let best = Infinity;
  for (const p of a) {
    for (const q of b) {
      const d = (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

/** Distanza minima fra un punto e una polilinea. */
function pointDist(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (const q of poly) {
    const d = (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** Per ogni tratto: ha una GIUNZIONE con un altro tratto, cioè una sua estremità
 *  sta su un altro tratto (≤ tol px) o viceversa? È il contatto tipico delle parti
 *  di un glifo (anello del «9» sulla coda, barra del «5» sul corpo, piede dell'«1»,
 *  tick di una quadra). Un semplice attraversamento di due tratti (la «x») non è
 *  una giunzione e si tratta a parte (`strokesIntersect`). */
export function touchesOther(
  strokes: SimpleStroke[],
  tol = 1.5,
  /** tratti da NON contare come «altro» (es. le altre barre di un meno ripassato) */
  ignore?: (j: number) => boolean,
): boolean[] {
  const d = strokes.map((s) => dense(s.points));
  const box = d.map((pts) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return { x0, x1, y0, y1 };
  });
  const ends = d.map((pts) => (pts.length ? [pts[0]!, pts[pts.length - 1]!] : []));
  const out = new Array<boolean>(strokes.length).fill(false);
  for (let i = 0; i < strokes.length; i++) {
    for (let j = i + 1; j < strokes.length; j++) {
      if (box[i]!.x0 - tol > box[j]!.x1 || box[j]!.x0 - tol > box[i]!.x1) continue;
      if (box[i]!.y0 - tol > box[j]!.y1 || box[j]!.y0 - tol > box[i]!.y1) continue;
      const junction =
        ends[i]!.some((e) => pointDist(e, d[j]!) <= tol) || ends[j]!.some((e) => pointDist(e, d[i]!) <= tol);
      if (junction) {
        if (!ignore?.(j)) out[i] = true;
        if (!ignore?.(i)) out[j] = true;
      }
    }
  }
  return out;
}

/** Per ogni tratto: un ALTRO tratto passa dentro il suo riquadro INTERNO (il riquadro ristretto del
 *  `margin` su ogni lato)? È il segno che il tratto è PARTE di un glifo attraversato da un altro:
 *  la «L» del «4» (diagonale + base) che l'asta verticale attraversa all'85% della sua lunghezza
 *  (né giunzione d'estremità, né incrocio «interno a entrambi»: `crossesOther` non lo vede), il
 *  pancino di «b/p/d», l'occhiello del «6/9». Un puntino VERO — anche «marcato» — vive in uno
 *  spazio vuoto: un vicino lo sfiora al massimo sul bordo esterno (il 20% di margine non conta,
 *  scrittura stretta) e non gli passa mai nel mezzo.
 *  (5/10 notte, banco P4/P7: «45+78» → «·15+78», «4²» → «·1²»: la «L» del 4 mangiata come puntino.) */
export function piercedByOther(strokes: SimpleStroke[], margin = 0.2): boolean[] {
  const d = strokes.map((s) => dense(s.points));
  const box = d.map((pts) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return { x0, x1, y0, y1 };
  });
  const out = new Array<boolean>(strokes.length).fill(false);
  for (let i = 0; i < strokes.length; i++) {
    const b = box[i]!;
    const mx = (b.x1 - b.x0) * margin;
    const my = (b.y1 - b.y0) * margin;
    const ix0 = b.x0 + mx, ix1 = b.x1 - mx, iy0 = b.y0 + my, iy1 = b.y1 - my;
    if (ix1 <= ix0 || iy1 <= iy0) continue;
    for (let j = 0; j < strokes.length && !out[i]; j++) {
      if (j === i) continue;
      const o = box[j]!;
      if (o.x1 < ix0 || o.x0 > ix1 || o.y1 < iy0 || o.y0 > iy1) continue;
      for (const p of d[j]!) {
        if (p.x >= ix0 && p.x <= ix1 && p.y >= iy0 && p.y <= iy1) {
          out[i] = true;
          break;
        }
      }
    }
  }
  return out;
}

/** Per ogni tratto: si INCROCIA con un altro tratto «a croce», cioè il punto di
 *  incontro cade nell'INTERNO di ENTRAMBI (frazione di lunghezza d'arco fra `lo` e
 *  `hi`)? È il tratto tipico delle due diagonali di una «x» piccola (incrocio a
 *  ~50% di ciascuna), delle barre del «+», della sbarra di «t»/«f». A differenza di
 *  `touchesOther` NON richiede una giunzione d'estremità; a differenza di un
 *  semplice «distanza ≤ tol» NON scatta quando un puntino MARCATO sfiora con la sua
 *  estremità il bordo di una cifra vicina (frazione ≈ 0–0,2 / 0,8–1: scrittura
 *  stretta, test «« : » con puntini MARCATI»). Le lunghezze dei due tratti devono
 *  essere comparabili (rapporto ≥ `minRatio`).
 *  Senza questa guardia lo stadio puntini mangiava ciascuna diagonale della «x»
 *  come «puntino isolato» (aspetto ≤ 3, ≤ 34 px): «x(x+1)» → «:(:+1)»
 *  (5/10 sera, banco P5-02: la «x» piccola falliva in tutti gli stili). */
export function crossesOther(
  strokes: SimpleStroke[],
  tol = 1.5,
  lo = 0.2,
  hi = 0.8,
  minRatio = 0.5,
): boolean[] {
  const d = strokes.map((s) => dense(s.points));
  const len: number[] = [];
  const frac = d.map((pts) => {
    const acc: number[] = [0];
    for (let k = 1; k < pts.length; k++) {
      acc.push(acc[k - 1]! + Math.hypot(pts[k]!.x - pts[k - 1]!.x, pts[k]!.y - pts[k - 1]!.y));
    }
    const tot = acc[acc.length - 1]! || 1;
    len.push(tot);
    return acc.map((v) => v / tot);
  });
  const box = d.map((pts) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return { x0, x1, y0, y1 };
  });
  const out = new Array<boolean>(strokes.length).fill(false);
  const tol2 = tol * tol;
  for (let i = 0; i < strokes.length; i++) {
    for (let j = i + 1; j < strokes.length; j++) {
      if (box[i]!.x0 - tol > box[j]!.x1 || box[j]!.x0 - tol > box[i]!.x1) continue;
      if (box[i]!.y0 - tol > box[j]!.y1 || box[j]!.y0 - tol > box[i]!.y1) continue;
      // le due diagonali di una «x» hanno lunghezze simili; un puntino marcato che
      // attraversa una cifra alta (rapporto ≈ 0,4) NON è una «x»
      if (Math.min(len[i]!, len[j]!) < minRatio * Math.max(len[i]!, len[j]!)) continue;
      let hit = false;
      for (let a = 0; a < d[i]!.length && !hit; a++) {
        const fa = frac[i]![a]!;
        if (fa < lo || fa > hi) continue;
        const p = d[i]![a]!;
        for (let b = 0; b < d[j]!.length; b++) {
          const fb = frac[j]![b]!;
          if (fb < lo || fb > hi) continue;
          const q = d[j]![b]!;
          if ((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y) <= tol2) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        out[i] = true;
        out[j] = true;
      }
    }
  }
  return out;
}

/** Due tratti si ATTRAVERSANO (segmenti che si incrociano) o si toccano? */
export function strokesIntersect(a: SimpleStroke, b: SimpleStroke, tol = 1.5): boolean {
  const da = dense(a.points);
  const db = dense(b.points);
  return minDist(da, db) <= tol;
}

/** Altezza mediana e centro verticale mediano dei tratti «da glifo» (h ≥ 20 px,
 *  non barre piatte): definiscono dove sta il centro della riga. */
export function lineCenter(strokes: SimpleStroke[], skip?: (i: number) => boolean): { medH: number; medCy: number } {
  const hs: number[] = [];
  const cys: number[] = [];
  strokes.forEach((s, i) => {
    if (skip?.(i)) return;
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (const p of s.points) {
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    }
    const h = y1 - y0;
    if (h < 20) return;
    hs.push(h);
    cys.push((y0 + y1) / 2);
  });
  if (hs.length === 0) return { medH: 0, medCy: 0 };
  const med = (a: number[]) => {
    const s = a.slice().sort((m, n) => m - n);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  };
  return { medH: med(hs), medCy: med(cys) };
}
