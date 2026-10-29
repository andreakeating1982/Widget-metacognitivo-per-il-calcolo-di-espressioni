import { useCallback, useRef, useState } from "react";
import { MathDrawCanvas, type Stroke } from "@/components/MathDrawCanvas";
import { FractionDisplay } from "@/components/FractionDisplay";
import { useMathRecognition } from "@/hooks/useMathRecognition";
import { stripSpuriousFractionMinus } from "@/lib/inkSigns";
import { aiTranscribeImage, AiUnavailableError, strokesToDataUrl } from "@/lib/aiTranscribe";
import { cn } from "@/lib/utils";
import { latexToNotation } from "@/components/SymbolInkInput";
import CalculatorPanel from "@/components/CalculatorPanel";
import katex from "katex";

// ─── Helpers ──────────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  if (b === 0) return a;
  return gcd(b, a % b);
}

function numberToFractionDisplay(value: number): string {
  if (isNaN(value)) return "?";
  if (Math.abs(value) < 1e-10) return "0";
  const sign = value < 0 ? "-" : "";
  const absValue = Math.abs(value);
  for (let denominator = 1; denominator <= 1000; denominator++) {
    const numerator = Math.round(absValue * denominator);
    if (Math.abs(absValue - numerator / denominator) < 1e-6) {
      const g = gcd(numerator, denominator);
      const fn = numerator / g;
      const fd = denominator / g;
      if (fd === 1) return `${sign}${fn}`;
      return `${sign}${fn}/${fd}`;
    }
  }
  return `${sign}${absValue.toFixed(2)}`;
}

/** Scomponi un numero in {num, den} per FractionDisplay (null se non trovata) */
function numberToFractionParts(value: number): { num: number; den: number } | null {
  if (isNaN(value)) return null;
  if (Math.abs(value) < 1e-10) return { num: 0, den: 1 };
  const sign = value < 0 ? -1 : 1;
  const absValue = Math.abs(value);
  for (let denominator = 1; denominator <= 1000; denominator++) {
    const numerator = Math.round(absValue * denominator);
    if (Math.abs(absValue - numerator / denominator) < 1e-6) {
      const g = gcd(numerator, denominator);
      return { num: sign * (numerator / g), den: denominator / g };
    }
  }
  return null;
}

/** Converte un numero in stringa decimale con virgola, arrotondato a 2 cifre */
/** Quick KaTeX render — default displayMode:true per una resa corretta delle frazioni */
function renderKatex(latex: string, displayMode: boolean = true): string {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false, strict: false });
  } catch { return latex; }
}

function toDecimalString(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  // Se il valore arrotondato è un intero esatto, niente virgola né decimali
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return Math.round(rounded).toString();
  }
  const str = rounded.toFixed(2);
  return str.replace(".", ",");
}

/** Verifica se un numero è razionale (decimale finito o periodico).
 *  Cerca una frazione con denominatore ≤ 100 che approssimi il valore entro 1e-9.
 *  Per valori irrazionali (es. √2≈1,4142...) nessuna frazione piccola corrisponde. */
function isRationalCheck(value: number): boolean {
  if (isNaN(value)) return false;
  if (Math.abs(value) < 1e-10) return true; // 0 è razionale
  const absValue = Math.abs(value);
  for (let den = 1; den <= 100; den++) {
    const num = Math.round(absValue * den);
    if (Math.abs(absValue - num / den) < 1e-9) {
      return true;
    }
  }
  return false;
}

/** Frazione generatrice del decimale ARROTONDATO a 2 cifre.
 *  Es. √2≈1,41 → 141/100;  7/4=1,75 → 7/4. Sempre esatta. */
function numberToFractionFromRounded(value: number): { num: number; den: number } | null {
  if (isNaN(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded) < 1e-10) return { num: 0, den: 1 };
  const sign = rounded < 0 ? -1 : 1;
  const absValue = Math.abs(rounded);
  const numerator = Math.round(absValue * 100);
  const denominator = 100;
  const g = gcd(numerator, denominator);
  return { num: sign * (numerator / g), den: denominator / g };
}

// ─── LaTeX expression evaluator ───────────────────────────────────
// Valuta espressioni LaTeX con \frac, \sqrt, divisioni e numeri.

/** (26/10, app UNIVERSALE): il campo ✎ accetta anche LETTERE (es. 5x,
 *  x^2+2x, 3x/4). Se il testo contiene lettere non è un numero: si pubblica
 *  il testo simbolico così com'è (riconosciuto dal genitore con il
 *  confronto per forma), senza tentare la valutazione numerica. */
export function containsLetters(s: string): boolean {
  return /[a-zA-Zα-ωΑ-Ω]/.test(s ?? "");
}

/** Converte la sintassi da tastiera del widget in sintassi valutabile.
 *  Stesse 5 regole del pulsante ISTRUZIONI PER SCRIVERE DA TASTIERA:
 *  «:» divisione, «*» moltiplicazione, «/» frazione impilata, «^n» potenza,
 *  «rad2/rad3/rad4» radici. Accetta anche i simboli già convertiti
 *  (÷ · ⁄ √ ∛ ∜) nel caso l'utente li incolli. */
/* (26/10) esportata: la pagina 3 la riusa per confrontare le risposte
   con radicali scritte da tastiera (es. "3rad2(15)", "3sqrt15"). */
export function normalizeTypedValueNotation(s: string): string {
  let t = (s ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, "");
  if (!t) return t;
  // radici testuali (rad2/radq/sqrt → quadrata, rad3 → cubica, rad4 → quarta)
  t = t.replace(/(?:sqrt|radq|rad2)\s*\(\s*([^{}()]+?)\s*\)/gi, "√($1)");
  t = t.replace(/rad3\s*\(\s*([^{}()]+?)\s*\)/gi, "∛($1)");
  t = t.replace(/rad4\s*\(\s*([^{}()]+?)\s*\)/gi, "∜($1)");
  t = t.replace(/(?:sqrt|radq|rad2)([0-9]+(?:[.,][0-9]+)?)/gi, "√$1");
  t = t.replace(/rad3([0-9]+(?:[.,][0-9]+)?)/gi, "∛$1");
  t = t.replace(/rad4([0-9]+(?:[.,][0-9]+)?)/gi, "∜$1");
  // simboli già convertiti (da incolla) → ASCII valutabile
  t = t.replace(/[−–—]/g, "-").replace(/×/g, "*").replace(/·/g, "*").replace(/÷/g, ":").replace(/\u2044|⁄/g, "/");
  // divisione coi due punti → barra (la valutazione usa «/»)
  t = t.replace(/:/g, "/");
  return t;
}

/** Estrai il contenuto tra graffe bilanciate a partire da pos */
function extractBraced(s: string, pos: number): { inner: string; end: number } | null {
  if (pos >= s.length || s[pos] !== '{') return null;
  let depth = 0;
  let i = pos;
  while (i < s.length) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) return { inner: s.slice(pos + 1, i), end: i + 1 };
    }
    i++;
  }
  return null;
}

/** Valuta ricorsivamente una stringa LaTeX → numero */
export function evaluateLatex(latex: string): number | null {
  // Normalizza moltiplicatori, decimali, e comandi decorativi
  let s = latex.trim().replace(/\s+/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/\\,/g, '.')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\displaystyle/g, '');
  // Converti \dfrac e \tfrac in \frac
  s = s.replace(/\\(?:dfrac|tfrac)\{/g, '\\frac{');
  // Converti {num} \over {den} → \frac{num}{den} (TeX primitiva, ancora usata da alcuni recognizer)
  s = s.replace(/\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*\\over\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '\\frac{$1}{$2}');
  // (25/10) esponenti tra GRAFFE (latex dal riconoscimento a mano, es. 3^{2},
  // (1/3)^{-2}): si normalizzano in ^2 / ^-2 PRIMA di ogni ramo, così anche
  // l'esponente dopo una frazione impilata (\frac{1}{3}^{-2} → 9) viene
  // valutato. È ciò che rende accettabili più RISULTATI EQUIVALENTI a valore:
  // 9 = 3^2 = (1/3)^-2 (richiesta esplicita dell'utente).
  s = s.replace(/\^\{(-?\d+(?:[.,]\d+)?)\}/g, '^$1');
  if (!s) return null;

  // ── 1. Outermost \frac{num}{den} ──────────────────────────────
  if (s.startsWith('\\frac{')) {
    const numBrace = extractBraced(s, 5); // after \frac
    if (!numBrace) return null;
    const denBrace = extractBraced(s, numBrace.end);
    if (!denBrace) return null;
    // Ensure nothing follows the second brace (or only whitespace)
    const rest = s.slice(denBrace.end).trim();
    if (rest && !rest.startsWith('/')) {
      // Extra stuff after \frac{}{} — not a pure fraction
    }
    const num = evaluateLatex(numBrace.inner);
    const den = evaluateLatex(denBrace.inner);
    if (num !== null && den !== null && den !== 0) {
      let val = num / den;
      // If there's trailing /something, continue
      if (rest.startsWith('/')) {
        const restVal = evaluateLatex(rest.slice(1));
        if (restVal !== null && restVal !== 0) return val / restVal;
        return null;
      }
      // (25/10) esponente DOPO la frazione impilata (es. \frac{1}{3}^{-2} → 9):
      // senza questo il valore dell'esponente veniva ignorato e (1/3)^-2
      // risultava 1/3 invece di 9 (risultati equivalenti accettati a valore).
      if (rest.startsWith('^')) {
        const mE = rest.slice(1).match(/^(-?\d+(?:[.,]\d+)?)/);
        if (!mE) return null;
        val = Math.pow(val, parseFloat(mE[1].replace(',', '.')));
        const rest2 = rest.slice(1 + mE[1].length);
        if (rest2) return null;
      }
      return val;
    }
    return null;
  }

  // ── 3. Outermost \sqrt{expr} ──────────────────────────────────
  if (s.startsWith('\\sqrt{')) {
    const br = extractBraced(s, 5);
    if (!br) return null;
    const rest = s.slice(br.end).trim();
    const inner = evaluateLatex(br.inner);
    if (inner !== null && inner >= 0) {
      const val = Math.sqrt(inner);
      if (rest.startsWith('/')) {
        const restVal = evaluateLatex(rest.slice(1));
        if (restVal !== null && restVal !== 0) return val / restVal;
        return null;
      }
      return val;
    }
    return null;
  }

  // ── 3. Addition / subtraction at top level (outside braces) ────
  // MUST come BEFORE leading-minus so that -4+√24 = (-4)+(√24) not -(4+√24)
  let braceDepth2 = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === '}') braceDepth2++;
    else if (s[i] === '{') braceDepth2--;
    else if (braceDepth2 === 0 && (s[i] === '+' || s[i] === '-') && i > 0) {
      const left = evaluateLatex(s.slice(0, i));
      const right = evaluateLatex(s.slice(i + 1));
      if (left !== null && right !== null) {
        return s[i] === '+' ? left + right : left - right;
      }
    }
  }

  // ── 4. Leading minus (safe: only if no top-level + or - operator) ──
  if (s.startsWith('-')) {
    const inner = evaluateLatex(s.slice(1));
    return inner !== null ? -inner : null;
  }

  // ── 5. Implicit multiplication: X\sqrt{Y} at top level ─────────
  let braceDepth2b = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') braceDepth2b++;
    else if (s[i] === '}') braceDepth2b--;
    else if (braceDepth2b === 0 && s.slice(i).startsWith('\\sqrt{') && i > 0) {
      const charBefore = s[i - 1];
      if (/^[0-9a-zA-Z.\)}]$/.test(charBefore)) {
        const leftPart = s.slice(0, i);
        const rightPart = s.slice(i);
        const left = evaluateLatex(leftPart);
        const right = evaluateLatex(rightPart);
        if (left !== null && right !== null) return left * right;
        break;
      }
    }
  }

  // (25/10) parentesi tonde PIATTE intorno all'espressione (es. (1/3)^-2):
  // si valuta il contenuto interno.
  if (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0;
    let balanced = true;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') {
        depth--;
        if (depth === 0 && i < s.length - 1) {
          balanced = false;
          break;
        }
      }
      if (depth < 0) {
        balanced = false;
        break;
      }
    }
    if (balanced && depth === 0) {
      const inner = evaluateLatex(s.slice(1, -1));
      return inner;
    }
  }

  // ── 4b. Potenza con ^ (sintassi da tastiera, es. 2^3 → 8) ─────────
  // Cerca '^' non racchiuso tra graffe, a destra l'esponente (con eventuale segno)
  let bdPow = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') bdPow++;
    else if (s[i] === '}') bdPow--;
    else if (s[i] === '^' && bdPow === 0 && i > 0 && i < s.length - 1) {
      const mExp = s.slice(i + 1).match(/^(-?\d+(?:[.,]\d+)?)/);
      if (mExp) {
        const base = evaluateLatex(s.slice(0, i));
        const exp = parseFloat(mExp[1].replace(',', '.'));
        const rest2 = s.slice(i + 1 + mExp[1].length);
        if (base !== null && !isNaN(exp)) {
          const val = Math.pow(base, exp);
          if (!rest2) return val;
        }
        break;
      }
    }
  }

  // ── 4c. Moltiplicazione con * (sintassi da tastiera, es. 3*4 → 12) ─
  let bdMul = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') bdMul++;
    else if (s[i] === '}') bdMul--;
    else if (s[i] === '*' && bdMul === 0 && i > 0 && i < s.length - 1) {
      const a = evaluateLatex(s.slice(0, i));
      const b = evaluateLatex(s.slice(i + 1));
      if (a !== null && b !== null) return a * b;
      break;
    }
  }

  // ── 4d. Radici con simboli √ ∛ ∜ (da sintassi rad2/rad3/rad4) ─────
  if (s.startsWith('√(') || s.startsWith('∛(') || s.startsWith('∜(')) {
    const sym = s[0];
    let depth3 = 0;
    for (let i = 1; i < s.length; i++) {
      if (s[i] === '(') depth3++;
      else if (s[i] === ')') {
        if (depth3 === 1) {
          const inner = evaluateLatex(s.slice(2, i));
          if (inner !== null && inner >= 0) {
            const val = sym === '√' ? Math.sqrt(inner) : sym === '∛' ? Math.cbrt(inner) : Math.pow(inner, 1 / 4);
            const rest = s.slice(i + 1).trim();
            if (!rest) return val;
          }
          return null;
        }
        if (depth3 === 0) return null;
        depth3--;
      }
    }
    return null;
  }
  {
    const mRoot = s.match(/^([√∛∜])(-?\d+(?:[.,]\d+)?)$/);
    if (mRoot) {
      const inner = parseFloat(mRoot[2].replace(',', '.'));
      if (!isNaN(inner) && inner >= 0) {
        return mRoot[1] === '√' ? Math.sqrt(inner) : mRoot[1] === '∛' ? Math.cbrt(inner) : Math.pow(inner, 1 / 4);
      }
      return null;
    }
  }
  // ── 4d-bis. COEFFICIENTE davanti alla radice (k·√…): «3√(15)», «3√15»,
  // «2√(9)» — la foto utente «3 radice di 15 data per sbagliata» veniva
  // valutata 3 (parseFloat si fermava al 3 e buttava la radice). Ora il
  // coefficiente moltiplica la radice pura (ricorsione: «√(15)» la valuta
  // il ramo 4d qui sopra, senza rischio di loop — lì non c'è cifra davanti).
  {
    const mCoef = s.match(/^(-?\d+(?:[.,]\d+)?)\s*([√∛∜])(.*)$/);
    if (mCoef) {
      const coef = parseFloat(mCoef[1].replace(',', '.'));
      const rad = evaluateLatex(mCoef[2] + mCoef[3]);
      if (!isNaN(coef) && rad !== null) return coef * rad;
      return null;
    }
  }

  // ── 5. Inline division a/b (only at top level, NOT inside braces) ─
  // Cerca '/' non racchiuso tra graffe
  let braceDepth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') braceDepth++;
    else if (s[i] === '}') braceDepth--;
    else if (s[i] === '/' && braceDepth === 0 && i > 0 && i < s.length - 1) {
      const a = evaluateLatex(s.slice(0, i));
      const b = evaluateLatex(s.slice(i + 1));
      if (a !== null && b !== null && b !== 0) return a / b;
      // If division fails, fall through to try plain number
      break;
    }
  }

  // ── 6. sqrt(…) — plain text format ──────────────────────────────
  if (s.startsWith('sqrt(')) {
    let depth2 = 0;
    for (let i = 4; i < s.length; i++) {
      if (s[i] === '(') depth2++;
      else if (s[i] === ')') {
        if (depth2 === 0) {
          const inner = evaluateLatex(s.slice(5, i));
          if (inner !== null && inner >= 0) {
            const val = Math.sqrt(inner);
            const rest = s.slice(i + 1).trim();
            if (rest.startsWith('/')) {
              const restVal = evaluateLatex(rest.slice(1));
              if (restVal !== null && restVal !== 0) return val / restVal;
              return null;
            }
            return val;
          }
          return null;
        }
        depth2--;
      }
    }
    return null;
  }

  // ── 7. Plain number ────────────────────────────────────────────
  s = s.replace(/,/g, '.');
  const num = parseFloat(s);
  if (!isNaN(num)) return num;

  return null;
}

/** Estrai la forma radicale visiva dal LaTeX riconosciuto.
 *  Restituisce una stringa leggibile e pulita (senza parentesi inutili). */
function extractRadicalForm(latex: string): string | null {
  const s = latex.trim().replace(/\s+/g, '');
  if (!s.includes('\\sqrt')) return null;
  // Sostituisci \frac{a}{b} → a/b (SENZA parentesi esterne)
  let out = s.replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '$1/$2');
  // Sostituisci \sqrt{x} → √x (solo se x è semplice), altrimenti √(x)
  out = out.replace(/\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_m, inner: string) => {
    if (/^[0-9a-zA-Z.]+$/.test(inner)) return `√${inner}`;
    return `√(${inner})`;
  });
  // Pulisci graffe residue
  out = out.replace(/[{}]/g, '');
  return out;
}

// ─── Fraction from LaTeX ──────────────────────────────────────────
// Extract a \frac{num}{den} from LaTeX and return numerator/denominator.
// Returns null if the LaTeX does not represent a simple fraction.

interface ExtractedFraction {
  numerator: number;
  denominator: number;
  isNegative: boolean;
}

/** (26/10-fix mano→IA) Converte la TRASCRIZIONE IA di un tratto a mano
 *  nel «risultato» atteso dal box numerico (stessa forma del motore
 *  statico: { latex }). L'IA scrive la notazione interna del widget
 *  (es. «3⁄4», «-2», «√9», «2^3», «1:2» — mai LaTeX, mai «?» qui: i «?»
 *  danno null). Stesse regole del campo DIGITA IL VALORE, più la
 *  frazione impilata preservata (num⁄den scritti a mano). MAI inventare:
 *  nessun valore se il testo non si valuta in un numero.
 *  Le LETTERE (box simbolici) si pubblicano via onSymbolicValue e qui
 *  valgono null. */
function aiResultFromNotation(notation: string): { latex: string } | null {
  try {
    const raw = (notation ?? "").trim();
    if (!raw || raw.includes("?")) return null;
    let t = normalizeTypedValueNotation(raw).trim();
    if (!t) return null;
    /* (26/10-fix) OMONIMI DELLE CIFRE su SIMBOLO SINGOLO: in questo box il
       risultato è SEMPRE un numero — se l'IA legge un solo simbolo omonimo
       di una cifra (es. il tratto verticale «1» letto «l»/«I»/«|»), è quella
       cifra. Stessa mappa dei DIGIT_FIXES qui sotto. */
    const SINGOLO_CIFRA: Record<string, string> = {
      "l": "1", "I": "1", "i": "1", "|": "1", "\\ell": "1",
      "o": "0", "O": "0", "\\theta": "0",
      "g": "9", "q": "9", "G": "9", "Q": "9",
      "s": "5", "S": "5", "z": "2", "Z": "2",
      "b": "6", "B": "8",
    };
    t = SINGOLO_CIFRA[t] ?? t;
    if (/[a-z∛∜]/i.test(t)) return null;
    // La valutazione del box usa «/»: la barra impilata ⁄ va in ASCII.
    const ascii = t.replace(/\u2044|⁄/g, "/");
    const ev = evaluateLatex(ascii);
    if (ev === null || !isFinite(ev)) return null;
    const isFrac = ascii.includes("/");
    const isRoot = /√|\\sqrt/.test(ascii);
    if (isFrac && !isRoot) {
      const frac = extractFractionFromLatex(ascii);
      if (frac) {
        const sign = frac.isNegative || ev < 0 ? "-" : "";
        return { latex: `\\frac{${sign}${frac.numerator}}{${frac.denominator}}` };
      }
    }
    return { latex: String(ev) };
  } catch {
    return null;
  }
}

function extractFractionFromLatex(latex: string): ExtractedFraction | null {
  let s = latex.replace(/\s+/g, "");
  s = s.replace(/,/g, ".");

  // Rileva il segno meno FUORI dalla frazione (es. -\frac{7}{4})
  let globalNegative = false;
  if (s.startsWith("-")) {
    globalNegative = true;
    s = s.slice(1);
  }

  // Match \frac, \dfrac, \tfrac{num}{den}
  const fracMatch = s.match(/\\(?:frac|dfrac|tfrac)\{([^{}]+)\}\{([^{}]+)\}/);
  if (!fracMatch) return null;

  const numStr = fracMatch[1].replace(/[{}]/g, "").trim();
  const denStr = fracMatch[2].replace(/[{}]/g, "").trim();

  // Rileva eventuali meno interni a numeratore e denominatore
  const numNegative = numStr.startsWith("-");
  const denNegative = denStr.startsWith("-");
  const numClean = numNegative ? numStr.slice(1) : numStr;
  const denClean = denNegative ? denStr.slice(1) : denStr;

  const num = parseFloat(numClean);
  const den = parseFloat(denClean);
  if (isNaN(num) || isNaN(den) || den === 0) return null;

  // XOR a tre: la frazione è negativa se c'è un numero dispari di segni meno
  const isNegative = (globalNegative !== numNegative) !== denNegative;

  return { numerator: num, denominator: den, isNegative };
}

// ─── Props ────────────────────────────────────────────────────────

interface NumberInputCanvasProps {
  value: number | null;
  onChange: (value: number | null) => void;
  label: React.ReactNode;
  hint?: string;
  colorClass?: string;
  className?: string;
  allowNegative?: boolean;
  /* (26/10) modalità SIMBOLICA: per i box con lettere. Il testo con lettere
     non diventa un numero: viene pubblicato così com'è via onSymbolicValue
     (il genitore lo confronta per forma). Canvas e RICONOSCI restano per i
     casi misti, ma il confronto simbolico usa solo questo testo. */
  symbolicValue?: string;
  onSymbolicValue?: (t: string | null) => void;
  /* (26/10) risposta SBAGLIATA già pubblicata: il valore pubblicato NON si
     mostra (mai rivelare il numero errato, es. «−1,73») — resta solo il
     messaggio «RISULTATO SBAGLIATO. CALCOLA DI NUOVO» del box */
  hideValue?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// NumberInputCanvas — handwriting canvas → fraction-aware number
// ═══════════════════════════════════════════════════════════════════

export function NumberInputCanvas({
  value,
  onChange,
  label,
  hint: _hint,
  colorClass = "text-foreground",
  className,
  allowNegative = true,
  symbolicValue,
  onSymbolicValue,
  hideValue = false,
}: NumberInputCanvasProps) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [isRecognizing, setIsRecognizing] = useState(false);

  // Fraction state — preserved even after canvas clears
  const [fracNum, setFracNum] = useState<number | null>(null);
  const [fracDen, setFracDen] = useState<number | null>(null);
  const [fracNeg, setFracNeg] = useState(false);
  const [decimalStr, setDecimalStr] = useState<string | null>(null);
  const [radicalLatex, setRadicalLatex] = useState<string | null>(null);
  const [eraserMode, setEraserMode] = useState(false);
  const [hasPlusMinusSign, setHasPlusMinusSign] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLatex, setEditLatex] = useState('');
  // (26/10) CALCOLATRICE: pannello Desmos sovrapposto, disponibile in ogni box
  const [calcAperta, setCalcAperta] = useState(false);
  // (24/10) istruzioni da tastiera dietro pulsante, come nel resto del widget
  const [valueLegendOpen, setValueLegendOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  // Frazione generatrice del decimale arrotondato (terza forma)
  const [roundFracNum, setRoundFracNum] = useState<number | null>(null);
  const [roundFracDen, setRoundFracDen] = useState<number | null>(null);
  const [roundFracNeg, setRoundFracNeg] = useState(false);
  // Flag: il valore riconosciuto è razionale? (solo se sì mostriamo la frazione generatrice)
  const [isValueRational, setIsValueRational] = useState(false);
  // Flag: l'input è un decimale puro (nessun \frac né \sqrt)? → mostra solo il decimale
  const [isPlainDecimalInput, setIsPlainDecimalInput] = useState(false);
  /* (26/10, richiesta utente — anti-scarabocchi): finché il canvas non ha
     misurato il contenitore non è pronto a ricevere la scrittura (le
     coordinate sarebbero sbagliate e lo studente traccerebbe scarabocchi
     prima che il canvas si assesti). Il velo di MathDrawCanvas blocca il
     disegno; qui si disattivano anche tastiera e RICONOSCI. */
  const [canvasPronto, setCanvasPronto] = useState(false);

  const { recognize, isModelReady, isLoading } = useMathRecognition();

  const handleStrokesChange = useCallback(
    (newStrokes: Stroke[]) => {
      setStrokes(newStrokes);
      if (newStrokes.length === 0) {
        setRecognizedText("");
        // Se l'utente ha cancellato tutto con la gomma, esci automaticamente dalla modalità gomma
        setEraserMode(false);
      }
    },
    [],
  );

  /* (26/10-fix) RICONOSCE L'IA, non più il modello statico ONNX che
     sbagliava troppo spesso: i tratti diventano un'immagine e l'IA vision
     li TRASCRIVE soltanto (mai calcolare), poi il valore si ricava col
     parser esatto di espressioni.ts. Motore statico solo come soccorso. */
  const handleManualRecognize = useCallback(async () => {
    if (strokes.length === 0) return;
    setIsRecognizing(true);

    let aiNotation: string | null = null;
    try {
      const dataUrl = strokesToDataUrl(strokes);
      /* (26/10-bis) bias per uso: nei box simbolici (con LETTERE) le lettere
         vanno trascritte ESATTE (mai a→2, b→6, z→2); nei box numerici resta
         il bias cifra (tratto verticale = 1, non l). Anche per questo il
         risultato sbagliato ora viene pubblicato e giudicato invece di dare
         il falso «IA non ha letto bene». */
      aiNotation = await aiTranscribeImage(dataUrl, "ink", onSymbolicValue ? "lettera" : "cifra");
      setRecognizedText("");
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) {
        // L'IA ha risposto ma la trascrizione non è utilizzabile:
        // niente invenzioni, lo dice e resta il tratto da correggere.
        resetFraction();
        setRecognizedText("L'IA non ha letto bene: riscrivi più grande e chiaro");
        setIsRecognizing(false);
        return;
      }
      // IA non raggiungibile: soccorso col motore statico locale.
    }
    // Null = IA non disponibile → vecchio motore statico come soccorso.
    // La trascrizione IA (notazione interna del widget: stesse regole del
    // campo DIGITA — «: * / ^n rad2/rad3/rad4») si valuta col parser esatto
    // (mai col LaTeX del modello). Le lettere si pubblicano come simboliche.
    let result = aiNotation != null ? aiResultFromNotation(aiNotation) : await recognize(strokes, "expression");
    // «±» scritto a mano? (vale per entrambe le vie)
    if (aiNotation != null) {
      const pm = /\\\\pm|\\\\mp|±/.test(aiNotation) || /\\b(pm|mp)\\b/i.test(aiNotation);
      setHasPlusMinusSign(pm);
      aiNotation = aiNotation.replace(/\\\\pm|\\\\mp|±/g, "").replace(/^\\+/, "");
    }
    /* (26/10-fix lettere a mano) RISULTATO CON NUMERI E LETTERE (es. 4a^2,
       22a^3b): se la trascrizione IA contiene lettere NON è un numero — si
       pubblica come testo simbolico con lo STESSO percorso della tastiera
       ✎ (il box con lettere lo confronta per forma con stessaForma).
       MAI valutare, MAI inventare: con «?» si riprova; niente modello
       statico numerico che manderebbe in garbage le lettere. */
    if (onSymbolicValue) {
      const t = (aiNotation != null
        ? aiNotation.replace(/\$/g, "").trim()
        : result?.latex
          ? latexToNotation(result.latex)
          : "").trim();
      /* (26/10-fix4, foto «2 dato per sbagliato»): una CIFRA scritta a mano
         e letta come lettera omonima (2→z, 9→g/q, 0→o, 1→l/i) NON è un
         testo con lettere: si converte nella cifra (stessa mappa del
         percorso numerico) e si prosegue lì. Restano simbolici i veri
         testi con lettere (a, b, x, 4a^2, 1/(2ab)…) e le lettere NON
         omonime di cifre. */
      const OMONIMI_CIFRE: Record<string, string> = {
        z: "2", Z: "2", g: "9", q: "9", G: "9", Q: "9",
        o: "0", O: "0", l: "1", i: "1", I: "1", L: "1",
      };
      const tPub = t.length === 1 && OMONIMI_CIFRE[t] ? OMONIMI_CIFRE[t] : t;
      if (tPub && !tPub.includes("?") && containsLetters(tPub)) {
        onSymbolicValue(tPub);
        setRecognizedText("");
        setStrokes([]);
        resetFraction();
        setIsRecognizing(false);
        return;
      }
    }
    // ⚠️ RIPROVA IN MODALITÀ «NUMERO» (27/9: «il riconoscimento dei numeri
    // è ancora terribile»): in questo box il risultato è SEMPRE un numero o
    // una frazione. Se la modalità «espressione» non produce niente di
    // valutabile, il pezzo viene riconosciuto di nuovo con il vocabolario
    // ridotto dei soli numeri (molto meno confondibile: l/i→1, o→0, g→9…).
    const evaluable = (r: { latex: string } | null): boolean => {
      if (!r) return false;
      const clean = r.latex
        .replace(/\\pm\s*/g, "")
        .replace(/\\mp\s*/g, "")
        .replace(/±/g, "")
        .replace(/^\+/, "")
        .replace(/\\(?:dfrac|tfrac)/g, "\\frac")
        .trim();
      const v = evaluateLatex(stripSpuriousFractionMinus(clean, strokes));
      return v !== null && isFinite(v);
    };
    if (result && !evaluable(result)) {
      const retry = await recognize(strokes, "number");
      if (evaluable(retry)) result = retry;
    }
    // Fallback: "number" mode for pure digits
    if (!result) {
      result = await recognize(strokes, "number");
    }

    if (result) {
      // ── Correggi errori comuni di riconoscimento dei digit (es. 9 → g, q, 4) ──
      // ⚠️ OMONIMI DELLE CIFRE (27/9): in questo box il pezzo è sempre un
      // numero — se il modello legge UNA SOLA lettera omonima, è una cifra
      // («9»→g/q/G/Q, «0»→o/O/θ, «1»→l/I/i/ℓ, «5»→s/S, «2»→z/Z, «8»→B/∞,
      // «6»→b). Stessa mappa di digitsFromNumberLatex (inkSigns.ts).
      const DIGIT_FIXES: Record<string, string> = {
        'g': '9',
        'q': '9',
        'G': '9',
        'Q': '9',
        '\\gamma': '9',
        '\\Gamma': '9',
        '\\operatorname{g}': '9',
        '\\operatorname{q}': '9',
        'o': '0',
        'O': '0',
        '\\theta': '0',
        '\\Theta': '0',
        '\\circ': '0',
        'l': '1',
        'I': '1',
        'i': '1',
        '|': '1',
        '\\ell': '1',
        's': '5',
        'S': '5',
        'z': '2',
        'Z': '2',
        'b': '6',
        'B': '8',
        '\\infty': '8',
      };
      const trimmedLatex = result.latex.trim();
      if (DIGIT_FIXES[trimmedLatex]) {
        result.latex = DIGIT_FIXES[trimmedLatex];
      }

      // L'utente ha scritto il simbolo ±?
      const hasPM = result.latex.includes('\\pm') || result.latex.includes('\\mp') || result.latex.includes('±');
      setHasPlusMinusSign(hasPM);

      // Rimuovi \pm / \mp / ± (Unicode) — non sono operazioni numeriche
      const cleanLatex = result.latex
        .replace(/\\pm\s*/g, '')
        .replace(/\\mp\s*/g, '')
        .replace(/±/g, '')
        .replace(/^\+/, '')
        .replace(/\\(?:dfrac|tfrac)/g, '\\frac') // normalizza \dfrac e \tfrac
        .trim();

      // ── 1. Valuta l'espressione LaTeX pulita (supporta √, \frac, /) ──
      // ⚠️ MENO SPURIO (segnalazione 27/9-bis): nella frazione impilata la
      // LINEA della frazione (o un pezzo di curva) può finire classificata
      // «−» → «−75/7» invece di «75/7» (e decimale «−10,71»). Se il LaTeX
      // ha un meno davanti a una frazione pura ma l'inchiostro non contiene
      // un meno VERO (solo la linea della frazione), il meno va scartato.
      const guardedLatex = stripSpuriousFractionMinus(cleanLatex, strokes);
      const evaluated = evaluateLatex(guardedLatex);

      if (evaluated !== null && isFinite(evaluated)) {
        // Controlla se c'è una frazione LaTeX pura (per il display preferito)
        const frac = extractFractionFromLatex(guardedLatex);
        if (frac && !cleanLatex.includes('\\sqrt')) {
          // Frazione semplice senza radice: usa num/den estratti
          setFracNum(frac.numerator);
          setFracDen(frac.denominator);
          setFracNeg(frac.isNegative);
        } else {
          // Calcola la frazione dal valore numerico
          const fp = numberToFractionParts(evaluated);
          if (fp) {
            setFracNum(Math.abs(fp.num));
            setFracDen(fp.den);
            setFracNeg(evaluated < 0);
          } else {
            resetFraction();
          }
        }

        // Forma decimale
        setDecimalStr(toDecimalString(evaluated));

        // Forma radicale: salva il LaTeX originale per il rendering KaTeX
        setRadicalLatex(result.latex.includes('\\sqrt') ? result.latex.trim().replace(/\s+/g, '') : null);

        // Input decimale puro? (nessun \frac né \sqrt → mostra solo il decimale)
        setIsPlainDecimalInput(!cleanLatex.includes('\\frac') && !cleanLatex.includes('\\sqrt'));

        // Frazione generatrice del decimale arrotondato (terza forma)
        const rfp = numberToFractionFromRounded(evaluated);
        if (rfp) {
          setRoundFracNum(Math.abs(rfp.num));
          setRoundFracDen(rfp.den);
          setRoundFracNeg(rfp.num < 0);
        } else {
          setRoundFracNum(null);
          setRoundFracDen(null);
          setRoundFracNeg(false);
        }

        setRecognizedText("");
        onChange(evaluated);
        setTimeout(() => setStrokes([]), 1400);
        setIsRecognizing(false);
        return;
      }

      // ── 2. Fallback avanzato: converti LaTeX in espressione JS valutabile ──
      let fallbackStr = cleanLatex.replace(/\s+/g, "");
      fallbackStr = fallbackStr.replace(/,/g, ".");

      // Converti \sqrt{x} → Math.sqrt(x)
      fallbackStr = fallbackStr.replace(
        /\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
        'Math.sqrt($1)',
      );
      // Converti \frac{a}{b} → (a)/(b) (parentesi per sicurezza)
      fallbackStr = fallbackStr.replace(
        /\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
        '($1)/($2)',
      );
      // Rimuovi \left, \right, \displaystyle, \mathrm, e comandi decorativi
      fallbackStr = fallbackStr
        .replace(/\\left/g, '')
        .replace(/\\right/g, '')
        .replace(/\\displaystyle/g, '')
        .replace(/\\mathrm\{([^{}]*)\}/g, '$1')
        .replace(/\\[a-zA-Z]+/g, ''); // altri comandi LaTeX residui
      // Pulisci graffe rimaste
      fallbackStr = fallbackStr.replace(/[{}]/g, '');

      if (!fallbackStr || fallbackStr === "-" || fallbackStr === ".") {
        setRecognizedText(result.latex || "?");
        resetFraction();
        setIsRecognizing(false);
        return;
      }

      // Prova a valutare come espressione JS (con Math.sqrt, +, -, *, /, parentesi)
      let parsed: number = NaN;
      try {
        // Sanitizza: permetti solo caratteri matematici sicuri
        const sanitized = fallbackStr.replace(/[^0-9.+\-*/()Math.sqrt]/g, '');
        // eslint-disable-next-line no-new-func
        const val = new Function('Math', `return ${sanitized}`)(Math);
        if (typeof val === 'number' && isFinite(val)) {
          parsed = val;
        }
      } catch {
        // Fallback evaluation failed
      }

      if (!isNaN(parsed)) {
        const fp = numberToFractionParts(parsed);
        if (fp) {
          setFracNum(Math.abs(fp.num));
          setFracDen(fp.den);
          setFracNeg(parsed < 0);
        } else {
          resetFraction();
        }
        setDecimalStr(toDecimalString(parsed));
        setRadicalLatex(null);
        setRecognizedText("");
        onChange(parsed);
        setTimeout(() => setStrokes([]), 1400);
      } else {
        resetFraction();
        // Mostra il LaTeX grezzo riconosciuto così l'utente può capire cosa è andato storto
        setRecognizedText(result.latex || "?");
      }
    } else {
      // ONNX recognition completamente fallita: dai un feedback chiaro
      resetFraction();
      setRecognizedText("Non riconosco. Riprova più grande e chiaro");
    }
    setIsRecognizing(false);
  }, [strokes, recognize, onChange, allowNegative, onSymbolicValue]);

  const resetFraction = useCallback(() => {
    setFracNum(null);
    setFracDen(null);
    setFracNeg(false);
    setDecimalStr(null);
    setRadicalLatex(null);
    setRecognizedText("");
    setRoundFracNum(null);
    setRoundFracDen(null);
    setRoundFracNeg(false);
    setIsPlainDecimalInput(false);
    setHasPlusMinusSign(false);
  }, []);

  /** Valuta LaTeX inserito manualmente via tastiera (stessa pipeline del riconoscimento) */
  const handleEditSubmit = useCallback(() => {
    if (!editLatex.trim()) { setIsEditing(false); return; }
    // (26/10) TESTO CON LETTERE: non è un numero — si pubblica come testo
    // simbolico (il box con lettere lo confronta per forma). Vale per la
    // tastiera del widget (: * / ^n rad2/rad3/rad4) e per il LaTeX a mano.
    if (onSymbolicValue && containsLetters(editLatex)) {
      onSymbolicValue(editLatex.trim());
      setIsEditing(false);
      setEditLatex('');
      return;
    }
    // (24/10) il campo DIGITA IL VALORE accetta la stessa sintassi da
    // tastiera del resto del widget (: * / ^n rad2/rad3/rad4)
    const clean = normalizeTypedValueNotation(editLatex)
      .replace(/\\pm\s*/g, '')
      .replace(/\\mp\s*/g, '')
      .replace(/±/g, '')
      .replace(/^\+/, '')
      .replace(/\\(?:dfrac|tfrac)/g, '\\frac')
      .trim();
    const ev = evaluateLatex(clean);
    if (ev !== null && isFinite(ev)) {
      const frac = extractFractionFromLatex(clean);
      if (frac && !clean.includes('\\sqrt')) {
        setFracNum(frac.numerator);
        setFracDen(frac.denominator);
        setFracNeg(frac.isNegative);
      } else {
        const fp = numberToFractionParts(ev);
        if (fp) { setFracNum(Math.abs(fp.num)); setFracDen(fp.den); setFracNeg(ev < 0); }
        else resetFraction();
      }
      setDecimalStr(toDecimalString(ev));
      setRadicalLatex(clean.includes('\\sqrt') ? clean : null);
      setIsPlainDecimalInput(!clean.includes('\\frac') && !clean.includes('\\sqrt'));
      const rfp = numberToFractionFromRounded(ev);
      if (rfp) { setRoundFracNum(Math.abs(rfp.num)); setRoundFracDen(rfp.den); setRoundFracNeg(rfp.num < 0); }
      else { setRoundFracNum(null); setRoundFracDen(null); setRoundFracNeg(false); }
      setRecognizedText('');
      onChange(ev);
    }
    setIsEditing(false);
    setEditLatex('');
  }, [editLatex, onChange, onSymbolicValue]);

  const handleClear = () => {
    setStrokes([]);
    setRecognizedText("");
    resetFraction();
    onChange(null);
  };

  const hasContent = strokes.length > 0;
  const showFraction = fracNum !== null && fracDen !== null;
  const showRoundFraction = roundFracNum !== null && roundFracDen !== null;
  /** Il valore è razionale (decimale finito/periodico)? Se no, niente frazione generatrice */
  const valueIsRational = value !== null && isRationalCheck(value);
  /** Se il valore è un intero esatto, mostriamo solo il badge intero senza decimali */
  const valueIsInteger = value !== null && Math.abs(value - Math.round(value)) < 1e-9;

  // Frazione semplificata (solo se riducibile)
  const simplificationGcd = showFraction && fracDen && fracDen > 1 ? gcd(fracNum!, fracDen!) : 1;
  const isSimplifiable = simplificationGcd > 1;
  const simplifiedFracLatex = isSimplifiable
    ? `${fracNeg ? '-' : ''}\\frac{${fracNum! / simplificationGcd}}{${fracDen! / simplificationGcd}}`
    : null;

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {/* Label (sopra il canvas) */}
      <span className={cn(
        "text-sm sm:text-base tracking-widest font-normal",
        colorClass,
      )}>
        {label}
      </span>

      {/* Canvas a tutta larghezza */}
      <div className="w-full h-[170px] sm:h-[200px] rounded-xl border-2 border-border bg-card shadow-sm overflow-hidden">
        <MathDrawCanvas
          strokes={strokes}
          onStrokesChange={handleStrokesChange}
          tool={eraserMode ? "erase" : "write"}
          className="border-0 rounded-none shadow-none ring-0"
          disabled={isLoading || isRecognizing}
          hideWatermark
          onReady={() => setCanvasPronto(true)}
        />
      </div>

      {/* Barra dei pulsanti */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {/* Riconosci */}
        <button
          onClick={handleManualRecognize}
          disabled={!hasContent || isRecognizing || !canvasPronto}
          className="h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-base font-bold tracking-widest transition-all shadow-sm"
        >
          {isRecognizing ? "..." : "RICONOSCI"}
        </button>

        {/* GOMMA — sempre visibile in modalità gomma anche dopo aver cancellato tutto */}
        {(hasContent || eraserMode) && (
          <button
            onClick={() => setEraserMode(!eraserMode)}
            className={`h-11 px-4 rounded-xl font-bold text-sm sm:text-base tracking-widest transition-all shadow-sm ${
              eraserMode
                ? "bg-destructive text-destructive-foreground"
                : "bg-secondary hover:bg-secondary/80 text-foreground"
            }`}
            title={eraserMode ? "Gomma attiva — clicca per uscire" : "Attiva la gomma per cancellare"}
          >
            {eraserMode ? "✕ ESCI GOMMA" : "GOMMA"}
          </button>
        )}

        {/* CANCELLA */}
        {hasContent && (
          <button
            onClick={() => { handleClear(); setEraserMode(false); }}
            className="h-11 px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold text-sm sm:text-base tracking-widest transition-all shadow-sm"
          >
            CANCELLA
          </button>
        )}
      </div>

      {/* (26/10) risposta SIMBOLICA pubblicata: il testo con lettere scritto
          dallo studente, mostrato come matematica resa quando possibile.
          (26/10-fix) se la risposta è sbagliata NON si mostra (hideValue) */}
      {!hideValue && onSymbolicValue && symbolicValue && (
        <div className="flex flex-wrap items-center justify-center gap-3 min-h-[40px]">
          <span className="inline-block px-4 py-1.5 rounded-xl bg-violet-50 text-violet-900 font-mono text-base sm:text-lg font-bold">
            {symbolicValue}
          </span>
          <button
            onClick={() => onSymbolicValue(null)}
            className="h-9 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs tracking-widest transition-all shadow-sm"
            aria-label="Cancella la risposta scritta"
          >
            CANCELLA
          </button>
        </div>
      )}

      {/* Display del valore riconosciuto — NASCOSTO se la risposta pubblicata
          è sbagliata (26/10-fix): niente numero errato, solo l'avviso del box.
          (26/10, foto «3 radice di 15»: ricomparsa della pillola blu col
          numero errato — se hideValue, NON mostrare NULLA qui dentro,
          neppure il badge decimale che camminava da solo). */}
      {!hideValue ? (
      <div className="flex flex-wrap items-center justify-center gap-3 min-h-[40px]">
        {isPlainDecimalInput ? (
          /* ── Input decimale puro (nessun \frac né \sqrt): mostra SOLO il decimale ── */
          decimalStr && (
            <span className="inline-block px-3 py-1 rounded-xl bg-blue-50 text-blue-800 font-mono text-base sm:text-lg font-bold">
              {hasPlusMinusSign && !valueIsInteger ? `± ${decimalStr}` : decimalStr}
            </span>
          )
        ) : (
          /* ── Input con frazione o radicale: mostra tutte le forme pertinenti ── */
          <>
            {/* 1. FORMA ESATTA */}
            {radicalLatex ? (
              <span
                className="inline-flex items-center px-4 py-1.5 rounded-xl bg-amber-100 text-amber-900 text-lg sm:text-xl font-bold [&_.katex]:text-amber-900 [&_.katex-display]:!m-0 [&_.katex-display]:!inline"
                dangerouslySetInnerHTML={{ __html: renderKatex(radicalLatex) }}
              />
            ) : showFraction ? (
              fracDen === 1 ? (
                <span className="inline-block px-4 py-1.5 rounded-xl bg-secondary text-lg sm:text-xl font-bold">
                  {fracNeg ? `−${fracNum}` : fracNum}
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-secondary text-lg sm:text-xl font-bold">
                    {fracNeg && <span className="mr-0.5">−</span>}
                    <FractionDisplay numerator={fracNum!} denominator={fracDen!} size="md" />
                  </span>
                  {/* Se la frazione si semplifica a intero, mostra il valore semplificato */}
                  {valueIsInteger && decimalStr && (
                    <>
                      <span className="text-muted-foreground text-lg">→</span>
                      <span className="inline-block px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-mono text-base sm:text-lg font-bold">
                        {fracNeg ? `−${decimalStr}` : decimalStr}
                      </span>
                    </>
                  )}
                </>
              )
            ) : recognizedText ? (
              /* (26/10-fix) messaggio d'errore IA: più piccolo, rosso e NON
                 in grassetto (richiesta esplicita dell'utente) */
              <span className="inline-block px-3 py-1 rounded-lg bg-secondary text-sm font-normal text-destructive">
                {recognizedText}
              </span>
            ) : null}

            {/* 2. DECIMALE */}
            {decimalStr && !valueIsInteger && (
              <>
                <span className="text-muted-foreground text-lg">→</span>
                <span className="inline-block px-3 py-1 rounded-xl bg-blue-50 text-blue-800 font-mono text-base sm:text-lg font-bold">
                  {decimalStr}
                </span>
              </>
            )}

            {/* 3. FRAZIONE SEMPLIFICATA (solo se la frazione è riducibile) */}
            {showFraction && fracDen && fracDen > 1 && isSimplifiable && simplifiedFracLatex && !valueIsInteger && (
              <>
                <span className="text-muted-foreground text-lg">→</span>
                <span
                  className="inline-flex items-center px-4 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-lg sm:text-xl font-bold [&_.katex]:text-emerald-800 [&_.katex-display]:!m-0 [&_.katex-display]:!inline"
                  dangerouslySetInnerHTML={{ __html: renderKatex(simplifiedFracLatex) }}
                />
              </>
            )}


          </>
        )}
      </div>
      ) : null}

      {/* ── Correzione manuale via tastiera ── */}
      {isEditing ? (
        <>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <input
            ref={editInputRef}
            type="text"
            value={editLatex}
            onChange={(e) => setEditLatex(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleEditSubmit(); if (e.key === 'Escape') { setIsEditing(false); setEditLatex(''); } }}
            placeholder="Esempio: 8/3"
            aria-label="Digita il valore da tastiera"
            className="h-9 px-3 rounded-lg border-2 border-primary bg-background text-foreground text-sm font-mono w-48 text-center focus:outline-none"
            autoFocus
          />
          <button
            onClick={handleEditSubmit}
            className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-colors"
          >
            OK
          </button>
          <button
            onClick={() => { setIsEditing(false); setEditLatex(''); }}
            className="h-9 w-9 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-bold transition-colors flex items-center justify-center"
          >
            ✕
          </button>
        </div>
        <div className="mt-1 text-center">
          <button
            onClick={() => setValueLegendOpen((v) => !v)}
            aria-expanded={valueLegendOpen}
            className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-secondary/60 text-foreground text-xs font-bold tracking-widest transition-colors"
          >
            {valueLegendOpen ? "\u25BE NASCONDI LE ISTRUZIONI" : "\u25B8 ISTRUZIONI PER SCRIVERE DA TASTIERA"}
          </button>
        </div>
        {valueLegendOpen && (
          <div
            className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-center space-y-0.5"
            aria-label="Regole di trascrizione da tastiera"
          >
            <p className="text-sm"><span className="font-mono font-bold text-blue-700 dark:text-blue-300">Scrivi :</span> <span className="text-foreground">per il segno di divisione (si mostra \u00F7)</span></p>
            <p className="text-sm"><span className="font-mono font-bold text-amber-700 dark:text-amber-300">Scrivi *</span> <span className="text-foreground">per il segno di moltiplicazione (si mostra \u00B7)</span></p>
            <p className="text-sm"><span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">Scrivi /</span> <span className="text-foreground">per la frazione impilata</span></p>
            <p className="text-sm"><span className="font-mono font-bold text-violet-700 dark:text-violet-300">Scrivi ^2, ^-2</span> <span className="text-foreground">per gli esponenti di una potenza (anche negativi)</span></p>
            <p className="text-sm"><span className="font-mono font-bold text-rose-700 dark:text-rose-300">Scrivi rad2, rad3, rad4\u2026</span> <span className="text-foreground">per la radice quadrata, la cubica, la quarta, ecc.</span></p>
          </div>
        )}
        </>
      ) : (
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            disabled={!canvasPronto}
            onClick={() => { setIsEditing(true); setEditLatex(recognizedText && recognizedText !== '?' && !recognizedText.startsWith('Non riconosco') ? recognizedText : ''); }}
            className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground shadow-sm transition hover:bg-primary/90 text-xs tracking-wide"
            title="Inserisci manualmente il valore"
          >
            ✎ digita il valore
          </button>
          {/* (26/10) CALCOLATRICE: apre la VERA Desmos scientifica in italiano
              in una NUOVA SCHEDA (Desmos blocca gli iframe, quindi niente
              incorporamento). L'app non naviga: mostra solo un promemoria e
              lo stato del box resta intatto — al ritorno si riprende da lì */}
          <button
            onClick={() => {
              // apertura DENTRO il gestore del clic (gesture utente): nessun
              // blocco pop-up da parte del browser
              window.open('https://www.desmos.com/scientific?lang=it', '_blank', 'noopener,noreferrer');
              setCalcAperta(true);
            }}
            className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground shadow-sm transition hover:bg-primary/90 text-xs tracking-wide font-bold"
            title="Apri la calcolatrice scientifica in una nuova scheda"
            aria-haspopup="dialog"
            data-testid="calculator-open"
          >
            🧮 CALCOLATRICE
          </button>
        </div>
      )}

      {/* Caricamento AI */}
      {isLoading && (
        <span className="text-base text-muted-foreground text-center">
          CARICAMENTO MODELLO AI...
        </span>
      )}

      {/* (26/10) Pannello CALCOLATRICE (Desmos scientifica, italiano):
          overlay full-screen sopra l'app — lo stato del box (canvas, disegni,
          campi, passaggi) resta intatto e alla chiusura si riprende da lì */}
      {calcAperta && <CalculatorPanel onClose={() => setCalcAperta(false)} />}
    </div>
  );
}
