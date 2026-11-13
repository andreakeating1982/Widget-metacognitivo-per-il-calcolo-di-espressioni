/** Confronto esatto delle risposte numeriche contenenti radicali.
 * Non sostituisce radici irrazionali con decimali arrotondati. I radicali
 * quadrati di razionali sono trattati come somme di termini c·√d; per alcune
 * radici cubiche/quarte si confrontano potenze esatte, controllando i segni.
 * null significa «non verificabile», NON significa «uguale». */
import {
  evaluateNumericExpression, evalPoly, fAdd, fDiv, fEq, fMul, fNeg, fOne, fSub,
  fZero, fr, normalizeInput, parseExpression, polyEquals, printLatex,
  rationalPolyEquals, type Frac, type Node,
} from "./espressioni";

type RadicalSum = Map<number, Frac>; // chiave d senza fattori quadrati; d=1 razionale
const MAX_RADICAND = 10_000_000_000;
const MAX_TERMS = 32;

function constant(n: Node): Frac | null {
  try {
    const p = evalPoly(n);
    if (p.length === 0) return fZero;
    return p.length === 1 && p[0].vars.length === 0 ? p[0].c : null;
  } catch { return null; }
}
function single(d: number, c: Frac): RadicalSum {
  return c.n === 0 ? new Map() : new Map([[d, c]]);
}

/* (12/11, foto utente) Valore RAZIONALE di un nodo senza lettere: oltre alle
 * costanti pure gestisce frazioni impilate e prodotti/somme numerici
 * (√[−2]{\dfrac{1}{90}} ha radicando \dfrac{1}{90}, che constant() rifiuta
 * perché evalPoly non scompone le frazioni impilate). */
function costanteRazionale(n: Node): Frac | null {
  const c = constant(n);
  if (c) return c;
  switch (n.k) {
    case "num": return n.v;
    case "paren": return costanteRazionale(n.a);
    case "neg": { const a = costanteRazionale(n.a); return a ? fNeg(a) : null; }
    case "div": {
      const a = costanteRazionale(n.a), b = costanteRazionale(n.b);
      return a && b && b.n !== 0 ? fDiv(a, b) : null;
    }
    case "mul": {
      const a = costanteRazionale(n.a), b = costanteRazionale(n.b);
      return a && b ? fMul(a, b) : null;
    }
    case "add": {
      const a = costanteRazionale(n.a), b = costanteRazionale(n.b);
      return a && b ? fAdd(a, b) : null;
    }
    case "sub": {
      const a = costanteRazionale(n.a), b = costanteRazionale(n.b);
      return a && b ? fSub(a, b) : null;
    }
    default: return null;
  }
}
function plus(a: RadicalSum, b: RadicalSum): RadicalSum {
  const out = new Map(a);
  for (const [d,c] of b) {
    const v = fAdd(out.get(d) ?? fZero,c);
    if (v.n === 0) out.delete(d); else out.set(d,v);
  }
  if (out.size > MAX_TERMS) throw new Error("Troppe radici");
  return out;
}
function gcd(a: number, b: number): number {
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}
function product(a: RadicalSum, b: RadicalSum): RadicalSum {
  let out: RadicalSum = new Map();
  for (const [da,ca] of a) for (const [db,cb] of b) {
    const g = gcd(da,db);
    const d = BigInt(da / g) * BigInt(db / g);
    if (d > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Radicando troppo grande");
    out = plus(out, single(Number(d), fMul(fMul(ca,cb),fr(g))));
  }
  return out;
}
function inverse(a: RadicalSum): RadicalSum | null {
  if (a.size !== 1) return null;
  const [d,c] = [...a][0];
  if (!c.n) return null;
  return single(d, fDiv(fOne, fMul(c,fr(d))));
}
function sqrtFraction(f: Frac): RadicalSum | null {
  if (f.n < 0) return null;
  if (!f.n) return new Map();
  const n = BigInt(f.n) * BigInt(f.d);
  if (n > BigInt(MAX_RADICAND)) return null;
  let rest = Number(n), outside = 1;
  for (let p = 2; p * p <= rest; p++) {
    const square = p * p;
    while (rest % square === 0) { rest /= square; outside *= p; }
  }
  return single(rest, fDiv(fr(outside), fr(f.d)));
}
function squareRadicals(n: Node): RadicalSum | null {
  const c = constant(n);
  if (c) return single(1,c);
  switch (n.k) {
    // (12/11) VALORE ASSOLUTO: fuori dal percorso dei radicali numerici.
    case "abs": return null;
    case "num": return single(1,n.v);
    case "term": return n.t.vars.length ? null : single(1,n.t.c);
    case "var": return null;
    case "paren": return squareRadicals(n.a);
    case "neg": { const a = squareRadicals(n.a); return a ? new Map([...a].map(([d,v]) => [d,fNeg(v)])) : null; }
    case "add": case "sub": {
      const a = squareRadicals(n.a), b = squareRadicals(n.b);
      if (!a || !b) return null;
      return plus(a, n.k === "add" ? b : new Map([...b].map(([d,v]) => [d,fNeg(v)])));
    }
    case "mul": case "div": {
      const a = squareRadicals(n.a), b = squareRadicals(n.b);
      if (!a || !b) return null;
      if (n.k === "mul") return product(a,b);
      const inv = inverse(b);
      return inv ? product(a,inv) : null;
    }
    case "sqrt": case "root": {
      const idx = n.k === "sqrt" ? 2 : n.n;
      if (idx !== 2) return null;
      /* (12/11) costanteRazionale: anche radicandi frazione impilata. */
      const radicand = costanteRazionale(n.a);
      return radicand === null ? null : sqrtFraction(radicand);
    }
    case "powfrac": {
      if (n.n !== 2) return null;
      const radicand = constant(n.a);
      if (radicand === null) return null;
      const root = sqrtFraction(radicand);
      if (!root || !Number.isInteger(n.m) || Math.abs(n.m) > 32) return null;
      let out = single(1,fOne), base = n.m < 0 ? inverse(root) : root;
      if (!base) return null;
      for (let k = Math.abs(n.m); k > 0; k = Math.floor(k/2)) {
        if (k % 2) out = product(out,base);
        if (k > 1) base = product(base,base);
      }
      return out;
    }
    case "pow": {
      if (!Number.isInteger(n.e) || Math.abs(n.e) > 32) return null;
      const r = squareRadicals(n.a);
      if (!r || (r.size === 0 && n.e <= 0)) return null;
      let out = single(1,fOne), base = n.e < 0 ? inverse(r) : r;
      if (!base) return null;
      for (let k = Math.abs(n.e); k > 0; k = Math.floor(k/2)) {
        if (k % 2) out = product(out,base);
        if (k > 1) base = product(base,base);
      }
      return out;
    }
    case "rat": return null;
  }
}
/* ─── (09/11, radici n-esime) SOMME ESATTE di c·√[k]{d} a STESSO indice ────
 * Stessa struttura della soma c·√d sopra, generalizzata all'indice k
 * (∛, ∜). Chiave del termine = radicando RIDOTTO (senza fattori k-esimi
 * potenza). Mischio indici diversi (√ + ∛) → null: non si raccoglie. */
type KSum = Map<number, Frac>; // chiave d ridotta; i razionali NON stanno qui

/* Solo numeri interi sicuri (target ES2015, niente BigInt): ogni prodotto
 * intermedio resta sotto Number.MAX_SAFE_INTEGER (~9·10^15), altrimenti null. */
const MAX_SAFE = 9_000_000_000_000_000;

function kthExtract(m: number, k: number): { outside: number; rest: number } | null {
  if (m < 0 || m > MAX_SAFE) return null;
  /* (12/11, foto utente) GUARDIA anti-blocco: con k negativo la condizione
   * Math.pow(p, k) <= rest resta sempre vera (p^(−k) < 2 < rest) e il ciclo
   * girava all'infinito: la verifica di √[−2]{1/90} bloccava il server
   * (loop da 30 minuti di CPU). Gli indici negativi NON arrivano più qui:
   * kthFraction li gestisce come reciproco e contoGiusto riscrive
   * √[−k]{X} → 1/√[k]{X} prima del confronto. */
  if (!Number.isInteger(k) || k < 2) return null;
  let outside = 1, rest = m;
  for (let p = 2; Math.pow(p, k) <= rest; p++) {
    const pk = Math.pow(p, k);
    while (rest % pk === 0) { rest /= pk; outside *= p; }
  }
  if (rest > MAX_RADICAND) return null;
  return { outside, rest };
}

/** √[k]{f} con f razionale: √[k]{a/b} = √[k]{a·b^(k−1)} / b. Restituisce
 *  il termine ridotto {rest → outside/b}; f negativo con k pari → null. */
export function kthFraction(f: Frac, k: number): KSum | null {
  if (f.n < 0 && k % 2 === 0) return null;
  /* (12/11, foto utente) INDICE NEGATIVO: √[−k]{f} = 1/√[k]{f}. Prima la
   * chiamata con k negativo arrivava a kthExtract e bloccava per sempre. */
  if (k < 0) {
    const pos = kthFraction(f, -k);
    return pos ? kInverse(pos, -k) : null;
  }
  const segno = f.n < 0 ? -1 : 1;
  const a = Math.abs(f.n), b = f.d;
  if (!a) return new Map();
  let m = a;
  for (let i = 1; i < k; i++) {
    m *= b;
    if (m > MAX_SAFE) return null;
  }
  const ex = kthExtract(m, k);
  if (!ex) return null;
  return single(ex.rest, fDiv(fr(segno * ex.outside, 1), fr(b, 1)));
}

function kProduct(a: KSum, b: KSum, k: number): KSum | null {
  let out: KSum = new Map();
  for (const [da, ca] of a) for (const [db, cb] of b) {
    const m = da * db;
    if (m > MAX_SAFE) return null;
    const ex = kthExtract(m, k);
    if (!ex) return null;
    const coeff = fMul(fMul(ca, cb), ex.outside === 0 ? fZero : fr(ex.outside, 1));
    const v = fAdd(out.get(ex.rest) ?? fZero, coeff);
    if (v.n === 0) out.delete(Number(ex.rest)); else out.set(Number(ex.rest), v);
    if (out.size > MAX_TERMS) return null;
  }
  return out;
}

function kInverse(a: KSum, k: number): KSum | null {
  if (a.size !== 1) return null;
  const [d, c] = [...a][0];
  if (!c.n) return null;
  /* 1/(c·√[k]{d}) = √[k]{d^(k−1)} / (c·d) */
  let m = d;
  for (let i = 1; i < k - 1; i++) { m *= d; if (m > MAX_SAFE) return null; }
  const ex = kthExtract(m, k);
  if (!ex) return null;
  const coeff = fDiv(fOne, fMul(c, fr(ex.outside * d, 1)));
  return coeff.n === 0 ? new Map() : single(ex.rest, coeff);
}

function kthRadicals(n: Node, k: number, profondita = 0): KSum | null {
  if (profondita > 40) return null;
  const c = constant(n);
  if (c) return c.n === 0 ? new Map() : single(1, c);
  switch (n.k) {
    case "num": return kthFraction(n.v, k);
    case "term": return n.t.vars.length ? null : kthFraction(n.t.c, k);
    case "var": return null;
    case "paren": return kthRadicals(n.a, k, profondita + 1);
    case "neg": { const a = kthRadicals(n.a, k, profondita + 1); return a ? new Map([...a].map(([d, v]) => [d, fNeg(v)])) : null; }
    case "add": case "sub": {
      const a = kthRadicals(n.a, k, profondita + 1), b = kthRadicals(n.b, k, profondita + 1);
      if (!a || !b) return null;
      const bs = n.k === "add" ? b : new Map([...b].map(([d, v]) => [d, fNeg(v)]));
      let out = new Map(a);
      for (const [d, v] of bs) {
        const w = fAdd(out.get(d) ?? fZero, v);
        if (w.n === 0) out.delete(d); else out.set(d, w);
      }
      if (out.size > MAX_TERMS) return null;
      return out;
    }
    case "mul": case "div": {
      const a = kthRadicals(n.a, k, profondita + 1), b = kthRadicals(n.b, k, profondita + 1);
      if (!a || !b) return null;
      if (n.k === "mul") return kProduct(a, b, k);
      const inv = kInverse(b, k);
      return inv ? kProduct(a, inv, k) : null;
    }
    case "sqrt": case "root": {
      const idx = n.k === "sqrt" ? 2 : n.n;
      if (idx !== k) return null;
      /* (12/11) costanteRazionale: anche radicandi FRAZIONE impilata. */
      const radicand = costanteRazionale(n.a);
      return radicand === null ? null : kthFraction(radicand, k);
    }
    case "pow": {
      if (!Number.isInteger(n.e) || Math.abs(n.e) > 12) return null;
      const r = kthRadicals(n.a, k, profondita + 1);
      if (!r || (r.size === 0 && n.e <= 0)) return null;
      let out: KSum = new Map([[1, fOne]]);
      const base = n.e < 0 ? kInverse(r, k) : r;
      if (base === null || base === undefined) return null;
      let fattore: KSum = base;
      for (let j = Math.abs(n.e); j > 0; j = Math.floor(j / 2)) {
        if (j % 2) {
          const acc = kProduct(out, fattore, k);
          if (acc === null) return null;
          out = acc;
        }
        if (j > 1) { const q = kProduct(fattore, fattore, k); if (q === null) return null; fattore = q; }
      }
      return out;
    }
    default: return null;
  }
}

function coeffLatexK(c: Frac, d: number, k: number, primoSegno: boolean): string {
  const rad = d === 1 ? "" : k === 2 ? `\\sqrt{${d}}` : `\\sqrt[${k}]{${d}}`;
  const segno = c.n < 0 ? (primoSegno ? "-" : " - ") : primoSegno ? "" : " + ";
  const n = Math.abs(c.n);
  if (c.d === 1) return `${segno}${n === 1 && d !== 1 ? "" : n}${rad}`;
  const num = d === 1 ? `${n}` : `${n === 1 ? "" : n}${rad}`;
  return `${segno}\\dfrac{${num}}{${c.d}}`;
}

/** Stampa LaTeX di una soma c·√[k]{d} (parte razionale prima, poi i
 *  radicali per radicando crescente; denominatore comune se interi). */
export function laticeSommaNesima(s: KSum, k: number): string | null {
  const termine = [...s.entries()].filter(([, c]) => c.n !== 0);
  if (!termine.length) return "0";
  termine.sort((a, b) => a[0] - b[0]);
  const mcd = (a: number, b: number): number => (b ? mcd(b, a % b) : a);
  let L = 1;
  for (const [, c] of termine) L = (L * c.d) / mcd(L, c.d);
  const tuttiInteri =
    L > 1 &&
    termine.every(([, c]) => (L / c.d) * Math.abs(c.n) <= Number.MAX_SAFE_INTEGER);
  if (tuttiInteri) {
    const spostati: KSum = new Map(
      termine.map(([d, c]) => [d, { n: c.n * (L / c.d), d: 1 } as Frac]),
    );
    const negativo = [...spostati.values()][0].n < 0;
    if (negativo) {
      for (const [d, c] of spostati) spostati.set(d, { n: -c.n, d: 1 });
    }
    const interno = laticeSommaNesima(spostati, k);
    if (!interno || interno === "0") return null;
    return `${negativo ? "-" : ""}\\dfrac{${interno}}{${L}}`;
  }
  let fuori = "";
  termine.forEach(([d, c], i) => {
    fuori += coeffLatexK(c, d, k, i === 0);
  });
  return fuori;
}

/** Risultato ESATTO di una soma c·√[k]{d} a indice unico (≥3).
 *  null se gli indici sono mischiati o l'albero non è rappresentabile. */
export function risultatoNesimoLatex(raw: string): string | null {
  try {
    const n = parseExpression(normalizeInput(raw));
    const idxs = [...rootIndices(n)];
    if (idxs.length !== 1 || idxs[0] < 3) return null;
    const s = kthRadicals(n, idxs[0]);
    if (!s) return null;
    return laticeSommaNesima(s, idxs[0]);
  } catch {
    return null;
  }
}

/** Somma ridotta {d → coefficiente} di un'espressione a indice unico k,
 *  per i costruttori deterministici (raccoglimento dei termini simili). */
export function sommaNesimaDi(raw: string): { k: number; s: KSum } | null {
  try {
    const n = parseExpression(normalizeInput(raw));
    const idxs = [...rootIndices(n)];
    if (idxs.length !== 1) return null;
    const s = kthRadicals(n, idxs[0]);
    return s ? { k: idxs[0], s } : null;
  } catch {
    return null;
  }
}

function equalSums(a: RadicalSum, b: RadicalSum): boolean {
  if (a.size !== b.size) return false;
  for (const [d,v] of a) { const w = b.get(d); if (!w || !fEq(v,w)) return false; }
  return true;
}

/* ─── (08/11, radicali in costruzione) Valore ESATTO e stampa LaTeX ────
 * Il server (riparaEsercizio) deve poter CALCOLARE il risultato di un box
 * con radicali quando l'IA sbaglia o non risponde: qui espongo la soma
 * esatta c·√d già usata per il confronto e la sua forma LaTeX (proprietà
 * dei radicali: trasporto fuori radice, radicali simili, potenza del
 * radicando con esponente pari all'indice). null = non rappresentabile. */
export function sommaRadicaleDi(raw: string): RadicalSum | null {
  try {
    return squareRadicals(parseExpression(normalizeInput(raw)));
  } catch {
    return null;
  }
}

function coeffLatex(c: Frac, d: number, primoSegno: boolean): string {
  const segno = c.n < 0 ? (primoSegno ? "-" : " - ") : primoSegno ? "" : " + ";
  const n = Math.abs(c.n);
  if (c.d === 1) {
    const rad = d === 1 ? "" : `\\sqrt{${d}}`;
    return `${segno}${n === 1 && d !== 1 ? "" : n}${rad}`;
  }
  /* coefficiente frazionario: frazione impilata, radice nel numeratore */
  const num = d === 1 ? `${n}` : `${n === 1 ? "" : n}\\sqrt{${d}}`;
  return `${segno}\\dfrac{${num}}{${c.d}}`;
}

/** Forma LaTeX ridotta di una soma c·√d: parte razionale prima, poi i
 * radicali per radicando crescente; coefficienti frazionari con denomi-
 * natore comune escono come frazione impilata con il meno davanti
 * (es. {1:1/2, 2:−1/4, 6:1/4} → \dfrac{2-\sqrt{2}+\sqrt{6}}{4}). */
export function laticeSommaRadicale(s: RadicalSum): string | null {
  const termine = [...s.entries()].filter(([, c]) => c.n !== 0);
  if (!termine.length) return "0";
  termine.sort((a, b) => a[0] - b[0]);
  /* denominatore comune fra i coefficienti */
  const mcd = (a: number, b: number): number => (b ? mcd(b, a % b) : a);
  let L = 1;
  for (const [, c] of termine) L = (L * c.d) / mcd(L, c.d);
  const tuttiInteri =
    L > 1 &&
    termine.every(([, c]) => (L / c.d) * Math.abs(c.n) <= Number.MAX_SAFE_INTEGER);
  if (tuttiInteri) {
    const spostati: RadicalSum = new Map(
      termine.map(([d, c]) => [d, { n: c.n * (L / c.d), d: 1 } as Frac]),
    );
    /* il meno va DAVANTI alla frazione, mai nel numeratore */
    const primo = [...spostati.values()][0];
    const negativo = primo.n < 0;
    if (negativo) {
      for (const [d, c] of spostati) spostati.set(d, { n: -c.n, d: 1 });
    }
    const interno = laticeSommaRadicale(spostati);
    if (!interno || interno === "0") return null;
    return `${negativo ? "-" : ""}\\dfrac{${interno}}{${L}}`;
  }
  let fuori = "";
  termine.forEach(([d, c], i) => {
    fuori += coeffLatex(c, d, i === 0);
  });
  return fuori;
}

/** Risultato ESATTO di un'espressione con radicali in LaTeX ridotto.
 *  Serve al server per calcolare lui le risposte che l'IA sbaglia.
 *  (09/11) ora copre anche le somme a indice unico ∛/∜ (radicando
 *  ridotto + raccolta dei termini simili: es. 2∛81−5∛32−3∛24+4∛108). */
/** Chiude la graffa aperta in posizione `aperta` (annidamenti compresi). */
function chiudiGraffa(s: string, aperta: number): number {
  let prof = 1;
  for (let j = aperta + 1; j < s.length; j++) {
    if (s[j] === "{") prof += 1;
    else if (s[j] === "}") { prof -= 1; if (prof === 0) return j; }
  }
  return -1;
}

/** (12/11, foto utente, box 9) √[−k]{X} → (\sqrt[k]{X})^{−1}: la forma con
 *  l'esponente −1 sulla radice, come può comparire nella riga progressiva.
 *  Le due scritture sono la stessa cosa; il collegamento strutturale dei box
 *  deve poterle trattare come la stessa sottoespressione. */
export function radicaleNegativaAPotenza(latex: string): string {
  if (!latex.includes("\\sqrt[-")) return latex;
  let out = "";
  let i = 0;
  while (i < latex.length) {
    const m = /^\\sqrt\[-(\d+)\]\{/.exec(latex.slice(i));
    if (!m) { out += latex[i]; i += 1; continue; }
    const aperta = i + m[0].length - 1;
    const chiusa = chiudiGraffa(latex, aperta);
    if (chiusa < 0) { out += latex[i]; i += 1; continue; }
    const radicando = latex.slice(aperta + 1, chiusa);
    out += `\\left(\\sqrt[${m[1]}]{${radicando}}\\right)^{-1}`;
    i = chiusa + 1;
  }
  return out;
}

/** (12/11, foto utente, box 9) (\sqrt[k]{X})^{−1} → √[−k]{X}: la forma con
 *  l'indice negativo, quando il box usa quella e la riga ha l'esponente. */
export function radicalePotenzaANegativa(latex: string): string {
  const APERTO = "\\left(\\sqrt[";
  if (!latex.includes("^{-1}") || !latex.includes(APERTO)) return latex;
  let out = "";
  let i = 0;
  while (i < latex.length) {
    if (latex.startsWith(APERTO, i)) {
      let j = i + APERTO.length;
      let cifre = "";
      while (j < latex.length && latex[j] >= "0" && latex[j] <= "9") cifre += latex[j++];
      if (cifre && latex.startsWith("]{", j)) {
        const aperta = j + 1;
        const chiusa = chiudiGraffa(latex, aperta);
        if (chiusa >= 0 && latex.startsWith("\\right)^{-1}", chiusa + 1)) {
          out += "\\sqrt[-" + cifre + "]{" + latex.slice(aperta + 1, chiusa) + "}";
          i = chiusa + 1 + "\\right)^{-1}".length;
          continue;
        }
      }
    }
    out += latex[i];
    i += 1;
  }
  return out;
}

/** (12/11, foto utente) Riscrive le radici con INDICE NEGATIVO in forma di
 *  reciproco con indice positivo: √[−k]{X} → 1/√[k]{X}. Il motore dei
 *  radicali (kthRadicals, sommaRadicaleDi) ragiona a indice positivo; con
 *  questa riscrittura le radici negative diventano verificabili ESATTAMENTE
 *  invece di bloccare o restare «non verificabili». Rispetta le graffe del
 *  radicando (annidate comprese). */
export function radicaleIndiceNegativoAPositivo(latex: string): string {
  if (!/\\sqrt\[-\d+\]\{/.test(latex)) return latex;
  let out = "";
  let i = 0;
  while (i < latex.length) {
    const m = /^\\sqrt\[-(\d+)\]\{/.exec(latex.slice(i));
    if (!m) { out += latex[i]; i += 1; continue; }
    const aperta = i + m[0].length - 1;
    let profondita = 1;
    let j = aperta + 1;
    while (j < latex.length && profondita > 0) {
      if (latex[j] === "{") profondita++;
      else if (latex[j] === "}") profondita--;
      j += 1;
    }
    if (profondita !== 0) { out += latex[i]; i += 1; continue; }
    const radicando = latex.slice(aperta + 1, j - 1);
    out += `\\dfrac{1}{\\sqrt[${m[1]}]{${radicaleIndiceNegativoAPositivo(radicando)}}}`;
    i = j;
  }
  return out;
}

export function risultatoRadicaleLatex(raw: string): string | null {
  const s = sommaRadicaleDi(radicaleIndiceNegativoAPositivo(raw));
  if (s) return laticeSommaRadicale(s);
  return risultatoNesimoLatex(radicaleIndiceNegativoAPositivo(raw));
}

/** Trasforma (prodotto di radicali)^k in una espressione razionale, solo
 * quando ciascun indice divide k. Non sviluppa mai somme non verificate. */
function raiseToRational(n: Node, k: number): Node | null {
  const c = constant(n);
  if (c) return { k: "pow", a: { k: "num", v: c }, e: k };
  switch (n.k) {
    case "paren": return raiseToRational(n.a,k);
    case "neg": {
      const a=raiseToRational(n.a,k);
      return !a ? null : k % 2 ? { k:"neg", a } : a;
    }
    case "mul": case "div": {
      const a=raiseToRational(n.a,k), b=raiseToRational(n.b,k);
      return a && b ? { ...n, a, b } : null;
    }
    case "sqrt": return k % 2 ? null : { k:"pow", a:n.a, e:k/2 };
    case "root": return k % n.n ? null : { k:"pow", a:n.a, e:k/n.n };
    case "powfrac": return (k*n.m) % n.n ? null : { k:"pow", a:n.a, e:k*n.m/n.n };
    case "pow": {
      if (!Number.isInteger(n.e) || Math.abs(k*n.e)>48) return null;
      const a=raiseToRational(n.a,Math.abs(k*n.e));
      if (!a) return null;
      return n.e < 0 ? { k:"div", a:{k:"num",v:fOne}, b:a, fr:true } : a;
    }
    default: return null;
  }
}
function rootIndices(n: Node, out = new Set<number>()): Set<number> {
  if (n.k === "sqrt") out.add(2);
  if (n.k === "root" || n.k === "powfrac") out.add(n.n);
  if (n.k === "add" || n.k === "sub" || n.k === "mul" || n.k === "div") { rootIndices(n.a,out); rootIndices(n.b,out); }
  else if (n.k === "neg" || n.k === "paren" || n.k === "sqrt" || n.k === "root" || n.k === "pow" || n.k === "powfrac") rootIndices(n.a,out);
  return out;
}

/** È presente almeno una radice o una potenza con esponente frazionario? */
export function hasRadical(raw: string): boolean {
  try { return rootIndices(parseExpression(normalizeInput(raw))).size > 0; }
  catch { return /√|∛|∜|\\sqrt/.test(raw); }
}

/** true/false solo quando il confronto è dimostrabile; null altrimenti. */
export function exactNumericEquality(a: string, b: string): boolean | null {
  try {
    const rational = rationalPolyEquals(a,b);
    if (rational !== null) return rational;
    const x = parseExpression(normalizeInput(a)), y = parseExpression(normalizeInput(b));
    const ax = evaluateNumericExpression(a), by = evaluateNumericExpression(b);
    if (ax === null || by === null) return null;
    // Forme identiche dopo la normalizzazione sono identiche ESATTAMENTE,
    // anche quando la razionalizzazione di un indice alto supererebbe i
    // limiti interi del calcolatore. Il controllo di dominio sopra impedisce
    // di accettare radici non reali o reciproci di zero.
    if (JSON.stringify(x) === JSON.stringify(y)) return true;
    const p = (() => { try { return evalPoly(x); } catch { return null; } })();
    const q = (() => { try { return evalPoly(y); } catch { return null; } })();
    if (p && q) return polyEquals(p,q);
    const sx = squareRadicals(x), sy = squareRadicals(y);
    if (sx && sy) return equalSums(sx,sy);
    /* (09/11, radici n-esime) somme a INDICE UNICO (∛, ∜): confronto
     * esatto dei termini ridotti c·√[k]{d}, stessa tecnica dei quadrati. */
    const tuttiIdx = new Set([...rootIndices(x), ...rootIndices(y)]);
    if (tuttiIdx.size === 1) {
      const kk = [...tuttiIdx][0];
      const kx = kthRadicals(x, kk), ky = kthRadicals(y, kk);
      if (kx && ky) return equalSums(kx, ky);
    }
    const indices = [...rootIndices(x), ...rootIndices(y)];
    if (!indices.length || indices.some((i) => !Number.isInteger(i) || i < 2 || i > 4)) return null;
    let k = 1;
    for (const i of indices) k = k / gcd(k,i) * i;
    if (k > 12 || (k % 2 === 0 && Math.sign(ax) !== Math.sign(by))) return false;
    const px=raiseToRational(x,k), py=raiseToRational(y,k);
    return px && py ? rationalPolyEquals(printLatex(px),printLatex(py)) : null;
  } catch { return null; }
}

