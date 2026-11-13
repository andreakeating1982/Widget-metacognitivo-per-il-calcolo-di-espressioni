/**
 * keyboardNotation.ts — regole di TRASCRIZIONE DA TASTIERA nell'editor dei
 * pezzi (giro 26), le stesse dell'app del Dettato Matematico
 * (github.com/andreakeating1982/AUDIO-MATEMATICI, richieste dall'utente):
 *
 *  (11/11/2026 — STANDARD CALCOLATRICE, guida utente «Conversione delle
 *  notazioni matematiche»: ora le istruzioni e le conversioni seguono la
 *  calcolatrice; le vecchie regole restano accettate per compatibilità)
 *
 *   *         moltiplicazione → il puntino · (mai la lettera x)
 *   /         divisione; (A)/(B) frazione impilata → A⁄B (U+2044)
 *   ^2, ^(-1) esponenti (anche negativi, col segno tra parentesi)
 *   (A)^(1/2) radice quadrata → √(A)   (anche (A)^(0.5))
 *   (A)^(1/3) radice cubica → ∛(A)
 *   (A)^(1/4) radice quarta → ∜(A)
 *   (A)^(-1/3) radice con INDICE NEGATIVO → ⁻³√(A)
 *   0.75      decimale col punto (come in calcolatrice) → 0,75
 *   1/3       periodico 0,3̄: si scrive la frazione generatrice
 *
 *  Vecchie regole ancora accettate: «:» divisione, rad2/rad3/rad4…,
 *  0,3per / 0,3_6per per i periodici.
 *
 * La notazione risultante è quella che il parser di lib/espressioni.ts
 * accetta già (· : ⁄ ^ √ ∛ ∜): la conversione avviene MENTRE si digita
 * (come nell'app audio) e di nuovo al salvataggio, come rete di sicurezza.
 */

import { canonicalizePeriodicNotation } from "./periodicNotation";

/** Base condivisa. Modalità APP (editor ✎, giro 26): ":" resta divisione e
 *  solo le frazioni SEMPLICI a/b diventano impilate. Modalità DISPLAY
 *  (pannello trascrizione, giro 28, come nell'app audio originaria): la
 *  barra "/" è SEMPRE frazione impilata (anche le fratte come (x+1)/(2x-3),
 *  perché la divisione si scrive con i due punti) e i due punti scritti si
 *  MOSTRANO come «÷» (linea con un puntino sopra e uno sotto). */
/** Sanifica il LaTeX che l'IA a volte restituisce al posto della notazione
 *  lineare (giro 33-fix, segnalazione utente con foto: nel campo del
 *  pannello compariva «·\frac{3}{c}(\frac{1}{4}» mentre la legenda
 *  prescrive la barra «/» per la frazione impilata). Converte in notazione
 *  dell'app: \frac{a}{b} → a⁄b, \sqrt{q} → √q, \cdot → *, \div → :, ecc.
 *  Chiamato all'inizio di baseNormalize: vale mentre si digita (incolla),
 *  al salvataggio del pezzo e per ogni notazione che arriva dall'IA. */
export function sanitizeLatexNotation(s: string): string {
  /* (09/11-fix, collaudo utente 9094: «0,3per» da tastiera perdeva il
   *  periodico) PROTEZIONE del numero periodico: \overline{3} e \bar{3}
   *  NON devono essere cancellati dallo strip dei comandi LaTeX più
   *  sotto (era proprio il colpevole: al salvataggio del pezzo il testo
   *  ripassa da qui e «0,\overline{3}» diventava «0,3»). Si mascherano
   *  con segnaposto di uso privato e si ristabiliscono alla fine. */
  s = (s ?? "").replace(/\\(?:overline|bar)\s*\{(\d+)\}/gi, "$1");
  let t = s;
  // guardia: senza backslash E senza graffe non c'è nulla da sanificare
  // (le graffe sole contano: l'IA scrive anche «x^{2}» senza comandi).
  // Se però c'è un periodico mascherato, ristabiliscilo prima di uscire.
  const ripristina = (x: string) => x.replace(/(\d+)/g, (_m, d: string) => `\\overline{${d}}`);
  if (!t.includes("\\") && !t.includes("{")) return ripristina(t);
  for (let i = 0; i < 3; i++) {
    const prev = t;
    t = t
      // \frac{a}{b} seguito da esponente: in LaTeX l'esponente vale per
      // TUTTA la frazione → parentesi per tenerne il senso ((3⁄4)^2, non
      // 3⁄4^2 che sembrerebbe 3 fratto 4²)
      .replace(/\\(?:d|t|c)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}(\s*\^)/gi, "($1\u2044$2)$3")
      .replace(/\\(?:d|t|c)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/gi, "$1\u2044$2")
      .replace(/\\sqrt\s*\[\s*3\s*\]\s*\{([^{}]*)\}/gi, "\u221b$1")
      .replace(/\\sqrt\s*\[\s*4\s*\]\s*\{([^{}]*)\}/gi, "\u221c$1")
      .replace(/\\sqrt\s*\{([^{}]*)\}/gi, "\u221a$1")
      .replace(/\\(?:cdot|times)\s*/gi, "*")
      .replace(/\\div\s*/gi, ":")
      .replace(/\\(?:left|right)\s*([()[\]])/gi, "$1")
      .replace(/\^\s*\{([^{}]+)\}/g, "^($1)");
    // esponenti con graffe: x^{2} → x^2 (le graffe semplici spariscono)
    t = t.replace(/\^\(([0-9a-z+\-]+)\)/g, "^$1");
    if (t === prev) break;
  }
  // spaziature LaTeX e comandi residui → via; graffe residue → via
  // (la notazione dell'app non usa mai le graffe)
  t = t
    .replace(/\\[,;! ]/g, "")
    .replace(/\$/g, "")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}]/g, "");
  // ristabilisci il periodico protetto (normalizza \bar in \overline)
  t = t.replace(/(\d+)/g, (_m, d: string) => `\\overline{${d}}`);
  return t;
}

function baseNormalize(s: string, display: boolean): string {
  /* (11/11, standard calcolatrice) il PUNTO dei decimali (0.75) vale come
   *  la virgola: convertito PRIMA di tutto, così anche 0.3333... e (A)^(0.5)
   *  cadono sulle regole con la virgola. */
  const raw = (s ?? "").replace(/\u00a0/g, " ").replace(/(\d)\.(\d)/g, "$1,$2");
  let t = sanitizeLatexNotation(canonicalizePeriodicNotation(raw));
  if (!t.trim()) return "";
  /* (12/11, indici fino a 99) la regola a DUE cifre gira PRIMA di togliere
   * gli spazi: «rad2 9» resta √9 (lo spazio separa il comando dall'operando)
   * mentre «rad13», «rad45» — nessuno spazio dentro l'indice — diventano
   * ¹³√, ⁴⁵√. Dopo la fusione dello spazio le due scritture sarebbero
   * indistinguibili («rad29») e il vecchio √9 si rompeva. */
  const CIFRA_SUP_RAD: Record<string, string> = {
    "0": "\u2070", "1": "\u00b9", "2": "\u00b2", "3": "\u00b3", "4": "\u2074",
    "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079",
  };
  const apiceDi = (n: number) => String(n).split("").map((d) => CIFRA_SUP_RAD[d]).join("");
  t = t.replace(/rad([5-9]|[1-9]\d)(?![0-9])/gi, (_m, cifre: string) => `${apiceDi(Number(cifre))}√`);
  // niente spazi: la notazione dell'app è compatta (il parser li toglie comunque)
  t = t.replace(/\s+/g, "");
  // (09/11, foto «indici diversi») indici a UNA cifra già convertiti sopra;
  // qui restano i comandi storici rad2/rad3/rad4 (+ eventuale operando già
  // separato dallo spazio, che la regola a due cifre non ha toccato).
  // radici: sqrt/radq/rad2 → √ (quadrata), rad3 → ∛ (cubica), rad4 → ∜ (quarta)
  t = t.replace(/(?:sqrt|radq|rad2)/gi, "√");
  t = t.replace(/rad3/gi, "∛");
  t = t.replace(/rad4/gi, "∜");
  // (11/11, standard calcolatrice) RADICI da ESPONENTE FRAZIONARIO, come
  // nella guida: (A)^(1/2) → √(A), (A)^(1/3) → ∛(A), (A)^(1/4) → ∜(A),
  // (A)^(1/7) → ⁷√(A) e, con INDICE NEGATIVO, (A)^(-1/3) → ⁻³√(A).
  // Anche (A)^(0,5) → √(A). La base resta tra parentesi (anche con la
  // barra: (a/b)^(1/3) → ∛(a/b), la barra diventa ⁄ più sotto). Ripetuto
  // finché stabile per le radici di radici.
  const CIFRA_SUP: Record<string, string> = {
    "0": "\u2070", "1": "\u00b9", "2": "\u00b2", "3": "\u00b3", "4": "\u2074",
    "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079",
  };
  const apiceIndice = (n: number) => String(n).split("").map((d) => CIFRA_SUP[d]).join("");
  for (let i = 0; i < 3; i++) {
    const prev = t;
    // la base può contenere UN livello di parentesi annidate (radice di radice)
    const BASE = "((?:[^()]|\\([^()]*\\))*)";
    t = t
      .replace(new RegExp(`\\(${BASE}\\)\\^\\(0,5\\)`, "g"), (_m, b: string) => `√(${b})`)
      .replace(new RegExp(`\\(${BASE}\\)\\^\\((-?)1\\/(\\d+)\\)`, "g"), (_m, base: string, segno: string, n: string) => {
        const idx = Number(n);
        if (segno) return `\u207b${apiceIndice(idx)}√(${base})`;
        if (idx === 2) return `√(${base})`;
        if (idx === 3) return `∛(${base})`;
        if (idx === 4) return `∜(${base})`;
        return `${apiceIndice(idx)}√(${base})`;
      });
    if (t === prev) break;
  }
  // (09/11, richiesta utente) NUMERI PERIODICI da tastiera: le cifre subito
  // prima di «per» sono il periodo → 0,3per = 0,3̄ (0,\overline{3}). Con la
  // parte NON periodica si separa col trattino basso: 0,1_6per = 0,16̄.
  t = t.replace(/(\d+),(?:(\d+)_)?(\d+)per(?![a-z])/gi, (_m, i: string, nonRep: string | undefined, per: string) => `${i},${nonRep ?? ""}\\overline{${per}}`);
  // (11/11, standard calcolatrice) anche la forma con i puntini: 0,3333...
  // = 0,3̄ e 0,1666... = 0,16̄ (il periodo è la cifra finale ripetuta).
  t = t.replace(/(\d+),(\d*?)(\d)\3+(?:\.{3}|…)/g, (_m, int: string, anti: string, per: string) => `${int},${anti}\\overline{${per}}`);
  // moltiplicazione: l'asterisco (e la crocetta × che l'IA a volte usa)
  // diventa SEMPRE il puntino (richiesta fissa: mai la lettera x, che si
  // confonde con la variabile)
  t = t.replace(/×/g, "*");
  t = t.replace(/\*/g, "·");
  if (display) {
    // pannello (giro 28): la barra è SEMPRE frazione impilata, la divisione
    // scritta con i due punti si mostra come «÷» (app audio originaria)
    t = t.replace(/\//g, "\u2044");
    t = t.replace(/:/g, "\u00f7");
  } else {
    // editor ✎ (giro 26): divisione vera coi due punti (÷ → :), la barra
    // resta divisione tranne nelle frazioni SEMPLICI a/b → a⁄b.
    // (24/10-fix, foto utente: «(1/2)^2» da tastiera restava con la barra
    // perché la regex semplice non copre il denominatore tra parentesi).
    // Prima la forma (a)/(b) con entrambi i lati semplici → (a⁄b) dentro
    // le stesse parentesi; poi le forme semplici a/b → a⁄b. I rapporti
    // complessi (x+1)/(2x-3) restano con la barra (divisione).
    t = t.replace(/÷/g, ":");
    t = t.replace(/\((\d(?:\.\d+)?|[a-z])\)\/\((\d(?:\.\d+)?|[a-z])\)/g, (_m, a: string, b: string) => `(${a}\u2044${b})`);
    t = t.replace(/(\d(?:\.\d+)?|[a-z])\/(\d(?:\.\d+)?|[a-z])/g, (_m, a: string, b: string) => `${a}\u2044${b}`);
  }
  // meno unicode → meno ASCII
  t = t.replace(/[−–—]/g, "-");
  return t;
}

/** Conversione di una notazione da tastiera in notazione dell'app */
export function normalizeKeyboardNotation(s: string): string {
  return baseNormalize(s, false);
}

/** Conversione in notazione «da schermo» del pannello (giro 28): frazioni
 *  impilate sempre e divisione mostrata come «÷». Per salvare il pezzo si
 *  ripassa da normalizeKeyboardNotation, che riconverte «÷» in «:». */
export function normalizeKeyboardDisplayNotation(s: string): string {
  return baseNormalize(s, true);
}

/** Notazione dell'IA (divisione = «:», ma a volte con residui LaTeX come
 *  \frac{}{}) → notazione da schermo del pannello, così il dettato si
 *  mostra come nell'app audio originaria E come dice la legenda
 *  («/» = frazione impilata, MAI \frac). Giro 33-fix: passa per la
 *  normalizzazione display completa (sanifica + ÷ + ⁄). */
export function toDisplayNotation(s: string): string {
  return baseNormalize(s, true);
}

/**
 * Conversione «mentre si digita»: restituisce il valore convertito E la
 * posizione del cursore spostata di conseguenza (es. digitare «rad2»
 * accorcia il testo: il cursore resta sul punto giusto). Il parametro
 * opzionale sceglie le regole: editor ✎ (giro 26) o pannello (giro 28).
 */
export function normalizeKeyboardLive(
  value: string,
  caret: number,
  normalizer: (s: string) => string = normalizeKeyboardNotation,
): { value: string; caret: number } {
  const next = normalizer(value);
  if (next === value) {
    return { value, caret: Math.min(caret, value.length) };
  }
  // cursore: converto la parte prima e dopo il cursore; se la giunzione
  // non ricompone la conversione intera (es. il cursore spezza un token
  // come «rad2»), il cursore va in fondo al testo convertito
  const before = normalizer(value.slice(0, caret));
  const after = normalizer(value.slice(caret));
  const caretPos = before + after === next ? before.length : next.length;
  return { value: next, caret: Math.min(caretPos, next.length) };
}

/** Come normalizeKeyboardLive ma con le regole del pannello (giro 28) */
export function normalizeKeyboardDisplayLive(
  value: string,
  caret: number,
): { value: string; caret: number } {
  return normalizeKeyboardLive(value, caret, normalizeKeyboardDisplayNotation);
}

/** Suggerimento con le regole, mostrato sotto il campo di correzione ✎ */
export const keyboardNotationHint =
  "* moltiplicazione · / divisione, (A)/(B) frazione impilata · ^2 e ^(-1) potenze · (A)^(1/2) radice quadrata · (A)^(1/3) cubica · (A)^(1/4) quarta · (A)^(-1/3) indice −3 · 0.75 decimale (o 3/4) · periodico 0,3̄: frazione generatrice 1/3";

/** Suggerimento con le regole del pannello (giro 28): qui la barra è
 *  sempre frazione impilata e i due punti scritti si mostrano come «÷» */
export const keyboardDisplayHint =
  "* moltiplicazione · / frazione impilata, (A)/(B) · ^2 e ^(-1) potenze · (A)^(1/2) radice quadrata · (A)^(1/3) cubica · (A)^(1/4) quarta · (A)^(-1/3) indice −3 · 0.75 decimale (o 3/4) · periodico 0,3̄: frazione generatrice 1/3 · = si ignora tutto ciò che segue (si calcola solo la parte prima)";
