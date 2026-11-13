import { useCallback, useEffect, useRef, useState } from "react";
import { appNotationToLatex } from "@/lib/appNotationLatex";
import { normalizeKeyboardNotation } from "@/lib/keyboardNotation";
import { canonicalizePeriodicNotation } from "@/lib/periodicNotation";

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
 *  - include i pulsanti e i campi visibili, senza leggere contenuti nascosti;
 *  - pronuncia le formule senza svolgerle e non rivela risposte non mostrate.
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
  // Mai forzare una voce inglese su un testo italiano: se non ce n'è una
  // italiana, lasciamo che sia il browser a scegliere usando lang=it-IT.
  return [...italian].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
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
  if (/[.,]/.test(s)) {
    const [intPart, decPart] = s.split(/[.,]/);
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
  const n = /^-?\d+$/.test(t) ? Number(t) : NaN;
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
  return "alla " + latexToSpeech(t);
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
  let s = canonicalizePeriodicNotation(latex)
    .replace(/\{,\}/g, ",")
    .replace(/\\(?:left|right|displaystyle|textstyle)\b/gi, "")
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
        while (i < n && /\s/.test(s[i])) i++;

        if (cmd === "dfrac" || cmd === "frac" || cmd === "tfrac") {
          let num = "", den = "";
          if (s[i] === "{") { i++; num = parseExpr(); if (s[i] === "}") i++; }
          while (i < n && /\s/.test(s[i])) i++;
          if (s[i] === "{") { i++; den = parseExpr(); if (s[i] === "}") i++; }
          out += " inizio frazione " + num.trim() + " fratto " + den.trim() + " fine frazione ";
        } else if (cmd === "sqrt") {
          // (25/10, punto 5) INDICE della radice: \sqrt[3] → «radice cubica
          // di» (prima QUALSIASI indice veniva letto «radice quadrata»)
          let indice = "2";
          if (s[i] === "[") {
            i++;
            let raw = "";
            while (i < n && s[i] !== "]") raw += s[i++];
            if (s[i] === "]") i++;
            if (raw.trim()) indice = raw.trim().replace(/−/g, "-");
          }
          while (i < n && /\s/.test(s[i])) i++;
          let inner = "";
          if (s[i] === "{") { i++; inner = parseExpr(); if (s[i] === "}") i++; }
          const nomeRadice = indice === "2" ? "radice quadrata di" : indice === "3" ? "radice cubica di" : indice === "4" ? "radice quarta di" : `radice con indice ${latexToSpeech(indice)} di`;
          out += " " + nomeRadice + " " + inner.trim() + " fine radice ";
        } else if (cmd === "overline" || cmd === "bar") {
          const raw = s[i] === "{" ? readRawGroup().trim() : (s[i++] ?? "");
          const period = /^\d+$/.test(raw) ? [...raw].map((d) => IT_NUMBERS[Number(d)]).join(" ") : latexToSpeech(raw);
          out += ` periodo ${period} fine periodo `;
        } else if (cmd === "text" || cmd === "mathrm" || cmd === "operatorname") {
          if (s[i] === "{") { i++; out += " " + parseExpr() + " "; if (s[i] === "}") i++; }
        } else if (cmd === "color" || cmd === "textcolor") {
          // Il colore non è un'operazione: salta il nome e leggi solo il contenuto.
          if (s[i] === "{") readRawGroup();
          if (s[i] === "{") { i++; out += " " + parseExpr() + " "; if (s[i] === "}") i++; }
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
        } else if (cmd === "Rightarrow" || cmd === "implies") {
          out += " implica ";
        } else if (cmd === "lvert" || cmd === "rvert" || cmd === "vert") {
          out += " valore assoluto ";
        } else if (!cmd && s[i] === "{") {
          out += " parentesi graffa aperta "; i++;
        } else if (!cmd && s[i] === "}") {
          out += " parentesi graffa chiusa "; i++;
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
      if (c === "-" || c === "−") { out += " meno "; i++; continue; }
      if (c === "(") { out += " parentesi tonda aperta "; i++; continue; }
      if (c === ")") { out += " parentesi tonda chiusa "; i++; continue; }
      if (c === "[") { out += " parentesi quadra aperta "; i++; continue; }
      if (c === "]") { out += " parentesi quadra chiusa "; i++; continue; }
      if (c === "|") { out += " valore assoluto "; i++; continue; }
      if (c === "≠") { out += " diverso da "; i++; continue; }
      if (c === "≤") { out += " minore o uguale a "; i++; continue; }
      if (c === "≥") { out += " maggiore o uguale a "; i++; continue; }
      if (c === "<") { out += " minore di "; i++; continue; }
      if (c === ">") { out += " maggiore di "; i++; continue; }
      if (c === "±") { out += " più o meno "; i++; continue; }
      if (c === ",") { out += " virgola "; i++; continue; }
      // (25/10, punto 5) divisioni e prodotti in notazione dell'app: con i
      // nuovi flusso x²:x⁴ e (2x)³ la voce deve dire «diviso» e «per»
      // (prima i simboli sconosciuti venivano SALTATI e il dettato aveva
      // i numeri attaccati: «x due x quattro»)
      if (c === ":" || c === "÷") { out += " diviso "; i++; continue; }
      if (c === "·" || c === "⋅" || c === "×" || c === "*") { out += " per "; i++; continue; }
      if (c === "/" || c === "⁄") { out += " fratto "; i++; continue; }
      if (c === "√") { out += " radice quadrata di "; i++; continue; }
      if (c === "∛") { out += " radice cubica di "; i++; continue; }
      if (c === "∜") { out += " radice quarta di "; i++; continue; }
      // (09/11, indici alti) ⁵√…¹²√ → «radice quinta/sesta/… di»: la parola
      // ordinale segue la cifra dell'indice (10, 11, 12: «dicesima» ecc.).
      if (/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(c)) {
        let apice = "";
        while (i < n && /[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(s[i])) {
          apice += s[i] === "⁻" ? "-" : "0123456789"["⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(s[i])];
          i++;
        }
        if (s[i] === "√") {
          out += ` radice con indice ${latexToSpeech(apice)} di `;
          i++;
        } else {
          out += ` ${exponentToItalian(apice)} `;
        }
        continue;
      }

      if (/[0-9]/.test(c)) {
        let num = "";
        while (i < n && /[0-9]/.test(s[i])) { num += s[i]; i++; }
        if ((s[i] === "," || s[i] === ".") && /[0-9]/.test(s[i + 1] ?? "")) {
          num += ","; i++;
          while (i < n && /[0-9]/.test(s[i])) { num += s[i]; i++; }
        }
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

const UNICODE_SUBSCRIPT: Record<string, string> = {
  "₀": " zero", "₁": " uno", "₂": " due", "₃": " tre", "₄": " quattro",
  "₅": " cinque", "₆": " sei", "₇": " sette", "₈": " otto", "₉": " nove",
};

function normalizeUnicodeMath(text: string): string {
  const plain = (s: string) => [...s].map((c) => c === "⁻" ? "-" : "0123456789"["⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)]).join("");
  return text
    .replace(/(⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)√/g, (_m, v: string) => ` radice con indice ${latexToSpeech(plain(v))} di `)
    .replace(/⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => ` ${exponentToItalian(plain(m))}`)
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
export function getReadableText(root: HTMLElement = document.body): string {
  const EXCLUDE_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "CANVAS", "SVG", "IFRAME",
  ]);
  const BLOCK_TAGS = new Set([
    "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "SECTION",
    "ARTICLE", "HEADER", "MAIN", "FOOTER", "UL", "OL", "TABLE", "TR", "BR",
  ]);

  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.replace(/\s+/g, " ").trim();
      if (t) parts.push(t.replace(/\b\d+[,.]\d+\b/g, (value) => numberToItalian(value)));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (EXCLUDE_TAGS.has(el.tagName)) return;
    // Non scansionare mai contenuti nascosti, anche se restano nel DOM.
    // In particolare, non leggere risposte chiuse o elementi per soli screen reader.
    if (el.hidden || el.hasAttribute("inert") || el.getAttribute("aria-hidden") === "true" || el.classList.contains("sr-only")) return;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden") return;

    // I pulsanti e i collegamenti sono parte essenziale della pagina, non rumore.
    // Il nome accessibile descrive anche le icone senza testo; non attiva nulla.
    if (el.tagName === "BUTTON" || el.tagName === "A") {
      const raw = el.getAttribute("aria-label")?.trim() || el.textContent?.replace(/\s+/g, " ").trim() || el.getAttribute("title")?.trim() || "";
      // Icone ed emoji decorative non devono interrompere il nome del pulsante.
      const label = raw.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D✓✎✨▸▶]+/u, "").trim() || raw;
      if (label) {
        const tipo = el.tagName === "BUTTON" ? "Pulsante" : "Collegamento";
        const disabled = (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true";
        parts.push(`${tipo} ${label}${disabled ? ", non disponibile" : ""}.`);
      }
      return;
    }

    // Forma frazionaria impilata non-KaTeX (FractionDisplay).
    const fraction = el.getAttribute("data-tts-fraction");
    if (fraction) { parts.push(latexToSpeech(fraction)); return; }
    // Risposta esplicitamente mostrata dallo studente: leggere la notazione
    // visibile; quando è chiusa l'elemento non esiste e non si può rivelare.
    if (el.getAttribute("data-testid") === "soluzione-calcolatrice") {
      const value = el.textContent?.trim() || "";
      if (value) parts.push(`Soluzione in formato calcolatrice. ${notationToSpeech(value)}.`);
      return;
    }

    // Valori matematici mostrati come semplice testo e non come KaTeX.
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && el.classList.contains("font-mono") && el.children.length === 0) {
      const value = el.textContent?.trim() || "";
      if (value && /\d/.test(value) && /[\d,./⁄^√∛∜·*:()+\-⁰¹²³⁴⁵⁶⁷⁸⁹]|per/i.test(value)) {
        parts.push(notationToSpeech(value));
        return;
      }
    }

    // Campi di input: leggiamo etichetta (aria-label/placeholder) e valore.
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      const input = el as HTMLInputElement;
      if (["hidden", "file", "password"].includes(input.type)) return;
      const label = input.getAttribute("aria-label")?.trim()
        || input.labels?.[0]?.textContent?.trim()
        || input.getAttribute("placeholder")?.trim()
        || "Campo di testo";
      const value = input.value?.trim() || "";
      const mathematical = /notazione|espressione|valore da tastiera|risposta/i.test(label);
      const spokenValue = value && value !== label
        ? (formatDateItalian(value) ?? (mathematical ? notationToSpeech(value) : value.replace(/\b\d+[,.]\d+\b/g, numberToItalian))) : "";
      parts.push(`Campo ${label}${spokenValue ? `. Valore: ${spokenValue}` : ", vuoto"}.`);
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

  walk(root);

  let text = parts.join(" ").replace(/\s+/g, " ").trim();
  text = normalizeUnicodeMath(text);
  text = toNaturalCase(text);
  return text;
}

/** Trascrive solo la notazione visibile o digitata: non esegue calcoli. */
export function notationToSpeech(value: string): string {
  const normal = value.includes("\\")
    ? canonicalizePeriodicNotation(value)
    : appNotationToLatex(normalizeKeyboardNotation(value));
  return latexToSpeech(normal);
}

/** Divide il testo in frasi (per pause naturali e robustezza sui browser). */
export function splitSentences(text: string): string[] {
  // Chrome e alcuni motori mobili si interrompono su enunciati troppo lunghi.
  // Limitare anche le frasi senza punteggiatura, senza perdere alcuna parola.
  const MAX = 180;
  const chunks: string[] = [];
  let remaining = text.replace(/\s+/g, " ").trim();
  while (remaining.length > MAX) {
    const prefix = remaining.slice(0, MAX + 1);
    const punctuation = [...prefix.matchAll(/[.!?;:]\s+/g)].pop();
    let cut = punctuation && punctuation.index! >= MAX / 2
      ? punctuation.index! + 1 : prefix.lastIndexOf(" ");
    if (cut <= 0) cut = MAX;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export interface UseReadAloudResult {
  speaking: boolean;
  supported: boolean;
  toggle: () => void;
  stop: () => void;
}

export function useReadAloud(): UseReadAloudResult {
  const [speaking, setSpeaking] = useState(false);
  const active = useRef(false);
  const generation = useRef(0);
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
      generation.current++;
      active.current = false;
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    generation.current++;
    active.current = false;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  // Una soluzione mostrata/nascosta cambia il contenuto leggibile: interrompere
  // la coda precedente, che altrimenti potrebbe continuare a leggere testo chiuso.
  useEffect(() => {
    window.addEventListener("ascolto:contenuto-cambiato", stop);
    return () => window.removeEventListener("ascolto:contenuto-cambiato", stop);
  }, [stop]);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (active.current) {
      stop();
      return;
    }

    const text = getReadableText();
    if (!text) return;

    if (!cachedVoice) cachedVoice = pickBestVoice();

    const chunks = splitSentences(text);
    if (!chunks.length) return;
    const id = ++generation.current;
    window.speechSynthesis.cancel();
    active.current = true;
    setSpeaking(true);

    // Solo un segmento alla volta: molti motori perdono la coda se vengono
    // accodate insieme centinaia di frasi. Stop invalida anche gli eventi tardivi.
    const readChunk = (index: number) => {
      if (!active.current || generation.current !== id) return;
      if (index >= chunks.length) {
        active.current = false;
        setSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.lang = "it-IT";
      utterance.rate = 0.95;
      utterance.pitch = 1;
      if (cachedVoice) utterance.voice = cachedVoice;
      utterance.onend = () => readChunk(index + 1);
      utterance.onerror = (event) => {
        if (event.error === "interrupted" || event.error === "canceled") {
          if (generation.current === id) { active.current = false; setSpeaking(false); }
        } else readChunk(index + 1);
      };
      window.speechSynthesis.speak(utterance);
    };
    readChunk(0);
  }, [supported, stop]);

  return { speaking, supported, toggle, stop };
}
