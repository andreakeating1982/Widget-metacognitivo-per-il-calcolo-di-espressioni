/**
 * Normalizza il testo riconosciuto dall'OCR (Tesseract) in un'ESPRESSIONE
 * comprensibile al parser dell'app (lib/espressioni.ts).
 *
 * ⚠️ GLI APICI STAMPATI ARRIVANO MALSIMAMENTE (testato con Tesseract 5 su
 * foto sintetiche di espressioni con potenze). Letture reali osservate:
 *   x²  →  «x°», «x?», «x’», «xX7», «x*°»    x³ → «x°», «?»
 *   −   →  a volte «=»  (che altrimenti fa SCARTARE tutto il lato destro!)
 * La strategia: recuperare l'ESONENTE anche dai simboli spurii (il valore
 * può essere incerto — il risultato finisce comunque nel campo modificabile
 * dove l'utente controlla e corregge prima di premere OK).
 *
 * Parentesi QUADRE e GRAFFE: NON si convertono in tonde (regola fissa
 * dell'utente): restano quelle stampate nell'espressione.
 */

const SUP_DIGITS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};

/** Simboli con cui Tesseract scambia l'apice (° ' ’ ` ´ " ” ?) */
const GARBAGE_SUP = "°'’`´\"”?";

/** Unifica i simboli equivalenti in una riga */
function unifyLine(l: string): string {
  return l
    .replace(/[−–—]/g, "-")
    .replace(/[×·⋅•∗]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => "^" + SUP_DIGITS[c])
    .replace(/[·]/g, "*")
    // Punto tra cifre = PUNTO DI MOLTIPLICAZIONE perso dall'OCR (segnalazione
    // 26/9: «3·3» letto «3.3» diventava il decimale 3,3!). In una foto di
    // espressioni scolastiche un punto in mezzo alle cifre non è mai un
    // decimale: in Italia si scrive con la virgola (gestita più avanti).
    .replace(/(\d)\.(?=\d)/g, "$1*");
}

/** Riconosce ed estrae l'espressione dal testo OCR grezzo */
export function normalizeExpressionOcr(raw: string, light = false): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // L'espressione sta nelle righe con operatori o lettere; scarta intestazioni
  let keep = lines.filter((l) => /[+\-*/×÷=^]/.test(l) || /[a-zA-Z]\s*\(/.test(l));
  if (keep.length === 0) keep = lines.slice(0, 3);

  let s = unifyLine(keep.join(" "));

  // Togli tutto ciò che segue l'uguale SE il lato destro è solo un numero
  // (= risultato stampato); altrimenti l'«=» è quasi certamente un MENO
  // letto male dal Tesseract (osservato su foto reali di espressioni!) e va
  // riportato a «-», altrimenti perdiamo metà dell'espressione.
  const eqIdx = s.indexOf("=");
  if (eqIdx !== -1) {
    const left = s.slice(0, eqIdx).trim();
    const right = s.slice(eqIdx + 1).trim();
    if (/[a-zA-Z]/.test(right) || /[+*/^]/.test(right)) {
      s = left + "-" + right.replace(/=/g, "-");
    } else {
      s = left;
    }
  }

  // Rimuovi spazi
  s = s.replace(/\s+/g, "");

  // ── RADICI: Tesseract legge √ come «V» o «v» (verificato su foto reali) ──
  // V/v seguita da cifra o parentesi = radice («V9» → √9, «V(4+5)» → √(4+5))
  s = s.replace(/[Vv](?=[0-9(])/g, "√");

  // ── Simboli d'apice spurii (PRIMA del filtro, che li eliminerebbe) ──
  // L'apice ²/³ stampato arriva spesso come «°», «?», «'»… (verificato con
  // Tesseract 5). Il simbolo spurio vale:
  //   • MOLTIPLICAZIONE se seguito da cifra/lettera/parentesi aperta
  //     (lettura reale: «2·[3…» → «2°(3…»)
  //   • ESPONENTE (²) altrimenti (lettura reale: «2³+5» → «2°+5»)
  // ⚠️ vale anche dopo una CIFRA: «2³» → «2°» → 2^2 (potenze numeriche!)
  // ⚠️ REGOLA FISSA DELL'UTENTE: l'app NON deve mai INSERIRE operazioni da
  // sé. Il simbolo spurio NON diventa mai una moltiplicazione:
  //   • seguito da cifra/lettera/parentesi aperta → SI SCARTA
  //     (lettura reale: «2·[3…» → «2°(3…» → «2(3…»: la giustapposizione
  //     vale già come prodotto, senza inventare nessun «*»)
  //   • seguito da operatore o fine → è un APICE: «2³+5» → «2°+5» → 2^2
  // ⚠️ vale anche dopo una CIFRA: «2³» → «2°» → 2^2 (potenze numeriche!)
  s = s.replace(new RegExp(`([0-9a-z)\\]}])[${GARBAGE_SUP}](?=[0-9a-z(\\[{])`, "gi"), "$1");
  s = s.replace(new RegExp(`([0-9a-z)\\]}])[${GARBAGE_SUP}]`, "gi"), "$1^2");
  // «x*°3x» (apice fuso con la moltiplicazione LETTA dall'OCR) → x^2*3x
  s = s.replace(new RegExp(`([a-z)\\]}])\\*[${GARBAGE_SUP}]`, "gi"), "$1^2*");

  if (!light) {
    // ── L'apice letto come «X» maiuscola (Tesseract: x² → «xX7») ──
    // lettera + X + cifra → l'X è l'apice impastato, la cifra è l'esponente
    s = s.replace(/([a-z])X(\d)/g, "$1^$2");
    // lettera + X + altro → X è puro rumore (es. «5xX+2» per «5x+2»)
    s = s.replace(/([a-z])X(?=[^a-zA-Z]|$)/g, "$1");
  }

  // ── PULIZIA DEI SEGNI SPURII (mai INVENTARE: solo TOGLIERE il simbolo di
  // troppo). L'OCR a volte raddoppia i segni: «·» letto come «*+» o «*/»,
  // asterischi prima di una parentesi chiusa, segni alla fine di una foto
  // tagliata. Si toglie solo il simbolo di troppo, mai aggiungerne.
  s = s.replace(/\*([+*/^)\]}])/g, "$1"); // «*+»→«+», «*/»→«/», «*)»→«)»
  s = s.replace(/([+*/^(\[{])\*/g, "$1"); // «+*»→«+», «(*»→«(», «^*»→«^»
  s = s.replace(/^[+*/^]+/, "");           // segni di troppo all'inizio
  s = s.replace(/[+\-*/^]+$/, "");         // segni di troppo alla fine (foto tagliata)

  // Le variabili sono minuscole: abbassa ogni lettera rimasta (l'OCR
  // scrive maiuscole a caso: «A» per 4, «X» per x…)
  s = s.toLowerCase();

  // Conserva solo i caratteri sensati (incluse quadre, graffe e √, che
  // restano quelle scritte — regola fissa dell'utente)
  // (19/10) ⁄ (U+2044) incluso: le frazioni impilate ricostruite dalla foto
  // (lib/photoFractions.ts) arrivano qui come «n⁄d» — il solver le stampa
  // impilate e NON sono divisioni (i due punti restano «:»)
  s = s.replace(/[^0-9a-z√+\-*/^().,\[\]{}\u2044]/g, "");

  // ── Esponenti persi: cifra attaccata a LETTERA o PARENTESI CHIUSA ──
  // L'apice ² stampato arriva spesso come CIFRA ATTACCATA («x2»):
  // convenzione scolastica, i coefficienti si scrivono sempre PRIMA della
  // lettera. Va DOPO il filtro, così le lettere di rumore non creano falsi
  // esponenti. «x2»→x^2 · «(2x)3»→(2x)^3 · «xy2»→xy^2
  if (!light) s = s.replace(/([a-z)\]}])(\d)(?!\d)/g, "$1^$2");

  // ── RIPARAZIONE PARENTESI (graffe e quadre lette male dall'OCR) ──
  // L'OCR a volte confonde ] con ) (o perde una chiusura): se una parentesi
  // chiude un livello APERTO con un tipo sbagliato, lo si armonizza;
  // le chiusure mancanti in fondo vengono aggiunte, le closers orfane
  // vengono scartate. Le parentesi GIUSTE restano ESATTAMENTE quelle
  // scritte (regola fissa: quadre e graffe non si convertono in tonde).
  s = fixBrackets(s);

  // Virgola decimale tra cifre → punto
  s = s.replace(/(\d),(\d)/g, "$1.$2");

  return s;
}

/** Nota «da libro» per il CAMPO MODIFICABILE dopo una foto: l'espressione
 *  si mostra con la STESSA notazione della foto (· per il prodotto, : per la
 *  divisione, apici in alto), così è evidente che l'app ha SOLO LETTO la
 *  foto — non ha inserito né svolto nessuna operazione. Al momento dell'OK
 *  normalizeInput riconverte ·, : e gli apici unicode senza problemi. */
const SUP_REV: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
export function prettyExpression(s: string): string {
  return s
    // apici con graffe (x^{2}, come li scrive spliceExponents) e senza
    .replace(/\^\{([0-9]+)\}/g, (_, d: string) => [...d].map((c) => SUP_REV[c] ?? c).join(""))
    .replace(/\^(\d+)/g, (_, d: string) => [...d].map((c) => SUP_REV[c] ?? c).join(""))
    .replace(/\*/g, "·")
    .replace(/\\(?:times|cdot|bullet)/g, "·") // comandi LaTeX di moltiplicazione
    .replace(/[×⋅•∗]/g, "·") // simboli Unicode di moltiplicazione → puntino
    .replace(/\//g, ":")
    // ⚠️ GRAFFE LATEX (4/10, segnalazione utente: «la graffa disegnata me la
    // riconosce sempre con una slash accanto»): per un pezzo con SOLO la
    // graffa l'estrazione geometrica non scatta (guardia anti-«3»/«E») e il
    // modello legge la graffa come comando LaTeX «\{» / «\left\{» /
    // «\lbrace». Nel DISPLAY il backslash NON si vede mai: la graffa si
    // mostra «{», mai «\{» (che l'utente legge «/ graffa»). normalizeInput
    // converte già al momento del calcolo; qui serve la stessa resa.
    .replace(/\\(?:left|right)/g, "")
    .replace(/\\lbrace/g, "{")
    .replace(/\\rbrace/g, "}")
    .replace(/\\([{}])/g, "$1");
}

/** ⚠️ DOPPIO MENO «--» (segnalazione 27/9, «ancora mi trascrive il doppio
 *  meno»): rete di sicurezza finale — NESSUNA espressione scolastica usa
 *  meni consecutivi, quindi qualunque sequenza di 2+ «-» (meno scritto in
 *  due segmenti staccati, tratto ripassato con scarto, tick residuo letto
 *  «-» dal modello che si somma al meno sintetico…) si COLASSA in uno
 *  solo. Vale per il percorso a pezzi e per l'inserimento delle ancore. */
export function collapseRepeatedMinus(s: string): string {
  // (7/10, giro 6) «-=» NON esiste (un meno non puo' precedere un uguale): il modello legge «=» il
  // cappello del 4 / un tick e si somma al meno sintetico («14-8» → «14-=8», «[2-1]» → «[2-=1]»).
  // L'inverso «=-» e' legittimo (`x=-3`) e NON si tocca.
  return s.replace(/[-\u2212]{2,}/g, "-").replace(/([-\u2212])\s*=/g, "$1");
}

/** Armonizza le parentesi chiuse male dall'OCR senza toccare quelle giuste */
function fixBrackets(s: string): string {
  const openOf: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const closeOf: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];
  const out: string[] = [];
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") {
      stack.push(ch);
      out.push(ch);
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      const want = closeOf[stack[stack.length - 1] ?? ""];
      if (want === ch) {
        stack.pop();
        out.push(ch);
        continue;
      }
      // chiude un livello esterno col tipo sbagliato → chiudi prima gli interni
      const idx = stack.lastIndexOf(openOf[ch]);
      if (idx !== -1) {
        while (stack.length > idx + 1) out.push(closeOf[stack.pop()!]);
        stack.pop();
        out.push(ch);
        continue;
      }
      if (stack.length > 0) {
        // closer col tipo sbagliato ma c'è un'aperta aperta (l'OCR ha
        // scambiato ] con ) ecc.): lo si converte nel tipo atteso
        stack.pop();
        out.push(want);
        continue;
      }
      // closer orfano (nessuna apertura corrispondente): scartato
      continue;
    }
    out.push(ch);
  }
  // chiusure mancanti in fondo
  while (stack.length) out.push(closeOf[stack.pop()!]);
  return out.join("");
}
