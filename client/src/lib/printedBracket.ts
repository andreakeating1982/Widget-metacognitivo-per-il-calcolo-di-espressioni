// ─────────────────────────────────────────────────────────────────────────────
// TIPO DI PARENTESI STAMPATA DAI PIXEL (6/10, fase foto)
//
// Tesseract a bassa risoluzione confonde `( [ {` fra loro (e le chiuse `) ] }`), ne fonde due
// vicine in un solo simbolo (`{(` → `{`) o le legge come altro. Qui si classifica il GLIFO reale
// (maschera binaria dell'immagine preparata) dal suo PROFILO ORIZZONTALE per fasce:
//
//   · centro di massa x di ogni fascia (0 = sinistra del riquadro, 1 = destra);
//   · POLARITÀ: gli estremi (alto/basso) stanno a destra del centro → apertura `( [ {`;
//     a sinistra → chiusura `) ] }`. Per le chiuse si specchia x e si ragiona come per le aperte;
//   · TIPO dalla «profondità del quarto» D = (x a 25%/75% dell'altezza) − (x al centro):
//       `[`  D ≈ 0   (il montante è dritto);
//       `(`  D piccola e graduale (arco: ¼ della freccia);
//       `{`  D grande (due montanti dritti spostati verso il centro e la punta a sinistra).
//
// Funzione pura, indipendente da Tesseract. Restituisce anche un MARGINE: distanza dalla soglia di
// decisione più vicina, per correggere Tesseract solo quando il glifo è netto.
// ─────────────────────────────────────────────────────────────────────────────
import type { Glyph, InkField } from "./ocrReconcile";

export type BracketKind = "(" | ")" | "[" | "]" | "{" | "}";

export interface BracketRead {
  kind: BracketKind;
  /** 0 … ~0,3: quanto il glifo è lontano dalla soglia di decisione più vicina */
  margin: number;
  /** misure grezze (per la taratura) */
  feat: { P: number; D: number; E: number; M: number; Em: number };
}

/** soglie di taratura (vedi bracketBench.test.ts: 6 font × 5 altezze × 3 sfocature) */
export const BRACKET_TH = {
  /** |P| minimo per dire che è una parentesi (altrimenti `|`, `1`, `l`…) */
  polarity: 0.1,
  /** `[`: quasi tutte le fasce stanno al bordo (M ≥ barM) e il montante è dritto (D ≤ barD) */
  barM: 0.9,
  /** …e il bordo opposto NON è allineato (Mr ≤ barMother): altrimenti è una barra `|` */
  barMother: 0.6,
  barD: 0.07,
  /** `{`: solo la punta centrale sporge: M ≤ curlyM; altrimenti `(` */
  curlyM: 0.32,
};

const gw = (g: { x0: number; x1: number }): number => g.x1 - g.x0 + 1;
const gh = (g: { y0: number; y1: number }): number => g.y1 - g.y0 + 1;

/** Un glifo «da parentesi»: più alto di una cifra, stretto, non una barra sottile. */
export function bracketLike(g: { x0: number; y0: number; x1: number; y1: number }, Hd: number): boolean {
  const h = gh(g);
  const w = gw(g);
  // fino a 3,2·Hd (giro 18, foto reale 21/10): le parentesi scritte a mano attorno a una frazione
  // impilata sono 2-3 volte l'altezza cifra; oltre, è un'asta o una riga di pagina.
  return h >= 1.1 * Hd && h <= 3.2 * Hd && w <= 0.55 * h && w >= 0.08 * h;
}

const BANDS = 20;

/** per fascia: centro di massa x normalizzato, ampiezza (0..1) e bordi sinistro/destro (0..1) */
function profile(field: InkField, g: Glyph): { c: number[]; ext: number[]; lo: number[]; hi: number[] } | null {
  const w = gw(g);
  const h = gh(g);
  if (w < 3 || h < 12) return null;
  const c: number[] = [];
  const ext: number[] = [];
  const lo2: number[] = [];
  const hi2: number[] = [];
  for (let b = 0; b < BANDS; b++) {
    const ya = g.y0 + Math.floor((b * h) / BANDS);
    const yb = g.y0 + Math.max(Math.floor(((b + 1) * h) / BANDS) - 1, Math.floor((b * h) / BANDS));
    let sum = 0;
    let n = 0;
    let lo = w;
    let hi = -1;
    for (let y = ya; y <= yb; y++) {
      const row = y * field.w;
      for (let x = g.x0; x <= g.x1; x++) {
        if (field.mask[row + x]) {
          const u = x - g.x0;
          sum += u;
          n++;
          if (u < lo) lo = u;
          if (u > hi) hi = u;
        }
      }
    }
    if (n === 0) {
      c.push(Number.NaN);
      ext.push(0);
      lo2.push(Number.NaN);
      hi2.push(Number.NaN);
    } else {
      c.push(sum / n / (w - 1));
      ext.push((hi - lo + 1) / w);
      lo2.push(lo / (w - 1));
      hi2.push(hi / (w - 1));
    }
  }
  return { c, ext, lo: lo2, hi: hi2 };
}

function avg(a: number[], bands: number[]): number {
  let s = 0;
  let n = 0;
  for (const i of bands) {
    const v = a[i]!;
    if (!Number.isNaN(v)) {
      s += v;
      n++;
    }
  }
  return n ? s / n : Number.NaN;
}

const range = (a: number, b: number): number[] => Array.from({ length: b - a }, (_, i) => a + i);

/** Tipo di parentesi del glifo, o null se non è netto (barra, cifra, rumore). */
export function classifyPrintedBracket(field: InkField, g: Glyph): BracketRead | null {
  const p = profile(field, g);
  if (!p) return null;
  const ends = avg(p.c, [...range(0, 3), ...range(BANDS - 3, BANDS)]);
  const mid = avg(p.c, range(8, 12));
  const q = avg(p.c, [...range(4, 7), ...range(BANDS - 7, BANDS - 4)]);
  if (Number.isNaN(ends) || Number.isNaN(mid) || Number.isNaN(q)) return null;
  const P = ends - mid;
  const E = avg(p.ext, [...range(0, 2), ...range(BANDS - 2, BANDS)]);
  const Em = avg(p.ext, range(8, 12));
  const lo = p.lo.filter((v) => !Number.isNaN(v));
  const hi = p.hi.filter((v) => !Number.isNaN(v));
  // allineamento dei bordi: Ml = fasce col bordo sinistro vicino al più sporgente a sinistra,
  // Mr = fasce col bordo destro vicino al più sporgente a destra
  const lMin = Math.min(...lo);
  const hMax = Math.max(...hi);
  const Ml = lo.filter((v) => v <= lMin + 0.2).length / lo.length;
  const Mr = hi.filter((v) => v >= hMax - 0.2).length / hi.length;
  const closer: Record<string, BracketKind> = { "(": ")", "[": "]", "{": "}" };

  // ── montante dritto con le codine ai due estremi: `[` (bordo sinistro allineato, destro no) o `]`
  if (Ml >= BRACKET_TH.barM && Mr <= BRACKET_TH.barMother && mid - q <= BRACKET_TH.barD && q - mid <= BRACKET_TH.barD)
    return { kind: "[", margin: Math.min(Ml - BRACKET_TH.barM, BRACKET_TH.barMother - Mr), feat: { P, D: q - mid, E, M: Ml, Em } };
  if (Mr >= BRACKET_TH.barM && Ml <= BRACKET_TH.barMother && mid - q <= BRACKET_TH.barD && q - mid <= BRACKET_TH.barD)
    return { kind: "]", margin: Math.min(Mr - BRACKET_TH.barM, BRACKET_TH.barMother - Ml), feat: { P, D: mid - q, E, M: Mr, Em } };

  // ── curve: polarità dagli estremi rispetto al centro, poi `(` vs `{` dalla frazione al bordo
  if (Math.abs(P) < BRACKET_TH.polarity) return null;
  const opener = P > 0;
  const fl = (v: number): number => (opener ? v : 1 - v);
  const D = fl(q) - fl(mid);
  const edge = opener ? lo : hi.map((v) => 1 - v);
  const eMin = Math.min(...edge);
  const M = edge.filter((v) => v <= eMin + 0.2).length / edge.length;
  let base: "(" | "{";
  let margin: number;
  if (M <= BRACKET_TH.curlyM) {
    base = "{";
    margin = BRACKET_TH.curlyM - M;
  } else {
    base = "(";
    margin = Math.min(M - BRACKET_TH.curlyM, BRACKET_TH.barM - M);
  }
  return {
    kind: opener ? base : closer[base]!,
    margin: Math.min(margin, Math.abs(P) - BRACKET_TH.polarity + 0.05),
    feat: { P, D, E, M, Em },
  };
}
