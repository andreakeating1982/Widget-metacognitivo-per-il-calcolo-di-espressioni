/** Costruzione deterministica delle righe progressive dell'esercizio.
 * Una riga è mostrabile soltanto DOPO che lo studente ha inserito la
 * risposta del box corrispondente. Non si usano righe inventate dall'IA:
 * l'operazione del box deve comparire nell'albero dell'espressione corrente. */
import { evalPoly, evaluateNumericExpression, normalizeInput, parseExpression, printLatex, rationalPolyEquals, type Node } from "./espressioni";

/** Parentesi e distinzione grafica fra barra e : non cambiano l'operazione;
 * l'ordine degli operandi, invece, resta essenziale. */
function shape(n: Node, preserveBrackets = false): unknown {
  switch (n.k) {
    case "paren": {
      const inner = shape(n.a, preserveBrackets);
      // Per la traccia originale quadre e graffe sono significative anche
      // se matematicamente equivalenti alle tonde. Nelle righe progressive
      // si conserva invece il confronto strutturale già esistente.
      return preserveBrackets && n.b ? ["paren", n.b, inner] : inner;
    }
    case "num": return ["num", n.v.n, n.v.d];
    case "var": return ["var", n.name];
    case "term": return ["term", n.t.c.n, n.t.c.d, n.t.vars];
    case "add": case "sub": case "mul": case "div": return [n.k, shape(n.a, preserveBrackets), shape(n.b, preserveBrackets)];
    // Ogni valore assoluto ha un contenuto diverso: non identificarlo con
    // un altro modulo solo perché entrambi hanno le barre verticali.
    case "neg": case "sqrt": case "abs": return [n.k, shape(n.a, preserveBrackets)];
    case "pow": return [n.k, shape(n.a, preserveBrackets), n.e];
    case "powfrac": return [n.k, shape(n.a, preserveBrackets), n.m, n.n];
    case "root": return [n.k, shape(n.a, preserveBrackets), n.n];
    case "rat": return [n.k, n.num, n.den];
  }
}

function same(a: Node, b: Node): boolean {
  return JSON.stringify(shape(a)) === JSON.stringify(shape(b));
}

function parse(raw: string): Node {
  if (!raw.trim() || raw.includes("=")) throw new Error("Espressione incompleta");
  // Conserva anche le frazioni letterali complesse come frazioni impilate
  // quando una risposta verificata entra nella riga o nel PDF progressivo.
  return parseExpression(normalizeInput(raw, true));
}

/** Stessa struttura, non soltanto lo stesso valore (2+3 non è 1+4). */
export function sameExpressionStructure(a: string, b: string): boolean {
  try { return same(parse(a), parse(b)); } catch { return false; }
}

/* ─── (10/11-fix, foto «non mi costruisce l'esercizio») Frazione impilata e
 * fattori giustapposti ───
 * La notazione della tastiera lega «⁄» all'ultimo fattore («a^-2b⁄x» si
 * parse «a^-2 · (b⁄x)»), mentre il LaTeX dell'IA mette tutto il prodotto
 * nel numeratore («\dfrac{a^{-2}b}{x}»): stessi valori, forme diverse, e la
 * verifica di fedeltà rifiutava una catena corretta. Per il confronto i
 * fattori giustapposti entrano nel numeratore (o nel denominatore) della
 * frazione impilata: solo raggruppamento, nessun conto eseguito. */
/* (12/11) si attraversano solo le moltiplicazioni IMPLICITE (giustapposte):
 * un · esplicito chiude il fattore e non entra nella frazione impilata. */
function raccogliFattori(n: Node): Node[] {
  if (n.k === "mul" && n.impl) return [...raccogliFattori(n.a), ...raccogliFattori(n.b)];
  return [n];
}

function ricostruisciProdotto(parts: Node[]): Node {
  if (parts.length === 0) return { k: "num", v: { n: 1, d: 1 } };
  return parts.reduce((acc: Node, p: Node) => ({ k: "mul", a: acc, b: p }));
}

function raggruppaFrazioni(n: Node): Node {
  if (n.k === "mul") {
    /* (12/11) MOLTIPLICAZIONE ESPLICITE (·): nessun assorbimento. «2·x⁄(4-x)»
     * resta 2·(x⁄(4-x)) e NON diventa \dfrac{2x}{4-x}: il fattore con il
     * puntino è visibilmente esterno alla frazione e la trascrizione dell'IA
     * deve rispettarlo (test trascrizioneFratte). Solo la giustapposizione
     * («a^-2b⁄x») continua a raggrupparsi nel numeratore (10/11-fix). */
    if (!n.impl) {
      return { k: "mul", a: raggruppaFrazioni(n.a), b: raggruppaFrazioni(n.b) };
    }
    const fattori = raccogliFattori(n).map(raggruppaFrazioni);
    if (!fattori.some((f) => f.k === "div" && f.fr === true)) {
      return ricostruisciProdotto(fattori);
    }
    const numeratori: Node[] = [];
    const denominatori: Node[] = [];
    for (const f of fattori) {
      if (f.k === "div" && f.fr === true) { numeratori.push(f.a); denominatori.push(f.b); }
      else numeratori.push(f);
    }
    return {
      k: "div",
      a: ricostruisciProdotto(numeratori),
      b: ricostruisciProdotto(denominatori),
      fr: true,
    };
  }
  switch (n.k) {
    case "paren": case "neg": case "sqrt": case "abs": return { ...n, a: raggruppaFrazioni(n.a) };
    case "add": case "sub": case "div": return { ...n, a: raggruppaFrazioni(n.a), b: raggruppaFrazioni(n.b) };
    case "pow": case "powfrac": case "root": return { ...n, a: raggruppaFrazioni(n.a) };
    default: return n;
  }
}

/** Per la traccia copiata dall'IA non cambiare né spostare le quadre e le
 * graffe scritte dallo studente; le sole tonde aggiuntive restano innocue. */
export function sameSourceStructure(a: string, b: string): boolean {
  try {
    return JSON.stringify(shape(raggruppaFrazioni(parse(a)), true)) ===
      JSON.stringify(shape(raggruppaFrazioni(parse(b)), true));
  }
  catch { return false; }
}

type SignedTerm = { sign: 1 | -1; node: Node };

/** Espande soltanto l'associazione di +/- alla stessa profondità; non entra
 * nelle parentesi dello studente né esegue alcun calcolo. */
function additiveTerms(n: Node, sign: 1 | -1 = 1): SignedTerm[] {
  if (n.k === "add") return [...additiveTerms(n.a, sign), ...additiveTerms(n.b, sign)];
  if (n.k === "sub") return [...additiveTerms(n.a, sign), ...additiveTerms(n.b, sign === 1 ? -1 : 1)];
  if (n.k === "neg") return additiveTerms(n.a, sign === 1 ? -1 : 1);
  if (n.k === "num" && n.v.n < 0) return [{ sign: sign === 1 ? -1 : 1, node: { ...n, v: { ...n.v, n: -n.v.n } } }];
  if (n.k === "term" && n.t.c.n < 0) return [{ sign: sign === 1 ? -1 : 1, node: { ...n, t: { ...n.t, c: { ...n.t.c, n: -n.t.c.n } } } }];
  return [{ sign, node: n }];
}

function unwrapTop(n: Node): Node {
  while (n.k === "paren") n = n.a;
  return n;
}

function buildSum(parts: SignedTerm[]): Node {
  if (!parts.length) return { k: "num", v: { n: 0, d: 1 } };
  const first = parts[0];
  let out: Node = first.sign < 0 ? { k: "neg", a: first.node } : first.node;
  for (const p of parts.slice(1)) out = p.sign < 0 ? { k: "sub", a: out, b: p.node } : { k: "add", a: out, b: p.node };
  return out;
}

/** Un ausilio prima della risposta è ammesso solo se riscrive una divisione
 * tra frazioni come prodotto per la reciproca, senza svolgere alcun conto. */
export function safeFractionReciprocal(operation: string, extra: string): boolean {
  try {
    const op = unwrapTop(parse(operation));
    if (op.k !== "div" || op.fr) return false;
    const divisor = unwrapTop(op.b);
    if (divisor.k !== "div" || !divisor.fr) return false;
    const reversed: Node = { k: "div", a: divisor.b, b: divisor.a, fr: true };
    return same({ k: "mul", a: op.a, b: reversed }, parse(extra));
  } catch { return false; }
}

/* ─── (08/11, radicali) Conti RIDUCIBILI ancora presenti in una riga ────
 * Il gate «manca almeno un passaggio» deve accettare una riga completa ma
 * scritta in forma diversa dal risultato (√2−2−√6 su −4 vs (2−√2+√6)/4)
 * e rifiutare invece una riga con un calcolo pendente (2+12 quando il
 * risultato è 14). «Pendente» = riducibile con le proprietà: operazioni
 * tra soli razionali, radici non in forma minima, potenze di radicali,
 * radicali simili ancora da raccogliere. */
import { sommaRadicaleDi } from "./numericRadicalEquality";

function costanteRazionale(n: Node): boolean {
  if (n.k === "paren") return costanteRazionale(n.a);
  if (n.k === "neg") return costanteRazionale(n.a);
  try {
    const p = evalPoly(n);
    return p.length === 1 && p[0].vars.length === 0;
  } catch {
    return false;
  }
}



/* (12/11, collaudo n.8) aiuti per distinguere FORMA MINIMA da conto pendente */
function mcd2(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  return a;
}

/** intero puro (es. 3, −5): null se non è una costante intera */
function costanteIntera(n: Node): number | null {
  if (n.k === "paren" || n.k === "neg") return costanteIntera(n.a);
  try {
    const p = evalPoly(n);
    if (p.length !== 1 || p[0].vars.length !== 0) return null;
    const f = p[0].c;
    if (f.d !== 1) return null;
    return f.n;
  } catch {
    return null;
  }
}

/** true se x NON contiene un fattore potenza-k perfetto > 1 (già in forma
 * minima sotto radice k-esima). Per k = 2 coincide con il vecchio
 * quadratoLibero. */
function potenzaKLibera(x: number, k: number): boolean {
  if (!Number.isInteger(x) || x < 1) return x < 1;
  for (let p = 2; Math.pow(p, k) <= x; p++) {
    if (x % Math.pow(p, k) === 0) return false;
  }
  return true;
}

function haContoPendenteNode(n: Node): boolean {
  switch (n.k) {
    case "add":
    case "sub": {
      if (costanteRazionale(n.a) && costanteRazionale(n.b)) return true;
      // Nella stessa somma, anche due numeri separati da una lettera sono
      // un conto ancora da svolgere (per esempio dentro |x+2+3|).
      if (additiveTerms(n).filter((t) => costanteRazionale(t.node)).length >= 2) return true;
      /* radicali simili ancora da raccogliere (stesso radicando ≠ 1) */
      const sa = sommaRadicaleDi(printLatex(n.a)), sb = sommaRadicaleDi(printLatex(n.b));
      if (sa && sb && [...sa.keys()].some((d) => d !== 1 && sb.has(d))) return true;
      return haContoPendenteNode(n.a) || haContoPendenteNode(n.b);
    }
    case "mul":
    case "div": {
      if (costanteRazionale(n.a) && costanteRazionale(n.b)) {
        if (n.k === "mul") return true;
        /* (12/11, collaudo n.8) frazione di due INTERI: pendente solo se
         * RIDUCIBILE (6/9, 10/4). Una frazione già ridotta (3/4, 1/90, −5/3)
         * è forma minima, NON un conto da svolgere: era un falso positivo che
         * avrebbe bocciato qualunque finale fratto corretto. Se numeratore o
         * denominatore non sono interi (frazione complessa, es. (3/4)/5) resta
         * pendente: nel risultato finale va risolta. */
        const pn = costanteIntera(n.a);
        const pd = costanteIntera(n.b);
        if (pn == null || pd == null || pd === 0) return true;
        return mcd2(pn, pd) !== 1;
      }
      if (n.k === "mul") {
        /* (12/11, collaudo n.8) PRODOTTO con una frazione: \\dfrac{1}{x-1}·\\dfrac{5}{3}
         * va risolto in un'unica frazione (5/(3(x−1))) — non è forma minima.
         * 2·√2 resta invece lecito (coefficiente davanti alla radice). */
        const altro = costanteRazionale(n.a) ? n.b : costanteRazionale(n.b) ? n.a : null;
        if (altro && altro.k === "div") return true;
      }
      return haContoPendenteNode(n.a) || haContoPendenteNode(n.b);
    }
    case "pow": {
      if (!Number.isInteger(n.e) || Math.abs(n.e) < 2) {
        /* (12/11, collaudo n.8) RECIPROCO non risolto: (\\sqrt[4]{(x-2)^{4}})^{-1}
         * va ancora trasformato in 1/(x−2) (o 1/|x−2|). Solo se la base NON è
         * una foglia: x^{-1} e 2^{-1} sono già la forma frazione voluta. */
        if (Number.isInteger(n.e) && n.e < 0 && n.a.k !== "num" && n.a.k !== "var" && n.a.k !== "term") {
          return true;
        }
        return haContoPendenteNode(n.a);
      }
      /* potenza di un razionale o di un radicale: proprietà applicabile */
      return costanteRazionale(n.a) || haContoPendenteNode(n.a);
    }
    case "sqrt":
    case "root": {
      // L'indice negativo richiede ancora la trasformazione nel reciproco.
      // Non va usato come esponente nella ricerca di potenze perfette.
      if (n.k === "root" && n.n < 0) return true;
      if (costanteRazionale(n.a)) {
        try {
          const p = evalPoly(n.a);
          if (p.length === 1 && p[0].vars.length === 0) {
            const f = p[0].c;
            const idx = n.k === "sqrt" ? 2 : n.n;
            /* (12/11, collaudo n.8) riducibile se il radicando ha un fattore
             * potenza-k perfetto (∛8 = 2) — non basta l'indice ≠ 2: ∛2 è
             * già in forma minima e NON è un conto pendente. */
            return !potenzaKLibera(f.n, idx) || !potenzaKLibera(f.d, idx);
          }
        } catch { /* si prosegue sotto */ }
      }
      return haContoPendenteNode(n.a);
    }
    case "paren":
    case "neg":
    case "abs":
      return haContoPendenteNode(n.a);
    default:
      return false;
  }
}

/** true se nella riga resta un conto riducibile (non ancora in forma minima).
 *  Stringa non leggibile → true (per prudenza il gate resta stretto). */
export function haContoPendente(raw: string): boolean {
  try {
    return haContoPendenteNode(parse(raw));
  } catch {
    return true;
  }
}

/** Confronto strutturale fino a un semplice riordino di addendi già presenti;
 * non considera 2+12 la stessa struttura di 14. */
export function sameResultStructure(a: string, b: string): boolean {
  try {
    const x = parse(a), y = parse(b);
    if (same(x, y)) return true;
    const tokens = (n: Node) => additiveTerms(unwrapTop(n)).map((t) => JSON.stringify([t.sign, shape(t.node)])).sort();
    return JSON.stringify(tokens(x)) === JSON.stringify(tokens(y));
  } catch { return false; }
}

function replaceAddends(current: Node, target: Node, answer: Node): Node | null {
  if (current.k !== "add" && current.k !== "sub") return null;
  const available = additiveTerms(current);
  const wanted = additiveTerms(unwrapTop(target));
  const positions: number[] = [];
  for (const w of wanted) {
    const at = available.findIndex((a, i) => !positions.includes(i) && a.sign === w.sign && same(a.node, w.node));
    if (at < 0) return null;
    positions.push(at);
  }
  if (!positions.length) return null;
  const first = Math.min(...positions);
  const inserted = additiveTerms(unwrapTop(answer));
  const out: SignedTerm[] = [];
  for (let i = 0; i < available.length; i++) {
    if (i === first) out.push(...inserted);
    if (!positions.includes(i)) out.push(available[i]);
  }
  return buildSum(out);
}

/* ─── (08/11, radicali) Addendi ZERO tollerati nel collegamento ─────────
 * Dopo «2√3−2√3 = 0» la riga meccanica resta «0 − 2√2 − 2 + …»: l'IA
 * scrive l'operazione successiva SENZA lo zero («√2−2−√6» come numeratore
 * della frazione finale) e il confronto strutturale falliva (foto utente:
 * «box 9: non riesco a collegare il conto alla riga precedente»). Gli
 * addendi zero vengono TOLTI prima del confronto e dalla riga stampata. */
function isAddendoZero(n: Node): boolean {
  return (n.k === "num" && n.v.n === 0) || (n.k === "term" && n.t.c.n === 0);
}

function prunaAddendiZero(n: Node): Node {
  if (n.k === "add" || n.k === "sub") {
    const a = prunaAddendiZero(n.a), b = prunaAddendiZero(n.b);
    const az = isAddendoZero(a), bz = isAddendoZero(b);
    if (az && bz) return { k: "num", v: { n: 0, d: 1 } };
    if (az) return n.k === "sub" ? { k: "neg", a: b } : b;
    if (bz) return a;
    return { ...n, a, b };
  }
  if (n.k === "paren" || n.k === "neg" || n.k === "sqrt" || n.k === "abs")
    return { ...n, a: prunaAddendiZero(n.a) } as Node;
  if (n.k === "mul" || n.k === "div")
    return { ...n, a: prunaAddendiZero(n.a), b: prunaAddendiZero(n.b) } as Node;
  if (n.k === "pow" || n.k === "root")
    return { ...n, a: prunaAddendiZero(n.a) } as Node;
  if (n.k === "powfrac") return { ...n, a: prunaAddendiZero(n.a) } as Node;
  return n;
}

/** Sostituisce un conto già verificato, anche se i suoi addendi sono
 * separati da altri termini. Il risultato non è mostrato prima dell'input.
 * (10/11, foto «non mi costruisce l'esercizio») L'identità già verificata
 * si applica a OGNI occorrenza identica del conto: «√(ab⁻¹) → √a/√b» con
 * la radice presente 4 volte (2 al numeratore, 2 al denominatore) prima
 * sostituiva solo la prima, e il box successivo che cancelava la coppia
 * non si collegava più alla riga («non riesco a collegare il conto»). */
export function replaceExpressionStep(current: string, operation: string, answer: string): string | null {
  try {
    const source = prunaAddendiZero(parse(current)), target = prunaAddendiZero(parse(operation)), replacement = prunaAddendiZero(parse(answer));
    const replace = (node: Node): { node: Node; done: boolean } => {
      // Scendere prima fra le parentesi annidate: un confronto che ignora
      // i delimitatori non deve eliminare una quadra/graffa interna.
      if (node.k === "paren") {
        const inner = replace(node.a);
        if (inner.done) return { node: { ...node, a: inner.node }, done: true };
      }
      if (same(node, target)) {
        return { node: node.k === "paren" ? { ...node, a: replacement } : replacement, done: true };
      }
      if (node.k === "add" || node.k === "sub" || node.k === "mul" || node.k === "div") {
        const left = replace(node.a);
        if (left.done) return { node: { ...node, a: left.node }, done: true };
        const right = replace(node.b);
        if (right.done) return { node: { ...node, b: right.node }, done: true };
        const collected = replaceAddends(node, target, replacement);
        if (collected) return { node: collected, done: true };
      } else if (node.k === "neg" || node.k === "pow" || node.k === "powfrac" || node.k === "sqrt" || node.k === "root" || node.k === "abs") {
        const inner = replace(node.a);
        if (inner.done) return { node: { ...node, a: inner.node }, done: true };
      }
      return { node, done: false };
    };
    /* Ogni passata sostituisce UNA occorrenza: si ripete finché il conto
       compare ancora nella riga (l'identità è la stessa, già verificata).
       Cap a 50 passate per non inpennare se l'answer contenesse l'op. */
    let result = replace(source);
    if (!result.done) return null;
    for (let i = 0; i < 50; i++) {
      const next = replace(result.node);
      if (!next.done) break;
      result = next;
    }
    const printed = printLatex(result.node);
    // Un eventuale difetto di stampa non deve trasformare il significato.
    const equivalent = rationalPolyEquals(current, printed);
    if (equivalent === false) return null;
    if (equivalent === null) {
      const a = evaluateNumericExpression(current), b = evaluateNumericExpression(printed);
      if (a !== null && b !== null && Math.abs(a - b) > 1e-10 * Math.max(1, Math.abs(a), Math.abs(b))) return null;
    }
    return printed;
  } catch { return null; }
}

