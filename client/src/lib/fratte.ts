/** FRATTE — espressioni con l'INCOGNITA al denominatore (giro 21).
 *
 *  L'espressione viene valutata come FUNZIONE RAZIONALE esatta:
 *  valore = frazione di polinomi { num, den } (den = [] significa 1,
 *  num = [] significa 0). Il percorso è SEPARATO dal flusso polinomiale
 *  di espressioni.ts (nessuna regressione possibile): la UI lo usa
 *  quando `isFratte(ast)`.
 *
 *  Regole fisse dell'utente rispettate anche qui:
 *  - aritmetica ESATTA, mai decimali con la virgola;
 *  - l'app non compie MAI operazioni al posto dello studente: i passi
 *    mostrano UNA operazione per volta e il CAMPO DI ESISTENZA lo
 *    calcola lo studente con input guidato (radice di «denominatore = 0»);
 *  - i risultati sono frazioni impilate, mai «a : b» risolte.
 */

import {
  ExprError,
  fAdd,
  fDiv,
  fMul,
  fNeg,
  fOne,
  fSub,
  fZero,
  fr,
  normalizeInput,
  parseExpression,
  polyAdd,
  polyMul,
  polySub,
  polyToLatex,
  polyToNode,
  printLatex,
  pushNegThrough,
  term,
  termDegree,
  termKey,
  evalPoly,
  type Frac,
  type Node,
  type Term,
} from "./espressioni";

// ─── Valori razionali ─────────────────────────────────────────────

/** Frazione di polinomi: den = [] → polinomio puro (denominatore 1). */
export interface Rat {
  num: Term[];
  den: Term[];
}

/** Costruisce un valore razionale SEMPRE semplificato:
 *  - denominatore costante → torna polinomio (coefficienti divisi);
 *  - fattore monomio comune numeratore/denominatore → cancellato;
 *  - divisore polinomiale comune (una variabile, Euclide) → cancellato. */
export function ratFrom(num: Term[], den: Term[]): Rat {
  const n = num.filter((t) => t.c.n !== 0);
  const d = den.filter((t) => t.c.n !== 0);
  if (d.length === 1 && d[0].vars.length === 0) {
    const c = d[0].c;
    if (c.n === 0) throw new ExprError("Non si può dividere per zero!");
    return { num: n.map((t) => term(t.vars, fDiv(t.c, c))), den: [] };
  }
  return ratCancel({ num: n, den: d });
}

/** num × den: il denominatore vuoto è 1 (identità). */
function mulNumDen(num: Term[], den: Term[]): Term[] {
  if (den.length === 0) return num;
  if (num.length === 0) return []; // 0 × qualsiasi cosa = 0
  return polyMul(num, den);
}

/** den × den: il denominatore vuoto è 1 (identità). */
function mulDenDen(a: Term[], b: Term[]): Term[] {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  return polyMul(a, b);
}

/** Semplificazione scolastica di una frazione di polinomi:
 *  1) fattore monomio comune a TUTTI i termini (es. (6x+3x²)/(3x) → (2+x)/1);
 *  2) divisore polinomiale comune (es. (x²−1)/(x+1) → x−1). */
function ratCancel(r: Rat): Rat {
  let { num, den } = r;
  if (den.length === 0) return { num, den };
  // 1) monomio comune
  const common = monomialCommonFactor([...num, ...den]);
  if (common) {
    const div = (t: Term): Term => {
      const vars = t.vars.map((x) => ({ ...x }));
      for (const cv of common.vars) {
        const f = vars.find((x) => x.v === cv.v);
        if (f) f.e -= cv.e;
      }
      return term(vars.filter((x) => x.e > 0), fDiv(t.c, common.c));
    };
    num = num.map(div);
    den = den.map(div);
    if (den.length === 1 && den[0].vars.length === 0) {
      const c = den[0].c;
      if (c.n === 0) throw new ExprError("Non si può dividere per zero!");
      return { num: num.map((t) => term(t.vars, fDiv(t.c, c))), den: [] };
    }
  }
  // 2) divisore polinomiale comune (una sola variabile)
  const v = singleVar(num, den);
  if (v) {
    const g = polyGcdUnivariate(num, den, v);
    if (g && polyDegree(g) >= 1) {
      const q1 = polyDivExact(num, g);
      const q2 = polyDivExact(den, g);
      if (q1 && q2) {
        num = q1;
        den = q2;
        if (den.length === 1 && den[0].vars.length === 0) {
          const c = den[0].c;
          if (c.n === 0) throw new ExprError("Non si può dividere per zero!");
          return { num: num.map((t) => term(t.vars, fDiv(t.c, c))), den: [] };
        }
      }
    }
  }
  return { num, den };
}

/** Monomio contenuto in tutti i termini (esponente minimo per variabile,
 *  mcd dei coefficienti interi; con coefficienti frazionari resta 1). */
function monomialCommonFactor(terms: Term[]): Term | null {
  if (terms.length === 0) return null;
  const names = new Set<string>();
  for (const t of terms) for (const x of t.vars) names.add(x.v);
  const mins: { v: string; e: number }[] = [];
  for (const v of names) {
    let m = Infinity;
    for (const t of terms) {
      const f = t.vars.find((x) => x.v === v);
      if (!f) m = 0;
      else if (f.e < m) m = f.e;
    }
    if (m > 0) mins.push({ v, e: m });
  }
  let g = 0;
  for (const t of terms) {
    if (t.c.d !== 1) { g = 0; break; }
    g = g === 0 ? Math.abs(t.c.n) : gcdInt(g, Math.abs(t.c.n));
  }
  if (mins.length === 0 && g <= 1) return null;
  return term(mins, g > 1 ? fr(g) : fOne);
}

function gcdInt(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a || 1;
}

/** L'unica variabile di num e den (null se nessuna o più di una). */
function singleVar(num: Term[], den: Term[]): string | null {
  const names = new Set<string>();
  for (const t of [...num, ...den]) for (const x of t.vars) names.add(x.v);
  return names.size === 1 ? [...names][0] : null;
}

function polyDegree(p: Term[]): number {
  return p.reduce((m, t) => Math.max(m, termDegree(t)), 0);
}

// ─── Euclide polinomiale (una variabile, coefficienti razionali) ──

/** Polinomio → coefficienti dal grado 0 (null se ha altre variabili). */
function polyToCoeffs(p: Term[], v: string): Frac[] | null {
  for (const t of p) if (t.vars.some((x) => x.v !== v)) return null;
  const deg = polyDegree(p);
  const c: Frac[] = Array.from({ length: deg + 1 }, () => fZero);
  for (const t of p) c[t.vars.find((x) => x.v === v)?.e ?? 0] = t.c;
  return c;
}

function coeffsToPoly(c: Frac[], v: string): Term[] {
  const out: Term[] = [];
  for (let i = 0; i < c.length; i++) if (c[i].n !== 0) out.push(term(i === 0 ? [] : [{ v, e: i }], c[i]));
  // ordine scolastico: grado decrescente (x − 1, non −1 + x)
  return out.sort((p, q) => termDegree(q) - termDegree(p));
}

function coeffsDegree(c: Frac[]): number {
  for (let i = c.length - 1; i >= 0; i--) if (c[i].n !== 0) return i;
  return -1;
}

/** Divisione con resto di a : b (coefficienti razionali, dal grado 0). */
function polyDivModCoeffs(a: Frac[], b: Frac[]): { q: Frac[]; r: Frac[] } {
  const r = [...a];
  const db = coeffsDegree(b);
  const q: Frac[] = Array.from({ length: Math.max(1, coeffsDegree(a) - db + 1) }, () => fZero);
  for (;;) {
    const dr = coeffsDegree(r);
    if (dr < db) break;
    const leadR = r[dr];
    const leadB = b[db];
    const f = fDiv(leadR, leadB);
    q[dr - db] = f;
    for (let i = 0; i <= db; i++) {
      if (b[i].n !== 0) r[i + dr - db] = fSub(r[i + dr - db], fMul(f, b[i]));
    }
  }
  return { q, r };
}

function polyGcdUnivariate(a: Term[], b: Term[], v: string): Term[] | null {
  let ca = polyToCoeffs(a, v);
  let cb = polyToCoeffs(b, v);
  if (!ca || !cb) return null;
  // normalizza il coefficiente direttore a 1 (Euclide razionale stabile)
  const norm = (c: Frac[]): Frac[] => {
    const d = coeffsDegree(c);
    if (d < 0) return c;
    const l = c[d];
    return c.map((x) => (x.n === 0 ? x : fDiv(x, l)));
  };
  ca = norm(ca);
  cb = norm(cb);
  while (coeffsDegree(cb) >= 0) {
    const { r } = polyDivModCoeffs(ca, cb);
    ca = cb;
    cb = norm(r);
  }
  // scala per rendere il coefficiente direttore intero positivo (stampa pulita)
  const d = coeffsDegree(ca);
  if (d < 0) return null;
  const lead = ca[d];
  const scaled = ca.map((x) => (x.n === 0 ? x : fMul(x, fDiv(fr(lead.d), fr(lead.n)))));
  return coeffsToPoly(scaled, v);
}

/** Divisione ESATTA a : b (null se il resto non è nullo). */
function polyDivExact(a: Term[], b: Term[]): Term[] | null {
  const v = singleVar(a, b);
  if (!v) return null;
  const ca = polyToCoeffs(a, v);
  const cb = polyToCoeffs(b, v);
  if (!ca || !cb) return null;
  const { q, r } = polyDivModCoeffs(ca, cb);
  if (coeffsDegree(r) >= 0) return null;
  return coeffsToPoly(q, v);
}

// ─── Aritmetica razionale ─────────────────────────────────────────

function polyNeg(p: Term[]): Term[] {
  return p.map((t) => term(t.vars, fNeg(t.c)));
}

function polyEqual(a: Term[], b: Term[]): boolean {
  if (a.length !== b.length) return false;
  const ma = new Map(a.map((t) => [termKey(t), t.c]));
  for (const t of b) {
    const c = ma.get(termKey(t));
    if (!c || c.n !== t.c.n || c.d !== t.c.d) return false;
  }
  return true;
}

export function ratAdd(a: Rat, b: Rat, sub: boolean): Rat {
  if (polyEqual(a.den, b.den)) {
    const num = sub ? polySub(a.num, b.num) : polyAdd(a.num, b.num);
    return ratFrom(num, a.den);
  }
  // denominatore comune = prodotto dei denominatori (scuola):
  // numA·denB ± numB·denA su denA·denB
  const den = mulDenDen(a.den, b.den);
  const na = mulNumDen(a.num, b.den);
  const nb = mulNumDen(b.num, a.den);
  const num = sub ? polySub(na, nb) : polyAdd(na, nb);
  return ratFrom(num, den);
}

export function ratMul(a: Rat, b: Rat): Rat {
  return ratFrom(polyMul(a.num, b.num), mulDenDen(a.den, b.den));
}

/** Valutazione razionale di un sottoalbero (i nodi «rat» passano through). */
export function evalRat(n: Node): Rat {
  switch (n.k) {
    case "num": return { num: n.v.n === 0 ? [] : [term([], n.v)], den: [] };
    case "var": return { num: [term([{ v: n.name, e: 1 }], fOne)], den: [] };
    case "term": return { num: [n.t], den: [] };
    case "add": return ratAdd(evalRat(n.a), evalRat(n.b), false);
    case "sub": return ratAdd(evalRat(n.a), evalRat(n.b), true);
    case "neg": {
      const r = evalRat(n.a);
      return ratFrom(polyNeg(r.num), r.den);
    }
    case "mul": return ratMul(evalRat(n.a), evalRat(n.b));
    case "div": {
      const ra = evalRat(n.a);
      const rb = evalRat(n.b);
      if (rb.num.length === 0) throw new ExprError("Non si può dividere per zero!");
      return ratFrom(mulNumDen(ra.num, rb.den), mulDenDen(ra.den, rb.num));
    }
    case "pow": {
      // (24/10-fix, come evalPoly) potenze NEGATIVE: a^(-k) = 1/(a^k) —
      // numeratore e denominatore del reciproco si scambiano.
      if (!Number.isInteger(n.e)) throw new ExprError("Gli esponenti devono essere numeri interi.");
      const r = evalRat(n.a);
      const k = Math.abs(n.e);
      let num = r.num;
      let den = r.den;
      for (let i = 1; i < k; i++) {
        num = polyMul(num, r.num);
        if (den.length) den = polyMul(den, r.den);
      }
      if (n.e < 0) return ratFrom(den.length ? den : [term([], fOne)], num);
      return ratFrom(num, den);
    }
    case "sqrt": case "root": {
      const r = evalRat(n.a);
      if (r.den.length > 0) throw new ExprError("L'app non supporta le radici di frazioni con lettere al denominatore.");
      const inner: Node = n.k === "sqrt"
        ? { k: "sqrt", a: polyToNode(r.num) }
        : { k: "root", a: polyToNode(r.num), n: n.n };
      return { num: evalPoly(inner), den: [] };
    }
    case "paren": return evalRat(n.a);
    case "powfrac": {
      // (25/10, punto 2) esponente frazionario: (ⁿ√a)^m — radice esatta
      // (garantita dal percorso a passi) poi potenza intera del razionale
      const radice: Node = n.n === 2 ? { k: "sqrt", a: n.a } : { k: "root", a: n.a, n: n.n };
      const r = evalRat(radice);
      if (n.m === 1) return r;
      let num = r.num;
      let den = r.den;
      for (let i = 1; i < n.m; i++) {
        num = polyMul(num, r.num);
        if (den.length) den = polyMul(den, r.den);
      }
      return ratFrom(num, den);
    }
    case "rat": return { num: n.num, den: n.den };
  }
}

// ─── Riconoscimento fratta ────────────────────────────────────────

/** L'espressione è FRATTA? Il motore polinomiale non la sa valutare
 *  (evalPoly lancia) E c'è almeno un «:» con divisore che contiene lettere. */
export function isFratte(ast: Node): boolean {
  // (25/10, punto 1) ora evalPoly riesce anche col denominatore monomio
  // (esponenti negativi ammessi nel motore): la classificazione si fa col
  // PERCORSO. Se l'intera espressione NON è valutabile dal motore
  // polinomiale → fratta appena c'è un denominatore con lettere (x+1 ecc.,
  // comportamento precedente). Se invece è valutabile, resta fratta SOLO
  // per le divisioni numerico : monomio con lettere (es. 3:x, 5:x → C.E.
  // x ≠ 0, percorso dedicato giro 21); le divisioni tra MONOMI con lettere
  // anche al numeratore (x⁴:x², x²:x⁴, 2x⁵:x⁷) seguono il percorso
  // polinomiale (proprietà dei quozienti, flusso pow-prop/div-mono).
  const evalOk = (() => {
    try {
      evalPoly(ast);
      return true;
    } catch {
      return false;
    }
  })();
  let found = false;
  const walk = (m: Node): void => {
    if (found) return;
    if (m.k === "div") {
      try {
        const num = evalPoly(m.a);
        const den = evalPoly(m.b);
        const denVars = den.some((t) => t.vars.length > 0);
        const numVars = num.some((t) => t.vars.length > 0);
        if (denVars && (!evalOk || !numVars)) found = true;
      } catch {
        found = true; // divisore non valutabile come polinomio → fratta complessa
      }
    }
    if (m.k === "add" || m.k === "sub" || m.k === "mul" || m.k === "div") { walk(m.a); walk(m.b); }
    else if (m.k === "neg" || m.k === "paren" || m.k === "pow" || m.k === "sqrt" || m.k === "root") walk(m.a);
  };
  walk(ast);
  return found;
}

// ─── Campo di esistenza ───────────────────────────────────────────

export interface CeItem {
  /** denominatore (polinomio) che non può valere zero */
  den: Term[];
  denLatex: string;
  variabile: string;
  degree: number;
  /** valori che annullano il denominatore (vuoti se non calcolabili) */
  roots: Frac[];
  /** la condizione è ricavata esattamente dall'app */
  exact: boolean;
  /** messaggio quando non risolvibile esattamente / nessuna esclusione */
  note?: string;
}

function polyCoeffsUnivariate(p: Term[], v: string): Frac[] {
  const deg = polyDegree(p);
  const c: Frac[] = Array.from({ length: deg + 1 }, () => fZero);
  for (const t of p) {
    const e = t.vars.find((x) => x.v === v)?.e ?? 0;
    c[e] = t.c;
  }
  return c;
}

/** Valore del polinomio (coefficienti dal grado 0) in r. */
function polyEvalCoeffs(c: Frac[], r: Frac): Frac {
  let acc = fZero;
  for (let i = c.length - 1; i >= 0; i--) acc = fAdd(fMul(acc, r), c[i]);
  return acc;
}

/** Valore che annulla a·x + b */
function solveLinear(ca: Frac, c0: Frac): Frac {
  if (ca.n === 0) throw new ExprError("Denominatore nullo.");
  return fNeg(fDiv(c0, ca));
}

/** Valori che annullano ax²+bx+c (Δ quadrato perfetto → esatti) */
function solveQuadratic(ca: Frac, cb: Frac, c0: Frac): { roots: Frac[]; exact: boolean; note?: string } {
  const disc = fSub(fMul(cb, cb), fMul(fr(4), fMul(ca, c0)));
  if (disc.n < 0) {
    return { roots: [], exact: true, note: "il discriminante è negativo: il denominatore non si annulla mai e non esclude nessun valore" };
  }
  const rn = Math.round(Math.sqrt(disc.n));
  const rd = Math.round(Math.sqrt(disc.d));
  if (rn * rn !== disc.n || rd * rd !== disc.d) {
    return { roots: [], exact: false, note: `il discriminante non è un quadrato perfetto: l'app non sa ricavare esattamente questa condizione (controlla col libro)` };
  }
  const sq = fr(rn, rd);
  const den2 = fMul(fr(2), ca);
  const r1 = fDiv(fAdd(fNeg(cb), sq), den2);
  const r2 = fDiv(fSub(fNeg(cb), sq), den2);
  return { roots: r1.n === r2.n && r1.d === r2.d ? [r1] : [r1, r2], exact: true };
}

/** Valori che annullano un polinomio di grado ≥ 3: test dei divisori razionali (p/q, |p|,|q| ≤ 24) + sdeflazione. */
function solveHigher(c: Frac[], variabile: string): { roots: Frac[]; exact: boolean; note?: string } {
  const roots: Frac[] = [];
  let coeffs = [...c];
  while (coeffs.length - 1 >= 3) {
    // radice 0 (termine noto nullo): x è un fattore → sdeflazione diretta
    if (coeffs[0].n === 0 && coeffs.length - 1 >= 1) {
      roots.push(fr(0));
      coeffs = coeffs.slice(1);
      continue;
    }
    let found: Frac | null = null;
    const lead = coeffs[coeffs.length - 1];
    const c0 = coeffs[0];
    if (lead.n !== 0 && c0.n !== 0) {
      outer: for (let q = 1; q <= 24; q++) {
        if (Math.abs(lead.n) % q !== 0) continue;
        for (let p = -24; p <= 24; p++) {
          if (p === 0 || c0.n % p !== 0) continue;
          const r = fr(p, q);
          if (polyEvalCoeffs(coeffs, r).n === 0) { found = r; break outer; }
        }
      }
    }
    if (!found) {
      return { roots, exact: false, note: `l'app non sa ricavare esattamente questa condizione (controlla col libro)` };
    }
    roots.push(found);
    coeffs = deflate(coeffs, found);
  }
  const deg = coeffs.length - 1;
  if (deg === 1) {
    roots.push(solveLinear(coeffs[1], coeffs[0]));
  } else if (deg === 2) {
    const q = solveQuadratic(coeffs[2], coeffs[1], coeffs[0]);
    if (!q.exact) return { roots, exact: false, note: q.note };
    roots.push(...q.roots);
  }
  return { roots, exact: true };
}

function coeffsToLatex(c: Frac[], v: string): string {
  const terms: Term[] = [];
  for (let i = 0; i < c.length; i++) {
    if (c[i].n === 0) continue;
    terms.push(term(i === 0 ? [] : [{ v, e: i }], c[i]));
  }
  return terms.length ? polyToLatex(terms) : "0";
}

/** Divisione sintetica del polinomio (coefficienti dal grado 0) per (x − r). */
function deflate(c: Frac[], r: Frac): Frac[] {
  const deg = c.length - 1;
  const out: Frac[] = Array(deg);
  out[deg - 1] = c[deg];
  for (let i = deg - 1; i >= 1; i--) {
    out[i - 1] = fAdd(c[i], fMul(r, out[i]));
  }
  return out;
}

/** Trova i valori che annullano il denominatore (ESATTI quando possibile). */
export function solveZeros(den: Term[], variabile: string): { roots: Frac[]; exact: boolean; note?: string } {
  const deg = polyDegree(den);
  if (deg === 0) {
    return { roots: [], exact: true, note: "il denominatore è un numero diverso da zero: non esclude nessun valore" };
  }
  if (den.some((t) => t.vars.length > 1 || (t.vars.length === 1 && t.vars[0].v !== variabile))) {
    return { roots: [], exact: false, note: "il denominatore ha più di una variabile: l'app non ricava questa condizione (controlla col libro)" };
  }
  if (deg === 1) {
    const cx = den.find((t) => t.vars.length > 0)!.c;
    const c0 = den.find((t) => t.vars.length === 0)?.c ?? fZero;
    return { roots: [solveLinear(cx, c0)], exact: true };
  }
  const c = polyCoeffsUnivariate(den, variabile);
  if (deg === 2) return solveQuadratic(c[2], c[1], c[0]);
  return solveHigher(c, variabile);
}

/** Raccoglie TUTTI i denominatori con lettere dell'AST originale
 *  (il campo di esistenza si calcola SEMPRE sull'espressione iniziale,
 *  anche dopo semplificazioni). */
export function collectCe(ast: Node): CeItem[] {
  const items: CeItem[] = [];
  const seen = new Set<string>();
  const walk = (m: Node): void => {
    if (m.k === "div") {
      let den: Term[];
      try {
        den = evalPoly(m.b);
      } catch {
        // divisore non valutabile come polinomio (frazioni annidate o
        // operazioni non supportate): messaggio chiaro
        throw new ExprError("L'app non supporta le frazioni dentro le frazioni (divisore con lettere al denominatore).");
      }
      if (den.some((t) => t.vars.length > 0)) {
        const variabile = [...new Set(den.flatMap((t) => t.vars.map((x) => x.v)))].sort()[0];
        const denLatex = polyToLatex(den);
        if (!seen.has(denLatex)) {
          seen.add(denLatex);
          const sol = solveZeros(den, variabile);
          items.push({ den, denLatex, variabile, degree: polyDegree(den), roots: sol.roots, exact: sol.exact, note: sol.note });
        }
      }
      walk(m.a);
      walk(m.b);
      return;
    }
    if (m.k === "add" || m.k === "sub" || m.k === "mul") { walk(m.a); walk(m.b); }
    else if (m.k === "neg" || m.k === "paren" || m.k === "pow" || m.k === "sqrt" || m.k === "root") walk(m.a);
  };
  walk(ast);
  return items;
}

// ─── Riduzione a passi (una operazione per volta) ─────────────────

export interface FrattaStep {
  latex: string;
  detail: string;
  /**
   * GIRO 31 (progressività assoluta): il dettaglio diviso in due parti:
   * - `op`: COSA fare (operazione generica, SEMPRE mostrabile);
   * - `computed`: i VALORI calcolati dall'app (denominatore comune, …) —
   *   MAI mostrati prima che lo studente inserisca il risultato corretto.
   * La pagina mostra `op` subito e `computed` solo dopo la convalida.
   */
  op?: string;
  computed?: string;
}

export interface FrattaAnalysis {
  originalLatex: string;
  ce: CeItem[];
  /** Campo di esistenza completo (latex), "" se nessun valore escluso */
  ceLatex: string;
  /** Passi di riduzione (il primo è l'espressione stessa) */
  steps: FrattaStep[];
  /** Risultato finale: LaTeX impilato se razionale */
  finalLatex: string;
  /** true se il risultato finale è ancora una frazione (denominatore ≠ 1) */
  finalIsRational: boolean;
  ast: Node;
}

function reduceChildren(n: Node): { node: Node; detail: string } | null {
  const swap = (which: "a" | "b", r: RatRed): RatRed => ({
    node: { ...(n as unknown as Record<string, unknown>), [which]: r.node } as unknown as Node,
    detail: r.detail,
    ...(r.op ? { op: r.op } : {}),
    ...(r.computed ? { computed: r.computed } : {}),
  });
  if (n.k === "add" || n.k === "sub" || n.k === "mul" || n.k === "div") {
    const ra = reduceRatOnce(n.a);
    if (ra) return swap("a", ra);
    const rb = reduceRatOnce(n.b);
    if (rb) return swap("b", rb);
  } else if (n.k === "neg" || n.k === "paren" || n.k === "pow" || n.k === "sqrt" || n.k === "root") {
    const ra = reduceRatOnce(n.a);
    if (ra) return swap("a", ra);
  }
  return null;
}

/** Una riduzione del nodo fratta: figli prima (sinistra → destra), poi regole. */
/** GIRO 31: valore ausiliario — il tipo esteso con op/computed separati. */
type RatRed = { node: Node; detail: string; op?: string; computed?: string };
export function reduceRatOnce(n: Node): RatRed | null {
  const rc = reduceChildren(n);
  if (rc) return rc;

  switch (n.k) {
    case "div": {
      // divisore con lettere → la divisione DIVENTA FRAZIONE (un passo,
      // MAI calcolo del valore: regola fissa dell'utente)
      let denHasVars = false;
      try {
        denHasVars = evalPoly(n.b).some((t) => t.vars.length > 0);
      } catch {
        throw new ExprError("L'app non supporta le frazioni dentro le frazioni (divisore con lettere al denominatore).");
      }
      if (!denHasVars) return null;
      const ra = evalRat(n.a);
      const denPoly = evalPoly(n.b);
      const result = ratFrom(ra.num, mulDenDen(ra.den, denPoly));
      // GIRO 31: il denominatore CALCOLATO è un risultato: `computed`
      const denTex = polyPlain(denPoly);
      return {
        node: { k: "rat", num: result.num, den: result.den },
        detail: `la divisione diventa frazione: il denominatore non può valere zero (ma il valore lo scrive lo studente)`,
        op: "la divisione diventa frazione",
        computed: `il denominatore è ${denTex} e non può valere zero`,
      };
    }
    case "rat":
      return null; // un valore razionale da solo non si riduce ulteriormente
    case "add": case "sub": {
      if (n.a.k !== "rat" && n.b.k !== "rat") return null;
      const ra = evalRat(n.a);
      const rb = evalRat(n.b);
      const combined = ratAdd(ra, rb, n.k === "sub");
      // GIRO 31: mcm/denominatore CALCOLATO = risultato → `computed`
      const sameDen = polyEqual(ra.den, rb.den);
      const denTex = combined.den.length ? polyToLatex(combined.den) : "1";
      const opTxt = sameDen
        ? `${n.k === "sub" ? "sottraggo" : "sommo"} i numeratori (stesso denominatore)`
        : `trovo il denominatore comune, poi ${n.k === "sub" ? "sottraggo" : "sommo"} i numeratori e semplifico`;
      const compTxt = sameDen
        ? `il denominatore resta ${denTex}`
        : `il denominatore comune è ${denTex}`;
      return {
        node: { k: "rat", num: combined.num, den: combined.den },
        detail: `${opTxt} — ${compTxt}`,
        op: opTxt,
        computed: compTxt,
      };
    }
    case "mul": {
      if (n.a.k !== "rat" && n.b.k !== "rat") return null;
      const combined = ratMul(evalRat(n.a), evalRat(n.b));
      const detail = n.a.k === "rat" && n.b.k === "rat"
        ? "prodotto di frazioni: numeratore × numeratore, denominatore × denominatore"
        : "moltiplico il numeratore per il fattore (il denominatore resta lo stesso)";
      return { node: { k: "rat", num: combined.num, den: combined.den }, detail };
    }
    case "neg": {
      if (n.a.k !== "rat") return null;
      const r = evalRat(n.a);
      return { node: { k: "rat", num: polyNeg(r.num), den: r.den }, detail: "cambio i segni al numeratore (regola dei segni)" };
    }
    case "paren": {
      if (n.a.k !== "rat") return null;
      return { node: n.a, detail: "" };
    }
    case "pow": {
      const hasRat = (() => {
        let found = false;
        const walkRat = (m: Node): void => {
          if (found) return;
          if (m.k === "rat") found = true;
          else if (m.k === "add" || m.k === "sub" || m.k === "mul" || m.k === "div") { walkRat(m.a); walkRat(m.b); }
          else if (m.k === "neg" || m.k === "paren") walkRat(m.a);
        };
        walkRat(n.a);
        return found;
      })();
      if (!hasRat) return null;
      const r = evalRat(n.a);
      let num = r.num;
      let den = r.den;
      for (let i = 1; i < n.e; i++) {
        num = polyMul(num, r.num);
        if (den.length) den = polyMul(den, r.den);
      }
      return {
        node: { k: "rat", num, den },
        detail: `potenza ${n.e}: elevo a ${n.e} sia il numeratore sia il denominatore`,
      };
    }
    default:
      return null;
  }
}

/** Testo LEGGIBILE di un polinomio per i dettagli dei passi (mai LaTeX grezzo:
 *  x^{2} → x², \dfrac{a}{b} → a/b). */
const SUP_PLAIN: Record<string, string> = { "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
export function polyPlain(p: Term[]): string {
  return polyToLatex(p)
    .replace(/\\dfrac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    .replace(/\^\{([0-9]+)\}/g, (_m, d: string) => [...d].map((c) => SUP_PLAIN[c] ?? "^" + c).join(""))
    .replace(/\\left|\\right/g, "");
}

/** LaTeX di una radice del campo di esistenza: intero → numero, frazione → impilata. */
function fracCeLatex(f: Frac): string {
  if (f.d === 1) return String(f.n);
  const sign = f.n < 0 ? "-" : "";
  return `${sign}\\dfrac{${Math.abs(f.n)}}{${f.d}}`;
}

/** Analisi completa di un'espressione FRATTA. */
export function analyzeFratte(raw: string): FrattaAnalysis {
  const normalized = normalizeInput(raw);
  const ast = pushNegThrough(parseExpression(normalized));
  if (!isFratte(ast)) {
    // non è fratta: lasciare il percorso polinomiale
    throw new ExprError("L'espressione non è fratta: usa il percorso normale.");
  }
  const ce = collectCe(ast);
  const steps: FrattaStep[] = [{ latex: printLatex(ast), detail: "" }];
  let current = ast;
  for (let i = 0; i < 80; i++) {
    const r = reduceRatOnce(current);
    if (!r) break;
    current = r.node;
    const latex = printLatex(current);
    if (latex === steps[steps.length - 1].latex && !r.detail) continue;
    steps.push({
      latex,
      detail: r.detail,
      ...(r.op ? { op: r.op } : {}),
      ...(r.computed ? { computed: r.computed } : {}),
    });
  }
  // risultato finale: nodo rat residuo (o polinomio già ridotto)
  const finalRat = current.k === "rat" ? { num: current.num, den: current.den } : evalRat(current);
  const finalIsRational = finalRat.den.length > 0;
  const finalLatex = printLatex({ k: "rat", num: finalRat.num, den: finalRat.den });
  // campo di esistenza (latex): SEMPRE dai denominatori ORIGINALI
  const parts: string[] = [];
  for (const item of ce) {
    for (const r of item.roots) {
      parts.push(`${item.variabile} \\ne ${fracCeLatex(r)}`);
    }
    if (item.exact && item.roots.length === 0 && item.note) {
      // nessuna esclusione (es. discriminante negativo): lo si dice a parole
      parts.push(`\\text{nessun valore escluso da ${item.denLatex}}`);
    } else if (!item.exact) {
      parts.push(`\\text{${item.denLatex} \\ne 0}`);
    }
  }
  return {
    originalLatex: printLatex(ast),
    ce,
    ceLatex: parts.join(" \\wedge "),
    steps,
    finalLatex,
    finalIsRational,
    ast,
  };
}
