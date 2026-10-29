/** Pulizia della trascrizione IA (giro 20) — modulo PURO, provabile in Node.
 *
 *  La risposta dell'IA (vision) può arrivare in LaTeX, con simboli Unicode o
 *  con piccole impurità di formato: qui si riporta alla NOTAZIONE INTERNA
 *  dell'app (espressioni.ts accetta + - * : ^ ⁄ ( ) [ ] { } √ =).
 *
 *  ⚠️ MAI aggiungere nulla: i simboli sconosciuti si TOLGONO (se il modello
 *  scrive «?» resta nel testo: l'utente lo corregge — l'app non inventa). */

export function cleanAiExpression(raw: string): string {
  let s = (raw ?? "").trim();
  // markdown / recinti di codice
  s = s.replace(/```[a-z]*/gi, "").replace(/```/g, "");
  // LaTeX frazioni → (a)⁄(b) — tre passate per le frazioni annidate
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)⁄($2)");
  }
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");
  s = s.replace(/\\sqrt/g, "√");
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\^\{([^{}]*)\}/g, "^$1");
  s = s.replace(/\\cdot|\\times|\\bullet/g, "*");
  s = s.replace(/\\div/g, ":");
  // altri comandi LaTeX: via (mai inventare simboli)
  s = s.replace(/\\[a-zA-Z]+/g, "");
  // simboli Unicode comuni → notazione interna
  s = s.replace(/[×⋅•∗·]/g, "*");
  s = s.replace(/÷/g, ":");
  s = s.replace(/[−–—]/g, "-");
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (ch) => "^" + "0123456789"["⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(ch)]);
  s = s.replace(/\$/g, "");
  // niente spazi; lettere sempre minuscole (convenzione dell'app)
  s = s.replace(/\s+/g, "").toLowerCase();
  // tieni SOLO i caratteri ammessi: tutto il resto (spurio dell'IA) via
  s = s.replace(/[^0-9a-z+\-*/:^⁄()[\]{}√∛∜=.,?]/g, "");
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
