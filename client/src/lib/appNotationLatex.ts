/**
 * appNotationLatex.ts — dalla NOTAZIONE dell'app (⁄ = frazione impilata, √ ∛ ∜
 * radici, ^ potenze) al LaTeX che KaTeX sa disegnare. Modulo PURO (nessun
 * React): estratto da EspressioniExercises.tsx per poterlo collaudare.
 *
 * (7/11, foto «Frazioni_algebriche_1-5»: l'espressione a²/(ab−b²) − … letta
 * dalla foto compariva come «a^{2/(ab−b²)} …»). Cause trovate e risolte qui:
 *  1. l'operando di ⁄ era l'ESPONENTE («2» di a^2⁄…) e non la potenza intera:
 *     ora numeratore e denominatore comprendono SEMPRE le potenze, come le
 *     legge il parser (lib/espressioni.ts, parsePower);
 *  2. KaTeX legge UN solo carattere dopo «^»: x^10 diventava x¹0 e x^-2
 *     x⁻2 → gli esponenti a più caratteri si racchiudono tra graffe;
 *  3. le parentesi che racchiudono TUTTO il numeratore o il denominatore
 *     servono solo alla notazione lineare: sul libro non ci sono, quindi
 *     non si mostrano dentro la frazione impilata.
 */

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= "0" && c <= "9";
const isLetter = (c: string | undefined): boolean => c !== undefined && /[a-zA-Z]/.test(c);

/** Indice della «)» che chiude la «(» in s[open], o -1 se non bilanciata */
function matchingClose(s: string, open: number): number {
  let depth = 0;
  for (let m = open; m < s.length; m++) {
    if (s[m] === "(") depth++;
    else if (s[m] === ")") {
      depth--;
      if (depth === 0) return m;
    }
  }
  return -1;
}

/** Indice della «(» che apre la «)» in s[close], o -1 se non bilanciata */
function matchingOpen(s: string, close: number): number {
  let depth = 0;
  for (let m = close; m >= 0; m--) {
    if (s[m] === ")") depth++;
    else if (s[m] === "(") {
      depth--;
      if (depth === 0) return m;
    }
  }
  return -1;
}

/** Fine (indice dopo l'ultimo carattere) dell'esponente che comincia con s[caret] === "^":
 *  ^2, ^12, ^-2, ^(…), ^n. Se non è riconoscibile restituisce caret (nessuna estensione). */
function exponentEnd(s: string, caret: number): number {
  let p = caret + 1;
  if (s[p] === "-") p++;
  if (s[p] === "(") {
    const c = matchingClose(s, p);
    return c >= 0 ? c + 1 : caret;
  }
  if (isDigit(s[p])) {
    while (isDigit(s[p])) p++;
    return p;
  }
  if (isLetter(s[p])) return p + 1;
  return caret;
}

/** Simboli di radice in NOTAZIONE APP (√ ∛ ∜): con l'operando tra parentesi
 *  (√(ab+1)) o atomico (√2, √ab) valgono come UN SOLO operando di ⁄. */
function isRadicalChar(c: string): boolean {
  return c === "√" || c === "∛" || c === "∜";
}

/** Se l'operando che comincia in `start` è l'ESPONENTE di una potenza (preceduto
 *  da «^», con eventuale «-»), restituisce l'inizio della BASE: l'operando di ⁄
 *  è la potenza intera (a^2⁄b = «a²» sopra «b», non «2» sopra «b»). */
function powerStart(s: string, start: number): number {
  let q = start - 1;
  if (s[q] === "-" && s[q - 1] === "^") q--;
  if (s[q] !== "^") return start;
  const b = q - 1;
  if (b < 0) return start;
  if (s[b] === ")") {
    const o = matchingOpen(s, b);
    return o >= 0 ? o : start;
  }
  if (isDigit(s[b])) {
    let m = b;
    while (m >= 0 && (isDigit(s[m]) || s[m] === ".")) m--;
    return m + 1;
  }
  if (isLetter(s[b])) {
    let m = b;
    while (m >= 0 && isLetter(s[m])) m--;
    return m + 1;
  }
  return start;
}

/** «(…)» che racchiude TUTTO il testo → il contenuto; altrimenti il testo com'è.
 *  Le parentesi con esponente o con altro attaccato ((a+b)^2, (a+b)(a−b)) restano. */
function unwrapGroup(t: string): string {
  if (t.length < 3 || t[0] !== "(" || matchingClose(t, 0) !== t.length - 1) return t;
  const inner = t.slice(1, -1).trim();
  return inner ? inner : t;
}

/** (26/10, foto utente «frazioni non più impilate»): converte OGNI a⁄b in
 *  \frac{a}{b}, con operandi semplici (12⁄34, az⁄4, 2⁄3az → \frac{2}{3}az),
 *  gruppi tra parentesi bilanciate ((1⁄2)⁄(3⁄4)) e comandi LaTeX già
 *  presenti (\sqrt{3}⁄2 → \frac{\sqrt{3}}{2}). Va eseguita PRIMA delle
 *  radici, così √(3⁄7) diventa \sqrt{\frac{3}{7}}.
 *  (7/11) Gli operandi comprendono le POTENZE (a^2⁄(ab−b^2) → \frac{a^2}{ab−b^2},
 *  1⁄b^2 → \frac{1}{b^2}) e le parentesi che racchiudono tutto l'operando
 *  si tolgono ((a+b)⁄(a−b) → \frac{a+b}{a−b}). */
export function stackedFractionsToLatex(src: string): string {
  /* (26/10-fix) Una sostituzione alla volta con RIPARTENZA da capo: dopo
     aver inserito un \frac{}{} gli indici vecchi non sono più validi;
     continuare la scansione con l'indice precedente corrompeva le frazioni
     annidate/adiacenti (es. (1⁄2)⁄(3⁄4) → output spezzato). Ogni passata
     rimuove esattamente una ⁄, quindi il ciclo termina (guardia a 50). */
  const convertFirst = (s: string): string | null => {
    let i = 0;
    for (;;) {
      const k = s.indexOf("⁄", i);
      if (k < 0) return null;
      // --- operando destro (dopo la ⁄) ---
      let j = k + 1;
      while (j < s.length && s[j] === " ") j++;
      let rEnd = -1;
      // Un indice in apice attaccato a √ fa parte della radice, anche se negativo.
      const indexedRadical = s.slice(j).match(/^⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+(?=√)/)?.[0] ?? "";
      const radicalAt = j + indexedRadical.length;
      if (isRadicalChar(s[radicalAt])) {
        /* (11/11, foto «(√(ab)+1)^2⁄√(ab+1)»): la radice SENZA parentesi
           che la racchiudono è un operando a sé: √( … ) prende la parentesi
           del radicando, √2 e √ab prendono cifre/lettere attaccate. */
        let j2 = radicalAt + 1;
        while (j2 < s.length && s[j2] === " ") j2++;
        if (s[j2] === "(") {
          const c = matchingClose(s, j2);
          if (c >= 0) rEnd = c + 1;
        } else if (isDigit(s[j2])) {
          let m = j2;
          while (m < s.length && (isDigit(s[m]) || s[m] === ".")) m++;
          rEnd = m;
        } else if (isLetter(s[j2])) {
          let m = j2;
          while (m < s.length && isLetter(s[m])) m++;
          rEnd = m;
        }
      } else if (s[j] === "(") {
        const c = matchingClose(s, j);
        if (c >= 0) rEnd = c + 1;
      } else if (isDigit(s[j])) {
        let m = j;
        while (m < s.length && (isDigit(s[m]) || s[m] === ".")) m++;
        rEnd = m;
      } else if (isLetter(s[j])) {
        let m = j;
        while (m < s.length && isLetter(s[m])) m++;
        rEnd = m;
      }
      // l'esponente scritto dopo il denominatore è del denominatore (1⁄b^2, 1⁄(x+1)^2)
      if (rEnd >= 0 && s[rEnd] === "^") rEnd = exponentEnd(s, rEnd);
      // --- operando sinistro (prima della ⁄) ---
      let l = k - 1;
      while (l >= 0 && s[l] === " ") l--;
      let lStart = -1;
      if (s[l] === ")") {
        const o = matchingOpen(s, l);
        if (o >= 0) lStart = o;
      } else if (s[l] === "}") {
        let depth = 0;
        let m = l;
        for (; m >= 0; m--) {
          if (s[m] === "}") depth++;
          else if (s[m] === "{") {
            depth--;
            if (depth === 0) break;
          }
        }
        if (depth === 0) {
          // risale sopra \comando (es. \sqrt{3}⁄2 → operando \sqrt{3})
          let c = m - 1;
          while (c >= 0 && isLetter(s[c])) c--;
          lStart = s[c] === "\\" ? c : m;
        }
      } else if (isDigit(s[l])) {
        let m = l;
        while (m >= 0 && (isDigit(s[m]) || s[m] === ".")) m--;
        lStart = m + 1;
      } else if (isLetter(s[l])) {
        let m = l;
        while (m >= 0 && isLetter(s[m])) m--;
        lStart = m + 1;
      }
      // se l'operando trovato è un ESPONENTE (a^2⁄…), il numeratore è la potenza intera
      if (lStart >= 0) lStart = powerStart(s, lStart);
      // (11/11) la radice DAVANTI all'operando è parte dell'operando:
      // √(ab+1)⁄2 → \frac{√(ab+1)}{2}, √(ab)^2⁄x → \frac{√(ab)^2}{x}, √ab⁄3 → \frac{√ab}{3}
      if (lStart > 0 && isRadicalChar(s[lStart - 1])) {
        lStart--;
        if (s[lStart] === "√") {
          while (lStart > 0 && /[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(s[lStart - 1])) lStart--;
          if (lStart > 0 && s[lStart - 1] === "⁻" && /[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(s[lStart])) lStart--;
        }
      }
      if (rEnd < 0 || lStart < 0) {
        i = k + 1;
        continue;
      }
      const left = s.slice(lStart, k).trim();
      const right = s.slice(j, rEnd).trim();
      if (!left || !right) {
        i = k + 1;
        continue;
      }
      return s.slice(0, lStart) + "\\frac{" + unwrapGroup(left) + "}{" + unwrapGroup(right) + "}" + s.slice(rEnd);
    }
  };
  let t = src;
  for (let n = 0; n < 50; n++) {
    const next = convertFirst(t);
    if (next === null) break;
    t = next;
  }
  return t;
}

/** Indice della «}» che chiude la «{» in s[open] (le graffe escapate \{ \} non contano), o -1 */
function matchBrace(s: string, open: number): number {
  let depth = 0;
  for (let m = open; m < s.length; m++) {
    if (s[m] === "\\") {
      m++;
      continue;
    }
    if (s[m] === "{") depth++;
    else if (s[m] === "}") {
      depth--;
      if (depth === 0) return m;
    }
  }
  return -1;
}

const LEFT_ROUND = "\\left(";
const RIGHT_ROUND = "\\right)";

/** «\left( … \right)» che racchiude TUTTO l'operando → il contenuto; altrimenti com'è */
function stripEnclosingLeftRight(group: string): string {
  const t = group.trim();
  if (!t.startsWith(LEFT_ROUND) || !t.endsWith(RIGHT_ROUND)) return group;
  let depth = 0;
  for (let i = 0; i < t.length; ) {
    if (t.startsWith(LEFT_ROUND, i)) {
      depth++;
      i += LEFT_ROUND.length;
      continue;
    }
    if (t.startsWith(RIGHT_ROUND, i)) {
      depth--;
      if (depth === 0) {
        if (i + RIGHT_ROUND.length !== t.length) return group;
        const inner = t.slice(LEFT_ROUND.length, i).trim();
        return inner ? inner : group;
      }
      i += RIGHT_ROUND.length;
      continue;
    }
    i++;
  }
  return group;
}

/** LaTeX già stampato (es. dal motore: \dfrac{\left(a+b\right)}{\left(a−b\right)}):
 *  toglie le parentesi TONDE che racchiudono per intero numeratore o denominatore
 *  di una frazione impilata — sul libro non ci sono e non cambiano il valore.
 *  Restano: parentesi con esponente o con altri fattori accanto, quadre e graffe
 *  disegnate dallo studente, parentesi fuori dalla frazione. */
export function tidyFractionParens(latex: string): string {
  if (!latex) return "";
  if (!/\\[dtc]?frac/.test(latex)) return latex;
  const re = /\\[dtc]?frac\s*\{/y;
  let out = "";
  let i = 0;
  while (i < latex.length) {
    re.lastIndex = i;
    const m = re.exec(latex);
    if (!m) {
      out += latex[i];
      i++;
      continue;
    }
    const numOpen = i + m[0].length - 1;
    const numClose = matchBrace(latex, numOpen);
    let denOpen = numClose + 1;
    while (numClose >= 0 && latex[denOpen] === " ") denOpen++;
    const denClose = numClose >= 0 && latex[denOpen] === "{" ? matchBrace(latex, denOpen) : -1;
    if (numClose < 0 || denClose < 0) {
      // LaTeX incompleto: non si tocca
      out += latex[i];
      i++;
      continue;
    }
    const head = latex.slice(i, numOpen);
    const num = tidyFractionParens(stripEnclosingLeftRight(latex.slice(numOpen + 1, numClose)));
    const den = tidyFractionParens(stripEnclosingLeftRight(latex.slice(denOpen + 1, denClose)));
    out += `${head}{${num}}{${den}}`;
    i = denClose + 1;
  }
  return out;
}

/** (26/10, foto utente «la radice a mano non ha mai la linea sopra il 3»:
 *  CAUSA TROVATA — i pezzi scritti a mano/foto arrivano in notazione
 *  dell'app («√(3)», «√(3⁄7)» o «√3»), ma KaTeX disegna la barra del
 *  radicale SOLO con il comando \sqrt{...}: il carattere √ grezzo viene
 *  reso come simbolo + parentesi di testo, senza linea sopra il radicando.
 *  Dalla foto invece arriva già \sqrt{...} (per quello lì la barra c'era).
 *  Questa funzione converte la notazione dell'app in LaTeX PRIMA della resa:
 *  √(madre)/∛()/∜() → \sqrt{}/\sqrt[3]{}/\sqrt[4]{}, √x → \sqrt{x},
 *  e OGNI frazione a⁄b (⁄ = U+2044) → \frac{a}{b} — KaTeX impila SOLO
 *  con \frac, mentre la ⁄ grezza resta lineare (stessa classe di bug
 *  della barra di √: quando il motore valuta, originalLatex ha già \frac
 *  e tutto è ok; quando NON valuta — es. √2 non esatta → fallback — la ⁄
 *  restava grezza e la frazione appariva lineare, come nella foto utente).
 *  Da usare in TUTTI i punti dove una notazione dell'app finisce in KaTeX. */
export function appNotationToLatex(s: string): string {
  // PRIMA le frazioni (così le radici avvolgono frazioni già impilate),
  // POI le radici con parentesi bilanciate.
  let t = stackedFractionsToLatex(s ?? "");
  // Converte UNA occorrenza «SIMBOLO ( ... )» con parentesi BILANCIATE
  // (le regex semplici [^{}()] falliscono con radicandi che contengono
  // altre parentesi, es. √((3⁄7)·(1−4⁄7)) o radici annidate √(√(9))).
  const convertBalanced = (src: string, sym: string, cmd: string): string => {
    let out = "";
    let i = 0;
    for (;;) {
      const k = src.indexOf(sym, i);
      if (k < 0) {
        out += src.slice(i);
        break;
      }
      let j = k + sym.length;
      while (j < src.length && /\s/.test(src[j]!)) j++;
      if (src[j] !== "(") {
        out += src.slice(i, j);
        i = j;
        continue;
      }
      let depth = 0;
      let m = j;
      for (; m < src.length; m++) {
        if (src[m] === "(") depth++;
        else if (src[m] === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) {
        out += src.slice(i, j + 1);
        i = j + 1;
        continue;
      }
      const inner = src.slice(j + 1, m).trim();
      out += src.slice(i, k) + cmd + "{" + inner + "}";
      i = m + 1;
    }
    return out;
  };
  // Nel fallback grafico il parser può non essere riuscito a stampare il
  // LaTeX: convertiamo noi l'intero indice Unicode, segno compreso, PRIMA
  // di trattare la √ semplice. Altrimenti ⁻³ finisce come apice del fattore
  // precedente e la radice appare quadrata.
  const convertIndexedRoots = (src: string): string => {
    const re = /⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+√/g;
    const digits: Record<string, string> = {
      "⁻": "-", "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
      "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
    };
    let out = "";
    let from = 0;
    for (let match = re.exec(src); match; match = re.exec(src)) {
      const start = match.index;
      let j = re.lastIndex;
      while (j < src.length && /\s/.test(src[j])) j++;
      let end = -1;
      let inner = "";
      if (src[j] === "(") {
        const close = matchingClose(src, j);
        if (close >= 0) { end = close + 1; inner = src.slice(j + 1, close).trim(); }
      } else if (/[0-9a-z]/i.test(src[j] ?? "")) {
        end = j + 1;
        inner = src[j];
      }
      if (end < 0) continue;
      const indice = [...match[0].slice(0, -1)].map((c) => digits[c]).join("");
      out += src.slice(from, start) + `\\sqrt[${indice}]{${inner}}`;
      from = end;
      re.lastIndex = end;
    }
    return out + src.slice(from);
  };
  for (let i = 0; i < 4; i++) {
    const prev = t;
    t = convertIndexedRoots(t);
    t = convertBalanced(t, "∛", "\\sqrt[3]");
    t = convertBalanced(t, "∜", "\\sqrt[4]");
    t = convertBalanced(t, "√", "\\sqrt");
    // √x / ∛x / ∜x semplici senza parentesi (cifra, lettera, fraz. impilata)
    t = t
      .replace(/∛\s*([0-9a-z]+(?:\u2044[0-9a-z]+)?)/gi, "\\sqrt[3]{$1}")
      .replace(/∜\s*([0-9a-z]+(?:\u2044[0-9a-z]+)?)/gi, "\\sqrt[4]{$1}")
      .replace(/√\s*([0-9a-z]+(?:[\u2044\/][0-9a-z]+)?)/gi, "\\sqrt{$1}");
    if (t === prev) break;
  }
  // Esponenti a più caratteri: KaTeX ne legge UNO solo dopo «^» (x^10 → x¹0,
  // x^-2 → x⁻2, x^(-2) → x⁽−2): li racchiudo tra graffe. Gli esponenti già tra
  // graffe (LaTeX del motore) non vengono toccati.
  t = t.replace(/\^\(([^()]*)\)/g, "^{$1}").replace(/\^(-?\d+)/g, "^{$1}");
  // Nelle espressioni trascritte (anche quando il parser ricorre al fallback)
  // il prodotto è sempre il puntino: mai l'asterisco o il segno ×.
  t = t.replace(/\\times(?=[^a-zA-Z]|$)/g, "\\cdot ").replace(/[*·⋅×∗]/g, "\\cdot ");
  // Le parentesi che racchiudono tutto numeratore/denominatore non si vedono.
  return tidyFractionParens(uniformaVirgoleDecimaliLatex(t));
}

/** Forma tipografica italiana uniforme anche quando l'IA ha scritto un punto.
 * Le graffe non cambiano il valore: evitano la spaziatura da punteggiatura
 * di TeX, sia nei decimali ordinari sia in quelli periodici. Solo rendering. */
export function uniformaVirgoleDecimaliLatex(latex: string): string {
  return latex
    .replace(/(\d)[.,](?=\d)/g, "$1{,}")
    .replace(/(\d)[.,](?=\\(?:overline|bar)\b)/g, "$1{,}");
}
