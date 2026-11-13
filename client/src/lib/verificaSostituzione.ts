/** (08/11, radicali con lettere) Verifica per SOSTITUZIONE NUMERICA MULTIPLA.
 *
 * Porta lato client dello stesso verificatore già collaudato sul server
 * (server/costruisci.ts): le forme con lettere E radicali — √((a²−1)/3):(3a+3)
 * = √(3(a²−1))/(9(a+1)) — non sono né razionali (ogni radice blocca
 * rationalPolyEquals) né valutabili con la lettera libera
 * (evaluateNumericExpression torna null sui «var»). Con la sostituzione,
 * se entrambe le parti restano definite e coincidono su almeno 3 campioni
 * interi distanziati (incluse tornate NEGATIVE) si ha una verifica empirica,
 * non una dimostrazione di identità su tutto il dominio.
 *
 * null = «il motore non decide» (meno di 3 campioni validi, troppe lettere,
 * forme troppo lunghe): la risposta resta da verificare con gli altri percorsi.
 * false = almeno un campione definito dove le due parti DIPENDONO.
 */
import { evaluateNumericExpression } from "./espressioni";

/* Stesse tornate del server: 3 positive ruotate + 3 con negativi. I valori
   negativi vanno PARENTESIZZATI nella sostituzione, così (−2)² = 4 e i
   campioni negativi restano parlati anche dentro le potenze. */
const TORNATE: number[][] = [
  [-13, -7, -3],
  [-7, -3, -13],
  [-3, -13, -7],
  [-1, 3, 7],
  [0, 3, 7],
  [1, 3, 7],
  [2, 5, 11],
  [5, 11, 2],
  [11, 2, 5],
  /* (12/11) stesse tornate positive aggiuntive del server (3, 7, 13):
   * con un POLO in x = 2, 5, 7, 11 o 13 (es. risposta 1/(x−5)) almeno
   * 3 tornate restano interamente definite e il confronto decide invece
   * di restare «non decidibile». */
  [3, 7, 13],
  [7, 13, 3],
  [13, 3, 7],
  [-2, 5, 11],
  [5, -2, 11],
  [-2, -5, 11],
];

/** Ulteriori sonde vicino alle costanti presenti nella traccia: per esempio
 * |x−1000| richiede almeno un controllo con x minore di 1000. Non costituisce
 * una dimostrazione simbolica, ma evita di assumere segni in base a un piccolo
 * insieme fisso di valori. Limite prudenziale sul lavoro per le formule lunghe. */
export function tornateAdattive(a: string, b: string, numeroLettere: number): number[][] {
  if (!/[√∛∜|]|\\sqrt|\\abs/.test(a + b)) return [];
  const numeri = [...new Set(((a + " " + b).match(/\d+(?:[,.]\d+)?/g) ?? [])
    .map((s) => Number(s.replace(",", "."))).filter((n) => Number.isFinite(n) && n >= 2 && n <= 100000))]
    .sort((x, y) => y - x).slice(0, 8);
  const sonde: number[][] = [];
  for (const n of numeri) {
    for (const v of [n - 1, n + 1, -n - 1, -n + 1]) {
      for (let i = 0; i < numeroLettere; i++) {
        const valori = [2, 5, 11];
        valori[i] = v;
        sonde.push(valori);
      }
    }
  }
  return sonde;
}

/* Parole che NON sono prodotti di variabili (stessa lista del server):
 * comandi LaTeX nella notazione da tastiera (senza «\») e marcatori
 * dell'app (per = periodico, rad = radice). */
const PAROLE_NON_VAR = new Set([
  "rad", "per", "sqrt", "root", "nthroot", "frac", "dfrac", "tfrac",
  "over", "cdot", "times", "div", "pi", "left", "right", "overline",
  "bar", "pow", "log", "ln", "exp", "sin", "cos", "tan", "mod", "abs",
]);

/** Lettere presenti come simboli liberi: la «a» di «a^{2}» sì, la «a» di
 *  \dfrac no (è preceduta da una lettera di comando o da «\»).
 *  (10/11) GIUSTAPPOSIZIONE: in «ab^{-1}» né «a» né «b» superano la regola
 *  del singolo carattere (circondate da altre lettere): le sequenze di 2+
 *  lettere minuscole fuori dai comandi LaTeX contribuiscono tutte le loro
 *  lettere ammesse, così √(ab⁻¹) diventa verificabile anche lato client. */
export function lettereLibere(s: string): string[] {
  const trovate = new Set<string>();
  for (const l of ["a", "b", "c", "x", "y", "z"] as const) {
    if (new RegExp(`(^|[^a-zA-Z])${l}(?![a-zA-Z])`).test(s)) trovate.add(l);
  }
  for (const m of s.matchAll(/(?<![a-zA-Z\\])[a-z]{2,}/g)) {
    if (PAROLE_NON_VAR.has(m[0])) continue;
    for (const l of ["a", "b", "c", "x", "y", "z"] as const) {
      if (m[0].includes(l)) trovate.add(l);
    }
  }
  return [...trovate];
}

/** Sostituisce le lettere con un valore rendendo espliciti i prodotti
 *  impliciti (3a → 3·v, ab → v·v, a(b+1) → v·(b+1), x²y → v²·v) senza
 *  toccare i comandi LaTeX: la prima lettera di ogni parola di comando è
 *  sempre preceduta da «\» e le interne da altre lettere, quindi le guardie
 *  (?<![a-zA-Z\\]) e (?![a-zA-Z]) le proteggono. */
export function sostituisciLettere(s: string, valori: Record<string, number>): string {
  let t = s
    .replace(/(?<![a-zA-Z\\])([a-z])(?=\()/g, "$1·")   // a( … → a·( …
    .replace(/(?<![a-zA-Z\\])([a-z])(?=[a-z])/g, "$1·") // ab → a·b
    .replace(/(?<![a-zA-Z\\])([a-z])(?=\d)/g, "$1·")   // x2 → x·2, non 12 quando x=1
    .replace(/\}(?=[a-z])/g, "}·")                      // x^{2}y → x^{2}·y
    .replace(/(\d)(?=[a-zA-Z])/g, "$1·");               // 3a → 3·a
  for (const [l, v] of Object.entries(valori)) {
    const stampato = v < 0 ? `(${v})` : String(v);
    t = t.replace(new RegExp(`(^|[^a-zA-Z])${l}(?![a-zA-Z])`, "g"), `$1${stampato}`);
  }
  return t;
}

/* I periodici sono trattati dal parser come frazioni esatte. Non espanderli
 * ripetendo le cifre: periodi di più cifre superano il limite numerico e
 * rendono impossibile la verifica, pur essendo perfettamente rappresentabili. */
/* (10/11) ESPONENTI FRAZIONARI NEGATIVI nella verifica numerica: il parser
 * rifiuta per scelta didattica «2^{-\frac{2}{3}}» (allo studente si dice di
 * riscrivere col libro capovolgendo la base), quindi anche la sostituzione
 * numerica tornava null e catene corrette come ∛(a⁻²) = a^{-2/3} restavano
 * «non verificabili». SOLO qui, per verificare (mai mostrato allo studente),
 * riscrivo base^{-m/n} come ((base)^{m/n})^{-1}: esponente −1 intero, che
 * il parser accetta. La base è il gruppo } o ) bilanciato prima di ^, un
 * numero, o UNA sola lettera (in LaTeX «ab^{-2/3}» è a·b^{-2/3}). */
function sbattaEsponentiFrazionariNegativi(s: string): string {
  /* Anche esponenti frazionari POSITIVI con denominatore oltre il tetto
   * didattico 9 (es. a^{11/12} dal m.c.m. tra 3 e 4): li riscrivo come
   * radice di indice d, che il parser accetta fino a 99. */
  const pat = /\^(\{)?\s*(-)?\s*\\?[dt]?frac\s*\{(\d+)\}\s*\{(\d+)\}(\})?/g;
  let result = "";
  let last = 0;
  for (const m of s.matchAll(pat)) {
    const start = m.index!;
    if (m[1] === "{" && m[5] !== "}") continue; // graffa dell'esponente non chiusa: lascio stare
    const neg = !!m[2];
    const num = m[3]!;
    const den = m[4]!;
    if (!neg && Number(den) <= 9) continue; // il parser lo accetta già: lascio stare
    const c = start > 0 ? s[start - 1] : "";
    let bStart = start;
    let base = "";
    if (c === "}" || c === ")") {
      const open = c === "}" ? "{" : "(";
      let depth = 0;
      let i = start - 1;
      for (; i >= 0; i--) {
        if (s[i] === c) depth++;
        else if (s[i] === open) {
          depth--;
          if (depth === 0) break;
        }
      }
      if (i < 0) continue;
      bStart = i;
      base = s.slice(i, start);
    } else if (/[0-9]/.test(c)) {
      let i = start - 1;
      while (i > 0 && /[0-9]/.test(s[i - 1])) i--;
      bStart = i;
      base = s.slice(i, start);
    } else if (/[a-zA-Z]/.test(c)) {
      bStart = start - 1;
      base = c;
    } else {
      continue;
    }
    const interno = Number(den) > 9
      ? `(\\sqrt[${den}]{${base}})^{${num}}`
      : `(${base}^{\\frac{${num}}{${den}}})`;
    result += s.slice(last, bStart);
    result += neg ? `${interno}^{-1}` : interno;
    last = start + m[0].length;
  }
  result += s.slice(last);
  return result;
}

/** Valore numerico di una scrittura già senza lettere (virgola decimale
 *  italiana compresa, come fa il server prima di valutare). */
function valoreNumerico(scritta: string): number | null {
  try {
    return evaluateNumericExpression(
      sbattaEsponentiFrazionariNegativi(scritta),
    );
  } catch {
    return null;
  }
}

/** true/false solo quando il confronto è dimostrabile sui campioni;
 *  null altrimenti (nessuna decisione). */
export function verificaPerSostituzione(attesa: string, scritta: string): boolean | null {
  const lettere = [...new Set([...lettereLibere(attesa), ...lettereLibere(scritta)])];
  if (lettere.length === 0 || lettere.length > 3) return null;
  if (attesa.length > 400 || scritta.length > 400) return null;
  let validi = 0;
  for (const tornata of [...TORNATE, ...tornateAdattive(attesa, scritta, lettere.length)]) {
    const valori: Record<string, number> = {};
    lettere.forEach((l, j) => {
      valori[l] = tornata[j % tornata.length];
    });
    let va: number | null = null;
    let vs: number | null = null;
    try {
      va = valoreNumerico(sostituisciLettere(attesa, valori));
      vs = valoreNumerico(sostituisciLettere(scritta, valori));
    } catch {
      continue;
    }
    // Non accettare una scrittura non definita dove il passo richiesto lo è.
    if (va !== null && Number.isFinite(va) && (vs === null || !Number.isFinite(vs))) return false;
    if (va === null || vs === null || !Number.isFinite(va) || !Number.isFinite(vs)) continue;
    validi++;
    if (Math.abs(va - vs) > 1e-9 * Math.max(1, Math.abs(va), Math.abs(vs))) return false;
  }
  return validi >= 3 ? true : null;
}
