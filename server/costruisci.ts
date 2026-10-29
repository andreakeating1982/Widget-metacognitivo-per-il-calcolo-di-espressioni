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
import {
  latexValue,
  latexToPlainMath,
  parsePolyLoose,
  polyEquals,
  buildVerificationValues,
  substituteAndEvaluate,
  parseExpression,
  normalizeInput,
  polyToLatex,
  fractionResultLatex,
  type Term,
} from "../client/src/lib/espressioni";
import { evalRat } from "../client/src/lib/fratte";
import { ripulisciPrompt } from "../client/src/lib/promptSicuri";

/* ─── Forme dell'esercizio ──────────────────────────────────────────── */

export interface BoxAI {
  op: string; // LaTeX dell'operazione (un solo calcolo elementare)
  prompt?: string; // frase didattica sul METODO (mai il risultato)
  extraLatex?: string; // es. la divisione capovolta
  answerLatex: string; // risultato ridotto (frazione impilata, intero o forma con lettere)
  simbolico?: boolean; // true = il box contiene LETTERE: confronto simbolico, non numerico
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

function valore(latex: unknown): number | null {
  if (typeof latex !== "string" || !latex.trim()) return null;
  try {
    return latexValue(conPuntoDecimale(latex));
  } catch {
    return null;
  }
}

function polinomio(latex: unknown): Term[] | null {
  if (typeof latex !== "string" || !latex.trim()) return null;
  try {
    return parsePolyLoose(conPuntoDecimale(latex));
  } catch {
    return null;
  }
}

function stesse(x: number | null, y: number | null): boolean {
  return x != null && y != null && Math.abs(x - y) < 1e-9;
}

/** Due forme razionali (fratte) sono la STESSA? Numeratori e denominatori
 *  normalizzati identici (la semplificazione è già dentro evalRat). */
function stesseFratte(opLatex: string, answerLatex: string): boolean | null {
  try {
    const rOp = evalRat(parseExpression(normalizeInput(opLatex)));
    const rAn = evalRat(parseExpression(normalizeInput(answerLatex)));
    return polyEquals(rOp.num, rAn.num) && polyEquals(rOp.den, rAn.den);
  } catch {
    return null;
  }
}

/** Due forme coincidono per sostituzione? Le lettere valgono 2, 3, 5… */
function stessePerSostituzione(opLatex: string, answerLatex: string): boolean | null {
  try {
    const ast = parseExpression(normalizeInput(opLatex));
    const { values } = buildVerificationValues(ast);
    const vOp = substituteAndEvaluate(ast, values);
    const astAn = parseExpression(normalizeInput(answerLatex));
    const vAn = substituteAndEvaluate(astAn, values);
    if (!Number.isFinite(vOp) || !Number.isFinite(vAn)) return null;
    return Math.abs(vOp - vAn) < 1e-6 * Math.max(1, Math.abs(vOp), Math.abs(vAn));
  } catch {
    return null;
  }
}

/** (26/10-test) esportata per i test dei percorsi di verifica. */
export { contoGiusto };

/** Un conto (op = risultato) è GIUSTO? Prova in ordine: valore puro,
 *  confronto simbolico, sostituzione. Restituisce anche COME è stato
 *  verificato (per il messaggio di errore all'IA). */
function contoGiusto(op: unknown, answer: unknown): { ok: boolean; via: string } {
  const vb = valore(op);
  const va = valore(answer);
  if (vb != null && va != null) {
    return stesse(vb, va)
      ? { ok: true, via: "numerico" }
      : { ok: false, via: `numerico: l'operazione vale ${vb} ma il risultato dichiarato vale ${va}` };
  }
  if (typeof op === "string" && typeof answer === "string") {
    const pb = polinomio(op);
    const pa = polinomio(answer);
    if (pb && pa && pb.length > 0) {
      if (polyEquals(pb, pa)) return { ok: true, via: "simbolico" };
      /* (26/10-fix, foto utente «(2ab)^-1·4ab+(1/2)^-2-4ab-4 non si costruisce
         in produzione mentre qui sì»): polinomi DIVERSI non è ancora un
         verdetto. L'IA risponde con forme equivalenti che evalPoly riduce
         in modo diverso tra un tentativo e l'altro (es. (2ab)^{-1}·4ab
         mantenendo le lettere rispetto a 2); i percorsi RAZIONALI esatti
         (evalRat e la sostituzione numerica) reggono gli esponenti
         negativi al 100% e vengono provati PRIMA di respingere. */
      const fr2 = stesseFratte(op, answer);
      if (fr2 === true) return { ok: true, via: "fratta" };
      const sost2 = stessePerSostituzione(op, answer);
      if (sost2 === true) return { ok: true, via: "sostituzione" };
      return { ok: false, via: "simbolico: le due forme con lettere non sono la stessa espressione" };
    }
    /* fratte (lettere al denominatore): confronto razionale esatto */
    const fr = stesseFratte(op, answer);
    if (fr === true) return { ok: true, via: "fratta" };
    if (fr === false) {
      return { ok: false, via: "fratta: numeratore e denominatore semplificati non coincidono" };
    }
    const sost = stessePerSostituzione(op, answer);
    if (sost === true) return { ok: true, via: "sostituzione" };
    if (sost === false) {
      return { ok: false, via: "sostituzione: dando alle lettere i valori 2, 3, 5… i due membri non coincidono" };
    }
  }
  return { ok: false, via: "non valutabile (né come numero né come espressione con lettere)" };
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
function risultatoMotore(opLatex: string): string | null {
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
  try {
    const p = parsePolyLoose(opLatex);
    if (!p) return null;
    return fractionResultLatex(p) ?? polyToLatex(p);
  } catch {
    return null;
  }
}

function riparaEsercizio(
  raw: unknown,
): { esercizio: EsercizioAI | null; avvertenze: string[]; problemi: string[] } {
  const avvertenze: string[] = [];
  /* (27/10, collaudo) il motore legge «2,5» ma NON «2{,}5»: se l'IA usa la
     virgola graffa (forma LaTeX dei decimali) la riporto alla virgola semplice
     in tutto l'esercizio PRIMA di ogni controllo. */
  if (raw && typeof raw === "object") {
    try {
      raw = JSON.parse(JSON.stringify(raw).replace(/(\d)\s*\{,\}\s*(\d)/g, "$1,$2"));
    } catch {
      /* oggetto non serializzabile: lo controlla il codice sotto */
    }
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
      const aiAnswer = typeof b?.answerLatex === "string" ? b.answerLatex.trim() : "";
      let answerLatex = aiAnswer;
      if (aiAnswer) {
        const esito = contoGiusto(op, aiAnswer);
        if (!esito.ok) {
          const motore = risultatoMotore(op);
          if (motore != null) {
            answerLatex = motore;
            avvertenze.push(`box ${nBox}: risposta dell'IA sostituita dal calcolo del motore`);
          } else {
            avvertenze.push(`box ${nBox}: risposta dell'IA tenuta, ma il motore non la conferma (${esito.via})`);
          }
        }
      } else {
        const motore = risultatoMotore(op);
        if (motore != null) {
          answerLatex = motore;
          avvertenze.push(`box ${nBox}: risposta mancante, calcolata dal motore`);
        } else {
          avvertenze.push(`box ${nBox}: risposta mancante e non calcolabile dal motore`);
        }
      }
      /* flag simbolico dalle lettere nel TESTO (stessa regola fix3) */
      const senzaComandi = op.replace(/\\[a-zA-Z]+/g, "");
      const simbolico =
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
      boxes.push({
        op,
        prompt: frase,
        extraLatex:
          typeof b?.extraLatex === "string" && b.extraLatex.trim() ? b.extraLatex.trim() : undefined,
        answerLatex,
        simbolico: simbolico ? true : undefined,
      });
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
      if (motore != null) {
        risultatoFinaleLatex = motore;
        avvertenze.push("risultato finale dell'IA sostituito dal calcolo del motore");
      } else {
        avvertenze.push(`risultato finale dell'IA tenuto, ma il motore non lo conferma (${esitoF.via})`);
      }
    }
  } else {
    const motore = risultatoMotore(e.espressioneLatex!);
    if (motore != null) {
      risultatoFinaleLatex = motore;
      avvertenze.push("risultato finale mancante, calcolato dal motore");
    } else {
      risultatoFinaleLatex = e.espressioneLatex!; /* fallback estremo: non blocca */
    }
  }

  /* righe progressive: pulite, la prima è l'espressione intera; non sono
     più un blocco (il PDF usa lo svolgimento VERO dello studente) */
  const righe = (Array.isArray(e.righeProgressive) ? e.righeProgressive : [])
    .map((r) => String(r ?? "").trim())
    .filter((r) => r.length > 0);
  if (righe.length === 0 || righe[0] !== e.espressioneLatex) righe.unshift(e.espressioneLatex!);
  if (righe.length !== nBox + 1) {
    avvertenze.push(`le righe progressive sono ${righe.length} invece di ${nBox + 1}: tenute come sono`);
  }

  const esercizio: EsercizioAI = {
    espressioneLatex: e.espressioneLatex!,
    sezioni: sezioniRiparate,
    righeProgressive: righe,
    risultatoFinaleLatex,
  };
  return { esercizio, avvertenze, problemi: [] };
}
export { riparaEsercizio };

/* ─── Prompt ────────────────────────────────────────────────────────── */

function costruisciPrompt(espressione: string, precedente: string | null, problemi: string[]): string {
  const correzione =
    precedente && problemi.length > 0
      ? `\n\nIl TENTATIVO PRECEDENTE aveva questi problemi (risolvili TUTTI):\n${problemi.map((p) => `- ${p}`).join("\n")}\n\nTentativo precedente:\n${precedente}\n\nRiproda e restituisca di nuovo SOLO il JSON completo e corretto.`
      : "";
  return `Costruisci lo SVOLGIMENTO GUIDATO a passaggi minimi di un'ESPRESSIONE (aritmetica, algebrica con lettere, fratta, potenze, radici quadrate/cubiche) per uno studente con DSA. Notazione in ingresso: ⁄ frazione impilata, · prodotto, : divisione, ^ potenza, √ ∛ ∜ radici, ( ) [ ] parentesi, lettere x y z a b.

Rispondi SOLO con un JSON COMPATTO (niente spazi inutili, niente markdown, niente testo fuori):
{"espressioneLatex":"...","sezioni":[{"title":"...","boxes":[{"op":"...","prompt":"...","extraLatex":"...","answerLatex":"...","simbolico":true}]}],"righeProgressive":["..."],"risultatoFinaleLatex":"..."}

REGOLE:
1. LaTeX consentito: \\dfrac{}{}, \\cdot, \\sqrt{}, \\sqrt[3]{}, \\left( \\right), \\left[ \\right], ^{}, + - : e lettere. Vietato \\frac \\times \\div \\.
2. espressioneLatex: l'espressione INTERA con le parentesi originali. Con «=» svolgi SOLO il primo membro.
2b. NUMERI DECIMALI (es. 2,5 · 0,25 · 1,2): nell'espressioneLatex e nelle righe prima della trasformazione scrivili con la virgola SEMPLICE (2,5: mai 2{,}5 e mai il punto). Per OGNI decimale metti in una sezione «DECIMALI IN FRAZIONE», PRIMA degli altri calcoli, un box con op = il SOLO decimale (es. "2{,}5") e answerLatex = la frazione ridotta ("\\dfrac{5}{2}"; "0{,}25" → "\\dfrac{1}{4}"; se è un intero come 4,0 → "4"). Prompt del box: solo il metodo («Scrivo il decimale come frazione decimale e la riduco.»). Poi si calcola SOLO con frazioni impilate: mai decimali nei risultati.
3. Ogni box = UN SOLO calcolo elementare (mai due operazioni insieme; con tre addendi somma prima due, poi il terzo).
4. answerLatex ridotto al minimo: frazioni \\dfrac ridotte (interi senza \\dfrac), radici perfette come numeri (√9 → 3), lettere semplificate (2x+3x → 5x).
4b. Esponenti NEGATIVI: la risposta semplificata non ha MAI esponenti negativi residui — capovolgi o semplifica (es. (2ab)^{-1}·4ab = 4ab : 2ab = 2; (1/2)^{-2} = 4; x^{-2} = \\dfrac{1}{x^{2}}). Nell'espressione iniziale e nelle prime righe restano come sono.
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
9. righeProgressive: prima riga = espressioneLatex; ogni riga sostituisce l'operazione del box col suo risultato. ESATTAMENTE (box + 1) righe; l'ULTIMA = l'operazione dell'ultimo box (se manca un box, aggiungilo).
10. risultatoFinaleLatex: finale ridotto al minimo.
11. Ricontrolla i conti prima di rispondere (frazioni: ogni riga conserva il valore; lettere: le due forme coincidono dando alle lettere 2, 3, 5).
12. TEMPO LIMITATO: rispondi subito al primo colpo, JSON completo e corretto senza ripensamenti lunghi.

${ESEMPIO_MINI}

ESPRESSIONE DA SVOLGERE:
${espressione}${correzione}`;
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
      /* prova il prossimo candidato */
    }
  }
  return null;
}

/* (26/10-fix) ESEMPIO breve dentro il prompt: senza un modello di risposta
   l'IA sbaglia il formato e brucia tentativi interi in rigenerazioni.
   Le REGOLE 9 e 10 sono le più violate: l'esempio le mostra in azione
   (stile anti-troncamento: il cutoff del gateway è la prima causa di
   fallimento sulle espressioni lunghe). */
const ESEMPIO_MINI =
  'ESEMPIO (stesso formato da usare, espressione corta):\n' +
  'ESPRESSIONE: (1/2+1/3):(1/4)\n' +
  '{"espressioneLatex":"\\left(\\dfrac{1}{2}+\\dfrac{1}{3}\\right):\\dfrac{1}{4}","sezioni":[{"title":"SOMMO LE FRAZIONI","boxes":[{"op":"\\dfrac{1}{2}+\\dfrac{1}{3}","prompt":"Porto allo stesso denominatore: mcm(2,3)=6.","answerLatex":"\\dfrac{5}{6}"}]}],"righeProgressive":["\\left(\\dfrac{1}{2}+\\dfrac{1}{3}\\right):\\dfrac{1}{4}","\\dfrac{5}{6}:\\dfrac{1}{4}","\\dfrac{5}{3}"],"risultatoFinaleLatex":"\\dfrac{5}{3}"}';

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
async function chiamaIA(prompt: string): Promise<string> {
  let ultimoErrore: unknown = null;
  for (let prova = 1; prova <= 3; prova++) {
    try {
      /* (26/10, velocità): il gateway risponde o taglia (504) entro ~100 s:
         fallire in fretta e riprovare batte aspettare (100 s).
         (26/10-fix) JSON corto e veloce: max 4000 token di risposta +
         formato JSON forzato quando supportato (meno parole = meno tempo
         e meno quota del piano consumata per ogni tentativo). */
      return await chatCompletion(prompt, 0, 100_000, { maxTokens: 4000, jsonMode: true });
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
  /* (26/10-Opzione A) le regole che bocciavano l'esercizio sono TOLTE:
     i conti li rifà il motore locale (riparaEsercizio). Due tentativi
     bastano — servono solo se l'IA non restituisce struttura utile. */
  for (let tentativo = 1; tentativo <= 2; tentativo++) {
    suTentativo?.(tentativo);
    const prompt = costruisciPrompt(espressione, null, problemi);
    /* la costruzione gira in BACKGROUND (job + polling): può permettersi
       4 minuti per chiamata, con riprove sui 504 e sulle risposte senza
       JSON (a volte il modello risponde con testo vuoto o ragionamenti). */
    let raw: unknown = null;
    for (let prova = 1; prova <= 3; prova++) {
      const risposta = await chiamaIA(prompt);
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
    ultimoRaw = raw;
    const esito = riparaEsercizio(raw);
    if (esito.esercizio) {
      if (esito.avvertenze.length) {
        console.log("[costruisci] avvertenze:", esito.avvertenze.slice(0, 8));
      }
      return { esercizio: esito.esercizio, tentativi: tentativo, avvertenze: esito.avvertenze };
    }
    problemi = esito.problemi;
    /* (26/10-diagnostica) senza questo log è impossibile capire perché
       la struttura non è utilizzabile */
    console.error("[costruisci] struttura non utilizzabile (tentativo %d):", tentativo, problemi);
    const lxRic = (raw as { espressioneLatex?: string })?.espressioneLatex ?? "";
    console.error("[costruisci] espressioneLatex ricevuto:", JSON.stringify(lxRic));
  }
  /* (26/10-fix) Lo studente NON deve vedere l'elenco tecnico dei
     problemi di verifica (messaggio rosso lunghissimo e incomprensibile,
     segnalato dall'utente): lo vedono solo i log del server. Per lui una
     frase corta e chiara. */
  console.error("[costruisci] esercizio non costruito dopo 2 tentativi. Problemi:", problemi.slice(0, 8));
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

const FILE_ATTIVO = "/tmp/esercizio-attivo.json";

function dbSql() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) return null;
  try {
    return neon(url);
  } catch {
    return null;
  }
}

function validoPerArchivio(dati: unknown): EsercizioAI | null {
  /* (26/10-Opzione A) al caricamento (esercizio attivo e cache) basta la
     struttura minima: un esercizio riparato non deve più essere bocciato
     dalla vecchia verifica (un prompt mancante o una riga fuori posto
     chiudevano la pagina 3 proprio al momento dell'apertura). */
  const e = dati as Partial<EsercizioAI> | null;
  if (!e || typeof e !== "object") return null;
  if (typeof e.espressioneLatex !== "string" || !e.espressioneLatex.trim()) return null;
  if (
    !Array.isArray(e.sezioni) ||
    !e.sezioni.some((s) => Array.isArray(s?.boxes) && s.boxes.length > 0)
  ) {
    return null;
  }
  return dati as EsercizioAI;
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
    const mappa = JSON.parse(readFileSync("/tmp/cache-costruzioni.json", "utf8")) as Record<string, unknown>;
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
      /* la cache non cresce all'infinito: tiene le 200 voci più recenti */
      await sql`DELETE FROM cache_costruzioni WHERE chiave NOT IN (SELECT chiave FROM cache_costruzioni ORDER BY aggiornato DESC LIMIT 200)`;
      return;
    } catch {
      /* fallback su file */
    }
  }
  try {
    const { readFileSync, writeFileSync } = await import("node:fs");
    let mappa: Record<string, unknown> = {};
    try {
      mappa = JSON.parse(readFileSync("/tmp/cache-costruzioni.json", "utf8")) as Record<string, unknown>;
    } catch {
      /* parte vuota */
    }
    mappa[chiave] = esercizio;
    const chiavi = Object.keys(mappa);
    if (chiavi.length > 200) {
      for (const k of chiavi.slice(0, chiavi.length - 200)) delete mappa[k];
    }
    writeFileSync("/tmp/cache-costruzioni.json", JSON.stringify(mappa), "utf8");
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
    writeFileSync(`/tmp/esercizio-job-${id}.json`, JSON.stringify(job), "utf8");
  } catch {
    /* la copia su file è di cortesia: non blocca mai */
  }
}

async function leggiStatoJob(id: string): Promise<JobCostruzione | null> {
  const inMemoria = jobs.get(id);
  if (inMemoria) return inMemoria;
  try {
    const { readFileSync } = (await import("node:fs")) as typeof import("node:fs");
    return JSON.parse(readFileSync(`/tmp/esercizio-job-${id}.json`, "utf8")) as JobCostruzione;
  } catch {
    return null;
  }
}

export function registerEsercizioRoutes(app: Express): void {
  /* (26/10-fix) Canonizza l'input prima di darlo all'IA e alla cache:
     l'IA vision può trascrivere frazioni unicode (¼, ½, ¾…), apici unicode,
     − × ÷ al posto di / ^ · : — l'IA di costruzione e la verifica devono
     vedere SEMPRE la forma canonica, altrimenti l'esercizio non è
     valutabile e la costruzione fallisce 3 volte. */
  const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  function canonica(s: string): string {
    return s
      .replace(/¼/g, "(1/4)").replace(/½/g, "(1/2)").replace(/¾/g, "(3/4)")
      .replace(/⅓/g, "(1/3)").replace(/⅔/g, "(2/3)")
      .replace(/⅙/g, "(1/6)").replace(/⅚/g, "(5/6)")
      .replace(/⅛/g, "(1/8)").replace(/⅜/g, "(3/8)")
      .replace(/⅝/g, "(5/8)").replace(/⅞/g, "(7/8)")
      .replace(new RegExp("[" + SUPS + "]", "g"), (c) => "^" + SUPS.indexOf(c))
      .replace(/[−–—]/g, "-")
      .replace(/[×⋅•∗]/g, "·")
      .replace(/÷/g, ":");
  }

  /* POST /api/ai/costruisci-esercizio — body { espressione } → { jobId }.
     Avvia la costruzione verificata e risponde subito. */
  app.post("/api/ai/costruisci-esercizio", express.json({ limit: "1mb" }), async (req, res) => {
    const espressione = canonica(String(req.body?.espressione ?? "").trim());
    console.log("[costruisci] input canonico:", JSON.stringify(espressione));
    if (!espressione) {
      res.status(400).json({ error: "Espressione mancante: scrivi prima l'espressione sulla pagina." });
      return;
    }
    /* (26/10, velocità): prima la CACHE — espressione già vista = risposta
       immediata, senza disturbare l'IA */
    const chiave = chiaveCache(espressione);
    try {
      const inCache = await leggiCache(chiave);
      if (inCache) {
        /* (27/10) gli esercizi GIÀ in cache hanno i testi guida vecchi:
           li rifinisco al volo (stesse regole di una costruzione nuova) */
        for (const sez of inCache.sezioni) {
          for (const bx of sez.boxes) if (bx.prompt) bx.prompt = rifinisciFrase(bx.prompt);
        }
        const id = randomUUID();
        await salvaStatoJob(id, { stato: "fatto", tentativo: 1, esercizio: inCache, avvertenze: [] });
        res.json({ jobId: id });
        return;
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
     file /tmp; le vecchie (oltre 7 giorni o oltre le 200 più recenti) si
     eliminano da sole. */
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
      const grezzo = JSON.parse(readFileSync(`/tmp/esercizio-sessione-${sid}.json`, "utf8")) as { esercizio: unknown };
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
      const archivio = await salvaEsercizioAttivo(esercizio, String(req.body?.espressione ?? ""));
      /* (26/10-fix PDF dinamico) la sessione personale dello studente */
      const sid = randomUUID();
      const sql = dbSql();
      if (sql) {
        try {
          await sql`CREATE TABLE IF NOT EXISTS sessioni_costruzioni (sid text PRIMARY KEY, dati jsonb NOT NULL, espressione text, creato timestamptz DEFAULT now())`;
          await sql`INSERT INTO sessioni_costruzioni (sid, dati, espressione) VALUES (${sid}, ${JSON.stringify(esercizio)}::jsonb, ${String(req.body?.espressione ?? "")})`;
          await sql`DELETE FROM sessioni_costruzioni WHERE creato < now() - interval '7 days'`;
          await sql`DELETE FROM sessioni_costruzioni WHERE sid NOT IN (SELECT sid FROM sessioni_costruzioni ORDER BY creato DESC LIMIT 200)`;
        } catch {
          /* database non raggiungibile: sessione su file */
          try {
            const { writeFileSync } = await import("node:fs");
            writeFileSync(`/tmp/esercizio-sessione-${sid}.json`, JSON.stringify({ esercizio }), "utf8");
          } catch {
            /* sessione non salvabile: resta l'esercizio attivo */
          }
        }
      } else {
        try {
          const { writeFileSync } = await import("node:fs");
          writeFileSync(`/tmp/esercizio-sessione-${sid}.json`, JSON.stringify({ esercizio }), "utf8");
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
