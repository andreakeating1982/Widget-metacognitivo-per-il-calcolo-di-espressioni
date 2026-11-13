// ⚠️ FRAZIONI IMPILATE IN FOTO (segnalazione 19/10: «con le foto è difficile
// anche il riconoscimento delle frazioni stesse»). Tesseract legge una
// frazione stampata impilata (numeratore, linea, denominatore) come righe
// separate: «3» / «—» / «7» — il testo ricostruito è polvere («37», «3-7»).
// Qui si ricostruisce la struttura GEOMETRICAMENTE dai riquadri dei simboli:
//   • una BARRA è un simbolo largo e sottile (w ≥ 2·h), non alfanumerico
//     («-», «—», «–», «_», «=», «~», «.» …: Tesseract scambia la linea della
//     frazione per uno di questi);
//   • numeratore = simboli SOPRA la barra con il centro nella sua campata;
//   • denominatore = simboli SOTTO, stesso criterio;
//   • le PARENTESI (alte ≥ 1,5× la cifra mediana) restano fuori: appartengono
//     all'espressione, non alla frazione;
//   • i costituenti si sostituiscono con UN simbolo sintetico «n⁄d»
//     (U+2044): il solver dell'app lo stampa come frazione IMPILATA e le
//     divisioni con i due punti restano «:».
// I simboli rimasti si RIORDINANO per x: Tesseract legge le righe dall'alto in
// basso, quindi con due frazioni l'ordine d'arrivo è «3 1 — : — 7 2» e senza
// riordino il testo ricostruito resta impastato.
import type { OcrSymbol } from "./ocrGeometry";
import type { InkField } from "./ocrReconcile";

export interface FracBar {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface FracPlan {
  bar: FracBar;
  /** ritaglio del numeratore (pixel dell'immagine preparata) */
  numBox: { x0: number; y0: number; x1: number; y1: number };
  /** ritaglio del denominatore */
  denBox: { x0: number; y0: number; x1: number; y1: number };
  /** indici dei simboli della passata 1 da BUTTERE (la lettura a righe di
   *  Tesseract dentro la frazione è polvere) */
  drop: number[];
  /** simboli sopra/sotto la barra: LETTURA DI RISERVO se il ritaglio non dà cifre */
  above: OcrSymbol[];
  below: OcrSymbol[];
  /** indici dei simboli che contengono la barra (glifo fuso): da buttare solo
   *  se la frazione viene ricostruita */
  contain: number[];
  /** stima dell'altezza di una cifra (px) */
  g: number;
}

/** ⚠️ BARRE DI FRAZIONE NEI PIXEL (19/10): Tesseract legge la frazione impilata
 *  a RIGHE («3» / «—» / «7» o addirittura «/7»: perde il numeratore), quindi i
 *  soli riquadri dei simboli non bastano. La linea della frazione si cerca
 *  NELL'INCHIOSTRO: una corsa di pixel scuri lunga e sottile con inchiostro
 *  SIGNIFICATIVO sopra e sotto (una cifra, non il puntino di «÷» e non l'altra
 *  barra di un «=»). Il MENO non ha nulla sopra/sotto nella sua campata. */
export function findFractionBars(field: InkField, symbols: OcrSymbol[] = []): FracBar[] {
  const { w, h, mask } = field;
  const runs: { y: number; x0: number; x1: number }[] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (mask[y * w + x]) {
        let x1 = x;
        while (x1 + 1 < w && mask[y * w + x1 + 1]) x1++;
        if (x1 - x + 1 >= 9) runs.push({ y, x0: x, x1 });
        x = x1 + 1;
      } else x++;
    }
  }
  // ── raggruppamento per RIGHE (componenti connesse): ogni run della riga y
  // si aggancia al gruppo della riga y−1 con la MIGLIORE sovrapposizione —
  // l'accoppiamento in ordine di lista distruggeva le barre multi-riga quando
  // sulla stessa riga ci sono più run (banco 19/10: la barra vera della
  // frazione veniva spezzata in singleton da 1 px dai run vicini).
  const bars: FracBar[] = [];
  interface Group { y0: number; y1: number; x0: number; x1: number }
  {
    const byRow = new Map<number, { x0: number; x1: number }[]>();
    for (const r of runs) {
      let arr = byRow.get(r.y);
      if (!arr) {
        arr = [];
        byRow.set(r.y, arr);
      }
      arr.push({ x0: r.x0, x1: r.x1 });
    }
    const ys = [...byRow.keys()].sort((a, b) => a - b);
    let carry: Group[] = [];
    let prevRow = -10;
    for (const y of ys) {
      const next: Group[] = [];
      const claimed = new Set<Group>();
      for (const r of byRow.get(y)!) {
        let best: Group | null = null;
        let bestOv = 0;
        for (const g of carry) {
          if (claimed.has(g)) continue;
          const ov = Math.min(g.x1, r.x1) - Math.max(g.x0, r.x0);
          const maxW = Math.max(g.x1 - g.x0 + 1, r.x1 - r.x0 + 1);
          if (ov >= 0.55 * maxW && ov > bestOv) {
            best = g;
            bestOv = ov;
          }
        }
        if (best && y === prevRow + 1) {
          best.y1 = y;
          best.x0 = Math.min(best.x0, r.x0);
          best.x1 = Math.max(best.x1, r.x1);
          claimed.add(best);
          next.push(best);
        } else {
          next.push({ y0: y, y1: y, x0: r.x0, x1: r.x1 });
        }
      }
      for (const g of carry) if (!claimed.has(g)) bars.push({ x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1 });
      carry = next;
      prevRow = y;
    }
    for (const g of carry) bars.push({ x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1 });
  }

  // altezza mediana di una cifra (serve per distinguere i DUE casi):
  //  • simbolo NORMALE (≈ medH) che contiene la barra = tratto interno di una
  //    cifra (il «5» ha la barra di sopra, il «3» quella di mezzo) → scarta;
  //  • simbolo FUSO (≥ 1,7·medH) = Tesseract ha unita NUM+LINEA+DEN in un
  //    solo glifo («3⁄3» letto come un «3» alto il doppio, dump 19/10) → la
  //    barra Dentro è QUELLA della frazione: va tenuta.
  const glyphs = symbols.filter((s) => /^[0-9a-zA-Z]$/.test(s.text.trim()));
  const hs0 = glyphs.map((s) => s.y1 - s.y0).sort((a, b) => a - b);
  // ⚠️ 30° percentile, NON mediana: i glifi FUSI delle frazioni (≈ 2× la cifra)
  // gonfiano la mediana e i glifi fusi veri restano sotto la soglia 1,7·h
  // (banco 19/10 caso 14: «11⁄4» fuso alto 101 px con mediana 60 → 1,7·60=102
  // > 101 → il glifo non era «fuso» e la sua barra veniva scartata)
  const medH0 = hs0.length > 0 ? hs0[Math.floor(0.3 * (hs0.length - 1))]! : 0;

  const DBG = (globalThis as { __PHOTO_FRAC_DEBUG__?: boolean }).__PHOTO_FRAC_DEBUG__;
  const dbg = (msg: string) => {
    if (DBG) console.log(`FRACBAR ${msg}`);
  };
  dbg(`gruppi=${bars.length} ` + bars.slice(0, 12).map((g) => `[${g.x0},${g.y0}-${g.x1},${g.y1}]`).join(" "));
  const out: FracBar[] = [];
  for (const b of bars) {
    const L = b.x1 - b.x0 + 1;
    const T = b.y1 - b.y0 + 1;
    if (L < 9 || T > Math.max(3, 0.25 * L) || L / T < 2.5) {
      dbg(`scartata [${b.x0},${b.y0}-${b.x1},${b.y1}] forma L=${L} T=${T}`);
      continue;
    }
    const inGlyph = symbols.some((s) => {
      if (!/^[0-9a-zA-Z]$/.test(s.text.trim())) return false;
      if (medH0 > 0 && s.y1 - s.y0 >= 1.7 * medH0) return false; // simbolo fuso: barra lecita
      // ⚠️ BARRA LETTA COME CARATTERE PIATTO (foto reale 21/10, 323×84 px:
      // «(3⁄7:9⁄14)^2-7⁄12·2»): Tesseract scambia la linea della frazione per
      // un carattere basso e largo («2» per la barra di 3⁄7, «d» per quella di
      // 7⁄12 — il riquadro del simbolo COINCIDE con la linea). Il simbolo È la
      // barra, non una cifra che la contiene: un contenitore vero (tratto
      // interno di «5», «4»…) è alto quanto una cifra ≥ 0,5·medH0.
      if (medH0 > 0 && s.y1 - s.y0 < 0.5 * medH0) return false;
      return b.x0 >= s.x0 - 2 && b.x1 <= s.x1 + 2 && b.y0 >= s.y0 - 2 && b.y1 <= s.y1 + 2;
    });
    if (inGlyph) {
      dbg(`scartata [${b.x0},${b.y0}-${b.x1},${b.y1}] inGlyph`);
      continue;
    }
    const gx0 = Math.max(0, Math.round(b.x0 - 0.2 * L));
    const gx1 = Math.min(w - 1, Math.round(b.x1 + 0.2 * L));
    const scan = (ya: number, yb: number) => {
      let cnt = 0;
      let minx = w, maxx = -1, miny = h, maxy = -1;
      for (let y = Math.max(0, ya); y <= Math.min(h - 1, yb); y++) {
        for (let x = gx0; x <= gx1; x++) {
          if (mask[y * w + x]) {
            cnt++;
            if (x < minx) minx = x;
            if (x > maxx) maxx = x;
            if (y < miny) miny = y;
            if (y > maxy) maxy = y;
          }
        }
      }
      return { cnt, minx, maxx, miny, maxy };
    };
    const up = scan(Math.round(b.y0 - 1.25 * L), b.y0 - 2);
    const dn = scan(b.y1 + 2, Math.round(b.y1 + 1.25 * L));
    // ⚠️ Le soglie di inchiostro sono legate all'ALTEZZA CIFRA (medH0), non a L:
    // la linea di «11⁄4» si fonde con le grazie serif dei due «1» e diventa più
    // larga dei numeri (L=91 con cifre di 48 px, banco 19/10 caso 14) — con
    // soglie ∝ L il den «4» (alto 0,55·cifra) restava sotto soglia.
    // Inchiostro VERO: una cifra ≈ 0,2·cifra² di pixel — il puntino di «÷»
    // (≈ 0,01·cifra²) e l'altra barra di un «=» (≈ 0,05·cifra²) restano sotto.
    const minCnt = medH0 > 0 ? 0.1 * medH0 * medH0 : 0.04 * L * L;
    if (up.cnt < minCnt || dn.cnt < minCnt) {
      dbg(
        `scartata [${b.x0},${b.y0}-${b.x1},${b.y1}] inchiostro up=${up.cnt} dn=${dn.cnt} min=${Math.round(minCnt)} medH0=${medH0}`,
      );
      continue;
    }
    // …e alto almeno mezza cifra: scarta puntini di «÷» e barre di «=»
    const minInkH = medH0 > 0 ? 0.45 * medH0 : 0.4 * L;
    if (up.maxy - up.miny < minInkH || dn.maxy - dn.miny < minInkH) {
      dbg(
        `scartata [${b.x0},${b.y0}-${b.x1},${b.y1}] altezza up=${up.maxy - up.miny} dn=${dn.maxy - dn.miny} min=${Math.round(minInkH)}`,
      );
      continue;
    }
    // ⚠️ RIGA DI SEPARAZIONE (banco 19/10): una frazione stampata ha un margine
    // fra la linea e num/den — il tratto interno di una cifra (la barra del
    // «4» dentro un glifo fuso «000^4») TOCCA la sua cifra, qui sopra c'è
    // inchiostro a filo della barra → non è una frazione.
    // Tolleranza: basta che UNA delle due righe sopra (e sotto) sia quasi vuota
    // (l'anti-alias del bordo della linea lascia qualche pixel sparso, banco
    // 19/10 caso «5⁄3»); il gambo di una cifra invece riempie OGNI riga.
    const rowInk = (y: number) => {
      if (y < 0 || y >= h) return L; // bordo immagine: non separabile
      let n = 0;
      for (let x = b.x0; x <= b.x1; x++) if (mask[y * w + x]) n++;
      return n;
    };
    // con cifre piccole (L ≈ 13 px) il 15% di L è troppo poco per l'anti-alias:
    // minimo assoluto 3 px (il gambo di una cifra ne occupa ≥ 6-8)
    const sepOk = (r1: number, r2: number) => Math.min(r1, r2) <= Math.max(0.15 * L, 3);
    const gapsOk = sepOk(rowInk(b.y0 - 1), rowInk(b.y0 - 2)) && sepOk(rowInk(b.y1 + 1), rowInk(b.y1 + 2));
    if (gapsOk) {
      out.push(b);
      continue;
    }
    dbg(`gap FAIL [${b.x0},${b.y0}-${b.x1},${b.y1}] righe sopra ${rowInk(b.y0 - 1)},${rowInk(b.y0 - 2)} sotto ${rowInk(b.y1 + 1)},${rowInk(b.y1 + 2)} L=${L}`);
    // ⚠️ GAP TEST FALLITO (banco 19/10 giro 15): la barra TOCCA l'inchiostro
    // sopra/sotto. La linea di una frazione è larga 1,15× i suoi numeri:
    // l'inchiostro sopra/sotto NON può essere più LARGO della linea. Se lo è,
    // è il tratto interno di una cifra (la barra del «4» dentro «1000^4»:
    // sopra c'è la «4» intera, più larga della sua barra — i riquadri di
    // Tesseract non bastano a contenerla, banco casi 12-13).
    const upW = up.maxx - up.minx + 1;
    const dnW = dn.maxx - dn.minx + 1;
    if (upW > 1.1 * L || dnW > 1.1 * L) {
      dbg(`scartata [${b.x0},${b.y0}-${b.x1},${b.y1}] larghezza up=${upW} dn=${dnW} L=${L}`);
      continue;
    }
    // Se tocca ma è più stretta della linea: linea isolata con num/den saldati
    // dalla sfoca o blocco fuso (foto piccole): si accetta.
    out.push(b);
  }
  // DEDUP: nella stessa struttura possono comparire più barre (la linea vera
  // + i tratti interni del numeratore/denominatore fuso). Si raggruppa per
  // sovrapposizione orizzontale e vicinanza verticale e si tiene la PIÙ LUNGA
  // (la linea della frazione è larga quanto num e den insieme).
  const kept: FracBar[] = [];
  for (const b of out.sort((p, q) => q.x1 - q.x0 - (p.x1 - p.x0))) {
    const near = kept.find((k) => {
      const ov = Math.min(k.x1, b.x1) - Math.max(k.x0, b.x0);
      const maxW = Math.max(k.x1 - k.x0, b.x1 - b.x0, 1);
      const refH = medH0 > 0 ? medH0 : Math.max(k.y1 - k.y0, b.y1 - b.y0, 10);
      return ov >= 0.4 * maxW && Math.abs((k.y0 + k.y1) / 2 - (b.y0 + b.y1) / 2) <= 1.2 * refH;
    });
    if (!near) kept.push(b);
  }
  return kept.slice(0, 8);
}

/** Piano di lettura: per ogni barra, i ritagli num/den e i simboli della
 *  passata 1 da buttare. Le PARENTESI restano: sono strette (w ≤ 0,5·h) e
 *  centrata sulla BARRA (abbracciano la frazione), non sopra/sotto. */
export function planPhotoFractions(symbols: OcrSymbol[], bars: FracBar[]): FracPlan[] {
  if (bars.length === 0) return [];
  const glyphs = symbols.filter((s) => /^[0-9a-zA-Z]$/.test(s.text.trim()));
  const hs = glyphs.map((g) => g.y1 - g.y0).sort((a, b) => a - b);
  const medH = hs.length > 0 ? hs[Math.floor(hs.length / 2)]! : 0;
  const plans: FracPlan[] = [];
  for (const bar of bars) {
    const L = bar.x1 - bar.x0 + 1;
    const g = medH > 0 ? medH : Math.max(14, Math.round(1.1 * L));
    // margini STRETTI (0,15·g): con frazioni adiacenti un ritaglio largo
    // prende pezzi del vicino e il ritaglio legge cifre sbagliate
    let nx0 = Math.max(0, bar.x0 - 0.15 * g);
    let nx1 = bar.x1 + 0.15 * g;
    // ⚠️ PARENTESI CHE ABBRACCIA LA FRAZIONE (giro 18, foto reale 21/10): il margine
    // di 0,15·g oltre la barra può includere un lembo della parentesi e il ritaglio
    // legge il numeratore sbagliato («3»+lembo → «5»). Se una parentesi (alta e
    // stretta) finisce nel margine, il ritaglio inizia DOPO di lei (a destra: PRIMA).
    for (const s of symbols) {
      const sw2 = s.x1 - s.x0 + 1;
      const sh2 = s.y1 - s.y0 + 1;
      if (sh2 < 1.5 * g || sw2 > 0.55 * sh2) continue;
      if (s.x1 >= nx0 && s.x1 < bar.x0 && s.x0 < nx0) nx0 = s.x1 + 2;
      if (s.x0 <= nx1 && s.x0 > bar.x1 && s.x1 > nx1) nx1 = s.x0 - 2;
    }
    // ⚠️ 1,4·g e non 1,2·g (giro 18, foto reale 21/10): una cifra scritta a mano può
    // sporgere fino a ~1,35·g sopra la barra — tagliata in cima, il «3» si legge «5».
    const numBox = {
      x0: nx0,
      y0: Math.max(0, bar.y0 - 1.4 * g),
      x1: nx1,
      y1: bar.y0 - 1,
    };
    const denBox = {
      x0: nx0,
      y0: bar.y1 + 1,
      x1: nx1,
      y1: bar.y1 + 1.4 * g,
    };
    const drop: number[] = [];
    const above: OcrSymbol[] = [];
    const below: OcrSymbol[] = [];
    /** simboli che CONTENGONO la barra (±3 px): il glifo FUSO num+linea+den —
     *  si butta SOLO se la frazione viene davvero ricostruita (v. ocr.ts) */
    const contain: number[] = [];
    const midY = (bar.y0 + bar.y1) / 2;
    symbols.forEach((s, k) => {
      const cx = (s.x0 + s.x1) / 2;
      const cy = (s.y0 + s.y1) / 2;
      const sh = s.y1 - s.y0;
      const sw = s.x1 - s.x0;
      if (
        bar.x0 >= s.x0 - 3 && bar.x1 <= s.x1 + 3 && bar.y0 >= s.y0 - 3 && bar.y1 <= s.y1 + 3
      ) {
        contain.push(k);
        return;
      }
      // x ±0,15·g: troppo larga e la regione mangia i «:» fra frazioni adiacenti
      const inRegion =
        cx >= bar.x0 - 0.15 * g && cx <= bar.x1 + 0.15 * g && cy >= bar.y0 - 1.5 * g && cy <= bar.y1 + 1.5 * g;
      if (!inRegion) return;
      // ⚠️ si butta SOLO ciò che può essere un pezzo della frazione stessa:
      // cifre/lettere (num/den letti come item piatti) e la linea letta come
      // «-»/«~»/punto. Operatori («:», «+», «=»…) e parentesi RESTANO — altrimenti
      // la regione mangia i due-punti fra due frazioni adiacenti (banco 19/10,
      // «13⁄9:8⁄3» → «13⁄918⁄3»)
      if (!/^[0-9a-zA-Z~.·∙-]$/.test(s.text)) return;
      drop.push(k);
      if (cy < midY) above.push(s);
      else below.push(s);
    });
    plans.push({ bar, numBox, denBox, drop, above, below, contain, g });
  }
  // ⚠️ BARRE-SOTTO-BARRA: il tratto interno del numeratore fuso può sopravvivere
  // alla dedup (sovrapposizione < 40%). Se la barra di un piano è CONTENUTA
  // orizzontalmente in quella di un piano PIÙ LUNGO (e vicino in verticale),
  // è un pezzo della stessa frazione: si butta (tenendo il più lungo).
  const kept: FracPlan[] = [];
  for (const p of [...plans].sort((a, b) => b.bar.x1 - b.bar.x0 - (a.bar.x1 - a.bar.x0))) {
    const dup = kept.some((q) => {
      const refH = Math.max(p.g, 10);
      return (
        p.bar.x0 >= q.bar.x0 - 0.2 * p.g &&
        p.bar.x1 <= q.bar.x1 + 0.2 * p.g &&
        Math.abs((p.bar.y0 + p.bar.y1) / 2 - (q.bar.y0 + q.bar.y1) / 2) <= 1.5 * refH
      );
    });
    if (!dup) kept.push(p);
  }
  return kept;
}

/** Lettura di riserva dai simboli della passata 1 (solo cifre/lettere sensate) */
export function fallbackGroupText(group: OcrSymbol[]): string | null {
  const t = [...group]
    .sort((a, b) => a.x0 - b.x0)
    .map((s) => s.text.trim())
    .join("");
  return /^[0-9a-zA-Z√]+$/.test(t) ? t : null;
}

export interface FracExtraction {
  /** simboli con le frazioni ricostruite (i costituenti sostituiti) */
  symbols: OcrSymbol[];
  /** quante frazioni impilate sono state ricostruite */
  fracs: number;
}

const GLYPH = /^[0-9a-zA-Z√]$/;
/** Simboli con cui Tesseract scambia la linea della frazione */
const BARISH = /^[^0-9a-zA-Z]$/;

export function extractStackedFractions(symbols: OcrSymbol[]): FracExtraction {
  if (symbols.length < 3) return { symbols, fracs: 0 };
  const glyphs = symbols.filter((s) => GLYPH.test(s.text.trim()));
  if (glyphs.length < 2) return { symbols, fracs: 0 };
  const hs = glyphs.map((g) => g.y1 - g.y0).sort((a, b) => a - b);
  const medH = hs[Math.floor(hs.length / 2)] || 20;

  // barre candidate: larghe ≥ 2× la loro altezza, sottili (≤ metà cifra),
  // non alfanumeriche, con qualcosa di leggibile sopra E sotto
  const used = new Set<number>();
  const results: { at: number; sym: OcrSymbol; members: number[] }[] = [];
  for (let i = 0; i < symbols.length; i++) {
    const b = symbols[i]!;
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    if (used.has(i)) continue;
    if (!BARISH.test(b.text.trim()) && !BARISH.test(b.text)) continue;
    if (w < 2 * Math.max(h, 1) || h > 0.5 * medH) continue;
    const above: number[] = [];
    const below: number[] = [];
    for (let k = 0; k < symbols.length; k++) {
      if (k === i || used.has(k)) continue;
      const o = symbols[k]!;
      const oh = o.y1 - o.y0;
      if (oh >= 1.5 * medH) continue; // parentesi / struttura esterna
      const ocx = (o.x0 + o.x1) / 2;
      if (ocx < b.x0 - 0.15 * w || ocx > b.x1 + 0.15 * w) continue;
      if (o.y1 <= b.y0 + 0.3 * medH && b.y0 - o.y1 <= 1.0 * medH) above.push(k);
      else if (o.y0 >= b.y1 - 0.3 * medH && o.y0 - b.y1 <= 1.0 * medH) below.push(k);
    }
    if (above.length === 0 || below.length === 0) continue;
    const read = (idxs: number[]): string | null => {
      const t = [...idxs]
        .sort((p, q) => symbols[p]!.x0 - symbols[q]!.x0)
        .map((k) => symbols[k]!.text.trim())
        .join("");
      return /^[0-9a-zA-Z√]+$/.test(t) ? t : null;
    };
    const num = read(above);
    const den = read(below);
    if (!num || !den) continue;
    const members = [i, ...above, ...below];
    members.forEach((k) => used.add(k));
    const y0 = Math.min(b.y0, ...above.map((k) => symbols[k]!.y0));
    const y1 = Math.max(b.y1, ...below.map((k) => symbols[k]!.y1));
    results.push({
      at: i,
      members,
      sym: { text: `${num}\u2044${den}`, x0: b.x0, y0, x1: b.x1, y1 },
    });
  }
  if (results.length === 0) return { symbols, fracs: 0 };
  const out: OcrSymbol[] = [];
  for (let i = 0; i < symbols.length; i++) {
    const r = results.find((x) => x.at === i);
    if (r) {
      out.push(r.sym);
      continue;
    }
    if (results.some((x) => x.members.includes(i))) continue;
    out.push(symbols[i]!);
  }
  // RIORDINO per x (tie-break: y): con le frazioni Tesseract emette le righe
  // dall'alto in basso («3 1 — : — 7 2»); senza riordino il testo resta scambiato.
  out.sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
  return { symbols: out, fracs: results.length };
}
