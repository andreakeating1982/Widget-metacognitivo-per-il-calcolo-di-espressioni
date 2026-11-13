/** Pulizia della trascrizione IA (giro 20) — modulo PURO, provabile in Node.
 *
 *  La risposta dell'IA (vision) può arrivare in LaTeX, con simboli Unicode o
 *  con piccole impurità di formato: qui si riporta alla NOTAZIONE INTERNA
 *  dell'app (espressioni.ts accetta + - * : ^ ⁄ ( ) [ ] { } √ =).
 *
 *  ⚠️ MAI aggiungere nulla: i simboli sconosciuti si TOLGONO (se il modello
 *  scrive «?» resta nel testo: l'utente lo corregge — l'app non inventa). */

import { canonicalizePeriodicNotation } from "./periodicNotation";

export function cleanAiExpression(raw: string): string {
  let s = (raw ?? "").trim();
  // markdown / recinti di codice
  s = s.replace(/```[a-z]*/gi, "").replace(/```/g, "");
  // Protegge e normalizza SUBITO la barretta del periodo, prima del filtro
  // dei caratteri. La cifra marcata non include l'eventuale antiperiodo.
  s = canonicalizePeriodicNotation(s);
  /* Frazioni e radicali possono essere annidati in entrambe le direzioni.
   * Alternare le conversioni evita di perdere la frazione in
   * \frac{\sqrt{25x^{4}}}{x}, e conserva invece la radice su tutta la
   * frazione in \sqrt{\frac{9}{4}}. Non si svolgono operazioni. */
  for (let i = 0; i < 8; i++) {
    const previous = s;
    s = s.replace(/\^\s*\{([^{}]*)\}/g, "^$1");
    // (10/11) indice NEGATIVO: \sqrt[-3]{8} → ⁻³√(8) (esiste in matematica,
    // si trascrive FEDELMENTE, non si corregge). (12/11) indici 5..99 →
    // ⁵√…⁹⁹√: il tetto 12 bloccava a torto \sqrt[13] e oltre.
    s = s.replace(/\\sqrt\s*\[\s*-(\d+)\s*\]\s*\{([^{}]*)\}/g, (_m, d: string, arg: string) =>
      "\u207B" + [...d].map((x) => "\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079"[+x]).join("") + "√(" + arg + ")");
    s = s.replace(/\\sqrt\s*\[\s*([5-9]|[1-9]\d)\s*\]\s*\{([^{}]*)\}/g, (_m, d: string, arg: string) =>
      [...d].map((x) => "\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079"[+x]).join("") + "√(" + arg + ")");
    s = s.replace(/\\sqrt\s*\[\s*3\s*\]\s*\{([^{}]*)\}/g, "∛($1)");
    s = s.replace(/\\sqrt\s*\[\s*4\s*\]\s*\{([^{}]*)\}/g, "∜($1)");
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)⁄($2)");
    if (s === previous) break;
  }
  s = s.replace(/\\sqrt/g, "√");
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\cdot|\\times|\\bullet/g, "*");
  s = s.replace(/\\div/g, ":");
  /* (09/11-fix, collaudo utente 9094: il periodico della FOTO sparisce) la
   *  IA trascrive 1,3\overline{3} oppure 1,3̅ (3 + U+0305 barra combinante):
   *  entrambe vanno convertite in \overline{3}, che il parser dell'app
   *  riconosce — prima la strip dei comandi LaTeX e il filtro finale
   *  cancellavano la barra e il pezzo diventava 1,3 (periodico perso). */
  s = canonicalizePeriodicNotation(s);
  s = s.replace(/\\(?:overline|bar)\s*\{(\d+)\}/gi, (_m, d: string) => `\\overline{${d}}`);
  // altri comandi LaTeX: via, MA il periodico \overline{n} resta (mai inventare simboli)
  s = s.replace(/\\(?!overline\b|bar\b)[a-zA-Z]+/g, "");
  // simboli Unicode comuni → notazione interna
  s = s.replace(/[×⋅•∗·]/g, "*");
  s = s.replace(/÷/g, ":");
  s = s.replace(/[−–—]/g, "-");
  // (10/11) gli apici che formano l'INDICE di una radice (⁵√, ⁻³√) NON si
  // convertono in ^: restano tali perché il parser li legga come indice.
  s = s.replace(/(⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)(√?)/g, (_m, apici: string, rad: string) =>
    rad === "√"
      ? apici + rad
      : "^" + [...apici].map((ch) => (ch === "⁻" ? "-" : "0123456789"["⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(ch)])).join(""));
  s = s.replace(/\$/g, "");
  // niente spazi; lettere sempre minuscole (convenzione dell'app)
  s = s.replace(/\s+/g, "").toLowerCase();
  // tieni SOLO i caratteri ammessi: tutto il resto (spurio dell'IA) via
  // (09/11-fix) «\» incluso: serve a \overline{n} del numero periodico
  // (10/11) ammessi anche gli apici dell'indice di radice (⁵√, ⁻³√)
  s = s.replace(/[^0-9a-z+\-*/:^⁄()[\]{}√∛∜=.,?\\⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "");
  return s;
}

/** Un'espressione trascritta è utilizzabile se ha almeno un numero/lettera
 *  e almeno un operatore o simbolo strutturale — OPPURE se è un NUMERO SOLO:
 *  (26/10-fix) nella terza pagina il risultato scritto a mano è spesso un
 *  numero senza operatori («12», «5», «71/27», «-1,73») e prima veniva
 *  rifiutato, mostrando il falso errore «L'IA non ha letto bene» anche
 *  quando la trascrizione era perfetta. */
export function aiExpressionPlausible(expr: string): boolean {
  if (!expr || !/[0-9a-z]/.test(expr)) return false;
  // numero puro: intero, decimale (virgola o punto) o frazione, con segno
  if (/^-?\d+([.,]\d+)?(\/\d+([.,]\d+)?)?$/.test(expr)) return true;
  // (26/10-bis) risposta SIMBOLICA con lettere (es. «9a», «3ab», «22a^3b»):
  // è utilizzabile così com'è — NON serve nessun operatore. Prima veniva
  // rifiutata qui e il box mostrava il falso «L'IA non ha letto bene»
  // invece di pubblicare il valore (giusto o sbagliato che sia).
  if (/[a-z]/.test(expr)) return true;
  return /[+\-*/:^⁄(=√]/.test(expr);
}
