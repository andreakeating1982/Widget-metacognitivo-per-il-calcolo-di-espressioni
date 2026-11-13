import { crossesOther, piercedByOther, strokesIntersect, touchesOther } from "./inkContext";
// ─── Riscrittura geometrica dei segni puntinati (riconoscimento a mano) ──
//
// Il modello di riconoscimento (CoMER/ONNX) NON ha il token ":" nel
// vocabolario: i due puntini verticali della divisione ( : ) e il segno ÷
// (puntino–lineetta–puntino) vengono letti male o ignorati. Anche il
// puntino alto ( · ) della moltiplicazione arriva spesso come ".".
//
// Soluzione: PRIMA di passare i tratti al modello, riscriviamo l'inchiostro
// a livello geometrico:
//   • due puntini impilati verticalmente ( : )   → una barra  /
//   • puntino + lineetta + puntino ( ÷ )         → una barra  /
// Il modello riconosce bene la barra "/" e `repairDivisionSigns` la converte
// in ":" — così la posizione del segno nel testo resta quella giusta.
// I puntini isolati ( · disegnato ) vengono invece TOLTI dall'inchiostro
// e «\cdot» viene REINSERITO nel LaTeX alla posizione proporzionale
// (ancora, stessa tecnica di quadre/√/8/=/meno): il modello non vede
// nulla al posto del puntino, quindi non può più trascriverlo come
// lettera «x» (segnalazione 5/10: «la moltiplicazione a puntino viene
// trascritta come una piccola X»).

export interface SimpleStroke {
  points: { x: number; y: number }[];
  lineWidth?: number;
}

export interface DotSignRewrite {
  strokes: SimpleStroke[];
  /** Coppie di puntini impilati ( : ) convertite in barra */
  colons: number;
  /** Segni ÷ completi (puntino, lineetta, puntino) convertiti in barra */
  divSigns: number;
  /** Puntini rimasti isolati (· disegnato, rumore) NON accoppiati */
  loneDots: number;
  /** Centri x (coordinate canvas) dei puntini isolati TOLTI
   *  dall'inchiostro: «\cdot» viene reinserito nel LaTeX alla posizione
   *  proporzionale (ancora) — il modello non li vede mai. */
  dots: { cx: number }[];
  /** Centri x dei segni di DIVISIONE (due punti « : » e ÷) TOLTI dall'inchiostro: «:» viene
   *  reinserito nel LaTeX per POSIZIONE (composeLatex), senza barra sintetica per il modello. */
  divCenters: number[];
}

/** 5/10 notte: il due-punti NON diventa più una barra «/» per il modello (che la leggeva «.», `\\cdot`,
 *  `\\beta`… quando restava un vuoto largo, es. togliendo l'8 di «18:3»); i due puntini vengono
 *  TOLTI e «:» è reinserito alla loro x, come puntini/meno/uguali. `false` = comportamento storico
 *  (barra sintetica), sovrascrivibile dal banco con `globalThis.__COLON_AS_ITEM` per l'A/B. */
export const COLON_AS_ITEM = true;
function colonAsItem(): boolean {
  return (globalThis as { __COLON_AS_ITEM?: boolean }).__COLON_AS_ITEM ?? COLON_AS_ITEM;
}

// Soglie in px (canvas ~150–170 px di altezza, cifra ~60 px)
const DOT_MAX = 15; // larghezza/altezza massima di un puntino
const SMALL_MAX = 34; // larghezza/altezza massima di un piccolo segno:
// i puntini «marcati» (più grandi del normale) devono poter formare un
// « : » (segnalazione 26/9: «] : [» non riconosciuto perché i punti
// disegnati grandi restavano fuori dall'accoppiamento;
// 27/9-octies: da 24 a 34 px — i due punti disegnati con DECISO sfuggivano
// all'accoppiamento e diventavano due croci «×» di moltiplicazione)
// (6/10) SOGLIA RELATIVA: SMALL_MAX (34 px) è tarata su cifre alte ~60 px, ma con la scrittura PICCOLA
// (canvas ~476×136: cifre di 33–45 px) una cifra a tratto singolo (un «3» di 16×33 px) rientra fra i
// «piccoli segni»: scambiata per puntino isolato veniva TOLTA dall'inchiostro e al suo posto tornava
// «\cdot» (`(-3)` → `(-\cdot)`, `[2][3]` → `[2][\cdot]`, `{2+1}3` → `{2+1}\cdot`: 3 su 3 casi sistematici
// del banco a H=38 con pixel interi), e due cifre impilate (3 sopra 4) potevano passare per « : ».
// Un puntino è SEMPRE molto più piccolo del tratto più alto della riga (le cifre, le parentesi): i
// puntini «marcati» arrivano a ~0,5 dell'altezza delle cifre (27/9-octies: 34 px su cifre di ~65 px).
// Il limite effettivo è quindi min(SMALL_MAX, SMALL_REL × tratto più alto), mai sotto DOT_MAX.
const SMALL_REL = 0.55;
const GUARD_TOL = 4; // tolleranza (px) per la guardia di ingombro
const GAP_MIN = 3; // distanza verticale minima tra i due puntini di ":"
const GAP_MAX = 85; // distanza verticale massima tra i due puntini di ":"
//   (27/9-octies: da 55 a 85 px — un « : » scritto GRANDE, che occupa quasi
//   tutta l'altezza delle cifre vicine, non veniva accoppiato)
const ALIGN_MAX = 26; // allineamento orizzontale massimo tra i due puntini
//   (27/9-octies: da 18 a 26 px — un « : » scritto leggermente storto)
const LINE_MIN_W = 12; // lineetta del ÷: larghezza minima
const LINE_MAX_W = 95; // lineetta del ÷: larghezza massima (una minus è più lunga)
const LINE_MAX_H = 10; // lineetta del ÷: spessore massimo
const DOT_LINE_GAP = 46; // distanza massima puntino–lineetta nel ÷
const SLASH_HALF_W = 18; // mezza larghezza della barra sintetica
const SLASH_HALF_H = 30; // mezza altezza della barra sintetica (~60 px)

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function bbox(s: SimpleStroke): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of s.points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/** Barra piatta orizzontale (uguale piccolo, meno, lineetta): non è mai
 *  un puntino di « : » né un puntino isolato «·». Un puntino vero è tondo
 *  (larghezza ≈ altezza); una barra è larga > 2× la sua altezza. */
function isFlatBar(w: number, h: number): boolean {
  return w >= 14 && w > 2 * h;
}

function slashStroke(cx: number, cy: number, lineWidth: number): SimpleStroke {
  // Barra "/" inclinata come da suggerimento a video (in basso a sx,
  // in alto a dx), alta quanto una cifra (~60 px). ⚠️ PIENA DI PUNTI:
  // con soli 2 punti totali isStrokeMeaningful (MIN_TOTAL_POINTS = 6)
  // scarterebbe un pezzo composto SOLO da «:» o «÷» (segnalazione 27/9).
  const pts = [];
  for (let k = 0; k <= 12; k++) {
    pts.push({
      x: cx - SLASH_HALF_W + (2 * SLASH_HALF_W * k) / 12,
      y: cy + SLASH_HALF_H - (2 * SLASH_HALF_H * k) / 12,
    });
  }
  return { points: pts, lineWidth };
}

/** Statistiche dei tratti ALTI (cifre/lettere) per validare le coppie
 *  di puntini: i due puntini di un vero " : " stanno DENTRO l'altezza
 *  delle cifre vicine, mentre un apice (³) o un rumore stanno SOPRA. */
function tallStats(
  boxes: Box[],
  isDot: boolean[],
): { top: number; medH: number; medCy: number } {
  const hs: number[] = [];
  const cys: number[] = [];
  let top = Infinity;
  for (let i = 0; i < boxes.length; i++) {
    if (isDot[i]) continue;
    const h = boxes[i]!.y1 - boxes[i]!.y0;
    if (h < 20) continue;
    hs.push(h);
    cys.push((boxes[i]!.y0 + boxes[i]!.y1) / 2);
    top = Math.min(top, boxes[i]!.y0);
  }
  if (hs.length === 0) return { top: -Infinity, medH: 0, medCy: 0 };
  hs.sort((a, b) => a - b);
  cys.sort((a, b) => a - b);
  const mid = Math.floor(hs.length / 2);
  const medH = hs.length % 2 === 1 ? hs[mid]! : (hs[mid - 1]! + hs[mid]!) / 2;
  const midC = Math.floor(cys.length / 2);
  const medCy =
    cys.length % 2 === 1 ? cys[midC]! : (cys[midC - 1]! + cys[midC]!) / 2;
  return { top, medH, medCy };
}

/** Riscrive l'inchiostro: i segni puntinati (: e ÷) diventano barre "/"
 *  che il modello riconosce correttamente. I puntini isolati restano. */
export function rewriteDotSigns(strokes: SimpleStroke[]): DotSignRewrite {
  if (strokes.length === 0)
    return { strokes, colons: 0, divSigns: 0, loneDots: 0, dots: [], divCenters: [] };

  const boxes = strokes.map(bbox);
  const cx = boxes.map((b) => (b.x0 + b.x1) / 2);
  const cy = boxes.map((b) => (b.y0 + b.y1) / 2);
  const w = boxes.map((b) => b.x1 - b.x0);
  const h = boxes.map((b) => b.y1 - b.y0);
  // ⚠️ CONTATTO (6/10): un tratto piccolo che TOCCA un altro tratto è parte di
  // un glifo (anello del «9», braccio della «x», tick di una quadra, barra del
  // «+»): mai un puntino. Il banco di prova mostrava ~560 cifre/lettere/parentesi
  // mangiate dallo stadio puntini su 4000 campioni.
  // (un TOCCO di penna ≤ 9 px è un puntino vero anche se sfiora una cifra: scrittura stretta)
  const touchRaw = touchesOther(strokes);
  // ⚠️ INCROCIO (5/10 sera): le due diagonali di una «x» piccola si ATTRAVERSANO
  // senza giunzione d'estremità → touchesOther non le vedeva e ciascuna passava per
  // «puntino isolato». Contatto = giunzione OPPURE incrocio.
  const crossRaw = crossesOther(strokes);
  // ⚠️ TRAFITTO (5/10 notte): un altro tratto passa nel MEZZO del riquadro (la gamba del «4» che
  // attraversa la «L» all'85% della sua lunghezza: né giunzione né incrocio «interno a entrambi»).
  const pierceRaw = piercedByOther(strokes);
  const contact = touchRaw.map(
    (c, i) => (c || crossRaw[i]! || pierceRaw[i]!) && Math.max(w[i]!, h[i]!) > 9,
  );
  const isDot = boxes.map((_, i) => w[i] <= DOT_MAX && h[i] <= DOT_MAX && !contact[i]);
  // piccoli segni: puntini anche «marcati» — candidati all'accoppiamento.
  // ⚠️ MAI una BARRA PIATTA (segnalazione 27/9): le due barrette di un
  // uguale piccolo (larghezza ~14–24 px) rientravano in SMALL_MAX e
  // venivano accoppiate come « : » PRIMA che rewriteEqualSigns potesse
  // vederle → l'«=» disegnato diventava una divisione. Un puntino vero è
  // tondo; una barra è larga almeno il doppio della sua altezza.
  // Tratto più alto della riga (solo tratti ≥ 20 px: sotto sono tutti puntini/trattini): riferimento
  // della soglia relativa. Senza tratti alti resta la soglia assoluta storica.
  const maxTallH = h.reduce((m, x) => (x >= 20 && x > m ? x : m), 0);
  const smallMax = maxTallH > 0 ? Math.min(SMALL_MAX, Math.max(DOT_MAX, SMALL_REL * maxTallH)) : SMALL_MAX;
  const isSmall = boxes.map(
    (_, i) => w[i] <= smallMax && h[i] <= smallMax && !isFlatBar(w[i]!, h[i]!) && !contact[i],
  );

  const removed = new Set<number>();
  const slashes: SimpleStroke[] = [];
  const divCenters: number[] = [];
  const asItem = colonAsItem();
  /** un segno di divisione trovato in (x, y): barra sintetica (storico) o item di posizione */
  const emitDivision = (x: number, y: number, lineWidth: number) => {
    if (asItem) divCenters.push(x);
    else slashes.push(slashStroke(x, y, lineWidth));
  };
  let colons = 0;
  let divSigns = 0;

  // Statistiche dei tratti alti (guardianie contro le coppie FALSIE:
  // segnalazione 26/9 — il puntino di «2·2³» poteva accoppiarsi con un
  // tratto piccolo vicino e generare un ":" inesistente).
  const { top: tallTop, medH: tallMedH, medCy: tallMedCy } = tallStats(boxes, isDot);
  // y minima perché un puntino possa far parte di un « : »: un apice sta
  // molto più in alto di un qualunque punto di un « : » vero.
  const colonMinY = tallTop + 0.28 * tallMedH;

  // 1) Coppie di piccoli segni impilati verticalmente → ":" (barra sintetica)
  for (let i = 0; i < strokes.length; i++) {
    if (removed.has(i) || !isSmall[i]) continue;
    for (let j = i + 1; j < strokes.length; j++) {
      if (removed.has(j) || !isSmall[j]) continue;
      const dx = Math.abs(cx[i] - cx[j]);
      const dy = Math.abs(cy[i] - cy[j]);
      if (dx <= ALIGN_MAX && dy >= GAP_MIN && dy <= GAP_MAX) {
        // i due puntini di un « : » non si toccano né si incrociano mai (le due
        // diagonali di una «x» sì: 72 «x» mangiate come due punti sul banco)
        if (strokesIntersect(strokes[i]!, strokes[j]!)) continue;
        // GUARDIA 1 (altezza): entrambi i puntini devono stare nella zona
        // bassa delle cifre, dove vive un « : » vero. Un apice o un rumore
        // in alto non forma mai un due punti.
        // ⚠️ 6/10 (banco P7: `18:3` letto `18^{15}\cdot3`): un « : » scritto ALTO (punto in alto al ~23%
        // dell'altezza delle cifre) veniva scartato e il punto alto diventava un apice. Se la coppia è
        // CENTRATA sulle cifre (centro della coppia = centro delle cifre ±10% h) il punto alto può
        // arrivare al 15%: una coppia apice + punto di «2·2³» ha il centro molto più in alto.
        const pairCy = (cy[i]! + cy[j]!) / 2;
        const centered = tallMedH > 0 && Math.abs(pairCy - tallMedCy) <= 0.1 * tallMedH;
        const minY = centered ? tallTop + 0.15 * tallMedH : colonMinY;
        if (tallMedH > 0 && (cy[i]! < minY || cy[j]! < minY)) continue;
        // GUARDIA 2 (ingombro): un tratto alto non può ATTRAVERSARE
        // l'intervallo tra i CENTRI dei due puntini (se in mezzo c'è una
        // cifra, l'accoppio è falso, tipo «·» + tratto di un apice).
        // I caratteri ai FIANCHI della coppia (le quadre di «] : [», che
        // stanno interamente a sinistra o a destra dei punti) NON devono
        // bloccare: segnalazione 26/9, con le guardie precedenti bastava
        // che l'ingombro di una quadra sfiorasse i punti per perdere il
        // « : » centrale (riconosciuto «] \cdot [»).
        const xMin = Math.min(cx[i]!, cx[j]!);
        const xMax = Math.max(cx[i]!, cx[j]!);
        const yMin = Math.min(cy[i]!, cy[j]!);
        const yMax = Math.max(cy[i]!, cy[j]!);
        let blocked = false;
        for (let k = 0; k < strokes.length; k++) {
          if (k === i || k === j || removed.has(k) || isSmall[k]) continue;
          const hK = boxes[k]!.y1 - boxes[k]!.y0;
          if (hK < 0.5 * tallMedH) continue;
          if (
            boxes[k]!.x1 >= xMin + GUARD_TOL && boxes[k]!.x0 <= xMax - GUARD_TOL &&
            boxes[k]!.y1 >= yMin && boxes[k]!.y0 <= yMax
          ) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        // GUARDIA 3 (apice sospeso): il segno SUPERIORE della coppia non
        // deve librarsi SOPRA un tratto alto con il CENTRO dentro il suo
        // ingombro: quello è un apice (², ³) accanto al suo numero, non
        // il punto alto di un « : » vero — che sta nello spazio TRA due
        // caratteri. (Nella prima versione bastava che gli ingombri si
        // toccassero: un « : » scritto stretto fra le quadre di «] : [»
        // veniva scartato e il modello leggeva «V».)
        const upper = cy[i]! <= cy[j]! ? i : j;
        let suspended = false;
        for (let k = 0; k < strokes.length; k++) {
          if (k === i || k === j || removed.has(k) || isSmall[k]) continue;
          const hK = boxes[k]!.y1 - boxes[k]!.y0;
          if (hK < 0.5 * tallMedH) continue;
          if (
            cy[k]! > cy[upper]! &&
            cx[upper]! > boxes[k]!.x0 + 2 && cx[upper]! < boxes[k]!.x1 - 2
          ) {
            suspended = true;
            break;
          }
        }
        if (suspended) continue;
        removed.add(i);
        removed.add(j);
        emitDivision((cx[i]! + cx[j]!) / 2, (cy[i]! + cy[j]!) / 2, strokes[i]!.lineWidth ?? 2);
        colons++;
        break;
      }
    }
  }

  // 2) Segno ÷ completo: lineetta orizzontale con un puntino sopra e uno sotto
  for (let i = 0; i < strokes.length; i++) {
    if (removed.has(i) || isDot[i]) continue;
    // lineetta: orizzontale e corta (una "minus" di sottrazione è più lunga)
    if (h[i] > LINE_MAX_H || w[i] < LINE_MIN_W || w[i] > LINE_MAX_W) continue;
    let above = -1;
    let below = -1;
    for (let k = 0; k < strokes.length; k++) {
      if (removed.has(k) || !isSmall[k] || k === i) continue;
      if (Math.abs(cx[k] - cx[i]) > w[i] / 2 + 14) continue;
      const gap = cy[i] - cy[k];
      if (gap >= DOT_MAX && gap <= DOT_LINE_GAP) above = k; // puntino sopra
      if (-gap >= DOT_MAX && -gap <= DOT_LINE_GAP) below = k; // puntino sotto
    }
    if (above !== -1 && below !== -1) {
      removed.add(i);
      removed.add(above);
      removed.add(below);
      emitDivision(cx[i]!, cy[i]!, strokes[i]!.lineWidth ?? 2);
      divSigns++;
    }
  }

  const keptIdx = strokes.map((_, i) => i).filter((i) => !removed.has(i));
  // Puntini isolati: piccoli segni TONDI (rapporto lati ≤ 3: un trattino
  // piatto tipo «-» non è mai un puntino!) rimasti NON accoppiati nella
  // zona di riga (cy ≥ tallTop + 0.32×altezza mediana). Gli apici (in
  // alto) NON contano: non sono mai segni di moltiplicazione.
  const isLone: boolean[] = [];
  const dots: { cx: number }[] = [];
  for (const i of keptIdx) {
    const b = boxes[i]!;
    if (contact[i]) {
      isLone.push(false);
      continue;
    }
    const w0 = b.x1 - b.x0;
    const h0 = b.y1 - b.y0;
    const roundish =
      Math.max(w0, h0) <= smallMax &&
      Math.max(w0, h0) / Math.max(1, Math.min(w0, h0)) <= 3 &&
      !isFlatBar(w0, h0);
    // ⚠️ SECONDA guardia anti-apice (27/9-decies, pezzo 2 reale): con le
    // parentesi (alte ~100 px) la soglia 0.32×medH sale così tanto che un
    // apice vero (² a cy = 33) la sfalda per meno di 1 px e veniva mangiato
    // come «puntino isolato» e SOSTITUITO dalla croce × sintetica (DUE
    // tratti con lo stesso bbox!) → il gruppo apice aveva 2 tratti e il
    // modello number leggeva «22» → (2²²)². Regola robusta: un glifo
    // piccolo interamente SOPRA il centro verticale dei tratti alti
    // (b.y1 < medCy) non è mai un puntino di moltiplicazione: il puntino
    // vero si scrive a metà altezza della riga.
    const ok =
      roundish &&
      !(tallMedH > 0 && (b.y0 + b.y1) / 2 < tallTop + 0.32 * tallMedH) &&
      // (6/10) apice = ben SOPRA il centro della riga (≥ 0,18 altezze); un puntino
      // scritto esattamente a metà altezza non è un apice (prima: b.y1 < medCy
      // scartava a caso la metà dei puntini centrati)
      !(tallMedCy > 0 && (b.y0 + b.y1) / 2 < tallMedCy - 0.18 * tallMedH);
    isLone.push(ok);
    if (ok) dots.push({ cx: (b.x0 + b.x1) / 2 });
  }
  // Il puntino è quasi INVISIBILE al modello (rasterizzazione TARGET_H=128
  // px: sub-pixel, «3·3³»→«33»). Le due soluzioni precedenti fallivano:
  // INGRANDIRLO come pallone tondo → letto come LETTERA (o, s → «cos»!
  // segnalazione 26/9); SOSTITUIRLO con una piccola croce «×» sintetica →
  // la croce piccola viene letta come la LETTERA «x» e la trascrizione
  // mostrava una «piccola X» al posto del puntino (segnalazione 5/10).
  // Soluzione definitiva (stessa tecnica di quadre/√/8/=/meno): il puntino
  // viene TOLTO dall'inchiostro e «\cdot» viene REINSERITO nel LaTeX alla
  // posizione proporzionale (ancora, dots[].cx) — il modello non vede
  // nulla al posto del puntino, quindi non può più sbagliare.
  const outStrokes = keptIdx
    .filter((_, ki) => !isLone[ki])
    .map((orig) => strokes[orig]!);

  if (slashes.length === 0)
    return { strokes: outStrokes, colons, divSigns, loneDots: dots.length, dots, divCenters };

  return {
    strokes: [...outStrokes, ...slashes],
    colons,
    divSigns,
    loneDots: dots.length,
    dots,
    divCenters,
  };
}

// ─── Soccorso del puntino isolato ( · disegnato → moltiplicazione) ──
//
// Il modello a volte legge il puntino alto « · » come una barra «/» (o
// come \div): repairDivisionSigns lo convertirebbe in ":" — esatto per
// un « : » vero, SBAGLIATO per il puntino di moltiplicazione (segnalazione
// 26/9: «2·2³» riconosciuto come «2 : 2³»). Qui l'inchiostro fa da verità:
// se NELL'INCHIOSTRO non c'è nessuna coppia puntini (: o ÷ sintetizzata)
// ma c'è UN solo puntino isolato, e nel testo compare UN solo segno di
// divisione, quel segno È il puntino → moltiplicazione.

export function rescueLoneDotSign(
  latex: string,
  info: { colons: number; divSigns: number; loneDots: number },
): string {
  if (info.colons !== 0 || info.divSigns !== 0 || info.loneDots !== 1) return latex;
  // il modello può leggere il puntino anche come \div → normalizzato in "/"
  const text = latex.replace(/\\div/g, "/");
  const signs = text.match(/[:/=]/g) ?? [];
  if (signs.length !== 1) return latex;
  // un solo segno di divisione nel testo + un solo puntino disegnato:
  // quel segno è il puntino letto male → moltiplicazione
  return text.replace(
    /([0-9a-zA-Z\)\}\]])\s*[:\/=]\s*([0-9a-zA-Z\(\[\{])/, 
    "$1 \\cdot $2",
  );
}
