/**
 * costruisci.ts — COSTRUZIONE IA DELL'ESERCIZIO SU MISURA (25-26/10/2026).
 *
 * Lo studente trascrive l'espressione sulla seconda pagina (pezzi a mano,
 * microfono o tastiera) e preme «COSTRUISCI L'ESERCIZIO CON L'IA»: il
 * server chiede all'IA di scomporre l'espressione in passaggi minimi
 * (sezioni, box con metodo e risultati, righe progressive per il PDF,
 * risultato finale) e VERIFICA ogni conto con il motore esatto
 * (client/src/lib/espressioni.ts — modulo puro, usabile anche lato
 * server). L'app è UNIVERSALE (26/10): aritmetica, lettere, fratte,
 * radici quadrate e cubiche.
 *
 * (26/10, OPZIONE A — richiesta esplicita dell'utente) Le regole che
 * BOCCIAVANO l'esercizio intero quando un conto non tornava sono state
 * TOLTE: la pagina 3 si apre SEMPRE. L'IA propone la STRUTTURA (sezioni,
 * box, frasi didattiche, righe progressive) e il motore locale RIFA I
 * CONTI: se la risposta di un box non torna (o manca), viene ricalcolata
 * dalla STESSA operazione (frazione impilata per i numeri, polinomio per
 * le lettere). L'IA non è più un filtro ma un canditore: nessuna regola
 * respinge più l'esercizio — restano bloccanti solo i difetti di
 * struttura (manca l'espressione o nessun box leggibile), senza i quali
 * non c'è pagina 3 da mostrare.
 *
 * L'esercizio costruito diventa l'ESERCIZIO ATTIVO: salvato su database
 * (Neon/Postgres, se DATABASE_URL è configurato) oppure, in mancanza,
 * su file locale; la pagina dello studente (/esercizio) lo carica
 * automaticamente. Stesso deployment, stessa cornice dinamica del blog.
 */

import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { chatCompletion } from "./audio";
import { ripristinaPeriodiciCandidato } from "./periodiciDaSorgente";
import { canonicalizePeriodicNotation } from "../client/src/lib/periodicNotation";
import {
  latexToPlainMath,
  parsePolyLoose,
  polyEquals,
  rationalPolyEquals,
  evaluateNumericExpression,
  parseExpression,
  normalizeInput,
  polyToLatex,
  fractionResultLatex,
  printLatex,
  fAdd,
  fSub,
  fMul,
  fDiv,
  fNeg,
  fr,
  type Frac,
  type Term,
  type Node,
} from "../client/src/lib/espressioni";
import { evalRat } from "../client/src/lib/fratte";
import { ripulisciPrompt } from "../client/src/lib/promptSicuri";
import {
  exactNumericEquality,
  radicaleIndiceNegativoAPositivo,
  radicaleNegativaAPotenza,
  radicalePotenzaANegativa,
  risultatoRadicaleLatex,
} from "../client/src/lib/numericRadicalEquality";
import { normalizeKeyboardNotation } from "../client/src/lib/keyboardNotation";
import { tornateAdattive } from "../client/src/lib/verificaSostituzione";
import { formaDidatticaValida } from "../client/src/lib/criteriDidattici";
import { sommaFrazioniConAtomi, uguaglianzaRazionaleConAtomi } from "../client/src/lib/frazioniConAtomi";
import { stackedFractionsToLatex } from "../client/src/lib/appNotationLatex";
import { haContoPendente, replaceExpressionStep, safeFractionReciprocal, sameExpressionStructure, sameSourceStructure, sameResultStructure } from "../client/src/lib/progressiveExpression";
import { contiNumericiSaltati, individuaPassiMancanti } from "./passiMancanti";
import { costruisciFrazioniConiugate } from "./prodottiNotevoli";
import { costruisciSommaFrazioniLetterali } from "./frazioniLetteraliGuidate";
import {
  costruisciCatenaEsatta,
  costruisciIndiceComune,
  costruisciPerfettiSottoRadice,
  costruisciRadicaliLetterali,
  costruisciRadiciNesime,
} from "./guida-radicali";

/* ─── Forme dell'esercizio ──────────────────────────────────────────── */

export type CriterioDidattico = "frazione_unica" | "prodotto_svolto" | "somma_ridotta" | "radicale_trasformato";

export interface BoxAI {
  op: string; // LaTeX dell'operazione (un solo calcolo elementare)
  prompt?: string; // frase didattica sul METODO (mai il risultato)
  extraLatex?: string; // es. la divisione capovolta
  answerLatex: string; // risultato ridotto (frazione impilata, intero o forma con lettere)
  simbolico?: boolean; // true = si mantiene il testo originale per il confronto
  criterioDidattico?: CriterioDidattico; // forma del passo richiesto, mai il risultato
  /* (12/11, richiesta) box CONDIZIONI DI ESISTENZA: op = «denominatore \ne 0»,
   * answerLatex = SOLO il valore vietato in formato calcolatrice. Non è un
   * conto: salta contoGiusto e il collegamento alle righe; sopravvive ai
   * ricaricamenti dall'archivio. */
  condizioniEsistenza?: true;
  /* LaTeX «x \ne -1» (o «x \ne \dfrac{1}{2}»): mostrato dopo la risposta
   * giusta e nel PDF come implicazione del denominatore del box. */
  soluzioneCe?: string;
}

function criterioAmmesso(value: unknown): CriterioDidattico | undefined {
  return value === "frazione_unica" || value === "prodotto_svolto" || value === "somma_ridotta" || value === "radicale_trasformato"
    ? value : undefined;
}

export interface SezioneAI {
  title: string;
  boxes: BoxAI[];
}

export interface EsercizioAI {
  espressioneLatex: string;
  sezioni: SezioneAI[];
  righeProgressive: string[];
  risultatoFinaleLatex: string;
  /** Vincoli ancora in forma generale: non si inventano valori vietati. */
  condizioniGenerali?: string[];
}

/* ─── Valutazione sicura UNIVERSALE (26/10) ─────────────────────────── *
 * Tre strade per dire che un conto è giusto:
 *  1. valore puro — op e risultato sono numeri: aritmetica a frazioni;
 *  2. confronto SIMBOLICO — op e risultato hanno lettere: polinomi
 *     normalizzati identici (polyEquals: es. 2x+3x = 5x in qualunque ordine);
 *  3. verifica per SOSTITUZIONE — le lettere assumono valori fissi
 *     (x=2, y=3, z=5…): se op e risultato coincidono su quei valori,
 *     il conto è giusto (come fa lo studente «provando i numeri»).
 * Radici quadrate/cubiche di quadrati o cubi perfetti: valore esatto. */

/** (27/10, collaudo: «2,5 + 3/4·2 - 1/8» non si costruiva MAI — 3 prove su 3)
 *  latexValue non legge i decimali con la VIRGOLA («2,5» → null), quindi il
 *  validatore scartava l'esercizio come «non valutabile». Qui, e SOLO qui
 *  (verifica dell'output dell'IA), la virgola decimale tra due cifre — anche
 *  nella forma LaTeX «2{,}5» — diventa punto prima del calcolo. latexValue
 *  resta invariata: serve anche a controllare le risposte dello studente, che
 *  NON deve poter scrivere un decimale con la virgola al posto della frazione. */
function conPuntoDecimale(latex: string): string {
  return latex.replace(/(\d)\s*\{,\}\s*(\d)/g, "$1.$2").replace(/(\d),(\d)/g, "$1.$2");
}

/** (27/10, collaudo didattico) Correzioni DETERMINISTICHE di formule ricorrenti
 *  del testo guida che per uno studente DSA/BES sono errate o poco chiare.
 *  Non aggiungono mai numeri: sostituiscono solo il modo di dire il metodo. */
const NUM_PAROLA = "due|tre|quattro|cinque|sei|sette|otto|nove|dieci|\\d+";
export function rifinisciFrase(frase: string): string {
  let f = frase;
  // «per sé stessa due volte» per 3² è SBAGLIATO (3·3 = la base scritta DUE volte)
  f = f.replace(
    new RegExp(`Moltiplico la base per s[eé] stessa (${NUM_PAROLA}) volte`, "i"),
    (_m, n) => `Scrivo la base ${n} volte e le moltiplico`,
  );
  f = f.replace(/semplifico in croce/gi, "semplifico numeratori e denominatori");
  f = f.replace(/frazione decimale e la riduco/gi, "frazione con denominatore 10, 100… e poi semplifico");
  f = f.replace(/riduco ai minimi termini/gi, "divido numeratore e denominatore per lo stesso numero");
  f = f.replace(/dando precedenza rispetto all['’]addizione/gi, "prima della somma");
  return f.replace(/\s{2,}/g, " ").trim();
}

/* I periodici rimangono nella notazione esatta: il parser li converte in
 * frazioni. Espandere le cifre con repeat(12) produceva 36 cifre per 333,
 * oltre il limite dei numeri esatti, rendendo inverificabile l'intera foto. */
/* (10/11) ESPONENTI FRAZIONARI NEGATIVI nella verifica numerica: il parser
 * rifiuta per scelta didattica «2^{-\frac{2}{3}}» (allo studente si dice di
 * riscrivere col libro capovolgendo la base), quindi catene corrette come
 * ∛(a⁻²) = a^{-2/3} restavano «non verificabili con il motore disponibile».
 * SOLO qui, per verificare (mai mostrato allo studente), riscrivo
 * base^{-m/n} come ((base)^{m/n})^{-1}: esponente −1 intero, che il parser
 * accetta. La base è il gruppo } o ) bilanciato prima di ^, un numero, o
 * UNA sola lettera (in LaTeX «ab^{-2/3}» è a·b^{-2/3}). */
export function sbattaEsponentiFrazionariNegativi(s: string): string {
  /* Anche esponenti frazionari POSITIVI con denominatore oltre il tetto
   * didattico 9 (es. a^{11/12} dal m.c.m. tra 3 e 4): li riscrivo come
   * radice di indice d, che il parser accetta fino a 99. */
  const pat = /\^(\{)?\s*(-)?\s*\\?[dt]?frac\s*\{(\d+)\}\s*\{(\d+)\}(\})?/g;
  let result = "";
  let last = 0;
  for (const m of s.matchAll(pat)) {
    const start = m.index;
    if (m[1] === "{" && m[5] !== "}") continue; // graffa dell'esponente non chiusa: lascio stare
    const neg = !!m[2];
    const num = m[3];
    const den = m[4];
    if (!neg && Number(den) <= 9) continue; // il parser lo accetta già: lascio stare
    const c = start > 0 ? s[start - 1] : "";
    let bStart = start;
    let base = "";
    if (c === "}" || c === ")") {
      const open = c === "}" ? "{" : "(";
      let depth = 0;
      let i = start - 1;
      for (; i >= 0; i--) {
        if (s[i] === c) depth++;
        else if (s[i] === open) {
          depth--;
          if (depth === 0) break;
        }
      }
      if (i < 0) continue;
      bStart = i;
      base = s.slice(i, start);
    } else if (/[0-9]/.test(c)) {
      let i = start - 1;
      while (i > 0 && /[0-9]/.test(s[i - 1])) i--;
      bStart = i;
      base = s.slice(i, start);
    } else if (/[a-zA-Z]/.test(c)) {
      bStart = start - 1;
      base = c;
    } else {
      continue;
    }
    const interno = Number(den) > 9
      ? `(\\sqrt[${den}]{${base}})^{${num}}`
      : `(${base}^{\\frac{${num}}{${den}}})`;
    result += s.slice(last, bStart);
    result += neg ? `${interno}^{-1}` : interno;
    last = start + m[0].length;
  }
  result += s.slice(last);
  return result;
}

function valore(latex: unknown): number | null {
  if (typeof latex !== "string" || !latex.trim()) return null;
  try {
    /* (12/11, foto utente, box «1/|x−2|·2/3») GIUSTAPPOSIZIONE davanti a
     * \left|: l'evaluatore sa leggere 3\left(...\right) ma NON 3\left|...\right|
     * (es. \dfrac{2}{3\left|x-2\right|} → null). Inserisco \cdot, che non
     * cambia mai il significato di un prodotto giustapposto. */
    const conPunto = latex.replace(/([\d}])\s*(?=\\left\|)/g, "$1\\cdot ");
    return evaluateNumericExpression(sbattaEsponentiFrazionariNegativi(conPunto));
  } catch {
    return null;
  }
}

/** L'editor usa SEMPRE / per la frazione impilata e : per la divisione.
 * Anche i rapporti complessi (x+1)/(4-x), che normalizeKeyboardNotation
 * lascia con slash ASCII, vanno confrontati con la stessa precedenza di ⁄
 * usata dalla formula visualizzata: altrimenti 2·x/(4-x) viene verificato
 * come (2·x)/(4-x), non come 2·[x/(4-x)]. Il LaTeX e le parentesi originali
 * restano intatti; il confronto rimane strutturale, mai solo per valore. */
export function trascrizioneFedele(input: string, latex: string): boolean {
  const first = (input.split("=")[0] ?? "").trim();
  const notation = (first.includes("\\") ? first : normalizeKeyboardNotation(
    first.replace(/\{/g, "\uE000").replace(/\}/g, "\uE001"),
  ).replace(/\uE000/g, "{").replace(/\uE001/g, "}"))
    .replace(/\//g, "⁄");
  // L'editor visualizza «A⁄√(B)» come frazione impilata con la radice
  // INTERA al denominatore. Il parser strutturale, invece, non accetta una
  // radice subito dopo ⁄. Usiamo la stessa conversione puramente grafica
  // dell'anteprima, senza svolgere o cambiare la traccia, prima del confronto.
  // Limitiamo il ponte a questo caso: gli altri confronti restano invariati.
  const haRadiceAlDenominatore = /⁄\s*(?:⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?[√∛∜]/.test(notation);
  const sorgenteVisibile = haRadiceAlDenominatore ? stackedFractionsToLatex(notation) : notation;
  return sameSourceStructure(sorgenteVisibile, latex);
}

function polinomio(latex: unknown): Term[] | null {
  if (typeof latex !== "string" || !latex.trim()) return null;
  try {
    return parsePolyLoose(conPuntoDecimale(latex));
  } catch {
    return null;
  }
}

/* ─── (08/11, potenze grandi) Verifica ESATTA con interi grandi ─────────
 * I conti in sola aritmetica intera con risultati oltre i double (es.
 * (2^15·2^3)^4 = 2^72 = 4,7·10^21) non hanno alcun percorso esatto in
 * rationalPolyEquals/evalPoly, che lavorano sui number: la costruzione
 * dell'esercizio sulle potenze veniva boccata con «radicale numerico non
 * verificabile esattamente». Con BigInt il confronto è matematicamente
 * esatto. Restano fuori (null → percorsi di prima): decimali, radici,
 * lettere, esponenti negativi, risultati assurdi (protezione DoS). */

function chiudiGraffa(s: string, aperta: number): number | null {
  let depth = 0;
  for (let i = aperta; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return null;
}

/** Valore intero ESATTO di un'espressione aritmetica pura (potenze,
 *  prodotti, quozienti esatti, somme) in LaTeX o notazione da tastiera.
 *  null = non rappresentabile con interi (decimale, radice, lettera…). */
export function valoreBigint(latex: string): bigint | null {
  if (typeof latex !== "string" || !latex.trim() || latex.length > 4000) return null;
  let s = latex;
  // \frac{A}{B} (anche \dfrac/\tfrac) → (A)/(B), graffe bilanciate
  for (let g = 0; g < 40; g++) {
    const m = /\\[dt]?frac\s*\{/.exec(s);
    if (!m) break;
    const iNum = m.index + m[0].length - 1;
    const fNum = chiudiGraffa(s, iNum);
    if (fNum === null) return null;
    let j = fNum + 1;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] !== "{") return null;
    const fDen = chiudiGraffa(s, j);
    if (fDen === null) return null;
    s = s.slice(0, m.index) + "(" + s.slice(iNum + 1, fNum) + ")/(" + s.slice(j + 1, fDen) + ")" + s.slice(fDen + 1);
  }
  s = s
    .replace(/\\left|\\right|\\,|\\;|\\!|\\quad|\\qquad/g, "")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/·|×/g, "*")
    .replace(/÷|:/g, "/")
    .replace(/\u2212/g, "-")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/\s+/g, "");
  // lettere residue (radici, funzioni, variabili) o caratteri estranei → fuori
  if (/[a-zA-Z]/.test(s) || !/^[0-9+\-*/^()]+$/.test(s)) return null;
  let i = 0;
  const expr = (): bigint | null => {
    let v = term();
    if (v === null) return null;
    while (i < s.length && (s[i] === "+" || s[i] === "-")) {
      const op = s[i++];
      const r = term();
      if (r === null) return null;
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const term = (): bigint | null => {
    let v = pot();
    if (v === null) return null;
    while (i < s.length && (s[i] === "*" || s[i] === "/")) {
      const op = s[i++];
      const r = pot();
      if (r === null) return null;
      if (op === "*") v = v * r;
      else {
        if (r === BigInt(0) || v % r !== BigInt(0)) return null; /* quoziente non intero */
        v = v / r;
      }
    }
    return v;
  };
  const pot = (): bigint | null => {
    const b = unario();
    if (b === null) return null;
    if (i < s.length && s[i] === "^") {
      i++;
      const e = pot(); /* destra-associazione */
      if (e === null || e < BigInt(0) || e > BigInt(4096)) return null;
      if (b === BigInt(0) && e === BigInt(0)) return null;
      if (BigInt(b.toString(2).length) * e > BigInt(40000)) return null;
      let acc = BigInt(1);
      let base = b;
      let exp = e;
      while (exp > BigInt(0)) {
        if ((exp & BigInt(1)) === BigInt(1)) acc *= base;
        base *= base;
        exp >>= BigInt(1);
      }
      return acc;
    }
    return b;
  };
  const unario = (): bigint | null => {
    if (i < s.length && s[i] === "-") {
      i++;
      const v = unario();
      return v === null ? null : -v;
    }
    if (i < s.length && s[i] === "+") {
      i++;
      return unario();
    }
    return atomo();
  };
  const atomo = (): bigint | null => {
    if (i < s.length && s[i] === "(") {
      i++;
      const v = expr();
      if (v === null || s[i] !== ")") return null;
      i++;
      return v;
    }
    const m = /^[0-9]+/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return BigInt(m[0]);
  };
  const v = expr();
  return i === s.length ? v : null;
}

/** (26/10-test) esportata per i test dei percorsi di verifica. */
export { contoGiusto };

/* ─── (08/11) Radicali con LETTERE: sostituzione numerica multipla ────
 *  √((a²−1)/3):(3a+3) = √(3(a²−1))/(9(a+1)) non è verificabile né come
 *  razionale (ogni radice blocca rationalPolyEquals) né numericamente con
 *  la lettera libera. Sostituisco ogni lettera con campioni interi ben
 *  distanziati (2, 5, 11, 23, 47); se entrambe le parti restano definite
 *  e coincidono su almeno 3 campioni, le due forme sono la stessa funzione
 *  per ogni uso scolastico. Chi è «razionalmente diverso» è già stato
 *  bocciato prima; qui arriva solo ciò che il motore razionale non sa
 *  leggere (radicali), quindi nessun falso positivo nuovo su polinomi. */
const LETTERE_VERIFICA = ["a", "b", "x", "y", "z"] as const;
/* Tornate di campioni: valori DISTINTI per lettera e SEGNI MISTI. Con soli
 * campioni positivi √(x²) = x passerebbe, ma vale solo per x ≥ 0 (regola 11:
 * mai assumere le lettere positive); con x=−2 le due parti divergono e il
 * box viene bocciato. √(x⁴) = x² e ∛(x³) = x restano uguali ovunque. */
const TORNATE_VERIFICA: number[][] = [
  [-13, -7, -3],
  [-7, -3, -13],
  [-3, -13, -7],
  [-1, 3, 7],
  [0, 3, 7],
  [1, 3, 7],
  [2, 5, 11],
  [5, 11, 2],
  [11, 2, 5],
  /* (12/11, foto «ancora non funziona bene») tre tornate positive AGGIUNTIVE:
   * quando la radice o una potenza −1 creano un POLO in x=2 (es.
   * (∛(x³−6x²+12x−8))⁻¹ = 1/(x−2) con x=2), le tre tornate 2,5,11 restano
   * con solo 2 campioni validi (< 3) e il motore «non decide» — l'esercizio
   * veniva respinto 3 volte su 3 come «non verificabile». Con x=3,7,13 anche
   * un polo lascia ≥ 3 campioni. Più campioni = verifica più severa: nessun
   * falso positivo nuovo. */
  [3, 7, 13],
  [7, 13, 3],
  [13, 3, 7],
  [-2, 5, 11],
  [5, -2, 11],
  [-2, -5, 11],
];

/* Parole che NON sono prodotti di variabili: comandi LaTeX nella notazione
 * da tastiera (senza «\») e marcatori dell'app (per = periodico, rad = radice).
 * Nel LaTeX arrivano sempre preceduti da «\», ma la detection delle sequenze
 * attaccate non può fidarsi: se una sequenza intera è una di queste parole non
 * contiene variabili. */
const PAROLE_NON_VAR = new Set([
  "rad", "per", "sqrt", "root", "nthroot", "frac", "dfrac", "tfrac",
  "over", "cdot", "times", "div", "pi", "left", "right", "overline",
  "bar", "pow", "log", "ln", "exp", "sin", "cos", "tan", "mod", "abs",
]);

/** Lettere (delle sole ammesse) presenti come simboli liberi: «a» in "a^{2}"
 *  sì, la «a» di \dfrac no (è preceduta da una lettera di comando).
 *  (10/11) GIUSTAPPOSIZIONE: in «ab^{-1}» la «a» è seguita da «b» e la «b»
 *  preceduta da «a», quindi la regola del singolo carattere non vede né «a»
 *  né «b»: √(ab^{-1}) restava con lettere NON sostituite, il verificatore
 *  non sapeva valutarla e bocciava box corretti (A−A → 0) e il risultato
 *  finale («non verificabile con il motore disponibile») — la costruzione
 *  dell'esercizio falliva. Ora ogni sequenza di 2+ lettere minuscole fuori
 *  dai comandi LaTeX (non preceduta da «\») contribuisce tutte le sue
 *  lettere ammesse. */
export function lettereLibere(s: string): string[] {
  const trovate = new Set<string>();
  for (const l of LETTERE_VERIFICA) {
    if (new RegExp(`(^|[^a-zA-Z])${l}(?![a-zA-Z])`).test(s)) trovate.add(l);
  }
  for (const m of s.matchAll(/(?<![a-zA-Z\\])[a-z]{2,}/g)) {
    if (PAROLE_NON_VAR.has(m[0])) continue;
    for (const l of LETTERE_VERIFICA) {
      if (m[0].includes(l)) trovate.add(l);
    }
  }
  return [...trovate];
}

/** Sostituisce le lettere con un valore rendendo espliciti i prodotti
 *  impliciti (3a → 3·v, ab → v·v, a(b+1) → v·(b+1), x²y → v²·v) senza
 *  toccare i comandi LaTeX: la prima lettera di ogni parola di comando è
 *  sempre preceded da «\» e le interne da altre lettere, quindi i
 *  guardie (?<![a-zA-Z\\]) e (?![a-zA-Z]) le proteggono. */
export function sostituisciLettere(s: string, valori: Record<string, number>): string {
  let t = s
    .replace(/(?<![a-zA-Z\\])([a-z])(?=\()/g, "$1·")   // a( … → a·( …
    .replace(/(?<![a-zA-Z\\])([a-z])(?=[a-z])/g, "$1·") // ab → a·b
    .replace(/(?<![a-zA-Z\\])([a-z])(?=\d)/g, "$1·")   // x2 → x·2, non 12 quando x=1
    .replace(/\}(?=[a-z])/g, "}·")                      // x^{2}y → x^{2}·y
    .replace(/(\d)(?=[a-zA-Z])/g, "$1·");               // 3a → 3·a
  for (const [l, v] of Object.entries(valori)) {
    /* i valori negativi vanno PARENTESIZZATI: x^{2} con −2 deve diventare
       (−2)^{2} = 4, non −2^{2} = −4 (che annichilirebbe proprio i campioni
       negativi nati per bocciare √(x²) = x). */
    const stampato = v < 0 ? `(${v})` : String(v);
    t = t.replace(new RegExp(`(^|[^a-zA-Z])${l}(?![a-zA-Z])`, "g"), `$1${stampato}`);
  }
  return t;
}

/** null = «il motore non decide» (meno di 3 campioni validi o forme troppo
 *  lunghe); { ok:true } = coincide su tutti i campioni definiti; { ok:false }
 *  = almeno un campione definito dove le due parti DIPENDONO. */
export function verificaPerSostituzione(
  op: string,
  answer: string,
): { ok: boolean; via: string } | null {
  /* (10/11, box «√[3]{(a^-2b)/x} → √[3]{a^-2b x^-1}» della foto con indice
   *  negativo) in LaTeX matematico lo SPAZIO è privo di significato
   *  («b x^{-1}» è b·x^{-1}), ma il sostitutore non ci mette il · e le due
   *  parti venivano giudicate diverse. Strisciamo gli spazi PRIMA, MA non
   *  quelli che terminano un comando (\cdot x → \cdotx corrompe): la
   *  variabile-lookbehind di V8 lo consente. */
  const senzaSpaziInutili = (t: string) =>
    t.replace(/\\[a-zA-Z]+ ?|\s+/g, (m) => (m.startsWith("\\") ? m : ""));
  op = senzaSpaziInutili(op);
  answer = senzaSpaziInutili(answer);
  const lettere = [...new Set([...lettereLibere(op), ...lettereLibere(answer)])];
  if (lettere.length === 0 || lettere.length > 3) return null;
  if (op.length > 400 || answer.length > 400) return null;
  // Non si assume il segno delle lettere: |x-a| non è sempre x-a.
  // I campioni non reali o non definiti sono esclusi qui sotto.
  const tornate = [...TORNATE_VERIFICA, ...tornateAdattive(op, answer, lettere.length)];
  let validi = 0;
  for (const tornata of tornate) {
    const valori: Record<string, number> = {};
    lettere.forEach((l, j) => {
      valori[l] = tornata[j % tornata.length];
    });
    let vo: number | null = null;
    let va: number | null = null;
    try {
      vo = valore(sostituisciLettere(op, valori));
      va = valore(sostituisciLettere(answer, valori));
    } catch {
      continue;
    }
    // Se la traccia è definita ma la risposta no, la risposta perde parte
    // del dominio e non può rappresentare un passaggio equivalente.
    if (vo !== null && Number.isFinite(vo) && (va === null || !Number.isFinite(va))) {
      return { ok: false, via: `sostituzione: la risposta non è definita con ${lettere.map((l, j) => `${l}=${tornata[j % tornata.length]}`).join(", ")}` };
    }
    if (vo === null || va === null || !Number.isFinite(vo) || !Number.isFinite(va)) continue;
    validi++;
    const scarto = Math.abs(vo - va);
    if (scarto > 1e-9 * Math.max(1, Math.abs(vo), Math.abs(va))) {
      return {
        ok: false,
        via: `sostituzione: con ${lettere.map((l, j) => `${l}=${tornata[j % tornata.length]}`).join(", ")} le due parti differiscono`,
      };
    }
  }
  if (validi >= 3) {
    return { ok: true, via: `sostituzione numerica multipla (${lettere.join(", ")})` };
  }
  return null;
}

/** Il confronto razionale esatto ha precedenza anche sui numeri: coincidere
 *  quando x=2 NON dimostra l'uguaglianza di due espressioni. Per radici
 *  numeriche usiamo la valutazione completa; per monomi con radici solo le
 *  semplificazioni sicure sul dominio reale. Negli altri casi non si indovina. */
function contoGiusto(inputOp: unknown, inputAnswer: unknown): { ok: boolean; via: string } {
  if (typeof inputOp !== "string" || typeof inputAnswer !== "string" || !inputOp.trim() || !inputAnswer.trim() || inputOp.includes("=") || inputAnswer.includes("=")) {
    return { ok: false, via: "espressione incompleta o non verificabile" };
  }
  let op: string = inputOp;
  let answer: string = inputAnswer;
  /* (12/11, foto utente) GRAFFE SBILANCIATE: l'IA a volte chiude male il
   * LaTeX del risultato finale («(x+1)^{2» senza l'ultima graffa). Aggiungo
   * in coda le graffe mancanti (max 3): la verifica numerica decide poi se
   * l'espressione è davvero quella giusta — nessun falso positivo. */
  const bilancia = (s: string) => {
    const aperte = (s.match(/\{/g) ?? []).length;
    const chiuse = (s.match(/\}/g) ?? []).length;
    return aperte > chiuse && aperte - chiuse <= 3 ? s + "}".repeat(aperte - chiuse) : s;
  };
  op = bilancia(op);
  answer = bilancia(answer);
  /* (12/11, foto utente) GIUSTAPPOSIZIONE dopo una graffa: \dfrac{a}{b}\left(...\right)
   * e \dfrac{a}{b}(x+1)^{2} senza \cdot sono legittimi in LaTeX, ma il
   * percorso di verifica numerica dei radicali non li scompone e il box
   * finiva «non verificabile». Inserisco \cdot (davanti a \left, a una
   * parentesi, a una cifra o a una lettera — MAI prima di «{», che è il
   * confine interno di \dfrac): non cambia mai il significato di un
   * prodotto giustapposto. */
  /* (12/11, collaudo n.8) il lookbehind esclude la graffa della VIRGOLA
   * DECIMALE (0{,}2): senza di essa «0{,}2» diventava «0{,}\cdot 2» e
   * ogni somma con frazioni e decimali risultava «non verificabile». */
  const conPunto = (s: string) => s.replace(/(?<!\{,)\}(?=\s*(?:\\left|[(\da-z]))/g, "}\\cdot ");
  op = conPunto(op);
  answer = conPunto(answer);
  /* (12/11, foto utente) RADICI CON INDICE NEGATIVO: riscritte come reciproco
   * con indice positivo prima di ogni via di verifica, così √[−2]{1/90} e
   * forme equivalenti diventano verificabili ESATTAMENTE (e il confronto di
   * due radici negative identiche non arriva più a kthExtract con k negativo,
   * che bloccava il server in un loop infinito). */
  op = radicaleIndiceNegativoAPositivo(op);
  answer = radicaleIndiceNegativoAPositivo(answer);
  const exact = rationalPolyEquals(op, answer);
  if (exact !== null) {
    return exact
      ? { ok: true, via: "razionale esatto" }
      : { ok: false, via: "razionale: espressioni diverse o denominatore nullo" };
  }
  const numeric = exactNumericEquality(op, answer);
  if (numeric !== null) {
    return numeric
      ? { ok: true, via: "numerico esatto" }
      : { ok: false, via: "numerico: il risultato non coincide esattamente con l'operazione" };
  }
  // (08/11, potenze grandi) aritmetica intera pura oltre i double: 2^{72} ecc.
  const bigOp = valoreBigint(op);
  const bigAn = valoreBigint(answer);
  if (bigOp !== null && bigAn !== null) {
    return bigOp === bigAn
      ? { ok: true, via: "intero esatto (bigint)" }
      : { ok: false, via: "intero: il risultato non coincide con l'operazione" };
  }
  // (08/11, radicali con lettere) √((a²−1)/3):(3a+3) = √(3(a²−1))/(9(a+1)):
  // né razionale (ogni radice blocca rationalPolyEquals) né valutabile con la
  // lettera libera. Sostituzione numerica MULTIPLA: se entrambe le parti
  // restano definite e coincidono su almeno 3 campioni interi distanziati,
  // sono la stessa funzione per ogni uso scolastico (e rationalPolyEquals
  // false sarebbe già uscito prima: qui arriva solo chi è «non razionale»).
  // I radicali troppo complessi per una prova esatta non vengono accettati
  // solo perché due decimali approssimati sembrano coincidere.
  if (valore(op) !== null && valore(answer) !== null) {
    return { ok: false, via: "radicale numerico non verificabile esattamente" };
  }
  const sost = verificaPerSostituzione(op, answer);
  // La prova formale non basta se l'espressione non ha valori reali
  // definiti (es. √[−4]{−16}): richiediamo anche punti validi e
  // controlliamo prima che la risposta non perda dominio nei campioni.
  if (sost?.ok && uguaglianzaRazionaleConAtomi(op, answer) === true) {
    return { ok: true, via: "razionale esatto con atomi simbolici" };
  }
  if (sost !== null) return sost;
  const pb = polinomio(op), pa = polinomio(answer);
  if (pb !== null && pa !== null) {
    return polyEquals(pb, pa)
      ? { ok: true, via: "simbolico" }
      : { ok: false, via: "simbolico: le forme non coincidono" };
  }
  return { ok: false, via: "non verificabile con il motore disponibile" };
}

/* ─── Verifica: conti ESATTI (durissimi) + struttura (avvertenze) ───── */

interface EsitoVerifica {
  esercizio: EsercizioAI | null;
  problemi: string[];
  avvertenze: string[];
}

function pulisci(latex: string): string {
  return latex.replace(/\\left|\\right/g, "").replace(/\s+/g, "");
}

/* ─── (11/11) RAZIONALIZZAZIONE GUIDATA ──────────────────────────────
 * Se il RISULTATO FINALE lascia una frazione con la sola radice QUADRATA
 * al denominatore, la pipeline prova ad aggiungere un box guidato verificato
 * nei percorsi IA, deterministici e nelle riletture di archivi e cache:
 *  - SEMPLIFICAZIONE se il numeratore contiene già la radice:
 *    (ab+1)/√(ab+1) → √(ab+1);  2a·√B/√B → 2a;
 *  - RAZIONALIZZAZIONE negli altri casi: 1/√3 → √3/3, 2/√3 → 2√3/3,
 *    (a+b)/√(ab) → (a+b)√(ab)/(ab).
 * Il prompt dice SOLO il metodo, mai il risultato (risposta dallo studente).
 * Ogni passaggio è controllato con contoGiusto (verifica numerica esatta o,
 * per alcuni casi letterali, sostituzioni multiple). Se il motore non può
 * verificarlo, non si aggiunge. L'ambito automatico è un denominatore formato
 * dalla sola radice quadrata; altri denominatori restano al percorso usuale. */

interface FrazioneConRadice {
  inizio: number;
  fine: number;
  numeratore: string;
  radicando: string;
}

/** Solo parentesi che racchiudono TUTTO il contenuto sono rimovibili.
 * Il motore può aggiungere \left(…\right) intorno a numeratore, denominatore
 * e radicando: non devono impedire di riconoscere la frazione. */
function senzaParentesiEsterne(latex: string): string {
  let s = pulisci(latex);
  while (s.startsWith("(") && s.endsWith(")")) {
    let profondita = 0;
    let racchiudeTutto = true;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") profondita++;
      if (s[i] === ")") profondita--;
      if (profondita === 0 && i < s.length - 1) { racchiudeTutto = false; break; }
      if (profondita < 0) { racchiudeTutto = false; break; }
    }
    if (!racchiudeTutto || profondita !== 0) break;
    s = s.slice(1, -1);
  }
  return s;
}

/* Spezza un prodotto sui \cdot di primo livello: parentesi e graffe degli
 * esponenti/argomenti proteggono i \cdot interni. Null se le graffe sono
 * sbilanciate (stringa da non toccare). */
function spezzaProdotto(s: string): string[] | null {
  const pezzi: string[] = [];
  let profondita = 0;
  let corrente = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "{") { profondita++; corrente += c; continue; }
    if (c === ")" || c === "}") { profondita--; if (profondita < 0) return null; corrente += c; continue; }
    if (profondita === 0 && s.startsWith("\\cdot", i)) {
      pezzi.push(corrente.trim());
      corrente = "";
      i += "\\cdot".length - 1;
      continue;
    }
    corrente += c;
  }
  if (profondita !== 0) return null;
  pezzi.push(corrente.trim());
  return pezzi.filter((p) => p.length > 0);
}

function trovaFrazioneConRadiceQuadrata(riga: string): FrazioneConRadice | null {
  const re = /\\(?:d|t)?frac\s*\{/g;
  for (let m = re.exec(riga); m !== null; m = re.exec(riga)) {
    const numInizio = m.index + m[0].length - 1;
    const numFine = chiudiGraffa(riga, numInizio);
    if (numFine === null) continue;
    let j = numFine + 1;
    while (j < riga.length && /\s/.test(riga[j])) j++;
    if (riga[j] !== "{") continue;
    const denFine = chiudiGraffa(riga, j);
    if (denFine === null) continue;
    // Solo una radice quadrata come intero denominatore. Non cambiare
    // radici di indice diverso, somme o altre strutture non verificate.
    const den = senzaParentesiEsterne(riga.slice(j + 1, denFine));
    const dentro = /^\\sqrt\{/.exec(den);
    if (dentro) {
      const radInizio = dentro[0].length - 1;
      const radFine = chiudiGraffa(den, radInizio);
      if (radFine === den.length - 1) {
        return {
          inizio: m.index,
          fine: denFine + 1,
          numeratore: senzaParentesiEsterne(riga.slice(numInizio + 1, numFine)),
          radicando: senzaParentesiEsterne(den.slice(radInizio + 1, radFine)),
        };
      }
    }
    // Continuo anche nelle frazioni annidate, senza saltare il numeratore.
  }
  return null;
}

function sostitutoFrazioneConRadice(
  riga: string,
  o: FrazioneConRadice,
): { latex: string; prompt: string } | null {
  const numeratore = o.numeratore;
  const radicando = o.radicando;
  const radToken = `\\sqrt{${radicando}}`;
  const pulNum = pulisci(numeratore);
  const pulRad = pulisci(radicando);
  /* 1) il numeratore È il radicando: (ab+1)/√(ab+1) → √(ab+1) — anche
   * quando resta racchiuso in parentesi: (ab+1) non è diverso da ab+1. */
  if (senzaParentesiEsterne(pulNum) === pulRad) {
    return { latex: radToken, prompt: "Divido numeratore e denominatore per la stessa radice." };
  }
  /* 2) (12/11, GARANZIA DEL BOX DI SEMPLIFICAZIONE) il numeratore contiene
   * la radice come fattore IN QUALSIASI POSIZIONE di un prodotto: 2a·√B/√B → 2a
   * ma anche √B·2a/√B → 2a e (2a·√B)/√B → 2a. Prima la radice veniva
   * riconosciuta solo come ULTIMO fattore e il box extra non era garantito
   * in ogni costruzione. Dividere per √B toglie ESATTAMENTE un fattore √B
   * (es. √B·√B/√B → √B): ogni risposta è comunque riverificata col motore. */
  const numeroSenza = senzaParentesiEsterne(pulNum);
  const segnoNum = numeroSenza.startsWith("-") ? "-" : "";
  const corpo = segnoNum ? numeroSenza.slice(1) : numeroSenza;
  /* La radice del denominatore può comparire anche con il radicando tra
   * parentesi (√(ab+1) contro √(ab+1)): ammetto entrambe le forme. */
  const variantiRadice = [radToken, `\\sqrt{(${pulRad})}`];
  /* La radice del denominatore può comparire anche con il radicando tra
   * parentesi (√(ab+1) contro √(ab+1)): ammetto entrambe le forme e nella
   * risposta la riscrivo sempre nella forma canonica della traccia. */
  const formaCanonica = (pezzo: string): string =>
    pezzo === variantiRadice[1] ? radToken : senzaParentesiEsterne(pezzo);
  const candidati: string[] = [];
  /* 2a) prodotto esplicito con ·: la radice può stare anche in mezzo */
  const pezzi = spezzaProdotto(corpo);
  if (pezzi && pezzi.length > 1) {
    const indiceRadice = pezzi.findIndex((p) => variantiRadice.includes(senzaParentesiEsterne(p)));
    if (indiceRadice >= 0) {
      const resto = pezzi.filter((_, i) => i !== indiceRadice);
      candidati.push(resto.length === 0
        ? "1"
        : resto.length === 1
          ? formaCanonica(resto[0])
          : resto.map((p) => formaCanonica(p)).join("\\cdot"));
    }
  }
  /* 2b) giustapposizione senza ·, radice al-INIZIO o alla-FINE del numeratore
   * (printLatex scrive 2a·√(ab+1) come 2a\sqrt{(ab+1)}) */
  for (const rad of variantiRadice) {
    if (corpo === rad) { candidati.push("1"); break; }
    if (corpo.startsWith(rad)) { candidati.push(corpo.slice(rad.length).replace(/^\\cdot/, "")); break; }
    if (corpo.endsWith(rad)) { candidati.push(corpo.slice(0, corpo.length - rad.length).replace(/\\cdot$/, "")); break; }
  }
  for (const c of candidati) {
    if (!c || /^[+\-:*/]/.test(c)) continue;
    /* Se il resto è un prodotto puramente polinomiale (2a·3), lo si presenta
     * già svolto (6a): è la forma didattica attesa dal box. */
    const poly = c.includes("\\sqrt") ? null : parsePolyLoose(c);
    const ridotto = poly?.length ? polyToLatex(poly) : null;
    for (const valore of ridotto ? [`${segnoNum}${ridotto}`, `${segnoNum}${c}`] : [`${segnoNum}${c}`]) {
      if (contoGiusto(`\\dfrac{${numeratore}}{${radToken}}`, valore).ok) {
        return { latex: valore, prompt: "Divido numeratore e denominatore per la stessa radice." };
      }
    }
  }
  /* 3) razionalizzazione: 1/√3 → √3/3, 2/√3 → 2√3/3, (a+b)/√(ab) → (a+b)√(ab)/(ab) */
  const numCompatto = numeratore.replace(/\s+/g, "");
  // Raggruppa SEMPRE numeratori composti: iniziare con una radice o una
  // parentesi non garantisce che tutto il numeratore sia un solo fattore.
  const semplice = /^-?\d+$/.test(pulNum) || /^-?[a-z]+$/.test(pulNum);
  let fattore: string;
  if (pulNum === "1") fattore = radToken;
  else if (pulNum === "-1") fattore = `-${radToken}`;
  else if (semplice) fattore = `${numCompatto}${radToken}`;
  else fattore = `\\left(${numCompatto}\\right)${radToken}`;
  return {
    latex: `\\dfrac{${fattore}}{${radicando}}`,
    prompt: "Moltiplico numeratore e denominatore per la stessa radice.",
  };
}

function aggiungiBoxRadiceAlDenominatore(
  righe: string[],
  sezioni: SezioneAI[],
  avvertenze: string[],
  risultatoFinale: string,
): string {
  // La trasformazione elimina una frazione con denominatore radicale per
  // volta; il limite protegge soltanto da input patologici.
  for (let giro = 0; giro < 64; giro++) {
    const riga = righe[righe.length - 1];
    const o = trovaFrazioneConRadiceQuadrata(riga);
    if (!o) return risultatoFinale;
    const s = sostitutoFrazioneConRadice(riga, o);
    if (!s) return risultatoFinale;
    const nuova = riga.slice(0, o.inizio) + s.latex + riga.slice(o.fine);
    const esito = contoGiusto(riga, nuova);
    if (!esito.ok) {
      avvertenze.push("box radice al denominatore non aggiunto: conto non verificabile dal motore");
      return risultatoFinale;
    }
    const ultimaSezione = sezioni[sezioni.length - 1];
    if (!ultimaSezione) return risultatoFinale;
    const nuovoBox: BoxAI = {
      op: riga,
      answerLatex: nuova,
      prompt: s.prompt,
      simbolico: true,
      criterioDidattico: "radicale_trasformato",
    };
    const ultimoBox = ultimaSezione.boxes[ultimaSezione.boxes.length - 1];
    // Non lasciare un precedente box fittizio «lascio così» subito prima
    // della trasformazione: se riguarda l'intera riga e non cambia nulla,
    // lo sostituiamo con il vero passo guidato.
    const ultimoInutile = ultimoBox && righe.length > 1 &&
      sameResultStructure(ultimoBox.op, ultimoBox.answerLatex) &&
      sameResultStructure(ultimoBox.op, riga) &&
      sameResultStructure(righe[righe.length - 2], riga);
    if (ultimoInutile) {
      ultimoBox.op = nuovoBox.op;
      ultimoBox.answerLatex = nuovoBox.answerLatex;
      ultimoBox.prompt = nuovoBox.prompt;
      ultimoBox.simbolico = nuovoBox.simbolico;
      delete ultimoBox.extraLatex;
      ultimoBox.criterioDidattico = nuovoBox.criterioDidattico;
      righe[righe.length - 1] = nuova;
    } else {
      ultimaSezione.boxes.push(nuovoBox);
      righe.push(nuova);
    }
    avvertenze.push("aggiunto box guidato: radice al denominatore semplificata o razionalizzata");
    risultatoFinale = nuova;
  }
  return risultatoFinale;
}

function verifica(raw: unknown): EsitoVerifica {
  const problemi: string[] = [];
  const avvertenze: string[] = [];
  const e = raw as Partial<EsercizioAI> | null;
  if (!e || typeof e !== "object") {
    return { esercizio: null, problemi: ["la risposta non è un oggetto JSON"], avvertenze };
  }
  if (typeof e.espressioneLatex !== "string" || !e.espressioneLatex.trim()) {
    problemi.push("manca espressioneLatex");
  }
  if (!Array.isArray(e.sezioni) || e.sezioni.length === 0) {
    problemi.push("manca l'elenco delle sezioni");
  }
  if (!Array.isArray(e.righeProgressive) || e.righeProgressive.length === 0) {
    problemi.push("mancano le righeProgressive");
  }
  if (typeof e.risultatoFinaleLatex !== "string" || !e.risultatoFinaleLatex.trim()) {
    problemi.push("manca risultatoFinaleLatex");
  }
  if (problemi.length > 0) return { esercizio: null, problemi, avvertenze };

  /* (26/10, app UNIVERSALE): l'espressione può contenere LETTERE (i valori
     numerici puri non bastano più). La «forma di verità» è la catena di
     verifiche: numerico → simbolico → sostituzione. */
  const v0 = valore(e.espressioneLatex);
  const p0 = polinomio(e.espressioneLatex);
  /* (26/10-fix3, foto utente «4ab·(2ab)^-1 non si costruisce»): un'espressione
     con lettere può RIDURSI a un numero puro (4ab·(2ab)^{-1} = 2): il
     polinomio ridotto non ha più variabili e il vecchio haLettere concludeva
     a torto «non è valutabile». Le lettere si cercano nel TESTO dell'input,
     escludendo i comandi LaTeX (\dfrac, \cdot, \left, \right, \sqrt…). */
  const senzaComandi = e.espressioneLatex!.replace(/\\[a-zA-Z]+/g, "");
  const haLettere =
    (p0 != null && p0.some((t) => t.vars.length > 0)) ||
    /[a-z]/i.test(senzaComandi);
  if (v0 == null && !haLettere) {
    problemi.push("espressioneLatex non è valutabile (né come numero né come espressione con lettere)");
  }

  /* ogni box: op e answerLatex COINCIDENTI (contoGiusto: numerico,
     simbolico o sostituzione). I box con lettere ereditano simbolico. */
  const boxes = e.sezioni!.flatMap((s) => (Array.isArray(s?.boxes) ? s.boxes : []));
  if (boxes.length === 0) problemi.push("nessun box nelle sezioni");
  boxes.forEach((b, i) => {
    /* (10/11) \text{Numeratore} non è un'espressione: l'IA a volte usa
       l'etichetta al posto della riga intera e il box resta non verificabile. */
    if (/\\text\s*\{/.test(String(b?.op ?? "")) || /\\text\s*\{/.test(String(b?.answerLatex ?? ""))) {
      problemi.push(`box ${i + 1}: op e answerLatex devono essere espressioni matematiche complete, vietato \\text{...}`);
    }
    const esito = contoGiusto(b?.op, b?.answerLatex);
    if (!esito.ok) problemi.push(`box ${i + 1}: ${esito.via}`);
    if (typeof b?.prompt !== "string" || !b.prompt.trim()) {
      problemi.push(`box ${i + 1}: manca la frase didattica (prompt)`);
    }
    /* coerenza del flag: lettere nell'op → simbolico deve essere true */
    const pb = typeof b?.op === "string" ? polinomio(b.op) : null;
    const opHaLettere = !!pb && pb.some((t) => t.vars.length > 0);
    if (opHaLettere && b && typeof b === "object") (b as { simbolico?: boolean }).simbolico = true;
  });

  /* righe progressive: TUTTE con la stessa FORMA dell'espressione (numericamente
     identiche se senza lettere, simbolicamente identiche se con lettere) */
  const righe = e.righeProgressive!;
  if (righe.length !== boxes.length + 1) {
    problemi.push(`le righe progressive devono essere ${boxes.length + 1} (una per box + l'espressione intera), ma sono ${righe.length}`);
  }
  righe.forEach((r, i) => {
    if (typeof r !== "string" || !r.trim()) {
      problemi.push(`riga progressiva ${i + 1}: riga vuota`);
      return;
    }
    const esito = contoGiusto(e.espressioneLatex, r);
    if (!esito.ok) {
      problemi.push(`riga progressiva ${i + 1}: non conserva la forma dell'espressione (${esito.via})`);
    }
  });

  /* il risultato finale coincide con l'espressione (numerico o simbolico) */
  const esitoF = contoGiusto(e.espressioneLatex, e.risultatoFinaleLatex);
  if (!esitoF.ok) {
    problemi.push(`risultatoFinaleLatex non coincide con l'espressione (${esitoF.via})`);
  }

  /* struttura (cosmetica): ogni op compare nella riga precedente e ogni
     answerLatex nella riga successiva — sono AVVERTENZE, non blocchi */
  boxes.forEach((b, i) => {
    const opN = pulisci(b?.op ?? "");
    const anN = pulisci(b?.answerLatex ?? "");
    if (opN && righe[i] && !pulisci(righe[i]).includes(opN)) {
      avvertenze.push(`l'operazione del box ${i + 1} non compare testualmente nella riga ${i + 1}`);
    }
    if (anN && righe[i + 1] && !pulisci(righe[i + 1]).includes(anN)) {
      avvertenze.push(`il risultato del box ${i + 1} non compare testualmente nella riga ${i + 2}`);
    }
  });

  if (problemi.length > 0) return { esercizio: null, problemi, avvertenze };

  const esercizio: EsercizioAI = {
    espressioneLatex: e.espressioneLatex!,
    sezioni: e.sezioni!.map((s) => ({
      title: String(s.title ?? "ESERCIZIO"),
      boxes: s.boxes.map((b) => ({
        op: String(b.op),
        prompt: b.prompt ? String(b.prompt) : undefined,
        extraLatex: b.extraLatex ? String(b.extraLatex) : undefined,
        answerLatex: String(b.answerLatex),
        simbolico: (b as { simbolico?: unknown }).simbolico === true ? true : undefined,
        criterioDidattico: criterioAmmesso((b as { criterioDidattico?: unknown }).criterioDidattico),
      })),
    })),
    righeProgressive: righe.map((r) => String(r)),
    risultatoFinaleLatex: e.risultatoFinaleLatex!,
  };
  return { esercizio, problemi, avvertenze };
}

/* ─── OPZIONE A (26/10): l'IA propone la STRUTTURA, il motore rifà i CONTI ─
 * La vecchia verifica bocciava l'esercizio INTERO quando anche un solo
 * conto non tornava (max 3 tentativi, spesso tutti falliti): la pagina 3
 * non si apriva. Nuova filosofia: la pagina 3 si apre SEMPRE. Se il conto
 * di un box non torna (o manca), il motore locale calcola il risultato
 * GIUSTO dalla STESSA operazione: numeri → frazione impilata, lettere →
 * polinomio (termToLatex impila sempre le frazioni, mai decimali). */

/** Risultato di un'operazione CALCOLATO DAL MOTORE (non dall'IA).
 *  Null solo se il motore non sa valutarla (radici non semplificabili…). */
/* (12/11, foto utente) FRAZIONE GENERATRICE dei numeri decimali periodici:
 * il box «0,0\overline{1} → 1/90» arrivava sbagliato dall'IA (1/99) e il
 * motore non poteva ripararlo perché non sapeva calcolare la generatrice.
 * Formula generale con parte intera n, cifre non periodiche a (m cifre) e
 * periodo d (k cifre): x = n + (a·10^k + d − a) / ((10^k − 1)·10^m), poi
 * riduzione con il MCD. null = non è un periodico (o cifre troppe). */
function frazioneGeneratrice(latex: string): string | null {
  const m = /^(\d*),(\d*)\\overline\s*\{(\d+)\}$/.exec(latex.trim());
  if (!m) return null;
  const intero = m[1] === "" ? 0 : parseInt(m[1], 10);
  const anteposte = m[2];
  const periodo = m[3];
  if (periodo === "0" || anteposte.length > 6 || periodo.length > 6) return null;
  const k = periodo.length;
  const mm = anteposte.length;
  const dieciK = 10 ** k;
  const dieciM = 10 ** mm;
  const a = anteposte === "" ? 0 : parseInt(anteposte, 10);
  const d = parseInt(periodo, 10);
  const den = (dieciK - 1) * dieciM;
  const num = intero * den + (a * dieciK + d - a);
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || num <= 0 || den <= 0) return null;
  const mcd = (x: number, y: number): number => (y === 0 ? x : mcd(y, x % y));
  const g = mcd(num, den);
  const p = num / g;
  const q = den / g;
  if (q === 1) return String(p);
  return `\\dfrac{${p}}{${q}}`;
}

/** Informazioni esatte riservate al generatore; nessuna risposta viene
 * mostrata in anticipo allo studente. I periodi si prendono solo dalla
 * trascrizione confermata e la frazione è calcolata dal motore. */
export function indicazioniPeriodiciDaSorgente(espressione: string): string[] {
  const input = canonicalizePeriodicNotation(espressione.replace(/(\d)\.(?=\d)/g, "$1,"));
  const trovati = new Set<string>();
  const note: string[] = [];
  for (const m of input.matchAll(/\d+,\d*\\overline\s*\{\d+\}/g)) {
    const numero = m[0];
    if (trovati.has(numero)) continue;
    trovati.add(numero);
    const esatta = frazioneGeneratrice(numero);
    if (!esatta || !contoGiusto(numero, esatta).ok) continue;
    note.push(`${numero}: la frazione generatrice ESATTA è ${esatta}; conserva tutte le cifre e l'estensione originale della barretta.`);
    if (note.length >= 12) break;
  }
  return note;
}

function risultatoMotore(opLatex: string): string | null {
  /* (12/11, foto utente) i numeri periodici hanno la generatrice ESATTA
   * calcolata dal motore: il box sbagliato dall'IA viene riparato. */
  try {
    const gen = frazioneGeneratrice(opLatex);
    if (gen != null) return gen;
  } catch {
    /* si prosegue con gli altri percorsi */
  }
  /* (12/11, foto utente) le radici con indice negativo arrivano al motore
   * dei radicali già riscritte come reciproco (radicaleIndiceNegativoAPositivo
   * è applicata dentro risultatoRadicaleLatex). */
  try {
    const r = evalRat(parseExpression(normalizeInput(opLatex)));
    const num = polyToLatex(r.num);
    /* (26/10-Opzione A) denominatore COSTANTE: evalRat lo svuota (den = []),
       che sta per «1» — NON «0» (polyToLatex([]) = "0" è solo la stampa) */
    const den = r.den.length ? polyToLatex(r.den) : "1";
    if (!num || !den) return null;
    if (den === "1") return num; /* i coefficienti frazionari escono già impilati da termToLatex */
    /* denominatore simbolico (es. (2ab)^{-1} → 1/(2ab)): frazione impilata,
       con parentesi solo se il blocco è una somma algebrica */
    const w = (s: string) => (/[+\-]/.test(s) ? `(${s})` : s);
    return `\\dfrac{${w(num)}}{${w(den)}}`;
  } catch {
    /* non valutabile come fratta: si prova il polinomio */
  }
  /* (08/11, radicali) valutazione ESATTA nel corpo c·√d (proprietà dei
     radicali: √18 = 3√2, (√6)² = 6, radicali simili sommati). Il vecchio
     percorso bocciava qualunque radice non perfetta e la costruzione
     delle espressioni con radicali falliva sempre (foto utente). */
  try {
    const rad = risultatoRadicaleLatex(opLatex);
    if (rad != null) return rad;
  } catch {
    /* si prova il polinomio */
  }
  try {
    const p = parsePolyLoose(opLatex);
    if (!p) return null;
    return fractionResultLatex(p) ?? polyToLatex(p);
  } catch {
    return null;
  }
}

/* (10/11-fix) Ripristina nell'op i decimali che i box PRECEDENTI hanno già
 * convertito in frazione: l'IA a volte riscrive «0,75» in un box che segue la
 * conversione «0,75 → \dfrac{3}{4}», e il collegamento alla riga fallisce
 * anche se il conto è giusto. Solo forma, nessun conto nuovo. */
function decimaliGiaConvertiti(op: string, precedenti: { op: string; answerLatex: string }[]): string {
  let out = op;
  for (const p of precedenti) {
    const decimale = /^[0-9]+(?:,[0-9]*)?(?:\\overline\s*\{[0-9]+\})?$/.test(p.op.trim());
    const frazione = /^\\dfrac\{[0-9]+\}\{[0-9]+\}$/.test(p.answerLatex.trim());
    if (!decimale || !frazione) continue;
    const cercata = p.op.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(cercata, "g"), p.answerLatex.trim());
  }
  return out;
}

/* ─── (12/11, richiesta utente) CONDIZIONI DI ESISTENZA (C.E.) ────────── *
 * Ogni espressione fratta (lettere al denominatore) comincia dal calcolo
 * dei VALORI VIETATI dei SUOI denominatori originali: un box per valore,
 * risposta in formato calcolatrice ("-1", "1/2"). Le radici sono ESATTE:
 * grado 1, grado 2 con discriminante quadrato perfetto, fattore x^k.
 * Se l'elenco completo non è garantito (grado > 2, radici irrazionali,
 * esponenti negativi, più lettere in un polinomio composto) il denominatore
 * NON produce box: una C.E. incompleta sarebbe matematicamente sbagliata. */

interface Vietato { lettera: string; valore: string }

function frazCalcolatrice(f: Frac): string {
  return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;
}

/** «-3/2» → «-\dfrac{3}{2}»: LaTeX impilato per la riga risolta e il PDF. */
function frazLatexDaCalcolatrice(s: string): string {
  const m = /^(-?)(\d+)\/(\d+)$/.exec(s);
  if (!m) return s;
  return `${m[1] ? "-" : ""}\\dfrac{${m[2]}}{${m[3]}}`;
}

function quadratoPerfetto(n: number): number | null {
  if (n < 0) return null;
  const r = Math.round(Math.sqrt(n));
  return r * r === n ? r : null;
}

/** Valori vietati (radici reali esatte) di un polinomio a coefficienti
 *  razionali. null = il motore non garantisce l'elenco completo. */
/* (12/11, foto «ancora non funziona bene») RADICI ESATTE di grado qualsiasi:
 * il vecchio motore C.E. si fermava a grado 2 («l'elenco completo non è
 * garantito») e perdeva valori vietati come x ≠ 2 per il denominatore
 * (x−2)³ = x³−6x²+12x−8. Con il teorema delle radici razionali + deflazione
 * sintetica ESATTA (Frac) smonto il polinomio finché scende a grado ≤ 2;
 * se a un passo non ci sono radici razionali (es. x³−2) l'elenco completo
 * non è garantito → null: MAI una C.E. incompleta. */
function gcdCe(a: number, b: number): number {
  let x = Math.abs(a), y = Math.abs(b);
  while (y) { [x, y] = [y, x % y]; }
  return x || 1;
}
function divisoriCe(n: number): number[] {
  const m = Math.abs(n);
  const out: number[] = [];
  for (let d = 1; d * d <= m; d++) {
    if (m % d === 0) { out.push(d); if (d !== m / d) out.push(m / d); }
  }
  return out;
}
function valutaGradiCe(gradi: Map<number, Frac>, x: Frac): Frac {
  /* (12/11, test generativo) Horner richiede TUTTI i coefficienti da grado a 0,
   * anche quelli mancanti (= 0): iterando solo sulle chiavi presenti,
   * x⁴+6x³−54x−81 (senza termine x²) veniva valutato come ((1·x+6)·x−54)·x−81
   * e la radice 3 NON veniva trovata → C.E. null per polinomi con gradi vuoti. */
  const grado = Math.max(...gradi.keys());
  let acc = fr(0);
  for (let g = grado; g >= 0; g--) acc = fAdd(fMul(acc, x), gradi.get(g) ?? fr(0));
  return acc;
}
function sgonfiaGradiCe(gradi: Map<number, Frac>, r: Frac): Map<number, Frac> | null {
  const grado = Math.max(...gradi.keys());
  const coeff: Frac[] = [];
  for (let g = grado; g >= 0; g--) coeff.push(gradi.get(g) ?? fr(0));
  const nuovo: Frac[] = [coeff[0]!];
  for (let i = 1; i <= grado; i++) {
    nuovo.push(fAdd(coeff[i]!, fMul(nuovo[i - 1]!, r)));
  }
  if (nuovo[grado]!.n !== 0) return null; // resto ≠ 0: non è radice
  const out = new Map<number, Frac>();
  /* nuovo[0] è il coefficiente DI GRADO MASSIMO del quoziente (Ruffini parte
   * dal coefficiente direttore): il quoziente di grado grado−1 ha il
   * coefficiente di grado (grado−1−g) in posizione g. L'ordine inverso
   * trasformava (x−2)³ in 4x²−4x+1 → falso vietato x ≠ 1/2. */
  for (let g = 0; g <= grado - 1; g++) out.set(grado - 1 - g, nuovo[g]!);
  return out;
}
const GRADO_CE_MAX = 9;
function radiciEsatteDiGradi(gradi: Map<number, Frac>): Frac[] | null {
  const grado = Math.max(...gradi.keys());
  const leggi = (k: number): Frac => gradi.get(k) ?? fr(0);
  if (grado === 0) return [];
  if (grado === 1) return [fDiv(fNeg(leggi(0)), leggi(1))];
  if (grado === 2) {
    const a = leggi(2), b = leggi(1), c = leggi(0);
    const disc = fSub(fMul(b, b), fMul(fr(4), fMul(a, c)));
    if (disc.d !== 1 || disc.n < 0) return null; // discriminante negativo o frazionario: radici non razionali

    if (disc.n === 0) return [fDiv(fNeg(b), fMul(fr(2), a))];
    const sq = quadratoPerfetto(disc.n);
    if (sq === null) return null; // radici irrazionali: nessun box
    const dueA = fMul(fr(2), a);
    return [fDiv(fSub(fNeg(b), fr(sq)), dueA), fDiv(fAdd(fNeg(b), fr(sq)), dueA)];
  }
  if (grado > GRADO_CE_MAX) return null;
  /* coefficienti interi (mcm dei denominatori) per il teorema delle radici
   * razionali: p divisore del coefficiente noto, q divisore del direttore. */
  let mcm = 1;
  for (const c of gradi.values()) mcm = (mcm * c.d) / gcdCe(mcm, c.d);
  const c0 = leggi(0), cn = leggi(grado);
  const c0n = c0.n * (mcm / c0.d), cnn = cn.n * (mcm / cn.d);
  if (Math.abs(c0n) > 1e7 || Math.abs(cnn) > 1e7) return null;
  const candidati: Frac[] = [];
  if (c0n === 0) {
    candidati.push(fr(0));
  } else {
    for (const pp of divisoriCe(c0n)) {
      for (const qq of divisoriCe(cnn)) {
        candidati.push(fr(pp, qq), fr(-pp, qq));
      }
    }
  }
  for (const r of candidati) {
    if (valutaGradiCe(gradi, r).n !== 0) continue;
    const defl = sgonfiaGradiCe(gradi, r);
    if (!defl) continue;
    const resto = radiciEsatteDiGradi(defl);
    if (resto === null) continue; // il resto non si smonta: provo altri candidati
    return [r, ...resto];
  }
  return null;
}

export function valoriVietatiPolinomio(p: Term[]): Vietato[] | null {
  if (!p.length) return null;
  const variabili = new Set<string>();
  for (const t of p) for (const v of t.vars) variabili.add(v.v);
  if (variabili.size === 0) return null; // denominatore numerico: nessuna C.E.
  if (variabili.size > 1) {
    // monomio a più lettere (es. xy): ogni lettera va tenuta diversa da 0
    if (p.length === 1) return p[0]!.vars.map((v) => ({ lettera: v.v, valore: "0" }));
    return null;
  }
  const gradi = new Map<number, Frac>();
  for (const t of p) {
    if (t.vars.some((v) => v.e < 0)) return null; // «1/x + 1» non è un polinomio
    const g = t.vars.reduce((m, v) => m + v.e, 0);
    const c = gradi.get(g);
    gradi.set(g, c ? fAdd(c, t.c) : t.c);
  }
  for (const [g, c] of [...gradi]) if (c.n === 0) gradi.delete(g);
  if (!gradi.size) return null; // denominatore identicamente nullo
  const leggi = (k: number): Frac => gradi.get(k) ?? fr(0);
  const radici: Frac[] = [];
  // fattore x^k: radice 0 (una volta sola) e divisione per x
  while (leggi(0).n === 0) {
    const maxG = Math.max(...gradi.keys());
    if (maxG <= 0) return null;
    radici.push(fr(0));
    const spostati = [...gradi].filter(([g]) => g > 0).map(([g, c]) => [g - 1, c] as const);
    gradi.clear();
    for (const [g, c] of spostati) gradi.set(g, c);
  }
  const grado = Math.max(...gradi.keys());
  const lettera = variabili.values().next().value!;
  /* (12/11, foto) radici esatte a QUALSIASI grado ≤ 9 (radici razionali +
   * deflazione + quadriche): prima il grado ≥ 3 restituiva null e valori
   * vietati come x ≠ 2 per (x−2)³ venivano persi dalla C.E. */
  const esatte = radiciEsatteDiGradi(gradi);
  if (esatte === null) return null;
  radici.push(...esatte);
  /* ordine deterministico crescente: la stessa C.E. ha sempre lo stesso
     elenco, anche rileggendo l'esercizio dall'archivio */
  const valore = (f: Frac): number => f.n / f.d;
  const visti = new Set<string>();
  const out: Vietato[] = [];
  for (const r of [...radici].sort((a, b) => valore(a) - valore(b))) {
    const s = frazCalcolatrice(r);
    if (!visti.has(s)) { visti.add(s); out.push({ lettera, valore: s }); }
  }
  return out.length ? out : null;
}

/** Sezione C.E. dell'espressione: un box per ogni denominatore originale
 *  DISTINTO (frazioni impilate e basi di esponenti negativi) con radici
 *  reali esatte. null se l'espressione non è fratta o non c'è nulla da
 *  calcolare. La sezione va messa in TESTA all'esercizio. */
export function sezioneCondizioniEsistenza(espressioneLatex: string): SezioneAI | null {
  let radice: Node;
  try {
    radice = parseExpression(normalizeInput(espressioneLatex, true));
  } catch {
    return null;
  }
  const giaVisti = new Set<string>();
  const vietatiVisti = new Set<string>();
  const boxes: BoxAI[] = [];
  const aggiungiBox = (baseLatex: string): void => {
    const den = baseLatex.replace(/\\left|\\right/g, "").trim();
    if (!den || giaVisti.has(den)) return;
    giaVisti.add(den);
    const p = polinomio(den);
    const vietati = p ? valoriVietatiPolinomio(p) : null;
    vietati?.forEach((v, i) => {
      const chiave = `${v.lettera}:${v.valore}`;
      if (vietatiVisti.has(chiave)) return;
      vietatiVisti.add(chiave);
      boxes.push({
        op: `${den} \\ne 0`,
        prompt: i === 0
          ? `CONDIZIONI DI ESISTENZA: il denominatore non può valere 0. Scrivi il valore vietato: ${v.lettera} ≠ …`
          : `C.E.: c'è anche un altro valore vietato. Scrivilo: ${v.lettera} ≠ …`,
        answerLatex: v.valore,
        simbolico: true,
        condizioniEsistenza: true,
        soluzioneCe: `${v.lettera} \\ne ${frazLatexDaCalcolatrice(v.valore)}`,
      });
    });
  };
  // Se un denominatore è un prodotto, ciascun fattore deve essere diverso
  // da zero anche quando il prodotto intero non è un polinomio (per esempio
  // contiene radici numeriche). Non scomponiamo le somme come prodotti.
  const aggiungiZeriDenominatore = (n: Node): void => {
    // Per denominatori polinomiali mantieni il box originario e il suo
    // ordinamento; ricorri ai fattori solo quando il polinomio non è leggibile.
    const stampato = printLatex(n);
    const p = polinomio(stampato);
    if (p && valoriVietatiPolinomio(p)?.length) {
      aggiungiBox(stampato);
      return;
    }
    switch (n.k) {
      case "paren": case "neg": case "abs":
        aggiungiZeriDenominatore(n.a); return;
      case "mul":
        aggiungiZeriDenominatore(n.a); aggiungiZeriDenominatore(n.b); return;
      case "div":
        aggiungiZeriDenominatore(n.a); return;
      case "pow":
        if (n.e > 0) aggiungiZeriDenominatore(n.a); return;
      case "sqrt":
        aggiungiZeriDenominatore(n.a); return;
      case "root":
        if (n.n > 0) aggiungiZeriDenominatore(n.a); return;
      default:
        aggiungiBox(printLatex(n));
    }
  };
  const visita = (n: Node): void => {
    switch (n.k) {
      case "div":
        aggiungiZeriDenominatore(n.b);
        visita(n.a);
        visita(n.b);
        return;
      case "root":
        // Un indice negativo rappresenta un reciproco: anche il radicando
        // deve essere diverso da zero, indipendentemente dall'indice.
        if (n.n < 0) aggiungiZeriDenominatore(n.a);
        visita(n.a);
        return;
      case "sqrt":
      case "abs":
      case "powfrac":
        /* (12/11, foto «ancora non funziona bene») i valori vietati possono
         * nascondersi DENTRO radici e valori assoluti (es. √((x+1)/(x−3))):
         * scendo dentro il nodo. */
        visita(n.a);
        return;
      case "pow":
        if (n.e < 0) {
          const baseLatex = printLatex(n.a);
          if (polinomio(baseLatex) !== null) {
            aggiungiBox(baseLatex); // (x+1)^{-1}: base al denominatore
          } else {
            /* \left( ∛(…) \right)^{-1}: il parse mette una PARENTESI attorno
             * alla base — la srotolo prima di guardare dentro. */
            let bn: Node | undefined = n.a;
            while (bn && bn.k === "paren") bn = bn.a;
            if (bn && (bn.k === "sqrt" || bn.k === "root")) {
              /* (12/11, foto) base NON polinomiale = radice: (∛(x³−6x²+12x−8))⁻¹
               * vale 0 esattamente quando il RADICANDO vale 0 → x ≠ 2. Prima la
               * base con la radice bloccava polinomio() e il valore vietato
               * veniva perso (restava solo x ≠ −1). Il radicando va stampato
               * SENZA parentesi: polinomio() non legge «(x³−…−8)». */
              aggiungiZeriDenominatore(bn.a);
            } else {
              visita(n.a); // base composta (frazioni dentro): scendo
            }
          }
        }
        return;
      case "add":
      case "sub":
      case "mul":
        visita(n.a);
        visita(n.b);
        return;
      case "neg":
      case "paren":
        visita(n.a);
        return;
      default:
        return;
    }
  };
  visita(radice);
  if (!boxes.length) return null;
  return { title: "CONDIZIONI DI ESISTENZA (C.E.)", boxes };
}

/** Vincoli che il calcolatore dei soli zeri razionali non sa ancora
 * risolvere. Restano esplicitamente in forma generale: non omettere, ad
 * esempio, il denominatore con un radicale e un valore assoluto. Anche le
 * radici pari impongono il loro dominio reale, quelle di indice pari
 * negativo esigono un radicando strettamente positivo. */
export function condizioniGeneraliNonRisolte(espressioneLatex: string): string[] {
  try {
    const iniziale = parseExpression(normalizeInput(espressioneLatex, true));
    const condizioni = new Set<string>();
    const aggiungi = (n: Node, relazione: "ne" | "ge" | "gt") => {
      const s = printLatex(n);
      if (!contieneLettere(s)) return; // le condizioni numeriche non riguardano la variabile
      // I valori vietati polinomiali noti sono già richiesti nei box C.E.
      if (relazione === "ne") {
        const p = polinomio(s);
        if (p && valoriVietatiPolinomio(p)?.length) return;
      }
      condizioni.add(`${s} \\${relazione} 0`);
    };
    const visita = (n: Node): void => {
      switch (n.k) {
        case "div": aggiungi(n.b, "ne"); visita(n.a); visita(n.b); return;
        case "sqrt": aggiungi(n.a, "ge"); visita(n.a); return;
        case "root":
          if (n.n < 0) aggiungi(n.a, Math.abs(n.n) % 2 === 0 ? "gt" : "ne");
          else if (n.n % 2 === 0) aggiungi(n.a, "ge");
          visita(n.a); return;
        case "powfrac":
          if (n.n % 2 === 0) aggiungi(n.a, n.m < 0 ? "gt" : "ge");
          else if (n.m < 0) aggiungi(n.a, "ne");
          visita(n.a); return;
        case "pow": if (n.e < 0) aggiungi(n.a, "ne"); visita(n.a); return;
        case "add": case "sub": case "mul": visita(n.a); visita(n.b); return;
        case "paren": case "neg": case "abs": visita(n.a); return;
        default: return;
      }
    };
    visita(iniziale);
    return [...condizioni];
  } catch {
    return [];
  }
}

/* (12/11, collaudo n.9) true se nell'espressione compare almeno una LETTERA
 * (variabile libera). Serve per riconoscere i «conti a parte»: box di puro
 * calcolo numerico che non alterano la riga. Se il testo non è leggibile,
 * prudenzialmente risponde true (niente conto a parte). */
function contieneLettere(latex: string): boolean {
  try {
    const node = parseExpression(normalizeInput(latex));
    const visita = (n: unknown): boolean => {
      if (!n || typeof n !== "object") return false;
      const obj = n as Record<string, unknown>;
      if (obj.k === "var") return true;
      for (const v of Object.values(obj)) if (visita(v)) return true;
      return false;
    };
    return visita(node);
  } catch {
    return true;
  }
}

function riparaEsercizio(
  raw: unknown,
): { esercizio: EsercizioAI | null; avvertenze: string[]; problemi: string[] } {
  const avvertenze: string[] = [];
  const problemi: string[] = [];
  /* (27/10, collaudo) il motore legge «2,5» ma NON «2{,}5»: se l'IA usa la
     virgola graffa (forma LaTeX dei decimali) la riporto alla virgola semplice
     in tutto l'esercizio PRIMA di ogni controllo. */
  if (raw && typeof raw === "object") {
    try {
      raw = JSON.parse(JSON.stringify(raw).replace(/(\d)\s*\{,\}\s*(\d)/g, "$1,$2"));
    } catch {
      /* oggetto non serializzabile: lo controlla il codice sotto */
    }
    // Conservare il valore assoluto: eliminarlo senza verificare il segno
    // può cambiare l'espressione (per esempio quando x−a è negativo).
  }
  const e = raw as Partial<EsercizioAI> | null;
  if (!e || typeof e !== "object") {
    return { esercizio: null, avvertenze, problemi: ["la risposta non è un oggetto JSON"] };
  }
  if (typeof e.espressioneLatex !== "string" || !e.espressioneLatex.trim()) {
    return { esercizio: null, avvertenze, problemi: ["manca espressioneLatex"] };
  }
  if (!Array.isArray(e.sezioni)) {
    return { esercizio: null, avvertenze, problemi: ["manca l'elenco delle sezioni"] };
  }
  /* l'espressione deve essere leggibile dal motore (pagina 3 e PDF la
     ridisegnano): è l'unico requisito di FONDO, con l'esistenza dei box */
  try {
    parseExpression(normalizeInput(e.espressioneLatex));
  } catch {
    return { esercizio: null, avvertenze, problemi: ["espressioneLatex non è leggibile dal motore locale"] };
  }

  const sezioniRiparate: EsercizioAI["sezioni"] = [];
  let nBox = 0;
  for (const s of e.sezioni) {
    if (!Array.isArray(s?.boxes)) continue;
    const boxes: EsercizioAI["sezioni"][number]["boxes"] = [];
    for (const b of s.boxes) {
      const op = typeof b?.op === "string" ? b.op.trim() : "";
      if (!op) {
        avvertenze.push("un box senza operazione è stato scartato");
        continue;
      }
      nBox += 1;
      /* (12/11) box CONDIZIONI DI ESISTENZA: non è un conto (un denominatore
         non è mai «uguale» al valore vietato), quindi contoGiusto e la
         riparazione del motore non si applicano. La coerenza coi valori
         vietati è garantita dal generatore; qui si controlla solo che la
         risposta sia un numero o una frazione semplice. */
      if ((b as { condizioniEsistenza?: unknown }).condizioniEsistenza === true) {
        const attesa = typeof b?.answerLatex === "string" ? b.answerLatex.trim() : "";
        if (!/^-?\d+(\/\d+)?$/.test(attesa)) {
          problemi.push(`box ${nBox}: condizione di esistenza senza un valore vietato valido`);
          continue;
        }
        const fraseCe = typeof b?.prompt === "string" && b.prompt.trim() ? b.prompt.trim() : undefined;
        const soluzioneCe = typeof (b as { soluzioneCe?: unknown }).soluzioneCe === "string"
          ? (b as { soluzioneCe: string }).soluzioneCe.trim() || undefined
          : undefined;
        boxes.push({ op, prompt: fraseCe, answerLatex: attesa, simbolico: true, condizioniEsistenza: true, soluzioneCe });
        continue;
      }
      const aiAnswerGrezzo = typeof b?.answerLatex === "string" ? b.answerLatex.trim() : "";
      /* (12/11, foto utente, box «|x−2|⁻¹ = 1/|x−2|») l'IA a volte scrive DUE
       * passi in un box separandoli con «=»: le risposte dei box sono
       * espressioni, mai equazioni — quella da verificare e da usare nelle
       * righe progressive è l'ultima espressione dopo l'«=». */
      const aiAnswer = aiAnswerGrezzo.includes("=")
        ? (aiAnswerGrezzo.split("=").pop() ?? "").trim()
        : aiAnswerGrezzo;
      /* (08/11) guardia anti-box degenere: se il «calcolo del motore» ha la
         STESSA struttura dell'operazione (es. √2 → √2, già in forma minima)
         non è una riparazione: la risposta dell'IA resta bocciata. */
      const motoreRiparabile = (m: string | null): m is string =>
        m != null && !sameResultStructure(op, m) && contoGiusto(op, m).ok;
      let answerLatex = aiAnswer;
      if (aiAnswer) {
        const esito = contoGiusto(op, aiAnswer);
        /* (12/11-punto 2) box DEGENERE: la risposta ha la STESSA struttura
           dell'operazione (es. la somma (x+3)+x−1 ripetuta uguale dopo aver
           tolto le barre) — non insegna nulla e la riga progressiva non
           avanza. Se il motore sa svolgere il conto, la risposta diventa il
           conto svolto (es. 2x+2). ESCLUSI i box FRAZIONARI: l'ultimo box
           «frazione finale pulita» ripete l'operazione di proposito (foto
           radicali 08/11) e il motore la ristamperebbe coi segni girati
           ((√2−2−√6)/(−4) → (2−√2+√6)/4): forma equivalente ma diversa
           dalla catena scritta dello studente. */
        if (esito.ok && sameResultStructure(op, aiAnswer) && !/\\[dt]?frac|\u2044/.test(op)) {
          const motore = risultatoMotore(op);
          if (motoreRiparabile(motore)) {
            answerLatex = motore;
            avvertenze.push(`box ${nBox}: box degenere, risposta svolta e verificata dal motore`);
          }
        } else if (!esito.ok) {
          const motore = risultatoMotore(op);
          if (motoreRiparabile(motore)) {
            answerLatex = motore;
            avvertenze.push(`box ${nBox}: risposta dell'IA sostituita dal calcolo verificato del motore`);
          } else {
            problemi.push(`box ${nBox}: risposta non verificabile o non corretta (${esito.via})`);
          }
        }
      } else {
        const motore = risultatoMotore(op);
        if (motoreRiparabile(motore)) {
          answerLatex = motore;
          avvertenze.push(`box ${nBox}: risposta mancante, calcolata e verificata dal motore`);
        } else {
          problemi.push(`box ${nBox}: risposta mancante e non verificabile dal motore`);
        }
      }
      /* flag simbolico dalle lettere nel TESTO (stessa regola fix3) */
      const senzaComandi = op.replace(/\\[a-zA-Z]+/g, "");
      let criterioDidattico = criterioAmmesso((b as { criterioDidattico?: unknown }).criterioDidattico);
      // Vale anche per box già preparati dall'IA o conservati in archivio:
      // se questo passaggio elimina un radicale al denominatore, non basta
      // ripetere l'operazione come risposta (pur essendo equivalente).
      if (!criterioDidattico && trovaFrazioneConRadiceQuadrata(op) &&
          formaDidatticaValida("radicale_trasformato", answerLatex, op)) {
        criterioDidattico = "radicale_trasformato";
      }
      const simbolico =
        !!criterioDidattico ||
        /[a-z]/i.test(senzaComandi) ||
        (parsePolyLoose(op)?.some((t) => t.vars.length > 0) ?? false);
      /* (26/10, foto utente «non dire mai la soluzione neanche per iscritto»:
         la frase didattica guida il METODO, mai il RISULTATO — il sanitizer
         taglia la soluzione dalla frase (cifre, parole, TeX, radicali detti)
         senza toccare il metodo; se la frase si svuota resta un invito a
         calcolare. L'esercizio resta valido: pagina 3 sempre aperta. */
      let frase = typeof b?.prompt === "string" && b.prompt.trim() ? b.prompt.trim() : undefined;
      if (frase && answerLatex) {
        const pulita = ripulisciPrompt(frase, op, answerLatex);
        if (pulita.ripulito) {
          avvertenze.push(`box ${nBox}: frase didattica ripulita (conteneva il risultato: ${pulita.motivi.join("; ")})`);
          frase = pulita.testo;
        }
      }
      if (frase) frase = rifinisciFrase(frase);
      const extra = typeof b?.extraLatex === "string" ? b.extraLatex.trim() : "";
      // Il testo aggiuntivo è visibile PRIMA della risposta: non fidarsi del
      // modello. Solo una riscrittura verificata della divisione fra frazioni
      // è consentita; il risultato o un altro calcolo non vengono mai mostrati.
      const extraSicuro = extra && safeFractionReciprocal(op, extra) ? extra : undefined;
      if (extra && !extraSicuro) avvertenze.push(`box ${nBox}: ausilio non verificabile o potenziale risultato rimosso`);
      boxes.push({ op, prompt: frase, extraLatex: extraSicuro, answerLatex, simbolico: simbolico ? true : undefined, criterioDidattico });
    }
    if (boxes.length > 0) {
      const st = s as { title?: unknown };
      const titolo =
        typeof st.title === "string" && st.title.trim() ? st.title : "ESERCIZIO";
      sezioniRiparate.push({ title: titolo, boxes });
    }
  }
  if (nBox === 0 || sezioniRiparate.length === 0) {
    return { esercizio: null, avvertenze, problemi: ["nessun box con un'operazione"] };
  }

  /* risultato finale: se il conto dell'IA non torna (o manca), lo calcola
     il motore dall'espressione intera */
  let risultatoFinaleLatex =
    typeof e.risultatoFinaleLatex === "string" ? e.risultatoFinaleLatex.trim() : "";
  if (risultatoFinaleLatex) {
  const esitoF = contoGiusto(e.espressioneLatex!, risultatoFinaleLatex);
    if (!esitoF.ok) {
      const motore = risultatoMotore(e.espressioneLatex!);
      if (motore != null && contoGiusto(e.espressioneLatex!, motore).ok) {
        risultatoFinaleLatex = motore;
        avvertenze.push("risultato finale dell'IA sostituito dal calcolo verificato del motore");
      } else {
        problemi.push(`risultato finale non verificabile o non corretto (${esitoF.via})`);
      }
    }
  } else {
    const motore = risultatoMotore(e.espressioneLatex!);
    if (motore != null && contoGiusto(e.espressioneLatex!, motore).ok) {
      risultatoFinaleLatex = motore;
      avvertenze.push("risultato finale mancante, calcolato e verificato dal motore");
    } else {
      /* (08/11, letterali) Radicali con lettere: risultatoMotore non sa
         calcolare √(3(a²−1))/(9(a+1)) da solo. Ma per la regola 9 del prompt
         l'ULTIMA riga è la risposta dell'ultimo box: se quel risultato è
         verificato contro l'espressione intera, È il risultato finale. Il
         controllo a valle (ultima riga ↔ finale, nessun conto riducibile)
         resta comunque attivo, quindi nessun passaggio inventato. */
      const ultimo =
        sezioniRiparate[sezioniRiparate.length - 1]?.boxes.slice(-1)[0]?.answerLatex;
      if (ultimo && contoGiusto(e.espressioneLatex!, ultimo).ok) {
        risultatoFinaleLatex = ultimo;
        avvertenze.push(
          "risultato finale mancante, assunto dalla risposta dell'ultimo box (verificata)",
        );
      } else {
        problemi.push("risultato finale mancante e non verificabile dal motore");
      }
    }
  }
  /* (12/11, collaudo n.6) RISULTATO FINALE IDENTITARIO: il «finale» coincide
   * con l'espressione di partenza MA nell'espressione resta un conto
   * riducibile → l'IA non ha svolto nulla (box finale identitario che copia
   * l'espressione intera, caso «SOSTITUISCI FRAZIONI» del collaudo; vale
   * anche quando il finale è assunto dall'ultimo box). Si accetta invece se
   * l'espressione era GIÀ in forma minima: nessun conto pendente (es. √2,
   * (x+1)/(x−1)). Il percorso «calcolato dal motore» non può cadere qui: chi
   * svolge i conti dà sempre una forma diversa da quella pendente. */
  if (
    risultatoFinaleLatex &&
    sameResultStructure(e.espressioneLatex!, risultatoFinaleLatex) &&
    haContoPendente(e.espressioneLatex!)
  ) {
    problemi.push(
      "risultato finale identico all'espressione di partenza: restano conti da svolgere",
    );
  }
  // Mai consegnare come corretto un calcolo che non siamo riusciti a verificare.
  if (problemi.length) return { esercizio: null, avvertenze, problemi };

  // Le righe dell'IA non sono attendibili: anche se hanno lo stesso valore,
  // potrebbero contenere il risultato di calcoli non ancora svolti. Partiamo
  // dall'espressione originale e sostituiamo un SOLO box alla volta, dopo aver
  // verificato il suo risultato. I box non collegati non sono utilizzabili.
  const righe: string[] = [e.espressioneLatex!];
  /* (12/11) le condizioni di esistenza NON si collegano alle righe: non
     sono conti e non modificano l'espressione. */
  const tuttiBox = sezioniRiparate.flatMap((sez) => sez.boxes).filter((b) => !b.condizioniEsistenza);
  // Anche titoli e istruzioni sono visibili prima dei conti successivi: li
  // confrontiamo con ogni risposta ancora nascosta, non soltanto col box.
  let indiceSezione = 0;
  for (const sezione of sezioniRiparate) {
    let titolo = sezione.title;
    for (const futuro of tuttiBox.slice(indiceSezione)) {
      const pulita = ripulisciPrompt(titolo, sezione.boxes[0].op, futuro.answerLatex);
      if (pulita.ripulito) { titolo = pulita.testo; avvertenze.push("titolo ripulito: anticipava un risultato"); }
    }
    sezione.title = /applica il metodo e scrivi tu il risultato/i.test(titolo) ? "PASSAGGI" : titolo;
    for (const box of sezione.boxes) {
      if (box.prompt) {
        let frase = box.prompt;
        for (const futuro of tuttiBox.slice(indiceSezione)) {
          const pulita = ripulisciPrompt(frase, box.op, futuro.answerLatex);
          if (pulita.ripulito) { frase = pulita.testo; avvertenze.push("frase ripulita: anticipava un risultato successivo"); }
        }
        box.prompt = frase;
      }
      indiceSezione++;
    }
  }
  for (let i = 0; i < tuttiBox.length; i++) {
    const b = tuttiBox[i];
    const rigaPrecedente = righe[righe.length - 1];
    let op = b.op;
    let successiva = replaceExpressionStep(righe[righe.length - 1], op, b.answerLatex);
    if (!successiva) {
      /* (10/11-fix, foto «non mi costruisce l'esercizio») l'IA a volte
       * riscrive nel box un decimale che un box precedente ha GIÀ convertito
       * in frazione nella riga (es. 0,75 dopo 0,75→7/15): il conto è giusto,
       * solo la forma non coincide. Ripristino nell'op i decimali già
       * trasformati dai box precedenti e riprovo il collegamento. */
      const normalizzata = decimaliGiaConvertiti(op, tuttiBox.slice(0, i));
      if (normalizzata !== op) {
        successiva = replaceExpressionStep(righe[righe.length - 1], normalizzata, b.answerLatex);
        if (successiva) {
          b.op = normalizzata;
          console.log(`[costruisci] box ${i + 1}: op riportata alla forma della riga (decimale già convertito in frazione)`);
        }
      }
    }
    if (!successiva) {
      /* (12/11, foto «ancora non funziona bene») l'IA scrive il box col
       * RADICANDO ORIGINALE (\sqrt{x²+4x+4}) mentre la riga mostra già la
       * scomposizione del box precedente (\sqrt{(x+2)²}): applico all'op le
       * sostituzioni (op→risposta) dei box PRECEDENTI e riprovo. */
      let adattata = op;
      for (let passata = 0; passata < 4; passata++) {
        let cambiata = false;
        for (const prec of tuttiBox.slice(0, i)) {
          const t = replaceExpressionStep(adattata, prec.op, prec.answerLatex);
          if (t && t !== adattata) { adattata = t; cambiata = true; }
        }
        if (!cambiata) break;
      }
      if (adattata !== op) {
        successiva = replaceExpressionStep(righe[righe.length - 1], adattata, b.answerLatex);
        if (successiva) {
          b.op = adattata;
          console.log(`[costruisci] box ${i + 1}: op allineata alla riga (sostituzioni dei box precedenti applicate)`);
        }
      }
    }
    if (!successiva) {
      /* (12/11, foto, box 9) FORME ALTERNATIVE DELLA RADICE: il box può usare
       * √[−k]{X} mentre nella riga c'è (√[k]{X})⁻¹, o viceversa: sono la stessa
       * cosa. Provo la sostituzione con la forma alternativa dell'op (il
       * confronto è strutturale, quindi spazi e parentesi non contano). */
      for (const alt of [radicaleNegativaAPotenza(op), radicalePotenzaANegativa(op)]) {
        if (alt === op) continue;
        successiva = replaceExpressionStep(righe[righe.length - 1], alt, b.answerLatex);
        if (successiva) {
          avvertenze.push(`box ${i + 1}: collegato con la forma equivalente della radice (esponente −1 ↔ indice negativo)`);
          console.log(`[costruisci] box ${i + 1}: collegato con FORMA ALTERNATIVA della radice`);
          break;
        }
      }
    }
    if (!successiva) {
      /* (12/11, foto) l'IA a volte riscrive nel box l'INTERA riga in forma
       * equivalente (legge distributiva: (a+b)·c → a·c+b·c; denominatore
       * espanso: 3(x−2) → 3x−6): il collegamento per sostituzione strutturale
       * non può funzionare, ma il conto è lo STESSO. Se op ≡ riga (motore di
       * verifica), la riga successiva è la risposta stessa (già verificata
       * nel box: op ≡ risposta). Catena: riga ≡ op ≡ risposta. */
      if (contoGiusto(righe[righe.length - 1], op).ok &&
          !contiNumericiSaltati(righe[righe.length - 1], op) &&
          !individuaPassiMancanti(righe[righe.length - 1], op, b.answerLatex)) {
        successiva = b.answerLatex;
        avvertenze.push(`box ${i + 1}: collegato per equivalenza del conto (forma riscritta)`);
        console.log(`[costruisci] box ${i + 1}: collegato per EQUIVALENZA (op riscritta in forma diversa)`);
      }
    }
    // Se l'IA ha saltato un semplice conto numerico già scritto nella
    // riga, aggiungo il SUO box invece di eseguire il conto al posto dello
    // studente. Il ponte viene accettato solo quando ogni passaggio è
    // verificato e il box successivo si collega senza cambiare la riga.
    if (!successiva) {
      const ponte = individuaPassiMancanti(righe[righe.length - 1], op, b.answerLatex);
      const sezione = sezioniRiparate.find((s) => s.boxes.includes(b));
      if (ponte?.length && sezione && ponte.every((p) => contoGiusto(p.op, p.answerLatex).ok)) {
        const nuovi: BoxAI[] = ponte.map((p) => ({ ...p }));
        // Un box che ripeteva la stessa frazione viene rimpiazzato con
        // l'ultimo vero passaggio, invece di chiedere un'inutile ricopia.
        if (sameExpressionStructure(b.op, b.answerLatex)) {
          const ultimo = nuovi.pop()!;
          b.op = ultimo.op;
          b.answerLatex = ultimo.answerLatex;
          b.prompt = ultimo.prompt;
          b.simbolico = ultimo.simbolico;
          b.extraLatex = undefined;
          b.criterioDidattico = undefined;
          op = b.op;
        }
        if (nuovi.length) {
          const posizione = sezione.boxes.indexOf(b);
          sezione.boxes.splice(posizione, 0, ...nuovi);
          tuttiBox.splice(i, 0, ...nuovi);
          avvertenze.push(`box ${i + 1}: aggiunti passaggi intermedi numerici verificati`);
          i--;
          continue;
        }
        successiva = replaceExpressionStep(righe[righe.length - 1], b.op, b.answerLatex);
        if (successiva) avvertenze.push(`box ${i + 1}: passaggio mancante sostituito con un box verificato`);
      }
    }
    /* (12/11, collaudo n.9) CONTO A PARTE: un box verificato il cui op non
     * compare nella riga ma è puro calcolo NUMERICO (nessuna lettera) — es.
     * (10/3)·(1/(3√10)) = 10/(9√10), il coefficiente ripartito tra i fattori
     * della riga — non altera la riga: si conserva come passo laterale
     * verificato. Vale SOLO dentro un'espressione LETTERALE (nella riga c'è
     * almeno una lettera): in un esercizio numerico ogni conto deve
     * collegarsi, altrimenti l'IA è andata fuori copione. Il box successivo
     * deve comunque collegarsi alla riga intatta, quindi nessun varco: un
     * conto finto resterebbe scollegato. */
    if (
      !successiva &&
      !contieneLettere(op) &&
      !contieneLettere(b.answerLatex) &&
      contieneLettere(righe[righe.length - 1])
    ) {
      try {
        if (contoGiusto(op, b.answerLatex).ok) {
          successiva = righe[righe.length - 1];
          avvertenze.push(`box ${i + 1}: conto a parte verificato (coefficiente), la riga non cambia`);
          console.log(`[costruisci] box ${i + 1}: CONTO A PARTE verificato, riga invariata`);
        }
      } catch { /* prosegue col LINK FALLITO */ }
    }
    if (!successiva) {
      console.log(`[costruisci] LINK FALLITO box ${i + 1}: op=${JSON.stringify(op)} riga=${JSON.stringify(righe[righe.length - 1])}`);
      problemi.push(`box ${i + 1}: non riesco a collegare il conto alla riga precedente senza alterarla`);
      return { esercizio: null, avvertenze, problemi };
    }
    righe.push(successiva);
  }
  // L'ultimo risultato non va mostrato se restano calcoli senza un box.
  // (08/11, radicali) la riga meccanica e il risultato possono differire
  // solo di FORMA (meno spostato nel numeratore, frazione estratta dal
  // motore): la forma diversa si accetta SOLO se nella riga non resta
  // nessun conto riducibile (haContoPendente) e il valore coincide
  // ESATTAMENTE. Con un conto pendente (es. «2 + 12» con finale 14) il
  // rifiuto resta invariato.
  const ultima = righe[righe.length - 1];
  const formaPulita = sameResultStructure(ultima, risultatoFinaleLatex);
  const completaStessoValore =
    !haContoPendente(ultima) && contoGiusto(ultima, risultatoFinaleLatex).ok;
  if (!formaPulita && !completaStessoValore) {
    problemi.push("manca almeno un passaggio per arrivare al risultato finale");
    return { esercizio: null, avvertenze, problemi };
  }
  avvertenze.push("righe progressive ricostruite dai calcoli effettivamente svolti");

  /* (11/11) Se l'ultima riga contiene una frazione con la sola radice
   * quadrata al denominatore, provo ad aggiungere un passo guidato verificato,
   * anche per esercizi deterministici o riletti dall'archivio. */
  risultatoFinaleLatex = aggiungiBoxRadiceAlDenominatore(
    righe,
    sezioniRiparate,
    avvertenze,
    risultatoFinaleLatex,
  );

  /* (12/11, richiesta utente) CONDIZIONI DI ESISTENZA (C.E.): ogni
   * espressione fratta comincia dai valori vietati dei SUOI denominatori
   * originali, prima di ogni conto. La sezione è prependeda anche agli
   * esercizi riletti dall'archivio (il controllo qui sotto la rende
   * idempotente); le boxed marcate condizioniEsistenza sono già state
   * conservate dal ciclo sui box senza contoGiusto né collegamento. */
  const giaCe = sezioniRiparate.some((s) => s.boxes.some((b) => b.condizioniEsistenza));
  const sezioneCe = giaCe ? null : sezioneCondizioniEsistenza(e.espressioneLatex!);
  if (sezioneCe) {
    sezioniRiparate.unshift(sezioneCe);
    avvertenze.push("aggiunta la sezione CONDIZIONI DI ESISTENZA (C.E.) con i valori vietati dei denominatori");
  }

  /* (12/11, collaudo n.8) ULTIMO BOX IDENTITARIO SULL'ESPRESSIONE INTERA con
   * conti ancora da svolgere: i ripari deterministici hanno già avuto la
   * possibilità di sostituirlo con un passo guidato (es. razionalizzazione);
   * se resta, l'IA si è fermata prima di svolgere (caso «SOSTITUISCI
   * FRAZIONI» che copia l'espressione di partenza). Restano leciti i box
   * identitari su righe GIÀ IN FORMA MINIMA («frazione finale pulita»,
   * 08/11) e quelli su frazioni parziali (op ≠ riga intera). */
  const boxFinali = sezioniRiparate.flatMap((s) => s.boxes).filter((b) => !b.condizioniEsistenza);
  const ultimoBox = boxFinali[boxFinali.length - 1];
  const ultimaRiga = righe[righe.length - 1];
  if (
    ultimoBox &&
    sameResultStructure(ultimoBox.op, ultimoBox.answerLatex) &&
    sameResultStructure(ultimoBox.op, ultimaRiga) &&
    haContoPendente(ultimaRiga)
  ) {
    problemi.push(
      `box ${boxFinali.length}: l'ultimo passaggio ripete l'espressione senza svolgere nulla`,
    );
    return { esercizio: null, avvertenze, problemi };
  }

  const condizioniGenerali = condizioniGeneraliNonRisolte(e.espressioneLatex!);
  const esercizio: EsercizioAI = {
    espressioneLatex: e.espressioneLatex!,
    sezioni: sezioniRiparate,
    righeProgressive: righe,
    risultatoFinaleLatex,
    ...(condizioniGenerali.length ? { condizioniGenerali } : {}),
  };
  return { esercizio, avvertenze, problemi: [] };
}
export { riparaEsercizio };

/** Forma finale conservativa per il recupero di una catena IA: un'unica
 * frazione completa, senza altre divisioni annidate né radici di potenze
 * ancora da estrarre. Non dichiara «finito» un prodotto tra frazioni o
 * un'espressione che contiene ancora un conto visibile. */
function frazioneFinaleGiaSvolta(latex: string): boolean {
  if (haContoPendente(latex) || /\\(?:overline|bar)\s*\{|\d+[,.]\d/.test(latex)) return false;
  try {
    const unwrap = (n: Node): Node => n.k === "paren" ? unwrap(n.a) : n;
    const root = unwrap(parseExpression(normalizeInput(latex, true)));
    if (root.k !== "div" || root.fr !== true) return false;
    const completa = (node: Node): boolean => {
      const n = unwrap(node);
      if (n.k === "div") return false; // niente frazioni impilate annidate
      if (n.k === "sqrt" || n.k === "root") {
        const indice = n.k === "sqrt" ? 2 : n.n;
        const radicando = unwrap(n.a);
        if (indice < 0 || (radicando.k === "pow" && radicando.e >= indice && radicando.e % indice === 0)) return false;
        return completa(n.a);
      }
      if (n.k === "pow" && n.e < 0) return false;
      if (n.k === "powfrac" && n.m < 0) return false;
      if (n.k === "add" || n.k === "sub" || n.k === "mul") return completa(n.a) && completa(n.b);
      if (n.k === "neg" || n.k === "abs" || n.k === "pow" || n.k === "powfrac") return completa(n.a);
      return true;
    };
    return completa(root.a) && completa(root.b);
  } catch { return false; }
}

/** Se l'IA ha già concluso una catena corretta e ha poi aggiunto una
 * semplificazione SBAGLIATA (per esempio cancellando un fattore senza
 * rispettare il modulo), riutilizzo SOLO il prefisso completo verificato.
 * Non si corregge il valore a intuito e non si saltano passaggi pendenti.
 * La ricostruzione ripassa TUTTI i controlli ordinari: ogni box, i legami,
 * la forma finale, le C.E. e la fedeltà alla trascrizione dello studente. */
export function recuperaPrefissoFinaleVerificato(
  sorgente: string, raw: unknown,
): { esercizio: EsercizioAI; avvertenze: string[] } | null {
  const e = raw as Partial<EsercizioAI> | null;
  if (!e || typeof e.espressioneLatex !== "string" || !trascrizioneFedele(sorgente, e.espressioneLatex) ||
      !Array.isArray(e.sezioni) || !e.sezioni.length || typeof e.risultatoFinaleLatex !== "string") return null;
  if (contoGiusto(e.espressioneLatex, e.risultatoFinaleLatex).ok) return null;
  const boxes = e.sezioni.flatMap((s) => Array.isArray(s?.boxes) ? s.boxes : []);
  // Questa riparazione riguarda SOLO passaggi di calcolo, non box C.E.
  if (boxes.length < 3 || boxes.length > 100 || boxes.some((b) => b?.condizioniEsistenza)) return null;
  const minimo = Math.max(2, boxes.length - 8);
  for (let n = boxes.length - 1; n >= minimo; n--) {
    const ultimo = boxes[n - 1];
    if (typeof ultimo?.op !== "string" || typeof ultimo?.answerLatex !== "string") continue;
    const finale = ultimo.answerLatex.trim();
    if (!frazioneFinaleGiaSvolta(finale) || sameResultStructure(ultimo.op, finale) ||
        !contoGiusto(ultimo.op, finale).ok || !contoGiusto(e.espressioneLatex, finale).ok) continue;
    // La coda va rimossa soltanto se contiene almeno un conto che non passa
    // il normale verificatore: non cancellare correzioni valide dell'IA.
    if (!boxes.slice(n).some((b) => !contoGiusto(b?.op, b?.answerLatex).ok)) continue;
    let residuo = n;
    const sezioni = e.sezioni.map((s) => {
      const originali = Array.isArray(s?.boxes) ? s.boxes : [];
      const presi = originali.slice(0, Math.max(0, residuo));
      residuo -= presi.length;
      return { ...s, boxes: presi };
    }).filter((s) => s.boxes.length > 0);
    const esito = riparaEsercizio({ ...e, sezioni, risultatoFinaleLatex: finale });
    if (esito.esercizio && trascrizioneFedele(sorgente, esito.esercizio.espressioneLatex) &&
        contoGiusto(sorgente, esito.esercizio.risultatoFinaleLatex).ok) {
      return { esercizio: esito.esercizio, avvertenze: [
        ...esito.avvertenze,
        "eliminata una semplificazione finale non corretta; mantenuta la precedente frazione completa e verificata",
      ] };
    }
  }
  return null;
}

/* ─── Prompt ────────────────────────────────────────────────────────── */

/** Suggerimenti destinati solo all'IA, mai alla pagina dello studente.
 * Quando una somma di frazioni è errata, il denominatore comune viene
 * ricostruito con una identità razionale ESATTA, inclusi moduli e radicali.
 * I box e il finale che dipendono dall'errore vanno rifatti, non rattoppati. */
export function indicazioniFrazioniSbagliate(raw: unknown): string[] {
  const dati = raw as { sezioni?: { boxes?: { op?: unknown; answerLatex?: unknown }[] }[] } | null;
  const sezioni = dati && Array.isArray(dati.sezioni) ? dati.sezioni : [];
  const boxes = sezioni.flatMap(s => Array.isArray(s?.boxes) ? s.boxes : []);
  const indicazioni: string[] = [];
  for (let i = 0; i < boxes.length && indicazioni.length < 3; i++) {
    const op = boxes[i]?.op, answer = boxes[i]?.answerLatex;
    if (typeof op !== "string" || typeof answer !== "string" || contoGiusto(op, answer).ok) continue;
    const corretta = sommaFrazioniConAtomi(op);
    if (!corretta) continue;
    indicazioni.push(
      `ERRORE GRAVE NEL BOX ${i + 1}: hai introdotto o perso un fattore nella somma ${op}. ` +
      `Per quella stessa op scrivi ESATTAMENTE answerLatex = ${corretta}; ` +
      `questa risposta è stata dimostrata con algebra esatta. NON copiare la risposta sbagliata del tentativo precedente. ` +
      `RIPARTI da questa risposta e RICALCOLA tutti i box successivi e il risultato finale. ` +
      `Non raccogliere un fattore se manca in uno degli addendi; conserva tutti i valori assoluti.`,
    );
  }
  return indicazioni;
}

/** Ancore numeriche riservate al generatore: evitare che, svolgendo la
 * radice POSITIVA di una frazione, l'IA perda il reciproco ESTERNO dovuto
 * all'indice negativo. Si usano solo risultati dimostrati esattamente;
 * radicandi letterali, non reali o non verificabili non producono ancore. */
export function indicazioniRadiciNegativeNumeriche(espressione: string): string[] {
  const indicazioni: string[] = [];
  const viste = new Set<string>();
  let visitati = 0;
  try {
    const ast = parseExpression(normalizeInput(espressione, true));
    const visita = (n: Node, profondita = 0): void => {
      if (++visitati > 400 || profondita > 50 || indicazioni.length >= 6) return;
      if (n.k === "root" && n.n < 0) {
        const op = printLatex(n);
        if (!viste.has(op)) {
          viste.add(op);
          const risultato = risultatoRadicaleLatex(op);
          if (risultato && exactNumericEquality(radicaleIndiceNegativoAPositivo(op), risultato) === true && contoGiusto(op, risultato).ok) {
            indicazioni.push(`Per ${op}, il valore ESATTO è ${risultato}. La radice con indice negativo è il reciproco dell'intera radice positiva: quando espandi una frazione sotto radice, NON eliminare il reciproco esterno. Usa questo valore nei passaggi successivi, rispettando il contesto.`);
          }
        }
      }
      switch (n.k) {
        case "add": case "sub": case "mul": case "div": visita(n.a, profondita + 1); visita(n.b, profondita + 1); break;
        case "paren": case "neg": case "sqrt": case "root": case "abs": case "pow": case "powfrac": visita(n.a, profondita + 1); break;
        default: break;
      }
    };
    visita(ast);
  } catch { /* forma non verificabile: nessuna supposizione */ }
  return indicazioni;
}

export function costruisciPrompt(espressione: string, precedente: string | null, problemi: string[], ancoreNumeriche: string[] = []): string {
  const ancore = ancoreNumeriche.length
    ? `\n\nCONTROLLI INTERNI ESATTI, SOLO PER TE (mai inserirli nel prompt, negli aiuti o nella parte visibile allo studente; le risposte restano nascoste in answerLatex):\n${ancoreNumeriche.map((a) => `- ${a}`).join("\n")}`
    : "";
  const correzione = problemi.length > 0
    ? `\n\nIl tentativo precedente aveva questi problemi (risolvili tutti):\n${problemi.map((p) => `- ${p}`).join("\n")}${precedente ? `\n\nTentativo precedente:\n${precedente}` : ""}\n\nRestituisci di nuovo SOLO il JSON completo e corretto.`
    : "";
  return `Costruisci lo SVOLGIMENTO GUIDATO a passaggi minimi di un'ESPRESSIONE (aritmetica, algebrica con lettere, fratta, potenze, radici quadrate/cubiche) per uno studente con DSA. Notazione in ingresso: ⁄ frazione impilata, · prodotto, : divisione, ^ potenza, √ ∛ ∜ radici, ( ) [ ] parentesi, lettere x y z a b. ATTENZIONE: un apice (con o senza segno −, es. ⁻³ o ⁵) IMMEDIATAMENTE prima di √ è l'INDICE della radice, NON una potenza del numero che precede: 0,\\overline{3}⁻³√(ab^{-1}) → 0,\\overline{3}\\sqrt[-3]{ab^{-1}} (le radici con indice negativo esistono in matematica e si mantengono tali).

Rispondi SOLO con un JSON COMPATTO (niente spazi inutili, niente markdown, niente testo fuori):
{"espressioneLatex":"...","sezioni":[{"title":"...","boxes":[{"op":"...","prompt":"...","extraLatex":"...","answerLatex":"...","simbolico":true}]}],"righeProgressive":["..."],"risultatoFinaleLatex":"..."}

REGOLE:
1. LaTeX consentito: \\dfrac{}{}, \\cdot, \\sqrt{}, \\sqrt[3]{}, \\sqrt[4]{}, \\sqrt[5]{} … \\sqrt[99]{}, \\sqrt[-3]{} (indici da 2 a 99, ANCHE NEGATIVI), \\overline{cifre} SOLO per il periodo dei numeri decimali (es. 0,4\\overline{6}), \\left( \\right), \\left[ \\right], ^{}, + - : e lettere. Vietato \\frac \\times \\div \\.
2. espressioneLatex: l'espressione INTERA con le parentesi originali. Con «=» svolgi SOLO il primo membro.
2b. NUMERI DECIMALI (es. 2,5 · 0,25 · 1,2): nell'espressioneLatex e nelle righe prima della trasformazione scrivili con la virgola SEMPLICE (2,5: mai 2{,}5 e mai il punto). Per OGNI decimale metti in una sezione «DECIMALI IN FRAZIONE», PRIMA degli altri calcoli, un box con op = il SOLO decimale (es. "2{,}5") e answerLatex = la frazione ridotta ("\\dfrac{5}{2}"; "0{,}25" → "\\dfrac{1}{4}"; se è un intero come 4,0 → "4"). Prompt del box: solo il metodo («Scrivo il decimale come frazione decimale e la riduco.»). Poi si calcola SOLO con frazioni impilate: mai decimali nei risultati.
2c. NUMERI PERIODICI come coefficienti (es. 0,4\\overline{6}, 0,\\overline{3}): nell'espressioneLatex e nelle righe prima della trasformazione scrivili con la virgola e \\overline (MAI 0,4(6), MAI approssimazioni). Per OGNI numero periodico metti in una sezione «PERIODICI IN FRAZIONE», PRIMA degli altri calcoli, un box con op = il SOLO numero periodico (es. "0,4\\overline{6}") e answerLatex = la frazione generatrice ridotta (es. 1,\\overline{2} → \\dfrac{11}{9}; 0,0\\overline{1} → \\dfrac{1}{90}; 0,58\\overline{3} → \\dfrac{7}{12}). Prompt del box: solo il metodo («Scrivo il numero periodico come frazione generatrice e la riduco.»), MAI il risultato.
3. Ogni box = UN SOLO calcolo elementare (mai due operazioni insieme; con tre addendi somma prima due, poi il terzo). Vietato \\text{...} nelle op e nelle answerLatex: ogni op è l'espressione matematica COMPLETA della riga corrente (es. il numeratore per intero), non la sua etichetta. Nei LaTeX NON lasciare spazi tra i fattori: scrivi a^{-2}bx^{-1}, mai a^{-2}b x^{-1}.
3b. NESSUN SALTO: la catena prosegue fino al risultato. Ogni coppia di termini identici e opposti (es. X-X) si annulla con un SUO box (op = la coppia intera, answerLatex = "0"); la divisione finale numeratore:denominatore è un SUO box, con answerLatex = risultatoFinaleLatex. MAI passare direttamente dalle trasformazioni dei radicali al risultato finale.
3c. COLLEGAMENTO: l'op di ogni box deve riprendere PAROLA PER PAROLA un pezzo della riga precedente (dopo le conversioni già fatte): se nelle righe un decimale è già diventato frazione, l'op usa la FRAZIONE, non il decimale.
4. answerLatex ridotto al minimo: frazioni \\dfrac ridotte (interi senza \\dfrac), radici perfette come numeri (√9 → 3), lettere semplificate (2x+3x → 5x).
4b. Esponenti NEGATIVI: la risposta semplificata non ha MAI esponenti negativi residui — capovolgi o semplifica (es. (2ab)^{-1}·4ab = 4ab : 2ab = 2; (1/2)^{-2} = 4; x^{-2} = \\dfrac{1}{x^{2}}). Nell'espressione iniziale e nelle prime righe restano come sono.
4d. RADICALI (proprietà): prima il TRASPORTO FUORI RADICE — scomponi il radicando ed estrai i fattori con esponente pari all'indice (√18 → 3√2, √12 → 2√3, √[3]{8} → 2). Poi somma/sottrai SOLO radicali SIMILI (stesso radicando e stessa indice) sommando i coefficienti. Una potenza con esponente pari all'indice vale la base senza radice: (√6)² → 6. Le radici non semplificabili restano INDICATE (es. √2, √6, √(ab^{-1}), ∛(a^{-2}b/x)): se gli esponenti del radicando NON sono multipli dell'indice la radice NON si semplifica e resta indicata così com'è; MAI decimali, MAI √ di somma non svolta. REGOLA INDICE NEGATIVO (fondamentale, matematicamente esatta): \\sqrt[-k]{A} = 1/\\sqrt[k]{A} — il RECIPROCO della radice con indice positivo. Svolgila in un box dedicato: il box trasforma la radice negativa nel suo reciproco e poi semplifica la radice positiva (potenze perfette e trasporto fuori radice come al solito). Esempi OBBLIGATORI: \\sqrt[-3]{(x-1)^{3}} = 1/\\sqrt[3]{(x-1)^{3}} = 1/(x-1) — MAI (x-1) senza il reciproco; \\sqrt[-2]{0,0\\overline{1}} = 1/\\sqrt{0,0\\overline{1}} = \\sqrt{90} = 3\\sqrt{10}; \\sqrt[-4]{(x-2)^{4}} = 1/\\left|x-2\\right| (x diverso da 2). Se dimentichi il reciproco la risposta è SBAGLIATA. RACCOGLIMENTO (errore da evitare): un fattore si raccoglie da una SOMMA solo se è presente in OGNI termine. 5/(3(x-1)) + 2/(3(x-2)) NON si può scrivere come (1/(x-1))·(5/3 + 2/(3(x-2))) — il secondo termine non contiene 1/(x-1)! Il comune denominatore è 3(x-1)(x-2): 5/(3(x-1)) + 2/(3(x-2)) = (5(x-2)+2(x-1))/(3(x-1)(x-2)) = (7x-12)/(3(x-1)(x-2)). Nell'espressioneLatex e nelle righe l'indice negativo si scrive \\sqrt[-k]{...}; MAI spostare l'indice come esponente del coefficiente che precede la radice.
4c. PRODOTTI NOTEVOLI AL DENOMINATORE: se un denominatore comune contiene due fattori coniugati (A−B)(A+B) e la trasformazione è applicabile, conserva il prodotto ancora da svolgere, fai calcolare allo studente i termini del numeratore uno per volta e inserisci alla fine un box la cui op è il prodotto dei fattori e la cui risposta nascosta è la differenza dei quadrati. Il prompt spiega soltanto il metodo, mai il risultato. La frazione finale conserva l'intero numeratore calcolato e il denominatore dopo il prodotto notevole. Se non è applicabile non aggiungere il box.
4e. RADICALI CON LETTERE E RADICALE DI QUOZIENTE: prima SCOMPONI i radicandi con i prodotti notevoli in box dedicati (a²−1 → (a−1)(a+1)) e RACCOGLI i fattori comuni dei divisori in box dedicati (3a+3 → 3(a+1)). Poi UNA TRASFORMAZIONE PER BOX: la radice di una frazione si spacca in un box dedicato (√(A/B) → √A/√B); il prodotto sotto radice in un altro (√(A·B) → √A·√B); i fattori comuni tra radice e divisore si semplificano in un box dedicato (√(a+1):(a+1) → 1/√(a+1), perché (√(a+1))² = a+1). Se resta una frazione con radice al denominatore, PRIMA di razionalizzare guarda se si semplifica da sola: quando il numeratore è il QUADRATO del radicando della radice al denominatore (es. (ab+1)/√(ab+1), perché (√(ab+1))² = ab+1) oppure contiene la radice stessa come fattore (es. (2a·√(ab+1))/√(ab+1)), aggiungi un box dedicato che SEMPLIFICA dividendo numeratore e denominatore per la stessa radice: (ab+1)/√(ab+1) → √(ab+1), (2a·√(ab+1))/√(ab+1) → 2a. Il prompt di questo box spiega solo il metodo («Divido numeratore e denominatore per la stessa radice.»), mai il risultato. RAZIONALIZZA in un ultimo box SOLO quando il numeratore non ha nessun fattore in comune con la radice al denominatore (moltiplichi numeratore e denominatore per la stessa radice: 1/√3 → √3/3). Quando la trasformazione tocca fattori che stanno in punti DIVERSI dell'espressione (una radice al numeratore e il fattore corrispondente al denominatore, la semplificazione della frazione con radice al denominatore, o la razionalizzazione che moltiplica insieme numeratore e denominatore), il box ha come op l'INTERA espressione corrente e come risposta l'espressione già trasformata: un'op staccata tipo «√(a+1):(a+1)» non si può collegare alla riga. Vale per i valori in cui le radici esistono: conserva esplicitamente i valori assoluti quando necessari; MAI decimali. Se non ci sono né radici con lettere né frazioni sotto radice, non aggiungere questi box.
5. prompt: UNA BREVE frase SOLO sul METODO, MAI sul risultato (lo studente DSA deve calcolarlo da solo).
   VIETATO mostrare o dire il risultato: niente cifre della risposta dopo «=», niente «fa/è/diventa/ottengo/ossia» + numero,
   niente «RADICE DI 6» o «radice di sei» se √6 è la risposta, niente frazioni a parole della risposta («tre quarti» se è lei).
   CONSENTITO nominare i numeri già scritti nel box («tre quarti per otto», «la radice di 9», «mcm(2,3)=6»): sono METODO.
   Esempio GIUSTO: «Moltiplico sotto un’unica radice.» Esempio SBAGLIATO: «Moltiplico sotto radice: radice di 6.»
5b. QUALITÀ DEL TESTO GUIDA (studenti DSA/BES): prima persona singolare, presente («Moltiplico…», «Cerco…»); UNA sola azione per frase, al massimo 90 caratteri;
   dai sempre il METODO, non ripetere l'operazione: MAI «Eseguo la sottrazione.», «Calcolo il valore della potenza.», «Eseguo la somma finale.» — scrivi come si fa
   (es. «Moltiplico la base per sé stessa tante volte quanto indica l'esponente.», «Cerco il numero che moltiplicato per sé stesso dà il numero sotto radice.»,
   «Con segni diversi sottraggo i numeri e metto il segno del più grande.»).
   Niente gergo non spiegato: non scrivere «in croce», «riduco ai minimi termini», «lascio invariato»; scrivi «semplifico numeratori e denominatori», «divido numeratore e denominatore per lo stesso numero».
   Un intero usato come frazione: «Scrivo l'intero come frazione con denominatore 1.» (mai «denominatore comune tra 5 e 1»).
   Decimali: «Scrivo il decimale come frazione con denominatore 10, 100… e poi semplifico.»
   Ordine delle operazioni: «Faccio prima la divisione, poi l'addizione.» (mai «dando precedenza rispetto a…»).
   Potenze: «Scrivo la base tante volte quanto indica l'esponente e moltiplico.» (MAI «per sé stessa due volte»: 3² = 3·3, la base compare DUE volte).
   Semplificazioni: non dire per quale numero dividere (lo trova lo studente): «Divido numeratore e denominatore per lo stesso numero.»
6. extraLatex solo per divisioni tra frazioni (forma capovolta); altrimenti ometti.
7. "simbolico": true in ogni box con LETTERE; ometti negli altri.
8. Titoli sezioni BREVI IN MAIUSCOLO nell'ordine dei calcoli.
9. righeProgressive: prima riga = espressioneLatex; ogni riga sostituisce SOLO l'operazione del box col suo risultato. ESATTAMENTE (box + 1) righe; l'ULTIMA = la risposta dell'ultimo box (se manca un box, aggiungilo).
10. risultatoFinaleLatex: finale ridotto al minimo.
11. Ricontrolla algebricamente ogni passaggio e il risultato per valori della lettera sia negativi sia positivi: una coincidenza in un solo valore non basta. Non dividere mai per zero. Non assumere positive le lettere. REGOLA INDISPENSABILE: la radice PARI di una potenza con lo stesso indice dà il VALORE ASSOLUTO della base; la radice DISPARI conserva invece il segno. Esempio generale: \\sqrt[4]{(x-a)^4}=\\left|x-a\\right|, NON x-a; e (\\sqrt[4]{(x-a)^4})^{-1}=1/\\left|x-a\\right|. Mantieni le barre in ogni operazione successiva, inclusi denominatore comune e risultato finale. Per somme di termini con denominatori diversi, controlla la moltiplicazione incrociata: A/U+B/V=(A·V+B·U)/(U·V), anche quando U o V contengono valori assoluti. Non perdere né cambiare coefficienti durante i prodotti. Non sommare, eliminare o trasformare il valore assoluto come se fosse il binomio, a meno di introdurre e rispettare condizioni di segno esplicite. In particolare |A|/A non è sempre 1: conserva entrambi i fattori quando il segno di A non è noto. Controlla anche valori delle lettere minori e maggiori di ogni costante del binomio. Un indice negativo indica il reciproco della corrispondente radice positiva: \\sqrt[-n]{A}=1/\\sqrt[n]{A}, per A nel dominio e diverso da zero. Per n pari e una base che può essere negativa resta obbligatorio il valore assoluto.
12. NON creare box o sezioni di CONDIZIONI DI ESISTENZA: quando l'espressione è fratta (lettere al denominatore) il motore aggiunge da solo la sezione C.E. in testa, con i valori vietati; se la aggiungi tu l'esercizio viene boccato.
13. TEMPO LIMITATO: rispondi subito al primo colpo, JSON completo e corretto senza ripensamenti lunghi.

${ESEMPIO_MINI}

ESPRESSIONE DA SVOLGERE:
${espressione}${ancore}${correzione}`;
}

/* (26/10-fix2) Con il formato JSON forzato il gateway a volte risponde con
   escape DOPPIO («\\\\sqrt» nel testo JSON → stringa finale «\\\\sqrt»):
   ogni LaTeX arriva al verificatore con i backslash raddoppiati e risulta
   «non valutabile» (causa del fallimento sistematico su radici+frazioni).
   Se nelle stringhe compare un doppio backslash seguito da lettere
   (residuo di comando LaTeX), collasso tutte le coppie «\\\\» → «\\». */
function riparaDoppioEscape(v: unknown): unknown {
  if (typeof v === "string") {
    let s = /\\\\[a-zA-Z]/.test(v) ? v.replace(/\\\\/g, "\\") : v;
    /* (26/10-fix3) CAUSA PRINCIPALE dei fallimenti con RADICI: l'IA scrive
       i comandi LaTeX con backslash singolo nel testo JSON, e i comandi
       che iniziano con lettera-escape JSON vengono DIVORATI dal parser:
       «\\right» → \r (CR) + «ight», «\\frac» → \f (FF) + «rac»,
       «\\times» → \t (TAB) + «imes», «\\begin» → \b (BS) + «egin».
       La stringa arriva al verificatore con «…((4)/(7))ight» → lettere
       residue → «non valutabile» su TUTTE le prove. Qui rimetto a posto:
       carattere di controllo seguito da lettera → comando LaTeX originale. */
    s = s.replace(/[\x08\x09\x0C\x0D](?=[a-zA-Z])/g, (c) =>
      c === "\x08" ? "\\b" : c === "\x09" ? "\\t" : c === "\x0C" ? "\\f" : "\\r",
    );
    return s;
  }
  if (Array.isArray(v)) return v.map(riparaDoppioEscape);
  if (v != null && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      o[k] = riparaDoppioEscape(val);
    }
    return o;
  }
  return v;
}

function estraiJson(testo: string): unknown | null {
  const senzaFence = testo
    .replace(/```json/gi, "```")
    .split("```")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("{"));
  const candidati = senzaFence.length > 0 ? senzaFence : [testo];
  for (const c of candidati) {
    const inizio = c.indexOf("{");
    const fine = c.lastIndexOf("}");
    if (inizio < 0 || fine <= inizio) continue;
    const porzione = c.slice(inizio, fine + 1);
    try {
      return riparaDoppioEscape(JSON.parse(porzione));
    } catch {
      /* prova la riparazione sotto */
    }
    /* (26/10-fix) CAUSA dei fallimenti sulle espressioni con RADICI: l'IA
       scrive il LaTeX con backslash SINGOLI dentro il JSON («\sqrt»,
       «\dfrac»): «\s» non è un escape valido e JSON.parse fallisce SEMPRE,
       su tutte le prove (l'utente vede «nessuna risposta valida» anche se
       la risposta era giusta). Raddoppio i backslash non validi
       (\s → \\s) lasciando stare quelli legittimi (\\n, \\t, \\u…)
       e riprovo il parse. */
    try {
      return riparaDoppioEscape(JSON.parse(porzione.replace(/\\(?![\\/"bfnrtu])/g, "\\\\")));
    } catch {
      /* prova la riparazione del troncamento */
    }
    /* (08/11, cutoff del gateway) il taglio A METÀ della risposta è la
       prima causa di fallimento sulle espressioni lunghe (es. radicali:
       «L'IA non restituisce risposte valide» su tutte e 6 le prove). Se il
       JSON è solo TRONCATO (stringhe/array aperti), salvo il prefisso
       completo chiudendo le strutture aperte: i box completi sopravvivono,
       i mancanti li ricalcola il motore (riparaEsercizio). */
    try {
      const guarito = riparaJsonTroncato(porzione);
      if (guarito != null) return riparaDoppioEscape(guarito);
    } catch {
      /* prova il prossimo candidato */
    }
  }
  return null;
}

/** Chiude stringhe, array e oggetti rimasti aperti da un taglio a metà e
 *  restituisce il prefisso COMPLETO del JSON (null se non salvabile). Il
 *  taglio avviene solo su STRUTTURE chiuse (fine oggetto/array/numero):
 *  una stringa completa potrebbe essere una chiave pendente. Gli oggetti
 *  parziali senza «op» vengono scartati più avanti da riparaEsercizio. */
export function riparaJsonTroncato(testo: string): unknown | null {
  let inStringa = false;
  let escape = false;
  const pila: string[] = [];
  let taglio = -1;
  let pilaAlTaglio: string[] = [];
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (inStringa) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inStringa = false;
      continue;
    }
    if (c === '"') {
      inStringa = true;
    } else if (c === "{" || c === "[") {
      pila.push(c);
    } else if (c === "}" || c === "]") {
      pila.pop();
      taglio = i;
      pilaAlTaglio = [...pila];
    } else if (/\d/.test(c) && !/[\d.]/.test(testo[i + 1] ?? "")) {
      /* fine di un numero completo: è sempre un VALORE, mai una chiave */
      taglio = i;
      pilaAlTaglio = [...pila];
    }
  }
  if (taglio < 0) return null;
  let prefisso = testo.slice(0, taglio + 1);
  /* niente virgole pendenti prima delle chiusure */
  prefisso = prefisso.replace(/,\s*$/, "");
  for (let i = pilaAlTaglio.length - 1; i >= 0; i--) {
    prefisso += pilaAlTaglio[i] === "{" ? "}" : "]";
  }
  try {
    return JSON.parse(prefisso);
  } catch {
    return null;
  }
}

/* (26/10-fix) ESEMPIO breve dentro il prompt: senza un modello di risposta
   l'IA sbaglia il formato e brucia tentativi interi in rigenerazioni.
   Le REGOLE 9 e 10 sono le più violate: l'esempio le mostra in azione
   (stile anti-troncamento: il cutoff del gateway è la prima causa di
   fallimento sulle espressioni lunghe). */
const ESEMPIO_MINI =
  'ESEMPIO (stesso formato da usare, espressione corta):\n' +
  'ESPRESSIONE: (1/2+1/3):(1/4)\n' +
  // JSON.stringify mantiene gli escape LaTeX validi anche per il modello.
  JSON.stringify({
    espressioneLatex: "\\left(\\dfrac{1}{2}+\\dfrac{1}{3}\\right):\\dfrac{1}{4}",
    sezioni: [{ title: "CALCOLI", boxes: [
      { op: "\\dfrac{1}{2}+\\dfrac{1}{3}", prompt: "Porto le frazioni allo stesso denominatore.", answerLatex: "\\dfrac{5}{6}" },
      { op: "\\dfrac{5}{6}:\\dfrac{1}{4}", prompt: "Moltiplico per la seconda frazione capovolta.", answerLatex: "\\dfrac{10}{3}" },
    ] }],
    righeProgressive: ["\\left(\\dfrac{1}{2}+\\dfrac{1}{3}\\right):\\dfrac{1}{4}", "\\dfrac{5}{6}:\\dfrac{1}{4}", "\\dfrac{10}{3}"],
    risultatoFinaleLatex: "\\dfrac{10}{3}",
  });

/* (26/10) MESSAGGI SEMPRE IN ITALIANO: gli errori del gateway arrivano in
   inglese («The operation was aborted due to timeout») e non devono MAI
   finire così, invariati, sullo schermo dello studente. */
function messaggioItaliano(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/429|limit of allowed words|quota|rate ?limit/i.test(msg))
    return "L'intelligenza artificiale ha esaurito il limite di parole del piano: riprova più tardi, quando il limite si azzera.";
  if (/aborted due to timeout|timed?[ -]?out|timeout/i.test(msg))
    return "L'intelligenza artificiale ha messo troppo tempo a rispondere (timeout). Riprova: di solito al secondo tentativo va più veloce.";
  if (/fetch failed|network|ECONNRESET|ENOTFOUND|ECONNREFUSED|socket hang up/i.test(msg))
    return "Problema di rete nel contattare l'intelligenza artificiale. Controlla la connessione e riprova tra qualche minuto.";
  if (/503|504|overloaded|unavailable/i.test(msg))
    return "Il servizio dell'intelligenza artificiale è momentaneamente sovraccarico. Riprova tra qualche minuto.";
  return msg;
}

/* ─── Chiamata IA robusta ───────────────────────────────────────────── *
 * Il gateway dell'IA a volte risponde con 504/timeout (il modello è lento
 * a generare il JSON completo): gli errori di trasporto si RIPROVANO, con
 * pausa crescente. Il 429 (limite di parole del piano) invece non passa
 * restando in attesa: fallisce subito con un messaggio comprensibile. */
async function chiamaIA(prompt: string, modello: "gpt-4.1-mini" | "gpt-4.1" = "gpt-4.1-mini"): Promise<string> {
  let ultimoErrore: unknown = null;
  for (let prova = 1; prova <= 3; prova++) {
    try {
      /* (26/10, velocità): il gateway risponde o taglia (504) entro ~100 s:
         fallire in fretta e riprovare batte aspettare (100 s).
         (26/10-fix) JSON corto e veloce: formato JSON forzato quando
         supportato. (10/11-fix) il JSON arrivava TAGLIATO a ~330 caratteri
         («L'IA non restituisce risposte valide»): gemini-3-flash brucia il
         budget di token nel RAGIONAMENTO INTERNO e reasoning_effort non lo
         spegne (sonda: anche a 16000 token il JSON resta tronco). Per la
         sola costruzione uso gpt-4.1-mini, modello senza thinking, che sul
         prompt reale risponde con il JSON completo in ~20 s (verificato
         con la sonda; la qualità resta garantita dal verificatore e dalle
         riprove con i problemi elencati). Budget a 8000: l'espressione con
         radicali letterali produce ~8700 caratteri di JSON. */
      return await chatCompletion(prompt, 0, 100_000, {
        maxTokens: 8000,
        jsonMode: true,
        model: modello,
      });
    } catch (err) {
      ultimoErrore = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/429|limit of allowed words/i.test(msg)) {
        throw new Error(messaggioItaliano(err));
      }
      /* (26/10, velocità): pausa tra le riprove ridotta a 2 s × prova */
      await new Promise((r) => setTimeout(r, 2_000 * prova));
    }
  }
  /* (26/10) l'errore che arriva allo studente è SEMPRE in italiano */
  throw ultimoErrore != null
    ? new Error(messaggioItaliano(ultimoErrore))
    : new Error("L'intelligenza artificiale non è raggiungibile. Riprova tra qualche minuto.");
}

/* ─── Pipeline completa (max 3 tentativi) ───────────────────────────── */

export async function costruisciEsercizioConIA(
  espressione: string,
  suTentativo?: (tentativo: number) => void,
): Promise<{ esercizio: EsercizioAI; tentativi: number; avvertenze: string[] }> {
  let problemi: string[] = [];
  /* (26/10-diagnostica) ultima risposta IA: se la costruzione fallisce,
     il job conserva le op/answer RICEVUTE così si vede esattamente quale
     forma l'IA ha prodotto (necessario per replicare i rifiuti tra
     ambienti diversi). */
  let ultimoRaw: unknown = null;
  /* Conserva il tentativo respinto per permettere all'IA di correggere il
     punto indicato dal verificatore, anziché ricominciare alla cieca. */
  let precedente: string | null = null;
  // Una correzione algebrica verificata viene inviata solo al modello al
  // tentativo seguente; non compare nel messaggio o nel percorso studente.
  let indicazioniIA: string[] = [];
  const ancoreNumeriche = [
    ...indicazioniRadiciNegativeNumeriche(espressione),
    ...indicazioniPeriodiciDaSorgente(espressione),
  ];
  /* (26/10-Opzione A) le regole che bocciavano l'esercizio sono TOLTE:
     i conti li rifà il motore locale (riparaEsercizio). Tre tentativi (10/11: l'IA a volte sbaglia una forma su catene lunghe)
     bastano — servono solo se l'IA non restituisce struttura utile. */
  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    suTentativo?.(tentativo);
    const prompt = costruisciPrompt(espressione, precedente, [...problemi, ...indicazioniIA], ancoreNumeriche);
    /* la costruzione gira in BACKGROUND (job + polling): può permettersi
       4 minuti per chiamata, con riprove sui 504 e sulle risposte senza
       JSON (a volte il modello risponde con testo vuoto o ragionamenti). */
    let raw: unknown = null;
    for (let prova = 1; prova <= 3; prova++) {
      // Se il primo modello non produce passi verificabili, i tentativi
      // successivi usano un modello più capace; il verificatore resta identico.
      const risposta = await chiamaIA(prompt, tentativo === 1 ? "gpt-4.1-mini" : "gpt-4.1");
      console.log(`[costruisci] risposta grezza (tentativo ${tentativo}, prova ${prova}): ${risposta.length} caratteri; FINE: …${risposta.slice(-70)}`);
      raw = estraiJson(risposta);
      if (raw != null) break;
      /* (26/10-diagnostica) la risposta senza JSON finisce nel log del
         server: senza questo è impossibile capire perché la costruzione
         fallisce (l'utente vede solo il messaggio generico) */
      const r = String(risposta);
      console.error(
        "[costruisci] risposta SENZA JSON (tentativo %d, prova %d) lunghezza %d:",
        tentativo,
        prova,
        r.length,
      );
      console.error("[costruisci] INIZIO:", r.slice(0, 200));
      console.error("[costruisci] FINE:", r.slice(-300));
      const i = r.indexOf("{");
      const f = r.lastIndexOf("}");
      try {
        JSON.parse(r.slice(i, f + 1));
      } catch (e) {
        console.error("[costruisci] ERRORE JSON.parse:", e instanceof Error ? e.message : e);
      }
      /* (26/10, velocità): pausa ridotta (1,5 s × prova) */
      await new Promise((r) => setTimeout(r, 1500 * prova));
    }
    if (raw == null) {
      throw new Error(
        "L'IA non restituisce risposte valide. Riprova tra qualche minuto.",
      );
    }
    // L'IA talvolta colloca fuori dalla barretta cifre GIÀ PRESENTI nella
    // sorgente, producendo un numero illeggibile. Ripristiniamo solo il caso
    // non ambiguo usando la trascrizione confermata; l'ordinaria verifica
    // di ogni box, del risultato e della fedeltà rimane obbligatoria.
    raw = ripristinaPeriodiciCandidato(espressione, raw);
    ultimoRaw = raw;
    const esito = riparaEsercizio(raw);
    if (esito.esercizio && !trascrizioneFedele(espressione, esito.esercizio.espressioneLatex)) {
      esito.problemi.push("l'espressione restituita non riproduce fedelmente quella scritta dallo studente");
      esito.esercizio = null;
    }
    if (esito.esercizio) {
      if (esito.avvertenze.length) {
        console.log("[costruisci] avvertenze:", esito.avvertenze.slice(0, 8));
      }
      return { esercizio: esito.esercizio, tentativi: tentativo, avvertenze: esito.avvertenze };
    }
    const prefisso = recuperaPrefissoFinaleVerificato(espressione, raw);
    if (prefisso) {
      console.log("[costruisci] recuperata una catena completa e verificata prima della semplificazione finale errata");
      return { esercizio: prefisso.esercizio, tentativi: tentativo, avvertenze: prefisso.avvertenze };
    }
    problemi = esito.problemi;
    indicazioniIA = indicazioniFrazioniSbagliate(raw);
    try { precedente = JSON.stringify(raw).slice(0, 24000); } catch { precedente = null; }
    /* (26/10-diagnostica) senza questo log è impossibile capire perché
       la struttura non è utilizzabile */
    console.error("[costruisci] struttura non utilizzabile (tentativo %d):", tentativo, problemi);
    const lxRic = (raw as { espressioneLatex?: string })?.espressioneLatex ?? "";
    console.error("[costruisci] espressioneLatex ricevuto:", JSON.stringify(lxRic));
    /* (08/11-diagnostica letterale) i box RICEVUTI con l'esito del verificatore:
       senza il contenuto è impossibile capire QUALE forma l'IA ha prodotto e
       perché il motore la rifiuta (radicali con lettere, prodotti notevoli…). */
    try {
      const boxDiag = (raw as { sezioni?: { boxes?: { op?: unknown; answerLatex?: unknown }[] }[] } | null);
      const lista = (boxDiag && Array.isArray(boxDiag.sezioni) ? boxDiag.sezioni : [])
        .flatMap((s) => (Array.isArray(s?.boxes) ? s.boxes : []))
        .map((b, i) => {
          const esito = contoGiusto(b?.op, b?.answerLatex);
          return `  box ${i + 1}: ${JSON.stringify(String(b?.op ?? ""))} → ${JSON.stringify(String(b?.answerLatex ?? ""))} [${esito.via}]`;
        });
      const finaleDiag = (raw as { risultatoFinaleLatex?: unknown })?.risultatoFinaleLatex;
      if (typeof finaleDiag === "string" && finaleDiag.trim()) {
        const esF = contoGiusto(lxRic, finaleDiag);
        lista.push(`  finale: ${JSON.stringify(finaleDiag)} [${esF.via}]`);
      }
      console.error("[costruisci] box ricevuti:\n%s", lista.join("\n"));
    } catch {
      /* solo diagnostica: mai bloccare */
    }
  }
  /* (26/10-fix) Lo studente NON deve vedere l'elenco tecnico dei
     problemi di verifica (messaggio rosso lunghissimo e incomprensibile,
     segnalato dall'utente): lo vedono solo i log del server. Per lui una
     frase corta e chiara. */
  console.error("[costruisci] esercizio non costruito dopo 3 tentativi. Problemi:", problemi.slice(0, 8));
  /* (26/10-diagnostica-remota) i problemi viaggiano con l'errore fino al
     job (campo debug): lo studente vede solo il messaggio corto. */
  const errore = new Error(
    "L'IA non ha prodotto una struttura utilizzabile per l'esercizio. Riprova tra qualche minuto.",
  ) as Error & { problemi: string[]; rispostaIA?: unknown };
  errore.problemi = problemi.slice(0, 8);
  /* op/answer RICEVUTI (max 6): diagnosi remota senza chiedere all'utente */
  try {
    const u = ultimoRaw as { sezioni?: { boxes?: { op?: unknown; answerLatex?: unknown }[] }[] } | null;
    if (u && Array.isArray(u.sezioni)) {
      errore.rispostaIA = u.sezioni
        .flatMap((s) => (Array.isArray(s?.boxes) ? s.boxes : []))
        .slice(0, 6)
        .map((b) => ({ op: String(b?.op ?? ""), answer: String(b?.answerLatex ?? "") }));
    }
  } catch {
    /* solo diagnostica: mai bloccare */
  }
  throw errore;
}

/* ─── Archivio dell'esercizio ATTIVO (database o file) ──────────────── */

// In produzione conserva gli stessi file storici in /tmp. Nei collaudi
// isolati è possibile scegliere una cartella dedicata senza toccare
// sessioni, cache o esercizi già presenti dell'utente.
const cartellaArchivio = (process.env.WIDGET_STORAGE_DIR || "/tmp").replace(/\/$/, "");
const fileArchivio = (nome: string): string => `${cartellaArchivio}/${nome}`;
const FILE_ATTIVO = fileArchivio("esercizio-attivo.json");

function dbSql() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) return null;
  try {
    return neon(url);
  } catch {
    return null;
  }
}

/** Anche sessioni e cache precedenti vengono controllate IN MEMORIA prima
 * di mostrarle. Nessuna riga conservata nel database viene modificata o
 * cancellata dalla verifica. I conti recuperabili sono riparati; un esercizio
 * non verificabile non viene spacciato per corretto. */
export function validoPerArchivio(dati: unknown): EsercizioAI | null {
  return riparaEsercizio(dati).esercizio;
}

export async function salvaEsercizioAttivo(esercizio: EsercizioAI, espressione: string): Promise<"db" | "file"> {
  const sql = dbSql();
  if (sql) {
    try {
      await sql`CREATE TABLE IF NOT EXISTS esercizio_attivo (id integer PRIMARY KEY DEFAULT 1, dati jsonb NOT NULL, espressione text, aggiornato timestamptz DEFAULT now())`;
      await sql`INSERT INTO esercizio_attivo (id, dati, espressione) VALUES (1, ${JSON.stringify(esercizio)}::jsonb, ${espressione}) ON CONFLICT (id) DO UPDATE SET dati = EXCLUDED.dati, espressione = EXCLUDED.espressione, aggiornato = now()`;
      return "db";
    } catch {
      /* database non raggiungibile: fallback su file */
    }
  }
  const { writeFileSync } = await import("node:fs");
  writeFileSync(FILE_ATTIVO, JSON.stringify({ esercizio, espressione }), "utf8");
  return "file";
}

export async function leggiEsercizioAttivo(): Promise<{ esercizio: EsercizioAI | null; archivio: "db" | "file" | null }> {
  const sql = dbSql();
  if (sql) {
    try {
      const righe = (await sql`SELECT dati FROM esercizio_attivo WHERE id = 1 LIMIT 1`) as { dati: unknown }[];
      if (righe && righe.length > 0) {
        const esercizio = validoPerArchivio(righe[0].dati);
        if (esercizio) return { esercizio, archivio: "db" };
      }
    } catch {
      /* niente tabella o database non raggiungibile: fallback su file */
    }
  }
  try {
    const { readFileSync } = await import("node:fs");
    const grezzo = JSON.parse(readFileSync(FILE_ATTIVO, "utf8")) as { esercizio: unknown };
    const esercizio = validoPerArchivio(grezzo.esercizio);
    if (esercizio) return { esercizio, archivio: "file" };
  } catch {
    /* nessun file: nessun esercizio attivo */
  }
  return { esercizio: null, archivio: null };
}

export async function cancellaEsercizioAttivo(): Promise<void> {
  const sql = dbSql();
  if (sql) {
    try {
      await sql`DELETE FROM esercizio_attivo WHERE id = 1`;
    } catch {
      /* ignora */
    }
  }
  try {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(FILE_ATTIVO);
  } catch {
    /* il file non esiste: ok */
  }
}

/* ─── CACHE delle espressioni già costruite (26/10, velocità) ───────── *
 * In classe la STESSA espressione viene ricostruita da ogni studente: la
 * prima costruzione (lenta, via IA) si conserva e le successive riescono
 * IMMEDIATE (secondi, senza chiamare l'IA). Chiave = espressione
 * normalizzata (spazi e simboli equivalenti unificati). Vale su database
 * (tabella cache_costruzioni) o, senza database, su file /tmp. */

function chiaveCache(espressione: string): string {
  try {
    const ast = parseExpression(normalizeInput(espressione));
    return JSON.stringify(ast);
  } catch {
    return espressione.replace(/\s+/g, "").replace(/\u2044|⁄/g, "/").replace(/·|×/g, "*").replace(/÷/g, ":");
  }
}

async function leggiCache(chiave: string): Promise<EsercizioAI | null> {
  const sql = dbSql();
  if (sql) {
    try {
      const righe = (await sql`SELECT dati FROM cache_costruzioni WHERE chiave = ${chiave} LIMIT 1`) as { dati: unknown }[];
      if (righe?.length) {
        const esercizio = validoPerArchivio(righe[0].dati);
        if (esercizio) {
          await sql`UPDATE cache_costruzioni SET usi = usi + 1, aggiornato = now() WHERE chiave = ${chiave}`;
          return esercizio;
        }
      }
    } catch {
      /* tabella assente o db non raggiungibile: si ricrea sotto */
    }
  }
  try {
    const { readFileSync } = await import("node:fs");
    const mappa = JSON.parse(readFileSync(fileArchivio("cache-costruzioni.json"), "utf8")) as Record<string, unknown>;
    return validoPerArchivio(mappa[chiave]);
  } catch {
    return null;
  }
}

async function scriviCache(chiave: string, esercizio: EsercizioAI): Promise<void> {
  const sql = dbSql();
  if (sql) {
    try {
      await sql`CREATE TABLE IF NOT EXISTS cache_costruzioni (chiave text PRIMARY KEY, dati jsonb NOT NULL, usi integer DEFAULT 1, aggiornato timestamptz DEFAULT now())`;
      await sql`INSERT INTO cache_costruzioni (chiave, dati) VALUES (${chiave}, ${JSON.stringify(esercizio)}::jsonb) ON CONFLICT (chiave) DO UPDATE SET dati = EXCLUDED.dati, usi = cache_costruzioni.usi + 1, aggiornato = now()`;
      // Non eliminare automaticamente record dal database condiviso.
      return;
    } catch {
      /* fallback su file */
    }
  }
  try {
    const { readFileSync, writeFileSync } = await import("node:fs");
    let mappa: Record<string, unknown> = {};
    try {
      mappa = JSON.parse(readFileSync(fileArchivio("cache-costruzioni.json"), "utf8")) as Record<string, unknown>;
    } catch {
      /* parte vuota */
    }
    mappa[chiave] = esercizio;
    const chiavi = Object.keys(mappa);
    if (chiavi.length > 200) {
      for (const k of chiavi.slice(0, chiavi.length - 200)) delete mappa[k];
    }
    writeFileSync(fileArchivio("cache-costruzioni.json"), JSON.stringify(mappa), "utf8");
  } catch {
    /* cache non disponibile: la costruzione resta comunque valida */
  }
}

/* ─── Route con JOB + POLLING ───────────────────────────────────────── *
 * La costruzione IA può durare più di un minuto (e con i tentativi di
 * correzione anche di più): troppo per un'unica richiesta HTTP, che il
 * gateway interromperebbe. POST avvia il lavoro e risponde SUBITO con un
 * jobId; il client interroga GET ?id=... ogni 3 secondi e la linea di
 * progresso mostra il tentativo reale dell'IA. Se l'espressione è già in
 * CACHE, il job nasce già «fatto»: risposta in secondi. I job vivono in
 * memoria (con copia di cortesia su file /tmp): su un servizio con
 * traffico di un solo utente le richieste restano sulla stessa istanza. */

interface JobCostruzione {
  stato: "lavoro" | "fatto" | "errore";
  tentativo: number;
  esercizio?: EsercizioAI;
  avvertenze?: string[];
  error?: string;
  /* (26/10-diagnostica-remota) espressione canonica + problemi di verifica:
     lo studente NON li vede (vede solo `error`), il docente ASSÌ li può
     leggere nel JSON del job per replicare il caso esatto. */
  debug?: { espressione?: string; problemi?: string[] };
}

const jobs = new Map<string, JobCostruzione>();

async function salvaStatoJob(id: string, job: JobCostruzione): Promise<void> {
  jobs.set(id, job);
  try {
    const { writeFileSync } = (await import("node:fs")) as typeof import("node:fs");
    writeFileSync(fileArchivio(`esercizio-job-${id}.json`), JSON.stringify(job), "utf8");
  } catch {
    /* la copia su file è di cortesia: non blocca mai */
  }
}

async function leggiStatoJob(id: string): Promise<JobCostruzione | null> {
  const inMemoria = jobs.get(id);
  if (inMemoria) return inMemoria;
  try {
    const { readFileSync } = (await import("node:fs")) as typeof import("node:fs");
    return JSON.parse(readFileSync(fileArchivio(`esercizio-job-${id}.json`), "utf8")) as JobCostruzione;
  } catch {
    return null;
  }
}

/** Preserva esponenti Unicode interi (es. ¹⁰ e ⁻²) anche nella route IA.
 *  (10/11) MA l'apice IMMEDIATAMENTE prima di √ è l'INDICE della radice,
 *  anche negativo (⁻³√, ⁵√): NON va convertito in potenza — altrimenti
 *  «0,3per⁻³√(ab^-1)» diventava «0,\overline{3}^-3√(ab^-1)» e l'IA,
 *  la verifica di fedeltà e i conti cascadevano su una lettura sbagliata. */
export function canonizzaEspressione(s: string): string {
  const sup = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return s
    .replace(/¼/g, "(1/4)").replace(/½/g, "(1/2)").replace(/¾/g, "(3/4)")
    .replace(/⅓/g, "(1/3)").replace(/⅔/g, "(2/3)")
    .replace(/⅙/g, "(1/6)").replace(/⅚/g, "(5/6)")
    .replace(/⅛/g, "(1/8)").replace(/⅜/g, "(3/8)")
    .replace(/⅝/g, "(5/8)").replace(/⅞/g, "(7/8)")
    .replace(new RegExp("(?!⁻?[" + sup + "]+\\s*√)⁻?[" + sup + "]+", "g"), (seq) => "^" + [...seq].map((c) => c === "⁻" ? "-" : String(sup.indexOf(c))).join(""))
    .replace(/[−–—]/g, "-")
    .replace(/[×⋅•∗]/g, "·")
    .replace(/÷/g, ":")
    /* (12/11, richiesta utente) DECIMALI SEMPRE CON LA VIRGOLA: il punto
     * decimale (dall'IA della trascrizione o dall'utente) diventa virgola.
     * La notazione dell'app non usa mai cifra.cifra per altro scopo. */
    .replace(/(\d)\.(\d)/g, "$1,$2");
}

export function registerEsercizioRoutes(app: Express): void {

  /* POST /api/ai/costruisci-esercizio — body { espressione } → { jobId }.
     Avvia la costruzione verificata e risponde subito. */
  app.post("/api/ai/costruisci-esercizio", express.json({ limit: "1mb" }), async (req, res) => {
    const espressione = canonizzaEspressione(String(req.body?.espressione ?? "").trim());
    console.log("[costruisci] input canonico:", JSON.stringify(espressione));
    if (!espressione) {
      res.status(400).json({ error: "Espressione mancante: scrivi prima l'espressione sulla pagina." });
      return;
    }
    if (espressione.includes("?")) {
      res.status(400).json({ error: "La trascrizione contiene un punto incerto (?): confrontala con la foto e correggilo prima di continuare." });
      return;
    }
    // Percorsi deterministici circoscritti: prima i coniugati già approvati,
    // poi somme/differenze di due fratte con eventuali fattori esterni. Ogni
    // candidato è comunque verificato esattamente e confrontato con la traccia;
    // se non è sicuro si passa al percorso IA esistente senza alterare la cache.
    /* (09/11, «cambiamento radicale») costruttori DETERMINISTICI per le
       tipologie su cui l'IA falliva sempre: radici n-esime a indice unico,
       radicali con lettere, catene con decimali periodici. Ogni candidato
       è comunque RIVERIFICATO da riparaEsercizio + trascrizioneFedele. */
    const candidatoGuidato = costruisciPerfettiSottoRadice(espressione) ??
      costruisciFrazioniConiugate(espressione) ??
      costruisciSommaFrazioniLetterali(espressione) ??
      costruisciRadiciNesime(espressione) ??
      costruisciRadicaliLetterali(espressione) ??
      costruisciCatenaEsatta(espressione) ??
      /* (09/11, foto «radicali fratte») due radicali ad INDICI DIVERSI:
         riduzione allo stesso indice (m.c.m.), radice unica, scomposizione */
      costruisciIndiceComune(espressione);
    if (candidatoGuidato) {
      const verificato = riparaEsercizio(candidatoGuidato);
      if (verificato.esercizio && trascrizioneFedele(espressione, verificato.esercizio.espressioneLatex)) {
        const id = randomUUID();
        await salvaStatoJob(id, { stato: "fatto", tentativo: 1, esercizio: verificato.esercizio, avvertenze: verificato.avvertenze });
        res.json({ jobId: id });
        return;
      }
    }
    /* (26/10, velocità): prima la CACHE — espressione già vista = risposta
       immediata, senza disturbare l'IA */
    const chiave = chiaveCache(espressione);
    try {
      const inCache = await leggiCache(chiave);
      if (inCache && trascrizioneFedele(espressione, inCache.espressioneLatex)) {
        /* (27/10) gli esercizi GIÀ in cache hanno i testi guida vecchi:
           li rifinisco al volo (stesse regole di una costruzione nuova) */
        for (const sez of inCache.sezioni) {
          for (const bx of sez.boxes) if (bx.prompt) bx.prompt = rifinisciFrase(bx.prompt);
        }
        /* La cache viene sempre verificata di nuovo in memoria secondo le
           regole correnti, senza cancellare né alterare gli archivi. */
        const riparatoCache = riparaEsercizio(inCache);
        // Una vecchia cache non verificabile non deve mai essere mostrata
        // come corretta: si riparte dalla costruzione, senza alterare i dati.
        if (riparatoCache.esercizio) {
          const id = randomUUID();
          await salvaStatoJob(id, { stato: "fatto", tentativo: 1, esercizio: riparatoCache.esercizio, avvertenze: riparatoCache.avvertenze });
          res.json({ jobId: id });
          return;
        }
      }
    } catch {
      /* cache illeggibile: si costruisce normalmente */
    }
    const id = randomUUID();
    await salvaStatoJob(id, { stato: "lavoro", tentativo: 1 });
    void (async () => {
      try {
        const { esercizio, tentativi, avvertenze } = await costruisciEsercizioConIA(espressione, (t) => {
          void salvaStatoJob(id, { stato: "lavoro", tentativo: t });
        });
        /* la costruzione riuscita entra in cache per i prossimi studenti */
        await scriviCache(chiave, esercizio);
        await salvaStatoJob(id, { stato: "fatto", tentativo: tentativi, esercizio, avvertenze });
      } catch (err) {
        /* (26/10-diagnostica-remota) lo studente non vede i dettagli, ma
           il DOCENTE sì: il job conserva l'espressione canonica inviata
           e i problemi di verifica, così l'assistenza può replicare il
           caso esatto senza chiedere all'utente di copiare testi. */
        const debug =
          err instanceof Error && /tutti i conti esatti/.test(err.message)
            ? {
                espressione,
                problemi: (err as Error & { problemi?: string[] }).problemi ?? [],
                rispostaIA: (err as Error & { rispostaIA?: unknown }).rispostaIA,
              }
            : undefined;
        await salvaStatoJob(id, {
          stato: "errore",
          tentativo: 3,
          /* (26/10) messaggio SEMPRE in italiano per lo studente */
          error: messaggioItaliano(err),
          ...(debug ? { debug } : {}),
        });
      }
    })();
    res.json({ jobId: id });
  });

  /* GET /api/ai/costruisci-esercizio?id=... → stato del job. */
  app.get("/api/ai/costruisci-esercizio", async (req, res) => {
    const id = String(req.query.id ?? "");
    const job = await leggiStatoJob(id);
    if (!job) {
      res.json({ stato: "sconosciuto" });
      return;
    }
    res.json(job);
  });

  /* GET /api/esercizio/sessione/:sid — esercizio della SESSIONE (26/10-fix
     PDF dinamico). Ogni costruzione crea una sessione (id + esercizio +
     espressione + momento): la terza pagina la carica con il sid
     nell'URL, così ogni studente svolge e stampa la SUA espressione.
     Le sessioni vivono su database (tabella sessioni_costruzioni) o su
     file /tmp. Le sessioni salvate nel database condiviso non vengono
     eliminate automaticamente. */
  app.get("/api/esercizio/sessione/:sid", async (req, res) => {
    const sid = String(req.params.sid ?? "").trim();
    if (!sid) {
      res.status(400).json({ error: "Sessione mancante." });
      return;
    }
    const sql = dbSql();
    if (sql) {
      try {
        const righe = (await sql`SELECT dati FROM sessioni_costruzioni WHERE sid = ${sid} LIMIT 1`) as { dati: unknown }[];
        if (righe?.length) {
          const esercizio = validoPerArchivio(righe[0].dati);
          if (esercizio) {
            res.json({ esercizio, archivio: "db" });
            return;
          }
        }
      } catch {
        /* tabella assente: fallback su file */
      }
    }
    try {
      const { readFileSync } = await import("node:fs");
      const grezzo = JSON.parse(readFileSync(fileArchivio(`esercizio-sessione-${sid}.json`), "utf8")) as { esercizio: unknown };
      const esercizio = validoPerArchivio(grezzo.esercizio);
      if (esercizio) {
        res.json({ esercizio, archivio: "file" });
        return;
      }
    } catch {
      /* nessuna sessione con questo sid */
    }
    res.status(404).json({ error: "Svolgimento non trovato: la sessione è scaduta o inesistente. Torna alla pagina di trascrizione e ricostruisci l'esercizio." });
  });

  /* POST /api/esercizio/attivo — salva l'esercizio costruito (o { reset: true }
     per tornare all'esercizio originale incluso nell'app). Crea anche la
     SESSIONE (sid) che la terza pagina usa per caricare e stampare
     l'esercizio di QUELLO studente (PDF dinamico 26/10). */
  app.post("/api/esercizio/attivo", express.json({ limit: "2mb" }), async (req, res) => {
    try {
      if (req.body?.reset) {
        await cancellaEsercizioAttivo();
        res.json({ ok: true, archivio: null });
        return;
      }
      const esercizio = validoPerArchivio(req.body?.esercizio);
      if (!esercizio) {
        res.status(400).json({ error: "Esercizio non valido: i conti non passano la verifica." });
        return;
      }
      const originale = String(req.body?.espressione ?? "").trim();
      if (originale && !trascrizioneFedele(originale, esercizio.espressioneLatex)) {
        res.status(400).json({ error: "La trascrizione non corrisponde all'espressione: riprova la costruzione." });
        return;
      }
      const archivio = await salvaEsercizioAttivo(esercizio, originale);
      /* (26/10-fix PDF dinamico) la sessione personale dello studente */
      const sid = randomUUID();
      const sql = dbSql();
      if (sql) {
        try {
          await sql`CREATE TABLE IF NOT EXISTS sessioni_costruzioni (sid text PRIMARY KEY, dati jsonb NOT NULL, espressione text, creato timestamptz DEFAULT now())`;
          await sql`INSERT INTO sessioni_costruzioni (sid, dati, espressione) VALUES (${sid}, ${JSON.stringify(esercizio)}::jsonb, ${String(req.body?.espressione ?? "")})`;
          // Non cancellare sessioni esistenti dal database condiviso.
        } catch {
          /* database non raggiungibile: sessione su file */
          try {
            const { writeFileSync } = await import("node:fs");
            writeFileSync(fileArchivio(`esercizio-sessione-${sid}.json`), JSON.stringify({ esercizio }), "utf8");
          } catch {
            /* sessione non salvabile: resta l'esercizio attivo */
          }
        }
      } else {
        try {
          const { writeFileSync } = await import("node:fs");
          writeFileSync(fileArchivio(`esercizio-sessione-${sid}.json`), JSON.stringify({ esercizio }), "utf8");
        } catch {
          /* sessione non salvabile: resta l'esercizio attivo */
        }
      }
      res.json({ ok: true, archivio, sid });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Salvataggio fallito." });
    }
  });

  /* GET /api/esercizio/attivo — l'esercizio attivo (o null: l'app usa
     quello incluso). La pagina dello studente lo carica all'avvio. */
  app.get("/api/esercizio/attivo", async (_req, res) => {
    try {
      res.json(await leggiEsercizioAttivo());
    } catch {
      res.json({ esercizio: null, archivio: null });
    }
  });
}
