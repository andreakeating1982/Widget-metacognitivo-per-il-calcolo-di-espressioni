// ─────────────────────────────────────────────────────────────────────────────
// RICONCILIAZIONE SIMBOLI TESSERACT ↔ GLIFI REALI (6/10, fase foto)
//
// Tesseract (LSTM) restituisce SIMBOLI con riquadro, ma i riquadri sono approssimati dal
// allineamento CTC e a bassa risoluzione NON seguono i glifi:
//   • `4²` esce come UN SOLO «4» largo il doppio → la regola «cifra larga = +» lo trasformava in «+»;
//   • a una scala diversa compare un «2» in più con un riquadro senza inchiostro («4 alla 22»);
//   • il puntino «·» esce come «:» (un solo punto!) oppure non esce affatto → «7·61» letto «761»;
//   • un «-» sottile sparisce.
// Qui si estraggono i GLIFI reali dall'immagine preparata (componenti connesse, con i punti
// sovrapposti di «:» e «=» uniti in un solo glifo) e si assegna ogni glifo al simbolo che lo copre
// meglio. Poi:
//   0 glifi → simbolo allucinato: scartato (salvo i segni piccoli, che possono essere sotto soglia);
//   1 glifo → il testo resta; «:» con UN punto → «·», «·» con DUE punti → «:»; riquadro stretto;
//   ≥2 glifi (simbolo fuso) → base + esponente («4²»): il glifo a destra, piccolo e alto, diventa
//        un simbolo «°» (poi risolto a template da `resolveSuperscripts`);
//   glifo senza simbolo → puntino «·», due punti «:», meno «-» o «=» perduti da Tesseract, solo se
//        piccoli, a metà altezza delle cifre e FRA due glifi (così il rumore non genera segni).
// Altre correzioni dai pixel (tutte pure, provate in ocrReconcile.test.ts e misurate dal banco foto):
//   • simbolo senza senso («§» «%» «~» «|»…: `isJunk`) sopra un glifo → riletto a template come cifra,
//        come parentesi (`printedBracket`: profilo del glifo) o come segno piccolo;
//   • TIPO di parentesi dai pixel: «(» dove c'è «[» (o viceversa, o «{») si corregge se il margine del
//        profilo è netto (BR_OVERRIDE_MARGIN); una parentesi persa da Tesseract si reinserisce
//        (BR_FREE_MARGIN); sotto BR_MIN_H px il profilo non è affidabile e non si interviene;
//   • lettera o segno a forma di cifra con template vicino (TUNE.letterToDigit) → cifra; una cifra
//        letta come un'ALTRA cifra si cambia solo con un template molto netto (TUNE.digitOverride);
//   • glifo a croce → «+» (`isPlusShape`), MAI per un glifo alto quanto una cifra («4²» fuso);
//   • UNA sola barra letta «=» → «-» (con una sola barra l'espressione finirebbe lì);
//   • riquadri impossibili (larghezza ≈ 1 px: `isDegenerate`), aste sui bordi del ritaglio e schegge
//        del taglio dell'utente scartati; granelli minuscoli ignorati quando si scompone un fuso.
// Funzione pura: l'immagine entra come maschera binaria (`InkField`).
// ─────────────────────────────────────────────────────────────────────────────
import { connectedComponents, type CcBox, inkMask } from "./glyphScale";
import type { OcrSymbol } from "./ocrGeometry";
import { bracketLike, classifyPrintedBracket } from "./printedBracket";

export interface InkField {
  w: number;
  h: number;
  /** 1 = inchiostro */
  mask: Uint8Array;
}

/** Maschera dell'inchiostro da una luminanza 0..255 (Otsu, lato minoritario). */
export function inkFieldFromGray(gray: ArrayLike<number>, w: number, h: number): InkField {
  return { w, h, mask: inkMask(gray) };
}

export interface Glyph {
  x0: number;
  y0: number;
  x1: number; // inclusivo
  y1: number; // inclusivo
  /** numero di componenti connesse unite (2 = «:» o «=») */
  blobs: number;
  area: number;
}

const gw = (g: { x0: number; x1: number }): number => g.x1 - g.x0 + 1;
const gh = (g: { y0: number; y1: number }): number => g.y1 - g.y0 + 1;

function median(v: number[]): number {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1) + 0.5)))]!;
}

/** Altezza tipica di un glifo «grande» (cifra) dalle componenti (mediana oltre il 35% del p90). */
function digitHeightOf(ccs: CcBox[]): number {
  const hs = ccs.map((b) => b.y1 - b.y0 + 1).sort((a, b) => a - b);
  if (hs.length === 0) return 0;
  const p90 = pct(hs, 0.9);
  const big = hs.filter((v) => v >= 0.35 * p90);
  return big.length ? pct(big, 0.5) : p90;
}

/** Glifi dell'immagine: componenti connesse senza rumore, con i punti sovrapposti uniti. */
export function extractGlyphs(field: InkField): { glyphs: Glyph[]; Hd: number } {
  let all = connectedComponents(field.mask, field.w, field.h).filter((b) => b.area >= 4);
  const Hd0 = digitHeightOf(all.filter((b) => b.area >= 8 && b.y1 - b.y0 + 1 >= 4));
  if (Hd0 <= 0) return { glyphs: [], Hd: 0 };
  // ARTEFATTI: righe e bordi della pagina (un'asta alta quasi quanto il ritaglio, il margine della
  // foto) non sono caratteri: Tesseract li legge «|», «:» o «1» e sporcano la fine dell'espressione.
  const isArtifact = (b: CcBox): boolean => {
    const h = b.y1 - b.y0 + 1;
    const w = b.x1 - b.x0 + 1;
    // ⚠️ NON basta «h ≥ 1,9·Hd» (giro 18, foto reale 21/10): le parentesi scritte a mano attorno a
    // una frazione impilata sono LEGITTIMAMENTE 2-3 volte l'altezza cifra e qui spariscono tutte
    // (la «(» di (3⁄7:9⁄14)² non arrivava mai alla riconciliazione). Un'asta o una riga di pagina
    // è però o a filo del bordo del ritaglio o sottilissima: si scartano solo quelle.
    if (h >= 1.9 * Hd0 && (b.x0 <= 1 || b.x1 >= field.w - 2 || b.y0 <= 1 || b.y1 >= field.h - 2 || Math.min(w, h) <= 0.12 * Hd0)) return true;
    if (b.y0 <= 1 && b.y1 >= field.h - 2 && h >= 1.4 * Hd0) return true;
    if ((b.x0 <= 1 || b.x1 >= field.w - 2) && h >= 1.2 * Hd0 && h >= 6 * w) return true;
    // scheggia ai bordi del ritaglio (il taglio dell'utente passa dentro un carattere vicino)
    if ((b.x0 <= 1 || b.x1 >= field.w - 2 || b.y0 <= 1 || b.y1 >= field.h - 2) && Math.min(w, h) <= 0.12 * Hd0 && Math.max(w, h) < 0.9 * Hd0) return true;
    return false;
  };
  all = all.filter((b) => !isArtifact(b));
  const Hd = digitHeightOf(all.filter((b) => b.area >= 8 && b.y1 - b.y0 + 1 >= 4));
  if (Hd <= 0) return { glyphs: [], Hd: 0 };
  // rumore: componenti sotto ~5% dell'altezza cifra in entrambe le dimensioni
  let comps: Glyph[] = all
    .filter((b) => Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1) >= 0.05 * Hd)
    .map((b) => ({ ...b, blobs: 1 }));
  // unione dei segni a più punti/barre sovrapposti in x («:», «=», «;»)
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < comps.length; i++) {
      for (let j = i + 1; j < comps.length; j++) {
        const a = comps[i]!;
        const b = comps[j]!;
        if (gh(a) > 0.4 * Hd || gh(b) > 0.4 * Hd) continue; // solo componenti piccole
        const ov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;
        const narrower = Math.min(gw(a), gw(b));
        if (ov < 0.6 * narrower) continue;
        const vgap = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1) - 1;
        if (vgap > 0.6 * Hd) continue;
        comps[i] = {
          x0: Math.min(a.x0, b.x0),
          y0: Math.min(a.y0, b.y0),
          x1: Math.max(a.x1, b.x1),
          y1: Math.max(a.y1, b.y1),
          blobs: a.blobs + b.blobs,
          area: a.area + b.area,
        };
        comps.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  comps = splitWideBlobs(comps, field, Hd);
  comps = comps.sort((a, b) => a.x0 - b.x0);
  return { glyphs: comps, Hd };
}

/** Cifre che si TOCCANO (blur, bassa risoluzione) o base+esponente incollati formano UNA componente
 *  larga più di una cifra (> 1,1·Hd): si taglia nel punto di minimo inchiostro (valle della
 *  proiezione sulle colonne), nel numero di parti stimato dalla larghezza (≈ 0,65·Hd a cifra). */
function splitWideBlobs(comps: Glyph[], field: InkField, Hd: number): Glyph[] {
  const out: Glyph[] = [];
  for (const c of comps) {
    const w = gw(c);
    const h = gh(c);
    if (w <= 1.1 * Hd || h < 0.5 * Hd || h > 1.5 * Hd || c.blobs !== 1) {
      out.push(c);
      continue;
    }
    const n = Math.max(2, Math.min(4, Math.round(w / (0.65 * Hd))));
    const col = new Float64Array(w);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = c.y0; y <= c.y1; y++) sum += field.mask[y * field.w + c.x0 + x]!;
      col[x] = sum;
    }
    const cuts: number[] = [];
    for (let k = 1; k < n; k++) {
      const centre = (k * w) / n;
      const lo = Math.max(1, Math.floor(centre - 0.22 * (w / n)));
      const hi = Math.min(w - 2, Math.ceil(centre + 0.22 * (w / n)));
      let best = lo;
      for (let x = lo; x <= hi; x++) if (col[x]! < col[best]!) best = x;
      cuts.push(best);
    }
    let start = 0;
    for (const cut of [...cuts, w]) {
      // le parti restano senza taglio se sono vuote o troppo strette
      const x0 = c.x0 + start;
      const x1 = c.x0 + (cut === w ? w - 1 : cut - 1);
      let y0 = Infinity;
      let y1 = -Infinity;
      let area = 0;
      for (let y = c.y0; y <= c.y1; y++)
        for (let x = x0; x <= x1; x++)
          if (field.mask[y * field.w + x]) {
            area++;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (area >= 8 && x1 >= x0) out.push({ x0, y0, x1, y1, blobs: 1, area });
      start = cut;
    }
  }
  return out;
}

interface LineBand {
  top: number;
  bottom: number;
  cy: number;
}

/** Righe di testo: cluster verticale dei glifi «da cifra». */
function lineBands(glyphs: Glyph[], Hd: number): LineBand[] {
  const digitLike = glyphs.filter((g) => gh(g) >= 0.7 * Hd && gh(g) <= 1.3 * Hd && gw(g) <= 1.3 * gh(g));
  const sorted = [...digitLike].sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
  const groups: Glyph[][] = [];
  for (const g of sorted) {
    const cy = (g.y0 + g.y1) / 2;
    const last = groups[groups.length - 1];
    if (last && cy - median(last.map((x) => (x.y0 + x.y1) / 2)) <= 0.8 * Hd) last.push(g);
    else groups.push([g]);
  }
  return groups.map((grp) => ({
    top: median(grp.map((g) => g.y0)),
    bottom: median(grp.map((g) => g.y1)),
    cy: median(grp.map((g) => (g.y0 + g.y1) / 2)),
  }));
}

const lineOf = (bands: LineBand[], cy: number, Hd: number): LineBand | null => {
  let best: LineBand | null = null;
  let bd = Infinity;
  for (const b of bands) {
    const d = Math.abs(cy - b.cy);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best && bd <= 1.0 * Hd ? best : null;
};

const inter = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }): number => {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
};
const areaOf = (b: { x0: number; y0: number; x1: number; y1: number }): number => Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));

const MARK = /^[·.:;,'`"’‘•*\-—–_=]$/;
const DOTS = /^[.:;,'`"’‘•·*]$/;

const UNOWNED_COST = 0.6;
/** distanza a template massima per INSERIRE una cifra che nessun simbolo reclama */
const UNCLAIMED_DIGIT_DIST = 0.25;

/** Soglie regolabili (il banco foto le varia con PHOTO_TUNE per tarare). Distanze a template:
 *  le cifre stampate corrette stanno sotto 0,07, un «+» o una lettera da ~0,2 in su. */
export const TUNE = {
  /** lettera/segno letto al posto di una cifra: si sostituisce se il template è più vicino di così */
  letterToDigit: 0.15,
  /** cifra letta come un'ALTRA cifra: si sostituisce solo con un template molto netto (0 = mai) */
  digitOverride: 0.035,
  /** glifo a forma di croce (+) letto come lettera/cifra/segno spurio */
  plusShape: true,
};

/** Un glifo a forma di «+»: quasi quadrato, mezza cifra, quattro angoli vuoti e croce al centro. */
export function isPlusShape(field: InkField, g: Glyph, Hd: number): boolean {
  const w = gw(g);
  const h = gh(g);
  if (g.blobs !== 1 || h < 0.4 * Hd || h > 0.95 * Hd || w < 0.7 * h || w > 1.4 * h) return false;
  let total = 0;
  let corners = 0;
  let hStrip = 0;
  let vStrip = 0;
  const cw = Math.max(1, Math.round(0.28 * w));
  const ch = Math.max(1, Math.round(0.28 * h));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!field.mask[(g.y0 + y) * field.w + g.x0 + x]) continue;
      total++;
      const inX = x < cw || x >= w - cw;
      const inY = y < ch || y >= h - ch;
      if (inX && inY) corners++;
      if (Math.abs(y - (h - 1) / 2) <= 0.2 * h) hStrip++;
      if (Math.abs(x - (w - 1) / 2) <= 0.2 * w) vStrip++;
    }
  }
  if (total < 12) return false;
  return corners / total <= 0.1 && hStrip / total >= 0.4 && vStrip / total >= 0.4;
}

/** Segno piccolo dal solo aspetto del glifo: puntino «·», due punti «:», uguale «=», meno «-». */
export function markOf(g: Glyph, Hd: number): string | null {
  const w = gw(g);
  const h = gh(g);
  if (g.blobs === 1 && h <= 0.35 * Hd && w <= 0.4 * Hd && Math.max(w, h) <= 1.6 * Math.min(w, h) + 2) return "·";
  if (g.blobs === 2 && w <= 0.45 * Hd && h >= 0.3 * Hd && h <= 0.85 * Hd && h >= w) return ":";
  if (g.blobs === 2 && w >= 0.3 * Hd && w <= 1.0 * Hd && h <= 0.5 * Hd && w >= 1.1 * h) return "=";
  if (g.blobs === 1 && w >= 1.5 * h && h <= 0.22 * Hd && w >= 0.3 * Hd && w <= 0.9 * Hd) return "-";
  return null;
}

const H_BAR = /^[-—–_=~]$/;

/** Simbolo con riquadro IMPOSSIBILE (larghezza ≈ 1 px: allineamento CTC sbagliato di Tesseract a
 *  bassa risoluzione, es. «9» e «0» alti 26 px e larghi 1 px): non corrisponde a nessun glifo. */
function isDegenerate(s: OcrSymbol, Hd: number): boolean {
  if (!s.text.trim()) return false;
  const w = s.x1 - s.x0;
  const h = s.y1 - s.y0;
  if (w < 0.05 * Hd) return true;
  return h < 0.05 * Hd && !H_BAR.test(s.text);
}

/** Un segno a più punti («:», «=») che Tesseract ha letto come DUE simboli (i due punti: «:» +
 *  «+», «.» + «.», «-» + «-»…) diventa UN simbolo col riquadro del glifo. */
function mergeMultiBlob(symbols: OcrSymbol[], glyphs: Glyph[], Hd: number): OcrSymbol[] {
  const drop = new Set<number>();
  const repl = new Map<number, OcrSymbol>();
  for (const g of glyphs) {
    if (g.blobs < 2 || gh(g) > 0.9 * Hd || gw(g) > 1.1 * Hd) continue;
    const mark = markOf(g, Hd);
    if (!mark) continue;
    const pad = 0.12 * Hd;
    const inside: number[] = [];
    symbols.forEach((s, si) => {
      if (drop.has(si) || !s.text.trim()) return;
      const cx = (s.x0 + s.x1) / 2;
      const cy = (s.y0 + s.y1) / 2;
      const small = s.x1 - s.x0 <= gw(g) + 2 * pad && s.y1 - s.y0 <= gh(g) + 2 * pad;
      if (small && cx >= g.x0 - pad && cx <= g.x1 + 1 + pad && cy >= g.y0 - pad && cy <= g.y1 + 1 + pad) inside.push(si);
    });
    if (inside.length >= 2) {
      inside.forEach((si, k) => {
        if (k === 0) repl.set(si, { text: mark, x0: g.x0, y0: g.y0, x1: g.x1 + 1, y1: g.y1 + 1 });
        else drop.add(si);
      });
    }
  }
  if (drop.size === 0 && repl.size === 0) return symbols;
  return symbols.flatMap((s, si) => (drop.has(si) ? [] : [repl.get(si) ?? s]));
}

const BRACKET_CH = /^[([{)\]}]$/;
/** simboli che in un'espressione non esistono: Tesseract li emette per glifi che non sa leggere */
const LEGIT = /^[0-9A-Za-z+\-—–·*×÷:/=()[\]{}^°.,]$/;
/** vero per un carattere che in un'espressione non può esistere («§», «%», «~», «|»…) */
const isJunk = (t: string): boolean => t.trim().length > 0 && !LEGIT.test(t);
/** margine minimo per CORREGGERE una parentesi che Tesseract ha già letto (altro tipo) */
const BR_OVERRIDE_MARGIN = 0.06;
/** margine minimo per leggere una parentesi che Tesseract non ha letto affatto */
const BR_FREE_MARGIN = 0.03;
/** sotto questa altezza (px) il profilo della parentesi non è affidabile */
const BR_MIN_H = 22;

/** Assegna ogni glifo a UN simbolo (o a nessuno) rispettando l'ordine di lettura: programmazione
 *  dinamica sul costo (1 − copertura del glifo da parte del riquadro del simbolo), con penalità per
 *  simboli senza glifi (probabili allucinazioni), glifi senza simbolo e simboli che ne reclamano
 *  molti. L'ordine toglie gli scambi dovuti ai riquadri sbagliati di Tesseract (un «9» il cui
 *  riquadro finisce sul «2» vicino). Per riga: i simboli si raggruppano per banda di appartenenza. */
function assignOwners(symbols: OcrSymbol[], glyphs: Glyph[], bands: LineBand[], Hd: number): number[] {
  const owner = new Array<number>(glyphs.length).fill(-1);
  const bandOfGlyph = glyphs.map((g) => {
    const b = lineOf(bands, (g.y0 + g.y1) / 2, Hd);
    return b ? bands.indexOf(b) : -1;
  });
  const bandOfSym = symbols.map((s) => {
    const b = lineOf(bands, (s.y0 + s.y1) / 2, Hd);
    return b ? bands.indexOf(b) : -1;
  });
  const groups = new Set<number>([...bandOfGlyph, ...bandOfSym]);
  for (const band of groups) {
    const gi = glyphs.map((_, i) => i).filter((i) => bandOfGlyph[i] === band).sort((a, b) => glyphs[a]!.x0 - glyphs[b]!.x0);
    const si = symbols.map((_, i) => i).filter((i) => bandOfSym[i] === band && symbols[i]!.text.trim() !== "");
    if (gi.length === 0 || si.length === 0) continue;
    const n = si.length;
    const m = gi.length;
    const cover = (sIdx: number, gIdx: number): number => {
      const g = glyphs[gIdx]!;
      const gb = { x0: g.x0, y0: g.y0, x1: g.x1 + 1, y1: g.y1 + 1 };
      const sy = symbols[sIdx]!;
      // il riquadro di un segno piccolo («-», «·») è spesso spostato di qualche pixel: si dilata
      if (MARK.test(sy.text)) {
        const pd = 0.25 * Hd;
        return inter({ x0: sy.x0 - pd, y0: sy.y0 - pd, x1: sy.x1 + pd, y1: sy.y1 + pd }, gb) / areaOf(gb);
      }
      return inter(sy, gb) / areaOf(gb);
    };
    const MAXK = 4;
    const INF = 1e9;
    // dp[i][j]: primi i simboli, primi j glifi
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(INF));
    const from: { pi: number; pj: number; k: number }[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
    dp[0]![0] = 0;
    for (let j = 1; j <= m; j++) {
      dp[0]![j] = dp[0]![j - 1]! + UNOWNED_COST;
      from[0]![j] = { pi: 0, pj: j - 1, k: -1 };
    }
    for (let i = 1; i <= n; i++) {
      const sIdx = si[i - 1]!;
      const t = symbols[sIdx]!.text;
      const skip = MARK.test(t) ? 0.25 : 0.8;
      for (let j = 0; j <= m; j++) {
        // il simbolo i non possiede nulla
        if (dp[i - 1]![j]! + skip < dp[i]![j]!) {
          dp[i]![j] = dp[i - 1]![j]! + skip;
          from[i]![j] = { pi: i - 1, pj: j, k: 0 };
        }
        // il simbolo i possiede k glifi consecutivi j-k..j-1
        for (let k = 1; k <= MAXK && k <= j; k++) {
          let c = 0.15 * (k - 1);
          let ink = 0;
          for (let q = j - k; q < j; q++) {
            c += 1 - cover(sIdx, gi[q]!);
            const g = glyphs[gi[q]!]!;
            ink += g.area;
          }
          const prev = dp[i - 1]![j - k]!;
          if (prev + c < dp[i]![j]!) {
            dp[i]![j] = prev + c;
            from[i]![j] = { pi: i - 1, pj: j - k, k };
          }
        }
        // glifo j-1 senza simbolo, dopo il simbolo i
        if (j > 0 && dp[i]![j - 1]! + UNOWNED_COST < dp[i]![j]!) {
          dp[i]![j] = dp[i]![j - 1]! + UNOWNED_COST;
          from[i]![j] = { pi: i, pj: j - 1, k: -1 };
        }
      }
    }
    // backtracking
    let i = n;
    let j = m;
    while (i > 0 || j > 0) {
      const f = from[i]![j];
      if (!f) break;
      if (f.k > 0) {
        for (let q = f.pj; q < j; q++) owner[gi[q]!] = si[i - 1]!;
      }
      i = f.pi;
      j = f.pj;
    }
  }
  return owner;
}

export interface ReconcileLog {
  dropped: number;
  split: number;
  dotFixed: number;
  inserted: number;
  expInserted: number;
  bracketFixed: number;
  bracketSplit: number;
}

/** Classificatore di UNA cifra dal glifo (template): la cifra o null se non è abbastanza sicuro. */
export type DigitClassifier = (box: { x0: number; y0: number; x1: number; y1: number }) => string | null;

/** Migliore cifra a template con la sua distanza (più bassa = più simile), senza soglia. */
export type DigitRank = (box: { x0: number; y0: number; x1: number; y1: number }) => { digit: string; dist: number } | null;

/** Lettori di glifi che dipendono dai pixel e dai template (iniettati: la funzione resta pura). */
export interface GlyphReaders {
  classify?: DigitClassifier;
  rank?: DigitRank;
  /** distanza a template di UNA cifra specifica nel riquadro (regola a margine di `refine`) */
  distTo?: (box: { x0: number; y0: number; x1: number; y1: number }, digit: string) => number;
}

/** Riconcilia i simboli di Tesseract con i glifi reali (vedi nota in testa al file). */
export function reconcileSymbols(
  symbolsIn: OcrSymbol[],
  field: InkField,
  readers: GlyphReaders = {},
  log?: ReconcileLog,
): OcrSymbol[] {
  const { classify } = readers;
  const { glyphs, Hd } = extractGlyphs(field);
  if (glyphs.length < 3 || Hd <= 0 || symbolsIn.length < 3) return symbolsIn;
  const symbols = mergeMultiBlob(symbolsIn, glyphs, Hd).filter((s) => !isDegenerate(s, Hd));
  const bands = lineBands(glyphs, Hd);

  // ── proprietà: allineamento MONOTONO simboli↔glifi nell'ordine di lettura (vedi assignOwners)
  const owner = assignOwners(symbols, glyphs, bands, Hd);
  const owned: number[][] = symbols.map(() => []);
  owner.forEach((si, gi) => {
    if (si >= 0) owned[si]!.push(gi);
  });
  const RDBG = (globalThis as { __RECON_DEBUG__?: boolean }).__RECON_DEBUG__;
  if (RDBG)
    console.log(
      "RDBG owned: " +
        owned
          .map((gsi, i) => `${i}:"${symbols[i]!.text}"→${gsi.map((gi) => `[${glyphs[gi]!.x0},${glyphs[gi]!.y0},${glyphs[gi]!.x1},${glyphs[gi]!.y1}]`).join("|")}`)
          .join(" "),
    );

  const out: OcrSymbol[] = [];
  const keepIdx: number[] = []; // indice (in `out`) → posizione nell'ordine originale
  symbols.forEach((s, si) => {
    const gs = owned[si]!.map((gi) => glyphs[gi]!).sort((a, b) => a.x0 - b.x0);
    const t = s.text;
    if (!t.trim()) {
      out.push(s);
      keepIdx.push(si);
      return;
    }
    if (gs.length === 0) {
      // un segno piccolo può essere sotto la soglia del rumore: si tiene, ma SOLO se il riquadro è
      // da segno (un «-» alto 1,7 cifre è un'allucinazione: dava il doppio meno «5--8»)
      if (MARK.test(t) && s.y1 - s.y0 <= 0.7 * Hd && s.x1 - s.x0 <= 1.2 * Hd) {
        out.push(s);
        keepIdx.push(si);
      } else if (log) log.dropped++;
      return;
    }
    const boxOf = (g: Glyph): { x0: number; y0: number; x1: number; y1: number } => ({ x0: g.x0, y0: g.y0, x1: g.x1 + 1, y1: g.y1 + 1 });
    const lineTopOf = (g: Glyph): number => {
      const l = lineOf(bands, (g.y0 + g.y1) / 2, Hd);
      return l ? l.top : g.y0;
    };
    const isExpGlyph = (g: Glyph): boolean =>
      gh(g) <= 0.78 * Hd && gh(g) >= 0.2 * Hd && g.y1 <= lineTopOf(g) + 0.7 * Hd && g.blobs === 1;
    const digitSize = (g: Glyph): boolean => gh(g) >= 0.7 * Hd && gh(g) <= 1.15 * Hd && gw(g) <= 1.2 * gh(g) && g.blobs === 1;
    const readBracket = (g: Glyph, minMargin: number): string | null => {
      if (!bracketLike(g, Hd) || gh(g) < BR_MIN_H) return null;
      const r = classifyPrintedBracket(field, g);
      return r && r.margin >= minMargin ? r.kind : null;
    };
    /** CIFRA/LETTERA/SEGNO letto male: la FORMA di un «+» e i template delle cifre (stampate, molto
     *  più netti di Tesseract a bassa risoluzione) correggono «e»/«1» al posto di «+», «g»/«a»/«E»
     *  al posto di 8/4 e le cifre scambiate. Mai su parentesi, puntini o esponenti. */
    const refine = (t0: string, g: Glyph): string => {
      if (!/^[0-9A-Za-z+\-—–=:]$/.test(t0)) return t0;
      if (TUNE.plusShape && t0 !== "+" && isPlusShape(field, g, Hd)) return "+";
      if (readers.rank && gh(g) >= 0.9 * Hd && gh(g) <= 1.12 * Hd && gw(g) <= 1.2 * gh(g) && g.blobs === 1) {
        const r = readers.rank(g);
        if (r) {
          const isDigit = /^[0-9]$/.test(t0);
          if (!isDigit && r.dist <= TUNE.letterToDigit) return r.digit;
          if (isDigit && r.digit !== t0 && TUNE.digitOverride > 0 && r.dist <= TUNE.digitOverride) return r.digit;
          // CIFRA SCAMBIATA CON MARGINE NETTO (giro 18, regola già di templateRead): il template
          // contraddice Tesseract solo se la forma è netta (dist ≤ 0,12) e la lettura di Tesseract
          // è sensibilmente peggiore (+0,08) — foto reale 21/10: il «2» finale di …·2 letto «7».
          if (isDigit && r.digit !== t0 && readers.distTo && r.dist <= 0.12) {
            const dOcr = readers.distTo(g, t0);
            if (dOcr > r.dist + 0.08) return r.digit;
          }
        }
      }
      return t0;
    };

    if (gs.length === 1) {
      const g = gs[0]!;
      let text = t;
      // ⚠️ MENO letto come lettera o cifra (giro 18, foto reale 21/10): un tratto lungo e sottile
      // (w ≥ 1,5·h, h ≤ 0,22·Hd — markOf «-») non può essere «i», «l» o una cifra: è un meno.
      // Una cifra vera è alta ~Hd e non entra mai in questa forma.
      if (markOf(g, Hd) === "-" && /[0-9A-Za-z]/.test(t)) {
        text = "-";
        if (log) log.dotFixed++;
      } else
      if (DOTS.test(t)) {
        if (g.blobs >= 2 && gh(g) >= 0.3 * Hd) text = ":";
        else if (g.blobs === 1 && gh(g) <= 0.45 * Hd && gw(g) <= 0.5 * Hd) text = "·";
        if (log && text !== t) log.dotFixed++;
      } else if (t === "·" && g.blobs >= 2 && gh(g) >= 0.3 * Hd) {
        text = ":";
        if (log) log.dotFixed++;
      } else if (t === "=" && g.blobs === 1 && gh(g) <= 0.22 * Hd && gw(g) >= 0.25 * Hd) {
        // una SOLA barra sottile non è un «=» (due barre): è un MENO che Tesseract ha letto «=»
        // (che il normalizzatore interpreta come fine dell'espressione!)
        text = "-";
      } else if (markOf(g, Hd) === "·" && !/^[0-9]$/.test(t) && (() => {
        const l = lineOf(bands, (g.y0 + g.y1) / 2, Hd);
        return !!l && (g.y0 + g.y1) / 2 >= l.top + 0.28 * (l.bottom - l.top) && (g.y0 + g.y1) / 2 <= l.top + 0.82 * (l.bottom - l.top);
      })()) {
        // un glifo MINUSCOLO a metà altezza non può essere una lettera: è il puntino del «per»
        // (Tesseract: «J», «-», «'»…)
        text = "·";
        if (log) log.dotFixed++;
      } else if (BRACKET_CH.test(t)) {
        // parentesi: il tipo letto dai pixel prevale su Tesseract solo se netto
        const k = readBracket(g, BR_OVERRIDE_MARGIN);
        if (k && k !== t) {
          text = k;
          if (log) log.bracketFixed++;
        }
      } else if (isJunk(t)) {
        // «%», «&»…: un glifo piccolo e sollevato è un ESPONENTE; alto e stretto una parentesi;
        // della misura di una cifra si legge a template
        const mk = g.blobs >= 2 || gh(g) <= 0.35 * Hd ? markOf(g, Hd) : null;
        if (mk) text = mk;
        else if (isExpGlyph(g)) text = "°";
        else {
          const k = readBracket(g, BR_FREE_MARGIN);
          if (k) {
            text = k;
            if (log) log.bracketFixed++;
          } else if (digitSize(g) && classify) {
            const d = classify(g);
            if (d !== null) text = d;
          }
        }
      }
      if (text === t) text = refine(t, g);
      // riquadro stretto sul glifo se Tesseract lo ha gonfiato
      const gb0 = boxOf(g);
      const iouG = inter(s, gb0) / (areaOf(s) + areaOf(gb0) - inter(s, gb0));
      const oversize = s.x1 - s.x0 > 1.3 * gw(g) || s.y1 - s.y0 > 1.25 * gh(g) || iouG < 0.6;
      out.push(oversize ? { text, ...gb0 } : { ...s, text });
      keepIdx.push(si);
      return;
    }

    // ≥ 2 glifi: simbolo FUSO («4²», «92²», «{(», «⁰)»…). Ogni glifo diventa un simbolo:
    //   · piccolo e sollevato → esponente «°» (poi risolto a template da resolveSuperscripts);
    //   · da parentesi (alto e stretto) → il tipo si legge dai pixel; se incerto e Tesseract aveva
    //     letto una parentesi, questa vale per la prima ancora senza lettura;
    //   · da cifra → il testo di Tesseract per la prima, le altre a template (null ⇒ si rinuncia).
    let used = false;
    let ok = true;
    let skippedBar = 0; // barre di frazione saltate (la ricostruzione le trova nell'inchiostro)
    if (RDBG && gs.length >= 2)
      console.log(`RDBG fuso "${t}": ` + gs.map((g) => `[${g.x0},${g.y0},${g.x1},${g.y1}]`).join(" "));
    /** inchiostro SOPRA e SOTTO un tratto orizzontale nella sua campata x: barra di una frazione
     *  (un meno non ha nulla né sopra né sotto) */
    const inkAboveBelow = (g: Glyph): boolean => {
      const probe = (ya: number, yb: number): boolean => {
        const a = Math.max(0, ya);
        const b = Math.min(field.h - 1, yb);
        if (a > b) return false;
        for (let y = a; y <= b; y++) for (let x = g.x0; x <= g.x1; x++) if (field.mask[y * field.w + x]) return true;
        return false;
      };
      const d = Math.round(0.9 * Hd);
      return probe(g.y0 - d, g.y0 - 2) && probe(g.y1 + 2, g.y1 + d);
    };
    const nBr = gs.filter((g) => bracketLike(g, Hd)).length;
    const parts: OcrSymbol[] = [];
    for (const g of gs) {
      if (bracketLike(g, Hd)) {
        let k = readBracket(g, BR_FREE_MARGIN);
        if (RDBG) console.log(`RDBG fuso "${t}" bracketLike [${g.x0},${g.y0}] readBracket=${k}`);
        if (!k && BRACKET_CH.test(t) && !used && nBr === 1) k = t;
        if (!k) {
          ok = false;
          break;
        }
        if (BRACKET_CH.test(t) && k === t) used = true;
        parts.push({ text: k, ...boxOf(g) });
      } else if (isExpGlyph(g)) {
        parts.push({ text: "°", ...boxOf(g) });
      } else if (TUNE.plusShape && isPlusShape(field, g, Hd)) {
        parts.push({ text: "+", ...boxOf(g) });
      } else if (digitSize(g)) {
        if (!used && /^[0-9a-zA-Z]$/.test(t)) {
          parts.push({ text: refine(t, g), ...boxOf(g) });
          used = true;
        } else {
          const d = classify ? classify(g) : null;
          if (d === null) {
            ok = false;
            break;
          }
          parts.push({ text: d, ...boxOf(g) });
        }
      } else {
        const mk = markOf(g, Hd);
        if (RDBG) console.log(`RDBG fuso "${t}" altro [${g.x0},${g.y0}] mk=${mk} skipBar=${gh(g) <= 0.12 * Hd && gw(g) >= 1.1 * Hd}`);
        if (!mk) {
          // ⚠️ BARRA DI FRAZIONE FUSA (giro 18, foto reale 21/10): larga e sottilissima, con
          // inchiostro SOPRA e SOTTO nella sua campata — la ricostruzione geometrica (giro 19/10)
          // la trova nell'inchiostro, quindi il pezzo si SALTA senza far fallire lo split.
          if (gh(g) <= 0.12 * Hd && gw(g) >= 1.1 * Hd && inkAboveBelow(g)) {
            skippedBar++;
            continue;
          }
          // MENO LUNGHISSIMO fuso con altro (w > 0,9·Hd esclude markOf): resta un meno
          if (gh(g) <= 0.12 * Hd && gw(g) >= 1.1 * Hd) {
            parts.push({ text: "-", ...boxOf(g) });
            continue;
          }
          // rumore minuscolo (granello, scheggia): si ignora; qualunque altra cosa non si sa leggere
          if (Math.max(gw(g), gh(g)) < 0.22 * Hd) continue;
          ok = false;
          break;
        }
        parts.push({ text: mk, ...boxOf(g) });
      }
    }
    // una barra di frazione saltata conta come pezzo: il simbolo fuso «( + barra + cifra»
    // NON deve restare intero (coprirebbe la parentesi e la cifra, e la frazione si
    // ricostruisce comunque dall'inchiostro)
    if (ok && parts.length + skippedBar >= 2) {
      parts.forEach((sp, j) => {
        out.push(sp);
        keepIdx.push(si + 0.001 * (j + 1));
      });
      if (log) {
        log.split++;
        if (nBr >= 2) log.bracketSplit++;
      }
      return;
    }
    out.push(s);
    keepIdx.push(si);
  });

  // ── glifi senza simbolo: ciò che Tesseract ha perso (cifre, parentesi, segni piccoli, esponenti).
  // Posizione: subito DOPO il simbolo che possiede il glifo a sinistra più vicino (stessa riga),
  // così l'ordine di lettura non dipende dai riquadri di Tesseract, spesso sbagliati.
  const ownedByX = glyphs
    .map((_, gi) => gi)
    .filter((gi) => owner[gi]! >= 0)
    .sort((x, y) => glyphs[x]!.x0 - glyphs[y]!.x0);
  const inserts: { at: number; sym: OcrSymbol }[] = [];
  const anchorOf = (g: Glyph): number => {
    let best = -1;
    let bx = -Infinity;
    for (const gi of ownedByX) {
      const o = glyphs[gi]!;
      if (o.x1 <= g.x0 + 0.5 * gw(g) && o.x1 > bx && Math.abs((o.y0 + o.y1) / 2 - (g.y0 + g.y1) / 2) <= 1.0 * Hd) {
        bx = o.x1;
        best = owner[gi]!;
      }
    }
    return best;
  };
  const addInsert = (g: Glyph, text: string): void => {
    inserts.push({ at: anchorOf(g) + 0.25 + 0.2 * (g.x0 / Math.max(1, field.w)), sym: { text, x0: g.x0, y0: g.y0, x1: g.x1 + 1, y1: g.y1 + 1 } });
  };
  glyphs.forEach((g, gi) => {
    if (owner[gi]! >= 0) return;
    const line = lineOf(bands, (g.y0 + g.y1) / 2, Hd);
    if (!line) return;
    const cy = (g.y0 + g.y1) / 2;
    const lh = line.bottom - line.top;
    const sameLine = glyphs.filter((o, oi) => oi !== gi && gh(o) >= 0.3 * Hd && Math.abs((o.y0 + o.y1) / 2 - line.cy) <= 0.8 * Hd);
    const left = sameLine.filter((o) => o.x1 < g.x0 && g.x0 - o.x1 <= 1.3 * Hd);
    const right = sameLine.filter((o) => o.x0 > g.x1 && o.x0 - g.x1 <= 1.3 * Hd);

    // PARENTESI PERDUTA: glifo alto e stretto. Basta un vicino da un lato (le parentesi stanno
    // anche a inizio e fine riga).
    if (bracketLike(g, Hd) && gh(g) >= BR_MIN_H) {
      const r = classifyPrintedBracket(field, g);
      if (r && r.margin >= 0.08 && (left.length > 0 || right.length > 0)) {
        addInsert(g, r.kind);
        if (log) log.bracketFixed++;
      }
      return;
    }
    // «+» PERDUTO o letto come altro che poi è stato scartato
    if (TUNE.plusShape && isPlusShape(field, g, Hd) && left.length > 0 && right.length > 0) {
      addInsert(g, "+");
      if (log) log.inserted++;
      return;
    }
    // CIFRA PERSA (Tesseract ha troncato la riga: «7·21²=» finiva a «7·»): glifo della misura di
    // una cifra, con vicini, letto a template. Soglia rigorosa: nessun simbolo lo contende.
    if (gh(g) >= 0.7 * Hd && gh(g) <= 1.15 * Hd && gw(g) <= 1.2 * gh(g) && g.blobs === 1 && (left.length > 0 || right.length > 0) && readers.rank) {
      const r = readers.rank(g);
      if (r && r.dist <= UNCLAIMED_DIGIT_DIST) {
        addInsert(g, r.digit);
        if (log) log.inserted++;
        return;
      }
    }
    // SEGNI piccoli (puntino, due punti, meno): sull'asse e FRA due glifi della stessa riga
    if (cy >= line.top + 0.28 * lh && cy <= line.top + 0.82 * lh && left.length > 0 && right.length > 0) {
      const mk = markOf(g, Hd);
      if (mk && mk !== "=") {
        // l'uguale perduto non serve: il normalizzatore taglia comunque a «=»
        addInsert(g, mk);
        if (log) log.inserted++;
        return;
      }
    }
    // ESPONENTE PERSO (Tesseract a volte non emette affatto il piccolo «³» dopo «)» o una cifra):
    // glifo piccolo, alto, con una base (cifra o parentesi chiusa) subito a sinistra
    const near = glyphs.filter((o, oi) => oi !== gi && o.x1 < g.x0 + 0.1 * Hd && g.x0 - o.x1 <= 0.55 * Hd && gh(o) >= 0.7 * Hd);
    const raised = g.y1 <= line.top + 0.7 * Hd && gh(g) >= 0.3 * Hd && gh(g) <= 0.78 * Hd && g.blobs === 1;
    if (raised && near.length > 0) {
      addInsert(g, "°");
      if (log) log.expInserted++;
    }
  });

  if (inserts.length === 0) return out;
  const merged: { pos: number; sym: OcrSymbol }[] = out.map((sym, i) => ({ pos: keepIdx[i]!, sym }));
  for (const ins of inserts) merged.push({ pos: ins.at, sym: ins.sym });
  merged.sort((a, b) => a.pos - b.pos);
  return merged.map((m) => m.sym);
}
