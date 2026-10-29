/**
 * Ricostruzione GEOMETRICA del testo OCR dai simboli con bounding box.
 *
 * Il testo semplice di Tesseract massacra gli apici stampati («5²»→«52» o
 * «5%», «2³»→«23») e confonde i segni (il punto di moltiplicazione «·»
 * diventa un trattino, il «+» diventa la cifra «4»). Ma i SIMBOLI con le
 * coordinate (tesseract.js: `recognize(img, {}, { text: true, blocks: true })`,
 * blocchi → paragrafi → righe → parole → simboli) dicono tutto:
 *
 * - un APICE è piccolo (h ≤ 85% della mediana) e ben sollevato sopra la
 *   linea di base (verificato su foto reale: apice h≈205 con rigo h≈280,
 *   base sollevata di ≈138 px = 0,49·H);
 * - il PUNTO DI MOLTIPLICAZIONE letto «-» è muchissimo più stretto delle
 *   cifre (w≈55 px contro w≈165 px della mediana; il vero meno è largo ≈200);
 * - un «+» letto come CIFRA è un glifo largo (w > 0,85·h) o sospeso: le
 *   cifre stampate sono strette (w/h ≈ 0,6) e poggiano sulla linea di base.
 *
 * Il VALORE dell'apice (² o ³…) non è nel carattere letto (Tesseract dà
 * «%», «°», «4», «2»…) ma nella FORMA del glifo: il ritaglio, binarizzato e
 * normalizzato, si confronta con le cifre renderizzate a canvas
 * (`normalizeGlyph` + `bestDigitMatch`) — margine verificato su foto reale:
 * ² → dist 0,12 dal «2» (0,26 dal «3»); ³ → dist 0,14 dal «3» (0,24 dal «5»).
 */

export interface OcrSymbol {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Regione di un apice rilevata a geometria (da risolvere col template). */
export interface SupBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** carattere che Tesseract ha letto (serve solo da fallback) */
  raw: string;
}

export interface GeometryResult {
  /** testo ricostruito; ogni apice è un SUP_PLACEHOLDER (nell'ordine) */
  text: string;
  supBoxes: SupBox[];
}

/** Placeholder di un apice nel testo di `rebuildFromSymbols`. */
export const SUP_PLACEHOLDER = "\u0001";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const isGlyph = (t: string) => /^[0-9a-zA-Z]$/.test(t);
/** caratteri in cui Tesseract trasforma un apice stampato (foto reale:
 *  ² → «%», «°», «4»; ³ → «3») */
const SUP_LIKE = /^[0-9a-zA-Z°%?*'"’]$/;

export function rebuildFromSymbols(symbols: OcrSymbol[]): GeometryResult {
  const glyphs = symbols.filter((s) => isGlyph(s.text));
  const H = median(glyphs.map((s) => s.y1 - s.y0)) || 1;
  const W = median(glyphs.map((s) => s.x1 - s.x0)) || 1;
  // linea di base = MEDIANA dei fondi dei glifi (il massimo è gonfiato
  // dalle box fuse dell'OCR: nella foto reale un «2» arrivava con y1=790
  // invece di ≈697, facendo sembrare apice un «+» letto «4»)
  const baseline = median(glyphs.map((s) => s.y1));

  let out = "";
  let prevSup = false;
  const supBoxes: SupBox[] = [];

  for (const s of symbols) {
    const t = s.text;
    if (!t.trim()) {
      prevSup = false;
      continue;
    }
    const w = s.x1 - s.x0;
    const h = s.y1 - s.y0;
    const raised = baseline - s.y1;

    // 1. APICE: glifo piccolo e sollevato sopra la linea di base.
    //    Due soglie (segnalazione 26/9 «potenze non riconosciute»):
    //    · classica: h ≤ 0,85·H e sollevamento ≥ 0,25·H (apice ben in alto);
    //    · rilassata: h ≤ 0,65·H e sollevamento ≥ 0,10·H — gli esponenti
    //      scritti a mano spesso stanno poco in alto o hanno la bbox
    //      gonfiata da Tesseract: se sono chiaramente PICCOLO e almeno un
    //      po' sollevati, sono comunque un apice.
    const supOk =
      (h <= 0.85 * H && raised >= 0.25 * H) ||
      (h <= 0.65 * H && raised >= 0.1 * H);
    // Un SEGNO con PROPORZIONI DA CIFRA, piccolo e BEN SOLLEVATO sopra la
    // linea di base è quasi sempre un apice letto male (segnalazione 27/9:
    // il ² di «4²» letto «+»). Serve il doppio filtro perché nel foto reale
    // «-», «·» e «=» hanno bbox naturalmente sollevate (un trattino non
    // arriva alla base: raised fino a 0,42·H) — li distingue l'ASPETTO:
    // un ² è stretto come una cifra (w/h ≈ 0,6), un «+»/«=» vero è largo
    // (w/h ≥ 1,0–1,8) e un vero «+» poggia sulla base (raised ≈ 0,1·H).
    // Il trattino resta fuori: un «-» stretto e sollevato è indistinguibile
    // dal «·» di moltiplicazione (regola 2 qui sotto).
    const aspect = h > 0 ? w / h : 99;
    const supSign =
      h <= 0.85 * H &&
      raised >= 0.25 * H &&
      aspect <= 0.95 &&
      (t === "+" || t === "=");
    if ((SUP_LIKE.test(t) || supSign) && supOk) {
      // STESSO apice SPEZZATO in due simboli (segnalazione 27/9: «4²» letto
      // «4^22»): se sovrappone ORIZZONTALMENTE all'apice precedente, con cui
      // è consecutivo, fonde la bbox invece di aggiungere un secondo
      // segnaposto. Un esponente vero a due cifre (es. 2^10) è fatto di
      // glifi AFFIANCATI, non sovrapposti: resta due segnaposto.
      const last = prevSup ? supBoxes[supBoxes.length - 1] : undefined;
      if (last) {
        const ov = Math.min(last.x1, s.x1) - Math.max(last.x0, s.x0);
        const minW = Math.min(last.x1 - last.x0, w);
        if (ov > 0.45 * minW) {
          last.x0 = Math.min(last.x0, s.x0);
          last.y0 = Math.min(last.y0, s.y0);
          last.x1 = Math.max(last.x1, s.x1);
          last.y1 = Math.max(last.y1, s.y1);
          prevSup = true;
          continue;
        }
      }
      if (!prevSup) out += "^";
      supBoxes.push({ x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, raw: t });
      out += SUP_PLACEHOLDER;
      prevSup = true;
      continue;
    }
    prevSup = false;

    // 2. «·» letto come trattino: un «-» molto più stretto delle cifre
    if (t === "-" && w < 0.5 * W) {
      out += "·";
      continue;
    }

    // 2-bis. «·» letto come PUNTO («.»): glifo minuscolo vicino alla base
    //    (segnalazione 26/9: il puntino di moltiplicazione sparisce o diventa
    //    un punto decimale! Il punto decimale in foto di espressioni scolastiche
    //    non esiste: in Italia si usa la virgola, che Tesseract distingue
    //    perché scende sotto la base)
    if (t === "." && w < 0.5 * W && h < 0.5 * H) {
      out += "·";
      continue;
    }

    // 3. «+» (o «·») letto come cifra: glifo LARGO o sospeso a mezz'aria
    //    (le cifre stampate sono strette e poggiano sulla linea di base)
    if (
      /^[0-9]$/.test(t) &&
      // un «+» ha altezza di mezza cifra: un glifo ALTO quanto una cifra non lo è mai (era il
      // «4²» fuso in un riquadro doppio che diventava «+»)
      ((w > 0.85 * h && h <= 0.9 * H) ||
        (h <= 0.9 * H && raised >= 0.08 * H && raised < 0.25 * H))
    ) {
      out += w >= 0.8 * W ? "+" : "·";
      continue;
    }

    out += t;
  }
  return { text: out, supBoxes };
}

/* ── Confronto del glifo con le cifre (per il VALORE dell'apice) ───────── */

export interface GlyphImage {
  w: number;
  h: number;
  /** grigio 0..255, riga per riga */
  gray: Float32Array;
}

export interface NormGlyph {
  w: number;
  h: number;
  v: Float32Array;
}

export const NORM_W = 28;
export const NORM_H = 36;

/** Binarizza (soglia min+max)/2, ritaglia l'inchiostro e normalizza. */
export function normalizeGlyph(g: GlyphImage): NormGlyph {
  let min = 255;
  let max = 0;
  for (let i = 0; i < g.gray.length; i++) {
    const v = g.gray[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const th = (min + max) / 2;
  const ink = new Uint8Array(g.gray.length);
  let x0 = g.w;
  let y0 = g.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.gray[y * g.w + x] < th) {
        ink[y * g.w + x] = 1;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const empty = { w: NORM_W, h: NORM_H, v: new Float32Array(NORM_W * NORM_H) };
  if (x1 < 0) return empty;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const v = new Float32Array(NORM_W * NORM_H);
  for (let y = 0; y < NORM_H; y++) {
    const sy = (y * bh) / NORM_H + y0;
    const yy = Math.min(g.h - 1, Math.floor(sy));
    const fy = sy - Math.floor(sy);
    const yb = Math.min(g.h - 1, yy + 1);
    for (let x = 0; x < NORM_W; x++) {
      const sx = (x * bw) / NORM_W + x0;
      const xx = Math.min(g.w - 1, Math.floor(sx));
      const fx = sx - Math.floor(sx);
      const xb = Math.min(g.w - 1, xx + 1);
      const a = ink[yy * g.w + xx];
      const b = ink[yy * g.w + xb];
      const c = ink[yb * g.w + xx];
      const d = ink[yb * g.w + xb];
      v[y * NORM_W + x] =
        a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
    }
  }
  return { w: NORM_W, h: NORM_H, v };
}

/** Distanza quadratica media tra due glifi normalizzati. */
export function glyphDistance(a: NormGlyph, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.v.length; i++) {
    const d = a.v[i] - b[i];
    s += d * d;
  }
  return s / a.v.length;
}

/**
 * Fra le letture di UN esponente con ritagli di padding crescente (il PRIMO è il più stretto, quello
 * esatto) sceglie la cifra. Si prende la distanza minima, ma il ritaglio esatto prevale se è a meno
 * di `tol` dal migliore e sotto `maxDist`: un ritaglio con padding può far entrare un pezzo del
 * vicino («)» accanto al «3» → «1» con 0,192 contro 0,194 del «3» esatto), mentre un vero guadagno
 * del padding (glifo tagliato dal riquadro) è molto più grande di `tol`.
 */
export function pickExponentRead<T extends { digit: string; dist: number }>(tries: T[], tol: number, maxDist: number): T | null {
  if (tries.length === 0) return null;
  let best = tries[0]!;
  for (const t of tries) if (t.dist < best.dist) best = t;
  const tight = tries[0]!;
  return tight.dist <= best.dist + tol && tight.dist <= maxDist ? tight : best;
}

export function bestDigitMatch(
  g: NormGlyph,
  templates: Record<string, Float32Array>
): { digit: string; dist: number } {
  let digit = "2";
  let dist = Infinity;
  for (const [d, t] of Object.entries(templates)) {
    const dd = glyphDistance(g, t);
    if (dd < dist) {
      dist = dd;
      // le chiavi possono avere un prefisso di stile («s0» = sans, «h0» =
      // corsivo tipo scrittura a mano): la cifra è l'ULTIMO carattere
      digit = d[d.length - 1] ?? "2";
    }
  }
  return { digit, dist };
}

/** Distanza minima del glifo dal template di UNA cifra precisa (tutti gli
 *  stili di font). Serve a corroborare il carattere letto da Tesseract:
 *  se la forma dell'apice assomiglia davvero alla cifra letta, la lettura
 *  è attendibile anche oltre la soglia del best match. */
export function digitDist(
  g: NormGlyph,
  templates: Record<string, Float32Array>,
  digit: string,
): number {
  let best = Infinity;
  for (const [d, t] of Object.entries(templates)) {
    if (d[d.length - 1] !== digit) continue;
    const dd = glyphDistance(g, t);
    if (dd < best) best = dd;
  }
  return best;
}

/** Sotto questa distanza il template è attendibile (foto reale: match 0,12–0,14). */
export const TEMPLATE_MAX_DIST = 0.35;

/** Se il template non è abbastanza sicuro: il carattere letto dall'OCR.
 *  «°», «%», «?», apostrofi… nella pratica sono sempre ². */
export function fallbackSupDigit(raw: string): string {
  if (/^[0-9]$/.test(raw)) return raw;
  return "2";
}
