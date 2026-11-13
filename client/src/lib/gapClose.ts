// CHIUSURA DEI VUOTI LARGHI PER IL MODELLO (5/10 notte — revisione del riconoscimento a mano).
//
// PROBLEMA. Gli elementi che la pipeline riconosce da sé e TOGLIE dall'inchiostro (parentesi,
// puntini ·, : ÷, meno, uguali, radici, 8) lasciano nell'inchiostro del modello dei VUOTI LARGHI
// (anche 1,4 altezze). Il modello li RIEMPIE inventando simboli, verificato col banco di prova
// (modello reale, sonda V0/V1/V1b): «3·[2x+1]» → «3+2x+1» (un «+» fra 3 e 2),
// «[2][3]» → «[2\cdot3», «[2·(3+4)]:5» → «2(3+4)/5» (uno slash al posto dei due punti tolti).
// Con i vuoti chiusi lo stesso inchiostro è letto «3 2 x + 1», «[ 2 3», «2 ( 3 + 4 ) 5».
//
// SOLUZIONE. Per il MODELLO si ri-spaziano le colonne dell'inchiostro: ogni vuoto orizzontale più
// largo di `maxGapFrac × altezza` si accorcia a quella misura (le colonne si scorrono verso
// sinistra, mai si ingrandiscono i glifi). L'ALLINEAMENTO con gli elementi estratti
// (composeLatex.ts) continua a usare le x ORIGINALI: questa funzione restituisce una COPIA.
import type { SimpleStroke } from "./inkSigns";

/** vuoto massimo, in altezze dell'inchiostro, che il modello deve vedere fra due colonne.
 *  Sovrascrivibile dal banco con `globalThis.__MODEL_GAP_FRAC` (A/B; 0 = disattivato). */
export const MODEL_GAP_FRAC = 0.2;

export function modelGapFrac(): number {
  const g = (globalThis as { __MODEL_GAP_FRAC?: number }).__MODEL_GAP_FRAC;
  return typeof g === "number" ? g : MODEL_GAP_FRAC;
}

interface Extent {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function extentOf(s: SimpleStroke): Extent | null {
  const pts = s.points;
  if (!pts || pts.length === 0) return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, x1, y0, y1 };
}

/** Restituisce una COPIA dei tratti con i vuoti orizzontali > `maxGapFrac × altezza` accorciati a
 *  quella misura. Tratti sovrapposti in x restano nella stessa colonna (nessuno spostamento
 *  relativo); l'ordine e la forma dei tratti non cambiano. Con `maxGapFrac ≤ 0`, uno solo
 *  tratto o nessun vuoto largo, restituisce l'array originale.
 *
 *  `holesX` (6/10): le x dei centri degli elementi TOLTI dall'inchiostro. Se è dato, si chiudono
 *  SOLO i vuoti che ne contengono uno (il buco lasciato dall'elemento tolto); la spaziatura
 *  naturale fra i glifi rimasti non si tocca (accorciarla faceva leggere `4 -` come `4=`:
 *  `14-8` → `14-=8`). Senza `holesX` si chiude ogni vuoto largo. */
export function closeWideGaps(strokes: SimpleStroke[], maxGapFrac: number, holesX?: number[]): SimpleStroke[] {
  if (!(maxGapFrac > 0) || strokes.length < 2) return strokes;
  const ext = strokes.map(extentOf);
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const e of ext) {
    if (!e) continue;
    y0 = Math.min(y0, e.y0);
    y1 = Math.max(y1, e.y1);
  }
  const H = y1 - y0;
  if (!(H > 0)) return strokes;
  const maxGap = maxGapFrac * H;

  const order = strokes
    .map((_, i) => i)
    .filter((i) => ext[i] !== null)
    .sort((a, b) => ext[a]!.x0 - ext[b]!.x0);
  const shift = new Array<number>(strokes.length).fill(0);
  let reach = -Infinity;
  let acc = 0;
  for (const i of order) {
    const e = ext[i]!;
    if (
      reach !== -Infinity &&
      e.x0 - reach > maxGap &&
      (holesX === undefined || holesX.some((h) => h >= reach && h <= e.x0))
    ) {
      acc += e.x0 - reach - maxGap;
    }
    shift[i] = acc;
    reach = Math.max(reach, e.x1);
  }
  if (acc === 0) return strokes;
  return strokes.map((s, i) =>
    shift[i] === 0
      ? s
      : { ...s, points: s.points.map((p) => ({ ...p, x: p.x - shift[i]! })) },
  );
}
