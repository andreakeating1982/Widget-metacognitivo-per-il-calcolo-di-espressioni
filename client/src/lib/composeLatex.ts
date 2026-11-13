// COMPOSIZIONE DEL LaTeX PER POSIZIONE (5/10 sera — revisione generale del
// riconoscimento a mano: «parentesi consecutive» e «parentesi + numeri»).
//
// PROBLEMA. Gli elementi che la pipeline toglie dall'inchiostro e riconosce da sé
// (parentesi, puntini ·, meno, uguali, radici, 8, frazioni) vanno RIMESSI nel LaTeX
// letto dal modello. Fino al 4/10 questo si faceva con una FRAZIONE della
// LUNGHEZZA IN CARATTERI della stringa (`Math.round(pos × latex.length)`), con le
// ancore calcolate ciascuna sul PROPRIO inchiostro «restante». Conseguenze, tutte
// verificate sul banco di prova (684 letture, modello reale):
//   · il segno cadeva DENTRO un esponente («[3]^2» → «[3^{]2}»,
//     «(3^2)·2» → «(3)^{2\cdot}2»);
//   · i comandi LaTeX contano come tanti caratteri («\cdot» = 5) e spostano la
//     proporzione;
//   · a parità di ancora (segno ed 8 a destra di tutto l'inchiostro rimasto: 1,0)
//     l'ordine reciproco era quello dei MODULI, non della PAGINA
//     («6·8» → «68\cdot», «14−8» → «148−»);
//   · l'esponente di una parentesi QUADRA/GRAFFA estratta si attaccava alla cifra
//     precedente («[3]^2» → «[3^2]»), perché la parentesi non era più nell'inchiostro.
//
// SOLUZIONE. Si lavora per ATOMI e per POSIZIONE ASSOLUTA:
//   1. il LaTeX del modello è spezzato in ATOMI di primo livello (cifra, lettera,
//      parentesi — anche `\left(` —, operatore, comando, `\frac{}{}`, `\sqrt{}`);
//      un esponente `^{…}` è PARTE dell'atomo a cui si attacca: non esiste un punto
//      d'inserimento «dentro» un esponente;
//   2. ogni atomo prende una x: se il numero di COLONNE d'inchiostro (cluster per
//      sovrapposizione orizzontale) coincide col numero di atomi, la x della
//      colonna; altrimenti i QUANTILI della massa d'inchiostro (robusti ai buchi
//      lasciati dagli elementi estratti e alle larghezze diverse dei glifi);
//   3. gli elementi estratti hanno la loro x ASSOLUTA (centro del glifo); si fondono
//      con gli atomi in ordine di x. Nessun pareggio ambiguo, nessuna ancora relativa;
//   4. gli ESPONENTI si agganciano a un nodo BASE (cifra, lettera, parentesi chiusa,
//      frazione, radice): o all'elemento estratto indicato dalla geometria (chiave),
//      oppure al nodo base più vicino alla x della base geometrica.
//
// Se non ci sono elementi né esponenti da inserire, il LaTeX NON viene toccato.
import type { SimpleStroke } from "./inkSigns";

export type AtomKind =
  | "digit"
  | "letter"
  | "open"
  | "close"
  | "op"
  | "cmd"
  | "frac"
  | "sqrt"
  | "other";

export interface Atom {
  tex: string;
  kind: AtomKind;
  /** false per i delimitatori nulli `\left.` / `\right.` (nessun inchiostro) */
  ink?: boolean;
}

export interface ComposeItem {
  /** x assoluta (stesso sistema dell'inchiostro) del centro dell'elemento */
  x: number;
  tex: string;
  kind: AtomKind;
  /** chiave per gli esponenti che si agganciano a un elemento estratto (`]`, `}`, 8) */
  key?: string;
}

export interface ComposeExp {
  digits: string;
  /** x del centro della BASE secondo la geometria */
  baseX: number;
  /** chiave dell'elemento estratto che fa da base, se la base non è nell'inchiostro del modello */
  baseKey?: string;
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function bboxOf(s: SimpleStroke): Box | null {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const p of s.points) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return isFinite(x0) ? { x0, x1, y0, y1 } : null;
}

/** indice del `}` che chiude il `{` in posizione i (o la fine della stringa) */
function endOfGroup(s: string, i: number): number {
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === "\\") {
      k++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return k + 1;
    }
  }
  return s.length;
}

/** Spezza il LaTeX del modello in ATOMI di primo livello. */
export function tokenizeLatex(latex: string): Atom[] {
  const out: Atom[] = [];
  const n = latex.length;
  let i = 0;
  const skipWs = (k: number): number => {
    while (k < n && /\s/.test(latex[k]!)) k++;
    return k;
  };
  while (i < n) {
    const ch = latex[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "\\") {
      const start = i;
      let j = i + 1;
      // comando di un solo carattere: \{ \} \| \, \; \! …
      if (j < n && !/[a-zA-Z]/.test(latex[j]!)) {
        const sym = latex.slice(i, j + 1);
        i = j + 1;
        if (sym === "\\{") out.push({ tex: sym, kind: "open" });
        else if (sym === "\\}") out.push({ tex: sym, kind: "close" });
        else if (/^\\[,;:! ]$/.test(sym)) {
          /* spazio sottile: nessun inchiostro */
        } else out.push({ tex: sym, kind: "other" });
        continue;
      }
      while (j < n && /[a-zA-Z]/.test(latex[j]!)) j++;
      const name = latex.slice(i + 1, j);
      i = j;
      if (name === "left" || name === "right") {
        let k = skipWs(i);
        let delim = "";
        if (latex[k] === "\\") {
          delim = latex.slice(k, k + 2);
          k += 2;
        } else if (k < n) {
          delim = latex[k]!;
          k++;
        }
        i = k;
        if (delim === ".") {
          out.push({ tex: `\\${name}.`, kind: "other", ink: false });
        } else {
          out.push({ tex: `\\${name}${delim}`, kind: name === "left" ? "open" : "close" });
        }
        continue;
      }
      if (name === "frac" || name === "dfrac" || name === "tfrac" || name === "sqrt") {
        let k = skipWs(i);
        if (name === "sqrt" && latex[k] === "[") {
          const e = latex.indexOf("]", k);
          if (e > 0) k = skipWs(e + 1);
        }
        const groups = name === "sqrt" ? 1 : 2;
        for (let g = 0; g < groups; g++) {
          k = skipWs(k);
          if (latex[k] === "{") k = endOfGroup(latex, k);
          else if (k < n) k++;
        }
        out.push({ tex: latex.slice(start, k), kind: name === "sqrt" ? "sqrt" : "frac" });
        i = k;
        continue;
      }
      out.push({ tex: `\\${name}`, kind: "cmd" });
      continue;
    }
    if (ch === "^" || ch === "_") {
      let k = skipWs(i + 1);
      if (latex[k] === "{") k = endOfGroup(latex, k);
      else if (k < n) k++;
      const grp = latex.slice(i, k);
      const last = out[out.length - 1];
      if (last) last.tex += grp;
      else out.push({ tex: grp, kind: "other" });
      i = k;
      continue;
    }
    i++;
    if (ch === "{") out.push({ tex: ch, kind: "open" });
    else if (ch === "}") out.push({ tex: ch, kind: "close" });
    else if (ch === "(" || ch === "[") out.push({ tex: ch, kind: "open" });
    else if (ch === ")" || ch === "]") out.push({ tex: ch, kind: "close" });
    else if (/[0-9]/.test(ch)) out.push({ tex: ch, kind: "digit" });
    else if (/[a-zA-Z]/.test(ch)) out.push({ tex: ch, kind: "letter" });
    else if (/[+\-=*/<>:·×÷−]/.test(ch)) out.push({ tex: ch, kind: "op" });
    else out.push({ tex: ch, kind: "other" });
  }
  return out;
}

export interface InkColumn {
  x0: number;
  x1: number;
  cx: number;
}

/** COLONNE d'inchiostro: tratti raggruppati per sovrapposizione orizzontale. Un
 *  glifo a più tratti («x», «+», «4», «5») ha i tratti sovrapposti in x e diventa
 *  UNA colonna; glifi vicini ma separati restano colonne distinte. */
export function inkColumns(ink: SimpleStroke[]): InkColumn[] {
  const bs = ink
    .map(bboxOf)
    .filter((b): b is Box => b !== null)
    .sort((a, b) => a.x0 - b.x0);
  const cols: { x0: number; x1: number }[] = [];
  for (const b of bs) {
    const last = cols[cols.length - 1];
    if (last) {
      const ov = Math.min(last.x1, b.x1) - Math.max(last.x0, b.x0);
      const minW = Math.max(1, Math.min(last.x1 - last.x0, b.x1 - b.x0));
      if (ov > 0.3 * minW) {
        last.x0 = Math.min(last.x0, b.x0);
        last.x1 = Math.max(last.x1, b.x1);
        continue;
      }
    }
    cols.push({ x0: b.x0, x1: b.x1 });
  }
  return cols.map((c) => ({ ...c, cx: (c.x0 + c.x1) / 2 }));
}

/** x (ordinata lungo l'asse) dei quantili ((k+½)/n) della MASSA d'inchiostro */
function inkQuantiles(ink: SimpleStroke[], n: number): number[] {
  const xs: number[] = [];
  for (const s of ink) {
    const pts = s.points;
    for (let k = 0; k < pts.length; k++) {
      xs.push(pts[k]!.x);
      if (k > 0) {
        const a = pts[k - 1]!;
        const b = pts[k]!;
        const steps = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 2);
        for (let t = 1; t < steps; t++) xs.push(a.x + ((b.x - a.x) * t) / steps);
      }
    }
  }
  xs.sort((p, q) => p - q);
  if (xs.length === 0) return new Array<number>(n).fill(0);
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    out.push(xs[Math.min(xs.length - 1, Math.floor(((k + 0.5) / n) * xs.length))]!);
  }
  return out;
}

/** x di ogni atomo. Colonne == atomi → centro della colonna; altrimenti quantili. */
export function alignAtoms(atoms: Atom[], ink: SimpleStroke[]): number[] {
  const real: number[] = [];
  atoms.forEach((a, i) => {
    if (a.ink !== false) real.push(i);
  });
  const out = new Array<number>(atoms.length).fill(0);
  if (real.length > 0) {
    const cols = inkColumns(ink);
    if (cols.length === real.length) {
      real.forEach((ai, k) => {
        out[ai] = cols[k]!.cx;
      });
    } else {
      const q = inkQuantiles(ink, real.length);
      real.forEach((ai, k) => {
        out[ai] = q[k]!;
      });
    }
  }
  // atomi senza inchiostro: stessa x dell'atomo reale precedente
  let prev = -Infinity;
  for (let i = 0; i < atoms.length; i++) {
    if (atoms[i]!.ink === false) out[i] = prev;
    else prev = out[i]!;
  }
  return out;
}

const BASEABLE = new Set<AtomKind>(["digit", "letter", "close", "frac", "sqrt"]);

interface Node {
  x: number;
  tex: string;
  kind: AtomKind;
  key?: string;
  src: 0 | 1; // 0 = elemento estratto, 1 = atomo del modello
  order: number;
}

const BRACKET_RE = /^\\?([[\](){}])$/;

/** ⚠️ PARENTESI ALLUCINATE (6/10, banco P6: `[3]^2` → `[3]]^{2}`). Se nell'inchiostro resta una `[`
 *  (o una `(`) senza la sua compagna, il modello CHIUDE da sé la parentesi; ma la compagna vera è
 *  stata estratta e viene reinserita → la parentesi compare due volte. Due parentesi UGUALI e
 *  CONSECUTIVE, una del modello e una estratta, che eccedono il bilanciamento (più chiuse che
 *  aperte della stessa famiglia, o viceversa) → si scarta quella del modello. Se le parentesi
 *  sono bilanciate (`[[2]]`) non si tocca nulla. */
function dedupeHallucinatedBrackets(merged: Node[]): Node[] {
  const info = (n: Node): { fam: string; open: boolean } | null => {
    const m = BRACKET_RE.exec(n.tex);
    if (!m) return null;
    const ch = m[1]!;
    return { fam: "([".includes(ch) || ")]".includes(ch) ? (ch === "(" || ch === ")" ? "r" : "s") : "c", open: "([{".includes(ch) };
  };
  const count: Record<string, [number, number]> = { r: [0, 0], s: [0, 0], c: [0, 0] };
  for (const n of merged) {
    const i = info(n);
    if (i) count[i.fam]![i.open ? 0 : 1]++;
  }
  const drop = new Set<Node>();
  for (let k = 0; k + 1 < merged.length; k++) {
    const a = merged[k]!;
    const b = merged[k + 1]!;
    const ia = info(a);
    const ib = info(b);
    if (!ia || !ib || ia.fam !== ib.fam || ia.open !== ib.open || a.src === b.src) continue;
    const [o, c] = count[ia.fam]!;
    const excess = ia.open ? o - c : c - o;
    if (excess <= 0) continue;
    drop.add(a.src === 1 ? a : b);
    count[ia.fam]![ia.open ? 0 : 1]--;
  }
  return drop.size === 0 ? merged : merged.filter((n) => !drop.has(n));
}

/** Rimette gli ELEMENTI ESTRATTI e gli ESPONENTI nel LaTeX del modello, per posizione. */
export function composeLatex(args: {
  latex: string;
  ink: SimpleStroke[];
  items: ComposeItem[];
  exps: ComposeExp[];
}): string {
  const { latex, ink, items, exps } = args;
  if (items.length === 0 && exps.length === 0) return latex;

  const atoms = tokenizeLatex(latex);
  const ax = alignAtoms(atoms, ink);
  const nodes: Node[] = [];
  atoms.forEach((a, i) => nodes.push({ x: ax[i]!, tex: a.tex, kind: a.kind, src: 1, order: i }));
  items.forEach((it, i) =>
    nodes.push({ x: it.x, tex: it.tex, kind: it.kind, key: it.key, src: 0, order: i }),
  );
  // FUSIONE stabile: gli atomi del modello restano nel loro ordine di lettura (sono
  // monotoni in x per costruzione), gli elementi estratti si ordinano per x; a parità
  // di x l'atomo precede l'elemento.
  const atomNodes = nodes.filter((n) => n.src === 1).sort((a, b) => a.order - b.order);
  const itemNodes = nodes.filter((n) => n.src === 0).sort((a, b) => a.x - b.x || a.order - b.order);
  const merged: Node[] = [];
  let ia = 0;
  let ii = 0;
  while (ia < atomNodes.length || ii < itemNodes.length) {
    const a = atomNodes[ia];
    const it = itemNodes[ii];
    if (a && (!it || a.x < it.x)) {
      merged.push(a);
      ia++;
    } else {
      merged.push(it!);
      ii++;
    }
  }

  const kept = dedupeHallucinatedBrackets(merged);
  if (kept !== merged) merged.splice(0, merged.length, ...kept);

  // esponenti → nodo base
  const attach = new Map<Node, string>();
  for (const e of exps) {
    let base: Node | undefined;
    if (e.baseKey !== undefined) base = merged.find((n) => n.key === e.baseKey);
    if (!base) {
      let best = Infinity;
      for (const n of merged) {
        if (!BASEABLE.has(n.kind)) continue;
        const d = Math.abs(n.x - e.baseX);
        if (d < best) {
          best = d;
          base = n;
        }
      }
    }
    if (!base) base = merged[merged.length - 1];
    if (!base) continue;
    attach.set(base, (attach.get(base) ?? "") + e.digits);
  }
  for (const [n, digits] of attach) {
    // un esponente già letto dal modello sullo stesso atomo non si raddoppia
    if (!/\^/.test(n.tex)) n.tex += `^{${digits}}`;
  }

  let outStr = "";
  for (const n of merged) {
    if (outStr && /\\[a-zA-Z]+$/.test(outStr) && /^[a-zA-Z0-9]/.test(n.tex)) outStr += " ";
    outStr += n.tex;
  }
  return outStr;
}

// ─────────────────────────────────────────────────────────────────────────────
// «×» DEL MODELLO: LETTERA x O PUNTO? (6/10, banco P5: `3x(2x+1)` → `3·(2x+1)`)
//
// Regola dell'utente (27/9-ter): la moltiplicazione è SEMPRE e SOLO un puntino; il modello, però,
// legge come `\times` sia la CROCE sintetica/piccola di un puntino sia una `x` scritta fra una
// cifra e una parentesi. Convertire ogni `\times` in `\cdot` (fatto fin qui) CANCELLA la variabile
// di «3x(2x+1)». La geometria li distingue: la croce di un puntino è PICCOLA (< 0,56 dell'altezza
// delle cifre vicine), una `x` vera è alta come una lettera. Un `\times` il cui glifo è alto
// ≥ 0,56 × l'altezza di riferimento diventa la lettera `x`; gli altri restano a `\cdot` (a cura
// del chiamante). Altezza di riferimento = 70° percentile delle altezze delle colonne
// d'inchiostro (cifre e parentesi; i segni piccoli non la abbassano).
// ─────────────────────────────────────────────────────────────────────────────
interface GlyphColumn {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  cx: number;
}

function glyphColumns(ink: SimpleStroke[]): GlyphColumn[] {
  const bs = ink
    .map(bboxOf)
    .filter((b): b is Box => b !== null)
    .sort((a, b) => a.x0 - b.x0);
  const cols: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const b of bs) {
    const last = cols[cols.length - 1];
    if (last) {
      const ov = Math.min(last.x1, b.x1) - Math.max(last.x0, b.x0);
      const minW = Math.max(1, Math.min(last.x1 - last.x0, b.x1 - b.x0));
      if (ov > 0.3 * minW) {
        last.x0 = Math.min(last.x0, b.x0);
        last.x1 = Math.max(last.x1, b.x1);
        last.y0 = Math.min(last.y0, b.y0);
        last.y1 = Math.max(last.y1, b.y1);
        continue;
      }
    }
    cols.push({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
  }
  return cols.map((c) => ({ ...c, cx: (c.x0 + c.x1) / 2 }));
}

/** frazione dell'altezza di riferimento sopra la quale un `\times` è la lettera `x` */
export const TIMES_LETTER_FRAC = 0.56;

/** Sostituisce con la lettera `x` i `\times` di primo livello il cui glifo d'inchiostro è alto come
 *  una lettera. Se il LaTeX non si ricostruisce identico dagli atomi non tocca nulla. */
export function timesToLetterX(latex: string, ink: SimpleStroke[]): string {
  if (!latex.includes("\\times") || ink.length === 0) return latex;
  const atoms = tokenizeLatex(latex);
  if (atoms.map((a) => a.tex).join("") !== latex.replace(/\s+/g, "")) return latex;
  const idx: number[] = [];
  atoms.forEach((a, i) => {
    if (a.tex === "\\times") idx.push(i);
  });
  if (idx.length === 0) return latex;
  const cols = glyphColumns(ink);
  if (cols.length < 2) return latex; // un `\times` da solo non ha riferimento: resta com'è
  const hs = cols.map((c) => c.y1 - c.y0).sort((a, b) => a - b);
  const ref = hs[Math.min(hs.length - 1, Math.floor(0.7 * hs.length))]!;
  if (!(ref > 0)) return latex;
  const xs = alignAtoms(atoms, ink);
  let changed = false;
  for (const i of idx) {
    let best: GlyphColumn | null = null;
    let bd = Infinity;
    for (const c of cols) {
      const d = Math.abs(c.cx - xs[i]!);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (!best) continue;
    const h = best.y1 - best.y0;
    const w = best.x1 - best.x0;
    // alta come una lettera e larga abbastanza da essere una croce (non un trattino/uno «1»)
    if (h >= TIMES_LETTER_FRAC * ref && w >= 0.4 * h) {
      atoms[i] = { tex: "x", kind: "letter" };
      changed = true;
    }
  }
  return changed ? atoms.map((a) => a.tex).join("") : latex;
}
