/**
 * promptSicuri.ts — la frase didattica guida il METODO, MAI il RISULTATO (26/10).
 *
 * Foto utente «non dire mai la soluzione neanche per iscritto»: il box
 * diceva «MOLTIPLICO SOTTO RADICE: RADICE DI (3/4 PER 8) = RADICE DI 6»,
 * regalando il risultato (√6) che lo studente DSA doveva calcolare da solo.
 * Le frasi procedurali brevi vanno benissimo (alleggeriscono il carico
 * cognitivo), ma non devono anticipare ciò che lo studente deve scrivere.
 *
 * REGOLA (condivisa con l'utente): i numeri già visibili nell'operazione del
 * box si possono nominare (lo studente li vede); ciò che compare SOLO grazie
 * al risultato è segreto e viene tagliato:
 *  1. dopo le parole-risultato (=, →, uguale, diventa, ottengo, fa, ossia,
 *     cioè, scrivo, resta, esce, vale, totale, …) si taglia la clausola se
 *     contiene la risposta (in cifre, a parole, in TeX o come radice detta);
 *  2. «radice (quadrata/cubica/…) di N» si taglia se N non compare
 *     nell'operazione (es. «RADICE DI 6» con op √(3/4)·√8); se N è visibile
 *     («radice di 9» con √9 nel box) resta: lo studente calcola da solo;
 *  3. «tre quarti», «un mezzo» e le altre frazioni a parole si tagliano solo
 *     se usano numeri invisibili (stesso principio);
 *  4. i simboli TeX isolati che valgono la risposta (√6, \frac{3}{4}) si
 *     cancellano se i loro numeri non sono nei dati;
 *  5. la risposta con LETTERE scritta tale e quale (es. «5x») si cancella
 *     ovunque non compaia già nell'operazione;
 *  6. i frammenti di calcolo in cifre che DANNO la risposta con numeri
 *     derivati («3·2» con risposta 6, «10/12» con risposta 5/6) si tolgono;
 *     se tutti i numeri sono visibili («2+3» nel box «2+3») resta: è metodo.
 * Protetto sempre: mcm(…) — la notazione del metodo resta intatta.
 * Se la frase si svuota, resta un invito al metodo che ricorda CHI calcola.
 */

import { latexValue } from "./espressioni";

export interface RipulituraPrompt {
  testo: string;
  ripulito: boolean;
  motivi: string[];
}

/** Frase di riserva: guida il metodo senza dare nulla. */
export const FRASE_METODO_RISERVA = "Applica il metodo e scrivi tu il risultato.";

/* ─── Numeri italiani → valore ─────────────────────────────────────── */

const UNITA = [
  "zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto",
  "nove", "dieci", "undici", "dodici", "tredici", "quattordici", "quindici",
  "sedici", "diciassette", "diciotto", "diciannove",
];
const DECINE: Record<number, string> = {
  20: "venti", 30: "trenta", 40: "quaranta", 50: "cinquanta",
  60: "sessanta", 70: "settanta", 80: "ottanta", 90: "novanta",
};

/** 0-999 in parola (maschile). Elisione tipo ventuno, ventotto, centotto. */
function parolaNumero(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) return "";
  if (n < 20) return UNITA[n];
  if (n < 100) {
    const base = DECINE[Math.floor(n / 10) * 10];
    const r = n % 10;
    if (r === 0) return base;
    const radice = r === 1 || r === 8 ? base.slice(0, -1) : base;
    return radice + UNITA[r];
  }
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const base = c === 1 ? "cento" : UNITA[c] + "cento";
  if (resto === 0) return base;
  const rp = parolaNumero(resto);
  // «centouno» e «centuno» sono entrambi d'uso: forma elisa + variante.
  const radice = /^[aeiou]/.test(rp) ? base.slice(0, -1) : base;
  PAROLA_EXTRA.add("cento" + rp);
  return radice + rp;
}

const PAROLA_EXTRA = new Set<string>();
const PAROLA_A_NUMERO = new Map<string, number>();
for (let n = 0; n <= 999; n++) {
  const p = parolaNumero(n);
  if (!p) continue;
  PAROLA_A_NUMERO.set(p, n);
  if (p.endsWith("uno")) PAROLA_A_NUMERO.set(p.slice(0, -3) + "una", n); // ventuna…
}
for (const p of PAROLA_EXTRA) {
  const m = p.match(/^cento([a-zà-ù]+)$/);
  if (m) {
    const r = PAROLA_A_NUMERO.get(m[1]);
    if (r !== undefined && r < 100) PAROLA_A_NUMERO.set(p, 100 + r);
  }
}
PAROLA_A_NUMERO.delete("una"); // articolo indeterminativo: troppo ambiguo da solo

const DENOMINATORI: Record<string, number> = {
  mezzo: 2, mezzi: 2, meta: 2, "metà": 2,
  terzo: 3, terzi: 3, quarto: 4, quarti: 4, quinto: 5, quinti: 5,
  sesto: 6, sesti: 6, settimo: 7, settimi: 7, ottavo: 8, ottavi: 8,
  nono: 9, noni: 9, decimo: 10, decimi: 10,
  undicesimo: 11, undicesimi: 11, dodicesimo: 12, dodicesimi: 12,
  tredicesimo: 13, tredicesimi: 13, quattordicesimo: 14, quattordicesimi: 14,
  quindicesimo: 15, quindicesimi: 15, sedicesimo: 16, sedicesimi: 16,
  diciassettesimo: 17, diciassettesimi: 17, diciottesimo: 18, diciottesimi: 18,
  diciannovesimo: 19, diciannovesimi: 19, ventesimo: 20, ventesimi: 20,
};
const NOMI_DEN = Object.keys(DENOMINATORI).sort((a, b) => b.length - a.length).join("|");

const INDICI_RADICE: Record<string, number> = {
  quadrata: 2, cubica: 3, quarta: 4, quinta: 5,
};

/* Parole che introducono il RISULTATO (la clausola dopo si controlla). */
const CHIAVI = [
  "uguale a", "uguali a", "uguale", "pari a", "diventa", "diventano",
  "ottengo", "ottieni", "risultato", "totale", "scrivo", "scrivi",
  "rimane", "rimangono", "resta", "restano", "esce", "escono", "viene",
  "vengono", "vale", "ossia", "cioè", "cioe", "fanno", "sono", "dà",
  "fa", "è", "=", "→", "⇒",
].sort((a, b) => b.length - a.length);

const ARTICOLI = [
  "la", "il", "lo", "l", "un", "uno", "una", "i", "gli", "le",
  "di", "a", "da", "in", "del", "dello", "della", "dei", "degli",
  "al", "allo", "alla", "ai", "agli", "dal", "dallo", "dalla",
  "sul", "sullo", "sulla", "sui", "sugli", "nel", "nello", "nella",
];

/* Code che restano pendenti dopo un taglio («…e», «…di», «…la»). */
const CODE_FINALI = [
  "e", "ed", "o", "od", "ma", "che", "di", "a", "da", "in", "con", "su",
  "per", "tra", "fra", "il", "lo", "la", "l", "i", "gli", "le",
  "un", "uno", "una",
];

/* ─── Utilità ──────────────────────────────────────────────────────── */

function fugge(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* Confini di parola anche con gli accenti (\b di JS è solo ASCII: «è»,
   «cioè» non avrebbero mai i confini e le chiavi non scatterebbero). */
function chiaveRegex(): RegExp {
  const pezzi = CHIAVI.map((k) => {
    const sx = /^[a-zà-ù]/i.test(k) ? "(?<![a-zà-ù0-9_])" : "";
    const dx = /[a-zà-ù]$/i.test(k) ? "(?![a-zà-ù0-9_])" : "";
    return sx + fugge(k) + dx;
  });
  return new RegExp(`(${pezzi.join("|")})`, "i");
}
const RE_CHIAVE = chiaveRegex();

function quasiUguale(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
}

function numeriCifre(testo: string): number[] {
  const out: number[] = [];
  const re = /-?\d+(?:[.,]\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(testo))) out.push(parseFloat(m[0].replace(",", ".")));
  return out;
}

/** Normalizza per i confronti «tale e quale» (spazi, maiuscole, ·). */
function normalizzaToken(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").replace(/·/g, "*");
}

/** Forme normalizzate della risposta per il confronto verbatim. */
function variantiRisposta(answerLatex: string): string[] {
  const base = normalizzaToken(answerLatex);
  const senzaBarre = normalizzaToken(answerLatex.replace(/\\/g, ""));
  const conSimbolo = normalizzaToken(
    answerLatex.replace(/\\sqrt/g, "√").replace(/sqrt/g, "√").replace(/\{(\d+)\}/g, "$1"),
  );
  const senzaSimbolo = normalizzaToken(
    answerLatex.replace(/\\sqrt/g, "sqrt").replace(/√/g, "sqrt").replace(/\{(\d+)\}/g, "$1"),
  );
  return [...new Set([base, senzaBarre, conSimbolo, senzaSimbolo])].filter((v) => v.length >= 2);
}

/** Tutti i valori numerici «detti» da una clausola (cifre, parole, frazioni, TeX). */
function valoriDetti(clausola: string): number[] {
  const vals: number[] = numeriCifre(clausola);
  // frazioni in cifre: 3/4
  const reF = /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = reF.exec(clausola))) {
    const den = parseFloat(m[2].replace(",", "."));
    if (den !== 0) vals.push(parseFloat(m[1].replace(",", ".")) / den);
  }
  // parole-numero e frazioni a parole: tre, quarantacinque, tre quarti
  const parole = clausola.toLowerCase().match(/[a-zà-ù]+/g) ?? [];
  for (let i = 0; i < parole.length; i++) {
    const v = PAROLA_A_NUMERO.get(parole[i]);
    if (v !== undefined) {
      const den = DENOMINATORI[parole[i + 1] ?? ""];
      vals.push(den ? v / den : v);
    }
  }
  // radicali TeX o con simbolo: \sqrt[3]{8}, √6
  const reR = /(?:\\sqrt|√|sqrt)\s*(?:\[(\d+)\])?\s*\{?\s*\(?\s*(\d+(?:[.,]\d+)?)\s*\)?\s*\}?/gi;
  while ((m = reR.exec(clausola))) {
    const n = parseFloat(m[2].replace(",", "."));
    vals.push(Math.pow(n, 1 / (m[1] ? parseInt(m[1], 10) : 2)));
  }
  // TeX \frac{}{} \dfrac{}{}
  const reT = /\\d?frac\s*\{\s*(\d+(?:[.,]\d+)?)\s*\}\s*\{\s*(\d+(?:[.,]\d+)?)\s*\}/g;
  while ((m = reT.exec(clausola))) {
    const den = parseFloat(m[2].replace(",", "."));
    if (den !== 0) vals.push(parseFloat(m[1].replace(",", ".")) / den);
  }
  // «radice (quadrata/cubica/…) di N» detta a parole
  const reP = /radice(?:\s+(quadrata|cubica|quarta|quinta))?\s+di\s+([a-zà-ù]+|\d+(?:[.,]\d+)?)/gi;
  while ((m = reP.exec(clausola))) {
    const n = /^\d/.test(m[2]) ? parseFloat(m[2].replace(",", ".")) : PAROLA_A_NUMERO.get(m[2].toLowerCase());
    if (n !== undefined) vals.push(Math.pow(n, 1 / (m[1] ? INDICI_RADICE[m[1].toLowerCase()] : 2)));
  }
  return vals;
}

function sistemaFinale(t: string): string {
  let s = t.replace(/\s+/g, " ").trim();
  s = s.replace(/\s+([.,;:!?])/g, "$1");
  s = s.replace(/\(\s*\)/g, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  // code pendenti («…e», «…di», «…la»): il taglio ha portato via il seguito
  for (let i = 0; i < 3; i++) {
    const prima = s;
    s = s.replace(new RegExp(`\\s+(${CODE_FINALI.join("|")})$`, "i"), "").trim();
    if (s === prima) break;
  }
  s = s.replace(/[\s=→⇒:;,]+$/g, "").trim();
  if (!s) return FRASE_METODO_RISERVA;
  if (/[^.!?…]$/.test(s)) s += ".";
  return s;
}

/* ─── Funzione principale ──────────────────────────────────────────── */

export function ripulisciPrompt(prompt: string, opLatex: string, answerLatex: string): RipulituraPrompt {
  const grezzo = String(prompt ?? "").replace(/\s+/g, " ").trim();
  if (!grezzo) return { testo: "", ripulito: false, motivi: [] };
  if (!String(answerLatex ?? "").trim()) return { testo: grezzo, ripulito: false, motivi: [] };

  const opNumeri = numeriCifre(opLatex);
  const visibile = (n: number) => opNumeri.some((o) => quasiUguale(o, n));
  let valoreRisposta: number | null = null;
  /* (26/10, foto: «(3/4)·8 = 6» con risposta √6): il frammento dà il
     RADICANDO della risposta — si confronta anche con gli argomenti delle
     radici della risposta (6 per √6, 8 per ∛8, 3/4 per √(3/4)). */
  let argomentiRadicali: number[] = [];
  try {
    valoreRisposta = latexValue(answerLatex);
    const reArg = /(?:\\sqrt|√|sqrt)\s*(?:\[(\d+)\])?\s*\{?\s*\(?\s*(\d+(?:[.,]\d+)?)\s*\)?\s*\}?/gi;
    let ma: RegExpExecArray | null;
    while ((ma = reArg.exec(answerLatex))) {
      const n = parseFloat(ma[2].replace(",", "."));
      if (!isNaN(n)) argomentiRadicali.push(n);
    }
  } catch {
    valoreRisposta = null;
  }
  const varianti = variantiRisposta(answerLatex);
  const normOp = normalizzaToken(opLatex);
  const motivi: string[] = [];
  let t = grezzo;
  let cambiato = false;

  const nota = (m: string) => {
    if (motivi.length < 2) motivi.push(m);
  };

  /** La clausola contiene la risposta? */
  const rivela = (clausola: string): string | null => {
    const nc = normalizzaToken(clausola);
    for (const v of varianti) {
      if (nc.includes(v)) return `contiene «${v}»`;
    }
    if (valoreRisposta != null && Number.isFinite(valoreRisposta)) {
      if (
        valoriDetti(clausola).some(
          (v) =>
            quasiUguale(v, valoreRisposta as number) ||
            argomentiRadicali.some((g) => quasiUguale(v, g)),
        )
      ) {
        return "contiene il valore del risultato";
      }
    }
    return null;
  };

  for (let pass = 0; pass < 8; pass++) {
    let mosso = false;

    // 1. Clausole dopo le parole-risultato («= …», «fa …», «ossia …»).
    const trovo = RE_CHIAVE.exec(t);
    if (trovo && trovo.index !== undefined) {
      const dopo = t.slice(trovo.index + trovo[0].length);
      const fine = dopo.search(/[.;!?…]/);
      const clausola = fine < 0 ? dopo : dopo.slice(0, fine);
      const perche = rivela(clausola);
      if (perche !== null) {
        nota(`la frase ${perche} dopo «${trovo[0]}»`);
        t = (t.slice(0, trovo.index) + (fine < 0 ? "" : dopo.slice(fine + 1))).replace(/\s+/g, " ").trim();
        mosso = true;
        cambiato = true;
        continue;
      }
    }

    // 2. «radice (quadrata/cubica/…) di N» detta ovunque: si taglia solo se
    // N non è nei dati (è un derivato). «Radice di 9» con √9 nel box resta.
    const reRad = /radice(?:\s+(quadrata|cubica|quarta|quinta))?\s+di\s+([a-zà-ù]+|\d+(?:[.,]\d+)?)/i;
    const mr = reRad.exec(t);
    if (mr && mr.index !== undefined) {
      const n = /^\d/.test(mr[2]) ? parseFloat(mr[2].replace(",", ".")) : PAROLA_A_NUMERO.get(mr[2].toLowerCase());
      if (n !== undefined && !visibile(n)) {
        nota(`dice una radice di ${mr[2]} che non è nei dati`);
        // si allarga all'articolo prima («Estraggo LA radice…» → «Estraggo.»)
        let inizio = mr.index;
        const prima = t.slice(0, inizio);
        const art = prima.match(new RegExp(`\\b(${ARTICOLI.join("|")})\\s+$`, "i"));
        if (art && art.index !== undefined) inizio = art.index;
        t = (t.slice(0, inizio) + t.slice(mr.index + mr[0].length)).replace(/\s+/g, " ").trim();
        mosso = true;
        cambiato = true;
        continue;
      }
    }

    // 3. Frazioni a parole («tre quarti», «un mezzo»): solo se i numeri non
    // sono nei dati. Quelle visibili restano: lo studente calcola da solo.
    const reFraz = new RegExp(`(?<![a-zà-ù0-9_])([a-zà-ù]+|\\d+(?:[.,]\\d+)?)\\s+(${NOMI_DEN})\\b`, "i");
    const mf = reFraz.exec(t);
    if (mf && mf.index !== undefined) {
      const num = /^\d/.test(mf[1]) ? parseFloat(mf[1].replace(",", ".")) : PAROLA_A_NUMERO.get(mf[1].toLowerCase());
      const den = DENOMINATORI[mf[2].toLowerCase()];
      if (num !== undefined && den && !(visibile(num) && visibile(den))) {
        nota("dice una frazione con numeri non nei dati");
        let inizio = mf.index;
        const prima = t.slice(0, inizio);
        const art = prima.match(new RegExp(`\\b(${ARTICOLI.join("|")})\\s+$`, "i"));
        if (art && art.index !== undefined) inizio = art.index;
        t = (t.slice(0, inizio) + t.slice(mf.index + mf[0].length)).replace(/\s+/g, " ").trim();
        mosso = true;
        cambiato = true;
        continue;
      }
    }

    // 4. Simboli TeX isolati che valgono la risposta (√6, \frac{3}{4}).
    const reTex = /(?:\\d?frac\s*\{\s*\d+(?:[.,]\d+)?\s*\}\s*\{\s*\d+(?:[.,]\d+)?\s*\}|(?:\\sqrt|√|sqrt)\s*(?:\[\d+\])?\s*\{?\s*\(?\s*\d+(?:[.,]\d+)?\s*\)?\s*\}?)/;
    const mt = reTex.exec(t);
    if (mt && mt.index !== undefined) {
      const v = valoriDetti(mt[0])[0];
      const nums = numeriCifre(mt[0]);
      const eRisposta =
        (v !== undefined && valoreRisposta != null && Number.isFinite(valoreRisposta) && quasiUguale(v, valoreRisposta)) ||
        varianti.some((a) => normalizzaToken(mt[0]).includes(a) && !normOp.includes(a));
      if (eRisposta || (nums.length > 0 && nums.some((n) => !visibile(n)))) {
        nota("mostra il risultato in simboli");
        t = (t.slice(0, mt.index) + t.slice(mt.index + mt[0].length)).replace(/\s+/g, " ").trim();
        mosso = true;
        cambiato = true;
        continue;
      }
    }

    // 5. Risposta con LETTERE scritta tale e quale (es. «5x»), se non è nell'op.
    if (/[a-z]/i.test(answerLatex.replace(/\\[a-zA-Z]+/g, ""))) {
      for (const v of varianti) {
        if (v.length < 2 || normOp.includes(v)) continue;
        if (new RegExp(fugge(v), "gi").test(nc_sicuro(t))) {
          nota(`ripete la risposta «${v}»`);
          const reOrig = new RegExp(v.split("").map((c) => `${fugge(c)}\\s*`).join(""), "gi");
          t = t.replace(reOrig, "").replace(/\s+/g, " ").trim();
          mosso = true;
          cambiato = true;
          break;
        }
      }
      if (mosso) continue;
    }

    // 6. Frammenti di calcolo in cifre che DANNO la risposta con numeri
    // derivati («3·2» con risposta 6, «10/12» con risposta 5/6,
    // «(3/4)·8 = 6» con risposta √6 — il caso della foto utente). Se tutti i
    // numeri sono visibili («2+3» nel box «2+3») resta: è solo il metodo.
    // Protetto mcm(…): la notazione del metodo resta sempre.
    if (valoreRisposta != null && Number.isFinite(valoreRisposta)) {
      const protette: Array<[number, number]> = [];
      const reMcm = /mcm\s*\([^)]*\)/gi;
      let mm: RegExpExecArray | null;
      while ((mm = reMcm.exec(t))) protette.push([mm.index, mm.index + mm[0].length]);
      const dentroMcm = (a: number, b: number) => protette.some(([x, y]) => a >= x && b <= y);
      const reCalc = /(\(?\s*\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?\s*\)?)\s*([·*×:+\-/])\s*(\(?\s*\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?\s*\)?)/g;
      const valoreFrammento = (fr: string): { v: number | null; nums: number[] } => {
        const nums = numeriCifre(fr);
        const parti = fr.split("/");
        if (parti.length === 2) {
          const a = numeriCifre(parti[0]);
          const b = numeriCifre(parti[1]);
          const an = a.length ? a[a.length - 1] : NaN;
          const bn = b.length ? b[0] : NaN;
          return { v: bn !== 0 && !isNaN(an) && !isNaN(bn) ? an / bn : null, nums };
        }
        return { v: nums.length ? nums[nums.length - 1] : null, nums };
      };
      let mc: RegExpExecArray | null;
      let tolto: [number, number] | null = null;
      while ((mc = reCalc.exec(t))) {
        const fa = valoreFrammento(mc[1]);
        const fb = valoreFrammento(mc[3]);
        if (fa.v === null || fb.v === null) continue;
        const a = fa.v;
        const b = fb.v;
        let v: number | null = null;
        if (mc[2] === ":" || mc[2] === "/") v = b !== 0 ? a / b : null;
        else if (mc[2] === "+") v = a + b;
        else if (mc[2] === "-") v = a - b;
        else v = a * b;
        const nums = [...fa.nums, ...fb.nums];
        const daRisposta =
          v !== null &&
          valoreRisposta !== null &&
          (quasiUguale(v, valoreRisposta as number) ||
            argomentiRadicali.some((g) => quasiUguale(v, g)));
        if (
          daRisposta &&
          (nums.length === 0 || nums.some((n) => !visibile(n))) &&
          !dentroMcm(mc.index, mc.index + mc[0].length)
        ) {
          tolto = [mc.index, mc.index + mc[0].length];
          break;
        }
      }
      if (tolto) {
        nota("anticipa il calcolo del risultato");
        t = (t.slice(0, tolto[0]) + t.slice(tolto[1])).replace(/\s+/g, " ").trim();
        mosso = true;
        cambiato = true;
        continue;
      }
    }

    if (!mosso) break;
  }

  return { testo: sistemaFinale(t), ripulito: cambiato, motivi };
}

/** Normalizzazione sicura per i test verbatim (minuscole, senza spazi). */
function nc_sicuro(s: string): string {
  return normalizzaToken(s);
}
