/**
 * keyboardNotation.ts — regole di TRASCRIZIONE DA TASTIERA nell'editor dei
 * pezzi (giro 26), le stesse dell'app del Dettato Matematico
 * (github.com/andreakeating1982/AUDIO-MATEMATICI, richieste dall'utente):
 *
 *   :         divisione (i due punti, mai la barra)
 *   *         moltiplicazione → il puntino · (mai la lettera x)
 *   3/4       frazione IMPILATA → 3⁄4 (frazione slash U+2044)
 *   ^2        esponente (esponenti negativi: x^-2)
 *   rad2      radice quadrata √  (anche sqrt e radq)
 *   rad3      radice cubica ∛
 *   rad4      radice quarta ∜
 *
 * La notazione risultante è quella che il parser di lib/espressioni.ts
 * accetta già (· : ⁄ ^ √ ∛ ∜): la conversione avviene MENTRE si digita
 * (come nell'app audio) e di nuovo al salvataggio, come rete di sicurezza.
 */

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
  let t = s ?? "";
  // guardia: senza backslash E senza graffe non c'è nulla da sanificare
  // (le graffe sole contano: l'IA scrive anche «x^{2}» senza comandi)
  if (!t.includes("\\") && !t.includes("{")) return t;
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
  return t;
}

function baseNormalize(s: string, display: boolean): string {
  let t = sanitizeLatexNotation((s ?? "").replace(/\u00a0/g, " "));
  if (!t.trim()) return "";
  // niente spazi: la notazione dell'app è compatta (il parser li toglie comunque)
  t = t.replace(/\s+/g, "");
  // radici: sqrt/radq/rad2 → √ (quadrata), rad3 → ∛ (cubica), rad4 → ∜ (quarta)
  t = t.replace(/(?:sqrt|radq|rad2)/gi, "√");
  t = t.replace(/rad3/gi, "∛");
  t = t.replace(/rad4/gi, "∜");
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
  ": diviso · * per · 3/4 frazione impilata · ^2 potenza · rad2 radice quadrata · rad3 cubica · rad4 quarta";

/** Suggerimento con le regole del pannello (giro 28): qui la barra è
 *  sempre frazione impilata e i due punti scritti si mostrano come «÷» */
export const keyboardDisplayHint =
  ": diviso (si mostra ÷) · / frazione impilata · * per · ^2 potenza · rad2 radice quadrata · rad3 cubica · rad4 quarta · = si ignora tutto ciò che segue (si calcola solo la parte prima)";
