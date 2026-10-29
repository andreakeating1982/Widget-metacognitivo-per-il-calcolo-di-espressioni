/**
 * Riconoscimento OCR dell'espressione da foto (Tesseract.js).
 *
 * - Lingua «eng»: è quella che riconosce meglio cifre, x e i simboli
 *   + − = presenti in un'espressione letterale.
 * - Worker e core WASM sono SELF-HOSTED in `/tess` e i dati lingua in
 *   `/tessdata`: l'app imposta COOP/COEP sui documenti, quindi niente CDN —
 *   tutto arriva dallo stesso dominio (funziona anche offline dopo il primo
 *   caricamento e su Render senza configurazioni extra).
 * - Il testo GREZZO NON BASTA: Tesseract massacra gli apici stampati
 *   («5²»→«52» o «5%») e confonde i segni («·»→«-», «+»→«4»). Si usa quindi
 *   la GEOMETRIA dei simboli (bounding box) per ricostruire il testo:
 *   `rebuildFromSymbols` (vedi `@/lib/ocrGeometry`) segnala gli apici e
 *   recupera i segni; il VALORE di ogni apice si ottiene confrontando il
 *   glifo ritagliato con le cifre renderizzate a canvas (template matching,
 *   margine verificato su foto reale: ²→dist 0,12, ³→dist 0,14).
 * - Il testo ricostruito viene poi normalizzato da `normalizeExpressionOcr`
 *   (vedi `@/lib/exprOcr`). Se la geometria non è disponibile si torna al
 *   testo semplice, gestito dalle regole testuali di riparazione.
 */
import { createWorker, PSM } from "tesseract.js";
import {
  extractStackedFractions,
  fallbackGroupText,
  findFractionBars,
  planPhotoFractions,
} from "@/lib/photoFractions";
import { enhanceForOcr } from "@/lib/imagePrep";
import {
  rebuildFromSymbols,
  normalizeGlyph,
  bestDigitMatch,
  digitDist,
  glyphDistance,
  fallbackSupDigit,
  pickExponentRead,
  TEMPLATE_MAX_DIST,
  type OcrSymbol,
  type SupBox,
} from "@/lib/ocrGeometry";
import { type DigitClassifier, type DigitRank, type GlyphReaders, inkFieldFromGray, reconcileSymbols, type InkField } from "./ocrReconcile";

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

let workerPromise: Promise<OcrWorker> | null = null;
let progressCb: ((p: number) => void) | null = null;

function getWorker(onProgress?: (p: number) => void): Promise<OcrWorker> {
  progressCb = onProgress ?? null;
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      workerPath: "/tess/worker.min.js",
      corePath: "/tess",
      langPath: "/tessdata",
      logger: (m) => {
        if (m.status === "recognizing text" && progressCb) progressCb(m.progress);
      },
    }).then(async (w) => {
      await w.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      return w;
    });
  }
  return workerPromise;
}

/* ── Template delle cifre per il valore degli apici (canvas) ───────────── */

let digitTemplates: Record<string, Float32Array> | null = null;

export function getDigitTemplates(): Record<string, Float32Array> {
  if (digitTemplates) return digitTemplates;
  const cv = document.createElement("canvas");
  cv.width = 300;
  cv.height = 300;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas non disponibile");
  // TRE stili di template (segnalazione 26/9: gli apici scritti a mano non
  // matchavano col solo serif e il fallback rispondeva sempre «2»):
  // serif (libri di testo), sans (stampato moderno), corsivo tipo lavagna.
  // normalizeGlyph ritaglia l'inchiostro e normalizza, quindi la dimensione
  // del font è indifferente; il prefisso della chiave distingue lo stile e
  // bestDigitMatch legge la cifra dall'ULTIMO carattere.
  const styles: Array<[string, string]> = [
    ["", '140px "Times New Roman", "Liberation Serif", Georgia, serif'],
    ["s", '140px Arial, "Helvetica Neue", "Liberation Sans", sans-serif'],
    ["h", '120px "Segoe Print", "Comic Sans MS", "Comic Neue", cursive'],
  ];
  const templates: Record<string, Float32Array> = {};
  for (const [prefix, font] of styles) {
    for (let d = 0; d <= 9; d++) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = "#000000";
      ctx.font = font;
      ctx.textBaseline = "top";
      ctx.fillText(String(d), 60, 60);
      const img = ctx.getImageData(0, 0, cv.width, cv.height);
      const gray = new Float32Array(cv.width * cv.height);
      for (let i = 0; i < gray.length; i++) gray[i] = img.data[i * 4];
      templates[prefix + String(d)] = normalizeGlyph({ w: cv.width, h: cv.height, gray }).v;
    }
  }
  digitTemplates = templates;
  return templates;
}

/**
 * Legge il VALORE di ogni apice ritagliandolo dall'immagine preparata.
 *
 * ⚠️ RITAGLI MULTIPLI (segnalazione 27/9: «6²» letto «6^7»): col solo
 * padding standard (15% dell'altezza) nell'inquadratura può entrare
 * l'inchiostro vicino (il «−» dentro la parentesi, il tratto della base…):
 * il glifo risulta contaminato, la distanza dai template esplode oltre
 * TEMPLATE_MAX_DIST e si cade nel fallback che si fida del carattere letto
 * da Tesseract — che sulle cifre piccole si sbaglia spesso (² → «7», «4»,
 * «%», «°»). Si riprova quindi con ritagli via via più STRETTI e si tiene
 * il migliore; il taglio esatto (pad 0) isola l'apice dal vicino.
 * Se nessun ritaglio è abbastanza netto, il carattere letto dall'OCR
 * (quando è una cifra) viene CORROBORATO dalla forma: si accetta solo se
 * la sua distanza dai template è davvero vicina alla migliore — non ci si
 * fida più alla cieca di Tesseract sui piccoli apici.
 */
const EXP_TIGHT_TOL = 0.05;

async function resolveSuperscripts(prepared: Blob, boxes: SupBox[]): Promise<string[]> {
  const bmp = await createImageBitmap(prepared);
  try {
    const templates = getDigitTemplates();
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canvas non disponibile");
    const out: string[] = [];
    for (const b of boxes) {
      let bestDigit = "";
      let bestDist = Infinity;
      let bestNorm: ReturnType<typeof normalizeGlyph> | null = null;
      // ritaglio ESATTO per primo: a parità di distanza vince il più stretto (nessun vicino dentro)
      const tries: { digit: string; dist: number; norm: ReturnType<typeof normalizeGlyph> }[] = [];
      for (const padFrac of [0, 0.06, 0.15]) {
        const pad =
          padFrac === 0 ? 0 : Math.max(4, Math.round((b.y1 - b.y0) * padFrac));
        const sx = Math.max(0, b.x0 - pad);
        const sy = Math.max(0, b.y0 - pad);
        const sw = Math.min(bmp.width - sx, b.x1 - b.x0 + 2 * pad);
        const sh = Math.min(bmp.height - sy, b.y1 - b.y0 + 2 * pad);
        if (sw <= 0 || sh <= 0) continue;
        const scale = 3;
        cv.width = sw * scale;
        cv.height = sh * scale;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
        const img = ctx.getImageData(0, 0, cv.width, cv.height);
        const gray = new Float32Array(cv.width * cv.height);
        for (let i = 0; i < gray.length; i++) {
          gray[i] =
            0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2];
        }
        const norm = normalizeGlyph({ w: cv.width, h: cv.height, gray });
        const { digit, dist } = bestDigitMatch(norm, templates);
        // ⚠️ NESSUN break anticipato: anche il ritaglio contaminato può
        // produrre un match «abbastanza buono» ma SBAGLIATO (il «6²» della
        // segnalazione 27/9 dava 7 con dist 0,30 < soglia al primo pad).
        // Si valutano SEMPRE tutti i ritagli e si tiene il migliore.
        tries.push({ digit, dist, norm });
        if (dist < bestDist) {
          bestDist = dist;
          bestDigit = digit;
          bestNorm = norm;
        }
      }
      // Un ritaglio con padding può far entrare un pezzo del vicino («)» accanto al «3» → «1» con
      // distanza di un soffio più bassa: 0,192 contro 0,194 del «3» esatto): vedi pickExponentRead.
      const picked = pickExponentRead(tries, EXP_TIGHT_TOL, TEMPLATE_MAX_DIST);
      if (picked) {
        bestDist = picked.dist;
        bestDigit = picked.digit;
        bestNorm = picked.norm;
      }
      if (bestNorm && bestDist <= TEMPLATE_MAX_DIST) {
        out.push(bestDigit);
        continue;
      }
      // Fallback: il carattere letto da Tesseract (se cifra) vale SOLO se
      // la FORMA lo conferma (distanza vicina alla migliore e comunque
      // modesta); altrimenti si usa la cifra col template migliore se il
      // glifo è abbastanza leggibile; in extremis il fallback storico.
      if (
        bestNorm &&
        /^[0-9]$/.test(b.raw) &&
        digitDist(bestNorm, templates, b.raw) <=
          Math.min(0.45, bestDist + 0.03)
      ) {
        out.push(b.raw);
        continue;
      }
      if (bestNorm && bestDist <= 0.6) {
        out.push(bestDigit);
        continue;
      }
      out.push(fallbackSupDigit(b.raw));
    }
    return out;
  } finally {
    bmp.close();
  }
}

/* ── Riconoscimento ────────────────────────────────────────────────────── */

/** Maschera dell'inchiostro dell'immagine PREPARATA (quella vista da Tesseract) e un classificatore
 *  di cifre (template) sugli stessi pixel. */
async function inkFieldFromBlob(prepared: Blob): Promise<{ field: InkField; readers: GlyphReaders }> {
  const bmp = await createImageBitmap(prepared);
  try {
    const cv = document.createElement("canvas");
    cv.width = bmp.width;
    cv.height = bmp.height;
    const ctx = cv.getContext("2d");
    if (!ctx) throw new Error("canvas non disponibile");
    ctx.drawImage(bmp, 0, 0);
    const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const gray = new Uint8Array(cv.width * cv.height);
    for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = (px[j]! * 77 + px[j + 1]! * 150 + px[j + 2]! * 29) >> 8;
    const W = cv.width;
    const H = cv.height;
    const templates = getDigitTemplates();
    const rank: DigitRank = (b) => {
      // ritaglio STRETTO sul glifo (nessun padding: non entra inchiostro vicino), tolleranza 1 px
      const x0 = Math.max(0, b.x0 - 1);
      const y0 = Math.max(0, b.y0 - 1);
      const x1 = Math.min(W, b.x1 + 1);
      const y1 = Math.min(H, b.y1 + 1);
      const cw = x1 - x0;
      const ch = y1 - y0;
      if (cw < 3 || ch < 3) return null;
      const g = new Float32Array(cw * ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) g[y * cw + x] = gray[(y0 + y) * W + (x0 + x)]!;
      return bestDigitMatch(normalizeGlyph({ w: cw, h: ch, gray: g }), templates);
    };
    const classify: DigitClassifier = (b) => {
      const r = rank(b);
      return r && r.dist <= TEMPLATE_MAX_DIST ? r.digit : null;
    };
    // distanza a template di UNA cifra specifica (giro 18): serve alla regola a margine di
    // `refine` — il template corregge Tesseract solo se la sua forma è netta e quella di
    // Tesseract sensibilmente peggiore (foto reale 21/10: «2» letto «7»)
    const distTo = (b: { x0: number; y0: number; x1: number; y1: number }, digit: string): number => {
      const x0 = Math.max(0, b.x0 - 1);
      const y0 = Math.max(0, b.y0 - 1);
      const x1 = Math.min(W, b.x1 + 1);
      const y1 = Math.min(H, b.y1 + 1);
      const cw = x1 - x0;
      const ch = y1 - y0;
      if (cw < 3 || ch < 3) return Infinity;
      const tmpl = templates[digit];
      if (!tmpl) return Infinity;
      const g = new Float32Array(cw * ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) g[y * cw + x] = gray[(y0 + y) * W + (x0 + x)]!;
      return glyphDistance(normalizeGlyph({ w: cw, h: ch, gray: g }), tmpl);
    };
    return { field: inkFieldFromGray(gray, W, H), readers: { classify, rank, distTo } };
  } finally {
    bmp.close();
  }
}

/** Legge SOLO cifre (e la variabile x) in un ritaglio dell'immagine preparata:
 *  una riga sola (PSM 7), ingrandito — è la lettura di num/den di una frazione. */
/** Versione NITIDA (unsharp 3×3) del ritaglio: le foto piccole (es. 323×84 px
 *  ingrandite ~13×) arrivano a Tesseract sfocate e le cifre si perdono — foto
 *  reale 21/10: il «3» di 3⁄7 dava lettura VUOTA, il «12» di 7⁄12 letto «17». */
function sharpenCanvas(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = src.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const img = ctx.getImageData(0, 0, src.width, src.height);
  // createImageData (e non «new ImageData»): portabile anche in Node (@napi-rs/canvas)
  const out = ctx.createImageData(src.width, src.height);
  const d = img.data;
  const o = out.data;
  const at = (x: number, y: number, c: number) => d[(y * src.width + x) * 4 + c]!;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const k = (y * src.width + x) * 4;
      for (let c = 0; c < 3; c++) {
        if (x === 0 || y === 0 || x === src.width - 1 || y === src.height - 1) {
          o[k + c] = at(x, y, c);
        } else {
          const v = 5 * at(x, y, c) - at(x - 1, y, c) - at(x + 1, y, c) - at(x, y - 1, c) - at(x, y + 1, c);
          o[k + c] = Math.max(0, Math.min(255, v));
        }
      }
      o[k + 3] = d[k + 3]!;
    }
  }
  const cv = document.createElement("canvas");
  cv.width = src.width;
  cv.height = src.height;
  const c2 = cv.getContext("2d");
  if (!c2) return null;
  c2.putImageData(out, 0, 0);
  return cv;
}

/** LEMBI DI PARENTESI nel ritaglio (giro 18, foto reale 21/10): numBox/denBox allarga di
 *  0,15·g oltre la barra e può includere un lembo della parentesi che abbraccia la frazione —
 *  colonne di inchiostro a TUTTA altezza sul bordo del ritaglio. «3»+lembo viene letto «5».
 *  Si cancellano le corsе di colonne di bordo con inchiostro da cima a fondo, SOLO se la corsa
 *  è stretta (≤ 0,35·w: un lembo è stretto; una cifra intera non si tocca mai). */
function trimEdgeFullHeight(c: HTMLCanvasElement, cx: CanvasRenderingContext2D): void {
  const w = c.width;
  const h = c.height;
  const img = cx.getImageData(0, 0, w, h);
  const d = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max - min < 40) return;
  const th = (min + max) / 2;
  const full: boolean[] = new Array(w);
  for (let x = 0; x < w; x++) {
    let y0 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++) {
      if (d[(y * w + x) * 4]! < th) {
        if (y0 < 0) y0 = y;
        y1 = y;
      }
    }
    full[x] = y0 >= 0 && y1 - y0 + 1 >= 0.88 * h;
  }
  const runLen = (from: number, dir: 1 | -1): number => {
    let n = 0;
    for (let x = from; x >= 0 && x < w && full[x]; x += dir) n++;
    return n;
  };
  const clearCol = (x: number) => {
    for (let y = 0; y < h; y++) {
      const k = (y * w + x) * 4;
      d[k] = 255;
      d[k + 1] = 255;
      d[k + 2] = 255;
    }
  };
  const l = runLen(0, 1);
  if (l > 0 && l <= 0.35 * w) for (let i = 0; i < l; i++) clearCol(i);
  const r = runLen(w - 1, -1);
  if (r > 0 && r <= 0.35 * w) for (let i = 0; i < r; i++) clearCol(w - 1 - i);
  if (l > 0 || r > 0) cx.putImageData(img, 0, 0);
}

async function readRegionDigits(
  prepared: Blob,
  box: { x0: number; y0: number; x1: number; y1: number },
  worker: OcrWorker,
): Promise<string> {
  const bmp = await createImageBitmap(prepared);
  try {
    const sx = Math.max(0, Math.round(box.x0));
    const sy = Math.max(0, Math.round(box.y0));
    const sw = Math.min(bmp.width - sx, Math.round(box.x1 - box.x0));
    const sh = Math.min(bmp.height - sy, Math.round(box.y1 - box.y0));
    if (sw < 3 || sh < 3) return "";
    const scale = sw < 60 ? 4 : 2;
    const cv = document.createElement("canvas");
    cv.width = sw * scale;
    cv.height = sh * scale;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    trimEdgeFullHeight(cv, ctx);
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res));
    if (!blob) return "";
    // ritaglio STRETT0 (rapporto w/h ≤ 1,15 → una sola cifra): PSM 10 (carattere
    // singolo) legge meglio la cifra isolata — SINGLE_LINE la confonde con i
    // resti dei vicini («9» letto «0», banco 19/10 giro 15)
    const narrow = sw <= 1.15 * sh;
    await worker.setParameters({
      tessedit_pageseg_mode: narrow ? PSM.SINGLE_CHAR : PSM.SINGLE_LINE,
      tessedit_char_whitelist: "0123456789x",
    });
    const DIGDBG = (globalThis as { __PHOTO_FRAC_DEBUG__?: boolean }).__PHOTO_FRAC_DEBUG__;
    /** grigi del ritaglio ingrandito (per il template matching di forma) */
    const grayOf = () => {
      const img = ctx.getImageData(0, 0, cv.width, cv.height);
      const gray = new Float32Array(cv.width * cv.height);
      for (let i = 0; i < gray.length; i++) {
        gray[i] =
          0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2];
      }
      return gray;
    };
    const grayAll = grayOf();
    /** Rilettura di forma: per ogni SIMBOLO cifra individuato da Tesseract si
     *  normalizza il suo ritaglio e lo si confronta con i template. Un simbolo
     *  viene corretto SOLO se il template lo contraddice con MARGINE netto
     *  (dist ≤ 0,3 E distOcr > dist + 0,08 — regola conservativa dopo l'errore
     *  del giro 16, che sovrascriveva con 0,35 fisso senza margine e corrompeva
     *  «2⁄5», banco caso 19). Ritorna null se non c'è nulla di sensato. */
    /** Rilettura di forma PROPRIA (giro 18): i simboli Tesseract dei ritagli
     *  num/den spesso sono VUOTI (banco 21/10: PHOTOSYM #1+ senza simboli), così
     *  si segmentano i glifi dal profilo delle colonne dell'inchiostro —
     *  escludendo le righe di una eventuale LINEA di frazione che attraversa
     *  tutto il ritaglio (renderebbero continue le colonne). Ogni glifo si
     *  normalizza e si confronta con i template: correzione SOLO con margine
     *  netto (dist ≤ 0,3 E distOcr > dist + 0,08 — regola conservativa dopo
     *  l'errore del giro 16, che sovrascriveva con 0,35 fisso senza margine e
     *  corrompeva «2⁄5», banco caso 19). Ritorna null se la segmentazione non
     *  coincide con la lettura attesa. */
    const templateRead = (expected: string): string | null => {
      const w = cv.width;
      const h = cv.height;
      let min = 255;
      let max = 0;
      for (let i = 0; i < grayAll.length; i++) {
        const v = grayAll[i]!;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const th = (min + max) / 2;
      const ink = (x: number, y: number) => grayAll[y * w + x]! < th;
      // righe da ESCLUDERE: inchiostro largo > 0,8·w = linea di frazione / bordo
      const rowSkip = new Uint8Array(h);
      for (let y = 0; y < h; y++) {
        let x0 = -1;
        let x1 = -1;
        for (let x = 0; x < w; x++) {
          if (ink(x, y)) {
            if (x0 < 0) x0 = x;
            x1 = x;
          }
        }
        rowSkip[y] = x0 >= 0 && x1 - x0 + 1 > 0.8 * w ? 1 : 0;
      }
      // profilo delle colonne (sulle righe valide)
      const colInk = new Uint8Array(w);
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          if (!rowSkip[y] && ink(x, y)) {
            colInk[x] = 1;
            break;
          }
        }
      }
      // run di colonne con inchiostro, gap ≤ 2 px saldati
      const runs: Array<{ x0: number; x1: number }> = [];
      let x = 0;
      while (x < w) {
        if (colInk[x]) {
          let x1 = x;
          while (x1 + 1 < w && (colInk[x1 + 1] || (x1 + 3 < w && colInk[x1 + 2] !== 0 && colInk[x1 + 3] !== 0 && !colInk[x1 + 1] && !colInk[x1 + 2] ? false : false))) x1++;
          // salda gap fino a 2 px
          while (x1 + 3 < w && !colInk[x1 + 1] && !colInk[x1 + 2] && colInk[x1 + 3]) x1 += 3;
          while (x1 + 1 < w && colInk[x1 + 1]) x1++;
          runs.push({ x0: x, x1 });
          x = x1 + 1;
        } else x++;
      }
      if (runs.length !== expected.length || expected.length === 0) {
        if (DIGDBG)
          console.log(
            `DIGDBG tmplRead runs=${runs.length} attesi=${expected.length} box=${Math.round(box.x0)},${Math.round(box.y0)}`,
          );
        return null;
      }
      let out = "";
      for (let i = 0; i < runs.length; i++) {
        const t = expected[i]!;
        const rx0 = runs[i]!.x0;
        const rx1 = runs[i]!.x1;
        // range Y del glifo dentro le righe valide
        let y0 = -1;
        let y1 = -1;
        for (let y = 0; y < h; y++) {
          if (rowSkip[y]) continue;
          for (let xx = rx0; xx <= rx1; xx++) {
            if (ink(xx, y)) {
              if (y0 < 0) y0 = y;
              y1 = y;
              break;
            }
          }
        }
        const gw = rx1 - rx0 + 1;
        const gh = y1 < 0 ? 0 : y1 - y0 + 1;
        if (gw < 3 || gh < 3) return null;
        const g = new Float32Array(gw * gh);
        for (let yy = 0; yy < gh; yy++) {
          for (let xx = 0; xx < gw; xx++) g[yy * gw + xx] = grayAll[(y0 + yy) * w + (rx0 + xx)]!;
        }
        const norm = normalizeGlyph({ w: gw, h: gh, gray: g });
        const best = bestDigitMatch(norm, getDigitTemplates());
        const dOcr = /^[0-9]$/.test(t) ? glyphDistance(norm, getDigitTemplates()[t]!) : Infinity;
        if (DIGDBG)
          console.log(
            `DIGDBG sym «${t}»→${best.digit} dist=${best.dist.toFixed(3)} distOcr=${Number.isFinite(dOcr) ? dOcr.toFixed(3) : "-"} box=${Math.round(box.x0)},${Math.round(box.y0)}`,
          );
        out += best.digit !== t && best.dist <= 0.3 && dOcr > best.dist + 0.08 ? best.digit : t;
      }
      return out;
    };
    const cleanText = (t: string | undefined) => (t ?? "").replace(/[^0-9x]/g, "");
    try {
      const psm1 = narrow ? PSM.SINGLE_CHAR : PSM.SINGLE_LINE;
      await worker.setParameters({ tessedit_pageseg_mode: psm1, tessedit_char_whitelist: "0123456789x" });
      const { data } = await worker.recognize(blob);
      const v1 = cleanText(data.text);
      let first = v1;
      if (!first && narrow) {
        // vuoto su ritaglio stretto: riprova in modalità riga
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
        const retry = await worker.recognize(blob);
        first = cleanText(retry.data.text);
      }
      // ⚠️ SECONDO TENTATIVO NITIDO (giro 18): le foto piccole ingrandite
      // arrivano sfocate e Tesseract perde cifre intere («3» → vuoto) o le
      // scambia («12» → «17»). La versione nitida NON vince da sola (può
      // peggiorare: «9» → «2» sulla foto reale): vale solo come SECONDA VOCE,
      // e in caso di disaccordo decide il template (v. sotto).
      let v2 = "";
      if (first === "" || (first.length <= 2 && /^[0-9]+$/.test(first))) {
        const sharp = sharpenCanvas(cv);
        if (sharp) {
          const sblob = await new Promise<Blob | null>((res) => sharp.toBlob(res));
          if (sblob) {
            const { data: d2 } = await worker.recognize(sblob);
            v2 = cleanText(d2.text);
            if (DIGDBG)
              console.log(
                `DIGDBG sharp read=«${v1}»→«${v2}» box=${Math.round(box.x0)},${Math.round(box.y0)}`,
              );

            if (first === "" && v2) first = v2;
          }
        }
      }
      // ⚠️ DISACCORDO fra le due letture: il template decide SOLO se CONFERMA
      // una delle due (consenso di due prove indipendenti). Senza conferma
      // resta la prima voce di Tesseract.
      if (v2 && v1 && v2 !== v1) {
        // DISACCORDO fra le due letture: il template (segmentazione propria,
        // indipendente da Tesseract) decide SOLO se conferma una delle due.
        const t = templateRead(v1) ?? templateRead(v2);
        if (DIGDBG)
          console.log(
            `DIGDBG discord v1=«${v1}» v2=«${v2}» t=${t === null ? "—" : `«${t}»`} box=${Math.round(box.x0)},${Math.round(box.y0)}`,
          );
        if (t === v2 && t !== v1) first = v2;
        // altrimenti resta v1
      } else if (v2 && v1 === v2 && /^[0-9]{1,3}$/.test(v1)) {
        // ⚠️ ENTRAMBE le letture Concordano ma possono essere ugualmente
        // sbagliate («12» → «17» due volte): qui, e SOLO qui, il template può
        // correggere per simbolo — con la regola a margine netto di templateRead.
        const t = templateRead(v1);
        if (t && t !== v1) {
          if (DIGDBG) console.log(`DIGDBG consenso «${v1}» → «${t}» box=${Math.round(box.x0)},${Math.round(box.y0)}`);
          first = t;
        }
      }
      // ⚠️ SOCCORSO DI FORMA (giro 16, soglia allargata giro 18): lettura VUOTA
      // su ritaglio di UNA cifra → template matching (il vuoto è il caso
      // peggiore: la frazione non si ricostruisce proprio; il «3» di 3⁄7 della
      // foto reale sfocato distava > 0,35). Non tocca MAI le letture non vuote.
      if (narrow && first === "") {
        const norm = normalizeGlyph({ w: cv.width, h: cv.height, gray: grayAll });
        const { digit, dist } = bestDigitMatch(norm, getDigitTemplates());
        if (DIGDBG)
          console.log(
            `DIGDBG empty read=«» tmpl=${digit} dist=${dist.toFixed(3)} box=${Math.round(box.x0)},${Math.round(box.y0)}`,
          );
        if (dist <= 0.5) return digit;
      }
      return first;
    } finally {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: "",
      });
    }
  } finally {
    bmp.close();
  }
}

function flattenSymbols(blocks: unknown): OcrSymbol[] {
  const out: OcrSymbol[] = [];
  const bs = (blocks as Array<Record<string, unknown>>) ?? [];
  for (const b of bs) {
    for (const p of (b?.paragraphs as Array<Record<string, unknown>>) ?? []) {
      for (const l of (p?.lines as Array<Record<string, unknown>>) ?? []) {
        for (const w of (l?.words as Array<Record<string, unknown>>) ?? []) {
          for (const s of (w?.symbols as Array<Record<string, unknown>>) ?? []) {
            const bb = s?.bbox as { x0: number; y0: number; x1: number; y1: number } | undefined;
            if (bb && typeof s?.text === "string") {
              out.push({ text: s.text, x0: bb.x0, y0: bb.y0, x1: bb.x1, y1: bb.y1 });
            }
          }
        }
      }
    }
  }
  return out;
}

/** Gancio di DIAGNOSI (banco foto): riceve campo d'inchiostro, lettori e simboli prima/dopo la
 *  riconciliazione. Vuoto in produzione. */
export const ocrDebug: {
  /** true = salta la riconciliazione (confronto A/B del banco) */
  skipReconcile?: boolean;
  onReconcile?: (info: { field: InkField; readers: GlyphReaders; before: OcrSymbol[]; after: OcrSymbol[] }) => void;
} = {};

/** Riconosce il testo in una foto (o nel ritaglio di una foto). */
export async function ocrImage(
  file: File | Blob,
  onProgress?: (p: number) => void
): Promise<string> {
  onProgress?.(0.05);
  let prepared: Blob = file;
  try {
    prepared = await enhanceForOcr(file);
  } catch {
    prepared = file;
  }
  onProgress?.(0.12);
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(prepared, {}, { text: true, blocks: true });
  let text = data.text ?? "";
  try {
    let symbols = flattenSymbols(data.blocks);
    // 6/10: i riquadri di Tesseract a bassa risoluzione non seguono i glifi (4² fuso in un «4»
    // largo → «+», «2» spurio → «4 alla 22», puntino perso o letto «:»): si riconciliano con i
    // glifi reali dell'immagine preparata. Se i pixel non sono disponibili restano i simboli.
    let field: InkField | null = null;
    if (!ocrDebug.skipReconcile) {
      try {
        const fr = await inkFieldFromBlob(prepared);
        field = fr.field;
        const before = symbols;
        symbols = reconcileSymbols(symbols, field, fr.readers);
        ocrDebug.onReconcile?.({ field, readers: fr.readers, before, after: symbols });
      } catch {
        /* nessun canvas: si prosegue con i simboli grezzi */
      }
    }
    // 19/10: FRAZIONI IMPILATE — la linea si cerca NEI PIXEL (Tesseract legge
    // la frazione a righe e perde pezzi): numeratore e denominatore vengono
    // riconosciuti SU RITAGLIO INGRANDITO (una riga sola, solo cifre) e la
    // frazione diventa UN simbolo sintetico «n⁄d». Senza barre nei pixel si
    // prova la ricostruzione dai soli riquadri.
    try {
      const bars = field ? findFractionBars(field, symbols) : [];
      const plans = bars.length > 0 ? planPhotoFractions(symbols, bars) : [];
      const FRACDBG = (globalThis as { __PHOTO_FRAC_DEBUG__?: boolean }).__PHOTO_FRAC_DEBUG__;
      if (FRACDBG)
        console.log(
          "FRACSYM " +
            symbols
              .map((s) => `${JSON.stringify(s.text)}[${Math.round(s.x0)},${Math.round(s.y0)},${Math.round(s.x1)},${Math.round(s.y1)}]`)
              .join(" "),
        );
      if (FRACDBG) console.log(`FRACDBG bars=${bars.length} plans=${plans.length} ` + plans.map((p) => `[bar ${Math.round(p.bar.x0)},${Math.round(p.bar.y0)}-${Math.round(p.bar.x1)},${Math.round(p.bar.y1)} drop=${p.drop.length} contain=${p.contain.length} sopra=${p.above.length} sotto=${p.below.length}]`).join(" "));
      if (plans.length > 0) {
        const drop = new Set<number>();
        const synth: OcrSymbol[] = [];
        for (const p of plans) {
          let num = await readRegionDigits(prepared, p.numBox, worker);
          let den = await readRegionDigits(prepared, p.denBox, worker);
          // secondo tentativo con ritaglio più largo (il primo resta a volte
          // vuoto quando il margine stringe troppo la cifra)
          if (!num)
            num = await readRegionDigits(
              prepared,
              { x0: p.numBox.x0 - 0.25 * p.g, y0: p.numBox.y0 - 0.4 * p.g, x1: p.numBox.x1 + 0.25 * p.g, y1: p.numBox.y1 },
              worker,
            );
          if (!den)
            den = await readRegionDigits(
              prepared,
              { x0: p.denBox.x0 - 0.25 * p.g, y0: p.denBox.y0, x1: p.denBox.x1 + 0.25 * p.g, y1: p.denBox.y1 + 0.4 * p.g },
              worker,
            );
          // riserva: i simboli sopra/sotto (solo CIFRE — le lettere qui sono
          // sempre spazzatura dai vicini: «tie», «h11» nel banco 19/10)
          if (!num) num = (fallbackGroupText(p.above) ?? "").replace(/[^0-9x]/g, "");
          if (!den) den = (fallbackGroupText(p.below) ?? "").replace(/[^0-9x]/g, "");
          if (FRACDBG) console.log(`FRACDBG bar@${Math.round(p.bar.x0)},${Math.round(p.bar.y0)}: num=«${num}» den=«${den}»`);
          if (!num || !den) continue;
          p.drop.forEach((k) => drop.add(k));
          // il glifo FUSO (num+linea+den in un solo simbolo) si butta solo
          // ora che la frazione è stata davvero ricostruita dal ritaglio
          p.contain.forEach((k) => drop.add(k));
          synth.push({
            text: `${num}\u2044${den}`,
            x0: p.bar.x0,
            y0: p.bar.y0 - p.g,
            x1: p.bar.x1,
            y1: p.bar.y1 + p.g,
          });
        }
        if (synth.length > 0) {
          const kept = symbols.filter((_, k) => !drop.has(k));
          kept.push(...synth);
          // Tesseract legge le righe dall'alto in basso: si riordina per x
          kept.sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
          symbols = kept;
        }
      } else {
        const frx = extractStackedFractions(symbols);
        if (frx.fracs > 0) symbols = frx.symbols;
      }
    } catch (e) {
      console.log("FRACERR", e instanceof Error ? e.stack : String(e));
    }
    // 19/10: le FRAZIONI IMPILATE si ricostruiscono dai riquadri (linea +
    // numeratore + denominatore → «n⁄d»): senza questo Tesseract le sfalda in
    // righe separate e il testo è polvere. Prima del riordino di x fatto qui.
    try {
      const frx = extractStackedFractions(symbols);
      if (frx.fracs > 0) symbols = frx.symbols;
    } catch {
      /* niente frazioni ricostruite: si prosegue coi simboli grezzi */
    }
    if (symbols.length >= 3) {
      const geo = rebuildFromSymbols(symbols);
      if (geo.supBoxes.length > 0) {
        onProgress?.(0.85);
        const digits = await resolveSuperscripts(prepared, geo.supBoxes);
        let i = 0;
        text = geo.text.replace(/\u0001/g, () => digits[i++] ?? "2");
      } else {
        text = geo.text;
      }
    }
  } catch {
    /* geometria non disponibile (canvas assente…): resta il testo semplice,
       gestito dalle regole testuali di normalizeExpressionOcr */
  }
  return text;
}
