/** guidata-radicali.ts — COSTRUTTORI DETERMINISTICI (9/11/2026, «cambiamento
 * radicale» richiesto dall'utente dopo tre foto di espressioni che il
 * costruttore IA non riusciva a costruire — 3 tentativi su 3 falliti):
 *
 *  1. costruisciRadiciNesime      — somme di radici numeriche a indice unico
 *     (es. 2∛81 − 5∛32 − 3∛24 + 4∛108): svolgo ogni radice, moltiplico per
 *     il coefficiente, raccolgo i termini con lo stesso radicando.
 *  2. costruisciRadicaliLetterali — radicali di monomi con lettere
 *     (es. √(9x³)·√x − 2x·√(4x²) + √(25x⁴):x): semplifico ogni termine
 *     (i radicali dello stesso termine si fondono), poi raccolgo i termini
 *     simili.
 *  3. costruisciCatenaEsatta      — catene numeriche con DECIMALI PERIODICI
 *     (es. [(3⁄2 − 0,5)²·√(9⁄4) + 1,3̄] : (2 − 1⁄3)): periodico e decimale
 *     in frazione, poi parentesi, radici esatte, potenze e operazioni in
 *     ordine, tutto a valori razionali ESATTI.
 *
 * Ogni candidato è comunque passato a riparaEsercizio (che RIVERIFICA ogni
 * conto con il motore esatto) e a trascrizioneFedele. Filosofia DSA
 * inviolata: i prompt dicono SOLO il metodo, MAI il risultato; ogni
 * risposta la scrive lo studente. Forme non riconosciute → null: si passa
 * al percorso IA esistente senza alterare nulla.
 */
import {
  evalPoly, fAdd, fDiv, fEq, fMul, fNeg, fr, term, termDegree, termToLatex,
  normalizeInput, parseExpression, printLatex,
  type Frac, type Node, type Term,
} from "../client/src/lib/espressioni";
import { evalRat } from "../client/src/lib/fratte";
import { kthFraction, laticeSommaNesima } from "../client/src/lib/numericRadicalEquality";
import { replaceExpressionStep } from "../client/src/lib/progressiveExpression";
import type { BoxAI, SezioneAI } from "./costruisci";

/* ─── Aiuti comuni ──────────────────────────────────────────────────── */

type Candidato = {
  espressioneLatex: string;
  sezioni: SezioneAI[];
  righeProgressive: string[];
  risultatoFinaleLatex: string;
};

/** Frazione razionale in LaTeX (impilata se non intera, regola DSA n.3). */
function frazioneLatex(f: Frac): string {
  if (f.n === 0) return "0";
  const segno = f.n < 0 ? "-" : "";
  const n = Math.abs(f.n);
  return f.d === 1 ? `${segno}${n}` : `${segno}\\dfrac{${n}}{${f.d}}`;
}

/** Valore razionale ESATTO di un sottoalbero senza lettere né radici
 *  irrazionali (null altrimenti). */
function costante(n: Node): Frac | null {
  try {
    const r = evalRat(n);
    const cn = r.num.length === 0 ? fr(0, 1)
      : r.num.length === 1 && r.num[0].vars.length === 0 ? r.num[0].c : null;
    const cd = r.den.length === 0 ? fr(1, 1)
      : r.den.length === 1 && r.den[0].vars.length === 0 ? r.den[0].c : null;
    if (!cn || !cd || cd.n === 0) return null;
    const v = fDiv(cn, cd);
    if (!Number.isSafeInteger(v.n) || !Number.isSafeInteger(v.d)) return null;
    return v;
  } catch {
    return null;
  }
}

function contieniLettere(n: Node, trovate = new Set<string>()): Set<string> {
  switch (n.k) {
    case "var": trovate.add(n.name); break;
    case "term": for (const v of n.t.vars) trovate.add(v.v); break;
    case "neg": case "paren": case "sqrt": case "root": case "pow": case "powfrac":
      contieniLettere(n.a, trovate); break;
    case "add": case "sub": case "mul": case "div":
      contieniLettere(n.a, trovate); contieniLettere(n.b, trovate); break;
    default: break;
  }
  return trovate;
}

/** Termini della somma algebrica (solo lungo add/sub/neg, MAI dentro
 *  parentesi: il contenuto resta un unico termine). */
type TermineSomma = { sign: 1 | -1; node: Node };
function terminiSomma(n: Node, sign: 1 | -1 = 1, out: TermineSomma[] = []): boolean {
  if (n.k === "add") return terminiSomma(n.a, sign, out) && terminiSomma(n.b, sign, out);
  if (n.k === "sub") return terminiSomma(n.a, sign, out) && terminiSomma(n.b, sign === 1 ? -1 : 1, out);
  if (n.k === "neg") return terminiSomma(n.a, sign === 1 ? -1 : 1, out);
  if (n.k === "num" && n.v.n < 0) {
    out.push({ sign: sign === 1 ? -1 : 1, node: { ...n, v: { ...n.v, n: -n.v.n } } });
    return true;
  }
  out.push({ sign, node: n });
  return true;
}

function sostituisciNodo(n: Node, target: Node, rimp: Node): Node {
  if (n === target) return rimp;
  switch (n.k) {
    case "neg": case "paren": case "sqrt": case "root": case "pow": case "powfrac":
      return { ...n, a: sostituisciNodo(n.a, target, rimp) } as Node;
    case "add": case "sub": case "mul": case "div":
      return { ...n, a: sostituisciNodo(n.a, target, rimp), b: sostituisciNodo(n.b, target, rimp) } as Node;
    default:
      return n;
  }
}

/* ─── Monomi ────────────────────────────────────────────────────────── */

type Mono = { c: Frac; vars: { v: string; e: number }[] };

function monoMul(a: Mono, b: Mono): Mono | null {
  const c = fMul(a.c, b.c);
  if (!Number.isSafeInteger(c.n) || !Number.isSafeInteger(c.d)) return null;
  const vars = new Map<string, number>(a.vars.map((v) => [v.v, v.e]));
  for (const v of b.vars) vars.set(v.v, (vars.get(v.v) ?? 0) + v.e);
  for (const [, e] of vars) if (!Number.isInteger(e) || Math.abs(e) > 6) return null;
  return { c, vars: [...vars.entries()].map(([v, e]) => ({ v, e })).filter((v) => v.e !== 0) };
}

/** Monomio con coefficiente e lettere da un nodo (null se non è un
 *  monomio). sotto = il nodo sta al DENOMINATORE (esponenti negati). */
function monomioDi(n: Node, sotto = false): Mono | null {
  switch (n.k) {
    case "num": {
      const c = sotto ? fDiv(fr(1, 1), n.v) : n.v;
      if (!Number.isSafeInteger(c.n) || !Number.isSafeInteger(c.d)) return null;
      return { c, vars: [] };
    }
    case "var":
      return { c: fr(1, 1), vars: [{ v: n.name, e: sotto ? -1 : 1 }] };
    case "term":
      if (sotto) return null;
      return { c: n.t.c, vars: n.t.vars.map((v) => ({ ...v })) };
    case "neg": {
      const m = monomioDi(n.a, sotto);
      return m ? { c: fNeg(m.c), vars: m.vars } : null;
    }
    case "paren":
      return monomioDi(n.a, sotto);
    case "pow": {
      if (sotto || !Number.isInteger(n.e) || n.e < 0 || n.e > 4) return null;
      const base = monomioDi(n.a, false);
      if (!base) return null;
      let m: Mono = { c: fr(1, 1), vars: [] };
      for (let i = 0; i < n.e; i++) {
        const acc = monoMul(m, base);
        if (!acc) return null;
        m = acc;
      }
      return m;
    }
    case "mul": {
      const a = monomioDi(n.a, sotto), b = monomioDi(n.b, sotto);
      return a && b ? monoMul(a, b) : null;
    }
    case "div": {
      const a = monomioDi(n.a, false), b = monomioDi(n.b, false);
      if (!a || !b || b.c.n === 0) return null;
      return monoMul(a, b);
    }
    default:
      return null;
  }
}

const varsLatex = (vars: { v: string; e: number }[]): string =>
  vars.filter((v) => v.e !== 0)
    .map((v) => `${v.v}${v.e === 1 ? "" : `^{${v.e}}`}`)
    .join("");

/* ─── 1. RADICI N-ESIME NUMERICHE A INDICE UNICO ────────────────────── */

type FattRadici = { coeff: Frac; radici: { idx: number; radicando: Frac }[] };

/** Scompone un termine (catena di · e :) in coefficiente razionale +
 *  radicali a radicando costante. null se non è di questa forma. */
function fattorizzaRadici(node: Node): FattRadici | null {
  let coeff: Frac = fr(1, 1);
  const radici: { idx: number; radicando: Frac }[] = [];
  const visita = (n: Node, sotto: boolean, negato: boolean): boolean => {
    switch (n.k) {
      case "num": {
        const v = n.v;
        if (!Number.isSafeInteger(v.n) || !Number.isSafeInteger(v.d)) return false;
        const c = sotto ? fNeg(v) : v;
        coeff = fMul(coeff, negato ? fNeg(c) : c);
        return true;
      }
      case "term": {
        if (n.t.vars.length || sotto) return false;
        coeff = fMul(coeff, negato ? fNeg(n.t.c) : n.t.c);
        return true;
      }
      case "var":
        return false;
      case "neg":
        return visita(n.a, sotto, !negato);
      case "paren":
        return visita(n.a, sotto, negato);
      case "sqrt": case "root": {
        const idx = n.k === "sqrt" ? 2 : (n as { n: number }).n;
        const rad = costante(n.a);
        if (rad === null || sotto) return false;
        if (rad.n < 0 && idx % 2 === 0) return false;
        radici.push({ idx, radicando: negato ? { n: -rad.n, d: rad.d } : rad });
        return true;
      }
      case "pow": {
        if (!Number.isInteger(n.e) || Math.abs(n.e) > 12) return false;
        const base = costante(n.a);
        if (base === null) return false;
        let v = fr(1, 1);
        for (let i = 0; i < Math.abs(n.e); i++) {
          v = fMul(v, base);
          if (!Number.isSafeInteger(v.n) || !Number.isSafeInteger(v.d)) return false;
        }
        if (n.e < 0) {
          if (v.n === 0) return false;
          v = fDiv(fr(1, 1), v);
        }
        coeff = fMul(coeff, negato ? fNeg(v) : v);
        return true;
      }
      case "mul": case "div": {
        if (!visita(n.a, false, negato)) return false;
        return visita(n.b, n.k === "div", negato);
      }
      default:
        return false;
    }
  };
  return visita(node, false, false) ? { coeff, radici } : null;
}

/** √[k]{f} → {rest, coeff}: estrae i fattori k-esimi dal radicando. */
function semplificaRadice(idx: number, radicando: Frac): { rest: number; coeff: Frac } | null {
  const m = kthFraction(radicando, idx);
  if (!m) return null;
  const voci = [...m.entries()];
  if (voci.length !== 1) return null;
  return { rest: voci[0][0], coeff: voci[0][1] };
}

export function costruisciRadiciNesime(espressione: string): Candidato | null {
  let ast: Node;
  try {
    ast = parseExpression(normalizeInput(espressione));
  } catch {
    return null;
  }
  if (contieniLettere(ast).size > 0) return null;

  const termini: TermineSomma[] = [];
  if (!terminiSomma(ast, 1, termini)) return null;
  if (termini.length === 0 || termini.length > 10) return null;

  const fatt = termini.map((t) => fattorizzaRadici(t.node));
  if (fatt.some((f) => f === null)) return null;
  const indici = new Set<number>();
  for (const f of fatt) for (const r of f!.radici) indici.add(r.idx);
  if (indici.size > 1) return null; /* √ e ∛ mischiati: non si raccoglie */
  const k = indici.size === 1 ? [...indici][0] : 2;
  if (k < 2 || k > 4) return null;
  if (fatt.every((f) => f!.radici.length === 0)) /* solo numeri: percorso IA */ return null;
  if (fatt.some((f) => f!.radici.length > 1)) /* circoscritto: una radice per termine */ return null;

  /* valore = coeff del termine × coeff della radice semplificata, SEGNAto:
     è il valore del termine ridotto (serve alla raccolta finale) */
  type Sempl = { sign: 1 | -1; coeff: Frac; valore: Frac; rest: number; radice: Node };
  const sempl: Sempl[] = [];
  for (let i = 0; i < termini.length; i++) {
    const f = fatt[i]!;
    if (f.radici.length !== 1) return null;
    const r = f.radici[0];
    const s = semplificaRadice(r.idx, r.radicando);
    if (!s || Math.abs(s.rest) > 100_000_000) return null;
    /* coefficienti interni al termine: interi (il segno sta nella SOMMA) */
    if (f.coeff.d !== 1 || f.coeff.n < 0) return null;
    sempl.push({
      sign: termini[i].sign,
      coeff: fMul(fr(termini[i].sign, 1), f.coeff),
      valore: fMul(fr(termini[i].sign, 1), fMul(f.coeff, s.coeff)),
      rest: s.rest,
      radice: r as unknown as Node,
    });
  }

  /* le istanze dei nodi radice in ordine di apparizione nell'AST */
  const radiciInOrdine: Node[] = [];
  const raccogliRadici = (n: Node): void => {
    if (n.k === "sqrt" || n.k === "root") { radiciInOrdine.push(n); return; }
    if (n.k === "neg" || n.k === "paren") raccogliRadici(n.a);
    else if (n.k === "add" || n.k === "sub" || n.k === "mul" || n.k === "div") { raccogliRadici(n.a); raccogliRadici(n.b); }
  };
  raccogliRadici(ast);
  if (radiciInOrdine.length !== sempl.length) return null;
  sempl.forEach((s, i) => { s.radice = radiciInOrdine[i]; });

  const espressioneLatex = printLatex(ast);
  /* come il parse di replaceExpressionStep: conserva le frazioni impilate */
  const parseLa = (latex: string): Node => parseExpression(normalizeInput(latex, true));

  const boxes: BoxAI[] = [];
  let riga = espressioneLatex;
  const avanza = (op: string, answer: string, prompt: string): boolean => {
    const successiva = replaceExpressionStep(riga, op, answer);
    if (!successiva) return false;
    boxes.push({ op, prompt, answerLatex: answer });
    riga = successiva;
    return true;
  };

  for (const s of sempl) {
    const radiceNodo = s.radice as { k: string; n?: number; a?: Node };
    const rad = radiceNodo.k === "sqrt" ? 2 : radiceNodo.n ?? 2;
    const radicando = costante(radiceNodo.a as Node);
    if (radicando === null) return null;
    const sola = semplificaRadice(rad, radicando);
    if (!sola) return null;
    const radiceSempl = laticeSommaNesima(new Map([[sola.rest, sola.coeff]]), rad);
    if (!radiceSempl || radiceSempl === "0") return null;
    /* box A: SVOLGO LA RADICE — solo se il radicando non è già ridotto */
    const giaRidotta = radicando.d === 1 && sola.rest === radicando.n &&
      sola.coeff.n === 1 && sola.coeff.d === 1;
    if (!giaRidotta) {
      const prompt = rad === 2
        ? "Svolgo la radice: porto fuori dal radicando i fattori che sono quadrati perfetti."
        : `Svolgo la radice: porto fuori dal radicando i fattori che sono potenze ${rad === 3 ? "cubiche" : "quarte"} perfette.`;
      if (!avanza(printLatex(s.radice), radiceSempl, prompt)) return null;
    }
    /* box B: MOLTIPLICO PER IL COEFFICIENTE — solo se non è 1 */
    if (Math.abs(s.coeff.n) !== s.coeff.d) {
      /* op = il valore ASSOLUTO del coefficiente per la radice semplificata
         (nella riga il segno sta fuori, a livello di somma) */
      const coeffA = fr(Math.abs(s.coeff.n), s.coeff.d);
      /* op = la parte del termine cosí come sta nella riga dopo il box A:
         «coeff · (risultato della radice)» — se la radice è già un numero
         puro resta comunque il prodotto, perché printLatex lo collopsasse. */
      const opTermine = `${printLatex({ k: "num", v: coeffA })} \\cdot ${radiceSempl}`;
      /* il VALORE del termine è |coeff| · coeff della radice semplificata
         (il segno del termine sta a livello di somma, nella riga) */
      const termineValore = laticeSommaNesima(
        new Map([[sola.rest, fMul(coeffA, sola.coeff)]]), rad,
      );
      if (!termineValore || termineValore === "0") return null;
      if (!avanza(opTermine, termineValore, "Moltiplico il coefficiente per il risultato della radice.")) return null;
    }
  }

  /* raccolta dei termini simili (solo se serve davvero): si sommano i VALORI
     dei termini ridotti, non i soli coefficienti originali */
  const totale = new Map<number, Frac>();
  for (const s of sempl) {
    const v = fAdd(totale.get(s.rest) ?? fr(0, 1), s.valore);
    if (v.n === 0) totale.delete(s.rest); else totale.set(s.rest, v);
  }
  const finale = totale.size ? laticeSommaNesima(totale, k) : "0";
  if (!finale) return null;
  if (riga !== finale) {
    if (!avanza(riga, finale, "Raccolgo i termini con lo stesso radicando: sommo e sottraggo i coefficienti.")) return null;
  }
  if (boxes.length === 0) return null;

  return {
    espressioneLatex,
    sezioni: [{ title: "RADICI", boxes }],
    righeProgressive: [espressioneLatex],
    risultatoFinaleLatex: finale,
  };
}

/* ─── 2. RADICALI CON LETTERE (monomi) ──────────────────────────────── */

type TermSempl = { coeff: Frac; vars: { v: string; e: number }[]; absVars?: string[]; rad: { idx: number; mono: Mono } | null };

function termineSemplLatex(t: TermSempl): string | null {
  const segno = t.coeff.n < 0 ? "-" : "";
  const n = Math.abs(t.coeff.n), d = t.coeff.d;
  const vars = varsLatex(t.vars) + (t.absVars ?? []).map((v) => `\\left|${v}\\right|`).join("");
  let radice = "";
  if (t.rad) {
    const c = t.rad.mono.c;
    let cStr: string;
    if (c.n === 1 && c.d === 1) cStr = "";
    else if (c.n === -1 && c.d === 1) cStr = "-";
    else if (c.d === 1) cStr = `${c.n}`;
    else cStr = frazioneLatex(c);
    const interno = `${cStr}${varsLatex(t.rad.mono.vars)}`;
    if (!interno || interno === "-") return null;
    radice = t.rad.idx === 2 ? `\\sqrt{${interno}}` : `\\sqrt[${t.rad.idx}]{${interno}}`;
  }
  const corpo = `${n === 1 && (vars || radice) ? "" : n}${vars}${radice}`;
  if (!corpo) return null;
  return d === 1 ? `${segno}${corpo}` : `${segno}\\dfrac{${corpo}}{${d}}`;
}

export function costruisciRadicaliLetterali(espressione: string): Candidato | null {
  let ast: Node;
  try {
    ast = parseExpression(normalizeInput(espressione));
  } catch {
    return null;
  }
  const lettere = contieniLettere(ast);
  if (lettere.size === 0 || lettere.size > 3) return null;
  if (!/\\sqrt|√/.test(espressione)) return null;

  const termini: TermineSomma[] = [];
  if (!terminiSomma(ast, 1, termini)) return null;
  if (termini.length === 0 || termini.length > 8) return null;

  /* fattorizzazione di ogni termine: coeff · lettere · radicali fusi */
  type FattTerm = { coeff: Frac; vars: { v: string; e: number }[]; radici: { idx: number; mono: Mono }[] };
  const fatt: (FattTerm | null)[] = termini.map((t) => {
    let coeff: Frac = fr(1, 1);
    let vars: { v: string; e: number }[] = [];
    const radici: { idx: number; mono: Mono }[] = [];
    const pushMono = (m: Mono): boolean => {
      coeff = fMul(coeff, m.c);
      const mm = monoMul({ c: fr(1, 1), vars }, { c: fr(1, 1), vars: m.vars });
      if (!mm) return false;
      vars = mm.vars;
      return true;
    };
    const visita = (n: Node, sotto: boolean): boolean => {
      switch (n.k) {
        case "num": case "var": case "term": case "pow": case "neg": {
          if (n.k === "term" && sotto) return false;
          const m = monomioDi(n, sotto);
          return m ? pushMono(m) : false;
        }
        case "paren":
          return visita(n.a, sotto);
        case "sqrt": case "root": {
          if (sotto) return false; /* radice al denominatore: fuori dal perimetro */
          const idx = n.k === "sqrt" ? 2 : (n as { n: number }).n;
          const mono = monomioDi(n.a, false);
          if (!mono || (mono.c.n < 0 && idx % 2 === 0)) return false;
          radici.push({ idx, mono });
          return true;
        }
        case "mul": case "div": {
          if (!visita(n.a, false)) return false;
          return visita(n.b, n.k === "div");
        }
        default:
          return false;
      }
    };
    return visita(t.node, false) ? { coeff, vars, radici } : null;
  });
  if (fatt.some((f) => f === null)) return null;
  if (fatt.every((f) => f!.radici.length === 0)) return null;

  /* semplificazione: fondo le radici del termine, estraggo i fattori k-esimi.
     Il coefficente è SEDITO (il segno del termine entra qui: serve alla
     raccolta); le risposte dei box usano il valore assoluto. */
  const sempl = fatt.map((f, i): TermSempl | null => {
    let coeff = fMul(fr(termini[i].sign, 1), f!.coeff);
    const vars = [...f!.vars];
    if (!f!.radici.length) return { coeff, vars, rad: null };
    const idxSet = new Set(f!.radici.map((r) => r.idx));
    if (idxSet.size > 1) /* √ e ∛ nello stesso termine: non si fondono */ return null;
    const idx = f!.radici[0].idx;
    if (idx < 2 || idx > 4) return null;
    let mono: Mono | null = { c: fr(1, 1), vars: [] };
    for (const r of f!.radici) { mono = monoMul(mono!, r.mono); if (!mono) return null; }
    if (mono!.vars.some((v) => v.e < 0)) /* esponente negativo nel radicando */ return null;
    /* estraggo la massima potenza k-esima dal radicando (coefficiente
       razionale: kthFraction gestisce anche il denominatore, √(9/4) → 3/2) */
    const estr = kthFraction(mono!.c, idx);
    if (!estr || estr.size !== 1) return null;
    const [resto, fuori] = [...estr.entries()][0];
    if (Math.abs(resto) > 100_000_000 || Math.abs(fuori.n) > 100_000) return null;
    coeff = fMul(coeff, fuori);
    const dentroVars: { v: string; e: number }[] = [];
    const nuoveVars = new Map<string, number>(vars.map((v) => [v.v, v.e]));
    const absVars: string[] = [];
    for (const v of mono.vars) {
      const fuori = Math.trunc(v.e / idx);
      const dentro = v.e - fuori * idx;
      // Una radice pari restituisce il valore assoluto del fattore estratto:
      // le potenze pari restano ordinarie, quelle dispari richiedono |v|.
      const fuoriOrdinario = idx % 2 === 0 && fuori % 2 !== 0 ? fuori - 1 : fuori;
      if (fuoriOrdinario) nuoveVars.set(v.v, (nuoveVars.get(v.v) ?? 0) + fuoriOrdinario);
      if (idx % 2 === 0 && fuori % 2 !== 0) absVars.push(v.v);
      if (dentro) dentroVars.push({ v: v.v, e: dentro });
    }
    for (const [, e] of nuoveVars) if (e < 0) /* esponente negativo residuo */ return null;
    const varsFuori = [...nuoveVars.entries()].map(([v, e]) => ({ v, e })).filter((v) => v.e !== 0);
    const radResto: Mono = { c: fr(resto, 1), vars: dentroVars };
    const rad = (radResto.c.n === 1 && radResto.c.d === 1 && radResto.vars.length === 0)
      ? null : { idx, mono: radResto };
    return { coeff, vars: varsFuori, absVars, rad };
  });
  if (sempl.some((s) => s === null)) return null;
  const latenze = sempl.map((s) => termineSemplLatex(s!));
  if (latenze.some((l) => l === null || l === "0")) return null;

  const espressioneLatex = printLatex(ast);
  const boxes: BoxAI[] = [];
  let riga = espressioneLatex;
  const avanza = (op: string, answer: string, prompt: string): boolean => {
    const successiva = replaceExpressionStep(riga, op, answer);
    if (!successiva) return false;
    boxes.push({ op, prompt, answerLatex: answer });
    riga = successiva;
    return true;
  };

  /* un box per termine: op = il termine come appare, answer = semplificato
     (VALORE positivo: il segno del termine resta a livello di somma) */
  for (let i = 0; i < termini.length; i++) {
    const op = printLatex(termini[i].node);
    const sSigned = sempl[i]!;
    const answer = termineSemplLatex({ ...sSigned, coeff: fr(Math.abs(sSigned.coeff.n), sSigned.coeff.d) });
    if (!answer) return null;
    if (op === answer) continue; /* già semplificato: nessun box */
    const prompt = sempl[i]!.rad
      ? "Svolgo le radici e semplifico il termine: porto fuori dalla radice i fattori che posso."
      : "Svolgo le radici e semplifico il termine: porto fuori tutti i fattori.";
    if (!avanza(op, answer, prompt)) return null;
  }

  /* raccolta dei termini simili: stessa coppia (monomio, radice residua) */
  const totale = new Map<string, TermSempl>();
  const chiaveRad = (s: TermSempl): string =>
    `${s.vars.map((v) => `${v.v}${v.e}`).sort().join(",")}|${(s.absVars ?? []).slice().sort().join(",")}|${
      s.rad ? `${s.rad.idx}|${s.rad.mono.c.n}/${s.rad.mono.c.d}|${s.rad.mono.vars.map((v) => `${v.v}${v.e}`).sort().join(",")}` : "razionale"
    }`;
  for (const s of sempl) {
    const chiave = chiaveRad(s!);
    const prec = totale.get(chiave);
    if (!prec) { totale.set(chiave, { ...s! }); continue; }
    /* stesse lettere e stessa radice residua: si sommano solo i coefficienti */
    totale.set(chiave, { coeff: fAdd(prec.coeff, s!.coeff), vars: prec.vars, absVars: prec.absVars, rad: prec.rad });
  }
  const ordine = [...totale.entries()];
  ordine.sort((a, b) => a[0].localeCompare(b[0]));
  const pezzi = ordine.map(([, s]) => termineSemplLatex(s));
  if (pezzi.some((p) => !p)) return null;
  const finale = pezzi
    .map((p, i) => (i === 0 ? p! : p!.startsWith("-") ? ` - ${p!.slice(1)}` : ` + ${p}`))
    .join("")
    .replace(/^\+ /, "");
  if (!finale || finale === "0") return null;
  if (riga !== finale) {
    if (!avanza(riga, finale, "Raccolgo i termini simili: sommo e sottraggo i coefficienti delle lettere uguali.")) return null;
  }
  if (boxes.length === 0) return null;

  return {
    espressioneLatex,
    sezioni: [{ title: "RADICALI CON LETTERE", boxes }],
    righeProgressive: [espressioneLatex],
    risultatoFinaleLatex: finale,
  };
}

/* ─── 3. CATENE NUMERICHE CON DECIMALI PERIODICI ────────────────────── */

type PassoC = { target: Node; op: string; answer: string; prompt: string; nuovo: Node };

/** Il prossimo calcolo da svolgere (post-order: prima dentro, poi a sinistra). */
function prossimoPassoC(n: Node): PassoC | null {
  const visita = (node: Node): PassoC | null => {
    switch (node.k) {
      case "num": {
        if (!node.dec) return null;
        const ripetuto = node.dec.includes("\\overline");
        if (!ripetuto && node.v.d === 1) return null;
        return {
          target: node,
          op: printLatex(node),
          answer: frazioneLatex(node.v),
          prompt: ripetuto
            ? "Costruisco la frazione generatrice del numero periodico, considerando anche l'eventuale antiperiodo."
            : "Trasformo il decimale in frazione: il denominatore è 10, 100, 1000…",
          nuovo: { k: "num", v: node.v },
        };
      }
      case "sqrt": case "root": {
        // Il radicando si prepara prima di svolgere la radice.
        const interno = visita(node.a);
        if (interno) return interno;
        const idx = node.k === "sqrt" ? 2 : (node as { n: number }).n;
        const rad = costante(node.a);
        if (rad === null) return null;
        const m = kthFraction(rad, idx);
        if (!m || m.size > 1 || !m.has(1)) return null; /* solo radici ESATTE */
        return {
          target: node,
          op: printLatex(node),
          answer: frazioneLatex(m.get(1)!),
          prompt: "Svolgo la radice.",
          nuovo: { k: "num", v: m.get(1)! },
        };
      }
      case "pow": {
        // Una base composta va risolta prima della potenza.
        const interno = visita(node.a);
        if (interno) return interno;
        if (!Number.isInteger(node.e) || node.e === 0 || Math.abs(node.e) > 12) return null;
        const base = costante(node.a);
        if (base === null) return null;
        let v = fr(1, 1);
        for (let i = 0; i < Math.abs(node.e); i++) {
          v = fMul(v, base);
          if (!Number.isSafeInteger(v.n) || !Number.isSafeInteger(v.d)) return null;
        }
        if (node.e < 0) {
          if (v.n === 0) return null;
          v = fDiv(fr(1, 1), v);
        }
        return {
          target: node,
          op: printLatex(node),
          answer: frazioneLatex(v),
          prompt: "Svolgo la potenza: scrivo la base tante volte quanto indica l'esponente.",
          nuovo: { k: "num", v },
        };
      }
      case "add": case "sub": case "mul": case "div": {
        // Visita post-order effettiva: prima le operazioni nei due operandi,
        // poi l'operazione esterna. Non chiedere mai l'intera espressione
        // in un unico box soltanto perché è valutabile dal motore.
        const interno = visita(node.a) ?? visita(node.b);
        if (interno) return interno;
        if (node.k === "div" && node.fr) return null; /* frazione impilata = già un valore */
        const a = costante(node.a), b = costante(node.b);
        if (a === null || b === null) return null;
        if (node.k === "div" && b.n === 0) return null;
        let v: Frac;
        let prompt: string;
        switch (node.k) {
          case "add": v = fAdd(a, b); prompt = "Sommo i due valori."; break;
          case "sub": v = fAdd(a, fNeg(b)); prompt = "Sottraggo il secondo dal primo."; break;
          case "mul": v = fMul(a, b); prompt = "Moltiplico i due valori."; break;
          default: v = fDiv(a, b); prompt = "Divido il primo per il secondo."; break;
        }
        if (!Number.isSafeInteger(v.n) || !Number.isSafeInteger(v.d)) return null;
        return { target: node, op: printLatex(node), answer: frazioneLatex(v), prompt, nuovo: { k: "num", v } };
      }
      case "neg": case "paren": {
        return visita(node.a);
      }
      default:
        return null;
    }
  };
  return visita(n);
}

export function costruisciCatenaEsatta(espressione: string): Candidato | null {
  /* circoscritta alle espressioni con NUMERI PERIODICI (le altre catene
     numeriche le costruisce bene il percorso IA esistente) */
  if (!/\\overline|\\bar\s*\{|[\u0304\u0305]/.test(espressione)) return null;
  let ast: Node;
  try {
    ast = parseExpression(normalizeInput(espressione));
  } catch {
    return null;
  }
  if (contieniLettere(ast).size > 0) return null;

  const espressioneLatex = printLatex(ast);
  const boxes: BoxAI[] = [];
  let corrente = ast;
  for (let i = 0; i < 40; i++) {
    const passo = prossimoPassoC(corrente);
    if (!passo) break;
    const op = printLatex(passo.target);
    const successiva = replaceExpressionStep(printLatex(corrente), op, passo.answer);
    if (!successiva) return null;
    boxes.push({ op, prompt: passo.prompt, answerLatex: passo.answer });
    corrente = sostituisciNodo(corrente, passo.target, passo.nuovo);
  }
  const finale = printLatex(corrente);
  if (costante(corrente) === null || boxes.length === 0) return null;

  return {
    espressioneLatex,
    sezioni: [{ title: "CALCOLO", boxes }],
    righeProgressive: [espressioneLatex],
    risultatoFinaleLatex: finale,
  };
}

/* ─── 4. RADICALI AD INDICI DIVERSI: RIDUZIONE ALLO STESSO INDICE ────── */
/* (09/11, foto «espressioni con radicali fratte») √((a²−1)/3) : ∛(3a+3):
   i costruttori precedenti esigono monomi nel radicando e indice unico.
   Percorso circoscritto: ESATTAMENTE due radicali (√, ∛, ∜…) uniti da una
   sola divisione o moltiplicazione, ogni radicando = polinomio in UNA
   lettera, eventualmente diviso per una costante intera positiva. Passi:
   stesso indice (m.c.m. degli indici) → radice unica → scomposizione →
   semplificazione → eventuale estrazione. Come sempre: i prompt dicono
   SOLO il metodo, mai il risultato; ogni box è comunque riverificato da
   riparaEsercizio (sostituzione numerica multipla per i radicali). */

type Polinomio = { lettera: string; c: number[] }; /* c[i] coeff di x^i */

const RAD_GRADO_MAX = 4; /* grado massimo di ogni polinomio */
const RAD_INDICE_MAX = 4; /* indici ammessi nei radicali di partenza */
const RAD_MCM_MAX = 12; /* indice comune massimo (m.c.m. tra 3 e 4) */
const RAD_POT_MAX = 4; /* potenza su ogni radicando (indice/indice) */
const RAD_COEFF_MAX = 1_000_000;

function radMcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}
function radMcm(a: number, b: number): number {
  if (!a || !b) return 0;
  return Math.abs(a * b) / radMcd(a, b);
}

function polyTrim(c: number[]): number[] {
  const out = [...c];
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
}
function polySomma(a: number[], b: number[], segno: 1 | -1): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    out.push((a[i] ?? 0) + segno * (b[i] ?? 0));
  }
  return polyTrim(out);
}
function polyProdotto(a: number[], b: number[]): number[] | null {
  if (a.length === 0 || b.length === 0) return null;
  if (a.length - 1 + b.length - 1 > RAD_GRADO_MAX) return null;
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  const t = polyTrim(out);
  if (t.some((x) => Math.abs(x) > RAD_COEFF_MAX)) return null;
  return t;
}

/** Polinomio in UNA lettera da un nodo (null altrimenti). */
function polinomioPuro(n: Node, lettera?: string): Polinomio | null {
  const fine = (c: number[], l: string): Polinomio | null => {
    const t = polyTrim(c);
    if (t.length === 0 || t.length - 1 > RAD_GRADO_MAX) return null;
    if (t.every((x) => x === 0)) return null; /* radicando nullo: insensato */
    if (t.some((x) => !Number.isSafeInteger(x) || Math.abs(x) > RAD_COEFF_MAX)) return null;
    return { lettera: l, c: t };
  };
  switch (n.k) {
    case "var":
      if (lettera && n.name !== lettera) return null;
      return fine([0, 1], n.name);
    case "num":
      if (n.v.d !== 1) return null;
      return fine([n.v.n], lettera ?? "a");
    case "neg": {
      const p = polinomioPuro(n.a, lettera);
      return p ? fine(p.c.map((x) => -x), p.lettera) : null;
    }
    case "paren":
      return polinomioPuro(n.a, lettera);
    case "pow": {
      if (!Number.isInteger(n.e) || n.e < 1 || n.e > RAD_GRADO_MAX) return null;
      const base = polinomioPuro(n.a, lettera);
      if (!base) return null;
      let acc: number[] = [1];
      for (let i = 0; i < n.e; i++) {
        const p = polyProdotto(acc, base.c);
        if (!p) return null;
        acc = p;
      }
      return fine(acc, base.lettera);
    }
    case "term": {
      if (n.t.vars.length !== 1) return null;
      const e = n.t.vars[0].e, l = n.t.vars[0].v;
      if (!Number.isInteger(e) || e < 1 || e > RAD_GRADO_MAX) return null;
      if (lettera && l !== lettera) return null;
      return fine([...Array(e).fill(0), n.t.c.n], l);
    }
    case "mul": {
      const a = polinomioPuro(n.a, lettera);
      const b = polinomioPuro(n.b, a?.lettera ?? lettera);
      if (!a || !b || a.lettera !== b.lettera) return null;
      const p = polyProdotto(a.c, b.c);
      return p ? fine(p, a.lettera) : null;
    }
    case "add": case "sub": {
      const a = polinomioPuro(n.a, lettera);
      const b = polinomioPuro(n.b, a?.lettera ?? lettera);
      if (!a || !b || a.lettera !== b.lettera) return null;
      return fine(polySomma(a.c, b.c, n.k === "add" ? 1 : -1), a.lettera);
    }
    default:
      return null;
  }
}

/** Radicando ammesso: polinomio, eventualmente diviso per una costante
 *  intera positiva (il «/3» della foto). */
function radicandoPolinomio(n: Node): { num: Polinomio; den: number } | null {
  const u = n.k === "paren" ? n.a : n;
  if (u.k === "div") {
    const den = u.b.k === "paren" ? u.b.a : u.b;
    if (den.k !== "num" || den.v.d !== 1 || den.v.n < 2 || den.v.n > 1000) return null;
    const num = polinomioPuro(u.a);
    return num ? { num, den: den.v.n } : null;
  }
  const num = polinomioPuro(u);
  return num ? { num, den: 1 } : null;
}

/* ── scomposizione: fattor comune, potenze della lettera, trinomio monico
      a radici intere, polinomi pari per sostituzione u = lettera² ── */

type FattPoly =
  | { tipo: "num"; v: number }
  | { tipo: "poly"; lettera: string; c: number[]; e: number };

/** Fattori monici di un polinomio monico (null = non si scompone). */
function fattorizzaMonica(l: string, t: number[]): { c: number[]; e: number }[] | null {
  const c = polyTrim(t);
  const deg = c.length - 1;
  if (deg <= 1) return [{ c, e: 1 }];
  /* grado 2: x² + px + q = (x + r)(x + s), radici intere */
  if (deg === 2) {
    const [q, p] = c;
    if (q === 0) {
      const f = fattorizzaMonica(l, [p, 1]);
      return f ? [{ c: [0, 1], e: 1 }, ...f] : null;
    }
    for (let d = 1; d <= Math.min(Math.abs(q), 10_000); d++) {
      if (q % d !== 0) continue;
      for (const r of [d, -d]) {
        const s = q / r;
        if (r + s === p) return [{ c: [r, 1], e: 1 }, { c: [s, 1], e: 1 }];
      }
    }
    return null;
  }
  /* solo gradi pari: sostituzione u = x², poi ritorno con diff. di quadrati */
  const soloPari = c.every((x, i) => (i % 2 === 1 ? x === 0 : true));
  if (soloPari) {
    const inU = c.filter((_, i) => i % 2 === 0);
    const f = fattorizzaMonica(l, inU);
    if (!f) return null;
    const out: { c: number[]; e: number }[] = [];
    for (const fatt of f) {
      const g = fatt.c.findIndex((x) => x !== 0);
      if (g > 0) out.push({ c: [...Array(2 * g).fill(0), 1], e: fatt.e * g });
      const resto = polyTrim(fatt.c.slice(g));
      if (resto.length - 1 === 1) {
        const a = resto[0];
        const b2 = a < 0 ? Math.round(Math.sqrt(-a)) : -1;
        if (b2 > 0 && b2 * b2 === -a) {
          out.push({ c: [-b2, 1], e: fatt.e }, { c: [b2, 1], e: fatt.e });
        } else {
          out.push({ c: resto, e: fatt.e }); /* es. a² + 1: resta */
        }
      } else {
        out.push({ c: resto, e: fatt.e });
      }
    }
    return out;
  }
  /* grado 3 monico: radici intere (divisori del termine noto) */
  if (deg === 3) {
    const q = c[0];
    const candidati = new Set<number>(q === 0 ? [0] : [1, -1]);
    const aq = Math.abs(q);
    if (q !== 0) {
      for (let d = 1; d <= Math.min(aq, 10_000); d++) {
        if (aq % d === 0) { candidati.add(d); candidati.add(-d); }
      }
    }
    for (const r of candidati) {
      /* divisione sintetica per (x − r) */
      const quo = new Array<number>(deg).fill(0);
      let riporto = 0;
      for (let i = deg; i >= 1; i--) {
        const coeff = i === deg ? c[i] : c[i] + riporto;
        quo[i - 1] = coeff;
        riporto = coeff * r;
      }
      if (q + riporto !== 0) continue;
      const resto = polyTrim(quo);
      if (resto[resto.length - 1] !== 1) continue;
      const f = fattorizzaMonica(l, resto);
      if (f) return [{ c: [-r, 1], e: 1 }, ...f];
    }
    return null;
  }
  return null;
}

/** Miglior fattorizzazione di un radicando (mai null). */
function fattorizzaPolinomio(p: Polinomio): FattPoly[] {
  const out: FattPoly[] = [];
  let c = [...p.c];
  let g = 0;
  for (const x of c) if (x !== 0) g = radMcd(g, x);
  if (g > 1) {
    out.push({ tipo: "num", v: g });
    c = c.map((x) => x / g);
  }
  const k = c.findIndex((x) => x !== 0);
  if (k < 0) return out;
  if (k > 0) {
    out.push({ tipo: "poly", lettera: p.lettera, c: [0, 1], e: k });
    c = polyTrim(c.slice(k));
  }
  const monici = c.length - 1 >= 2 && c[c.length - 1] === 1 ? fattorizzaMonica(p.lettera, c) : null;
  if (monici) {
    for (const f of monici) out.push({ tipo: "poly", lettera: p.lettera, c: f.c, e: f.e });
  } else {
    out.push({ tipo: "poly", lettera: p.lettera, c, e: 1 });
  }
  return out;
}

/* ── nodi di servizio ── */

const radNumNodo = (v: number): Node => ({ k: "num", v: fr(v, 1) });
const radParenNodo = (a: Node): Node => (a.k === "paren" ? a : { k: "paren", a } as Node);
const radPotNodo = (base: Node, e: number): Node => ({ k: "pow", a: base, e }) as Node;
const radiceNodo = (idx: number, a: Node): Node =>
  idx === 2 ? { k: "sqrt", a } : ({ k: "root", n: idx, a } as Node);
const radFrazioneNodo = (num: Node, den: Node): Node =>
  ({ k: "div", a: num, b: den, fr: true }) as Node;
const radProdottoNodo = (nodi: Node[]): Node =>
  nodi.reduce((a, b) => ({ k: "mul", a, b }) as Node);

/** Nodo polinomio da coefficienti (gradi decrescenti, forme moniche). */
function radPolyNodo(l: string, c: number[]): Node {
  const pezzi: { segno: 1 | -1; coeff: number; grado: number }[] = [];
  for (let i = c.length - 1; i >= 0; i--) {
    if (c[i] !== 0) pezzi.push({ segno: c[i] < 0 ? -1 : 1, coeff: Math.abs(c[i]), grado: i });
  }
  const gradoNodo = (g: number): Node =>
    g === 0 ? radNumNodo(1) : g === 1 ? ({ k: "var", name: l }) : radPotNodo({ k: "var", name: l } as Node, g);
  /* il termine è in VALORE ASSOLUTO: il segno lo danno l'operatore che
     lo collega (add/sub) e, solo per il primo termine, l'eventuale «−»
     davanti. Due segni sovrapposti stampavano «a - -1» e la verifica
     esatta bocciava il box. */
  const termine = (t: { coeff: number; grado: number }): Node => {
    if (t.grado === 0) return radNumNodo(t.coeff);
    const g = gradoNodo(t.grado);
    return t.coeff === 1 ? g : ({ k: "mul", a: radNumNodo(t.coeff), b: g }) as Node;
  };
  let out = pezzi[0].segno === 1 ? termine(pezzi[0]) : ({ k: "neg", a: termine(pezzi[0]) }) as Node;
  for (let i = 1; i < pezzi.length; i++) {
    out = ({ k: pezzi[i].segno === 1 ? "add" : "sub", a: out, b: termine({ coeff: pezzi[i].coeff, grado: pezzi[i].grado }) }) as Node;
  }
  return out;
}

function radFattoreNodo(f: FattPoly): Node | null {
  if (f.tipo === "num") {
    if (!Number.isSafeInteger(f.v) || f.v > 10 ** 7) return null;
    return f.v === 1 ? null : radNumNodo(f.v);
  }
  const base = radParenNodo(radPolyNodo(f.lettera, f.c));
  return f.e === 1 ? base : radPotNodo(base, f.e);
}

/** Prodotto di fattori (numeri prima, poi lettere); lista vuota → 1. */
function radFattoriNodo(lista: FattPoly[]): Node | null {
  const numeri = lista.filter((f) => f.tipo === "num");
  const lettere = lista.filter((f) => f.tipo === "poly");
  const nodi: Node[] = [];
  for (const f of [...numeri, ...lettere]) {
    const n = radFattoreNodo(f);
    if (n === null) continue;
    nodi.push(n);
  }
  if (nodi.length === 0) return radNumNodo(1);
  return radProdottoNodo(nodi);
}

/** Radicando fattorizzato → nodo (frazione impilata se c'è il denominatore). */
function radRadicandoFattNodo(num: FattPoly[], den: FattPoly[]): Node | null {
  const denSoloUno = den.length === 0 ||
    (den.length === 1 && den[0].tipo === "num" && den[0].v === 1);
  const n = radFattoriNodo(num);
  if (!n) return null;
  if (denSoloUno) return n;
  const d = radFattoriNodo(den);
  if (!d) return null;
  return radFrazioneNodo(n, d);
}

function radPrimi(v: number): Map<number, number> | null {
  const out = new Map<number, number>();
  let m = Math.abs(v);
  for (let p = 2; p * p <= m; p++) {
    while (m % p === 0) { out.set(p, (out.get(p) ?? 0) + 1); m /= p; }
  }
  if (m > 1) out.set(m, (out.get(m) ?? 0) + 1);
  return out;
}

export function costruisciIndiceComune(espressione: string): Candidato | null {
  /* qualunque caso non previsto o numero fuori misura → null: si passa al
     percorso IA esistente senza mai interrompere la richiesta */
  try {
    return costruisciIndiceComuneInterno(espressione);
  } catch {
    return null;
  }
}

function costruisciIndiceComuneInterno(espressione: string): Candidato | null {
  let ast: Node;
  try {
    ast = parseExpression(normalizeInput(espressione));
  } catch {
    return null;
  }
  const lettere = contieniLettere(ast);
  if (lettere.size === 0 || lettere.size > 2) return null;

  /* struttura: (paren) → div|mul → due RADICALI diretti */
  const cima = ast.k === "paren" ? ast.a : ast;
  if (cima.k !== "div" && cima.k !== "mul") return null;
  const lato = (n: Node): { nodo: Node; idx: number } | null => {
    if (n.k === "sqrt") return { nodo: n, idx: 2 };
    if (n.k === "root") {
      const idx = (n as { n: number }).n;
      if (idx >= 2 && idx <= RAD_INDICE_MAX) return { nodo: n, idx };
    }
    return null;
  };
  const la = lato(cima.a), lb = lato(cima.b);
  if (!la || !lb) return null;
  const { nodo: ra, idx: idxA } = la;
  const { nodo: rb, idx: idxB } = lb;
  if (idxA === idxB) return null; /* stesso indice: altri percorsi */
  const m = radMcm(idxA, idxB);
  if (m < 5 || m > RAD_MCM_MAX) return null;
  const pA = m / idxA, pB = m / idxB;
  if (pA > RAD_POT_MAX || pB > RAD_POT_MAX) return null;

  // Alzare a una potenza pari il radicando di una radice dispari ne perde
  // il segno: la radice pari risultante fornisce il valore assoluto. Se non
  // possiamo dimostrare che il radicando è non negativo, un denominatore
  // può conservare il segno con B/|B| (B è non nullo sul suo dominio).
  // Per un fattore che può essere zero non aggiungiamo invece divisioni
  // per |B|: lasciamo il caso al costruttore generale.
  const nonNegativo = (n: Node): boolean => {
    switch (n.k) {
      case "num": return n.v.n >= 0;
      case "paren": return nonNegativo(n.a);
      case "abs": case "sqrt": return true;
      case "pow": return n.e >= 0 && (n.e % 2 === 0 || nonNegativo(n.a));
      case "add": case "mul": return nonNegativo(n.a) && nonNegativo(n.b);
      case "term": return n.t.c.n >= 0 && n.t.vars.every((v) => v.e % 2 === 0);
      default: return false;
    }
  };
  const segnoAIncerto = idxA % 2 !== 0 && pA % 2 === 0 && !nonNegativo((ra as { a: Node }).a);
  const segnoBIncerto = idxB % 2 !== 0 && pB % 2 === 0 && !nonNegativo((rb as { a: Node }).a);
  const senzaParen = (n: Node): Node => n.k === "paren" ? senzaParen(n.a) : n;
  const aa = senzaParen((ra as { a: Node }).a), bb = senzaParen((rb as { a: Node }).a);
  // Esempio generale: in √a·∛(a+c), con c>0, il dominio di √a
  // garantisce a≥0 e dunque a+c>0. La trasformazione riguarda la riga
  // intera, non il solo radicale dispari isolato.
  const maggioreDiZero = (n: Node): boolean => n.k === "num" && n.v.n > 0;
  const stessoNome = (n: Node): boolean => aa.k === "var" && senzaParen(n).k === "var" && (senzaParen(n) as { name: string }).name === aa.name;
  const bPositivoNelDominio = idxA % 2 === 0 && aa.k === "var" && bb.k === "add" &&
    ((stessoNome(bb.a) && maggioreDiZero(senzaParen(bb.b))) || (stessoNome(bb.b) && maggioreDiZero(senzaParen(bb.a))));
  if (segnoAIncerto || (segnoBIncerto && !bPositivoNelDominio && cima.k !== "div")) return null;
  const baseSegno = (rb as { a: Node }).a;
  const fattoreSegno: Node = { k: "div", a: baseSegno, b: { k: "abs", a: baseSegno }, fr: true };
  const conSegno = (n: Node): Node => segnoBIncerto && !bPositivoNelDominio ? { k: "mul", a: fattoreSegno, b: n } : n;

  const radA = radicandoPolinomio((ra as { a: Node }).a);
  const radB = radicandoPolinomio((rb as { a: Node }).a);
  if (!radA || !radB) return null;
  /* una sola lettera: è la famiglia del libro (la foto ha solo «a») */
  if (radA.num.lettera !== radB.num.lettera) return null;

  const fattA = fattorizzaPolinomio(radA.num);
  const fattB = fattorizzaPolinomio(radB.num);
  /* le potenze dell'indice comune vanno DISTRIBUITE sui fattori: mai
     polinomi espansi (il grado resta quello del radicando) */
  const alza = (fatt: FattPoly[], p: number): FattPoly[] =>
    fatt.map((f) => {
      if (f.tipo === "num") {
        const v = f.v ** p;
        if (!Number.isSafeInteger(v) || v > 10 ** 7) throw new Error("contenuto numerico troppo grande");
        return { tipo: "num", v };
      }
      return { ...f, e: f.e * p };
    });

  const espressioneLatex = printLatex(ast);
  const boxes: BoxAI[] = [];
  let corrente = ast;
  const avanza = (target: Node, nuovo: Node, prompt: string): boolean => {
    if (boxes.length >= 12) return false;
    const op = printLatex(target);
    const answer = printLatex(nuovo);
    const successiva = replaceExpressionStep(printLatex(corrente), op, answer);
    if (!successiva) return false;
    boxes.push({ op, prompt, answerLatex: answer });
    /* l'AST si tiene al passo con la riga: i prossimi op si stampano da qui.
       Sostituzione che CONSERVA l'identità dei rami invariati: quella di
       sistema (sostituisciNodo) clona ogni sottopercorso, e il riferimento
       al secondo radicale si perderebbe dopo il primo box. */
    const sostStesso = (n: Node, t: Node, r: Node): Node => {
      if (n === t) return r;
      switch (n.k) {
        case "neg": case "paren": case "sqrt": case "root": case "pow": case "powfrac": {
          const a = sostStesso(n.a, t, r);
          return a === n.a ? n : ({ ...n, a }) as Node;
        }
        case "add": case "sub": case "mul": case "div": {
          const a = sostStesso(n.a, t, r);
          const b = sostStesso(n.b, t, r);
          return a === n.a && b === n.b ? n : ({ ...n, a, b }) as Node;
        }
        default:
          return n;
      }
    };
    corrente = target === corrente ? nuovo : sostStesso(corrente, target, nuovo);
    return true;
  };

  /* B1 e B2: porto ogni radicale all'indice comune */
  const alzata = (r: Node, p: number): Node =>
    radiceNodo(m, radPotNodo(radParenNodo((r as { a: Node }).a), p));
  const nuovaA = alzata(ra, pA);
  const nuovaB = alzata(rb, pB);
  const promptIndice =
    "Porto i radicali allo stesso indice: uso il minimo comune multiplo degli indici e alzo ogni radicando alla potenza che manca.";
  if (!avanza(ra, nuovaA, promptIndice)) return null;
  if (segnoBIncerto) {
    // La condizione B≠0 è già implicita nel denominatore originale, quindi
    // B/|B| è definito senza restringere ulteriormente il dominio.
    const rapporto: Node = cima.k === "div"
      ? { k: "div", a: nuovaA, b: nuovaB, fr: cima.fr }
      : { k: "mul", a: nuovaA, b: nuovaB };
    if (!avanza(corrente, conSegno(rapporto), "Porto la radice allo stesso indice conservando il segno del radicando.")) return null;
  } else if (!avanza(rb, nuovaB, promptIndice)) return null;

  /* B3: radice unica (rapporto o prodotto dei radicandi all'indice comune) */
  const potRad = (r: Node, p: number): Node =>
    radPotNodo(radParenNodo((r as { a: Node }).a), p);
  const mergiata = radiceNodo(
    m,
    cima.k === "div"
      ? radFrazioneNodo(potRad(ra, pA), potRad(rb, pB))
      : radProdottoNodo([potRad(ra, pA), potRad(rb, pB)]),
  );
  if (!avanza(corrente, conSegno(mergiata),
    cima.k === "div"
      ? "Unisco le due radici in una sola: stesso indice, il rapporto dei radicandi sotto un'unica radice."
      : "Unisco le due radici in una sola: stesso indice, il prodotto dei radicandi sotto un'unica radice.")) return null;

  /* B4: scomposizione con le potenze già distribuite sui fattori.
     Numeratore = (fattori del primo)^{pA} · (den. costante del secondo)^{pB};
     denominatore = (den. costante del primo)^{pA} · (fattori del secondo)^{pB}
     (con la moltiplicazione il secondo radicando sta sopra). */
  const numB4: FattPoly[] = [...alza(fattA, pA)];
  const denB4: FattPoly[] = [{ tipo: "num", v: radA.den ** pA }];
  if (cima.k === "div") {
    denB4.push(...alza(fattB, pB));
  } else {
    numB4.push(...alza(fattB, pB));
    denB4.push({ tipo: "num", v: radB.den ** pB });
  }
  const radicandoB4 = radRadicandoFattNodo(numB4, denB4);
  if (!radicandoB4) return null;
  const nodoB4 = conSegno(radiceNodo(m, radicandoB4));
  if (!avanza(corrente, nodoB4,
    "Svolgo le potenze e scompongo i polinomi: raccolgo i fattori comuni e uso le regole di scomposizione.")) return null;

  /* B5: semplificazione (cancellazione dei fattori comuni + numeri) */
  const soloPoly = (lista: FattPoly[]): { lettera: string; c: number[]; e: number }[] =>
    lista.filter((f): f is Extract<FattPoly, { tipo: "poly" }> => f.tipo === "poly");
  const chiave = (f: { lettera: string; c: number[] }): string => `${f.lettera}|${f.c.join(",")}`;
  const numF = soloPoly(numB4), denF = soloPoly(denB4);
  const contatore = new Map<string, number>();
  for (const f of numF) contatore.set(chiave(f), (contatore.get(chiave(f)) ?? 0) + f.e);
  const denRid: typeof denF = [];
  for (const f of denF) {
    const k = chiave(f);
    const su = contatore.get(k) ?? 0;
    const via = Math.min(su, f.e);
    contatore.set(k, su - via);
    if (f.e - via > 0) denRid.push({ ...f, e: f.e - via });
  }
  const numRid: typeof numF = [];
  for (const f of numF) {
    const resto = contatore.get(chiave(f)) ?? 0;
    if (resto > 0) numRid.push({ ...f, e: resto });
  }
  let constNum = numB4.filter((f) => f.tipo === "num").reduce((a, f) => a * (f.tipo === "num" ? f.v : 1), 1);
  let constDen = denB4.filter((f) => f.tipo === "num").reduce((a, f) => a * (f.tipo === "num" ? f.v : 1), 1);
  const gNum = radMcd(constNum, constDen) || 1;
  constNum /= gNum; constDen /= gNum;
  const radicandoB5 = radRadicandoFattNodo(
    constNum !== 1 ? [{ tipo: "num", v: constNum }, ...numRid.map((f) => ({ tipo: "poly" as const, ...f }))] : numRid.map((f) => ({ tipo: "poly" as const, ...f })),
    constDen !== 1 ? [{ tipo: "num", v: constDen }, ...denRid.map((f) => ({ tipo: "poly" as const, ...f }))] : denRid.map((f) => ({ tipo: "poly" as const, ...f })),
  );
  if (!radicandoB5) return null;
  const nodoB5 = conSegno(radiceNodo(m, radicandoB5));
  if (printLatex(nodoB5) !== printLatex(corrente)) {
    if (!avanza(corrente, nodoB5,
      "Semplifico: cancello i fattori uguali sopra e sotto e moltiplico i numeri.")) return null;
  }

  /* B6: estrazione dei fattori con esponente multiplo dell'indice.
     Con indice pari, un fattore estratto a potenza dispari richiede |...|:
     altrimenti si perderebbe il segno per i valori negativi. */
  type FattPolyP = { lettera: string; c: number[]; e: number };
  const estrai = (lista: FattPolyP[]): { dentro: FattPolyP[]; fuori: FattPolyP[] } => {
    const dentro: FattPolyP[] = [], fuori: FattPolyP[] = [];
    for (const f of lista) {
      if (f.e >= m && f.e % m === 0) {
        fuori.push({ ...f, e: f.e / m });
      } else {
        dentro.push(f);
      }
    }
    return { dentro, fuori };
  };
  const eNum = estrai(numRid), eDen = estrai(denRid);
  /* numeri: solo potenze prime con esponente multiplo dell'indice */
  let fuoriNum = 1, fuoriDen = 1;
  const dentroDaNumeri = (v: number, su: boolean): FattPoly[] => {
    if (v === 1 || v === 0) return [];
    const primi = radPrimi(v);
    if (!primi) return [{ tipo: "num", v }];
    const dentro: FattPoly[] = [];
    for (const [p, e] of primi) {
      if (e % m === 0) { if (su) fuoriNum *= p ** (e / m); else fuoriDen *= p ** (e / m); }
      else dentro.push({ tipo: "num", v: p ** e });
    }
    return dentro;
  };
  const comeFattPoly = (lista: FattPolyP[]): FattPoly[] =>
    lista.map((f) => ({ tipo: "poly" as const, ...f }));
  const dentroNumL: FattPoly[] = [...comeFattPoly(eNum.dentro), ...dentroDaNumeri(constNum, true)];
  const dentroDenL: FattPoly[] = [...comeFattPoly(eDen.dentro), ...dentroDaNumeri(constDen, false)];
  if (fuoriNum !== 1 || fuoriDen !== 1) {
    /* fuori dalla radice: prodotto (o frazione) dei fattori estratti */
    const fuoriNodi: Node[] = [];
    if (fuoriNum !== 1) fuoriNodi.push(radNumNodo(fuoriNum));
    for (const f of eNum.fuori) {
      const n = radFattoreNodo({ tipo: "poly", ...f });
      if (n) fuoriNodi.push(m % 2 === 0 && f.e % 2 !== 0 ? { k: "abs", a: n } : n);
    }
    let fuoriNodo: Node | null = fuoriNodi.length ? radProdottoNodo(fuoriNodi) : radNumNodo(1);
    if (fuoriNodo && (fuoriDen !== 1 || eDen.fuori.length > 0)) {
      const denNodi: Node[] = [];
      if (fuoriDen !== 1) denNodi.push(radNumNodo(fuoriDen));
      for (const f of eDen.fuori) {
        const n = radFattoreNodo({ tipo: "poly", ...f });
        if (n) denNodi.push(m % 2 === 0 && f.e % 2 !== 0 ? { k: "abs", a: n } : n);
      }
      const denNode = denNodi.length ? radProdottoNodo(denNodi) : radNumNodo(1);
      fuoriNodo = radFrazioneNodo(fuoriNodo, denNode);
    }
    const dentroRadicando = radRadicandoFattNodo(dentroNumL, dentroDenL);
    if (!fuoriNodo || !dentroRadicando) return null;
    const dentroNodo = radiceNodo(m, dentroRadicando);
    const dentroRadicande = dentroNumL.length === 0 && dentroDenL.length === 0;
    const nodoB6 = conSegno(dentroRadicande ? fuoriNodo : radProdottoNodo([fuoriNodo, dentroNodo]));
    if (printLatex(nodoB6) !== printLatex(corrente)) {
      if (!avanza(corrente, nodoB6,
        "Porto fuori dalla radice i fattori con esponente multiplo dell'indice.")) return null;
    }
  }

  const finale = printLatex(corrente);
  if (boxes.length === 0) return null;

  return {
    espressioneLatex,
    sezioni: [{ title: "STESSO INDICE", boxes }],
    righeProgressive: [espressioneLatex],
    risultatoFinaleLatex: finale,
  };
}

/* ─── 5. PERFETTI SOTTO RADICE (12/11, foto «ma_cos») ─────────────────
 * Espressioni fratte la cui traccia mescola una radice QUADRATA di un
 * trinomio quadrato perfetto, una radice CUBICA di un cubo perfetto di
 * binomio e un denominatore con radice quadrata:
 *     (√(x²+6x+9) + ∛(x³−3x²+3x−1)) : √(x+7)
 * Era la tipologia della foto per cui NESSUN costruttore deterministico
 * rispondeva e l'IA veniva bocciata 3 volte su 3 (il rigoroso |x+3| era
 * «non verificabile con il motore disponibile»: il motore non sapeva
 * leggere il valore assoluto — ora lo sa, e la traccia ha anche il
 * percorso guidato senza IA). Una radice pari di un quadrato dà il
 * valore assoluto del binomio, salvo ipotesi esplicite sul suo segno.
 * Filosofia DSA: i box dicono SOLO il
 * metodo; ogni risposta la scrive lo studente. Forme non riconosciute →
 * null: si passa al percorso IA senza alterare nulla. */

/** Radice k-esima ESATTA di un razionale (null se non è una potenza perfetta). */
function radiceRazionale(f: Frac, k: number): Frac | null {
  const radInt = (v: number): number | null => {
    if (v < 0) return null;
    let r = Math.round(v ** (1 / k));
    for (let c = Math.max(1, r - 2); c <= r + 2; c++) if (c ** k === v) return c;
    return null;
  };
  /* (12/11) base NEGATIVA ammessa per indici DISPARI: (x−1)³ = x³−3x²+3x−1
   * ha termine noto −1 e b = −1. Per indici pari resta null (nessuna base). */
  if (f.n < 0) {
    if (k % 2 === 0) return null;
    const r = radiceRazionale({ n: -f.n, d: f.d }, k);
    return r ? fNeg(r) : null;
  }
  const n = radInt(f.n);
  const d = radInt(f.d);
  if (n === null || d === null || n === 0) return null;
  return fr(n, d);
}

/** Quadrato perfetto di un binomio lineare (ax+b)² da un trinomio espanso
 *  di grado 2 (null altrimenti). Le variabili devono essere una sola, con
 *  esponenti 2/1/0 e coefficiente noto diverso da zero. */
function quadratoBinomio(p: Term[]): { a: Frac; b: Frac; v: string } | null {
  if (p.length !== 3) return null;
  const [t2, t1, t0] = p;
  if (termDegree(t2) !== 2 || termDegree(t1) !== 1 || termDegree(t0) !== 0) return null;
  if (t2.vars.length !== 1 || t2.vars[0].e !== 2) return null;
  if (t1.vars.length !== 1 || t1.vars[0].v !== t2.vars[0].v || t1.vars[0].e !== 1) return null;
  const v = t2.vars[0].v;
  const a = radiceRazionale(t2.c, 2);
  const b = radiceRazionale(t0.c, 2);
  if (!a || !b || a.n === 0 || b.n === 0) return null;
  const doppio = (x: Frac, y: Frac) => fMul(fMul(fr(2, 1), x), y);
  if (fEq(doppio(a, b), t1.c)) return { a, b, v };
  if (fEq(doppio(a, fNeg(b)), t1.c)) return { a, b: fNeg(b), v };
  return null;
}

/** Cubo perfetto di un binomio lineare (ax+b)³ da un polinomio espanso di
 *  grado 3: c₃=a³, c₂=3a²b, c₁=3ab², c₀=b³ (null altrimenti). */
function cuboBinomio(p: Term[]): { a: Frac; b: Frac; v: string } | null {
  if (p.length !== 4) return null;
  const [t3, t2, t1, t0] = p;
  if (termDegree(t3) !== 3 || termDegree(t2) !== 2 || termDegree(t1) !== 1 || termDegree(t0) !== 0) return null;
  if (t3.vars.length !== 1 || t3.vars[0].e !== 3) return null;
  const v = t3.vars[0].v;
  const a = radiceRazionale(t3.c, 3);
  const b = radiceRazionale(t0.c, 3);
  if (!a || !b || a.n === 0 || b.n === 0) return null;
  const ok2 = fEq(fMul(fr(3, 1), fMul(fMul(a, a), b)), t2.c);
  const ok1 = fEq(fMul(fr(3, 1), fMul(a, fMul(b, b))), t1.c);
  if (!ok2 || !ok1) return null;
  if (t2.vars.length !== 1 || t2.vars[0].v !== v || t2.vars[0].e !== 2) return null;
  if (t1.vars.length !== 1 || t1.vars[0].v !== v || t1.vars[0].e !== 1) return null;
  return { a, b, v };
}

/** LaTeX del binomio lineare ax+b (coefficienti razionali, mai «1x»). */
function binomioLatex(a: Frac, b: Frac, v: string): string {
  const parteA = termToLatex(term([{ v, e: 1 }], a));
  /* termToLatex con «auto» stampa GIÀ il segno (es. «-1»): per b<0 lo
   * concateno direttamente, senza fNeg (che perderebbe il meno). */
  const corpo = b.n === 0 ? parteA
    : b.n < 0 ? `${parteA}${termToLatex(term([], b))}`
    : `${parteA}+${termToLatex(term([], b))}`;
  return corpo;
}

/** Polinomio espanso a UNA variabile da un nodo (null se non è un add/sub
 *  di termini: il radicando già scomposto o con radici resta fuori). */
function polinomioRadicando(nodoIn: Node): { p: Term[]; v: string } | null {
  /* il radicando arriva avvolto nelle parentesi della traccia: √((x²+6x+9)) */
  let n = nodoIn;
  while (n.k === "paren") n = n.a;
  if (n.k !== "add" && n.k !== "sub") return null;
  let p: Term[];
  try {
    p = evalPoly(n);
  } catch {
    return null;
  }
  if (p.length < 2) return null;
  const vars = new Set<string>();
  for (const t of p) for (const x of t.vars) vars.add(x.v);
  if (vars.size !== 1) return null;
  return { p, v: [...vars][0] };
}

function nodoRadice(n: Node): { idx: number; radicando: Node } | null {
  if (n.k === "sqrt") return { idx: 2, radicando: n.a };
  if (n.k === "root" && n.n === 3) return { idx: 3, radicando: n.a };
  return null;
}

export function costruisciPerfettiSottoRadice(espressione: string): Candidato | null {
  let ast: Node;
  try {
    ast = parseExpression(normalizeInput(espressione));
  } catch {
    return null;
  }
  const scartiParen = (m: Node): Node => {
    while (m.k === "paren") m = m.a;
    return m;
  };
  /* solo una FRAZIONE: numeratore somma di due radicali, denominatore radice */
  const nodo = scartiParen(ast);
  if (nodo.k !== "div") return null;
  const numeratoreNodo = scartiParen(nodo.a);
  const denominatoreNodo = scartiParen(nodo.b);

  /* NUMERATORE: esattamente due termini, ciascuno una radice nuda */
  if (numeratoreNodo.k !== "add" && numeratoreNodo.k !== "sub") return null;
  const termini: Array<{ sign: 1 | -1; node: Node }> = [];
  const raccogli = (m: Node, sign: 1 | -1): boolean => {
    if (m.k === "add") return raccogli(m.a, sign) && raccogli(m.b, sign);
    if (m.k === "sub") return raccogli(m.a, sign) && raccogli(m.b, sign === 1 ? -1 : 1);
    if (m.k === "neg") return raccogli(m.a, sign === 1 ? -1 : 1);
    termini.push({ sign, node: m });
    return true;
  };
  if (!raccogli(numeratoreNodo, 1) || termini.length !== 2) return null;
  if (termini.some((t) => t.sign === -1)) return null;

  /* ogni termine: radice di un polinomio espanso che è una potenza perfetta */
  const perfetti: Array<{ idx: number; a: Frac; b: Frac; v: string; nodoRad: Node; radLat: string; powLat: string }> = [];
  const viste = new Set<number>();
  for (const t of termini) {
    const rad = nodoRadice(t.node);
    if (!rad) return null;
    const poly = polinomioRadicando(rad.radicando);
    if (!poly) return null;
    const scomp = rad.idx === 2 ? quadratoBinomio(poly.p) : cuboBinomio(poly.p);
    if (!scomp) return null;
    if (scomp.v !== poly.v) return null;
    if (viste.has(rad.idx)) return null; /* circoscritto: un √ e un ∛ */
    viste.add(rad.idx);
    const bin = binomioLatex(scomp.a, scomp.b, scomp.v);
    const powLat = `\\left(${bin}\\right)^{${rad.idx}}`;
    perfetti.push({
      idx: rad.idx, a: scomp.a, b: scomp.b, v: scomp.v,
      nodoRad: t.node, radLat: printLatex(rad.radicando), powLat,
    });
  }
  if (!viste.has(2) || !viste.has(3)) return null;

  /* DENOMINATORE: radice quadrata di un polinomio espanso NON perfetto */
  const den = nodoRadice(denominatoreNodo);
  if (!den || den.idx !== 2) return null;
  const polyDen = polinomioRadicando(den.radicando);
  if (!polyDen) return null;
  if (polyDen.v !== perfetti[0].v || polyDen.v !== perfetti[1].v) return null;
  if (quadratoBinomio(polyDen.p)) return null; /* si semplificherebbe: altro percorso */

  const parseLa = (latex: string): Node => parseExpression(normalizeInput(latex, true));
  const espressioneLatex = printLatex(ast);
  const boxes: BoxAI[] = [];
  let riga = espressioneLatex;
  const avanza = (op: string, answer: string, prompt: string): boolean => {
    const successiva = replaceExpressionStep(riga, op, answer);
    if (!successiva) return false;
    boxes.push({ op, prompt, answerLatex: answer });
    riga = successiva;
    return true;
  };

  for (const pf of perfetti) {
    const radNodo = pf.nodoRad as { k: string; n?: number; a: Node };
    const radLatIntera = radNodo.k === "sqrt"
      ? `\\sqrt{${pf.powLat}}`
      : `\\sqrt[3]{${pf.powLat}}`;
    /* box A: SCOMPONGO il radicando (quadrato/cubo perfetto di binomio) */
    const promptS = pf.idx === 2
      ? "Scompongo il radicando: è il quadrato perfetto di un binomio."
      : "Scompongo il radicando: è il cubo perfetto di un binomio.";
    if (!avanza(pf.radLat, pf.powLat, promptS)) return null;
    /* Una radice pari di un quadrato dà il VALORE ASSOLUTO del binomio;
       la radice cubica invece conserva il segno del binomio. */
    const binomio = binomioLatex(pf.a, pf.b, pf.v);
    const risposta = pf.idx === 2 ? `\\left|${binomio}\\right|` : binomio;
    const promptR = pf.idx === 2
      ? "Svolgo la radice quadrata e considero il valore assoluto."
      : "Svolgo la radice cubica del cubo perfetto.";
    if (!avanza(radLatIntera, risposta, promptR)) return null;
  }

  /* Il valore assoluto non è un termine simile al binomio: non si può
     sommare come un polinomio senza imporre un'ipotesi sul suo segno. */
  if (boxes.length === 0) return null;

  return {
    espressioneLatex,
    sezioni: [{ title: "PERFETTI SOTTO RADICE", boxes }],
    righeProgressive: [espressioneLatex],
    risultatoFinaleLatex: riga,
  };
}

