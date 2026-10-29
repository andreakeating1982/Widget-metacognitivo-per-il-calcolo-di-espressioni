import { useCallback, useEffect, useState } from "react";

/**
 * Lettura ad alta voce (Text-to-Speech) per l'inclusione (DSA/BES).
 *
 * Legge in italiano il contenuto testuale della pagina usando l'API Web Speech
 * (`speechSynthesis`). Il pulsante "Ascolto → Leggi" nella barra di accessibilità
 * avvia/interrompe la lettura.
 *
 * Accorgimenti per una lettura naturale, completa e corretta:
 *  - seleziona la migliore voce italiana disponibile (neurale/naturale se c'è);
 *  - legge TUTTA la pagina (header + contenuto), non solo il <main>;
 *  - converte le formule KaTeX dal loro LaTeX in italiano parlato, così gli
 *    esponenti diventano "alla quarta", le frazioni "fratto", le radici
 *    "radice quadrata di", ecc. (es. "3x^{4}" → "tre x alla quarta");
 *  - converte anche gli esponenti/pedici Unicode nel testo ("x²" → "x al quadrato",
 *    "t₁" → "t uno");
 *  - ignora toolbar, pulsanti, campi e canvas (niente rumore).
 */

// Cache della voce migliore (caricata una sola volta).
let cachedVoice: SpeechSynthesisVoice | null = null;

/** Punteggio per scegliere la voce italiana meno "robotica" possibile. */
function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = (v.name || "").toLowerCase();
  let score = 0;
  if (/\b(google|microsoft|apple)\b/.test(name)) score += 4;
  if (/natural|neural|premium|enhanced|online|multilingual|expressive/.test(name)) score += 5;
  if (/elsa|diego|isabella|federica|luca|bianca|giorgio|paola|carla|francesca|alice|emma|elena|marco|giulia|alessio|stefano|giovanni|ilaria/.test(name)) score += 2;
  if (v.localService) score += 1;
  return score;
}

function pickBestVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const italian = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("it"));
  const pool = italian.length ? italian : voices;
  return [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// Conversione LaTeX → italiano parlato
// ────────────────────────────────────────────────────────────────────────────

const IT_NUMBERS: Record<number, string> = {
  0: "zero", 1: "uno", 2: "due", 3: "tre", 4: "quattro", 5: "cinque",
  6: "sei", 7: "sette", 8: "otto", 9: "nove", 10: "dieci", 11: "undici",
  12: "dodici", 13: "tredici", 14: "quattordici", 15: "quindici",
  16: "sedici", 17: "diciassette", 18: "diciotto", 19: "diciannove",
  20: "venti", 30: "trenta", 40: "quaranta", 50: "cinquanta",
  60: "sessanta", 70: "settanta", 80: "ottanta", 90: "novanta",
};

function integerToItalian(n: number): string {
  if (n < 0) return "meno " + integerToItalian(-n);
  if (n < 20) return IT_NUMBERS[n] ?? String(n);
  if (n < 100) {
    const tens = Math.floor(n / 10) * 10;
    const units = n % 10;
    let word = IT_NUMBERS[tens] ?? String(tens);
    if (units === 0) return word;
    if (units === 1 || units === 8) word = word.slice(0, -1);
    const unitWord = units === 3 ? "tré" : IT_NUMBERS[units] ?? String(units);
    return word + unitWord;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const h = hundreds === 1 ? "cento" : (IT_NUMBERS[hundreds] ?? String(hundreds)) + "cento";
    return rest === 0 ? h : h + integerToItalian(rest);
  }
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const t = thousands === 1 ? "mille" : integerToItalian(thousands) + "mila";
    return rest === 0 ? t : t + integerToItalian(rest);
  }
  // Numeri ancora più grandi: lettura a cifre separate (raro nell'app).
  return String(n);
}

function numberToItalian(numStr: string): string {
  const s = numStr.trim();
  if (s === "") return "";
  if (s.includes(".")) {
    const [intPart, decPart] = s.split(".");
    const intWords = integerToItalian(parseInt(intPart || "0", 10));
    const decWords = (decPart || "")
      .split("")
      .map((d) => IT_NUMBERS[Number(d)] ?? d)
      .join(" ");
    return intWords + " virgola " + decWords;
  }
  const n = parseInt(s, 10);
  if (!isNaN(n)) return integerToItalian(n);
  return s;
}

/** Converte una data "gg/mm/aaaa" in italiano parlato (es. "01/09/2026" → "primo settembre duemilaventisei"). */
function formatDateItalian(value: string): string | null {
  const m = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12) return null;
  const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const dayWord = day === 1 ? "primo" : integerToItalian(day);
  return `${dayWord} ${MONTHS[month - 1]} ${integerToItalian(year)}`;
}

function exponentToItalian(arg: string): string {
  const t = arg.trim();
  const n = parseInt(t, 10);
  if (!isNaN(n)) {
    // (25/10, punto 5) ESPONENTI NEGATIVI: x^{-2} → «x alla meno due»
    // (prima il meno veniva perso/garbuglio con integerToItalian(-n))
    if (n < 0) {
      const ass: Record<number, string> = {
        1: "uno", 2: "due", 3: "tre", 4: "quattro", 5: "cinque",
        6: "sei", 7: "sette", 8: "otto", 9: "nove", 10: "dieci",
      };
      return "alla meno " + (ass[-n] ?? integerToItalian(-n));
    }
    const map: Record<number, string> = {
      0: "alla zero", 1: "alla prima", 2: "al quadrato", 3: "al cubo",
      4: "alla quarta", 5: "alla quinta", 6: "alla sesta", 7: "alla settima",
      8: "all'ottava", 9: "alla nona", 10: "alla decima",
    };
    if (map[n]) return map[n];
    return "alla " + integerToItalian(n);
  }
  // (25/10, punto 5) ESPONENTE FRAZIONARIO (9^(1/2) nel nuovo flusso:
  // LaTeX 9^{\tfrac{1}{2}}) → «alla uno fratto due» (prima usciva
  // «alla tfrac uno due» con il comando grezzo)
  const fracM = t.match(/^\\[dt]?frac\{(-?\d+)\}\{(\d+)\}$/);
  if (fracM) {
    const num = numberToItalian(fracM[1]);
    const den = numberToItalian(fracM[2]);
    return `alla ${num} fratto ${den}`;
  }
  return "alla " + t;
}

function subscriptToItalian(arg: string): string {
  const t = arg.trim();
  const n = parseInt(t, 10);
  if (!isNaN(n)) return IT_NUMBERS[n] ?? t;
  return t;
}

/** Converte una stringa LaTeX in italiano parlato.
 *  (25/10, punto 5) esportata per i test. */
export function latexToSpeech(latex: string): string {
  let s = latex
    .replace(/\\left|\\right|\\displaystyle|\\textstyle/gi, "")
    .replace(/\\[,;:!]|\\\s|\\quad|\\qquad/gi, " ")
    .trim();
  if (!s) return "";

  let i = 0;
  const n = s.length;

  function parseExpr(): string {
    let out = "";
    while (i < n) {
      const c = s[i];

      if (c === "\\") {
        i++;
        let cmd = "";
        while (i < n && /[a-zA-Z]/.test(s[i])) { cmd += s[i]; i++; }

        if (cmd === "dfrac" || cmd === "frac" || cmd === "tfrac") {
          let num = "", den = "";
          if (s[i] === "{") { i++; num = parseExpr(); if (s[i] === "}") i++; }
          if (s[i] === "{") { i++; den = parseExpr(); if (s[i] === "}") i++; }
          out += " " + num.trim() + " fratto " + den.trim() + " ";
        } else if (cmd === "sqrt") {
          // (25/10, punto 5) INDICE della radice: \sqrt[3] → «radice cubica
          // di» (prima QUALSIASI indice veniva letto «radice quadrata»)
          let idx = 2;
          if (s[i] === "[") {
            i++;
            let idxStr = "";
            while (i < n && /[0-9]/.test(s[i])) { idxStr += s[i]; i++; }
            if (s[i] === "]") i++;
            const p = parseInt(idxStr, 10);
            if (!isNaN(p) && p >= 2) idx = p;
          }
          let inner = "";
          if (s[i] === "{") { i++; inner = parseExpr(); if (s[i] === "}") i++; }
          const nomeRadice = idx === 2 ? "radice quadrata di" : idx === 3 ? "radice cubica di" : idx === 4 ? "radice quarta di" : `radice ${idx}-esima di`;
          out += " " + nomeRadice + " " + inner.trim() + " ";
        } else if (cmd === "Delta") {
          out += " delta ";
        } else if (cmd === "cdot" || cmd === "times") {
          out += " per ";
        } else if (cmd === "pm") {
          out += " più o meno ";
        } else if (cmd === "mp") {
          out += " meno o più ";
        } else if (cmd === "neq" || cmd === "ne") {
          out += " diverso da ";
        } else if (cmd === "leq" || cmd === "le") {
          out += " minore o uguale a ";
        } else if (cmd === "geq" || cmd === "ge") {
          out += " maggiore o uguale a ";
        } else if (cmd === "lt") {
          out += " minore ";
        } else if (cmd === "gt") {
          out += " maggiore ";
        } else if (cmd === "approx") {
          out += " circa ";
        } else if (cmd === "infty") {
          out += " infinito ";
        } else {
          out += " " + cmd + " ";
        }
        continue;
      }

      if (c === "^" || c === "_") {
        const isExp = c === "^";
        i++;
        let arg = "";
        if (s[i] === "{") {
          // Leggiamo il contenuto GREZZO (es. "4", "2"), non la forma già
          // parlata: serve a exponentToItalian per riconoscere l'ordinale.
          arg = readRawGroup();
        } else if (i < n) {
          arg = s[i];
          i++;
        }
        out += isExp ? " " + exponentToItalian(arg) + " " : " " + subscriptToItalian(arg) + " ";
        continue;
      }

      if (c === "{") { i++; continue; }
      if (c === "}") { break; }

      if (c === "=") { out += " uguale "; i++; continue; }
      if (c === "+") { out += " più "; i++; continue; }
      if (c === "-") { out += " meno "; i++; continue; }
      if (c === "(" || c === ")") { out += " "; i++; continue; }
      if (c === ",") { out += " virgola "; i++; continue; }
      // (25/10, punto 5) divisioni e prodotti in notazione dell'app: con i
      // nuovi flusso x²:x⁴ e (2x)³ la voce deve dire «diviso» e «per»
      // (prima i simboli sconosciuti venivano SALTATI e il dettato aveva
      // i numeri attaccati: «x due x quattro»)
      if (c === ":" || c === "÷") { out += " diviso "; i++; continue; }
      if (c === "·" || c === "*") { out += " per "; i++; continue; }
      if (c === "/") { out += " fratto "; i++; continue; }
      if (c === "√") { out += " radice quadrata di "; i++; continue; }
      if (c === "∛") { out += " radice cubica di "; i++; continue; }
      if (c === "∜") { out += " radice quarta di "; i++; continue; }

      if (/[0-9]/.test(c)) {
        let num = "";
        while (i < n && /[0-9.]/.test(s[i])) { num += s[i]; i++; }
        out += " " + numberToItalian(num) + " ";
        continue;
      }

      if (/[a-zA-Z]/.test(c)) {
        let word = "";
        while (i < n && /[a-zA-Z]/.test(s[i])) { word += s[i]; i++; }
        out += " " + word + " ";
        continue;
      }

      // Carattere sconosciuto (spazi, ecc.)
      i++;
    }
    return out;
  }

  /** Legge il contenuto GREZZO (senza conversione) di un gruppo {...}. */
  function readRawGroup(): string {
    i++; // salta "{"
    let depth = 1;
    let content = "";
    while (i < n && depth > 0) {
      const ch = s[i];
      if (ch === "{") { depth++; content += ch; i++; }
      else if (ch === "}") { depth--; if (depth > 0) content += ch; i++; }
      else { content += ch; i++; }
    }
    return content;
  }

  return parseExpr().replace(/\s+/g, " ").trim();
}

// ────────────────────────────────────────────────────────────────────────────
// Esponenti e pedici Unicode nel testo (es. "x²", "t₁")
// ────────────────────────────────────────────────────────────────────────────

const UNICODE_SUPERSCRIPT: Record<string, string> = {
  "⁰": " alla zero", "¹": " alla prima", "²": " al quadrato", "³": " al cubo",
  "⁴": " alla quarta", "⁵": " alla quinta", "⁶": " alla sesta",
  "⁷": " alla settima", "⁸": " all'ottava", "⁹": " alla nona",
};

const UNICODE_SUBSCRIPT: Record<string, string> = {
  "₀": " zero", "₁": " uno", "₂": " due", "₃": " tre", "₄": " quattro",
  "₅": " cinque", "₆": " sei", "₇": " sette", "₈": " otto", "₉": " nove",
};

function normalizeUnicodeMath(text: string): string {
  return text
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (m) => UNICODE_SUPERSCRIPT[m])
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (m) => UNICODE_SUBSCRIPT[m]);
}

/**
 * Porta il testo a un caso "naturale" per il TTS: le parole tutte MAIUSCOLE
 * vengono lette dagli engine con accenti sbagliati o lettera per lettera
 * (es. "TRINOMIE" letto con l'accento sbagliato). Le convertiamo in minuscolo.
 */
function toNaturalCase(text: string): string {
  return text
    .replace(/Δ/g, "delta")
    .replace(/\p{Lu}{2,}/gu, (w) => w.toLowerCase())
    .replace(/\bE\b/g, "e");
}

/**
 * Estrae il testo leggibile della pagina attraversando i nodi di testo del DOM
 * (senza mutare la UI). Usa i nodi di testo e NON `innerText` su un clone
 * staccato, che accorpava le parole senza spazi (es. "GRADOTRINOMIE").
 */
function getReadableText(): string {
  const EXCLUDE_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "BUTTON", "CANVAS", "SVG", "IFRAME",
  ]);
  const BLOCK_TAGS = new Set([
    "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "SECTION",
    "ARTICLE", "HEADER", "MAIN", "FOOTER", "UL", "OL", "TABLE", "TR", "BR",
  ]);

  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.replace(/\s+/g, " ").trim();
      if (t) parts.push(t);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (EXCLUDE_TAGS.has(el.tagName)) return;
    if (el.getAttribute("role") === "toolbar") return;

    // Campi di input: leggiamo etichetta (aria-label/placeholder) e valore.
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      const input = el as HTMLInputElement;
      const label = input.getAttribute("aria-label")?.trim()
        || input.getAttribute("placeholder")?.trim()
        || "";
      const value = input.value?.trim() || "";
      const pieces: string[] = [];
      if (label) pieces.push(label);
      if (value && value !== label) pieces.push(formatDateItalian(value) ?? value);
      if (pieces.length) parts.push(" " + pieces.join(" ") + " ");
      return;
    }
    if (el.tagName === "SELECT") {
      const sel = el as HTMLSelectElement;
      const opt = sel.options[sel.selectedIndex]?.text?.trim() || "";
      if (opt) parts.push(" " + opt + " ");
      return;
    }

    // Formula KaTeX: convertiamo il LaTeX in italiano parlato.
    if (el.classList.contains("katex")) {
      let spoken = "";
      try {
        const annotation = el.querySelector(".katex-mathml annotation");
        const latex = annotation?.textContent?.trim() || "";
        if (latex) spoken = latexToSpeech(latex);
      } catch {
        spoken = "";
      }
      if (!spoken) {
        // Fallback: leggiamo solo la forma resa visivamente (senza MathML).
        const html = el.querySelector(".katex-html") as HTMLElement | null;
        spoken = html?.innerText?.replace(/\s+/g, " ").trim() || "";
      }
      if (spoken) parts.push(" " + spoken + " ");
      return; // non scendiamo in .katex-html / .katex-mathml
    }

    const isBlock = BLOCK_TAGS.has(el.tagName);
    if (isBlock) parts.push(" ");
    for (const child of Array.from(el.childNodes)) walk(child);
    if (isBlock) parts.push(" ");
  };

  walk(document.body);

  let text = parts.join(" ").replace(/\s+/g, " ").trim();
  text = normalizeUnicodeMath(text);
  text = toNaturalCase(text);
  return text;
}

/** Divide il testo in frasi (per pause naturali e robustezza sui browser). */
function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?;:])\s+/);
  const chunks: string[] = [];
  let buffer = "";
  const MAX = 220;
  for (const part of parts) {
    if ((buffer + " " + part).trim().length > MAX && buffer) {
      chunks.push(buffer.trim());
      buffer = part;
    } else {
      buffer = (buffer + " " + part).trim();
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks.length ? chunks : [text];
}

export interface UseReadAloudResult {
  speaking: boolean;
  supported: boolean;
  toggle: () => void;
  stop: () => void;
}

export function useReadAloud(): UseReadAloudResult {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Carica le voci (su alcuni browser arrivano in modo asincrono).
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      if (!cachedVoice) cachedVoice = pickBestVoice();
    };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, [supported]);

  // Interrompe la lettura quando il componente si smonta.
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (window.speechSynthesis.speaking) {
      stop();
      return;
    }

    const text = getReadableText();
    if (!text) return;

    if (!cachedVoice) cachedVoice = pickBestVoice();

    const chunks = splitSentences(text);
    const total = chunks.length;

    window.speechSynthesis.cancel(); // evita sovrapposizioni

    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = "it-IT";
      utterance.rate = 0.95;
      utterance.pitch = 1;
      if (cachedVoice) utterance.voice = cachedVoice;

      if (index === 0) utterance.onstart = () => setSpeaking(true);
      if (index === total - 1) {
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
      } else {
        // Se una frase intermedia fallisce, prosegue con le successive.
        utterance.onerror = () => undefined;
      }

      window.speechSynthesis.speak(utterance);
    });
  }, [supported, stop]);

  return { speaking, supported, toggle, stop };
}
