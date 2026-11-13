// ─────────────────────────────────────────────────────────────────────────────
// STIMA DELL'ALTEZZA DELLE CIFRE in una foto/ritaglio (px), per scegliere l'ingrandimento giusto
// prima di Tesseract.  (6/10, fase foto)
//
// PERCHÉ: `enhanceForOcr` portava il lato CORTO del ritaglio a 1100 px. Una riga di espressione è
// larga e BASSA (es. 570×49 px): diventava 12 800×1100 px con cifre alte ~420 px. Tesseract (LSTM)
// normalizza la riga a ~36 px di altezza, quindi non serve ingrandire così tanto: i glifi fusi
// (`4²` letto come UN simbolo largo → «+»), gli apici persi e le parentesi lette male crescevano
// proprio con l'eccesso di ingrandimento. Misura riproducibile (banco foto, 85 righe stampate a
// bassa risoluzione): lato corto 1100 → 31/85 righe esatte; ~190 → 40/85; con altezza cifre
// ~70–100 px la riga A della foto dell'utente `(2+5²):(4²−2·5−3)+48:(6²−2³)` esce esatta.
//
// COME: binarizzazione di Otsu → componenti connesse (8-connessione) → altezza MEDIANA delle
// componenti «grandi» (≥ 35% del 90° percentile: scarta puntini, trattini, `=` e rumore). La
// mediana è delle cifre, che sono la maggioranza dei glifi; parentesi (+30%) e apici (−40%) non
// la spostano.
// ─────────────────────────────────────────────────────────────────────────────

/** Soglia di Otsu su un istogramma a 256 livelli (0 = nero). */
export function otsuThreshold(gray: ArrayLike<number>): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, gray[i]! | 0))]++;
  const total = gray.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t]!;
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

export interface CcBox {
  x0: number;
  y0: number;
  x1: number; // inclusivo
  y1: number; // inclusivo
  area: number;
}

/** Componenti connesse (8-connessione) di una maschera binaria w×h (1 = inchiostro). */
export function connectedComponents(mask: Uint8Array, w: number, h: number): CcBox[] {
  const label = new Int32Array(w * h);
  const parent: number[] = [0];
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]!]!;
      a = parent[a]!;
    }
    return a;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  let next = 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let l = 0;
      // vicini già visitati: W, NW, N, NE
      const cand: number[] = [];
      if (x > 0 && label[i - 1]) cand.push(label[i - 1]!);
      if (y > 0) {
        if (x > 0 && label[i - w - 1]) cand.push(label[i - w - 1]!);
        if (label[i - w]) cand.push(label[i - w]!);
        if (x < w - 1 && label[i - w + 1]) cand.push(label[i - w + 1]!);
      }
      if (cand.length === 0) {
        l = next++;
        parent.push(l);
      } else {
        l = Math.min(...cand);
        for (const c of cand) union(l, c);
      }
      label[i] = l;
    }
  }
  const boxes = new Map<number, CcBox>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = label[y * w + x]!;
      if (!l) continue;
      const r = find(l);
      const b = boxes.get(r);
      if (!b) boxes.set(r, { x0: x, y0: y, x1: x, y1: y, area: 1 });
      else {
        if (x < b.x0) b.x0 = x;
        if (x > b.x1) b.x1 = x;
        if (y < b.y0) b.y0 = y;
        if (y > b.y1) b.y1 = y;
        b.area++;
      }
    }
  }
  return [...boxes.values()];
}

/** Maschera dell'inchiostro: il lato MENO frequente della soglia di Otsu (testo scuro su carta
 *  chiara, ma funziona anche al contrario). */
export function inkMask(gray: ArrayLike<number>): Uint8Array {
  const t = otsuThreshold(gray);
  const mask = new Uint8Array(gray.length);
  let dark = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i]! <= t) {
      mask[i] = 1;
      dark++;
    }
  }
  if (dark > gray.length / 2) for (let i = 0; i < mask.length; i++) mask[i] = mask[i] ? 0 : 1;
  return mask;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1) + 0.5)))]!;
}

/** Altezza (px) tipica di una cifra, oppure null se l'immagine non ha abbastanza inchiostro
 *  (< 3 glifi). `gray` = luminanza 0..255 di w×h pixel. */
export function estimateDigitHeight(gray: ArrayLike<number>, w: number, h: number): number | null {
  if (w < 8 || h < 8) return null;
  const ccs = connectedComponents(inkMask(gray), w, h).filter((b) => b.area >= 8 && b.y1 - b.y0 + 1 >= 4);
  if (ccs.length < 3) return null;
  const hs = ccs.map((b) => b.y1 - b.y0 + 1).sort((a, b) => a - b);
  const p90 = percentile(hs, 0.9);
  const big = hs.filter((v) => v >= 0.35 * p90);
  if (big.length < 3) return null;
  return percentile(big, 0.5);
}

/** Altezza obiettivo delle cifre per Tesseract (px): abbastanza grande da separare gli apici,
 *  abbastanza piccola da non fondere i glifi (vedi la nota in testa al file).
 *
 *  60 px è il valore MISURATO migliore (banco foto, `bench/photoSweep.sh`; esatte su 85 righe
 *  sintetiche + 36 varianti reali delle tre righe della foto a scala ≥ 0,65, anche JPEG):
 *    obiettivo   40   50   55   60   70   80
 *    sintetiche  69   75   73   76   74   74   (su 85)
 *    reali       36   29   28   33   27   23   (su 36)
 *    totale     105  104  101  109  101   97
 *  Con 40 le reali sono tutte giuste ma le righe sintetiche a risoluzione bassa perdono cifre;
 *  oltre 70 i glifi si fondono («4²» in un simbolo) e gli apici vanno persi. */
export const DIGIT_TARGET_PX = 60;

/** Fattore di scala per portare le cifre a `target` px. Limitato a [0.4, 10] e in modo che
 *  l'immagine finale non superi `maxEdge` sul lato lungo né `maxPixels` in tutto. */
export function scaleForDigits(
  digitH: number,
  w: number,
  h: number,
  target = DIGIT_TARGET_PX,
  maxEdge = 6000,
  maxPixels = 16e6,
): number {
  let s = Math.max(0.4, Math.min(10, target / digitH));
  s = Math.min(s, maxEdge / Math.max(w, h));
  s = Math.min(s, Math.sqrt(maxPixels / (w * h)));
  return s;
}
