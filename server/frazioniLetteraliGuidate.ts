/** Percorso deterministico, verificabile e volutamente circoscritto per la
 * somma/differenza di due frazioni letterali. Copre anche un fattore monomiale
 * esterno a ciascuna frazione, come nella foto del 7/11/2026.
 *
 * Non modifica la traccia, non anticipa risultati: ogni trasformazione ha un
 * box che lo studente deve completare. Le risposte qui sono solo interne e
 * il chiamante deve passarle a riparaEsercizio + trascrizioneFedele.
 * Forme non riconosciute, riduzioni che richiedono cancellazioni e operazioni
 * non verificabili esattamente sono lasciate al costruttore IA esistente.
 */
import {
  normalizeInput, parseExpression, parsePolyLoose, polyEquals, polyToLatex,
  printLatex, rationalPolyEquals, termKey, type Node, type Term,
} from "../client/src/lib/espressioni";
import { evalRat } from "../client/src/lib/fratte";
import { replaceExpressionStep } from "../client/src/lib/progressiveExpression";
import { costruisciFrazioniConiugate } from "./prodottiNotevoli";
import type { BoxAI, EsercizioAI, SezioneAI } from "./costruisci";

function senzaParentesi(node: Node): Node {
  let n = node;
  while (n.k === "paren") n = n.a;
  return n;
}

function testo(node: Node): string {
  return printLatex(senzaParentesi(node));
}

function parse(raw: string): Node {
  return parseExpression(normalizeInput(raw.replace(/\//g, "⁄"), true));
}

/* Limiti cautelativi PRIMA della valutazione polinomiale: niente radici,
 * frazioni annidate, decimali o potenze elevate con espansioni esplosive. */
function polinomioSicuro(node: Node, profondita = 0): boolean {
  if (profondita > 24) return false;
  switch (node.k) {
    case "num": return !node.dec && node.v.d === 1 && Math.abs(node.v.n) <= 1000;
    case "var": return true;
    case "term": return node.t.c.d === 1 && Math.abs(node.t.c.n) <= 1000 &&
      node.t.vars.every(v => Number.isInteger(v.e) && v.e >= 0 && v.e <= 6);
    case "paren": case "neg": return polinomioSicuro(node.a, profondita + 1);
    case "add": case "sub": case "mul":
      return polinomioSicuro(node.a, profondita + 1) && polinomioSicuro(node.b, profondita + 1);
    case "pow": return Number.isInteger(node.e) && node.e >= 0 && node.e <= 4 &&
      polinomioSicuro(node.a, profondita + 1) &&
      (!(senzaParentesi(node.a).k === "add" || senzaParentesi(node.a).k === "sub") || node.e <= 2);
    default: return false;
  }
}

/* Stima conservativa delle espansioni, calcolata sull'albero PRIMA di
 * espandere: evita prodotti di molti polinomi con crescita esponenziale. */
function terminiStimati(node: Node): number {
  const n = senzaParentesi(node);
  switch (n.k) {
    case "num": case "var": case "term": return 1;
    case "neg": return terminiStimati(n.a);
    case "add": case "sub": return Math.min(33, terminiStimati(n.a) + terminiStimati(n.b));
    case "mul": return Math.min(33, terminiStimati(n.a) * terminiStimati(n.b));
    case "pow": return Math.min(33, Math.pow(terminiStimati(n.a), n.e));
    default: return 33;
  }
}

function monomioSicuro(node: Node): Term[] | null {
  if (!polinomioSicuro(node) || terminiStimati(node) !== 1) return null;
  const p = parsePolyLoose(testo(node));
  if (!p || p.length !== 1 || p[0].c.n === 0 || p[0].c.d !== 1 ||
    p[0].vars.some(v => v.e < 0 || v.e > 6)) return null;
  return p;
}

function polinomioDelNodo(node: Node): Term[] | null {
  if (!polinomioSicuro(node) || terminiStimati(node) > 16) return null;
  const p = parsePolyLoose(testo(node));
  if (!p?.length || p.length > 4 || p.some(t => t.c.d !== 1 || t.vars.some(v => v.e < 0 || v.e > 6))) return null;
  return p;
}

type Addendo = { segno: 1 | -1; nodo: Node };
function addendi(nodo: Node, segno: 1 | -1 = 1): Addendo[] {
  const n = senzaParentesi(nodo);
  if (n.k === "add") return [...addendi(n.a, segno), ...addendi(n.b, segno)];
  if (n.k === "sub") return [...addendi(n.a, segno), ...addendi(n.b, segno === 1 ? -1 : 1)];
  if (n.k === "neg") return addendi(n.a, segno === 1 ? -1 : 1);
  if (n.k === "num" && n.v.n < 0) {
    return [{ segno: segno === 1 ? -1 : 1, nodo: { ...n, v: { ...n.v, n: -n.v.n } } }];
  }
  return [{ segno, nodo: n }];
}

function primaCoppiaSimile(numeratore: Node): [Addendo, Addendo] | null {
  const gruppi = new Map<string, Addendo[]>();
  for (const a of addendi(numeratore)) {
    const p = parsePolyLoose(printLatex(a.nodo));
    if (!p || p.length !== 1) continue;
    const key = termKey(p[0]);
    const gruppo = gruppi.get(key) ?? [];
    gruppo.push(a);
    if (gruppo.length === 2) return [gruppo[0], gruppo[1]];
    gruppi.set(key, gruppo);
  }
  return null;
}

function operazioneCoppia([a, b]: [Addendo, Addendo]): string {
  return `${a.segno < 0 ? "-" : ""}${printLatex(a.nodo)}${b.segno < 0 ? "-" : "+"}${printLatex(b.nodo)}`;
}

function risultatoPolinomiale(op: string): string | null {
  const p = parsePolyLoose(op);
  return p === null ? null : polyToLatex(p);
}

function frazione(node: Node): Extract<Node, { k: "div" }> | null {
  const n = senzaParentesi(node);
  return n.k === "div" && n.fr ? n : null;
}

/* (12/11) FRATTE GENERICHE: il percorso copre ora
 *  - somme/differenze di N frazioni (non solo due), anche con NUMERATORI
 *    polinomiali e con addendi interi (denominatore 1);
 *  - PRODOTTO e QUOZIENTE di due frazioni (moltiplico in croce / reciproca).
 * Ogni box è verificato esattamente e collegato alla riga; una sola
 * assunzione non dimostrabile (cancellazione, den zero, espansioni
 * enormi) rimanda tutto al costruttore IA. */
const MAX_ADDENDI = 6;

function prodottoSicuro(pezzi: string[]): string | null {
  if (!pezzi.length) return "1";
  if (pezzi.length > 4) return null;
  const op = pezzi.map((p) => `\\left(${p}\\right)`).join("\\cdot");
  const p = parsePolyLoose(op);
  if (!p?.length || p.length > 16 || p.some(t => t.c.d !== 1 || t.vars.some(v => v.e < 0 || v.e > 6))) return null;
  return polyToLatex(p);
}

function prodottoTesto(pezzi: string[]): string {
  return pezzi.length ? pezzi.map((p) => `\\left(${p}\\right)`).join("\\cdot") : "1";
}

/** Parentesi attorno a somma/differenza: senza, «-x+1» negherebbe solo x.
 * (12/11) NON incapsula però i prodotti già bilanciati come
 * \left(2x\right)\cdot\left(x+1\right): il «+» sta dentro le parentesi e
 * la doppia coppia di \left…\right rompeva il collegamento dei box dopo
 * l'espansione (i termini restavano prigionieri di una parentesi in più). */
function frazioneSicura(t: string): string {
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "(" || c === "{") depth++;
    else if (c === ")" || c === "}") depth--;
    else if (i > 0 && depth === 0 && (c === "+" || c === "-")) return `\\left(${t}\\right)`;
  }
  return t;
}

type AddendoFrazione = { segno: 1 | -1; numeratore: Node | null; den: Term[] | null; denTesto: string | null; nodo: Node };

/** true se nel ramo c'è una parentesi attorno a una somma/differenza: le
 * risposte delle espansioni restano tra parentesi e i termini simili dentro
 * e fuori non sono fratelli finché non si scolgono. */
function haParentesiDiSomma(n: Node): boolean {
  switch (n.k) {
    case "paren": return true;
    case "add": case "sub": case "mul": case "div":
      return haParentesiDiSomma(n.a) || haParentesiDiSomma(n.b);
    case "neg": case "sqrt": case "pow": case "powfrac": case "root":
      return haParentesiDiSomma(n.a);
    default: return false;
  }
}

/** Box di scolgo parentesi al numeratore (o ramo) corrente: solo forma,
 * valore verificato esattamente. Null se il motore non lo sa garantire. */
function boxSenzaParentesi(riga: string, ramo: Node): BoxAI | null {
  if (!haParentesiDiSomma(ramo)) return null;
  const op = printLatex(ramo);
  const risposta = risultatoPolinomiale(op);
  if (!risposta || rationalPolyEquals(op, risposta) !== true) return null;
  return { op, answerLatex: risposta, simbolico: true,
    criterioDidattico: "somma_ridotta", prompt: "Riscrivo la somma senza parentesi." };
}

/** Ogni addendo deve essere una frazione impilata (o un termine intero,
 * che conta come frazione con denominatore 1) con parti polinomiali
 * sicure; altrimenti null e si lascia il posto all'IA. */
function addendiFrazione(radice: Node): AddendoFrazione[] | null {
  const lista = addendi(radice);
  if (lista.length < 2 || lista.length > MAX_ADDENDI) return null;
  const out: AddendoFrazione[] = [];
  for (const a of lista) {
    const f = frazione(a.nodo);
    if (f) {
      const num = polinomioDelNodo(f.a), den = polinomioDelNodo(f.b);
      if (!num?.length || !den?.length) return null;
      out.push({ segno: a.segno, numeratore: f.a, den, denTesto: testo(f.b), nodo: a.nodo });
    } else {
      const num = polinomioDelNodo(a.nodo);
      if (!num?.length) return null;
      out.push({ segno: a.segno, numeratore: a.nodo, den: null, denTesto: null, nodo: a.nodo });
    }
  }
  if (!out.some(a => a.den?.some(t => t.vars.length > 0))) return null;
  return out;
}

/** Somma/differenza di N fratte: denominatore comune = prodotto dei
 * denominatori distinti, un box di raccolta, un box per ogni prodotto del
 * numeratore, raggruppamento dei termini simili, sviluppo del denominatore. */
function costruisciSommaGenerica(sorgente: Node, espressioneLatex: string): EsercizioAI | null {
  let riga = espressioneLatex;
  const sezioni: SezioneAI[] = [];
  const applica = (box: BoxAI): boolean => {
    const successiva = replaceExpressionStep(riga, box.op, box.answerLatex);
    if (!successiva || rationalPolyEquals(riga, successiva) !== true) return false;
    riga = successiva;
    return true;
  };

  const addendi0 = addendiFrazione(senzaParentesi(parse(riga)));
  if (!addendi0) return null;
  const denDistinti: Term[][] = [];
  for (const a of addendi0) {
    if (!a.den) continue;
    if (!denDistinti.some(d => polyEquals(d, a.den!))) denDistinti.push(a.den);
  }
  const denTesti = denDistinti.map(d => polyToLatex(d));
  const denComuneTesto = denTesti.length === 1 ? denTesti[0] : prodottoTesto(denTesti);
  const denEspanso = parsePolyLoose(denComuneTesto);
  const ridotta = evalRat(sorgente);
  // Non nascondere una semplificazione o una condizione di esistenza:
  // se il prodotto del denominatore si cancella, non usare questo percorso.
  if (!denEspanso?.length || !ridotta.den.length || !polyEquals(denEspanso, ridotta.den)) return null;

  // Fattore che ogni frazione deve ricevere: il prodotto dei denominatori
  // DISTINTI diversi dal proprio; gli addendi interi ricevono il comune.
  const terminiComune = addendi0.map((a) => {
    const n = testo(a.numeratore!);
    const altri = a.den
      ? denDistinti.filter(d => !polyEquals(d, a.den!)).map(d => polyToLatex(d))
      : denTesti;
    const fattore = prodottoTesto(altri); /* già \left(…\right)·\left(…\right) */
    const termine = fattore === "1"
      ? frazioneSicura(n)
      : `\\left(${n}\\right)\\cdot${fattore}`;
    return { segno: a.segno, termine };
  });
  const unicaFrazione = `\\dfrac{${terminiComune.map((t, i) => {
    const pezzo = t.segno < 0 ? `-${frazioneSicura(t.termine)}` : (i === 0 ? t.termine : `+${frazioneSicura(t.termine)}`);
    return pezzo;
  }).join("")}}{${denComuneTesto}}`;
  const raccolta: BoxAI = {
    op: printLatex(senzaParentesi(parse(riga))), answerLatex: unicaFrazione, simbolico: true,
    criterioDidattico: "frazione_unica", prompt: "Porto le frazioni allo stesso denominatore.",
  };
  if (rationalPolyEquals(raccolta.op, raccolta.answerLatex) !== true || !applica(raccolta)) return null;
  sezioni.push({ title: "DENOMINATORE COMUNE", boxes: [raccolta] });

  const calcoliNumeratore: BoxAI[] = [];
  for (const t of terminiComune) {
    if (t.termine.includes("\\cdot")) {
      const risposta = risultatoPolinomiale(t.termine);
      if (!risposta || rationalPolyEquals(t.termine, risposta) !== true) return null;
      const box: BoxAI = { op: t.termine, answerLatex: risposta, simbolico: true,
        criterioDidattico: "prodotto_svolto", prompt: "Moltiplico ogni termine tra parentesi." };
      if (!applica(box)) return null;
      calcoliNumeratore.push(box);
    }
  }

  // Raggruppare due soli addendi simili per volta; tutti i risultati sono
  // inseriti dallo studente, anche quelli uguali a zero.
  for (let i = 0; i < 24; i++) {
    const nodo = senzaParentesi(parse(riga));
    if (nodo.k !== "div") return null;
    const coppia = primaCoppiaSimile(nodo.a);
    if (!coppia) break;
    const op = operazioneCoppia(coppia), risposta = risultatoPolinomiale(op);
    if (risposta === null || rationalPolyEquals(op, risposta) !== true) return null;
    const box: BoxAI = { op, answerLatex: risposta, simbolico: true,
      criterioDidattico: "somma_ridotta", prompt: "Raggruppo e sommo i termini simili." };
    if (!applica(box)) {
      /* I termini simili possono stare dentro parentesi lasciate dalle
       * espansioni: un box di sola forma li scoglie e si riprova. */
      const nodo2 = senzaParentesi(parse(riga));
      if (nodo2.k !== "div") return null;
      const scoglio = boxSenzaParentesi(riga, nodo2.a);
      if (!scoglio || !applica(scoglio)) return null;
      calcoliNumeratore.push(scoglio);
      continue;
    }
    calcoliNumeratore.push(box);
    if (i === 23) return null;
  }
  if (calcoliNumeratore.length) sezioni.push({ title: "SVOLGO IL NUMERATORE", boxes: calcoliNumeratore });

  if (denDistinti.length > 1) {
    const nodo = senzaParentesi(parse(riga));
    if (nodo.k !== "div") return null;
    const risposta = polyToLatex(denEspanso);
    const box: BoxAI = { op: testo(nodo.b), answerLatex: risposta, simbolico: true,
      criterioDidattico: "prodotto_svolto",
      prompt: denDistinti.length === 2
        ? "Moltiplico ogni termine della prima parentesi per ogni termine della seconda."
        : "Moltiplico tra loro i fattori del denominatore." };
    if (rationalPolyEquals(box.op, box.answerLatex) !== true || !applica(box)) return null;
    sezioni.push({ title: "SVOLGO IL DENOMINATORE", boxes: [box] });
  }
  if (rationalPolyEquals(espressioneLatex, riga) !== true) return null;
  return { espressioneLatex, sezioni, righeProgressive: [espressioneLatex], risultatoFinaleLatex: riga };
}

/** Prodotto o quoziente di due fratte: raccolta in un'unica frazione
 * (prodotto in croce, o moltiplicazione per la reciproca), sviluppo dei
 * prodotti al numeratore e al denominatore, raggruppamento dei simili.
 * Qualunque cancellazione rimanda all'IA: non si nasconde mai. */
function costruisciProdottoQuoziente(sorgente: Node, espressioneLatex: string, quoziente: boolean): EsercizioAI | null {
  let riga = espressioneLatex;
  const sezioni: SezioneAI[] = [];
  const applica = (box: BoxAI): boolean => {
    const successiva = replaceExpressionStep(riga, box.op, box.answerLatex);
    if (!successiva || rationalPolyEquals(riga, successiva) !== true) return false;
    riga = successiva;
    return true;
  };
  const root = senzaParentesi(parse(riga));
  if (root.k !== "mul" && root.k !== "div") return null;
  const f1 = frazione(root.a);
  const f2 = frazione(root.b);
  if (!f1 || !f2) return null;
  const n1 = polinomioDelNodo(f1.a), n2 = polinomioDelNodo(f2.a);
  const d1 = polinomioDelNodo(f1.b), d2 = polinomioDelNodo(f2.b);
  if (!n1?.length || !n2?.length || !d1?.length || !d2?.length) return null;
  if (![...n1, ...n2, ...d1, ...d2].some(t => t.vars.length > 0)) return null;
  const tN1 = testo(f1.a), tN2 = testo(f2.a), tD1 = testo(f1.b), tD2 = testo(f2.b);
  const numRaccolto = quoziente
    ? prodottoTesto([tN1, tD2])
    : prodottoTesto([tN1, tN2]);
  const denRaccolto = quoziente
    ? prodottoTesto([tD1, tN2])
    : prodottoTesto([tD1, tD2]);
  const raccolta: BoxAI = {
    op: printLatex(root), answerLatex: `\\dfrac{${numRaccolto}}{${denRaccolto}}`, simbolico: true,
    criterioDidattico: "frazione_unica",
    prompt: quoziente
      ? "Divido per una frazione: moltiplico per la sua reciproca."
      : "Moltiplico i numeratori tra loro e i denominatori tra loro.",
  };
  if (rationalPolyEquals(raccolta.op, raccolta.answerLatex) !== true || !applica(raccolta)) return null;
  sezioni.push({ title: quoziente ? "DIVIDO PER UNA FRAZIONE" : "PRODOTTO DI FRAZIONI", boxes: [raccolta] });

  const ridotta = evalRat(sorgente);
  const boxes: BoxAI[] = [];
  const frasi = [
    [numRaccolto, ridotta.num, "SVOLGO IL NUMERATORE", "Moltiplico ogni termine tra parentesi."],
    [denRaccolto, ridotta.den, "SVOLGO IL DENOMINATORE", "Moltiplico ogni termine tra parentesi."],
  ] as const;
  for (const [op, atteso, , frase] of frasi) {
    const risposta = risultatoPolinomiale(op);
    if (!risposta || !polyEquals(parsePolyLoose(op)!, atteso) ||
        rationalPolyEquals(op, risposta) !== true) return null;
    const box: BoxAI = { op, answerLatex: risposta, simbolico: true,
      criterioDidattico: "prodotto_svolto", prompt: frase };
    if (!applica(box)) return null;
    boxes.push(box);
  }
  sezioni.push({ title: "SVOLGO IL NUMERATORE", boxes: [boxes[0]] });
  sezioni.push({ title: "SVOLGO IL DENOMINATORE", boxes: [boxes[1]] });

  for (let i = 0; i < 24; i++) {
    const nodo = senzaParentesi(parse(riga));
    if (nodo.k !== "div") return null;
    const coppia = primaCoppiaSimile(nodo.a);
    if (!coppia) break;
    const op = operazioneCoppia(coppia), risposta = risultatoPolinomiale(op);
    if (risposta === null || rationalPolyEquals(op, risposta) !== true) return null;
    const box: BoxAI = { op, answerLatex: risposta, simbolico: true,
      criterioDidattico: "somma_ridotta", prompt: "Raggruppo e sommo i termini simili." };
    if (!applica(box)) {
      const nodo2 = senzaParentesi(parse(riga));
      if (nodo2.k !== "div") return null;
      const scoglio = boxSenzaParentesi(riga, nodo2.a);
      if (!scoglio || !applica(scoglio)) return null;
      sezioni[sezioni.length - 2]!.boxes.push(scoglio);
      continue;
    }
    sezioni[sezioni.length - 2]!.boxes.push(box);
    if (i === 23) return null;
  }
  if (rationalPolyEquals(espressioneLatex, riga) !== true) return null;
  return { espressioneLatex, sezioni, righeProgressive: [espressioneLatex], risultatoFinaleLatex: riga };
}

/** Restituisce null se non può garantire una sequenza elementare, fedele,
 * esatta e senza cancellazioni implicite. Non modifica sessioni o archivio. */
export function costruisciSommaFrazioniLetterali(input: string): EsercizioAI | null {
  try {
    const primoMembro = (input.split("=")[0] ?? "").trim();
    if (!primoMembro || primoMembro.length > 500) return null;
    const sorgente = parse(primoMembro);
    const espressioneLatex = printLatex(sorgente);
    let riga = espressioneLatex;
    const sezioni: SezioneAI[] = [];
    const prefissi: BoxAI[] = [];

    // Se un fattore monomiale moltiplica una frazione (in QUALSIASI addendo),
    // lo studente lo porta nel numeratore in un box autonomo: non è una
    // riscrittura automatica.
    for (let giro = 0; giro < MAX_ADDENDI; giro++) {
      const root = senzaParentesi(parse(riga));
      const lista = root.k === "add" || root.k === "sub" ? addendi(root) : [{ segno: 1 as const, nodo: root }];
      let trovato: { op: string; box: BoxAI; successiva: string } | null = null;
      for (const a of lista) {
        const termine = senzaParentesi(a.nodo);
        if (frazione(termine) || termine.k !== "mul") continue;
        const sx = frazione(termine.a), dx = frazione(termine.b);
        if (!!sx === !!dx) continue;
        const f = sx ?? dx!;
        const fattore = sx ? termine.b : termine.a;
        if (!monomioSicuro(fattore) || !polinomioDelNodo(f.a) || !polinomioDelNodo(f.b)) continue;
        const numeratore = risultatoPolinomiale(`\\left(${testo(fattore)}\\right)\\cdot\\left(${testo(f.a)}\\right)`);
        if (!numeratore) continue;
        const op = printLatex(termine);
        const risposta = `\\dfrac{${numeratore}}{${testo(f.b)}}`;
        if (rationalPolyEquals(op, risposta) !== true) continue;
        const successiva = replaceExpressionStep(riga, op, risposta);
        if (!successiva || rationalPolyEquals(riga, successiva) !== true) continue;
        trovato = { op, successiva, box: { op, answerLatex: risposta, simbolico: true,
          criterioDidattico: "frazione_unica", prompt: "Moltiplico il numeratore per il fattore esterno." } };
        break;
      }
      if (!trovato) break;
      prefissi.push(trovato.box);
      riga = trovato.successiva;
    }
    if (prefissi.length) sezioni.push({ title: "FATTORE ESTERNO", boxes: prefissi });

    // Se la trasformazione porta a denominatori coniugati, resta valido il
    // percorso precedente, compreso il prodotto notevole finale.
    if (prefissi.length) {
      const coniugate = costruisciFrazioniConiugate(riga);
      if (coniugate) return {
        espressioneLatex,
        sezioni: [...sezioni, ...coniugate.sezioni],
        righeProgressive: [espressioneLatex],
        risultatoFinaleLatex: coniugate.risultatoFinaleLatex,
      };
    }

    const root = senzaParentesi(parse(riga));
    if (root.k === "add" || root.k === "sub") {
      const esito = costruisciSommaGenerica(sorgente, riga);
      if (esito) {
        return { ...esito, espressioneLatex,
          sezioni: [...sezioni, ...esito.sezioni],
          righeProgressive: [espressioneLatex] };
      }
      return null;
    }
    if (root.k === "mul" && frazione(root.a) && frazione(root.b)) {
      const esito = costruisciProdottoQuoziente(sorgente, riga, false);
      if (esito) {
        return { ...esito, espressioneLatex,
          sezioni: [...sezioni, ...esito.sezioni],
          righeProgressive: [espressioneLatex] };
      }
      return null;
    }
    if (root.k === "div" && frazione(root.a) && frazione(root.b)) {
      const esito = costruisciProdottoQuoziente(sorgente, riga, true);
      if (esito) {
        return { ...esito, espressioneLatex,
          sezioni: [...sezioni, ...esito.sezioni],
          righeProgressive: [espressioneLatex] };
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

