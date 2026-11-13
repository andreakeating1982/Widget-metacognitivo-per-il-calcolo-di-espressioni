/**
 * MOTORE MATEMATICO — Espressioni letterali, monomi e polinomi.
 *
 * Analizza un'espressione (scritta a mano e riconosciuta come LaTeX, digitata
 * da tastiera o letta da una foto via OCR) e genera i PASSI GUIDATI di riduzione:
 *
 *  PASSO 1 · Risolvo le parentesi tonde (valore numerico, segno, distribuzione)
 *  PASSO 2 · Riscrivo senza parentesi (monomi risultanti, colorati per gruppo)
 *  PASSO 3 · Raggruppo i monomi simili e sommo i coefficienti (input studente)
 *  PASSO 4 · Risultato finale (polinomio ridotto / numero)
 *  PASSO 5 · HO CONTROLLATO (verifica per sostituzione, come nella mappa PDF)
 *
 * Regole BES/DSA: aritmetica ESATTA con frazioni, interi senza decimali,
 * decimali con la virgola, pochi passi chiari, feedback immediato.
 *
 * L'espressione viene rappresentata come AST con nodi Paren espliciti
 * (per costruire i passi di dissoluzione) e nodi Term (monomi già ridotti).
 */

// ─── Frazioni esatte ──────────────────────────────────────────────

export interface Frac { n: number; d: number }

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a || 1;
}

/** Frazioni razionali esatte: oltre il limite rappresentabile non si
 *  arrotonda silenziosamente, ma si segnala che il calcolo è troppo grande. */
export function fr(n: number, d = 1): Frac {
  if (d === 0) throw new Error("divisione per zero");
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) {
    throw new Error("Numero troppo grande o non intero per un calcolo esatto.");
  }
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

/** Gli intermedi si calcolano con BigInt prima di ridurre, evitando sia
 *  arrotondamenti IEEE-754 sia falsi overflow su frazioni semplificabili. */
function frBig(n: bigint, d: bigint): Frac {
  const zero = BigInt(0);
  if (d === zero) throw new Error("divisione per zero");
  if (d < zero) { n = -n; d = -d; }
  let a = n < zero ? -n : n;
  let b = d;
  while (b !== zero) { const r = a % b; a = b; b = r; }
  const g = a === zero ? BigInt(1) : a;
  n /= g;
  d /= g;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || n < -max || d > max) {
    throw new Error("Numeri troppo grandi per mantenere il calcolo esatto.");
  }
  return { n: Number(n), d: Number(d) };
}

export const fZero = fr(0);
export const fOne = fr(1);

export function fAdd(a: Frac, b: Frac): Frac { return frBig(BigInt(a.n) * BigInt(b.d) + BigInt(b.n) * BigInt(a.d), BigInt(a.d) * BigInt(b.d)); }
export function fSub(a: Frac, b: Frac): Frac { return frBig(BigInt(a.n) * BigInt(b.d) - BigInt(b.n) * BigInt(a.d), BigInt(a.d) * BigInt(b.d)); }
export function fMul(a: Frac, b: Frac): Frac { return frBig(BigInt(a.n) * BigInt(b.n), BigInt(a.d) * BigInt(b.d)); }
export function fDiv(a: Frac, b: Frac): Frac { if (b.n === 0) throw new Error("divisione per zero"); return frBig(BigInt(a.n) * BigInt(b.d), BigInt(a.d) * BigInt(b.n)); }
export function fNeg(a: Frac): Frac { return { n: -a.n, d: a.d }; }
export function fIsZero(a: Frac): boolean { return a.n === 0; }
export function fEq(a: Frac, b: Frac): boolean { return BigInt(a.n) * BigInt(b.d) === BigInt(b.n) * BigInt(a.d); }

/** LaTeX di un VALORE numerico: interi senza decimali; i valori non interi
 *  si scrivono con i DUE PUNTI di divisione (es. «21 : 2»), mai come frazione
 *  verticale (richiesta esplicita: la divisione resta «a : b» ovunque). */
/** Valore numerico già CALCOLATO: intero → numero; non intero → FRAZIONE
 *  IMPILATA (es. \dfrac{1}{2}), come scritta dall'utente nel verde. I due
 *  punti restano SOLO per le divisioni NON ancora risolte (nodi "div",
 *  stampati dal printNode case "div", NON da qui). */
export function fracToLatex(f: Frac): string {
  if (f.d === 1) return String(f.n);
  const sign = f.n < 0 ? "-" : "";
  return `${sign}\\dfrac{${Math.abs(f.n)}}{${f.d}}`;
}

/** Il nodo è un valore non intero scritto con i due punti (es. 21 : 2)?
 *  In quel caso serve sempre tra parentesi quando è operando di ×, :, ^
 *  (es. «(21 : 2) · x», mai «21 : 2x» che si leggerebbe 21:(2x)). */
export function isColonValue(n: Node): boolean {
  if (n.k === "num") return n.v.d !== 1;
  if (n.k === "term") return n.t.vars.length === 0 && n.t.c.d !== 1;
  return false;
}

/** LaTeX del RISULTATO di un'operazione svolta: interi senza decimali,
 *  valori non interi SEMPRE come frazione impilata (es. «21 : 2 = 21/2
 *  impilata»), MAI come decimale con la virgola (richiesta esplicita
 *  dell'utente 27/9: i risultati si esprimono solo in frazioni impilate). */
export function risultatoLatex(f: Frac): string {
  if (f.d === 1) return String(f.n);
  return fracToLatex(f);
}

/** Risultato di una divisione non esatta (es. 1 : 6): SEMPRE frazione impilata,
 *  MAI decimale con la virgola (richiesta esplicita dell'utente 27/9, valida
 *  anche per l'ultimo calcolo: il parametro withDecimal resta per compatibilità
 *  con le chiamate esistenti ma viene ignorato). */
export function fractionStepLatex(f: Frac, _withDecimal: boolean): string {
  const sign = f.n < 0 ? "-" : "";
  return `${sign}\\dfrac{${Math.abs(f.n)}}{${f.d}}`;
}

/** Decimale in formato italiano (virgola), interi senza decimali */
export function fracToDecimalComma(f: Frac): string {
  const r = Math.round((f.n / f.d) * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  // senza lo zero finale: «10,50» → «10,5» (mai «10,00», già coperto dagli interi)
  return r.toFixed(2).replace(".", ",").replace(/0$/, "");
}

// ─── AST ──────────────────────────────────────────────────────────

export interface Term { c: Frac; vars: { v: string; e: number }[] }

export type Node =
  | { k: "num"; v: Frac; /** decimale SCRITTO dall'utente (es. "2.5"): la trascrizione lo conserva com'è, MAI convertito in frazione (la conversione la fa lo studente) */ dec?: string }
  | { k: "var"; name: string }
  | { k: "term"; t: Term }
  | { k: "add"; a: Node; b: Node }
  | { k: "sub"; a: Node; b: Node }
  | { k: "neg"; a: Node }
  /* (12/11) impl: mul nato da GIUSTAPPOSIZIONE (a^-2b, 2x), senza · esplicito.
   * Serve alla verifica di fedeltà: i fattori giustapposti possono entrare
   * nel numeratore della frazione impilata, quelli con · esplicito no. */
  | { k: "mul"; a: Node; b: Node; impl?: true }
  | { k: "div"; a: Node; b: Node; /** frazione impilata SCRITTA dall'utente (mano/foto): resta \dfrac, mai «a : b» */ fr?: boolean }
  | { k: "pow"; a: Node; e: number }
  // (25/10, punto 2) ESPONENTE FRAZIONARIO (9^(1/2), 16^(3/4)): nodo
  // intermedio che conserva la scrittura originale — reduceOnce lo
  // trasforma in radice con passo SEGNALATO (prima la trasformazione era
  // silenziosa al parse e valeva solo per 1/n).
  | { k: "powfrac"; a: Node; m: number; n: number }
  | { k: "sqrt"; a: Node }
  | { k: "root"; a: Node; n: number }
  /* (12/11) VALORE ASSOLUTO |…|: la radice quadrata di un quadrato perfetto
   * si semplifica RIGOROSAMENTE nel valore assoluto (√((x+3)²) = |x+3|).
   * Il tokenizer prima lanciava «Carattere non riconosciuto: «|»» e il
   * verificatore bocciava passaggi CORRETTI dell'IA («non verificabile con
   * il motore disponibile»): l'esercizio non veniva costruito (foto
   * «ma_cos»). Il nodo non è un polinomio: evalPoly lancia (verifica con
   * sostituzione), il valore numerico usa Math.abs. */
  | { k: "abs"; a: Node }
  | { k: "paren"; a: Node; b?: "[" | "{" }
  | { k: "rat"; num: Term[]; den: Term[] }; // valore RAZIONALE (fratte, giro 21): non proviene mai dall'input

export function term(vars: { v: string; e: number }[], c: Frac): Term {
  // (25/10, punto 1) ammessi anche esponenti NEGATIVI (rappresentazione
  // interna di 1/x² come x^-2): vengono filtrati solo gli esponenti 0.
  // Il rendering (termToLatex) li mostra come frazione impilata.
  const filtered = vars.filter((x) => x.e !== 0).sort((p, q) => (p.v < q.v ? -1 : p.v > q.v ? 1 : p.e - q.e));
  return { c, vars: filtered };
}

export function termKey(t: Term): string {
  return t.vars.map((x) => `${x.v}^${x.e}`).join("*") || "1";
}

/** Grado totale del monomio (0 per le costanti) */
export function termDegree(t: Term): number {
  return t.vars.reduce((s, x) => s + x.e, 0);
}

export function isNumericNode(n: Node): boolean {
  switch (n.k) {
    case "num": return true;
    case "term": return n.t.vars.length === 0;
    case "var": return false;
    case "add": case "sub": case "mul": case "div": return isNumericNode(n.a) && isNumericNode(n.b);
    case "neg": case "paren": return isNumericNode(n.a);
    case "pow": case "powfrac": case "sqrt": case "root": return isNumericNode(n.a);
    case "abs": return isNumericNode(n.a);
    case "rat": return false;
  }
}

function hasOps(n: Node): boolean {
  switch (n.k) {
    case "num": case "var": case "term": return false;
    case "add": case "sub": case "mul": case "div": case "neg": case "pow": case "powfrac": case "sqrt": case "root": case "rat": case "abs": return true;
    case "paren": return hasOps(n.a);
  }
}

function containsParen(n: Node): boolean {
  switch (n.k) {
    case "paren": return true;
    case "num": case "var": case "term": case "rat": return false;
    case "sqrt": case "root": case "abs": return containsParen(n.a);
    default: return containsParen(n.a) || (n.k !== "neg" && n.k !== "pow" && n.k !== "powfrac" ? containsParen((n as any).b) : false);
  }
}

// ─── Polinomi (valutazione esatta) ────────────────────────────────

function polyAddTerm(p: Term[], t: Term): Term[] {
  const key = termKey(t);
  const out = p.map((x) => ({ ...x }));
  const found = out.find((x) => termKey(x) === key);
  if (found) {
    found.c = fAdd(found.c, t.c);
  } else {
    out.push(t);
  }
  return out.filter((x) => !fIsZero(x.c));
}

export function polyAdd(a: Term[], b: Term[]): Term[] { let r = a; for (const t of b) r = polyAddTerm(r, t); return r; }
export function polySub(a: Term[], b: Term[]): Term[] { let r = a; for (const t of b) r = polyAddTerm(r, term(t.vars, fNeg(t.c))); return r; }
export function polyMul(a: Term[], b: Term[]): Term[] {
  let r: Term[] = [];
  for (const ta of a) for (const tb of b) {
    const vars = ta.vars.map((x) => ({ ...x }));
    for (const vb of tb.vars) {
      const f = vars.find((x) => x.v === vb.v);
      if (f) f.e += vb.e; else vars.push({ ...vb });
    }
    r = polyAddTerm(r, term(vars, fMul(ta.c, tb.c)));
  }
  return r;
}

function termMul(a: Term, b: Term): Term {
  // NB: copia PROFONDA degli esponenti: gli oggetti {v,e} non vanno mai mutati,
  // sono condivisi tra termini e nodi dell'albero
  const vars = a.vars.map((x) => ({ ...x }));
  for (const vb of b.vars) {
    const f = vars.find((x) => x.v === vb.v);
    if (f) f.e += vb.e; else vars.push({ ...vb });
  }
  return term(vars, fMul(a.c, b.c));
}

function termPow(a: Term, e: number): Term {
  let r: Term = { c: fr(1), vars: [] };
  for (let i = 0; i < e; i++) r = termMul(r, a);
  return r;
}

/** Radice quadrata ESATTA di un razionale: serve un quadrato perfetto (es. 9, 16, 4/9). */
function sqrtFrac(f: Frac): Frac {
  if (f.n < 0)
    throw new ExprError(
      "Condizione di realtà: il radicando deve essere ≥ 0 — la radice quadrata di un numero negativo non esiste nei numeri reali.",
    );
  const rn = Math.round(Math.sqrt(f.n));
  const rd = Math.round(Math.sqrt(f.d));
  if (rn * rn !== f.n || rd * rd !== f.d) {
    throw new ExprError(
      "La radice non è esatta: l'app svolge solo radici di quadrati perfetti e potenze perfette (es. √9 = 3, √16 = 4, √(1/4) = 1/2…).",
    );
  }
  return fr(rn, rd);
}

/** Radice n-ESIMA ESATTA di un razionale: serve una potenza perfetta (es. ∛8, ∛27, ∜16, ∛(−8)).
 *  Indice PARI: radicando non negativo. (giro 21) */
function nthRootFrac(f: Frac, n: number): Frac {
  const neg = f.n < 0;
  if (neg && n % 2 === 0)
    throw new ExprError(
      `Condizione di realtà: con l'indice PARI (${n}) il radicando deve essere ≥ 0 — non si può fare una radice pari di un numero negativo (es. ∜(−16)).`,
    );
  const an = Math.abs(f.n);
  const rn = Math.round(Math.pow(an, 1 / n));
  const rd = Math.round(Math.pow(f.d, 1 / n));
  if (Math.pow(rn, n) !== an || Math.pow(rd, n) !== f.d) {
    throw new ExprError(`La radice non è esatta: l'app svolge solo radici di potenze perfette (es. ∛8, ∛27, ∜16, ∛(1/8)…).`);
  }
  return fr(neg ? -rn : rn, rd);
}

/** Radice n-esima di un monomio: coefficiente potenza perfetta ed esponenti MULTIPLI dell'indice (es. ∛x³ = x). */
function nthRootTerm(t: Term, n: number): Term {
  const coefficient = nthRootFrac(t.c, n);
  const vars = t.vars.map((x) => {
    if (x.e % n !== 0) throw new ExprError(`La radice ${n}-esima di un monomio serve con esponenti multipli di ${n}.`);
    const e = x.e / n;
    // Radice pari principale: ∜x⁴ è |x|, non x se x può essere negativa.
    if (n % 2 === 0 && Math.abs(e) % 2 === 1) {
      throw new ExprError("Questa radice richiede il valore assoluto o una condizione sul segno della lettera.");
    }
    return { v: x.v, e };
  });
  return term(vars, coefficient);
}

/** Scomposizione in fattori PRIMI con esponenti (es. 12 → [{p:2,e:2},{p:3,e:1}]).
 *  (25/10) serve alla semplificazione MCD di indice ed esponente dei radicali. */
function primeFactorsExp(n: number): Array<{ p: number; e: number }> {
  const out: Array<{ p: number; e: number }> = [];
  if (n === 0) return out;
  let m = Math.abs(n);
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      let e = 0;
      while (m % p === 0) {
        m /= p;
        e++;
      }
      out.push({ p, e });
    }
  }
  if (m > 1) out.push({ p: m, e: 1 });
  return out;
}

/** Riscrittura delle PROPRIETÀ DELLE RADICI (25/10, richiesta esplicita dell'utente
 *  «come per le potenze»): riscritture automatiche SEGNALATE nel detail — i conti
 *  restano SEMPRE allo studente (filosofia scaffolding, passo 2^-2).
 *  Copre:
 *  1) TRASFORMAZIONE RADICALI ↔ POTENZE: ⁿ√(a^m) = a^(m/n) (frazione impilata);
 *  2) SEMPLIFICAZIONE INDICE/ESPONENTE con il MCD: g = MCD(indice, esponenti);
 *  3) PORTARE FUORI dal radicale: ⁿ√(8x⁶) → ⁿ√8 · x^(6/3).
 *  Restituisce il nodo riscritto + il detail (senza risultato), o null.
 *  Lancia l'errore di CONDIZIONE DI REALTÀ se l'indice è pari e il radicando < 0. */
function rootPropRewrite(flat: Term, idx: number): { node: Node; detail: string } | null {
  // CONDIZIONE DI REALTÀ: indice pari → radicando ≥ 0 (prima di ogni riscrittura)
  if (idx % 2 === 0 && flat.c.n < 0) {
    throw new ExprError(
      `Condizione di realtà: con l'indice PARI (${idx}) il radicando deve essere ≥ 0 — la radice di un negativo non esiste nei numeri reali.`,
    );
  }
  const rootLatex = (x: string) => (idx === 2 ? `\\sqrt{${x}}` : `\\sqrt[${idx}]{${x}}`);
  const radicandLatex = rootLatex(termToLatex(flat));
  // MCD tra indice, esponenti delle lettere ed esponenti PRIMI del coefficiente
  let g = idx;
  for (const v of flat.vars) g = gcd(g, v.e);
  for (const pe of [...primeFactorsExp(flat.c.n), ...primeFactorsExp(flat.c.d)]) g = gcd(g, pe.e);
  if (g < 2) return null;
  const newIdx = idx / g;
  if (newIdx === 1) {
    // La radice SVANISCE (ogni esponente è divisibile per l'indice):
    // ⁿ√(a^m) = a^(m/n) con MCD → la potenza ridotta la svolge lo studente.
    // ⚠️ singola lettera con coefficiente 1 (es. ∛(x⁶)): NIENTE riscrittura —
    // il nodo riscritto (x²) avrebbe lo stesso latex del passo successivo e
    // il dedup del driver scarterebbe il passo tiped dello studente. La
    // proprietà si mostra nel detail del passo di svolgimento (rootMcdHint).
    if (flat.vars.length === 1 && flat.c.n === 1 && flat.c.d === 1) return null;
    // Più fattori (coefficiente ≠ 1 o più lettere): PORTO FUORI dal radicale
    // i fattori estraeibili; il COEFFICIENTE resta sotto radice: il suo conto
    // (es. ∛8 = 2) resta uno passo interattivo dello studente.
    const parts: Node[] = [];
    const partsLatex: string[] = [];
    if (flat.c.n !== 1 || flat.c.d !== 1) {
      parts.push(
        idx === 2
          ? { k: "sqrt", a: { k: "term", t: term([], flat.c) } }
          : { k: "root", n: idx, a: { k: "term", t: term([], flat.c) } },
      );
      partsLatex.push(idx === 2 ? `\\sqrt{${fracToLatex(flat.c)}}` : `\\sqrt[${idx}]{${fracToLatex(flat.c)}}`);
    }
    for (const v of flat.vars) {
      const eNew = v.e / idx; // qui g === idx, quindi la divisione è esatta
      parts.push(
        eNew === 1
          ? { k: "term", t: term([{ v: v.v, e: 1 }], fOne) }
          : { k: "pow", a: { k: "term", t: term([{ v: v.v, e: 1 }], fOne) }, e: eNew },
      );
      partsLatex.push(`${v.v}^{\\tfrac{${v.e}}{${idx}}}`);
    }
    let node: Node = parts[0]!;
    for (let i = 1; i < parts.length; i++) node = { k: "mul", a: node, b: parts[i]! };
    return {
      node,
      detail: `\\text{Porto fuori dal radicale (trasformazione in potenza)}: ${radicandLatex} \\Rightarrow ${partsLatex.join(" \\cdot ")}`,
    };
  }
  // SEMPLIFICAZIONE INDICE + ESPONENTI tramite MCD (l'indice resta ≥ 2):
  // ⁿ√(a^m) = a^(m/n), ridotto per MCD → radice con indice più piccolo.
  // ⚠️ anche il COEFFICIENTE va ridotto sui suoi esponenti primi (9 = 3² con
  // g = 2 → 3): altrimenti ∜(9x⁴) diventerebbe √(9x²) invece di √(3x²).
  const buildCoeff = (n: number): number => {
    if (n === 0) return 0;
    const sign = n < 0 ? -1 : 1;
    let out = 1;
    for (const pe of primeFactorsExp(n)) out *= Math.pow(pe.p, pe.e / g);
    return sign * out;
  };
  const reduced = term(
    flat.vars.map((v) => ({ v: v.v, e: v.e / g })),
    fr(buildCoeff(flat.c.n), buildCoeff(flat.c.d)),
  );
  const newRoot: Node =
    newIdx === 2 ? { k: "sqrt", a: { k: "term", t: reduced } } : { k: "root", n: newIdx, a: { k: "term", t: reduced } };
  return {
    node: newRoot,
    detail: `\\text{Semplifico indice ed esponente con il MCD (trasformazione in potenza)}: ${radicandLatex} \\Rightarrow \\sqrt[${newIdx}]{${termToLatex(reduced)}}`,
  };
}

/** Riconosce un nodo RADICALE restituendo indice e radicando (√ = radice di indice 2). */
function asRootNode(x: Node): { idx: number; rad: Node; isSqrt: boolean } | null {
  if (x.k === "root") return { idx: x.n, rad: x.a, isSqrt: false };
  if (x.k === "sqrt") return { idx: 2, rad: x.a, isSqrt: true };
  return null;
}

/** (25/10) PROPRIETÀ DELLE RADICI su × e :: riscritture SEGNALATE (kind
 *  «root-prop», sola notazione) da applicare PRIMA della ricorsione sui
 *  figli di reduceOnce — altrimenti i radicali vengono svolti uno alla
 *  volta e la proprietà non si vede mai.
 *  • PRODOTTO a stesso indice: ⁿ√a · ⁿ√b = ⁿ√(a·b)
 *  • QUOZIENTE a stesso indice: ⁿ√a : ⁿ√b = ⁿ√(a:b)
 *  • PORTARE DENTRO: a · ⁿ√b = ⁿ√(aⁿ · b) (con a ≥ 0 se l'indice è pari) */
function rootPropMulDiv(n: Node): { node: Node; kind: StepKind; detail: string } | null {
  if (n.k !== "mul" && n.k !== "div") return null;
  const ra = asRootNode(n.a);
  const rb = asRootNode(n.b);
  if (ra && rb && ra.idx === rb.idx) {
    const merged: Node = n.k === "mul" ? { k: "mul", a: ra.rad, b: rb.rad } : { k: "div", a: ra.rad, b: rb.rad, fr: false };
    const node: Node = ra.isSqrt ? { k: "sqrt", a: merged } : { k: "root", n: ra.idx, a: merged };
    return {
      node,
      kind: "root-prop",
      detail:
        n.k === "mul"
          ? `\\text{Stesso indice ${ra.idx}: moltiplico i radicandi (proprietà del prodotto)}: ${printNode(n.a)} \\cdot ${printNode(n.b)}`
          : `\\text{Stesso indice ${ra.idx}: divido i radicandi (proprietà del quoziente)}: ${printNode(n.a)} : ${printNode(n.b)}`,
    };
  }
  if (n.k !== "mul") return null;
  // PORTARE DENTRO il radicale: a · ⁿ√b = ⁿ√(aⁿ · b)
  // (condizione di realtà: con indice pari il numero che entra deve essere ≥ 0;
  //  solo numeri SEMPLICI, non espressioni da svolgere)
  const pairs: Array<[Node, { idx: number; rad: Node; isSqrt: boolean } | null]> = [
    [n.a, rb],
    [n.b, ra],
  ];
  for (const [numSide, r] of pairs) {
    if (!r) continue;
    if (numSide.k !== "num" && numSide.k !== "term") continue;
    const numVal = isNumericFlat(numSide);
    if (numVal === null || fIsZero(numVal)) continue;
    if (r.idx % 2 === 0 && numVal.n < 0) continue;
    const powNum: Node = { k: "pow", a: numSide, e: r.idx };
    const inside: Node = numSide === n.a ? { k: "mul", a: powNum, b: r.rad } : { k: "mul", a: r.rad, b: powNum };
    const node: Node = r.isSqrt ? { k: "sqrt", a: inside } : { k: "root", n: r.idx, a: inside };
    const rootLatex = r.isSqrt ? `\\sqrt{${printNode(r.rad)}}` : `\\sqrt[${r.idx}]{${printNode(r.rad)}}`;
    return {
      node,
      kind: "root-prop",
      detail: `\\text{Porto dentro il radicale: } ${printNode(numSide)} \\cdot ${rootLatex} \\Rightarrow ${r.isSqrt ? "\\sqrt" : `\\sqrt[${r.idx}]`}{${printNode(powNum)} \\cdot ${printNode(r.rad)}}`,
    };
  }
  return null;
}

/** (25/10) Memoria dei nodi mul/div già riscritti con la proprietà delle
 *  potenze: al 1º incontro di reduceOnce si emette solo la riscrittura
 *  segnalata (stato invariato), al 2º il risultato finale del segmento. */
const powPropSeen = new WeakSet<object>();

/** (25/10, punto 3) memoria dei nodi pow già riscritti con la proprietà
 *  della potenza di prodotto/quoziente (stesso schema dei due tempi). */
const powProdSeen = new WeakSet<object>();

/** (25/10, punto 4) memoria dei nodi radice di potenza già spiegati
 *  (stesso schema dei due tempi di pow-prop). */
const radPowSeen = new WeakSet<object>();

/** (08/11, potenze simboliche) memoria dei nodi pow già SPIEGATI con la
 *  proprietà della potenza di potenza (stesso schema dei due tempi). */
const powPowSeen = new WeakSet<object>();

/** (08/11, potenze simboliche) potenze NUMERICHE che devono restare
 *  SIMBOLICHE (prodotte da una proprietà in modalità simbolica): il ramo
 *  «pow» di reduceOnce non le svolge più — sono un risultato notazionale,
 *  come un monomio con le lettere. */
const powSimboliche = new WeakSet<object>();

/** (08/11, potenze simboliche) modalità attiva quando l'espressione INTERA
 *  non è calcolabile esattamente (i valori superano 2^53, es. 2^{57}) ed è
 *  fatta solo di potenze a base numerica: le proprietà restano simboliche e
 *  lo studente digita gli ESPONENTI (numeri piccoli). Impostata da
 *  analyzeExpression prima del ciclo di riduzione. */
let modalitaSimbolica = false;

/** (08/11) true se l'AST contiene SOLO nodi di puro calcolo numerico con
 *  potenze a esponente intero (niente lettere, radici, frazioni impilate
 *  scritte come tali sono però ammesse: sono valori): è il dominio della
 *  modalità simbolica delle potenze. */
function isPuraPotenze(n: Node): boolean {
  switch (n.k) {
    case "num":
      return true;
    case "term":
      return n.t.vars.length === 0;
    case "add":
    case "sub":
    case "mul":
    case "div":
      return isPuraPotenze(n.a) && isPuraPotenze((n as { b: Node }).b);
    case "neg":
    case "paren":
      return isPuraPotenze(n.a);
    case "pow":
      return Number.isInteger(n.e) && isPuraPotenze(n.a);
    default:
      return false;
  }
}

/** (08/11, potenze simboliche) true se nel sottoalbero compare una potenza
 *  NUMERICA marcata come simbolica (prodotta da una proprietà in modalità
 *  simbolica): quei punti NON vanno appiattiti in numero (flatTermOf/
 *  evalPoly svolgerebbero 2^{7} → 128 perdendo la forma del libro). */
function contienePowSimbolica(m: Node): boolean {
  if (m.k === "pow" && powSimboliche.has(m)) return true;
  if (m.k === "add" || m.k === "sub" || m.k === "mul" || m.k === "div") {
    return contienePowSimbolica(m.a) || contienePowSimbolica((m as { b: Node }).b);
  }
  if (m.k === "neg" || m.k === "paren" || m.k === "pow" || m.k === "powfrac" || m.k === "sqrt" || m.k === "root") {
    return contienePowSimbolica(m.a);
  }
  return false;
}

/** (08/11) true se lo svolgimento NUMERICO di base^e supera i 2^53 (lì si
 *  ferma l'aritmetica esatta dell'app): attiva la proprietà simbolica della
 *  potenza di potenza anche fuori dalla modalità simbolica. Le basi con
 *  lettere o non piatte → false (non è un problema di dimensioni). */
function potenzaSballa(base: Node, e: number): boolean {
  if (!Number.isInteger(e)) return false;
  try {
    const f = flatTermOf(base);
    if (!f || f.vars.length > 0) return false;
    termPow(f, e);
    return false;
  } catch {
    return true;
  }
}

/** Riduzione completa SENZA emettere passi (l'app calcola da sola): serve
 *  per il risultato finale del segmento pow-prop. Ritorna null se la
 *  riduzione non arriva a numero/monomio (o se incontribile). */
function reduceSilently(n: Node): Node | null {
  let cur = n;
  try {
    for (let i = 0; i < 60; i++) {
      const r = reduceOnce(cur, true, false, false, false);
      if (!r) {
        if (cur.k === "num" || cur.k === "term") return cur;
        // (25/10) il capovolgimento dell'esponente negativo lascia la
        // divisione-notatione 1 : (1/9) come stato finale (il motore NON
        // la svolge: è la frazione impilata mostrata allo studente).
        // Per il risultato del segmento la valutiamo QUI in silenzio:
        // es. 1 : (1/9) = 9 (caso (1/3)^-4 : (1/3)^-2 → 9).
        if (cur.k === "div") {
          const fa = flatTermOf(cur.a);
          const fb = flatTermOf(cur.b);
          if (fa && fb && fa.vars.length === 0 && fb.vars.length === 0 && !fIsZero(fb.c)) {
            return { k: "num", v: fDiv(fa.c, fb.c) };
          }
        }
        return null;
      }
      cur = r.node;
    }
  } catch {
    return null;
  }
  return null;
}

/** (25/10, CORRETTO) FILOSOFIA APP — PROPRIETÀ DELLE POTENZE CON STESSA BASE:
 *  segmento minimo, UN SOLO calcolo finale per lo studente. Invece di
 *  sviluppare le due potenze (con esponenti negativi il capovolgimento
 *  genera frazioni annidate 1/(1/(1/81)), «disastro» segnalato in foto),
 *  l'app riscrive SEGNALANDO che la base resta la stessa e SOTTRAGGENDO
 *  (quoziente: a^m : a^k = a^(m−k), es. (−4)−(−2)) o sommando (prodotto:
 *  a^m · a^k = a^(m+k)) gli ESPONENTI: poi lo studente svolge SOLO
 *  l'ultima potenza semplice. ⚠️ Prima versione usava per errore la
 *  divisione m:k (refuso dell'utente, corretto il 25/10 pomeriggio):
 *  (1/3)⁻⁴ : (1/3)⁻² = (1/3)^(−4−(−2)) = (1/3)⁻² = 9 (NON 1/9!).
 *  Vale per qualunque base (numero, monomio, parentesi/frazione). */
function powPropMulDiv(n: Node): { node: Node; kind: StepKind; detail: string; inParen?: boolean } | null {
  if (n.k !== "mul" && n.k !== "div") return null;
  if (n.a.k !== "pow" || n.b.k !== "pow") return null;
  const ba = n.a.a;
  const bb = n.b.a;
  if (printNode(ba) !== printNode(bb)) return null; // basi diverse → niente
  const m = n.a.e;
  const k = n.b.e;
  const expStr = (v: number) => (v < 0 ? `(${v})` : `${v}`);
  // (25/10, richiesta utente) testo ESATTO della spiegazione, con la base
  // senza parentesi esterne (1/3 impilata, non (1/3)):
  // «Applico le proprietà delle potenze: riscrivo la stessa base 1/3 e poi
  //  eseguo il calcolo degli esponenti (-4) - (-2).»
  const baseLatex = ba.k === "paren" ? printLatex(ba.a) : printLatex(ba);
  const inParen = containsParen(ba);
  if (n.k === "div") {
    // proprietà dei quozienti: SOTTRAZIONE degli esponenti (m − k),
    // sempre intera → nessun caso di esclusione (k = 0 va bene: m − 0 = m).
    const node: Node = { k: "pow", a: ba, e: m - k };
    return {
      node,
      kind: "pow-prop",
      detail: `\\text{Applico le proprietà delle potenze: riscrivo la stessa base } ${baseLatex} \\text{ e poi eseguo il calcolo degli esponenti } ${expStr(m)} - ${expStr(k)}\\text{.}`,
      ...(inParen ? { inParen: true } : {}),
    };
  }
  const node: Node = { k: "pow", a: ba, e: m + k };
  return {
    node,
    kind: "pow-prop",
    detail: `\\text{Applico le proprietà delle potenze: riscrivo la stessa base } ${baseLatex} \\text{ e poi eseguo il calcolo degli esponenti } ${expStr(m)} + ${expStr(k)}\\text{.}`,
    ...(inParen ? { inParen: true } : {}),
  };
}

/** (25/10) Promemoria della TRASFORMAZIONE IN POTENZA quando la radice
 *  svanisce del tutto (MCD = indice): la proprietà si mostra NEL passo di
 *  svolgimento (tiped), perché un passo-riscrittura con latex identico
 *  verrebbe scartato dal dedup del driver. */
function rootMcdHint(flat: Term, idx: number): string | null {
  let g = idx;
  for (const v of flat.vars) g = gcd(g, v.e);
  for (const pe of [...primeFactorsExp(flat.c.n), ...primeFactorsExp(flat.c.d)]) g = gcd(g, pe.e);
  if (g < 2 || idx / g !== 1) return null;
  const parts = flat.vars.map((v) => `${v.v}^{\\tfrac{${v.e}}{${idx}}}`);
  if (flat.c.n !== 1 || flat.c.d !== 1) parts.unshift(fracToLatex(flat.c) + (flat.vars.length ? "^{\\tfrac{1}{" + idx + "}}" : ""));
  return `\\;\\Rightarrow\\;\\text{trasformo in potenza: } ${parts.join(" \\cdot ")}`;
}

/** Radice quadrata di un monomio: coefficiente quadrato perfetto ed esponenti PARI (es. √9x² = 3x). */
function sqrtTerm(t: Term): Term {
  const coefficient = sqrtFrac(t.c);
  const vars = t.vars.map((x) => {
    if (x.e % 2 !== 0) throw new ExprError("La radice di un monomio serve con esponenti pari.");
    const e = x.e / 2;
    // La radice principale di x² è |x|, non x su tutti i numeri reali.
    if (Math.abs(e) % 2 === 1) {
      throw new ExprError("Questa radice richiede il valore assoluto o una condizione sul segno della lettera.");
    }
    return { v: x.v, e };
  });
  return term(vars, coefficient);
}

/** Divisione tra monomi: coefficienti divisi (anche frazione) ed esponenti sottratti.
 *  Proprietà delle potenze: x⁶ : x⁴ = x².
 *  (25/10, punto 1) se serve un esponente NEGATIVO (es. x² : x⁴ = x^-2 = 1/x²)
 *  NON è più un errore: il termine porta l'esponente negativo e il rendering
 *  lo mostra come frazione impilata (termToLatex). */
function termDivide(t: Term, den: Term): Term {
  if (fIsZero(den.c)) throw new ExprError("Non si può dividere per zero!");
  const vars = t.vars.map((x) => ({ ...x }));
  for (const dv of den.vars) {
    const f = vars.find((x) => x.v === dv.v);
    if (f) f.e -= dv.e;
    else vars.push({ v: dv.v, e: -dv.e });
  }
  return term(vars, fDiv(t.c, den.c));
}

export function evalPoly(n: Node): Term[] {
  switch (n.k) {
    case "num": return n.v.n === 0 ? [] : [term([], n.v)];
    case "var": return [term([{ v: n.name, e: 1 }], fOne)];
    case "term": return [n.t];
    case "add": return polyAdd(evalPoly(n.a), evalPoly(n.b));
    case "sub": return polySub(evalPoly(n.a), evalPoly(n.b));
    case "neg": return polySub([], evalPoly(n.a));
    case "mul": return polyMul(evalPoly(n.a), evalPoly(n.b));
    case "div": {
      const den = evalPoly(n.b);
      if (den.length > 1) {
        throw new ExprError("L'app non supporta la divisione tra espressioni con lettere: dividi solo per numeri o monomi.");
      }
      if (den.length === 1 && den[0].vars.length > 0) {
        // divisione tra monomi: coefficienti divisi, esponenti sottratti
        return evalPoly(n.a).map((t) => termDivide(t, den[0]));
      }
      // Un polinomio vuoto rappresenta ZERO, non il denominatore 1.
      if (den.length === 0) throw new ExprError("Non si può dividere per zero!");
      const d = den[0].c;
      if (fIsZero(d)) throw new ExprError("Non si può dividere per zero!");
      return evalPoly(n.a).map((t) => term(t.vars, fDiv(t.c, d)));
    }
    case "sqrt": {
      const p = evalPoly(n.a);
      if (p.length !== 1) throw new ExprError("La radice quadrata si svolge solo su un monomio o su un quadrato perfetto (es. √(x+1)² non è supportata).");
      return [sqrtTerm(p[0])];
    }
    case "root": {
      // (10/11) radice con indice NEGATIVO: resta indicata, mai semplificata
      // (esiste in matematica: ⁻³√a = 1/³√a — lo svolgimento lo fa lo studente)
      if (n.n < 0) throw new ExprError("La radice con indice negativo resta indicata nell'espressione.");
      const p = evalPoly(n.a);
      if (p.length !== 1) throw new ExprError(`La radice ${n.n}-esima si svolge solo su un monomio o su una potenza perfetta (es. ∛(x+1)³ non è supportata).`);
      return [nthRootTerm(p[0], n.n)];
    }
    case "abs":
      // (12/11) VALORE ASSOLUTO: non è un polinomio — la verifica esatta
      // passa dalla SOSTITUZIONE NUMERICA (verificaPerSostituzione), non da qui.
      throw new ExprError("Il valore assoluto non è un polinomio: si verifica con la sostituzione numerica.");
    case "rat":
      // i valori razionali (fratte) esistono solo nel percorso dedicato di lib/fratte.ts
      throw new ExprError("L'app non supporta questa operazione con le frazioni.");
    case "powfrac":
      // (25/10, punto 2) valutazione: (ⁿ√a)^m — stessa forma del flusso a
      // passi; per m = 1 è solo la radice. Serve potenza/radice ESATTA
      // (altrimenti nthRootTerm/sqrtTerm danno errore chiaro).
      return evalPoly(n.m === 1 ? (n.n === 2 ? { k: "sqrt", a: n.a } : { k: "root", n: n.n, a: n.a }) : { k: "pow", a: n.n === 2 ? { k: "sqrt", a: n.a } : { k: "root", n: n.n, a: n.a }, e: n.m });
    case "pow": {
      // (24/10-fix, foto utente: esponenti NEGATIVI mai riconosciuti)
      // Regola delle potenze negative: a^(-n) = 1/(a^n). Il reciproco passa
      // per un nodo div ESPLICITO (1 : base^n), così lo studente lo svolge
      // nel suo punto delle divisioni — MAI calcolato in anticipo.
      if (!Number.isInteger(n.e)) throw new ExprError("Gli esponenti devono essere numeri interi.");
      if (n.e < 0) {
        // a^(-k) = 1 : (a^k): nodo div col denominatore = potenza POSITIVA
        // (oggetto Term[], come vuole evalPoly — NON un oggetto Node).
        const pos: Node = { k: "pow", a: n.a, e: -n.e };
        const den = evalPoly(pos);
        if (den.length > 1) throw new ExprError("La potenza negativa di un'espressione con più termini non è supportata: semplifica prima dentro le parentesi.");
        if (den.length === 1 && den[0].vars.length > 0) {
          // (25/10, punto 1) a^(-k) con LETTERE = 1/(a^k): termine con
          // esponenti negativi (il rendering lo mostra come frazione impilata).
          const t = den[0];
          return [term(t.vars.map((v) => ({ v: v.v, e: -v.e })), fDiv(fOne, t.c))];
        }
        if (den.length === 0) throw new ExprError("Non si può dividere per zero!");
        const d = den[0].c;
        if (fIsZero(d)) throw new ExprError("Non si può dividere per zero!");
        return [term([], fDiv(fOne, d))];
      }
      const base = evalPoly(n.a);
      if (n.e === 0 && base.length === 0) throw new ExprError("Zero elevato a zero non è definito.");
      // (24/10) tetto anti-esplosione: lo sviluppo di una somma a potenza n
      // ha al massimo base.length^n termini — oltre 500 diventa ingestibile
      // (i monomi singoli non esplodono mai: nessuno sviluppo)
      if (base.length > 1) {
        const est = Math.pow(base.length, n.e);
        if (!Number.isFinite(est) || est > 500) throw new ExprError("Esponente troppo grande per sviluppare questa parentesi: semplifica prima i termini dentro.");
      }
      if (n.e > 99) throw new ExprError("Esponente troppo grande: l'app lavora con esponenti fino a 99.");
      let r: Term[] = [term([], fOne)];
      for (let i = 0; i < n.e; i++) r = polyMul(r, base);
      return r;
    }
    case "paren": return evalPoly(n.a);
  }
}

export class ExprError extends Error {}

/** Il nodo è un monomio "piatto" (niente parentesi, al più un termine)? */
function flatTermOf(n: Node): Term | null {
  if (containsParen(n)) return null;
  try {
    const p = evalPoly(n);
    return p.length === 1 ? p[0] : null;
  } catch { return null; }
}

export function isNumericFlat(n: Node): Frac | null {
  if (containsParen(n)) return null;
  const p = (() => { try { return evalPoly(n); } catch { return null; } })();
  if (!p) return null;
  if (p.length === 0) return fZero;
  if (p.length === 1 && p[0].vars.length === 0) return p[0].c;
  return null;
}

// ─── Normalizzazione input (testo digitato o LaTeX dal riconoscimento) ───

const SUP_MAP: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};

/** Risultato finale di un'espressione NUMERICA non intera: SOLO frazione
 *  impilata (es. "\\dfrac{9}{5}"), MAI decimale con la virgola (richiesta
 *  esplicita dell'utente 27/9). Le riduzioni intermedie restano invariate.
 *  Restituisce null se il risultato è intero/zero o se ci sono variabili. */
export function fractionResultLatex(poly: Term[]): string | null {
  if (poly.length !== 1) return null;
  const t = poly[0];
  if (t.vars.length !== 0) return null;
  if (t.c.d === 1 || t.c.n === 0) return null;
  const sign = t.c.n < 0 ? "-" : "";
  return `${sign}\\dfrac{${Math.abs(t.c.n)}}{${t.c.d}}`;
}

/** Sostituisce \frac{a}{b} (con parentesi graffe annidate) con a/b.
 *  Parentesi aggiunte SOLO se servono (argomento con + o −): così
 *  \frac{21}{2} → 21/2 senza parentesi inutili (niente «(((21)))»). */
function replaceLatexFractions(s: string, preservaFrazioniComplesse = false): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const m = /^\\[dt]?frac\s*/.exec(s.slice(i));
    if (m) {
      let j = i + m[0].length;
      const readGroup = (): string | null => {
        while (s[j] === " ") j++;
        if (s[j] !== "{") {
          // argomento a carattere singolo, es. \frac12
          const ch = s[j];
          if (ch && /[0-9a-zA-Z]/.test(ch)) { j++; return ch; }
          return null;
        }
        let depth = 0;
        const start = ++j;
        while (j < s.length) {
          if (s[j] === "{") depth++;
          else if (s[j] === "}") {
            if (depth === 0) return s.slice(start, j++);
            depth--;
          }
          j++;
        }
        return null;
      };
      const num = readGroup();
      const den = num !== null ? readGroup() : null;
      if (num !== null && den !== null) {
        /* (26/10-fix2, foto utente «(2ab)^-1·4ab+(1/2)^-2-4ab-4 non si
           costruisce»): wrap SOLO +- NON basta. \dfrac{4ab}{2ab} → «4ab⁄2ab»
           veniva letto 4·a·(b⁄2)·a·b = 2a²b² invece di 2: l'operatore ⁄
           lega solo il fattore adiacente, mentre le graffe delimitano
           l'operando INTERO. Parentesi quando il gruppo ha QUALSIASI
           carattere oltre a lettere/cifre concatenate: \dfrac{4ab}{2ab}
           → (4ab)⁄(2ab) NON BASTA comunque: ⁄ continua a legare solo
           l'atomo adiacente anche dopo parentesi. I gruppi NON atomici
           (4ab, 6x^2, x+1) diventano una DIVISIONE VERA con parentesi
           «(4ab)/(2ab)» = 2 ✓; i gruppi atomici (12, ab, x) restano A⁄B:
           è la convenzione delle frazioni impilate della notazione
           dell'app (il parser li legge come frazione atomica, 12⁄34). */
        /* atomico = UN NUMERO (anche multidigit: 12) o UNA SOLA LETTERA:
           «4ab» è 4·a·b (coefficiente × lettere), NON un atomo. */
        const numCompleto = replaceLatexFractions(num, preservaFrazioniComplesse);
        const denCompleto = replaceLatexFractions(den, preservaFrazioniComplesse);
        const atomico = (v: string) => /^[0-9]+$/.test(v) || /^[a-zA-Z]$/.test(v);
        const frazione = atomico(numCompleto) && atomico(denCompleto)
          ? `${numCompleto}\u2044${denCompleto}`
          : preservaFrazioniComplesse
            // Nel costruttore di righe progressive le parentesi delimitano
            // interamente numeratore e denominatore: ⁄ conserva il metadato
            // «frazione impilata» senza alterare il valore dell'operazione.
            ? `(${numCompleto})\u2044(${denCompleto})`
            : `(${numCompleto})/(${denCompleto})`;
        // L'esponente dopo \frac riguarda l'INTERA frazione, non solo il denominatore.
        out += /^\s*\^/.test(s.slice(j)) ? `(${frazione})` : frazione;
        i = j;
        continue;
      }
      out += m[0];
      i += m[0].length;
      continue;
    }
    out += s[i];
    i++;
  }
  return out;
}

/* (09/11, foto «indici diversi») APICI SUPERSCRIPT per gli indici alti:
 * ⁰¹²³⁴⁵⁶⁷⁸⁹ (¹²³ sono Latin-1, gli altri U+207x). Passano il controllo
 * dei caratteri e il tokenizer li legge SOLO davanti a √ (⁶√ → radice
 * sesta); un apice isolato dà un messaggio che rimanda al simbolo ^. */
const SUP_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** \sqrt[n]{X} con GRAFFE BILANCIATE → √/∛/∜(X) oppure ˢ√(X) per n 5..12
 *  (il m.c.m. tra 3 e 4 è 12). Il radicando contiene frazioni e potenze:
 *  la vecchia regex «senza graffe interne» non bastava. \sqrt senza graffe
 *  resta √ (comportamento precedente). */
function sostituisciRadiciIndice(s: string): string {
  for (;;) {
    const i = s.indexOf("\\sqrt");
    if (i < 0) return s;
    let j = i + 5;
    let n = 2;
    if (s[j] === "[") {
      const ch = s.indexOf("]", j);
      if (ch < 0) return s; /* indice mai chiuso: lo segnala il tokenizer */
      const idx = s.slice(j + 1, ch).trim();
      // (10/11, richiesta utente) anche indice NEGATIVO (es. \sqrt[-3]{8}):
      // esiste in matematica e va AMMESSO, non corretto né scambiato per
      // la barretta del periodico.
      const negativo = idx.startsWith("-");
      const assoluto = negativo ? idx.slice(1) : idx;
      /* (12/11) 1–2 cifre: indici 2..99 ammessi (anche negativi). Oltre, o
       * indice 0/1, messaggio CHIARO — prima la stringa restava intatta e il
       * tokenizer rispondeva «caratteri che non riconosco», troppo vago. */
      if (!/^\d{1,2}$/.test(assoluto) || (parseInt(assoluto, 10) < 2)) {
        throw new ExprError(`Indice di radice non valido: l'app supporta indici da 2 a 99, anche negativi (es. √, ∛, ∜, ⁶√, ⁻³√).`);
      }
      n = parseInt(assoluto, 10) * (negativo ? -1 : 1);
      j = ch + 1;
    }
    if (s[j] !== "{") {
      s = s.slice(0, i) + "√" + s.slice(j);
      continue;
    }
    let prof = 0;
    let k = j;
    for (; k < s.length; k++) {
      if (s[k] === "{") prof++;
      else if (s[k] === "}") {
        prof--;
        if (prof === 0) break;
      }
    }
    if (k >= s.length) return s; /* graffa non chiusa: errore a valle */
    const arg = s.slice(j + 1, k);
    const apiceIndice = (v: number): string => [...String(v)].map((d) => SUP_DIGITS[+d]).join("");
    const simbolo =
      n === 2 ? "√"
      : n === 3 ? "∛"
      : n === 4 ? "∜"
      : n >= 5 && n <= 99 ? apiceIndice(n) + "√"
      : n <= -2 && n >= -99 ? "\u207B" + apiceIndice(-n) + "√"
      : null;
    if (simbolo === null) {
      throw new ExprError(`Radici di indice ${n} non supportate: l'app supporta indici da 2 a 99, anche negativi (es. √, ∛, ∜, ⁶√, ⁻³√).`);
    }
    s = s.slice(0, i) + `${simbolo}(${arg})` + s.slice(k + 1);
  }
}

/** Converte LaTeX o testo libero in una stringa tokenizzabile */
export function normalizeInput(raw: string, preservaFrazioniComplesse = false): string {
  let s = raw.trim();
  if (!s) throw new ExprError("Scrivi un'espressione (es. 2x + 3y − (x − y)).");

  // Se c'è un "=" l'espressione è la parte sinistra (o destra se sinistra vuota)
  const eqIdx = s.indexOf("=");
  if (eqIdx !== -1) {
    const left = s.slice(0, eqIdx).trim();
    const right = s.slice(eqIdx + 1).trim();
    s = left || right;
  }

  // «2{,}5» (forma LaTeX del decimale) = «2,5»
  s = s.replace(/(\d)\s*\{,\}\s*(\d)/g, "$1,$2");

  s = s
    .replace(/\$/g, "")
    .replace(/\\left|\\right|\\displaystyle|\\,|\\;|\\:|\\!|\\quad|\\qquad/g, "")
    .replace(/\\cdot|\\times|\\bullet/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\[dt]?frac/g, "\\frac");

  s = replaceLatexFractions(s, preservaFrazioniComplesse);

  // Potenze LaTeX: ^{3} → ^3 ; ^{2}x ecc.
  s = s.replace(/\^\s*\{([^{}]*)\}/g, (_, g) => "^(" + g + ")");

  // Apici unicode
  // Una sequenza di apici è un solo esponente: x¹⁰ = x^10, non (x^1)^0.
  // (10/11) MA la sequenza seguita da √ è l'INDICE di una radice (⁵√, ⁻³√):
  // resta tale e il tokenizer la legge come indice (anche negativo).
  s = s.replace(/(⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)(√?)/g, (_m, apici: string, rad: string) =>
    rad === "√"
      ? apici + rad
      : "^" + [...apici].map((c) => c === "⁻" ? "-" : SUP_MAP[c]).join(""),
  );

  // (26/10-fix) Frazioni unicode a carattere unico: l'IA vision (e talvolta
  // gli OCR) scrivono ¼ invece di 1⁄4 — senza questa mappa l'espressione
  // letteraria della foto dell'utente non era valutabile e la costruzione
  // falliva 3 volte. Le convertiamo nella forma atomica 1⁄4 (U+2044),
  // già gestita dal tokenizer con la convenzione scolastica giusta.
  s = s
    .replace(/¼/g, "1\u20444")
    .replace(/½/g, "1\u20442")
    .replace(/¾/g, "3\u20444")
    .replace(/⅓/g, "1\u20443")
    .replace(/⅔/g, "2\u20443")
    .replace(/⅙/g, "1\u20446")
    .replace(/⅚/g, "5\u20446")
    .replace(/⅛/g, "1\u20448")
    .replace(/⅜/g, "3\u20448")
    .replace(/⅝/g, "5\u20448")
    .replace(/⅞/g, "7\u20448");

  // Simboli unicode
  s = s
    .replace(/[−–—]/g, "-")
    .replace(/[×·⋅•∗]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/[⟨⟩“”„«»]/g, "");

  // ⚠️ RADICI QUADRATE: ora SUPPORTATE (quadrati perfetti e monomi con
  // esponenti pari). OCR e riconoscimento scrivono spesso √ come «V»/«v»:
  // una v/V seguita da cifra o parentesi è una radice (es. «V9» → √9).
  s = s.replace(/[vV](?=[0-9(])/g, "√");

  // ⚠️ PARENTESI QUADRE E GRAFFE: NON si convertono MAI in tonde (richiesta
  // esplicita dell'utente). La parentesi scritta dallo studente deve restare
  // quella trascritta. Quadre [ ] e graffe { } (anche \{ \} LaTeX) passano
  // al tokenizer come parentesi con tipo, e il print le rispetta.
  // anche \lbrace \rbrace (vocabolario alternativo del modello)
  s = s
    .replace(/\\lbrace/g, "{")
    .replace(/\\rbrace/g, "}")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}");

  // RADICI di indice n (giro 21): \sqrt[3]{8} → ∛(8), \sqrt[4]{16} → ∜(16);
  // (09/11, foto «indici diversi») anche indici 5..12: ⁵√ … ¹²√ — servono
  // alla riduzione degli radicali allo STESSO INDICE (m.c.m. tra 2 e 3 = 6).
  // (12/11) dal 13 al 99 si continua senza errori: il tetto 12 era solo il
  // m.c.m. tra 3 e 4 e bloccava a torto indici legittimi.
  // Scansione con GRAFFE BILANCIATE: il radicando contiene frazioni e
  // potenze, quindi la vecchia regex «senza graffe interne» non bastava.
  s = sostituisciRadiciIndice(s);

  /* (09/11, foto «decimali periodici») NUMERI PERIODICI — tre notazioni
   * equivalenti vengono riconosciute e convertite in un MARCATORE interno:
   *  - LaTeX:   1,\overline{3}  oppure 1,\bar{3}  (anche 1{,}\overline{3})
   *  - unicode: 1,3\u0304 (macron combinante dopo le cifre che si ripetono)
   * Il marcatore è  intera.<non-ripetute>\u00A4<ripetute>\u00A7 : il
   * tokenizer legge il valore ESATTO come frazione (es. 1,3\u0304 = 4/3)
   * e conserva la scritta originale nel campo dec (trascrizione fedele,
   * MAI convertita in frazione: la conversione la fa lo studente). */
  s = s
    .replace(/(\d+)\{,\}(\d*)\s*\\(?:overline|bar)\s*\{(\d+)\}/g, "$1,$2\\overline{$3}")
    .replace(/(\d+)\{,\}\s*\\(?:overline|bar)\s*\{(\d+)\}/g, "$1,\\overline{$2}");
  s = s.replace(/(\d+),(\d*)\\(?:overline|bar)\s*\{(\d+)\}/g,
    (_m, i: string, nr: string, rp: string) => `${i}.${nr}\u00A4${rp}\u00A7`);
  s = s.replace(/(\d+),((?:\d[\u0304\u0305])+)/g,
    (_m, i: string, rp: string) => `${i}.\u00A4${rp.replace(/[\u0304\u0305]/g, "")}\u00A7`);
  s = s.replace(/(\d+),(\d*)((?:\d[\u0304\u0305])+)/g,
    (_m, i: string, nr: string, rp: string) => `${i}.${nr}\u00A4${rp.replace(/[\u0304\u0305]/g, "")}\u00A7`);

  s = s.replace(/\s+/g, "").toLowerCase();

  // Virgola decimale tra cifre → punto
  s = s.replace(/(\d),(\d)/g, "$1.$2");

  // Caratteri ammessi
  // ⚠️ anche [ ] { } sono parentesi legittime (restano quelle scritte dall'utente)
  // (10/11) \u207B = apice del SEGNO MENNO dell'indice di radice (⁻³√)
  // (12/11) anche «|» del VALORE ASSOLUTO (es. |x+3|): la barra apre e
  // chiude con lo stesso carattere, la coppia la controlla il parser.
  if (!/^[0-9a-z√∛∜⁰¹²³⁴⁵⁶⁷⁸⁹\u207B+\-*/\u2044^().\[\]{}\u00A4\u00A7|]+$/.test(s)) {
    throw new ExprError("Ci sono caratteri che non riconosco: usa solo numeri, lettere, +, −, ·, :, parentesi e potenze.");
  }
  if (!/\d|[a-z]/.test(s)) throw new ExprError("Scrivi un'espressione (es. 2x + 3y − (x − y)).");

  return s;
}

// ─── Tokenizer ────────────────────────────────────────────────────

type Tok =
  | { t: "num"; v: Frac; dec?: string }
  | { t: "letter"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "\u2044" | "^" }
  | { t: "sqrt" }
  | { t: "root"; n: number }
  | { t: "bar" }
  | { t: "lparen"; b?: "[" | "{" }
  | { t: "rparen"; b?: "[" | "{" };

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\d|\.|\u00A4|\u00A7/.test(c)) {
      let j = i;
      while (j < s.length && /[\d.\u00A4\u00A7]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      /* (09/11) NUMERI PERIODICI con marcatore \u00A4 (inizio ripetizione)
       * e \u00A7 (fine): intera.<nr>\u00A4<r>\u00A7 → frazione ESATTA
       * (intera.nr r ripetuto = (cifre(intera·nr·r) − cifre(intera·nr)) /
       * (10^(len) − 10^len(nr))) e scritta originale conservata in dec. */
      if (raw.includes("\u00A4") || raw.includes("\u00A7")) {
        if (!/^\d*(?:\.\d*\u00A4\d+\u00A7|\.\u00A4\d+\u00A7)$/.test(raw)) {
          throw new ExprError("Numero periodico non valido: «" + raw + "».");
        }
        const [intera = "0", resto = ""] = raw.split(".");
        const [nonRep = "", rep = ""] = resto.replace(/\u00A7$/, "").split("\u00A4");
        if (!rep) throw new ExprError("Numero periodico non valido: «" + raw + "».");
        if (nonRep.length + rep.length > 9) {
          throw new ExprError("Numero periodico con troppe cifre per un calcolo esatto.");
        }
        const cifreIntera = intera === "0" && !nonRep ? "" : intera;
        const sopra = Number((cifreIntera || "") + nonRep + rep);
        const sotto = Number((cifreIntera || "") + nonRep);
        const den = 10 ** (nonRep.length + rep.length) - 10 ** nonRep.length;
        if (!Number.isSafeInteger(sopra) || !Number.isSafeInteger(den)) {
          throw new ExprError("Numero periodico troppo grande per un calcolo esatto.");
        }
        toks.push({ t: "num", v: fr(sopra - sotto, den), dec: `${intera},${nonRep}\\overline{${rep}}` });
        i = j;
        continue;
      }
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) throw new ExprError("Numero non valido: «" + raw + "».");
      // Il decimale è letto dai suoi DIGIT come frazione esatta: 0,1=1/10,
      // non il valore binario approssimato di parseFloat(0.1).
      const [intera = "0", decimale = ""] = raw.split(".");
      const num = Number((intera || "0") + decimale);
      const den = 10 ** decimale.length;
      if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den)) {
        throw new ExprError("Numero troppo grande o con troppe cifre decimali per un calcolo esatto.");
      }
      toks.push({ t: "num", v: fr(num, den), ...(raw.includes(".") ? { dec: raw.startsWith(".") ? "0" + raw : raw } : {}) });
      i = j;
      continue;
    }
    if (/[a-z]/.test(c)) { toks.push({ t: "letter", v: c }); i++; continue; }
    if (c === "√") { toks.push({ t: "sqrt" }); i++; continue; }
    if (c === "∛") { toks.push({ t: "root", n: 3 }); i++; continue; }
    if (c === "∜") { toks.push({ t: "root", n: 4 }); i++; continue; }
    // (09/11) RADICI DI INDICE ALTO: ⁶√ → root n=6. (12/11) l'app ammette
    // QUALSIASI indice da 2 a 99, anche negativo: il vecchio tetto 12 (il
    // m.c.m. tra 3 e 4) bloccava a torto indici legittimi come ¹³√. L'apice
    // è valido SOLO davanti a √: isolato, messaggio che rimanda alla
    // scrittura con ^ (es. x^2).
    // (10/11) anche indice NEGATIVO: ⁻³√ → root n = -3 (esiste in matematica)
    if (SUP_DIGITS.includes(c) || c === "\u207B") {
      let apice = "";
      let k = i;
      if (c === "\u207B") {
        apice = "-";
        k++;
        if (!SUP_DIGITS.includes(s[k])) {
          throw new ExprError("Apice non riconosciuto: ⁻ va seguito dalle cifre dell'indice della radice (es. ⁻³√).");
        }
      }
      while (k < s.length && SUP_DIGITS.includes(s[k])) {
        apice += String(SUP_DIGITS.indexOf(s[k]));
        k++;
      }
      if (s[k] !== "√") {
        throw new ExprError("Apice non riconosciuto: per le potenze usa il simbolo ^ (es. x^2); gli apici ⁵√…⁹⁹√ e ⁻³√ servono solo agli indici delle radici.");
      }
      const n = parseInt(apice, 10);
      if (n < 0 ? n < -99 : n < 5 || n > 99) throw new ExprError("Indice di radice non valido: l'app supporta indici da 2 a 99, anche negativi (es. ⁻³√).");
      toks.push({ t: "root", n });
      i = k + 1;
      continue;
    }
    // (12/11) VALORE ASSOLUTO: «|» apre e chiude (la coppia la controlla il
    // parser; dentro si legge un'intera espressione, anche con segni).
    if (c === "|") { toks.push({ t: "bar" }); i++; continue; }
    if (c === "(") { toks.push({ t: "lparen" }); i++; continue; }
    if (c === ")") { toks.push({ t: "rparen" }); i++; continue; }
    // Quadre e graffe = parentesi con tipo (restano quelle dell'utente)
    if (c === "[" || c === "{") { toks.push({ t: "lparen", b: c }); i++; continue; }
    if (c === "]" || c === "}") { toks.push({ t: "rparen", b: c === "]" ? "[" : "{" }); i++; continue; }
    if (c === "+" || c === "-" || c === "*" || c === "/" || c === "\u2044" || c === "^") {
      toks.push({ t: "op", v: c as any }); i++; continue;
    }
    throw new ExprError("Carattere non riconosciuto: «" + c + "»");
  }
  return toks;
}

// ─── Parser (discesa ricorsiva, mantiene le Paren) ────────────────

class Parser {
  private pos = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok | undefined { return this.toks[this.pos]; }
  private next(): Tok | undefined { return this.toks[this.pos++]; }

  parse(): Node {
    const n = this.parseExpr();
    if (this.pos < this.toks.length) {
      const t = this.peek()!;
      if (t.t === "rparen") throw new ExprError("C'è una parentesi chiusa di troppo: controlla le parentesi.");
      if (t.t === "num" || t.t === "letter" || t.t === "lparen") {
        throw new ExprError("Manca un'operazione tra due termini: controlla segni e «·».");
      }
      throw new ExprError("Espressione incompleta: controlla segni e parentesi.");
    }
    return n;
  }

  private parseExpr(): Node {
    // segno iniziale
    let node: Node | null = null;
    let neg = false;
    while (this.peek()?.t === "op" && ((this.peek() as any).v === "+" || (this.peek() as any).v === "-")) {
      const op = (this.next() as any).v as "+" | "-";
      if (op === "-") neg = !neg;
    }
    node = this.parseTerm();
    if (neg) node = node.k === "term" ? { k: "term", t: term(node.t.vars, fNeg(node.t.c)) } : { k: "neg", a: node };

    while (this.peek()?.t === "op" && ((this.peek() as any).v === "+" || (this.peek() as any).v === "-")) {
      const op = (this.next() as any).v as "+" | "-";
      const rhs = this.parseTerm();
      node = op === "+" ? { k: "add", a: node, b: rhs } : { k: "sub", a: node, b: rhs };
    }
    return node;
  }

  private parseTerm(): Node {
    let node = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t?.t === "op" && (t.v === "*" || t.v === "/")) {
        this.next();
        let rhs = this.parseUnary();
        if (t.v === "/") {
          // ⚠️ CONVENZIONE SCOLASTICA: dopo «:» il divisore è l'INTERO monomio
          // giustapposto (6x⁵ : 2x² = 3x³, proprietà dei quozienti) — non
          // solo la prima cifra. Le parentesi restano fuori (6 : 2(x+1)).
          // (26/10-fix) il divisore si estende anche quando inizia con una
          // frazione NUMERICA tra parentesi, es. 4ab²c : (1/4)bc = 16ab:
          // prima il ciclo si fermava subito (flatTermOf di una parentesi è
          // null) e le lettere restanti «bc» rendevano l'espressione non
          // valutabile — è il fallimento sulla foto dell'espressione
          // letteraria dell'utente.
          const divisoreEstendibile =
            flatTermOf(rhs) !== null ||
            (rhs.k === "div" && rhs.fr === true) ||
            (rhs.k === "paren" && isNumericFlat((rhs as { a: Node }).a) !== null);
          /* (10/11, foto «non mi costruisce l'esercizio») il monomio giustapposto
           * include anche le RADICI: «2√2 : 4√2» e «A : \dfrac{7}{30}∛u» prima
           * lasciavano la radice NON consumata → espressione non valida → box
           * finale «non verificabile». Le parentesi restano fuori (6 : 2(x+1)),
           * come sopra. */
          while (
            (this.peek()?.t === "letter" || this.peek()?.t === "sqrt" || this.peek()?.t === "root") &&
            divisoreEstendibile
          ) {
            /* parseUnary (non parsePower): parseAtom non riconosce i token di
             * radice e fallisce su «4∛(2)» come divisore */
            rhs = { k: "mul", a: rhs, b: this.parseUnary() };
          }
        }
        node = t.v === "*" ? { k: "mul", a: node, b: rhs } : { k: "div", a: node, b: rhs };
        continue;
      }
      // moltiplicazione implicita: numero/lettera/parentesi seguiti da lettera/parentesi/numero
      // (ma non numero→numero: «2 3» è un errore, ci vuole l'operatore)
      // un nodo che è già un monomio (es. 2x), una parentesi, oppure un
      // PRODOTTO già chiuso (es. 2(3) seguito da (4): «2(3)(4)», caso della
      // foto giro 36) "chiude" il fattore e la catena continua
      // (12/11-punto 3) anche abs: |x+2|(x−1) è una moltiplicazione implicita
      const prevEndsFactor = node.k === "paren" || node.k === "mul" || node.k === "sqrt" || node.k === "root" || node.k === "pow" || node.k === "powfrac" || node.k === "abs" || (node.k === "div" && node.fr === true) || flatTermOf(node) !== null;
      const nextStartsFactor = t && (t.t === "letter" || t.t === "lparen" || t.t === "num" || t.t === "sqrt" || t.t === "root" || t.t === "bar");
      const numToNum = (node.k === "num" || node.k === "term") && t?.t === "num";
      if (prevEndsFactor && nextStartsFactor && !numToNum) {
        const rhs = this.parseUnary();
        /* (12/11) impl: giustapposizione, nessun · esplicito fra i fattori */
        node = { k: "mul", a: node, b: rhs, impl: true };
        continue;
      }
      break;
    }
    return node;
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (t?.t === "op" && t.v === "-") { this.next(); const n = this.parseUnary(); return n.k === "term" ? { k: "term", t: term(n.t.vars, fNeg(n.t.c)) } : { k: "neg", a: n }; }
    if (t?.t === "op" && t.v === "+") { this.next(); return this.parseUnary(); }
    // RADICE QUADRATA: si lega all'intero monomio che segue, con potenze e
    // lettere giustapposte (√9x² = √(9x²) = 3x, convenzione del libro di testo)
    if (t?.t === "sqrt") {
      this.next();
      // (25/10, punto 4) operand con parseUnary (non parsePower): altrimenti
      // √√16 (radice annidata) dava «Espressione non valida»
      // Un radicando tra parentesi è già delimitato: una lettera DOPO la
      // parentesi chiusa è un fattore esterno, non fa parte della radice.
      // La convenzione √9x² (senza parentesi) resta invece invariata.
      const radicandoDelimitato = this.peek()?.t === "lparen";
      let operand = this.parseUnary();
      while (!radicandoDelimitato && this.peek()?.t === "letter") operand = { k: "mul", a: operand, b: this.parsePower() };
      return { k: "sqrt", a: operand };
    }
    // RADICE CUBICA (∛) e QUARTA (∜): stessa convenzione della √, si lega
    // all'intero monomio che segue (es. ∛8x³ = 2x). (giro 21)
    if (t?.t === "root") {
      this.next();
      // (25/10, punto 4) parseUnary anche qui: ∛∛27 e ∛√… annidati
      // Anche per indici negativi e superiori a 12, il delimitatore indica
      // esattamente dove termina il radicando, come la barra del libro.
      const radicandoDelimitato = this.peek()?.t === "lparen";
      let operand = this.parseUnary();
      while (!radicandoDelimitato && this.peek()?.t === "letter") operand = { k: "mul", a: operand, b: this.parsePower() };
      return { k: "root", a: operand, n: t.n };
    }
    return this.parsePower();
  }

  private parsePower(): Node {
    let base = this.parseAtom();
    while (this.peek()?.t === "op" && (this.peek() as any).v === "^") {
      this.next();
      const t = this.next();
      let e: number;
      if (!t) throw new ExprError("Manca l'esponente dopo il simbolo ^.");
      // (24/10-fix, foto utente: esponenti NEGATIVI mai riconosciuti — il
      // tokenizer non emette mai «num» negativi, quindi il «-» dopo ^ va
      // letto QUI come segno dell'esponente: x^-2 → e=-2, svolto come
      // reciproco 1/(x^2). Dopo ^ un «-» può essere SOLO il segno
      // (un meno binario non può seguire ^), quindi si consuma in sicurezza.
      if (t.t === "op" && t.v === "-") {
        const u = this.next();
        if (!u) throw new ExprError("Manca l'esponente dopo il simbolo ^.");
        if (u.t === "num") {
          if (u.v.d !== 1 || u.v.n < 1 || u.v.n > 99) throw new ExprError("Gli esponenti devono essere numeri interi da -99 a 99 (es. x^-2).");
          e = -u.v.n;
        } else if (u.t === "lparen") {
          const inner = this.parseExpr();
          const rp = this.next();
          if (!rp || rp.t !== "rparen" || rp.b !== u.b) throw new ExprError("Parentesi dell'esponente non chiusa o di tipo diverso.");
          const val = isNumericFlat(inner);
          if (val === null || val.d !== 1 || Math.abs(val.n) < 1 || Math.abs(val.n) > 99) throw new ExprError("Gli esponenti devono essere numeri interi da -99 a 99.");
          e = -Math.abs(val.n);
        } else {
          throw new ExprError("Esponente non valido: usa un numero intero (es. x^2, x^-2).");
        }
      } else if (t.t === "num") {
        // (24/10) esponenti fino a 99: niente tetto artificiale a 9
        if (t.v.d !== 1 || t.v.n < 0 || t.v.n > 99) throw new ExprError("Gli esponenti devono essere numeri interi da 0 a 99.");
        e = t.v.n;
      } else if (t.t === "lparen") {
        const inner = this.parseExpr();
        const rp = this.next();
        if (!rp || rp.t !== "rparen" || rp.b !== t.b) throw new ExprError("Parentesi dell'esponente non chiusa o di tipo diverso.");
        const val = isNumericFlat(inner);
        // (25/10, punto 2) ESPONENTE FRAZIONARIO = RADICE, con passo
        // SEGNALATO (nodo powfrac → reduceOnce): 9^(1/2) → √9, 16^(3/4) →
        // (∜16)³ — prima la trasformazione era silenziosa e solo 1/n.
        if (val !== null && val.n >= 1 && val.n <= 99 && val.d >= 2 && val.d <= 9) {
          base = { k: "powfrac", a: base, m: val.n, n: val.d };
          continue;
        }
        // esponente frazionario NEGATIVO: messaggio chiaro (l'app non lo
        // svolge: si riscrive col libro capovolgendo la base)
        if (val !== null && val.n < 0 && val.d >= 2) {
          throw new ExprError("Esponente frazionario negativo non supportato: riscrivi col libro capovolgendo la base (es. (1/9)^(-1/2) = 9^(1/2)).");
        }
        // (24/10-fix) esponente negativo tra parentesi: 2^(-2) → e=-2
        if (val === null || val.d !== 1 || Math.abs(val.n) > 99) throw new ExprError("Gli esponenti devono essere numeri interi da -99 a 99 (oppure frazioni m/n per le radici: 9^(1/2), 16^(3/4)).");
        e = val.n;
      } else {
        throw new ExprError("Esponente non valido: usa un numero intero (es. x^2).");
      }
      base = { k: "pow", a: base, e };
    }
    // (7/10) frazione impilata scritta dall'utente («a⁄b» da \frac{a}{b}):
    // lega al fattore che segue, PIÙ STRETTAMENTE di · e :, così
    // «2⁄3·3⁄4» è (2:3)·(3:4) e si stampa \dfrac{2}{3}·\dfrac{3}{4}
    if (this.peek()?.t === "op" && (this.peek() as any).v === "\u2044") {
      this.next();
      // (12/11-fix, richiesta utente «fai entrambe» / foto valore_assoluto):
      // il denominatore di una frazione impilata può essere UNA RADICE
      // (es. (√(x²+6x+9)+∛(x³−3x²+3x−1))⁄√(x+7)): con parsePower il √ dopo
      // ⁄ dava «Espressione non valida» e l'esercizio della foto cadeva in
      // cache invece del percorso deterministico. parseUnary legge anche
      // radici e segni unari; per operandi comuni il comportamento è identico.
      const den = this.parseUnary();
      base = { k: "div", a: base, b: den, fr: true };
    }
    return base;
  }

  private parseAtom(): Node {
    const t = this.next();
    if (!t) throw new ExprError("Espressione incompleta: manca un termine alla fine.");
    if (t.t === "num") return { k: "num", v: t.v, ...(t.dec ? { dec: t.dec } : {}) };
    if (t.t === "letter") return { k: "var", name: t.v };
    if (t.t === "lparen") {
      const inner = this.parseExpr();
      const rp = this.next();
      if (!rp || rp.t !== "rparen" || rp.b !== t.b) throw new ExprError("Parentesi non chiusa o di tipo diverso: controlla le parentesi.");
      return { k: "paren", a: inner, b: t.b };
    }
    // (12/11) VALORE ASSOLUTO: |X| con X espressione intera (anche |x|² via
    // parsePower: il nodo esce da parseAtom e il ^ si legge come al solito).
    // (12/11-punto 3, foto «ancora non funziona bene») la barra chiude alla
    // PROSSIMA barra: con la lettura greedy un fattore giustapposto DOPO
    // l'assoluto (es. |2x|(x−1) oppure |x+2|(x−2)+1 dentro una frazione
    // complessa) veniva assorbito dentro |…| e il parse falliva con
    // «Parentesi non chiusa» / «Manca un'operazione» — il motore di verifica
    // non valutava più nulla e l'esercizio non si costruiva. Leggo SOLO i
    // token tra le due barre: il resto resta fuori e la moltiplicazione
    // implicita lo raccoglie (prevEndsFactor ora include anche abs).
    if (t.t === "bar") {
      let chiusura = -1;
      for (let j = this.pos; j < this.toks.length; j++) {
        if (this.toks[j].t === "bar") { chiusura = j; break; }
      }
      if (chiusura === -1) throw new ExprError("Valore assoluto non chiuso: manca la barra finale |.");
      const interno = this.toks.slice(this.pos, chiusura);
      this.pos = chiusura + 1;
      const sub = new Parser(interno);
      const inner = sub.parseExpr();
      if (sub.pos < interno.length) {
        throw new ExprError("Valore assoluto non valido: controlla il contenuto tra le barre.");
      }
      return { k: "abs", a: inner };
    }
    throw new ExprError("Espressione non valida: controlla segni e operatori.");
  }
}

/** L'espressione ha una SINTASSI valida? Serve per scegliere il testo OCR
 *  migliore da proporre nel campo modificabile (mai mostrare testo senza senso) */
export function canParseExpression(raw: string): boolean {
  try {
    parseExpression(normalizeInput(raw));
    return true;
  } catch {
    return false;
  }
}

export function parseExpression(normalized: string): Node {
  return new Parser(tokenize(normalized)).parse();
}

/** Valuta un'espressione NUMERICA completamente analizzata, senza parseFloat
 *  parziali, eval o rimozione di caratteri: input incompleti, lettere,
 *  divisioni per zero e radici non reali restituiscono null. Accetta le
 *  notazioni della tastiera e del riconoscimento, incluso ∛ di numeri negativi. */
export function evaluateNumericExpression(raw: string): number | null {
  try {
    let source = String(raw ?? "").trim();
    if (!source || source.includes("=")) return null;
    // I comandi LaTeX \\sqrt restano intatti; le parole della tastiera
    // diventano i simboli già supportati dal parser.
    source = source.replace(/(?<!\\)(?:sqrt|radq|rad2)/gi, "√")
      .replace(/(?<!\\)rad3/gi, "∛")
      .replace(/(?<!\\)rad4/gi, "∜");
    // Le frazioni LaTeX rappresentano un solo operando: mantenere ⁄ anche
    // per numeratore/denominatore complessi. Altrimenti (A/B):(C/D)
    // diventava ((A/B)/C)/D e il controllo rifiutava reciprocità corrette.
    const ast = parseExpression(normalizeInput(source, true));
    const root = (value: number, index: number): number | null => {
      if (!Number.isInteger(index) || index === 0 || (value < 0 && Math.abs(index) % 2 === 0)) return null;
      /* (10/11, richiesta utente) indice NEGATIVO: ⁻³√8 = 1/³√8 — esiste in
       * matematica e la valutazione deve saperlo controllare (la radice resta
       * indicata nello svolgimento: a semplificarla pensa lo studente). */
      if (index < 0) {
        const inversa = root(value, -index);
        return inversa !== null && inversa !== 0 ? 1 / inversa : null;
      }
      return value < 0 ? -Math.pow(-value, 1 / index) : Math.pow(value, 1 / index);
    };
    const visit = (n: Node): number | null => {
      switch (n.k) {
        case "num": return n.v.n / n.v.d;
        case "var": return null;
        case "term": return n.t.vars.length ? null : n.t.c.n / n.t.c.d;
        case "paren": return visit(n.a);
        // (12/11) VALORE ASSOLUTO: |…| è definito su tutto il dominio reale.
        case "abs": { const a = visit(n.a); return a === null ? null : Math.abs(a); }
        case "neg": { const a = visit(n.a); return a === null ? null : -a; }
        case "add": case "sub": case "mul": case "div": {
          const a = visit(n.a), b = visit(n.b);
          if (a === null || b === null || (n.k === "div" && b === 0)) return null;
          const value = n.k === "add" ? a + b : n.k === "sub" ? a - b : n.k === "mul" ? a * b : a / b;
          return Number.isFinite(value) ? value : null;
        }
        case "pow": {
          const a = visit(n.a);
          if (a === null || (a === 0 && n.e <= 0)) return null;
          const value = Math.pow(a, n.e);
          return Number.isFinite(value) ? value : null;
        }
        case "powfrac": {
          const a = visit(n.a);
          if (a === null) return null;
          const base = root(a, n.n);
          if (base === null) return null;
          const value = Math.pow(base, n.m);
          return Number.isFinite(value) ? value : null;
        }
        case "sqrt": case "root": {
          const a = visit(n.a);
          if (a === null) return null;
          const value = root(a, n.k === "sqrt" ? 2 : n.n);
          return value !== null && Number.isFinite(value) ? value : null;
        }
        case "rat": {
          if (n.num.some((t) => t.vars.length) || n.den.some((t) => t.vars.length)) return null;
          const sum = (p: Term[]) => p.reduce((total, t) => total + t.c.n / t.c.d, 0);
          const den = n.den.length ? sum(n.den) : 1;
          if (den === 0) return null;
          const value = sum(n.num) / den;
          return Number.isFinite(value) ? value : null;
        }
      }
    };
    return visit(ast);
  } catch {
    return null;
  }
}

// ─── Stampa LaTeX ─────────────────────────────────────────────────

function varLatex(vars: { v: string; e: number }[]): string {
  return vars.map((x) => (x.e === 1 ? x.v : `${x.v}^{${x.e}}`)).join("");
}

/** LaTeX di un monomio; sign: "auto" (primo termine), "plus", "minus" */
export function termToLatex(t: Term, sign: "auto" | "plus" | "minus" = "auto"): string {
  const neg = t.c.n < 0;
  const absC: Frac = { n: Math.abs(t.c.n), d: t.c.d };
  // (25/10, punto 1) esponenti NEGATIVI (x^-2, 2x^-2, (1/2)x^-2) → frazione
  // impilata: numeratore = coefficiente e variabili positive, denominatore =
  // variabili negative in valore assoluto. Mai «x^{-2}» in output.
  const negVars = t.vars.filter((x) => x.e < 0);
  const posVars = t.vars.filter((x) => x.e > 0);
  const vars = negVars.length ? varLatex(posVars) : varLatex(t.vars);
  let body: string;
  if (negVars.length) {
    const denLat = varLatex(negVars.map((x) => ({ v: x.v, e: -x.e })));
    // (25/10-fix) numeratore MAI vuoto: 1/(4x²) — il numeratore della
    // frazione del coefficiente è «1» quando non ci sono né variabili
    // positive né numeratore ≠ 1 (caso (1/4)x^-2).
    const numCore = absC.n === 1 ? vars || "1" : `${absC.n}${vars}`;
    const denCore = `${absC.d === 1 ? "" : absC.d}${denLat}`;
    body = `\\dfrac{${numCore}}{${denCore}}`;
  } else if (absC.n === 1 && absC.d === 1 && vars) body = vars;
  else if (absC.d !== 1 && vars) body = `\\dfrac{${absC.n === 1 ? "" : absC.n}${vars}}{${absC.d}}`;
  // valore PURAMENTE numerico non intero → FRAZIONE IMPILATA (come scritta
  // dall'utente nel verde); i due punti restano solo per le divisioni NON
  // ancora risolte (nodi "div")
  else if (absC.d !== 1) body = `\\dfrac{${absC.n}}{${absC.d}}`;
  else body = `${absC.n}${vars}`;
  if (fIsZero(t.c)) body = "0";
  const signStr = neg ? "-" : sign === "plus" ? "+" : "";
  return signStr + body;
}

/** Somma algebrica di monomi (senza colori) */
export function polyToLatex(p: Term[]): string {
  if (p.length === 0) return "0";
  return p
    .map((t, i) => {
      if (i === 0) return termToLatex(t, "auto");
      const abs = termToLatex({ c: { n: Math.abs(t.c.n), d: t.c.d }, vars: t.vars }, "auto");
      return t.c.n < 0 ? ` - ${abs}` : ` + ${abs}`;
    })
    .join("");
}

/** Stampa l'operando destro di +/− gestendo il segno del termine (es. «+ −x» → «− x») */
function printSignedRight(b: Node, plus: string, minus: string): string {
  if (b.k === "term" && b.t.c.n < 0) {
    const abs = termToLatex({ c: { n: Math.abs(b.t.c.n), d: b.t.c.d }, vars: b.t.vars }, "auto");
    return `${minus}${abs}`;
  }
  if (b.k === "num" && b.v.n < 0) return `${minus}${fracToLatex({ n: -b.v.n, d: b.v.d })}`;
  return `${plus}${printNode(b)}`;
}

function needsParensForMul(n: Node): boolean {
  // ⚠️ un valore «a : b» va tra parentesi come operando di × (mai «21 : 2x»);
  // un valore razionale (frazione) sempre (mai «\dfrac{3}{x}x»)
  return n.k === "add" || n.k === "sub" || n.k === "paren" || (n.k === "div" && !n.fr) || n.k === "rat" || isColonValue(n);
}

function needsParensForDiv(n: Node): boolean {
  // In «a : b» a e b vanno tra parentesi se non sono atomi (num/lettera/monomio/potenza)
  return n.k === "add" || n.k === "sub" || n.k === "mul" || (n.k === "div" && !n.fr) || n.k === "neg" || n.k === "rat" || isColonValue(n);
}

function needsParensForPow(n: Node): boolean {
  // (25/10, punto 2) anche sqrt/root: (∜16)³ — senza parentesi «∜16³»
  // si leggerebbe come radice di 16³
  return n.k === "add" || n.k === "sub" || n.k === "mul" || (n.k === "div" && !n.fr) || n.k === "paren" || n.k === "neg" || n.k === "rat" || n.k === "sqrt" || n.k === "root" || isColonValue(n) || (n.k === "term" && n.t.c.d !== 1);
}

/** Avvolge inner con il TIPO di parentesi scritto dall'utente:
 *  quadra → \left[ \right], graffa → \left\{ \right\}, tonde di default. */
function wrapParen(b: "[" | "{" | undefined, inner: string): string {
  if (b === "[") return `\\left[${inner}\\right]`;
  if (b === "{") return `\\left\\{${inner}\\right\\}`;
  return `\\left(${inner}\\right)`;
}

function printOp(n: Node, ctx: "mul-left" | "mul-right" | "pow-base" | "div-left" | "div-right"): string {
  let s = printNode(n);
  const parens =
    (ctx === "mul-left" && needsParensForMul(n)) ||
    (ctx === "mul-right" && (needsParensForMul(n) || n.k === "neg")) ||
    (ctx === "pow-base" && needsParensForPow(n)) ||
    (ctx === "div-left" && needsParensForDiv(n)) ||
    (ctx === "div-right" && needsParensForDiv(n));
  // ⚠️ una parentesi già avvolta (tonda, QUADRA o GRAFFA) non va ri-avvolta:
  // accetta qualsiasi «\left…», non solo «\left(»
  if (parens && !s.startsWith("\\left")) s = `\\left(${s}\\right)`;
  return s;
}

function printNode(n: Node): string {
  switch (n.k) {
    case "num": return n.dec ? n.dec.replace(".", "{,}") : fracToLatex(n.v);
    case "var": return n.name;
    case "term": return termToLatex(n.t, "auto");
    case "root": {
      // parentesi TRIVIALI sotto radice via (es. ∛(8) → \sqrt[3]{8}); le
      // parentesi con + o − dentro restano (√(x+1))
      const inner = n.a.k === "paren" && !hasOps(n.a.a) ? printNode(n.a.a) : printNode(n.a);
      // (25/10, punto 2) indice 2 → radice quadrata senza indice (stile libro)
      return n.n === 2 ? `\\sqrt{${inner}}` : `\\sqrt[${n.n}]{${inner}}`;
    }
    case "rat": {
      // valore razionale (fratte, giro 21): frazione impilata; se il
      // denominatore è 1 (già semplificato) resta solo il polinomio
      if (n.den.length === 0) return n.num.length === 0 ? "0" : polyToLatex(n.num);
      if (n.num.length === 0) return "\\dfrac{0}{" + polyToLatex(n.den) + "}";
      return `\\dfrac{${polyToLatex(n.num)}}{${polyToLatex(n.den)}}`;
    }
    case "add": return `${printNode(n.a)}${printSignedRight(n.b, " + ", " - ")}`;
    case "sub": {
      // Una somma o differenza sostituita dopo «−» resta raggruppata:
      // a − (b + c) NON può essere stampato come a − b + c.
      if (n.b.k === "add" || n.b.k === "sub") {
        return `${printNode(n.a)} - \\left(${printNode(n.b)}\\right)`;
      }
      return `${printNode(n.a)}${printSignedRight(n.b, " - ", " + ")}`;
    }
    case "neg": {
      const inner = printNode(n.a);
      return (n.a.k === "add" || n.a.k === "sub") ? `-\\left(${inner}\\right)` : `-${inner}`;
    }
    case "mul": {
      const a = n.a, b = n.b;
      // ⚠️ un valore «21 : 2» NON si può giustapporre («21 : 2x» si leggerebbe
      // 21:(2x)): usa sempre «·» e mettilo tra parentesi (vedi isColonValue).
      const aNum = isNumericFlat(a) !== null && !containsParen(a) && !isColonValue(a);
      // ⚠️ la giustapposizione «4x» vale SOLO se c'è una parte letterale:
      // un termine PURAMENTE NUMERICO (es. il 2 uscito da (10:5)) va stampato
      // con «\cdot», altrimenti 4 · 2 diventerebbe «42» (bug «4 − 42»).
      // (25/10) MAI giustapposto con una POTENZA: «3 · 2^-2» come «32^{-2}»
      // si leggerebbe «82 alla -2». Con la potenza si usa sempre «\cdot».
      const bMonomial = flatTermOf(b) !== null && b.k !== "num" && b.k !== "div" && b.k !== "pow" && !(b.k === "term" && b.t.vars.length === 0);
      // numero × lettera → giustapposti (2x); altrimenti \cdot
      // Se il secondo fattore inizia con una cifra, la giustapposizione
      // unirebbe due numeri (3·2x → 32x, x·2y → x2y).
      const destraIniziaConCifra = /^\d/.test(printNode(b));
      if (aNum && bMonomial && !destraIniziaConCifra) return `${printNode(a)}${printOp(b, "mul-right")}`;
      // Tra due radicali il prodotto va esplicitato con il puntino: nella
      // foto √(…)·√(…) la giustapposizione faceva sparire l'operatore
      // nella traccia dei passaggi, pur mostrandolo in fase di conferma.
      const dueRadicali = (a.k === "sqrt" || a.k === "root") && (b.k === "sqrt" || b.k === "root");
      // Rendere esplicito il prodotto dopo un radicale: senza puntino,
      // il parser poteva inglobare un fattore esterno nel radicando.
      const radicePerFattore = a.k === "sqrt" || a.k === "root";
      const useCdot = dueRadicali || radicePerFattore || destraIniziaConCifra || (isNumericFlat(a) !== null && isNumericFlat(b) !== null) || a.k === "num" || b.k === "num" ||
        a.k === "paren" || b.k === "paren" || b.k === "neg" || a.k === "div" || b.k === "div" ||
        a.k === "pow" || b.k === "pow" || isColonValue(a) || isColonValue(b);
      if (useCdot) {
        // ⚠️ Con il «·» esplicito un valore «21 : 2» NON ha bisogno di
        // parentesi: 3 · 21 : 2 = (3 · 21) : 2, lo stesso valore (× e : hanno
        // la stessa priorità, si calcola da sinistra a destra). Le parentesi
        // attorno ai valori «a : b» servono solo nella giustapposizione
        // (rama aNum && bMonomial qui sotto) e come operandi di :
        const soft = (x: Node): string => {
          const s = printNode(x);
          const need = x.k === "add" || x.k === "sub" || x.k === "paren" || (x.k === "div" && !x.fr) || x.k === "neg";
          return need && !s.startsWith("\\left") ? `\\left(${s}\\right)` : s;
        };
        return `${soft(a)} \\cdot ${soft(b)}`;
      }
      return `${printOp(a, "mul-left")}${printOp(b, "mul-right")}`;
    }
    case "div": {
      // (7/10, richiesta esplicita) frazione impilata SCRITTA dall'utente:
      // resta \dfrac in OGNI passo, mai «a : b»
      if (n.fr) {
        let sign = "";
        let a = n.a;
        if (a.k === "neg") {
          sign = "-";
          a = a.a;
        } else if (a.k === "num" && a.v.n < 0) {
          sign = "-";
          a = { k: "num", v: { n: -a.v.n, d: a.v.d } };
        } else if (a.k === "term" && a.t.c.n < 0) {
          sign = "-";
          a = { k: "term", t: { ...a.t, c: { n: -a.t.c.n, d: a.t.c.d } } };
        }
        return `${sign}\\dfrac{${printNode(a)}}{${printNode(n.b)}}`;
      }
      // ⚠️ La divisione si stampa COME LA SCRIVE L'UTENTE: «6 : 2» e non come
      // frazione (richiesta esplicita: niente conversione automatica in \dfrac).
      const a = printOp(n.a, "div-left");
      const b = printOp(n.b, "div-right");
      return `${a} : ${b}`;
    }
    case "pow": return `${printOp(n.a, "pow-base")}^{${n.e}}`;
    case "powfrac":
      // esponente frazionario IMPILATO (9^(1/2) → 9^{1/2} impilato)
      return `${printOp(n.a, "pow-base")}^{\\tfrac{${n.m}}{${n.n}}}`;
    case "sqrt": {
      const inner = n.a.k === "paren" && !hasOps(n.a.a) ? printNode(n.a.a) : printNode(n.a);
      return `\\sqrt{${inner}}`;
    }
    // (12/11) VALORE ASSOLUTO: si stampa |…| — è anche la forma in cui
    // l'IA lo scrive, così la verifica per stringa/struttura resta fedele.
    case "abs":
      return `\\left|${printNode(n.a)}\\right|`;
    case "paren":
      // parentesi annidate ((x)) → una sola coppia: niente «(((21)))» quando
      // l'espressione arriva da foto/LaTeX con \frac{21}{2} → (21)/(2)
      // Mantieni invece le quadre e le graffe annidate dello studente.
      if (n.a.k === "paren" && !n.b && !n.a.b) return printNode(n.a);
      return wrapParen(n.b, printNode(n.a));
  }
}

export function printLatex(n: Node): string {
  return printNode(n).replace(/\s+/g, " ").trim();
}

// ─── Riduzione a passi ────────────────────────────────────────────

export type StepKind =
  | "paren-value"   // parentesi con solo numeri → calcolo il valore
  | "paren-sign"    // dissolvo le parentesi col segno (−(a−b) → −a+b)
  | "paren-mul"     // distribuisco il prodotto sulla parentesi
  | "paren-prod"    // prodotto/potenza/radice DENTRO le parentesi tonde:
                    // si svolge nel punto 2 («Risolvo le parentesi tonde»);
                    // ⚠️ MAI calcolata da sola (segnalazione 19/10: con
                    // (1/2·[1/5]) : 1/3 il prodotto 1/2·1/5 compariva già
                    // svolto nel box del risultato finale)
  | "paren-unwrap"  // parentesi senza effetto sul segno
  | "mul-terms"     // prodotto di monomi → coefficienti ed esponenti
  | "pow-term"      // potenza di monomio
  | "sqrt"          // radice quadrata (quadrato perfetto / monomio con esponenti pari)
  | "root"          // radice n-esima ∛ ∜ (potenza perfetta / esponenti multipli dell'indice, giro 21)
  | "root-prop"     // (25/10) proprietà delle radici: riscrittura segnalata
                    // (trasformazione in potenza, MCD, porta dentro/fuori,
                    // prodotto/quoziente a stesso indice) — nessun conto
  | "rad-rad"       // (25/10, punto 4) radice di radice: si moltiplicano gli
                    // indici (√√16 → ∜16) — riscrittura segnalata, la radice
                    // resta allo studente
  | "rad-pow"       // (25/10, punto 4) radice di potenza: si divide l'esponente
                    // per l'indice (√(x⁶) → x^3) — spiegazione con l'espressione
                    // intera (stato invariato)
  | "rad-pow-final" // (25/10, punto 4) risultato del segmento rad-pow: UN SOLO
                    // inserimento (x^3, oppure 8 = 2^3 per i numeri)
  | "pow-prop"      // (25/10) proprietà delle potenze con STESSA base:
                    // esponenti SOTTRATTI (quoziente, m−k) o sommati
                    // (prodotto, m+k) dall'app (riscrittura segnalata),
                    // la potenza finale resta allo studente
  | "pow-frac"      // (25/10, punto 2) esponente frazionario = radice:
                    // riscrittura segnalata (9^(1/2) → √9, 16^(3/4) → (∜16)³)
  | "pow-prod"      // (25/10, punto 3) potenza di prodotto/quoziente:
                    // riscrittura segnalata ((2x)³ → ogni fattore alla potenza)
  | "pow-prod-final" // (25/10, punto 3) risultato del segmento pow-prod:
                    // UN SOLO inserimento (8x^3; equivalente 2^3x^3 accettato)
  | "pow-prop-final" // (25/10) risultato finale del segmento pow-prop: UN SOLO
                    // calcolo per lo studente, in qualunque forma equivalente
                    // (es. 9, oppure 3^2, oppure (1/3)^-2 — verifica a valore)
  | "pow-flip"      // (25/10-fix) capovolgimento automatico segnalato del
                    // numero con esponente negativo (reciproco): prima
                    // usava il kind "pow-term" e l'audit lo segnava
  | "pow-pow"       // (08/11) POTENZA DI POTENZA con numeri grandi:
                    // spiegazione segnalata (stato invariato), poi la base
                    // si riscrive con le proprietà e gli esponenti si
                    // moltiplicano — tutto SIMBOLICO ((2^15·2^3)^4 → 2^72)
  | "pow-pow-exp"   // (08/11) risultato del segmento pow-pow: UN SOLO
                    // inserimento dell'ESPONENTE (numero piccolo); lo stato
                    // resta una potenza simbolica
  | "pow-prop-exp"  // (08/11) proprietà stessa base in modalità simbolica:
                    // lo studente digita l'ESPONENTE (m+k o m−k), lo stato
                    // resta la potenza (2^72:2^8 → 2^64)
  | "div-num"       // divisione per un numero
  | "paren-div"     // divisione DENTRO le parentesi tonde: si svolge nel
                    // punto 2 («Risolvo le parentesi tonde»); ⚠️ MAI calcolata
                    // da sola (segnalazione 19/10: con (3/7 : 9/14)² − 7/12·2
                    // la divisione dentro la parentesi compariva già svolta,
                    // e con la catena ± la UI non la chiedeva da nessuna parte)
  | "div-mono"      // divisione tra monomi (x⁶ : x⁴ = x²)
  | "fold-add-num"; // calcolo in ordine da sinistra a destra (solo numeri)

export interface ExprStep {
  latex: string;
  kind: StepKind;
  detail: string;
  /**
   * Operazione da far SVOLGERE allo studente (BES/DSA): opLatex è il
   * calcolo SENZA risultato (es. «6 : 3»), answer è il risultato esatto.
   * Presente solo per i passi con risposta numerica (parentesi, divisioni,
   * prodotti/potenze di soli numeri, riduzioni della catena aritmetica).
   */
  opLatex?: string;
  answer?: Frac;
  /**
   * GIRO 30 (filosofia scaffolding): risultato atteso dei conti con
   * LETTERE. Presente SOLO sui passi con risultato non numerico: lo
   * studente scrive il risultato con la tastiera (regole del giro 26:
   * 3x/4, 5x, a^2…) e l'app lo convalida — il risultato non è mai
   * pre-scritto, è sempre e solo dato dall'utente.
   */
  answerPoly?: Term[];
  /** (25/10) vero per i passi pow-prop/pow-prop-final con base tra
   *  PARENTESI (es. (1/3)^-4 : (1/3)^-2): appartengono al punto 2
   *  «Risolvo le parentesi tonde» (richiesta esplicita dell'utente). */
  inParen?: boolean;
  /** (08/11, potenze simboliche) LaTeX del risultato SIMBOLICO del passo
   *  (es. «2^{72}»): presente sui passi in cui lo studente digita
   *  l'ESPONENTE (piccolo) e il risultato resta una potenza, come sul
   *  libro. La UI lo mostra al posto del valore numerico. */
  symbolicResultLatex?: string;
}

function replaceChild(n: Node, which: "a" | "b", newNode: Node): Node {
  return { ...(n as any), [which]: newNode };
}

export function polyToNode(p: Term[]): Node {
  if (p.length === 0) return { k: "num", v: fZero };
  let node: Node = { k: "term", t: p[0] };
  for (let i = 1; i < p.length; i++) node = { k: "add", a: node, b: { k: "term", t: p[i] } };
  return node;
}

function negatePoly(p: Term[]): Term[] {
  return p.map((t) => term(t.vars, fNeg(t.c)));
}

function negateFlat(n: Node): Node {
  const t = flatTermOf(n);
  if (t) return { k: "term", t: term(t.vars, fNeg(t.c)) };
  return { k: "neg", a: n };
}

/** Un passo di riduzione: figli prima (sinistra → destra), poi regole del nodo.
 *  ⚠️ FASI RIGOROSE (niente calcoli anticipati): finché ci sono parentesi
 *  (parensRemain) le riduzioni ESTERNE di ×, : e catena sono bloccate;
 *  DENTRO una parentesi (insideParen) ×, : e potenze del contenuto si
 *  svolgono regolarmente nel punto 2, mentre i ± attendono il paren-value. */
export function reduceOnce(
  n: Node,
  numericMode: boolean,
  parensRemain = false,
  insideParen = false,
  blockFold = false
): { node: Node; kind: StepKind; detail: string; opLatex?: string; answer?: Frac; answerPoly?: Term[]; inParen?: boolean; symbolicResultLatex?: string } | null {
  // 0) (25/10) PROPRIETÀ DELLE RADICI su × e :: PRIMA della ricorsione sui
  // figli (prodotto/quoziente a stesso indice, portare dentro): se si
  // aspettasse la ricorsione, i radicali verrebbero svolti uno alla volta
  // e la proprietà non comparirebbe mai nei passi.
  const rootRew = rootPropMulDiv(n);
  if (rootRew) return rootRew;
  // (25/10, punto 4) RADICE DI RADICE e RADICE DI POTENZA: pre-check PRIMA
  // della ricorsione sui figli — altrimenti la radice interna (o la potenza)
  // verrebbe svolta una alla volta e la proprietà non comparirebbe mai.
  //  RADICE DI RADICE (√√16): si MOLTIPLICANO gli indici → ∜16 (passo
  //  segnalato, poi la radice resta allo studente).
  // ⚠️ la √ del parser è un nodo «sqrt» (indice 2), ∛/∜ sono «root»:
  // l'indice si legge da entrambi (helper qui sotto).
  if (n.k === "sqrt" || n.k === "root") {
    const idxA = n.k === "sqrt" ? 2 : n.n;
    // (10/11) indice NEGATIVO: nessuna proprietà automatica — la radice
    // resta INDICATA (l'app non la semplifica, non la trasforma in potenza)
    if (idxA < 0) return null;
    const child = n.a;
    // RADICE DI RADICE: entrambe le radici si fondono in UNA con l'indice prodotto
    if (child.k === "sqrt" || child.k === "root") {
      const idxB = child.k === "sqrt" ? 2 : child.n;
      const tot = idxA * idxB;
      const merged: Node = tot === 2 ? { k: "sqrt", a: child.a } : { k: "root", a: child.a, n: tot };
      return {
        node: merged,
        kind: "rad-rad",
        detail: `\\text{Radice di radice: moltiplico gli indici } ${idxA} \\cdot ${idxB} \\text{.}`,
      };
    }
  //  RADICE DI POTENZA (√(x⁶), √(2⁶), √((2x)⁶)): si DIVIDE l'esponente
  //  per l'indice — stesso schema dei due tempi: spiegazione, poi UN SOLO
  //  inserimento del risultato (x^3, oppure 8 = 2^3, ecc.).
  // (25/10-fix) anche col RADICANDO tra parentesi (√(x⁶), √(2⁶), √((2x)⁶)):
  // si guarda ATTRAVERSO la parentesi — altrimenti il flusso paren-prod
  // farebbe svolgere la potenza interna (es. 2⁶ = 64) PRIMA della radice,
  // senza la proprietà e con un conto inutile in più per lo studente.
    // RADICE DI POTENZA (anche col radicando tra parentesi)
    const powInner = child.k === "pow" ? child : child.k === "paren" && child.a.k === "pow" ? child.a : null;
    if (powInner && powInner.e >= idxA && powInner.e % idxA === 0) {
    const baseNode = powInner.a.k === "paren" ? powInner.a.a : powInner.a;
    const baseFlat = flatTermOf(baseNode);
    if (baseFlat) {
      if (!radPowSeen.has(n)) {
        radPowSeen.add(n);
        return {
          node: n,
          kind: "rad-pow",
          detail: `\\text{Radice di potenza: divido l'esponente } ${powInner.e} \\text{ per l'indice } ${idxA} \\text{.}`,
        };
      }
      const res = termPow(baseFlat, powInner.e / idxA);
      return {
        node: { k: "term", t: res },
        kind: "rad-pow-final",
        detail: "",
        opLatex: printLatex(n),
        answerPoly: [res],
      };
    }
    }
  }
  // (25/10) PROPRIETÀ DELLE POTENZE con STESSA BASE (quoziente/prodotto):
  // PRIMA della ricorsione sui figli, altrimenti le potenze verrebbero
  // sviluppate una alla volta (e con esponente negativo si capovolgono →
  // frazioni annidate) e la proprietà non comparirebbe mai nei passi.
  // (25/10, punto 3) POTENZA DI PRODOTTO/QUOZIENTE ((2x)³, (x/2)²):
  // pre-check PRIMA della ricorsione sui figli, altrimenti la parentesi
  // verrebbe sciolta in silenzio (paren-unwrap) e la proprietà «la
  // potenza si applica a ogni fattore» non comparirebbe mai. Stesso
  // schema dei due tempi di pow-prop: spiegazione, poi UN SOLO
  // inserimento del risultato (8x^3; accetta anche 2^3x^3, che evalPoly
  // riduce allo stesso monomio).
  if (n.k === "pow" && n.e !== 0 && n.a.k === "paren") {
    const innerMono = flatTermOf(n.a.a);
    if (innerMono && innerMono.vars.length > 0) {
      // (25/10, punto 3) esponente NEGATIVO su base-parentesi monomio:
      // capovolgimento SEGNALATO che MANTIENE la parentesi (1/(2x)²),
      // così la proprietà della potenza di prodotto compare al denominatore
      // (prima la ricorsione sciolgeva la parentesi in silenzio e il
      // seguito era un pow-term senza spiegazione).
      if (n.e < 0) {
        const flippedP: Node = { k: "div", a: { k: "num", v: fOne }, b: { k: "pow", a: n.a, e: -n.e }, fr: true };
        return {
          node: flippedP,
          kind: "pow-flip",
          detail: `\\text{Esponente negativo: capovolgo (reciproco)}\\;\\Rightarrow\\;${printLatex(flippedP)}`,
        };
      }
      const isQuoziente = n.a.a.k === "div";
      if (!powProdSeen.has(n)) {
        powProdSeen.add(n);
        return {
          node: n,
          kind: "pow-prod",
          detail: isQuoziente
            ? "\\text{Potenza di un quoziente: la potenza si applica a numeratore e denominatore.}"
            : "\\text{Potenza di un prodotto: la potenza si applica a ogni fattore (coefficiente e lettere).}",
        };
      }
      const prod = termPow(innerMono, n.e);
      return {
        node: { k: "term", t: prod },
        kind: "pow-prod-final",
        detail: "",
        opLatex: printLatex(n),
        answerPoly: [prod],
      };
    }
  }
  // (08/11, potenze simboliche) POTENZA DI POTENZA ((2^{15}\cdot2^{3})^{4},
  // (2^{18})^{4}): pre-check PRIMA della ricorsione sui figli — altrimenti
  // la base verrebbe sviluppata NUMERICAMENTE (2^{15}\cdot2^{3} → 262144) e
  // l'esterna (262144)^{4} supererebbe i 2^{53} dell'aritmetica esatta
  // («Numeri troppo grandi»). Come sul libro le proprietà restano
  // SIMBOLICHE: lo studente digita gli ESPONENTI (numeri piccoli) e lo
  // stato resta una potenza. Schema a più tempi: 1º incontro spiegazione,
  // poi la riscrittura della base (se serve) e infine l'esponente prodotto.
  // Fuori dalla modalità simbolica scatta SOLO se lo svolgimento numerico
  // dell'esterna supera i 2^{53} (le potenze piccole restano come oggi).
  if (n.k === "pow" && n.e > 0 && Number.isInteger(n.e)) {
    let base = n.a;
    while (base.k === "paren") base = base.a;
    const basePow = base.k === "pow" && Number.isInteger((base as { e: number }).e)
      ? (base as { k: "pow"; a: Node; e: number })
      : null;
    const baseRew = !basePow && (base.k === "mul" || base.k === "div") ? powPropMulDiv(base) : null;
    const rewNode = baseRew ? (baseRew.node as { k: "pow"; a: Node; e: number }) : null;
    if (basePow || rewNode) {
      const ba = basePow ? basePow.a : rewNode!.a;
      const eInt = basePow ? basePow.e : rewNode!.e;
      if (modalitaSimbolica || potenzaSballa(ba, eInt * n.e)) {
        const inParen = n.a.k === "paren";
        if (!powPowSeen.has(n)) {
          powPowSeen.add(n);
          const baseLatexP = ba.k === "paren" ? printLatex(ba.a) : printLatex(ba);
          const expStrP = (v: number) => (v < 0 ? `(${v})` : `${v}`);
          return {
            node: n,
            kind: "pow-pow",
            detail: basePow
              ? `\\text{Potenza di potenza: riscrivo la stessa base } ${baseLatexP} \\text{ e poi eseguo il calcolo degli esponenti } ${expStrP(eInt)} \\cdot ${expStrP(n.e)}\\text{.}`
              : "\\text{Potenza di potenza: prima riscrivo la base con le proprietà delle potenze (stessa base), poi eseguo il calcolo degli esponenti.}",
            ...(inParen ? { inParen: true } : {}),
          };
        }
        if (basePow) {
          // (2^{18})^{4} → 2^{18·4}: UN SOLO inserimento: l'ESPONENTE.
          const eTot = eInt * n.e;
          const nuovo: Node = eTot === 0 ? { k: "num", v: fOne } : { k: "pow", a: ba, e: eTot };
          if (eTot !== 0 && (modalitaSimbolica || potenzaSballa(ba, eTot))) powSimboliche.add(nuovo);
          return {
            node: nuovo,
            kind: "pow-pow-exp",
            detail: "",
            opLatex: printLatex(n),
            answer: fr(eTot),
            symbolicResultLatex: eTot === 0 ? "1" : printLatex(nuovo),
            ...(inParen ? { inParen: true } : {}),
          };
        }
        // base = prodotto/quoziente di potenze a stessa base: PRIMA la base
        // si riscrive in forma simbolica (l'esponente lo digita lo studente),
        // poi la potenza di potenza al giro dopo (il nuovo nodo è già in
        // powPowSeen: niente seconda spiegazione).
        const nuovo: Node = { k: "pow", a: { k: "paren", a: rewNode! }, e: n.e };
        powSimboliche.add(rewNode!);
        powPowSeen.add(nuovo);
        return {
          node: nuovo,
          kind: "pow-pow-exp",
          detail: "",
          opLatex: printLatex(base),
          answer: fr(rewNode!.e),
          symbolicResultLatex: printLatex(rewNode!),
          ...(inParen ? { inParen: true } : {}),
        };
      }
    }
  }
  const powRew = powPropMulDiv(n);
  if (powRew) {
    // (25/10, richiesta utente) DUE TEMPI:
    // 1º incontro → SOLO la riscrittura segnalata: il passo mostra
    //   l'espressione INTERA (entrambe le potenze, stato invariato) con la
    //   spiegazione «Applico le proprietà... eseguo il calcolo degli
    //   esponenti (-4) - (-2)». NIENTE valore della parentesi, niente
    //   capovolgimenti/potenze intermedie in vista.
    // 2º incontro → UN SOLO passo tiped: il risultato finale del segmento
    //   (es. 9), calcolato dall'app IN SILENZIO (riduzione completa del
    //   sottoalbero senza emettere passi). Lo studente può scriverlo in
    //   qualunque forma equivalente (9, 3^2, (1/3)^-2): la verifica è a
    //   VALORE (evaluateLatex), non alla forma.
    // (25/10, punto 1) esponente negativo su base LETTERALE pura con
    // coefficiente 1 (es. x² : x⁴): il risultato è la frazione impilata
    // 1/x^(k−m) — nient'altro da calcolare dentro. Stesso schema dei due
    // tempi: 1º incontro spiegazione, 2º UN SOLO inserimento del risultato
    // (lo studente scrive 1/x^2 oppure x^-2 — parsePolyLoose accetta
    // entrambe, la verifica è a valore del monomio).
    const negLetter = (() => {
      const pn = powRew.node;
      if (pn.k !== "pow" || pn.e >= 0) return false;
      const b = flatTermOf(pn.a);
      return b !== null && b.vars.length > 0 && b.c.n === 1 && b.c.d === 1;
    })();
    // (08/11, potenze simboliche) il risultato della proprietà resta una
    // POTENZA (modalità simbolica, oppure risultato oltre i 2^{53}): la
    // riscrittura finale avviene con l'ESPONENTE digitato dallo studente.
    const simbolica = (() => {
      const pn = powRew.node;
      return pn.k === "pow" && (modalitaSimbolica || potenzaSballa(pn.a, pn.e));
    })();
    if (!powPropSeen.has(n)) {
      const fin = reduceSilently(powRew.node);
      if ((fin && (fin.k === "num" || fin.k === "term")) || negLetter || simbolica) {
        powPropSeen.add(n);
        return { node: n, kind: "pow-prop", detail: powRew.detail, ...(powRew.inParen ? { inParen: true } : {}) };
      }
      // riduzione silenziosa non riuscita (basi con coefficiente ≠ 1 o
      // parentesi): riscrittura classica e flusso normale passo-passo.
      return { node: powRew.node, kind: "pow-prop", detail: powRew.detail, ...(powRew.inParen ? { inParen: true } : {}) };
    }
    if (negLetter) {
      const pn = powRew.node as { k: "pow"; a: Node; e: number };
      const b = flatTermOf(pn.a)!;
      // stato finale: frazione impilata 1 / base^(|e|) (tutte le lettere
      // della base finiscono al denominatore, esponenti moltiplicati per |e|)
      const denT = term(b.vars.map((v) => ({ v: v.v, e: v.e * -pn.e })), fOne);
      const negT = term(b.vars.map((v) => ({ v: v.v, e: v.e * pn.e })), fOne);
      const finNode: Node = { k: "div", a: { k: "num", v: fOne }, b: { k: "term", t: denT }, fr: true };
      return {
        node: finNode,
        kind: "pow-prop-final",
        detail: "",
        // ⚠️ senza «=»: la UI (opDisplayLatex) lo aggiunge già
        opLatex: printLatex(n),
        answerPoly: [negT],
        ...(powRew.inParen ? { inParen: true } : {}),
      };
    }
    if (simbolica) {
      // (08/11, potenze simboliche) UN SOLO inserimento: l'ESPONENTE della
      // potenza riscritta (numero piccolo, es. 72 − 8 → 64). Lo stato resta
      // la potenza SIMBOLICA (2^{64}): come sul libro, il valore enorme non
      // si sviluppa mai (l'aritmetica esatta dell'app si ferma a 2^{53}).
      const pn = powRew.node as { k: "pow"; a: Node; e: number };
      powSimboliche.add(pn);
      return {
        node: pn.e === 0 ? { k: "num", v: fOne } : pn,
        kind: "pow-prop-exp",
        detail: "",
        opLatex: printLatex(n),
        answer: fr(pn.e),
        symbolicResultLatex: pn.e === 0 ? "1" : printLatex(pn),
        ...(powRew.inParen ? { inParen: true } : {}),
      };
    }
    const fin2 = reduceSilently(powRew.node);
    if (!fin2) return null;
    if (fin2.k === "num") {
      return {
        node: fin2,
        kind: "pow-prop-final",
        detail: "",
        opLatex: printLatex(powRew.node),
        answer: fin2.v,
        ...(powRew.inParen ? { inParen: true } : {}),
      };
    }
    const tFin = (fin2 as { k: "term"; t: Term }).t;
    const numerico = tFin.vars.length === 0;
    return {
      node: fin2,
      kind: "pow-prop-final",
      detail: "",
      // GIRO 30: numerico → opLatex+answer; lettere → answerPoly (input studente)
      ...(numerico ? { opLatex: printLatex(powRew.node), answer: tFin.c } : { answerPoly: [tFin] }),
      ...(powRew.inParen ? { inParen: true } : {}),
    };
  }

  // 1) figli — ⚠️ propagare ANCHE opLatex/answer: l'operazione svolta dallo
  // studente può stare in un figlio profondo dell'albero (es. 3 · (2+3))
  // GIRO 30: propaga anche answerPoly (risultato atteso dei conti con lettere)
  const spread = (r: { opLatex?: string; answer?: Frac; answerPoly?: Term[]; inParen?: boolean; symbolicResultLatex?: string }) => ({
    // (25/10, punto 1) opLatex viaggia anche con answerPoly (passi tiped con
    // l'operazione mostrata, es. «x^{2} : x^{4} =» con risultato 1/x²)
    ...(r.opLatex ? { opLatex: r.opLatex } : {}),
    ...(r.opLatex && r.answer ? { answer: r.answer } : r.answerPoly ? { answerPoly: r.answerPoly } : {}),
    ...(r.inParen ? { inParen: true } : {}),
    // (08/11, potenze simboliche) il risultato POTENZA dei passi con
    // esponente deve sopravvivere alla risalita della ricorsione, oppure la
    // UI lo perderebbe e mostrerebbe il numero invece della potenza.
    ...(r.symbolicResultLatex ? { symbolicResultLatex: r.symbolicResultLatex } : {}),
  });
  if (n.k === "add" || n.k === "sub" || n.k === "mul" || n.k === "div") {
    const ra = reduceOnce(n.a, numericMode, parensRemain, insideParen, blockFold);
    if (ra) return { node: replaceChild(n, "a", ra.node), kind: ra.kind, detail: ra.detail, ...spread(ra) };
    const rb = reduceOnce(n.b, numericMode, parensRemain, insideParen, blockFold);
    if (rb) return { node: replaceChild(n, "b", rb.node), kind: rb.kind, detail: rb.detail, ...spread(rb) };
  } else if (n.k === "neg" || n.k === "paren" || n.k === "pow" || n.k === "sqrt" || n.k === "root") {
    const ra = reduceOnce(n.a, numericMode, parensRemain, insideParen || n.k === "paren", blockFold);
    if (ra) return { node: replaceChild(n, "a", ra.node), kind: ra.kind, detail: ra.detail, ...spread(ra) };
  }

  // 2) regole del nodo
  switch (n.k) {
    case "paren": {
      const inner = n.a;
      // (08/11, potenze simboliche) il contenuto contiene una potenza
      // SIMBOLICA (prodotta da una proprietà): NON si appiattisce in numero
      // (flatTermOf/isNumericFlat la svolgerebbero: 2^{7} → 128, perdendo la
      // forma del libro e facendo poi esplodere la divisione esterna);
      // la parentesi si scioglie esponendo la potenza così com'è.
      if (contienePowSimbolica(inner)) {
        return { node: inner, kind: "paren-unwrap", detail: "" };
      }
      // (25/10-fix) frazione impilata SCRITTA DALL'UTENTE dentro la parentesi
      // (es. (\dfrac{1}{3})^{-6} arrivata dalla foto/OCR): è già un VALORE,
      // non un conto — «Risolvo le parentesi tonde» NON la propone come input.
      // Prima l'app chiedeva «(1/3) =» (segnalazione 25/10 con
      // (1/3)^{-6} : (1/6)^{-3} + 1/6): un conto che non esiste, perché la
      // frazione impilata è solo notazione (come da KINDS_SOLA_NOTAZIONE).
      // La parentesi si scioglie senza alcun input (kind paren-div). Se il
      // contenuto è scritto coi DUE PUNTI (1 : 3) resta un vero conto:
      // il ramo sotto (numVal + hasOps) continua a proporlo allo studente.
      if (inner.k === "div" && (inner as any).fr) {
        const fn = isNumericFlat(inner.a);
        const fd = isNumericFlat(inner.b);
        if (fn !== null && fd !== null && !fIsZero(fd)) {
          return { node: { k: "num", v: fDiv(fn, fd) }, kind: "paren-div", detail: "" };
        }
      }
      const numVal = isNumericFlat(inner);
      if (numVal !== null && hasOps(inner)) {
        // (24/10) filosofia scaffolding: il detail NON contiene il risultato
        // (lo scrive lo studente); «operazione = risultato» si ricostruisce
        // solo DOPO la risposta corretta (copiaRiga / InteractiveOpInput).
        return {
          node: { k: "num", v: numVal },
          kind: "paren-value",
          detail: wrapParen(n.b, printNode(inner)),
          opLatex: wrapParen(n.b, printNode(inner)),
          answer: numVal,
        };
      }
      const flat = flatTermOf(inner);
      if (flat) {
        return { node: { k: "term", t: flat }, kind: "paren-unwrap", detail: "" };
      }
      return null; // la parentesi la scioglie il nodo padre
    }
    case "neg": {
      if (n.a.k === "paren") {
        const p = evalPoly(n.a.a);
        // GIRO 29: niente risultato pre-scritto — il dettaglio mostra SOLO
        // l'espressione a cui applicare la regola dei segni; il risultato
        // lo scrive lo studente sul quaderno.
        return { node: polyToNode(negatePoly(p)), kind: "paren-sign", detail: `-${printOp(n.a, "mul-left")}`, answerPoly: negatePoly(p) };
      }
      // ⚠️ NIENTE CALCOLO ANTICIPATO: −(2·3) NON diventa −6 da sola. Il meno
      // passa al primo fattore (regola dei segni) e il prodotto/divisione
      // lo svolgerà lo studente nel suo punto (monomi / divisioni).
      if (n.a.k === "mul" || n.a.k === "div") {
        const first = n.a.a;
        const negFirst: Node =
          first.k === "num" ? { k: "term", t: term([], fNeg(first.v)) } :
          first.k === "term" ? { k: "term", t: term(first.t.vars, fNeg(first.t.c)) } :
          first.k === "neg" ? first.a : { k: "neg", a: first };
        const rebuilt: Node = n.a.k === "mul" ? { k: "mul", a: negFirst, b: n.a.b } : { k: "div", a: negFirst, b: n.a.b, fr: n.a.fr };
        return { node: rebuilt, kind: "paren-sign", detail: "" };
      }
      const flat = flatTermOf(n.a);
      if (flat && (flat.c.d !== 1 || flat.c.n < 0 || n.a.k !== "term")) {
        return { node: { k: "term", t: term(flat.vars, fNeg(flat.c)) }, kind: "paren-sign", detail: "" };
      }
      return null;
    }
    case "add": {
      if (n.b.k === "paren") {
        const p = evalPoly(n.b.a);
        return { node: polyToNode([...evalPoly(n.a), ...p]), kind: "paren-sign", detail: "" };
      }
      // ⚠️ ORDINE RIGOROSO: la catena ± parte SOLO quando non restano più
      // prodotti/divisioni/potenze da svolgere (blockFold) — mai prima,
      // altrimenti l'espressione mostrata continerebbe ancora un prodotto
      // «da fare» mentre la catena è già iniziata.
      if (numericMode && !parensRemain && !blockFold) {
        const va = isNumericFlat(n.a), vb = isNumericFlat(n.b);
        if (va !== null && vb !== null) {
          const s = fAdd(va, vb);
          return { node: { k: "num", v: s }, kind: "fold-add-num", detail: `${fracToLatex(va)} + ${fracToLatex(vb)}`, opLatex: `${fracToLatex(va)} + ${fracToLatex(vb)}`, answer: s };
        }
      }
      return null;
    }
    case "sub": {
      if (n.b.k === "paren") {
        const p = negatePoly(evalPoly(n.b.a));
        // GIRO 31: MAI «→ risultato» — la regola dei segni la applica lo
        // studente (answerPoly, come gli altri paren-sign); il dettaglio
        // mostra solo l'operazione da svolgere.
        return { node: polyToNode([...evalPoly(n.a), ...p]), kind: "paren-sign", detail: `${printOp(n.b, "mul-left")} \\text{ con il segno } \\text{«−»}`, answerPoly: p };
      }
      if (numericMode && !parensRemain && !blockFold) {
        const va = isNumericFlat(n.a), vb = isNumericFlat(n.b);
        if (va !== null && vb !== null) {
          const s = fSub(va, vb);
          return { node: { k: "num", v: s }, kind: "fold-add-num", detail: `${fracToLatex(va)} - ${fracToLatex(vb)}`, opLatex: `${fracToLatex(va)} - ${fracToLatex(vb)}`, answer: s };
        }
      }
      return null;
    }
    case "mul": {
      // (25/10) le proprietà delle radici su × (prodotto a stesso indice,
      // portare dentro) sono in rootPropMulDiv, chiamata PRIMA della
      // ricorsione sui figli all'inizio di reduceOnce.
      const pa = n.a.k === "paren" ? evalPoly(n.a.a) : null;
      const pb = n.b.k === "paren" ? evalPoly(n.b.a) : null;
      if (pa || pb) {
        const otherSide = pa ? n.b : n.a;
        const parenPoly = pa ?? pb!;
        const otherFlat = flatTermOf(otherSide);
        let result: Term[];
        if (otherFlat) {
          result = parenPoly.map((t) => termMul(otherFlat, t));
        } else {
          const otherPoly = evalPoly(otherSide);
          result = [];
          for (const t1 of parenPoly) for (const t2 of otherPoly) result = polyAddTerm(result, termMul(t1, t2));
        }
        // GIRO 31 (progressività assoluta): MAI il risultato svolto nel
        // dettaglio — lo scrive lo studente (answerPoly), come paren-mul
        // con esponente. Mostro solo « base × (parentesi) ».
        const detail = `${pa ? printOp(n.a, "mul-left") : printOp(n.b, "mul-left")} \\cdot ${pa ? printOp(n.b, "mul-left") : printOp(n.a, "mul-left")}`;
        return { node: polyToNode(result), kind: "paren-mul", detail, answerPoly: evalPoly(polyToNode(result)) };
      }
      const fa = flatTermOf(n.a), fb = flatTermOf(n.b);
      // (25/10) CAPOVOLGIMENTO ESPONENTE NEGATIVO: un fattore può essere la
      // frazione impilata 1/(base^k) (nodo div con fr, es. 3 · \dfrac{1}{2^2}).
      // Il prodotto si svolge come frazione: il risultato lo scrive lo
      // studente (opLatex+answer numerico, answerPoly con le lettere).
      const frFactor = (x: Node): { num: Frac; den: Frac } | null => {
        if (x.k === "div" && (x as any).fr) {
          const a = isNumericFlat((x as any).a);
          const b = isNumericFlat((x as any).b);
          if (a !== null && b !== null) return { num: a, den: b };
        }
        return null;
      };
      const faFr = fa ? null : frFactor(n.a);
      const fbFr = fb ? null : frFactor(n.b);
      if ((!parensRemain || insideParen) && ((fa && fbFr) || (faFr && fb) || (faFr && fbFr))) {
        const lt: Term | null = fa;
        const rt: Term | null = fb;
        const lf = faFr!;
        const rf = fbFr!;
        const numVal = fMul(lt ? lt.c : lf.num, rt ? rt.c : rf.num);
        const denVal = lt ? rf.den : lf.den;
        const frLatex = (f: { num: Frac; den: Frac }) =>
          f.den.n === 1 && f.den.d === 1
            ? fracToLatex(f.num)
            : `\\dfrac{${fracToLatex(f.num)}}{${fracToLatex(f.den)}}`;
        const leftLatex = lt ? termToLatex(lt) : frLatex(lf);
        const rightLatex = rt ? termToLatex(rt) : frLatex(rf);
        const opLatex = `${leftLatex} \\cdot ${rightLatex}`;
        const vars = lt && lt.vars.length ? lt.vars : rt && rt.vars.length ? rt.vars : [];
        if (vars.length === 0) {
          const res = fDiv(numVal, denVal);
          return { node: { k: "num", v: res }, kind: "mul-terms", detail: opLatex, opLatex, answer: res };
        }
        return {
          node: { k: "div", a: { k: "term", t: term(vars, numVal) }, b: { k: "num", v: denVal }, fr: true },
          kind: "mul-terms",
          detail: opLatex,
          answerPoly: [term(vars, fDiv(numVal, denVal))],
        };
      }
      // FASE PARENTESI: il prodotto ESTERNO non si anticipa (si svolgerà
      // nel punto dei monomi); DENTRO la parentesi si svolge regolarmente
      if (fa && fb && (!parensRemain || insideParen)) {
        const prod = termMul(fa, fb);
        const numerico = prod.vars.length === 0;
        return {
          node: { k: "term", t: prod },
          // (19/10) prodotto DENTRO le parentesi → «paren-prod»: il punto 2
          // lo propone allo studente invece di calcolarlo da solo
          kind: insideParen ? "paren-prod" : "mul-terms",
          // (24/10) filosofia scaffolding: il detail NON contiene MAI il
          // risultato (lo scrive lo studente); «operazione = risultato» si
          // ricostruisce solo DOPO la risposta corretta (richiesta 23/10:
          // «non deve mai trascrivere automaticamente il risultato finale di
          // un calcolo che solo l'utente deve fare»).
          detail: `${termToLatex(fa)} \\cdot ${termToLatex(fb)}`,
          ...(numerico ? { opLatex: `${termToLatex(fa)} \\cdot ${termToLatex(fb)}`, answer: prod.c } : { answerPoly: [prod] }),
        };
      }
      return null;
    }
    case "div": {
      // (25/10) divisore = frazione impilata (dal capovolgimento di un
      // esponente negativo): 5 : \dfrac{1}{2^2} → capovolgo il divisore e
      // MOLTIPLICO (5 · \dfrac{2^2}{1}); il conto resta allo studente.
      // (25/10) la proprietà del quoziente a stesso indice è in rootPropMulDiv,
      // chiamata PRIMA della ricorsione sui figli all'inizio di reduceOnce.
      // ⚠️ SOLO la forma CAPOVOLTA (numeratore = 1, es. 1/2^2): le frazioni
      // scritte dallo studente (3/7 : 9/14) seguono il percorso normale
      // (paren-div / div-num) — segnalazione 19/10, test «MAI calcolata da solo».
      if (n.b.k === "div" && (n.b as any).fr) {
        const bNum = isNumericFlat((n.b as any).a);
        const bDen = isNumericFlat((n.b as any).b);
        if (bNum !== null && bNum.n === 1 && bDen !== null && !fIsZero(bDen)) {
          if (parensRemain && !insideParen) return null;
          const flippedDivisor: Node = { k: "div", a: { k: "num", v: bDen }, b: { k: "num", v: bNum }, fr: true };
          return {
            node: { k: "mul", a: n.a, b: flippedDivisor },
            kind: "div-num",
            detail: `\\text{Esponente negativo al divisore: capovolgo e moltiplico}`,
          };
        }
      }
      const denVal = isNumericFlat(n.b);
      if (denVal !== null) {
        if (fIsZero(denVal)) throw new ExprError("Non si può dividere per zero!");
        // (7/10) frazione impilata scritta dall'utente con numeratore numerico:
        // niente passo «a : b» — la catena dei numeri la usa direttamente (già \dfrac)
        if (n.fr && isNumericFlat(n.a) !== null) return null;
        // FASE PARENTESI: la divisione ESTERNA non si anticipa; dentro la
        // parentesi si svolge regolarmente nel punto 2 (es. 6 : 2)
        if (parensRemain && !insideParen) return null;
        // (08/11, potenze simboliche) il numeratore contiene una potenza
        // SIMBOLICA: la divisione numerica non si può fare (o perderemmo la
        // forma) — la riduzione attende la proprietà della stessa base.
        if (contienePowSimbolica(n.a)) return null;
        const numPoly = evalPoly(n.a);
        const result = numPoly.map((t) => term(t.vars, fDiv(t.c, denVal)));
        // ⚠️ MAI scrivere nel RICOPIA il risultato ridotto di una divisione
        // non esatta (es. «2 : 12 = 1 : 6»): il «1 : 6» con i due punti non
        // va scritto. Il dettaglio mostra solo l'operazione da svolgere;
        // il risultato frazionario compare SOLO nel risultato finale.
        // (7/10) frazione impilata scritta dall'utente: NON è un conto, è solo
        // notazione — niente dettaglio (la notazione si vede già nell'espressione)
        // (24/10) filosofia scaffolding: il detail NON contiene MAI il
        // risultato (solo l'operazione da svolgere); «operazione = risultato»
        // si ricostruisce solo DOPO la risposta corretta.
        const detail = n.fr
          ? ""
          : `${printOp(n.a, "mul-left")} : ${fracToLatex(denVal)}`;
        const risultatoNumerico = result.length === 1 && result[0].vars.length === 0;
        return {
          node: polyToNode(result),
          // (19/10) divisione DENTRO le parentesi → «paren-div»: il punto 2
          // la propone allo studente invece di calcolarla da sola
          kind: insideParen ? "paren-div" : "div-num",
          detail,
          // GIRO 30: risultato con lettere → answerPoly (input dello studente);
          // la fratta impilata scritta dall'utente NON è un conto: niente input.
          ...(risultatoNumerico
            ? { opLatex: `${printOp(n.a, "mul-left")} : ${fracToLatex(denVal)}`, answer: result[0].c }
            : n.fr
            ? {}
            : { answerPoly: result }),
        };
      }
      // (25/10, punto 1) frazione impilata (fr) con numeratore numerico e
      // denominatore con LETTERE (es. 1/x² del capovolgimento, o 2/x scritta
      // dall'utente): è NOTAZIONE FINALE, non un conto da svolgere.
      if (n.fr && isNumericFlat(n.a) !== null) return null;
      // divisione tra MONOMI (proprietà dei quozienti: x⁶ : x⁴ = x²)
      const denFlat = flatTermOf(n.b);
      if (denFlat && denFlat.vars.length > 0) {
        // FASE PARENTESI: la divisione ESTERNA non si anticipa (come div-num)
        if (parensRemain && !insideParen) return null;
        // (08/11, potenze simboliche) come div-num: niente valutazione con
        // potenze simboliche nel numeratore.
        if (contienePowSimbolica(n.a)) return null;
        const numPoly = evalPoly(n.a);
        const result = numPoly.map((t) => termDivide(t, denFlat));
        const opStr = `${printOp(n.a, "div-left")} : ${printOp(n.b, "div-right")}`;
        // (24/10) filosofia scaffolding: il detail NON contiene MAI il
        // risultato (solo l'operazione da svolgere); «operazione = risultato»
        // si ricostruisce solo DOPO la risposta corretta.
        const detail = opStr;
        const risultatoNumerico = result.length === 1 && result[0].vars.length === 0;
        return {
          node: polyToNode(result),
          kind: "div-mono",
          detail,
          // GIRO 30: risultato con lettere → answerPoly (input dello studente)
          ...(risultatoNumerico ? { opLatex: opStr, answer: result[0].c } : { answerPoly: result }),
        };
      }
      // (08/11, potenze simboliche) con potenze simboliche nel denominatore
      // la valutazione polinomiale si salta (mai errori né falsi allarmi).
      // (10/11, foto «frazione di due somme con radicali») denominatore con
      // LETTERE o con radicali non semplificabili: la fratta resta INDICATA
      // (nessun errore bloccante: l'esercizio lo prepara la costruzione IA).
      const denEval = (() => { try { return evalPoly(n.b); } catch { return null; } })();
      if (
        denFlat === null && !contienePowSimbolica(n.b) && denEval !== null &&
        (denEval.length > 1 || (denEval.length === 1 && denEval[0].vars.length > 0))
      ) {
        return null;
      }
      return null;
    }
    case "root": {
      // FASE PARENTESI: come per √, la radice ESTERNA non si anticipa
      if (parensRemain && !insideParen) return null;
      const idx = n.n;
      // (10/11) RADICE CON INDICE NEGATIVO (es. ⁻³√(8)): esiste in matematica
      // ma l'app NON la semplifica — resta INDICATA, nessun valore anticipato
      if (idx < 0) return null;
      const rootLatex = (x: string) => `\\sqrt[${idx}]{${x}}`;
      const numVal = isNumericFlat(n.a);
      if (numVal !== null) {
        const val = nthRootFrac(numVal, idx);
        return {
          node: { k: "num", v: val },
          kind: insideParen ? "paren-prod" : "root",
          detail: rootLatex(printNode(n.a)),
          opLatex: rootLatex(printNode(n.a)),
          answer: val,
        };
      }
      const flat = flatTermOf(n.a);
      if (flat) {
        // (25/10) PROPRIETÀ DELLE RADICI: prima le riscritture segnalate
        // (trasformazione in potenza, MCD, porta fuori), poi lo svolgimento.
        const prop = rootPropRewrite(flat, idx);
        if (prop) return { node: prop.node, kind: "root-prop", detail: prop.detail };
        // (10/11) esponenti NON multipli dell'indice (es. ∛(ab⁻¹), ∛(a⁻²b/x)):
        // la radice resta INDICATA invece di bloccare l'analisi con un errore.
        let t: Term;
        try { t = nthRootTerm(flat, idx); } catch { return null; }
        const numerico = t.vars.length === 0;
        return {
          node: { k: "term", t },
          kind: insideParen ? "paren-prod" : "root",
          // (24/10) solo l'operazione; il risultato lo scrive lo studente
          detail: `${rootLatex(printNode(n.a))}${rootMcdHint(flat, idx) ?? ""}`,
          // GIRO 30: risultato con lettere → answerPoly (input dello studente)
          ...(numerico ? { opLatex: rootLatex(printNode(n.a)), answer: t.c } : { answerPoly: [t] }),
        };
      }
      return null;
    }
    case "sqrt": {
      // FASE PARENTESI: come per potenze e divisioni, la radice ESTERNA non
      // si anticipa finché ci sono parentesi da sciogliere
      if (parensRemain && !insideParen) return null;
      const numVal = isNumericFlat(n.a);
      if (numVal !== null) {
        const val = sqrtFrac(numVal);
        return {
          node: { k: "num", v: val },
          // (19/10) radice DENTRO le parentesi → «paren-prod» (punto 2)
          kind: insideParen ? "paren-prod" : "sqrt",
          detail: `\\sqrt{${printNode(n.a)}}`,
          opLatex: `\\sqrt{${printNode(n.a)}}`,
          answer: val,
        };
      }
      const flat = flatTermOf(n.a);
      if (flat) {
        // (25/10) PROPRIETÀ DELLE RADICI (anche per l'indice 2): trasformazione
        // in potenza, semplificazione MCD e porta fuori, poi lo svolgimento.
        const prop = rootPropRewrite(flat, 2);
        if (prop) return { node: prop.node, kind: "root-prop", detail: prop.detail };
        // (10/11) esponenti DISPARI nel radicando (es. √(ab⁻¹)): la radice
        // resta INDICATA invece di bloccare l'analisi con un errore.
        let t: Term;
        try { t = sqrtTerm(flat); } catch { return null; }
        const numerico = t.vars.length === 0;
        return {
          node: { k: "term", t },
          kind: insideParen ? "paren-prod" : "sqrt",
          // (24/10) solo l'operazione; il risultato lo scrive lo studente
          detail: `\\sqrt{${printNode(n.a)}}${rootMcdHint(flat, 2) ?? ""}`,
          // GIRO 30: risultato con lettere → answerPoly (input dello studente)
          ...(numerico ? { opLatex: `\\sqrt{${printNode(n.a)}}`, answer: t.c } : { answerPoly: [t] }),
        };
      }
      return null;
    }
    case "powfrac": {
      // (25/10, punto 2) ESPONENTE FRAZIONARIO = RADICE, riscrittura
      // SEGNALATA: il denominatore dell'esponente è l'indice della radice,
      // il numeratore resta esponente. Forma con numeri PICCOLI: prima la
      // radice (ⁿ√base), poi la potenza m — mai base^m gigantesco sotto
      // radice (16^(3/4) → (∜16)³ = 2³ = 8, non ∜4096).
      // indice 2 → nodo sqrt (√ senza indice, stile libro)
      const radice: Node = n.n === 2 ? { k: "sqrt", a: n.a } : { k: "root", n: n.n, a: n.a };
      const inner: Node = n.m === 1 ? radice : { k: "pow", a: radice, e: n.m };
      return {
        node: inner,
        kind: "pow-frac",
        detail: `\\text{Esponente frazionario } \\tfrac{${n.m}}{${n.n}}\\text{: il denominatore } ${n.n} \\text{ è l'indice della radice${n.m === 1 ? "" : `, il numeratore ${n.m} resta esponente`}\\text{.}}`,
      };
    }
    case "pow": {
      // (24/10-fix) POTENZA NEGATIVA: a^(-k) = 1 : (a^k). PRIMA riscrittura:
      // il nodo diventa una DIVISIONE esplicita 1 : base^k (detail = solo
      // l'operazione, MAI il risultato). Poi la divisione si svolge nel suo
      // punto come tutte le altre. Vale per OGNI base (numero, monomio,
      // parentesi): la guardia «k:pow» sotto non scatta più sul negativo.
      if (n.e < 0) {
        // (24/10, scaffolding giro 29: il detail NON contiene MAI il
        // risultato — solo l'operazione da svolgere, come ogni altro passo).
        // Con lettere (x^-2) il reciproco 1 : x^2 darebbe esponenti negativi
        // sui monomi (l'app non li supporta): si mostra la riscrittura come
        // NOTA col libro (senza risposta da dare), poi la potenza sparisce
        // dal flusso (non si può svolgere oltre). Detail = solo riscrittura.
        // (25/10, punto 1) ANCHE CON LETTERE: capovolgimento SEGNALATO
        // x^-2 → 1/x² (prima: errore «l'app non le svolge»). La potenza
        // positiva al denominatore (es. x²) la svolge lo studente nel passo
        // pow-term; la frazione impilata 1/x² è notazione finale (guard
        // «fr + numeratore numerico» nel caso div qui sotto).
        const posPowL: Node = { k: "pow", a: n.a, e: -n.e };
        const flippedL: Node = { k: "div", a: { k: "num", v: fOne }, b: posPowL, fr: true };
        if ((() => { try { return evalPoly(n.a).some((t) => t.vars.length > 0); } catch { return true; } })()) {
          return {
            node: flippedL,
            kind: "pow-flip",
            detail: `\\text{Esponente negativo: capovolgo (reciproco)}\\;\\Rightarrow\\;${printLatex(flippedL)}`,
          };
        }
        const posPow: Node = { k: "pow", a: n.a, e: -n.e };
        // (08/11, potenze simboliche) se lo svolgimento della potenza
        // positiva supera i 2^{53} (es. 2^3 : 2^70 → 1/(2^67)) la potenza al
        // denominatore resta SIMBOLICA: la frazione impilata è notazione
        // finale, come per le lettere — lo studente non può scrivere 2^67.
        if (potenzaSballa(n.a, -n.e)) powSimboliche.add(posPow);
        const flipped: Node = { k: "div", a: { k: "num", v: fOne }, b: posPow, fr: true };
        // (25/10, richiesta utente) CAPOVOLGIMENTO AUTOMATICO CON SEGNALAZIONE:
        // l'app capovolge DA SOLA il numero con esponente negativo nella
        // frazione impilata 1/(base^k) e SEGNA l'avvenuto capovolgimento nel
        // detail. NESSUN input richiesto in questo passo (niente opLatex/answer
        // — il vecchio answer era un Node, non un Frac: per questo 1/4 risultava
        // sempre «sbagliato»). La potenza positiva al denominatore (es. 2^2)
        // la svolge lo studente nel passo successivo (ramo pow positivo qui
        // sotto), poi la frazione impilata 1/risultato è già notazione finale.
        return {
          node: flipped,
          // (25/10-fix) kind dedicato: è una RISCRITTURA SEGNALATA (nessun
          // input), non un calcolo tiped — prima usava "pow-term" e l'audit
          // di progressività lo segnava come stato senza input (valeva anche
          // per 2^-2 da sola, violazione pre-esistente). Ora è in
          // KINDS_SOLA_NOTAZIONE come pow-prop/root-prop.
          kind: "pow-flip",
          detail: `\\text{Esponente negativo: capovolgo il numero (reciproco)}\\;\\Rightarrow\\;${printLatex(flipped)}`,
        };
      }
      // (08/11, potenze simboliche) potenza prodotta da una proprietà in
      // modalità simbolica: NON si svolge numericamente — è un risultato
      // notazionale come un monomio con le lettere. Se resta da sola,
      // l'espressione è arrivata al risultato (es. 2^{57}). Il capovolgimento
      // dell'esponente negativo (sopra) resta sempre possibile.
      if (powSimboliche.has(n)) return null;
      if (n.a.k === "paren") {
        const numVal = isNumericFlat(n.a.a);
        if (numVal !== null) {
          const val = evalPoly({ k: "pow", a: { k: "num", v: numVal }, e: n.e })[0].c;
          return {
            node: { k: "num", v: val },
            kind: "paren-value",
            detail: `${wrapParen(n.a.b, printNode(n.a.a))}^{${n.e}}`,
            opLatex: `${wrapParen(n.a.b, printNode(n.a.a))}^{${n.e}}`,
            answer: val,
          };
        }
        // (a+b)^n → prodotto ripetuto — NOTA (25/10, punto 3): il caso
        // base-monoomio ((2x)³, (x/2)²) è intercettato dal PRE-CHECK
        // pow-prod all'inizio di reduceOnce, PRIMA che la ricorsione
        // sciolga la parentesi in silenzio (paren-unwrap).
        const inner = n.a.a;
        let expanded: Node = inner;
        for (let i = 1; i < n.e; i++) expanded = { k: "mul", a: expanded, b: { k: "paren", a: inner } };
        // GIRO 29: niente svolto di già — solo l'operazione col promemoria.
        // GIRO 30: il risultato svolto lo scrive lo studente (answerPoly).
        return { node: { k: "paren", a: expanded }, kind: "paren-mul", detail: `${printOp(n.a, "pow-base")}^{${n.e}} (moltiplico ${n.e} volte)`, answerPoly: evalPoly(expanded) };
      }
      const flat = flatTermOf(n.a);
      // FASE PARENTESI: la potenza ESTERNA non si anticipa
      if (flat && (!parensRemain || insideParen)) {
        const prod = termPow(flat, n.e);
        const numerico = prod.vars.length === 0;
        void numerico;
        // ⚠️ STAMPA DELL'OPERAZIONE (27/9-decies, «potenza di potenza»):
        // la base NUMERICA positiva e intera NON va avvolta in \left( \right):
        // per (2²)² l'operazione interna 2² compariva come «(2)²» e sembrava
        // che l'esponente interno fosse perso. Le parentesi restano SOLO se
        // servono davvero: base negativa ((−2)²), frazionaria ((3/2)²) o con
        // lettere ((2x)² — altrimenti «2x²» si leggerebbe 2·(x²)).
        const baseSimple = flat.vars.length === 0 && flat.c.d === 1 && flat.c.n >= 0;
        const baseLatex = baseSimple ? termToLatex(flat) : `\\left(${termToLatex(flat)}\\right)`;
        return {
          node: { k: "term", t: prod },
          // (19/10) potenza DENTRO le parentesi → «paren-prod» (punto 2)
          kind: insideParen ? "paren-prod" : "pow-term",
          // (24/10) filosofia scaffolding: il detail NON contiene MAI il
          // risultato (solo l'operazione da svolgere).
          detail: `${baseLatex}^{${n.e}}`,
          // GIRO 30: risultato con lettere → answerPoly (input dello studente)
          ...(numerico ? { opLatex: `${baseLatex}^{${n.e}}`, answer: prod.c } : { answerPoly: [prod] }),
        };
      }
      return null;
    }
    default:
      return null;
  }
}

// ─── Raggruppamento monomi simili ─────────────────────────────────

export interface GroupColor { name: string; hex: string }

export const GROUP_COLORS: GroupColor[] = [
  // (25/10, punto 5) palette DISTINGUIBILI anche con daltonismo
  // (deuteranopia/protanopia — ispirata alla palette Okabe-Ito): arancione
  // vs verde e blu vs viola erano quasi indistinguibili per i daltonici.
  // I NOMI restano invariati (sono mostrati accanto al campione colore).
  { name: "arancione", hex: "#E69F00" },
  { name: "marrone", hex: "#7B3F00" },
  { name: "blu", hex: "#0072B2" },
  { name: "verde", hex: "#009E73" },
  { name: "viola", hex: "#6A3D9A" },
  { name: "rosa", hex: "#CC79A7" },
  { name: "azzurro", hex: "#56B4E9" },
  { name: "grigio", hex: "#6B7280" },
];

export interface TermGroup {
  key: string;
  color: GroupColor;
  /** Parte letterale del gruppo (variabili con esponenti) */
  vars: { v: string; e: number }[];
  /** LaTeX del monomio tipo (parte letterale con coefficiente 1) */
  typeLatex: string;
  /** LaTeX dei singoli termini del gruppo (con segno) */
  termLatexes: string[];
  /** Somma esatta dei coefficienti */
  sum: Frac;
  /** il gruppo richiede l'input dello studente? (almeno 2 termini) */
  needsInput: boolean;
  degree: number;
}

function collectFlatTerms(n: Node): Term[] {
  switch (n.k) {
    case "term": return [n.t];
    case "num": return n.v.n === 0 ? [] : [term([], n.v)];
    case "var": return [term([{ v: n.name, e: 1 }], fOne)];
    case "add": return [...collectFlatTerms(n.a), ...collectFlatTerms(n.b)];
    case "sub": return [...collectFlatTerms(n.a), ...negatePoly(collectFlatTerms(n.b))];
    case "neg": return negatePoly(collectFlatTerms(n.a));
    case "paren": return collectFlatTerms(n.a);
    default: return evalPoly(n);
  }
}

function buildGroups(terms: Term[]): TermGroup[] {
  const map = new Map<string, TermGroup>();
  for (const t of terms) {
    const key = termKey(t);
    if (!map.has(key)) {
      const vars = t.vars.map((x) => ({ ...x }));
      const idx = map.size;
      map.set(key, {
        key,
        color: GROUP_COLORS[idx % GROUP_COLORS.length],
        vars,
        typeLatex: vars.length === 0 ? "\\text{numero}" : varLatex(vars),
        termLatexes: [],
        sum: fZero,
        needsInput: false,
        degree: termDegree(t),
      });
    }
    const g = map.get(key)!;
    g.termLatexes.push(termToLatex(t, "auto"));
    g.sum = fAdd(g.sum, t.c);
  }
  const groups = [...map.values()];
  for (const g of groups) g.needsInput = g.termLatexes.length >= 2;
  groups.sort((a, b) => (b.degree - a.degree) || (a.key < b.key ? -1 : 1));
  return groups;
}

/** LaTeX dell'espressione piatta con i termini COLORATI per gruppo */
export function coloredFlatLatex(terms: Term[], groups: TermGroup[]): string {
  const colorOf = new Map<string, GroupColor>();
  for (const g of groups) colorOf.set(g.key, g.color);
  if (terms.length === 0) return "0";
  return terms
    .map((t, i) => {
      const c = colorOf.get(termKey(t))!;
      const abs = termToLatex({ c: { n: Math.abs(t.c.n), d: t.c.d }, vars: t.vars }, "auto");
      const body = i === 0
        ? (t.c.n < 0 ? `-${abs}` : abs)
        : (t.c.n < 0 ? ` - ${abs}` : ` + ${abs}`);
      return `{\\color{${c.hex}}${body}}`;
    })
    .join("");
}

// ─── Verifica per sostituzione ────────────────────────────────────

const VERIFICATION_VALUES = [2, 3, 5, 7, 11, 13];

export function substituteAndEvaluate(n: Node, values: Map<string, number>): number {
  const poly = evalPoly(n);
  let total = 0;
  for (const t of poly) {
    let v = t.c.n / t.c.d;
    for (const { v: name, e } of t.vars) v *= Math.pow(values.get(name) ?? 1, e);
    total += v;
  }
  return Math.round(total * 100) / 100;
}

export function buildVerificationValues(n: Node): { values: Map<string, number>; label: string } {
  const vars = new Set<string>();
  const walk = (m: Node) => {
    if (m.k === "var") vars.add(m.name);
    else if (m.k === "term") m.t.vars.forEach((x) => vars.add(x.v));
    else if (m.k === "add" || m.k === "sub" || m.k === "mul" || m.k === "div") { walk(m.a); walk(m.b); }
    else if (m.k === "neg" || m.k === "paren" || m.k === "pow" || m.k === "powfrac") walk(m.a);
  };
  walk(n);
  const values = new Map<string, number>();
  let i = 0;
  for (const v of [...vars].sort()) values.set(v, VERIFICATION_VALUES[i++ % VERIFICATION_VALUES.length]);
  const label = [...values.entries()].map(([k, v]) => `${k} = ${v}`).join(",\\; ");
  return { values, label };
}

// ─── Analisi completa ─────────────────────────────────────────────

// ─── Riparazione segno di divisione (riconoscimento a mano) ──────

/** Il modello di riconoscimento della scrittura (CoMER/ONNX) NON ha il
 *  token ":" nel vocabolario: i due puntini della divisione vengono
 *  scambiati per =, .., \cdot\cdot, \cdots, \div ecc. In un'espressione
 *  dell'app l'uguale non compare mai, quindi qui TUTTI questi casi
 *  vengono convertiti in ":" (che normalizeInput trasforma in divisione). */
export function repairDivisionSigns(latex: string): string {
  return latex
    .replace(/\\div/g, ":") // ÷ con la lineetta
    .replace(/\\[cl]?dots/g, ":") // puntini letti come ellissi
    .replace(/\\cdot\s*\\cdot/g, ":") // due puntini letti come due cdot
    .replace(/\.\s*\\cdot|\\cdot\s*\./g, ":") // due puntini letti misti (·. o .·)
    .replace(/\.\s+\./g, "..") // due puntini separati da spazio → in fila
    .replace(/\.{2,}/g, ":") // due o più punti in fila
    .replace(/\\times/g, "\\cdot") // croce sintetica del puntino isolato
    .replace(/\\bullet/g, "\\cdot") // puntino letto come proiettile
    // ⚠️ REGOLA 27/9-ter: la moltiplicazione si scrive SEMPRE e SOLO come
    // puntino, MAI come «x» (si confonde con la variabile). Una «x» fra
    // DUE CIFRE non può essere una variabile (sarebbe 2·x·3 senza alcun
    // operatore, e il suggerimento dell'app dice di tracciare la × piccola
    // per ·): è la moltiplicazione disegnata letta «x» dal modello → \cdot.
    // Le «x» laterali (2x, x3, 2x(3+1)) restano variabili legittime.
    .replace(/(\d)\s*x(?=\s*\d)/g, "$1 \\cdot ") // lookahead: copre anche 2x3x4
    .replace(/\s{2,}/g, " ") // normalizza gli spazi doppi della lookahead
    .replace(/\//g, ":") // barra tracciata (o sintetica da rewriteDotSigns)
    // due puntini (o ÷ sbiadito) letti come uguale: SOLO se l'«=» sta
    // fra due operandi. Un «=» finale (l'utente chiude spesso
    // l'espressione con l'uguale) deve RESTARE uguale: l'app calcola
    // il primo membro e ignora ciò che segue l'«=» (segnalazione 26/9:
    // «…]=» diventava «…]:» e l'espressione si rompeva).
    .replace(
      /([0-9a-zA-Z\)\}\]])\s*=\s*(?=[0-9a-zA-Z\(\[\{\\-])/g,
      "$1 : ",
    )
    // Puntino SINGOLO tra due operandi → moltiplicazione: è il puntino
    // alto ( · ) disegnato (3 · 4). L'app non usa mai il punto decimale
    // nelle espressioni, quindi non c'è ambiguità.
    .replace(/([0-9a-z\)\}\]])\s*\.\s*([0-9a-z\(\[\{\\])/g, "$1 \\cdot $2");
}

// ─── Parentesi INUTILI: segnalazione + riscrittura senza ─────────

export interface UselessParenNote {
  /** Il pezzo con la parentesi, con l'operazione accanto (es. «3 · (21 : 2)») */
  withParens: string;
  /** Lo stesso pezzo riscritto senza la parentesi (es. «3 · 21 : 2») */
  without: string;
  /** Spiegazione breve del perché la parentesi non serve */
  reason: string;
}

type ParenCtx = { op: "+" | "-" | "*" | "/" | "^" | "neg" | "root"; side: "left" | "right" | "only" };

const isAtomNode = (n: Node): boolean => n.k === "num" || n.k === "var" || n.k === "term";

const REM_CHAIN = "× e : hanno la stessa priorità e si calcola da sinistra a destra: il risultato non cambia";
const REM_ATOM = "dentro c'è un solo numero: le parentesi non aggiungono nulla";
const REM_PMD = "il contenuto ha solo prodotti e divisioni, che si calcolano comunque prima di + e −";

/** La parentesi con questo contenuto, in questo contesto, è rimovibile
 *  senza cambiare il valore? Restituisce il motivo, o null se serve. */
function removableParenReason(inner: Node, ctx: ParenCtx): string | null {
  // Con un +/− dentro le parentesi servono (o richiedono la regola dei
  // segni): NON sono «inutili», le gestiscono i passi paren-sign.
  if (inner.k === "add" || inner.k === "sub" || inner.k === "neg") return null;
  if (isAtomNode(inner)) return REM_ATOM;
  // da qui in poi inner è una catena di solo × e :
  if (ctx.op === "*") return REM_CHAIN;
  if (ctx.op === "/" && ctx.side === "left") return REM_CHAIN; // (2·3) : 4 = 2·3 : 4
  if (ctx.op === "/" && ctx.side === "right") return null; // 2 : (3·4): servono!
  if (ctx.op === "^") return null; // (2·3)²: servono!
  // +, −, − unario e inizio espressione: i prodotti/divisioni si
  // calcolano comunque prima di + e −
  return REM_PMD;
}

/** C'è almeno una parentesi con + o − dentro, preceduta da + o −
 *  (o da meno unario)? In quel caso va ricordata la REGOLA DEI SEGNI.
 *  Serve il controllo sull'AST: le parentesi numeriche vengono risolte
 *  dai passi paren-value senza creare passi paren-sign. */
export function needsSignRule(ast: Node): boolean {
  let found = false;
  const visit = (n: Node): void => {
    if (found) return;
    if (n.k === "add" || n.k === "sub") {
      if (n.b.k === "paren" && (n.b.a.k === "add" || n.b.a.k === "sub")) found = true;
      visit(n.a);
      visit(n.b);
    } else if (n.k === "mul" || n.k === "div") {
      visit(n.a);
      visit(n.b);
    } else if (n.k === "neg") {
      if (n.a.k === "paren" && (n.a.a.k === "add" || n.a.a.k === "sub")) found = true;
      visit(n.a);
    } else if (n.k === "pow" || n.k === "powfrac" || n.k === "root" || n.k === "paren") visit(n.a);
    // i valori razionali (fratte) non contengono regole dei segni da ricordare
  };
  visit(ast);
  return found;
}

/** Cerca nell'AST originale tutte le parentesi realmente inutili,
 *  con la riscrittura senza parentesi e il motivo per ognuna. */
export function uselessParenNotes(ast: Node): UselessParenNote[] {
  const notes: UselessParenNote[] = [];
  const visit = (n: Node, ctx: ParenCtx): void => {
    switch (n.k) {
      case "mul":
      case "div":
      case "add":
      case "sub": {
        const opStr = n.k === "mul" ? " \\cdot " : n.k === "div" ? " : " : n.k === "add" ? " + " : " - ";
        const checkChild = (which: "a" | "b") => {
          const child = which === "a" ? n.a : n.b;
          const other = which === "a" ? n.b : n.a;
          const side: "left" | "right" = which === "a" ? "left" : "right";
          // ⚠️ simbolo dell'operazione ("*"), non il nome del nodo ("mul"):
          // removableParenReason confronta con * / + -
          const opSym: ParenCtx["op"] = n.k === "mul" ? "*" : n.k === "div" ? "/" : n.k === "add" ? "+" : "-";
          const childCtx: ParenCtx = { op: opSym, side };
          if (child.k === "paren") {
            const reason = removableParenReason(child.a, childCtx);
            if (reason) {
              const withP = `\\left(${printNode(child.a)}\\right)`;
              const wo = printNode(child.a);
              notes.push({
                withParens: which === "a" ? withP + opStr + printNode(other) : printNode(other) + opStr + withP,
                without: which === "a" ? wo + opStr + printNode(other) : printNode(other) + opStr + wo,
                reason,
              });
            }
            visit(child.a, childCtx);
          } else visit(child, childCtx);
        };
        checkChild("a");
        checkChild("b");
        return;
      }
      case "neg": {
        const child = n.a;
        if (child.k === "paren") {
          const reason = removableParenReason(child.a, { op: "neg", side: "only" });
          if (reason)
            notes.push({ withParens: `-\\left(${printNode(child.a)}\\right)`, without: `-${printNode(child.a)}`, reason });
          visit(child.a, { op: "neg", side: "only" });
        } else visit(child, { op: "neg", side: "only" });
        return;
      }
      case "pow": {
        const child = n.a;
        if (child.k === "paren") {
          if (isAtomNode(child.a))
            notes.push({
              withParens: `\\left(${printNode(child.a)}\\right)^{${n.e}}`,
              without: `${printNode(child.a)}^{${n.e}}`,
              reason: REM_ATOM,
            });
          visit(child.a, { op: "^", side: "only" });
        } else visit(child, { op: "^", side: "only" });
        return;
      }
      case "root": {
        visit(n.a, { op: "root", side: "only" });
        return;
      }
      case "paren": {
        // parentesi a livello radice (o trasparente): stessa posizione del padre.
        // Doppia nidificazione ((x)): segnala solo la più esterna.
        if (n.a.k === "paren") { visit(n.a, ctx); return; }
        const reason = removableParenReason(n.a, ctx);
        if (reason) notes.push({ withParens: `\\left(${printNode(n.a)}\\right)`, without: printNode(n.a), reason });
        visit(n.a, ctx);
        return;
      }
      default:
        return;
    }
  };
  visit(ast, { op: "root", side: "only" });
  return notes;
}

export interface Analysis {
  /** LaTeX dell'espressione originale (normalizzata) */
  originalLatex: string;
  /** Parentesi realmente inutili, con riscrittura e motivo (possono essere 0) */
  uselessParens: UselessParenNote[];
  /** true se nel percorso compare la regola dei segni (parentesi con + o − davanti) */
  signRuleNeeded: boolean;
  /** Passi di riduzione (il primo è l'espressione stessa) */
  steps: ExprStep[];
  /** true se l'espressione contiene lettere */
  hasVars: boolean;
  /** Monomi risultanti (senza parentesi) */
  flatTerms: Term[];
  /** Gruppi di monomi simili */
  groups: TermGroup[];
  /** Polinomio ridotto finale */
  finalPoly: Term[];
  finalLatex: string;
  /** (08/11, potenze simboliche) LaTeX del risultato finale quando resta
   *  una POTENZA simbolica (es. «2^{57}»): finalPoly/finalLatex restano
   *  vuoti e la UI mostra questo. */
  finalSymbolicLatex?: string;
  /**true se ci sono stati passi con parentesi */
  hadParentheses: boolean;
  /** AST originale (per la verifica per sostituzione) */
  ast: Node;
}

/** ⚠️ SEGNO GIUSTO NELL'OPERAZIONE: −(2·6) NON deve essere svolto come
 *  «2 · 6 = 12» con il meno applicato dopo! Prima della riduzione il meno
 *  passa al primo fattore (regola dei segni, SENZA calcolare): così lo
 *  studente svolge «−2 · 6 = −12». Stessa cosa per la divisione. */
export function pushNegThrough(n: Node): Node {
  if (n.k === "neg" && (n.a.k === "mul" || n.a.k === "div")) {
    const inner = n.a;
    const first = inner.a;
    const negFirst: Node =
      first.k === "num" ? { k: "term", t: term([], fNeg(first.v)) } :
      first.k === "term" ? { k: "term", t: term(first.t.vars, fNeg(first.t.c)) } :
      first.k === "neg" ? first.a : { k: "neg", a: first };
    const rebuilt: Node = inner.k === "mul" ? { k: "mul", a: negFirst, b: inner.b } : { k: "div", a: negFirst, b: inner.b, fr: inner.fr };
    return pushNegThrough(rebuilt);
  }
  if (n.k === "add") return { k: "add", a: pushNegThrough(n.a), b: pushNegThrough(n.b) };
  if (n.k === "sub") return { k: "sub", a: pushNegThrough(n.a), b: pushNegThrough(n.b) };
  if (n.k === "mul") return { k: "mul", a: pushNegThrough(n.a), b: pushNegThrough(n.b) };
  if (n.k === "div") return { k: "div", a: pushNegThrough(n.a), b: pushNegThrough(n.b), fr: n.fr };
  if (n.k === "neg") return { k: "neg", a: pushNegThrough(n.a) };
  if (n.k === "paren") return { k: "paren", a: pushNegThrough(n.a), b: n.b };
  if (n.k === "pow") return { k: "pow", e: n.e, a: pushNegThrough(n.a) };
  if (n.k === "powfrac") return { k: "powfrac", m: n.m, n: n.n, a: pushNegThrough(n.a) };
  if (n.k === "root") return { k: "root", n: n.n, a: pushNegThrough(n.a) };
  return n;
}

export function analyzeExpression(raw: string): Analysis {
  const normalized = normalizeInput(raw);
  const ast = pushNegThrough(parseExpression(normalized));
  // Anche i vecchi passi guidati non devono trasformare √x² in x senza
  // ipotesi sul segno: intercettiamo i casi che richiedono il valore assoluto.
  const checkRealRoots = (n: Node): void => {
    if (n.k === "add" || n.k === "sub" || n.k === "mul" || n.k === "div") {
      checkRealRoots(n.a); checkRealRoots(n.b);
    } else if (n.k === "neg" || n.k === "paren" || n.k === "pow" || n.k === "powfrac" || n.k === "sqrt" || n.k === "root") {
      checkRealRoots(n.a);
    }
    if (n.k === "sqrt" || (n.k === "root" && n.n % 2 === 0)) {
      try { evalPoly(n); }
      catch (err) {
        if (err instanceof Error && /valore assoluto/i.test(err.message)) throw err;
      }
    }
  };
  checkRealRoots(ast);
  const hasVars = (() => {
    try { return evalPoly(ast).some((t) => t.vars.length > 0); } catch { return true; }
  })();

  // (08/11, potenze simboliche) l'espressione INTERA non è calcolabile in
  // modo esatto (i valori superano 2^{53}, es. 2^{57}) ed è fatta solo di
  // potenze a base numerica: le proprietà delle potenze restano SIMBOLICHE
  // e lo studente digita gli ESPONENTI (numeri piccoli), come sul libro.
  // ⚠️ NON si usa !hasVars: qui evalPoly trabocca PRIMA di dire se ci sono
  // lettere (il catch lo confonde) — isPuraPotenze già esclude le lettere
  // da sola (var/term con lettere → false).
  modalitaSimbolica = isPuraPotenze(ast) && (() => {
    try { evalPoly(ast); return false; } catch { return true; }
  })();

  const steps: ExprStep[] = [{ latex: printLatex(ast), kind: "paren-unwrap", detail: "" }];
  let current = ast;
  for (let i = 0; i < 80; i++) {
    // parentesi all'inizio (radice): nessun segno davanti → si scioglie.
    // (25/10) MA se dentro c'è una potenza con esponente NEGATIVO non si
    // appiattisce in silenzio (flatTermOf valuterebbe 2^-2 = 1/4 senza
    // chiedere nulla): si lascia il contenuto al motore, che farà il
    // capovolgimento automatico col suo passo segnalato.
    if (current.k === "paren") {
      const inner = current.a;
      const hasNegPow = (m: Node): boolean => {
        if (m.k === "pow" && m.e < 0) return true;
        if (m.k === "add" || m.k === "sub" || m.k === "mul" || m.k === "div") return hasNegPow(m.a) || hasNegPow(m.b);
        if (m.k === "neg" || m.k === "paren" || m.k === "pow" || m.k === "powfrac" || m.k === "sqrt" || m.k === "root") return hasNegPow(m.a);
        return false;
      };
      // (08/11, potenze simboliche) come sopra: una potenza simbolica nel
      // contenuto non si appiattisce mai in numero.
      const flat = hasNegPow(inner) || contienePowSimbolica(inner) ? null : flatTermOf(inner);
      current = flat ? { k: "term", t: flat } : inner;
      steps.push({ latex: printLatex(current), kind: "paren-unwrap", detail: "" });
      continue;
    }
    // ⚠️ FASE ×/: PRIMA della catena: finché c'è anche solo un prodotto,
    // una divisione o una potenza da svolgere, i ± non partono (blockFold).
    // Così la catena comincia quando l'espressione è già tutta numeri.
    const parens = containsParen(current);
    let r = reduceOnce(current, !hasVars, parens, false, true);
    if (!r) r = reduceOnce(current, !hasVars, parens);
    if (!r) break;
    current = r.node;
    // Salta i passi che non cambiano visivamente l'espressione
    // (es. la fusione interna di 2x da mul(2,x) a monomio).
    // ⚠️ MAI scartare un passo che contiene un'operazione da SVOLGERE
    // (opLatex+answer): anche se il testo non cambia (es. la divisione
    // 21 : 2 resta «21 : 2» anche dopo essere diventata valore), lo
    // studente deve poterla svolgere.
    const latex = printLatex(current);
    // (GIRO 30) un passo con answerPoly ma latex IDENTICO al precedente è
    // solo una fusione interna dell'albero (es. 5·x dentro 5x·1): si salta,
    // il conto vero lo chiede il passo successivo (es. «5x · 1 = ___»).
    // ⚠️ (25/10) ECCEZIONE: se il passo precedente è una riscrittura-
    // proprietà (pow-prop/root-prop), il passo tiped che segue È il calcolo
    // dello studente (es. x⁶:x² → riscrittura x³ → lo studente scrive x³):
    // il latex è identico ma NON va scartato.
    const prevIsPropRewrite =
      steps[steps.length - 1].kind === "pow-prop" || steps[steps.length - 1].kind === "root-prop";
    if (
      latex === steps[steps.length - 1].latex &&
      // (25/10) il passo pow-prop mostra APPOSTO l'espressione intera (entrambe
      // le potenze) con la spiegazione: latex identico al precedente ma VA TERO.
      r.kind !== "pow-prop" && r.kind !== "pow-prod" && r.kind !== "rad-pow" && r.kind !== "pow-pow" &&
      !(r.opLatex && r.answer) &&
      !(prevIsPropRewrite && r.answerPoly)
    )
      continue;
    // ⚠️ NON scartare opLatex/answer: sono le operazioni che lo studente
    // dovrà svolgere (parentesi, divisioni, prodotti/potenze, catena).
    steps.push({
      latex,
      kind: r.kind,
      detail: r.detail,
      // (25/10, punto 1) opLatex viaggia anche con answerPoly (es. «x^{2} : x^{4} =»)
      ...(r.opLatex ? { opLatex: r.opLatex } : {}),
      ...(r.opLatex && r.answer ? { answer: r.answer } : {}),
      // GIRO 30: risultato atteso dei conti con lettere (input studente)
      ...(r.answerPoly ? { answerPoly: r.answerPoly } : {}),
      // (25/10) pow-prop con base tra parentesi → punto 2 (sezione parentesi)
      ...(r.inParen ? { inParen: true } : {}),
      // (08/11, potenze simboliche) risultato POTENZA dei passi con esponente
      ...(r.symbolicResultLatex ? { symbolicResultLatex: r.symbolicResultLatex } : {}),
    });
  }

  // (08/11, potenze simboliche) risultato finale POTENZA: lo stato finale
  // contiene ancora potenze simboliche (es. 2^{57}, ma anche 1/(2^{67}) del
  // capovolgimento o uno stato interrotto come 2^{64} : 128) → niente
  // monomi e MAI «0»: il risultato è lo stato stesso, in LaTeX.
  const finalSymbolicLatex = contienePowSimbolica(current) ? printLatex(current) : undefined;
  let flatTerms: Term[] = [];
  try {
    flatTerms = finalSymbolicLatex ? [] : collectFlatTerms(current);
  } catch (err) {
    // (08/11, potenze simboliche) SOLO l'overflow dei valori oltre 2^{53}
    // viene assorbito (stati con potenze simboliche: la catena si ferma qui
    // ma l'analisi non deve esplodere). Gli ALTRI errori chiari dell'app
    // (es. «non supporta la divisione tra espressioni con lettere» per
    // (x+1)^-2) restano errori, esattamente come prima di oggi.
    // ⚠️ frBig lancia un Error SEMPLICE (non ExprError): si riconosce solo
    // dal messaggio, mai con instanceof ExprError.
    if (err instanceof Error && /troppo grandi/i.test(err.message)) {
      flatTerms = [];
    } else if (err instanceof Error && /esponenti pari|resta indicata|valore assoluto|si svolge solo su un monomio/i.test(err.message)) {
      // (10/11) radicali che restano INDICATE (esponenti dispari, indice
      // negativo, radicando non semplificabile): l'analisi NON esplode —
      // niente raggruppamento monomi, l'espressione resta com'è.
      flatTerms = [];
    } else {
      throw err;
    }
  }
  const groups = buildGroups(flatTerms);

  const finalPoly = groups.map((g) => {
    const vars = (() => {
      const sample = flatTerms.find((t) => termKey(t) === g.key);
      return sample ? sample.vars.map((x) => ({ ...x })) : [];
    })();
    return term(vars, g.sum);
  }).filter((t) => !fIsZero(t.c));

  // Ordina: grado decrescente, poi nome variabile
  finalPoly.sort((a, b) => (termDegree(b) - termDegree(a)) || (termKey(a) < termKey(b) ? -1 : 1));

  return {
    originalLatex: printLatex(ast),
    steps,
    uselessParens: uselessParenNotes(ast),
    // regola dei segni: passi paren-sign (es. 3 − (x − 2), con lettere)
    // OPPURE parentesi numeriche con ± dentro precedute da ± (es. 3 − (2+5))
    signRuleNeeded: steps.some((s) => s.kind === "paren-sign") || needsSignRule(ast),
    hasVars,
    flatTerms,
    groups,
    finalPoly,
    finalLatex: polyToLatex(finalPoly),
    ...(finalSymbolicLatex ? { finalSymbolicLatex } : {}),
    hadParentheses: containsParen(ast),
    ast,
  };
}

/** GIRO 31 — SENTINELLA INTELLIGENTE della progressività.
 *
 *  Regola centrale dell'app (filosofia scaffolding): «mai il passo dopo
 *  prima del risultato corretto del passo precedente». Poiché i tipi di
 *  espressione sono infiniti, la regola NON può essere garantita caso per
 *  caso: questa funzione la CERTIFICA su OGNI analisi prodotta dal motore.
 *
 *  Per ogni passo N (N ≥ 1) verifica che lo studente abbia UN punto in cui
 *  inserire il risultato del conto N (quindi lo stato N — che contiene quel
 *  risultato — non può mai apparire prima):
 *  - passo interattivo numerico (opLatex+answer) → input dello studente ✓;
 *  - passo con answerPoly → campo da tastiera dello studente ✓;
 *  - passo di sola notazione (tolgo parentesi, fratta impilata dell'utente)
 *    → nessun conto svolto, nessuno stato-nuovo con risultati ✓;
 *  - primo passo (N = 0) → l'espressione inserita dallo studente ✓.
 *
 *  Restituisce l'elenco delle violazioni (vuoto = filosofia rispettata).
 *  Usata dalla batteria di test su TUTTI i tipi di espressione: se un FUTURO
 *  tipo di espressione viola la regola, i test lo segnalano subito. */
export interface ViolazioneProgressivita {
  indice: number;
  kind: string;
  detail: string;
  motivo: string;
}
const KINDS_SOLA_NOTAZIONE = new Set([
  "paren-unwrap", // tolgo le parentesi: nessun conto
  "paren-div", // (n.fr) la fratta impilata scritta dall'utente: solo notazione
  "root-prop", // (25/10) proprietà delle radici: riscrittura segnalata, nessun conto
  "pow-prop", // (25/10) proprietà delle potenze a stessa base: solo notazione
  "pow-flip", // (25/10-fix) capovolgimento segnalato dell'esponente negativo
  "pow-frac", // (25/10, punto 2) esponente frazionario = radice (segnalato)
  "pow-prod", // (25/10, punto 3) potenza di prodotto/quoziente (segnalata)
  "pow-pow", // (08/11) potenza di potenza: spiegazione segnalata (stato invariato)
  "rad-rad", // (25/10, punto 4) radice di radice: moltiplico gli indici
  "rad-pow", // (25/10, punto 4) radice di potenza: divido l'esponente
]);
export function auditProgressivita(steps: ExprStep[]): ViolazioneProgressivita[] {
  const out: ViolazioneProgressivita[] = [];
  for (let i = 1; i < steps.length; i++) {
    const s = steps[i];
    const interattivo = !!s.opLatex && !!s.answer;
    const digitato = !!s.answerPoly;
    const notazione = KINDS_SOLA_NOTAZIONE.has(s.kind) && !s.opLatex && !s.answer && !s.answerPoly;
    if (!interattivo && !digitato && !notazione) {
      out.push({
        indice: i,
        kind: s.kind,
        detail: s.detail,
        motivo:
          "il passo produce un nuovo stato ma lo studente non ha dove " +
          "inserirne il risultato: lo stato successivo trapelerebbe in anticipo",
      });
    }
  }
  return out;
}

/** Confronto esatto di funzioni razionali sul loro dominio comune. Somme,
 *  parentesi, frazioni annidate e potenze intere diventano quozienti di
 *  polinomi; il prodotto incrociato decide l'equivalenza senza affidarsi
 *  alla coincidenza in un solo valore delle lettere. false = diverse o
 *  certamente indefinite; null = caso non verificabile da questa via. */
export function rationalPolyEquals(rawA: string, rawB: string): boolean | null {
  type Rational = { num: Term[]; den: Term[] };
  class DenominatoreNullo extends Error {}
  const one = () => [term([], fOne)];
  const product = (a: Term[], b: Term[]): Term[] => {
    // Limite anti-esplosione: nessun arrotondamento o risultato inventato.
    if (a.length * b.length > 4096) throw new Error("Espressione troppo complessa");
    const p = polyMul(a, b);
    if (p.length > 512) throw new Error("Espressione troppo complessa");
    return p;
  };
  const asRational = (n: Node): Rational => {
    switch (n.k) {
      // (12/11) VALORE ASSOLUTO: non rappresentabile come razionale — lancia
      // e il chiamante restituisce null (verifica con sostituzione numerica).
      case "abs": throw new Error("Il valore assoluto non è un razionale");
      case "num": return { num: n.v.n === 0 ? [] : [term([], n.v)], den: one() };
      case "var": return { num: [term([{ v: n.name, e: 1 }], fOne)], den: one() };
      case "term": {
        if (fIsZero(n.t.c)) return { num: [], den: one() };
        return {
          num: [term(n.t.vars.filter((v) => v.e > 0), n.t.c)],
          den: [term(n.t.vars.filter((v) => v.e < 0).map((v) => ({ v: v.v, e: -v.e })), fOne)],
        };
      }
      case "paren": return asRational(n.a);
      case "neg": { const r = asRational(n.a); return { num: polySub([], r.num), den: r.den }; }
      case "add": case "sub": {
        const a = asRational(n.a), b = asRational(n.b);
        const left = product(a.num, b.den), right = product(b.num, a.den);
        return { num: n.k === "add" ? polyAdd(left, right) : polySub(left, right), den: product(a.den, b.den) };
      }
      case "mul": case "div": {
        const a = asRational(n.a), b = asRational(n.b);
        if (n.k === "div" && b.num.length === 0) throw new DenominatoreNullo();
        return n.k === "mul"
          ? { num: product(a.num, b.num), den: product(a.den, b.den) }
          : { num: product(a.num, b.den), den: product(a.den, b.num) };
      }
      case "pow": {
        const a = asRational(n.a);
        if (!Number.isInteger(n.e) || Math.abs(n.e) > 99) throw new Error("Esponente non supportato");
        if (a.num.length === 0 && n.e <= 0) throw new DenominatoreNullo();
        let numerator = one(), denominator = one();
        let baseNum = a.num, baseDen = a.den, k = Math.abs(n.e);
        while (k > 0) {
          if (k % 2 === 1) { numerator = product(numerator, baseNum); denominator = product(denominator, baseDen); }
          k = Math.floor(k / 2);
          if (k > 0) { baseNum = product(baseNum, baseNum); baseDen = product(baseDen, baseDen); }
        }
        return n.e < 0 ? { num: denominator, den: numerator } : { num: numerator, den: denominator };
      }
      // Le radici non sono in generale razionali e si verificano a parte.
      case "sqrt": case "root": case "powfrac": case "rat": throw new Error("Non razionale");
    }
  };
  const build = (raw: string): { value: Rational | null; invalid: boolean } => {
    try {
      const s = (raw ?? "").trim();
      if (!s || s.includes("=")) return { value: null, invalid: false };
      /* (12/11) preservaFrazioniComplesse=true: senza, \dfrac{A}{B} si
       * appiattiva in divisione piatta e i due punti «:» legavano il
       * monomio successivo in modo diverso — un quoziente di fratte
       * corretto veniva giudicato falso. Il valore va letto come legge
       * l'app (replaceExpressionStep usa già la variante impilata). */
      const r = asRational(parseExpression(normalizeInput(s, true)));
      return { value: r, invalid: r.den.length === 0 };
    } catch (err) {
      return { value: null, invalid: err instanceof DenominatoreNullo };
    }
  };
  const a = build(rawA), b = build(rawB);
  if (a.invalid || b.invalid) return false;
  if (!a.value || !b.value) return null;
  try { return polyEquals(product(a.value.num, b.value.den), product(b.value.num, a.value.den)); }
  catch { return null; }
}

/** Confronto del valore inserito dallo studente con la somma esatta (2 decimali) */
export function isUserSumCorrect(user: number, exact: Frac): boolean {
  const m = Math.round(user * 100);
  const e = Math.round((exact.n / exact.d) * 100);
  return m === e;
}

// ─── GIRO 30: convalida dei risultati scritti dallo studente ──────────

/** Risultato atteso di un conto con lettere scritto dallo studente con le
 *  regole della tastiera (giro 26: «3x/4», «5x», «a^2+2ab», «:»…).
 *  Restituisce il polinomio NORMALIZZATO (senza termini nulli) oppure null
 *  se il testo non è un'espressione valida. MAI lanciare: l'input è libero. */
export function parsePolyLoose(raw: string): Term[] | null {
  try {
    const s = raw.trim();
    if (!s) return null;
    const ast = parseExpression(normalizeInput(s));
    const p = evalPoly(ast).filter((t) => !fIsZero(t.c));
    return p;
  } catch {
    return null;
  }
}

/** Confronto esatto tra polinomi, indipendente dall'ordine dei termini. */
export function polyEquals(a: Term[], b: Term[]): boolean {
  const norm = (p: Term[]) =>
    p
      .filter((t) => !fIsZero(t.c))
      .slice()
      .sort((x, y) => termKey(x).localeCompare(termKey(y)));
  const pa = norm(a);
  const pb = norm(b);
  if (pa.length !== pb.length) return false;
  return pa.every((t, i) => {
    const u = pb[i];
    if (!fEq(t.c, u.c)) return false;
    const va = [...t.vars].sort((x, y) => x.v.localeCompare(y.v) || x.e - y.e);
    const vb = [...u.vars].sort((x, y) => x.v.localeCompare(y.v) || x.e - y.e);
    return va.length === vb.length && va.every((w, j) => w.v === vb[j].v && w.e === vb[j].e);
  });
}

// ─── (25/10, punto 5) Feedback diagnostico all'errore ─────────────
// Confronta il polinomio scritto dallo studente con quello atteso e
// restituisce un AIUTO per TIPO di sbaglio — MAI il risultato. Con 2 o
// più tentativi falliti si aggiunge il promemoria della proprietà
// (aiuto graduale). Restituisce "" quando non c'è un riscontro
// specifico (la UI mostra allora il messaggio generico).

/** Promemoria della proprietà in base al tipo di passo (mai il risultato). */
function proprietaHint(kind: StepKind): string {
  switch (kind) {
    case "mul-terms":
      return "Nel prodotto, gli esponenti delle lettere uguali si SOMMANO.";
    case "div-mono":
      return "Nella divisione, gli esponenti delle lettere uguali si SOTTRAGGONO.";
    case "pow-term":
      return "La potenza si applica al coefficiente E alle lettere.";
    case "pow-flip":
      return "L'esponente negativo CAPOVOLGE la potenza: diventa una frazione.";
    case "pow-prop-final":
      return "Stessa base: gli esponenti si SOMMANO nel prodotto e si SOTTRAGGONO nella divisione.";
    case "pow-prod-final":
      return "La potenza si applica a OGNI fattore: coefficiente e lettere.";
    case "rad-pow-final":
      return "Radice di potenza: l'esponente si DIVIDE per l'indice della radice.";
    case "sqrt":
      return "La radice quadrata DIVIDE gli esponenti delle lettere per 2.";
    case "root":
      return "La radice n-esima DIVIDE gli esponenti per l'indice.";
    default:
      return "Rileggi la spiegazione del passaggio sopra.";
  }
}

export function errorHint(expected: Term[], typed: Term[] | null, kind: StepKind, tentativi: number): string {
  if (!typed || typed.length === 0) return "";
  // risposta GIUSTA (in qualunque forma equivalente) → nessun aiuto
  if (polyEquals(typed, expected)) return "";
  // segno: stessi termini, coefficienti tutti opposti
  const opposto = (p: Term[], q: Term[]) =>
    p.length === q.length &&
    p.every((t, i) => {
      const u = q[i];
      return fEq(t.c, { n: -u.c.n, d: u.c.d }) && termKey(t) === termKey(u);
    });
  // reciproco (1 termine): coefficiente ed esponenti capovolti
  const reciproco = (p: Term[], q: Term[]) =>
    p.length === 1 && q.length === 1 &&
    fEq(p[0].c, { n: q[0].c.d, d: q[0].c.n }) &&
    p[0].vars.length === q[0].vars.length &&
    p[0].vars.every((v, i) => q[0].vars[i] && q[0].vars[i].v === v.v && q[0].vars[i].e === -v.e);
  let base: string;
  if (opposto(typed, expected) || opposto(expected, typed)) {
    base = "Il SEGNO è sbagliato: il risultato ha il segno opposto a quello che hai scritto.";
  } else if (reciproco(typed, expected) || reciproco(expected, typed)) {
    base = "Hai capovolto nella direzione sbagliata: attenzione al reciproco della frazione.";
  } else if (typed.every((t) => t.vars.length === 0) && expected.every((t) => t.vars.length === 0)) {
    base = "Ricontrolla il conto: il VALORE non è giusto.";
  } else if (typed.map(termKey).join("|") === expected.map(termKey).join("|")) {
    base = "Le lettere sono giuste: ricontrolla solo il conto dei NUMERI (coefficienti).";
  } else if (typed.map((t) => `${t.c.n}/${t.c.d}`).join("|") === expected.map((t) => `${t.c.n}/${t.c.d}`).join("|") && typed.length === expected.length) {
    base = "I numeri ci sono: ricontrolla gli ESPONENTI delle lettere.";
  } else {
    base = "";
  }
  if (tentativi >= 2) {
    const prop = proprietaHint(kind);
    return base ? `${base} ${prop}` : prop;
  }
  return base;
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  AUDIT DEI CONTI (25/10, richiesta utente: «l'app deve fornire sempre i
 *  conti in modo corretto»). Due strumenti PUOLI, provabili in Node:
 *
 *  1) latexValue(latex) — valore numerico di un LaTeX GENERATO DAL MOTORE
 *     (sottoinsieme stabile: \d?frac, \sqrt[n]{}, ^{}, · : + -, parentesi).
 *     Restituisce null se contiene lettere o comandi inattesi: l'audit SALTA
 *     il controllo (mai falsi positivi).
 *  2) auditConti(steps) — tre violazioni possibili:
 *       • conto-vuoto: passo interattivo la cui «operazione» non contiene
 *         alcuna operazione (es. «(1/3) =» per una frazione già impilata);
 *       • conto-errato: il risultato atteso (answer) non coincide col valore
 *         dell'operazione mostrata (opLatex);
 *       • salto-errato: due stati consecutivi della catena hanno valori
 *         diversi (la catena deve conservare il valore dell'espressione).
 *     Usata dai test su TUTTI i tipi di espressione e a runtime dalla
 *     verifica dei conti (applicaVerifica in aiVerify.ts). */
export interface ViolazioneConti {
  indice: number;
  kind: string;
  tipo: "conto-vuoto" | "conto-errato" | "salto-errato";
  dettaglio: string;
}

export function latexToPlainMath(latex: string): string | null { /* esportata per diagnostica server (26/10) */
  let s = String(latex ?? "");
  s = s.replace(/\\left|\\right/g, "");
  /* (26/10-fix) le frazioni impilate vanno convertite PRIMA delle radici:
     con radici e frazioni impilate insieme (es. \sqrt{\dfrac{3}{7}\cdot\dots})
     il regex della radice \sqrt{([^{}]*)} non trova corrispondenza perché
     il radicando contiene le graffe delle frazioni → l'espressione risultava
     «non valutabile» e la costruzione IA falliva sempre (3 tentativi).
     Prima le frazioni, poi le radici (dal più annidato verso l'esterno). */
  // frazioni impilate: \dfrac{a}{b} → ((a)/(b))
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))");
  }
  /* (09/11) numeri periodici: \overline{3} → cifre ripetute (valore
   * approssimato al 12º ordine, sufficiente alle tolleranze 1e-6 di
   * evalPlainMath; il valore ESATTO arriva dal motore, qui serve solo la
   * valutazione numerica di controllo). Il macron unicode segue le cifre. */
  s = s.replace(/\\(?:overline|bar)\s*\{(\d+)\}/g, (_m, d: string) => d.repeat(12));
  s = s.replace(/([\u0304\u0305]+)/g, "");
  // radici: \sqrt[n]{X} → (X)^(1/n)
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\\sqrt\[(\d+)\]\{([^{}]*)\}/g, "($2)^(1/$1)");
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, "($1)^(1/2)");
  }
    /* (26/10, foto "3 radice di 15 data per sbagliata"): coefficiente
     davanti alla radice: 3\\sqrt{15} genera "3(15)^(1/2)" e qui serve
     la moltiplicazione IMPLICITA coefficiente·radice (come 3(15) in
     evaluateLatex), altrimenti la stringa non si valuta e il box
     rifiuta la risposta corretta. */
  for (let i = 0; i < 4; i++) {
    s = s.replace(/(\d|\))\s*(\()/g, "$1*$2");
  }
s = s.replace(/\\cdot|\\times|·/g, "*").replace(/\\div|:/g, "/");
  s = s.replace(/\^\{([^{}]*)\}/g, "^($1)");
  s = s.replace(/\\[a-zA-Z]+/g, "");
  s = s.replace(/−/g, "-").replace(/\s+/g, "");
  /* (26/10-fix4) parentesi QUADRE e GRAFFE restano dall'IA (\left[ … \right],
     \left{ … }): qui è SOLO valutazione numerica interna, le quadre sono
     un raggruppamento come le tonde → convertite, altrimenti il controllo
     dei caratteri le rifiuta e l'espressione risulta «non valutabile»
     (l'utente vede sempre le quadre scritte: questa funzione non tocca
     la resa). */
  s = s.replace(/[\[{]/g, "(").replace(/[\]}]/g, ")");
  // lettere o caratteri inattesi → il controllo si salta (null)
  if (!s || /[a-zA-Z]/.test(s)) return null;
  if (/[^0-9+\-*/^().]/.test(s)) return null;
  return s;
}

function evalPlainMath(s: string): number | null {
  let pos = 0;
  const ws = () => {
    while (pos < s.length && s[pos] === " ") pos++;
  };
  function parseExpr(): number | null {
    let v = parseTerm();
    if (v === null) return null;
    for (;;) {
      ws();
      const c = s[pos];
      if (c === "+") {
        pos++;
        const r = parseTerm();
        if (r === null) return null;
        v += r;
      } else if (c === "-") {
        pos++;
        const r = parseTerm();
        if (r === null) return null;
        v -= r;
      } else return v;
    }
  }
  function parseTerm(): number | null {
    let v = parseUnary();
    if (v === null) return null;
    for (;;) {
      ws();
      const c = s[pos];
      if (c === "*") {
        pos++;
        const r = parseUnary();
        if (r === null) return null;
        v *= r;
      } else if (c === "/") {
        pos++;
        const r = parseUnary();
        if (r === null) return null;
        if (r === 0) return null;
        v /= r;
      } else return v;
    }
  }
  function parseUnary(): number | null {
    ws();
    if (s[pos] === "-") {
      pos++;
      const v = parseUnary();
      return v === null ? null : -v;
    }
    if (s[pos] === "+") {
      pos++;
      return parseUnary();
    }
    return parsePow();
  }
  function parsePow(): number | null {
    const base = parseAtom();
    if (base === null) return null;
    ws();
    if (s[pos] === "^") {
      pos++;
      const exp = parseUnary();
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    return base;
  }
  function parseAtom(): number | null {
    ws();
    if (s[pos] === "(") {
      pos++;
      const v = parseExpr();
      ws();
      if (s[pos] !== ")") return null;
      pos++;
      return v;
    }
    const m = /^\d+(?:\.\d+)?/.exec(s.slice(pos));
    if (!m) return null;
    pos += m[0].length;
    return parseFloat(m[0]);
  }
  const v = parseExpr();
  ws();
  if (v === null || pos !== s.length) return null;
  return Number.isFinite(v) ? v : null;
}

/** Valore numerico di un LaTeX generato dal motore; null se non valutabile. */
export function latexValue(latex: string): number | null {
  const plain = latexToPlainMath(latex);
  return plain === null ? null : evalPlainMath(plain);
}

/** Un'«operazione» mostrata allo studente contiene un conto da svolgere?
 *  Falsa per i soli VALORI (es. «\left(\dfrac{1}{3}\right)»): frazioni e
 *  radici strutturali diventano segnaposto, poi resta qualcosa di operativo
 *  (+ - * / : ^) solo se c'è davvero un calcolo. */
function opHaConto(opLatex: string): boolean {
  let s = String(opLatex ?? "");
  s = s.replace(/\\left|\\right/g, "");
  // le frazioni impilate scritte come TALI sono valori, non conti → F
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "F");
  }
  s = s.replace(/\\cdot|\\times|·/g, "*");
  // una RADICE (con radicando) è essa stessa il conto (√9 = 3, ∜16 = 2):
  // non si cancella il radicando, si toglie solo il comando
  const haRadice = /\\sqrt/.test(s);
  s = s.replace(/\\sqrt(\[\d+\])?/g, "");
  s = s.replace(/-?\d+(?:\.\d+)?/g, "N");
  s = s.replace(/\\[a-zA-Z]+/g, "");
  if (haRadice) return true;
  return /[+\-*/:^]/.test(s.replace(/[\s()[\]{}]/g, ""));
}

const STESSO_VALORE = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Audit dei conti della catena di passi (vedi intestazione blocco). */
export function auditConti(steps: ExprStep[]): ViolazioneConti[] {
  const out: ViolazioneConti[] = [];
  let prevVal: number | null = null;
  steps.forEach((s, i) => {
    // conto-vuoto: interattivo ma senza alcuna operazione da svolgere
    if (s.opLatex && s.answer && !opHaConto(s.opLatex)) {
      out.push({
        indice: i,
        kind: s.kind,
        tipo: "conto-vuoto",
        dettaglio: `opLatex «${s.opLatex}» non contiene operazioni: è un valore, non un conto`,
      });
    }
    // conto-errato: il risultato atteso non coincide col valore dell'operazione.
    // (08/11, potenze simboliche) ESCLUSIONE per i passi con ESPONENTE da
    // digitare (pow-pow-exp, pow-prop-exp): l'answer è l'ESPONENTE del
    // risultato simbolico, non il valore dell'operazione (2^{15}·2^{3} vale
    // 262144, lo studente scrive 18). Al loro posto vale l'invariante
    // dedicato subito sotto: l'esponente del risultato simbolico generato
    // dal motore deve coincidere con l'answer.
    if (s.opLatex && s.answer && s.kind !== "pow-pow-exp" && s.kind !== "pow-prop-exp") {
      const v = latexValue(s.opLatex);
      const atteso = s.answer.n / s.answer.d;
      if (v !== null && !STESSO_VALORE(v, atteso)) {
        out.push({
          indice: i,
          kind: s.kind,
          tipo: "conto-errato",
          dettaglio: `«${s.opLatex}» vale ${v}, ma il risultato atteso è ${atteso}`,
        });
      }
    }
    // (08/11, potenze simboliche) invariante dei passi con esponente: il
    // risultato simbolico generato dal motore (es. 2^{72}) deve avere
    // l'ESPONENTE atteso. Se la forma non è riconoscibile si salta (mai
    // falsi positivi).
    if (s.opLatex && s.answer && s.symbolicResultLatex) {
      const m = /^(-?\d+)\^\{(-?\d+)\}$/.exec(s.symbolicResultLatex.replace(/\\left|\\right/g, ""));
      if (m && Number(m[2]) !== s.answer.n / s.answer.d) {
        out.push({
          indice: i,
          kind: s.kind,
          tipo: "conto-errato",
          dettaglio: `il risultato simbolico ${s.symbolicResultLatex} ha esponente ${m[2]}, atteso ${s.answer.n / s.answer.d}`,
        });
      }
    }
    // salto-errato: la catena deve conservare il valore
    const val = latexValue(s.latex);
    if (val !== null && prevVal !== null && !STESSO_VALORE(val, prevVal)) {
      out.push({
        indice: i,
        kind: s.kind,
        tipo: "salto-errato",
        dettaglio: `il passo cambia il valore della catena (${prevVal} → ${val})`,
      });
    }
    if (val !== null) prevVal = val;
  });
  return out;
}
