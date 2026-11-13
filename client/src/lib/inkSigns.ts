import { lineCenter, touchesOther } from "./inkContext";
// ─── Riscrittura geometrica dell'UGUALE «=» e della RADICE «√» (a mano) ──
//
// Stesso approccio di `dotSigns.ts` (segni puntinati) e `supScript.ts`
// (esponenti): PRIMA di passare i tratti al modello (CoMER/ONNX) si
// analizza l'inchiostro a livello geometrico e si riscrivono i simboli
// che il modello legge sistematicamente male. Verificato nel browser
// (ricognizione 26/9, richieste esplicite dell'utente):
//
//   • «3=5» disegnato → il modello legge «3:5» (le due barre impilate
//     vengono scambiate per due punti) → riscrittura: le due barre
//     diventano un UGUALE SINTETICO pulito, di dimensioni canoniche;
//   • «8» disegnato (anello doppio chiuso, con o senza autointersezione)
//     → il modello legge «3B», «Z», «s»… → firma geometrica dell'8
//     (tratto CHIUSO con UN incrocio al centro, o due anelli impilati):
//     l'8 viene TOLTO dall'inchiostro e «8» reinserito nel LaTeX alla
//     posizione proporzionale (come \sqrt); vedi rewriteEights.
//   • «√9» disegnato (v + barra + radicando) → il modello legge
//     «\sigma» (tutto fuso in un unico simbolo greco) → riscrittura:
//     la BARRA ORIZZONTALE (vinculum) viene TOLTA dall'inchiostro, sia
//     che sia un tratto a sé sia che sia la coda orizzontale dello
//     stesso tratto a V. Resta la V + il radicando: il modello legge
//     «V9» e `normalizeInput` converte già V/v+carattere in √.
//     In più la pagina ripara il LaTeX: V/v prima di cifra/parentesi →
//     \sqrt (così anche il DISPLAY mostra √ e non V).

export interface SimpleStroke {
  points: { x: number; y: number }[];
  lineWidth?: number;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function bboxOf(strokes: SimpleStroke[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of strokes) {
    for (const p of s.points) {
      if (p.x < x0) x0 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.x > x1) x1 = p.x;
      if (p.y > y1) y1 = p.y;
    }
  }
  return { x0, y0, x1, y1 };
}

// ─── UGUALE «=» ──────────────────────────────────────────────────
// Due tratti ORIZZONTALI impilati, centri allineati, larghezze simili.
const EQ_H_MAX = 14; // spessore massimo di una barra piatta
const EQ_W_MIN = 14; // larghezza minima di una barra
// (segnalazione 27/9: «=» ancora letto «:» in alcuni casi — allineamento
// e distanza tra le barre allargati per coprire la scrittura reale)
const EQ_CX_ALIGN = 24; // allineamento orizzontale massimo dei centri
const EQ_GAP_MIN = 4; // distanza verticale minima tra le barre
const EQ_GAP_MAX = 44; // distanza verticale massima tra le barre
const EQ_W_RATIO = 0.5; // larghezze simili (min/max ≥ 0.5)
const EQ_TILT_H = 32; // spessore bbox massimo di una barra inclinata
const EQ_TILT_RES = 6; // residuo massimo dalla retta di fit (barra curva)
const EQ1_MIN_W = 20; // larghezza minima dell'uguale in un solo tratto
const EQ1_MAX_H = 36; // altezza massima dell'uguale in un solo tratto

export interface EqRewrite {
  strokes: SimpleStroke[];
  /** Uguali rilevati e rimossi dall'inchiostro */
  equals: number;
  /** Frazione orizzontale (0..1) di ogni uguale rispetto all'inchiostro
   *  RESTANTE: serve a reinserire «=» nel LaTeX alla posizione proporzionale
   *  (stessa tecnica di \sqrt e degli 8). */
  anchors: number[];
  /** x ASSOLUTE (centro del glifo, stesso sistema dell'inchiostro) dei segni
   *  rimossi, nello stesso ordine di `anchors`: servono a reinserirli per
   *  POSIZIONE (composeLatex.ts) invece che per frazione dell'inchiostro rimasto. */
  centers: number[];
}

/** Massima deviazione dei punti dalla RETTA di fit (minimi quadrati).
 *  Serve a distinguere una barra inclinata/curva (residuo basso) da un
 *  glifo vero con più tratti di penna (residuo alto). */
function lineResidual(s: SimpleStroke): number {
  const pts = s.points;
  if (pts.length < 3) return 0;
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const d = n * sxx - sx * sx;
  if (Math.abs(d) < 1e-6) {
    // tratto quasi verticale: fit x = costante
    return Math.max(...pts.map((p) => Math.abs(p.x - sx / n)));
  }
  const b = (n * sxy - sx * sy) / d;
  const a = (sy - b * sx) / n;
  const ang = Math.abs(Math.atan(b));
  const cosA = Math.cos(ang);
  return Math.max(...pts.map((p) => (Math.abs(p.y - (a + b * p.x)) * cosA)));
}

/** È un tratto «barra»: orizzontale (anche inclinata fino a ~30° o con
 *  una leggera curva) e con una larghezza sensata. */
function isBar(s: SimpleStroke, b: Box): boolean {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (w < EQ_W_MIN) return false;
  if (h <= EQ_H_MAX) return true;
  // barra inclinata o leggermente curva: bbox più alta ma il tratto resta
  // «a nastro» (residuo dalla retta basso) e non troppo alto
  return h <= EQ_TILT_H && h <= 0.4 * w + 8 && lineResidual(s) <= EQ_TILT_RES;
}

/** Uguale IN UN SOLO TRATTO (vai-e-torna): la penna non si solleva, la
 *  traccia è fatta di CORSE ORIZZONTALI alternate (destra, sinistra,
 *  destra) con spostamenti verticali piccoli. Il modello lo legge come
 *  «z»/«2»/«3» → va riscritto in uguale sintetico. */
function isOneStrokeEqual(s: SimpleStroke, b: Box): boolean {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (w < EQ1_MIN_W || h > EQ1_MAX_H) return false;
  const pts = s.points;
  if (pts.length < 4) return false;
  let sumDx = 0;
  let sumDy = 0;
  let dir = 0;
  // corse: sequenze di punti con la stessa direzione orizzontale;
  // ogni corsa «larga» deve restare orizzontale (|dy| piccolo).
  // Il numero di inversioni di direzione è runs.length - 1.
  const runs: { dx: number; dy: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i]!.x - pts[i - 1]!.x;
    const dy = pts[i]!.y - pts[i - 1]!.y;
    sumDx += Math.abs(dx);
    sumDy += Math.abs(dy);
    const d = dx > 1 ? 1 : dx < -1 ? -1 : 0;
    if (d !== 0) {
      if (dir !== 0 && d !== dir) runs.push({ dx: 0, dy: 0 });
      dir = d;
    }
    if (runs.length === 0) runs.push({ dx: 0, dy: 0 });
    const r = runs[runs.length - 1]!;
    r.dx += dx;
    r.dy += dy;
  }
  if (runs.length < 3) return false; // servono almeno 3 corse (2 inversioni)
  if (sumDx < 3 * sumDy) return false; // movimento quasi solo orizzontale
  // ogni corsa sensata deve essere orizzontale (esclude «z», «2», «3»)
  for (const r of runs) {
    if (Math.abs(r.dx) < 8) continue; // raccordo corto: ok
    if (Math.abs(r.dy) > 0.45 * Math.abs(r.dx) + 5) return false;
  }
  return true;
}

/** RIMUOVE gli uguali dall'inchiostro e restituisce le ANCORE per
 *  reinserire «=» nel LaTeX (segnalazione 27/9).
 *
 *  Perché (verificato nel browser): anche l'UGUALE SINTETICO pulito (due
 *  barre orizzontali di dimensioni canoniche) il modello lo legge male
 *  quando l'uguale è da solo o in posizioni insolite («\frac{\infty}{m/m}»)
 *  — mentre cifre e lettere da sole le legge benissimo. Stessa soluzione
 *  di \sqrt e degli 8: si tolgono le barre dall'inchiostro, il modello
 *  legge il resto, e «=» viene reinserito nel LaTeX alla posizione
 *  proporzionale del segno. L'eventuale misread «:» di repairDivisionSigns
 *  è protetto dal segnaposto nel hook (eqEquals > 0). */
export function rewriteEqualSigns(strokes: SimpleStroke[]): EqRewrite {
  const boxes = strokes.map((s) => bboxOf([s]));
  const cx = boxes.map((b) => (b.x0 + b.x1) / 2);
  const cy = boxes.map((b) => (b.y0 + b.y1) / 2);
  const w = boxes.map((b) => b.x1 - b.x0);
  const h = boxes.map((b) => b.y1 - b.y0);
  const isBarStroke = strokes.map((s, i) => isBar(s, boxes[i]!));

  const removed = new Set<number>();
  const centersX: number[] = [];
  let count = 0;

  for (let i = 0; i < strokes.length; i++) {
    if (removed.has(i) || !isBarStroke[i]) continue;
    for (let j = i + 1; j < strokes.length; j++) {
      if (removed.has(j) || !isBarStroke[j]) continue;
      const dy = Math.abs(cy[i] - cy[j]);
      const dx = Math.abs(cx[i] - cx[j]);
      const wRatio = Math.min(w[i], w[j]) / Math.max(w[i], w[j]);
      if (dy < EQ_GAP_MIN || dy > EQ_GAP_MAX) continue;
      if (dx > EQ_CX_ALIGN) continue;
      if (wRatio < EQ_W_RATIO) continue;

      // GUARDIA «contenuto sotto»: una VERA coppia di barre di un «=» ha i
      // caratteri accanto ALLINEATI in verticale (le cifre attraversano la
      // fascia delle due barre). Se invece sotto la barra più bassa inizia
      // un blocco di contenuto (radicando sotto un vinculum, o una barretta
      // sopra una cifra), NON è un uguale.
      const yBottom = Math.max(boxes[i]!.y1, boxes[j]!.y1);
      let contentBelow = false;
      for (let k = 0; k < strokes.length; k++) {
        if (k === i || k === j || removed.has(k)) continue;
        if (h[k]! <= EQ_H_MAX + 2) continue; // solo tratti «alti»
        if (boxes[k]!.y0 > yBottom + 4 && boxes[k]!.x1 >= cx[i]! - 8 && boxes[k]!.x0 <= cx[i]! + 8) {
          contentBelow = true;
          break;
        }
      }
      if (contentBelow) continue;

      // GUARDIA «ingombro in mezzo» (come i due punti di dotSigns): un
      // tratto alto non può attraversare la fascia tra le due barre.
      const yMin = Math.min(boxes[i]!.y0, boxes[j]!.y0);
      const yMax = Math.max(boxes[i]!.y1, boxes[j]!.y1);
      let blocked = false;
      for (let k = 0; k < strokes.length; k++) {
        if (k === i || k === j || removed.has(k)) continue;
        if (h[k]! <= EQ_H_MAX + 2) continue;
        if (
          boxes[k]!.x1 >= cx[i]! - 2 && boxes[k]!.x0 <= cx[i]! + 2 &&
          boxes[k]!.y1 >= yMin && boxes[k]!.y0 <= yMax
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      // (7/10, giro 6) GUARDIA «PIEDE DELL'1»: la barra inferiore che ha sopra, appoggiato, un tratto ALTO
      // il cui centro cade nel suo intervallo orizzontale (`1` con base) e' un piede, non meta' di un «=».
      // Un vero uguale sta ACCANTO alle cifre: nessun tratto alto lo sovrasta.
      const lo = cy[i]! > cy[j]! ? i : j;
      const footOfGlyph = strokes.some((_, k) => {
        if (k === i || k === j || removed.has(k)) return false;
        if (h[k]! <= EQ_H_MAX + 2) return false;
        const kcx = (boxes[k]!.x0 + boxes[k]!.x1) / 2;
        return (
          kcx >= boxes[lo]!.x0 && kcx <= boxes[lo]!.x1 &&
          boxes[k]!.y1 >= boxes[lo]!.y0 - 6 && boxes[k]!.y1 <= boxes[lo]!.y1 + 3
        );
      });
      if (footOfGlyph) continue;
      // SIMMETRICA: la barra superiore con un tratto ALTO che parte subito sotto di lei e le sta sotto
      // (barra alta del «5», del «7», del «T»: `12-5` = meno + cappello del 5) e' un cappello, non un «=».
      const up = lo === i ? j : i;
      const capOfGlyph = strokes.some((_, k) => {
        if (k === i || k === j || removed.has(k)) return false;
        if (h[k]! <= EQ_H_MAX + 2) return false;
        return (
          boxes[k]!.x1 >= boxes[up]!.x0 - 4 && boxes[k]!.x0 <= boxes[up]!.x1 + 4 &&
          boxes[k]!.y0 >= boxes[up]!.y0 - 3 && boxes[k]!.y0 <= boxes[up]!.y1 + 6
        );
      });
      if (capOfGlyph) continue;

      removed.add(i);
      removed.add(j);
      centersX.push(cx[i]!);
      count++;
      break;
    }
  }

  // ⚠️ Uguale IN UN SOLO TRATTO: nessuna coppia di barre trovata, ma un
  // tratto vai-e-torna tutto orizzontale è un «=» disegnato senza staccare
  // la penna → rimosso e reinserito come gli altri.
  if (count === 0) {
    for (let i = 0; i < strokes.length; i++) {
      if (isOneStrokeEqual(strokes[i]!, boxes[i]!)) {
        removed.add(i);
        centersX.push(cx[i]!);
        count++;
      }
    }
  }

  if (count === 0) return { strokes, equals: 0, anchors: [], centers: [] };
  const kept = strokes.filter((_, i) => !removed.has(i));
  let minX = Infinity;
  let maxX = -Infinity;
  for (const s of kept) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
  }
  const anchors = centersX.map((x) =>
    !isFinite(minX) || maxX <= minX || x <= minX ? 0 : Math.min(1, (x - minX) / (maxX - minX)),
  );
  return { strokes: kept, equals: count, anchors, centers: centersX };
}

// ─── MENO «-» ──────────────────────────────────────────────────────
// Una barra orizzontale SINGOLA e ISOLATA: nessun tratto ALTO la attraversa
// in modo sostanziale (altrimenti sarebbe un «+» o la traversa staccata di
// un 7/4/A). Larghezza minima ridotta rispetto all'uguale (un meno può
// essere più corto di una barra di uguale).
const MIN_W = 10;
// (la guardia «attraversata» usa il CENTRO della barra: vedi sotto)

export interface MinusRewrite {
  strokes: SimpleStroke[];
  /** Meno rilevati e rimossi dall'inchiostro */
  minuses: number;
  /** Frazione orizzontale (0..1) di ogni meno rispetto all'inchiostro
   *  RESTANTE: serve a reinserire «-» nel LaTeX alla posizione proporzionale
   *  (stessa tecnica di =, \sqrt e degli 8). */
  anchors: number[];
  /** x ASSOLUTE (centro del glifo, stesso sistema dell'inchiostro) dei segni
   *  rimossi, nello stesso ordine di `anchors`: servono a reinserirli per
   *  POSIZIONE (composeLatex.ts) invece che per frazione dell'inchiostro rimasto. */
  centers: number[];
}

function isMinusBar(s: SimpleStroke, b: Box): boolean {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (w < MIN_W) return false;
  if (h <= EQ_H_MAX) return true;
  return h <= EQ_TILT_H && h <= 0.4 * w + 8 && lineResidual(s) <= EQ_TILT_RES;
}

/** RIMUOVE i segni meno «-» dall'inchiostro e restituisce le ANCORE per
 *  reinserirli nel LaTeX (segnalazione 27/9 «-8»).
 *
 *  Perché (segnalazione utente): un meno scritto a mano è SOLO una barra
 *  orizzontale — da solo viene spesso scartato (isStrokeMeaningful) o letto
 *  come «1»/«7»/punto dal modello; in «-8» la barra sassociata dal resto fa
 *  PERDERE il segno (l'app leggeva «8» o niente). Stessa soluzione di =, √
 *  e 8: la barra viene TOLTA dall'inchiostro, il modello legge il resto, e
 *  «-» viene REINSERITO nel LaTeX alla posizione proporzionale.
 *
 *  ⚠️ Si processa DOPO rewriteEqualSigns e rewriteRadicalSigns (uguali e
 *  vinculum sono già stati tolti: una barra singola residua non può essere
 *  né la metà di un uguale né il bordo di una radice) e PRIMA del modello. */
export function rewriteMinusSigns(strokes: SimpleStroke[]): MinusRewrite {
  const boxes = strokes.map((s) => bboxOf([s]));
  const cx = boxes.map((b) => (b.x0 + b.x1) / 2);
  const w = boxes.map((b) => b.x1 - b.x0);
  const h = boxes.map((b) => b.y1 - b.y0);

  const removed = new Set<number>();
  const centersX: number[] = [];
  // ⚠️ ISOLAMENTO + POSIZIONE (6/10, inkContext.ts): una barra che TOCCA un altro
  // tratto (barra alta del «5», piede dell'«1», tick di una quadra, braccio della
  // «+») è parte di un glifo; e un meno sta a metà altezza della riga, non ai
  // suoi estremi. Prima il banco di prova mostrava ~230 cifre/parentesi
  // mangiate dal meno su 4000 campioni sintetici.
  const contact = touchesOther(strokes, 1.5, (j) => isMinusBar(strokes[j]!, boxes[j]!));
  const lc = lineCenter(strokes, (k) => isMinusBar(strokes[k]!, boxes[k]!));

  // (25/10) GUARDIA APICE NEGATIVO («2^-2» scritto a mano, banco ONE):
  // la barra del meno DI UN ESPONENTE sta molto SOPRA la linea di scrit-
  // tura (l'apice è rialzato di ~0,35–0,4 altezze glifo); un meno binario
  // sta a metà altezza dei glifi. Riferimento di linea = mediana dei cy
  // dei glifi «alti» (h ≥ 70% del massimo): se la barra è chiaramente al
  // di sopra (≥ 0,2 altezze glifo), NON viene estratta — resta nell'inchiostro
  // e il modello la legge dentro l'apice (verificato: grezzo «2^{-2}»).
  const maxH = Math.max(...h, 1);
  const tallCys = boxes
    .map((b, k) => (h[k]! >= 0.7 * maxH ? (b!.y0 + b!.y1) / 2 : Number.POSITIVE_INFINITY))
    .filter((cy) => Number.isFinite(cy))
    .sort((a, b) => a - b);
  // ⚠️ MEDIANA VERA: con DUE glifi alti (es. frazione: numeratore e
  // denominatore) floor(n/2) prende il SECONDO (170 invece di 120) e la
  // guardia scartava un meno VERO a metà altezza (test inkSigns 27/9-bis).
  const lineCy = tallCys.length
    ? (tallCys.length % 2 === 1
        ? tallCys[(tallCys.length - 1) / 2]!
        : (tallCys[tallCys.length / 2 - 1]! + tallCys[tallCys.length / 2]!) / 2)
    : Number.NaN;

  for (let i = 0; i < strokes.length; i++) {
    if (!isMinusBar(strokes[i]!, boxes[i]!)) continue;
    if (contact[i]) continue;
    if (lc.medH > 0 && Math.abs((boxes[i]!.y0 + boxes[i]!.y1) / 2 - lc.medCy) > 0.3 * lc.medH) continue;
    if (Number.isFinite(lineCy) && (boxes[i]!.y0 + boxes[i]!.y1) / 2 < lineCy - 0.2 * maxH) continue;
    // GUARDIA «+», 7, 4, A…: un tratto ALTO che attraversa la fascia
    // verticale della barra sovrapponendosi in orizzontale per ≥ 40% della
    // larghezza della barra significa che la barra appartiene a quel glifo
    // → NON è un meno (il verticale di un «+» attraversa in pieno).
    let crossed = false;
    for (let k = 0; k < strokes.length; k++) {
      if (k === i || removed.has(k)) continue;
      if (h[k]! <= EQ_H_MAX + 2) continue; // solo tratti «alti»
      // il tratto alto deve VERTICALMENTE attraversare la fascia della barra
      if (boxes[k]!.y0 > boxes[i]!.y1 || boxes[k]!.y1 < boxes[i]!.y0) continue;
      // attraversamento del CENTRO della barra (con tolleranza di penna,
      // ±4px: un tratto verticale «perfetto» ha bbox di larghezza zero):
      // il verticale di un «+» passa in mezzo; una cifra adiacente a un
      // meno tocca al massimo l'ESTREMO della barra, mai il suo centro.
      if (boxes[k]!.x0 - 4 <= cx[i]! && boxes[k]!.x1 + 4 >= cx[i]!) {
        crossed = true;
        break;
      }
    }
    if (crossed) continue;
    // ⚠️ GUARDIA «LINEA DI FRAZIONE» (segnalazione 27/9-bis: la frazione
    // impilata «75/7» scritta a mano veniva riconosciuta «−75/7»): la
    // linea della frazione è ANCHE lei una barra orizzontale singola e
    // isolata (nessun tratto la attraversa: numeratore e denominatore
    // stanno SOPRA e SOTTO, non in mezzo) — veniva tolta dall'inchiostro
    // e reinserita come «−» davanti alla frazione. Firma geometrica di
    // una linea di frazione: tratti MOLTO più alti della barra (cifre,
    // ≥ 3× la sua altezza) sia SOPRA sia SOTTO il suo centro, che si
    // sovrappongono in ORIZZONTALE alla barra per ≥ 30% della larghezza.
    // Un meno vero ha i numeri ACCANTO (destra/sinistra), mai sopra E
    // sotto: resta un meno e viene estratto come prima.
    let sopraBarra = false;
    let sottoBarra = false;
    const cyBarra = (boxes[i]!.y0 + boxes[i]!.y1) / 2;
    for (let k = 0; k < strokes.length; k++) {
      if (k === i || removed.has(k)) continue;
      if (h[k]! < 3 * Math.max(h[i]!, 1)) continue; // solo tratti «da cifra»
      const ov = Math.min(boxes[i]!.x1, boxes[k]!.x1) - Math.max(boxes[i]!.x0, boxes[k]!.x0);
      if (ov < 0.3 * w[i]!) continue;
      if (boxes[k]!.y1 <= cyBarra) sopraBarra = true;
      else if (boxes[k]!.y0 >= cyBarra) sottoBarra = true;
    }
    if (sopraBarra && sottoBarra) continue; // è la LINEA di una frazione impilata
    removed.add(i);
    centersX.push(cx[i]!);
  }

  if (centersX.length === 0) return { strokes, minuses: 0, anchors: [], centers: [] };

  // ⚠️ DOPPIO MENO «--» (segnalazione 27/9): un meno spesso arriva come
  // DUE tratti quasi sovrapposti (andata + ripasso sullo stesso segno, o
  // jitter della penna): le due barre vengono estratte entrambe e il
  // LaTeX diventa «--». Si FONDONO i meno quasi coincidenti (distanza
  // dei centri < 60% della barra più larga) in UNO solo — un «--» vero
  // non esiste nelle espressioni scolastiche, mentre due barre ravvi-
  // cinate ma DISTINTE (es. «5-8-2») restano due meni.
  const centersWithW: { x: number; w: number }[] = [];
  for (const i of removed) centersWithW.push({ x: cx[i]!, w: w[i]! });
  centersWithW.sort((a, b) => a.x - b.x);
  const mergedCenters: { x: number; w: number }[] = [];
  for (const c of centersWithW) {
    const last = mergedCenters[mergedCenters.length - 1];
    if (last && c.x - last.x < 0.6 * Math.max(last.w, c.w)) {
      last.x = (last.x + c.x) / 2;
      last.w = Math.max(last.w, c.w);
    } else {
      mergedCenters.push({ ...c });
    }
  }
  const kept = strokes.filter((_, i) => !removed.has(i));
  let minX = Infinity;
  let maxX = -Infinity;
  for (const s of kept) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
  }
  const anchors = mergedCenters.map((m) =>
    !isFinite(minX) || maxX <= minX || m.x <= minX ? 0 : Math.min(1, (m.x - minX) / (maxX - minX)),
  );
  return { strokes: kept, minuses: mergedCenters.length, anchors, centers: mergedCenters.map((m) => m.x) };
}

// ─── MENO SPURIO DAVANTI ALLA FRAZIONE IMPILATA (segnalazione 27/9-bis) ──
// Lo studente scrive la frazione impilata (numeratore, linea, denominatore)
// e il riconoscimento produce «−\frac{75}{7}» invece di «\frac{75}{7}»: la
// LINEA della frazione — o un pezzo di curva (l'inizio del 7, un tratto
// interrotto) — finisce classificato come segno «−». In modalità frazione
// impilata un simbolo «−» è accettato SOLO se sta chiaramente all'ESTERNO,
// a SINISTRA della frazione, e NON sulla banda orizzontale della linea.

/** Firma della linea di frazione: barra piatta (w > 1,6·h) con tratti
 *  «da cifra» (≥ 3× la sua altezza) sia sopra sia sotto il suo centro,
 *  sovrapposti in orizzontale per ≥ 30% della sua larghezza. */
function isFractionLineBox(b: Box, boxes: Box[]): boolean {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (w <= 1.6 * Math.max(h, 1)) return false;
  const cy = (b.y0 + b.y1) / 2;
  let sopra = false;
  let sotto = false;
  boxes.forEach((o, k) => {
    if (o === b) return;
    if (o.y1 - o.y0 < 3 * Math.max(h, 1)) return;
    const ov = Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0);
    if (ov < 0.3 * w) return;
    if (o.y1 <= cy) sopra = true;
    else if (o.y0 >= cy) sotto = true;
  });
  return sopra && sotto;
}

/** Firma di un meno VERO: barra piatta (larghezza reale, non solo un
 *  puntino) SENZA cifre sopra/sotto che si sovrappongono alla sua banda
 *  e chiaramente a SINISTRA di tutti gli altri tratti (esterno alla
 *  frazione). */
function isRealMinusBox(b: Box, boxes: Box[]): boolean {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (w < Math.max(1.6 * h, 8)) return false;
  const cy = (b.y0 + b.y1) / 2;
  const altri = boxes.filter((o) => o !== b);
  for (const o of altri) {
    if (o.y1 - o.y0 < 3 * Math.max(h, 1)) continue;
    const ov = Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0);
    if (ov < 0.3 * w) continue;
    // una cifra nella BANDA orizzontale della barra (sopra o sotto il
    // suo centro): non è un meno isolato
    if (o.y1 <= cy || o.y0 >= cy) return false;
  }
  const minX = Math.min(...altri.map((o) => o.x0));
  return b.x1 <= minX + 0.25 * w;
}

/** Scarta il «−» spurio davanti a una frazione impilata riconosciuta.
 *
 *  Regole (segnalazione 27/9-bis):
 *  1. il LaTeX inizia con «−» e il resto è una frazione impilata pura
 *     (\frac{n}{d} oppure n/d);
 *  2. l'INCHIESTRO contiene la linea della frazione (barra piatta con
 *     cifre sopra e sotto) — quindi il «−» del LaTeX non può essere che
 *     quella linea (o un frammento di curva scambiato per meno);
 *  3. NESSUN tratto dell'inchiostro ha la firma di un meno vero (barra
 *     chiaramente a sinistra della frazione, fuori dalla banda della
 *     linea).
 *
 *  Se tutte e tre valgono, il «−» va SCARTATO: il risultato riconosciuto
 *  per «75/7» scritto bene deve essere «\frac{75}{7}» (= 10,71…), MAI
 *  «−\frac{75}{7}» (= −10,71). Un «−» disegnato davvero a sinistra,
 *  fuori dalla banda della linea, resta al suo posto. */
export function stripSpuriousFractionMinus(latex: string, strokes: SimpleStroke[]): string {
  const t = latex.trim();
  if (!t.startsWith("-")) return latex;
  const resto = t.replace(/^-+\s*/, "");
  // solo se il resto è una frazione impilata pura: \frac{n}{d} oppure n/d
  const isFrac = /^\\frac\{/.test(resto) || /^\d+\s*\/\s*\d+$/.test(resto);
  if (!isFrac) return latex;
  if (strokes.length < 2) return latex;
  const boxes = strokes.map((s) => bboxOf([s]));
  // (2) c'è la linea della frazione nell'inchiostro?
  if (!boxes.some((b) => isFractionLineBox(b, boxes))) return latex;
  // (3) c'è anche un meno VERO disegnato a sinistra? Allora il «−» legittimo.
  if (boxes.some((b) => isRealMinusBox(b, boxes))) return latex;
  return resto;
}

// ─── RADICE «√» ──────────────────────────────────────────────────
// Il segno di radice è una «V» coricata (discesa + risalita ripida che
// finisce IN ALTO) con sopra una barra orizzontale (vinculum) sotto cui
// sta il radicando. La barra FONDE tutto in un glifo unico che il modello
// legge come «\sigma» → si rimuove.
const RAD_MIN_H = 20; // altezza minima della V
const RAD_RISE_MIN = 0.55; // la risalita deve arrivare ad almeno il 55% della discesa
const RAD_H_MAX = 12; // spessore massimo di una barra orizzontale
const RAD_BAR_MIN_W = 18; // larghezza minima del vinculum separato
const RAD_APEX_TOL = 26; // distanza orizzontale barra↔apice della V
const RAD_APEX_YTOL = 18; // distanza verticale barra↔apice della V
const RAD_TAIL_MIN = 18; // coda orizzontale minima (vinculum nello stesso tratto)
const RAD_TAIL_YSPAN = 10; // escursione verticale massima della coda (una barra è piatta)

/** Rileva un tratto «a V» (discesa poi risalita che finisce in alto). */
function isCheckmark(s: SimpleStroke, b: Box): boolean {
  if (b.y1 - b.y0 < RAD_MIN_H) return false;
  const pts = s.points;
  if (pts.length < 3) return false;
  // ⚠️ Guardia ANTI-8 (segnalazione 27/9-quater: «l'8 lo confonde con la
  // radice»): un 8 che sfugge a rewriteEights può sembrare una V con la
  // risalita finale (l'ultimo arco dell'anello inferiore) e finire a destra
  // del via → diventava un RADICALE falso e l'utente vedeva √. Una √ VERA
  // è un tratto APERTO e SEMPLICE: niente chiusura né autointersezioni.
  const diag = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
  const gapEnds = Math.hypot(
    pts[pts.length - 1]!.x - pts[0]!.x,
    pts[pts.length - 1]!.y - pts[0]!.y,
  );
  if (gapEnds <= Math.max(0.35 * diag, 14)) return false; // tratto chiuso: anello, non V
  if (countSelfCrossings(s).length >= 1) return false; // 8 a croce: incrocia al centro
  // indice del punto più BASSO (valle)
  let valley = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i]!.y > pts[valley]!.y) valley = i;
  const rel = valley / (pts.length - 1);
  if (rel < 0.15 || rel > 0.9) return false;
  const drop = pts[valley]!.y - pts[0]!.y; // discesa iniziale
  const rise = pts[valley]!.y - pts[pts.length - 1]!.y; // risalita finale
  if (drop < RAD_MIN_H * 0.5) return false;
  if (rise < drop * RAD_RISE_MIN) return false;
  if (pts[pts.length - 1]!.x <= pts[0]!.x) return false; // deve progredire a destra
  return true;
}

// ─── NUMERO «8» ──────────────────────────────────────────────
// (segnalazione 26/9: «fa difficoltà a riconoscere il numero 8»)
// Verificato nel browser: un 8 disegnato (anello doppio, anche chiuso con
// autointersezione) il modello lo legge «3B», «Z», «s»… Firme geometriche
// dell'8 tra i glifi scolastici:
//   1. tratto CHIUSO (inizio ≈ fine) con STRETTURA al centro: la larghezza
//      orizzontale nella fascia centrale è molto minore che ai poli (gli
//      anelli sono larghi, il punto di vita è stretto). Uno ZERO invece è
//      PIÙ LARGO proprio al centro — la strozzatura lo esclude;
//   2. autointersezione al centro (8 disegnato «a croce»);
//   3. DUE ANELLI chiusi impilati (8 in due tratti).
// Una guardia anti-stelo (una sola corsa verticale continua sul bordo
// sinistro, come il gambo di B/D) esclude le lettere con gambo. Quindi:
// l'8 viene rimosso dall'inchiostro e «8» reinserito nel LaTeX alla
// posizione proporzionale (stessa tecnica di \sqrt).
// (segnalazione 27/9: 8 piccoli o con la vita larga non venivano colti)
// (segnalazione 27/9-bis: un 8 che sfugge alla geometria resta
// nell'inchiostro e il MODELLO lo legge a volte «\sqrt» → oltre ad
// allargare le firme geometriche (8 aperto, anelli sovrapposti) esiste
// repairModelSqrt: \\sqrt spurio del modello + glifo ad anello = 8)
const EIGHT_MIN_H = 22; // altezza minima (come una cifra)
const EIGHT_MIN_W = 12;
const EIGHT_MAX_WH = 1.2; // un 8 è più alto che largo (w ≤ 1.2·h)
const EIGHT_PINCH = 0.62; // larghezza centrale ≤ 62% della massima
// (uno ZERO invece è PIÙ LARGO al centro: resta escluso)

/** Punti deduplicati (giunzioni con la penna ferma). */
function dedupePoints(s: SimpleStroke): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const p of s.points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1.5) out.push(p);
  }
  return out;
}

/** Larghezza orizzontale dell'inchiostro nella fascia verticale centrata
 *  su yCenter (semi-larghezza band), o -1 se la fascia è vuota. */
/** Quante volte la polilinea ATTRAVERSA la riga y = yCenter (cambi di segno; y esatta conta come «sotto»). */
export function rowCrossings(pts: { x: number; y: number }[], yCenter: number): number {
  let n = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!.y - yCenter;
    const b = pts[i + 1]!.y - yCenter;
    if ((a < 0 && b >= 0) || (a >= 0 && b < 0)) n++;
  }
  return n;
}

export function horizontalExtentAt(
  pts: { x: number; y: number }[],
  yCenter: number,
  band: number,
): number {
  let mn = Infinity;
  let mx = -Infinity;
  for (const p of pts) {
    if (Math.abs(p.y - yCenter) <= band) {
      if (p.x < mn) mn = p.x;
      if (p.x > mx) mx = p.x;
    }
  }
  // (6/10) INTERPOLAZIONE sulla polilinea. Con pochi punti (scrittura piccola, passo ~4 px o più:
  // anche il mouse campiona a intervalli irregolari) la fascia ±band può contenere i punti di UN SOLO
  // lato di un anello: l'estensione risultava ~0 e uno «0» o l'occhiello di una «b» sembrava un 8 con
  // la vita strozzata («b» → «18» in `3a(b+1)` e `(a+b)(a-b)`). Si aggiungono le intersezioni dei
  // segmenti con la riga centrale: i due lati di un anello compaiono sempre, mentre la vita di un 8
  // resta stretta perché i suoi due tratti attraversano il centro vicini. Il valore può solo crescere.
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if ((a.y - yCenter) * (b.y - yCenter) < 0) {
      const x = a.x + ((yCenter - a.y) / (b.y - a.y)) * (b.x - a.x);
      if (x < mn) mn = x;
      if (x > mx) mx = x;
    }
  }
  return mx >= mn ? mx - mn : -1;
}

/** STelo: una sola corsa continua di punti sul bordo sinistro che copre
 *  gran parte dell'altezza (il gambo di B, D, θ). Un vero 8 tocca il
 *  bordo sinistro in DUE zone distinte (i poli dei due anelli). */
function hasLeftStem(pts: { x: number; y: number }[], b: Box): boolean {
  const h = b.y1 - b.y0;
  const w = b.x1 - b.x0;
  const xLim = b.x0 + Math.max(4, 0.08 * w);
  const ys = pts.filter((p) => p.x <= xLim).map((p) => p.y).sort((a, b2) => a - b2);
  if (ys.length < 2) return false;
  let runs = 1;
  for (let i = 1; i < ys.length; i++) {
    if (ys[i]! - ys[i - 1]! > 0.12 * h) runs++;
  }
  const span = ys[ys.length - 1]! - ys[0]!;
  return runs === 1 && span > 0.65 * h;
}

/** Intersezione tra due segmenti, se esiste (t in [0,1], u in [0,1]). */
function segIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): { x: number; y: number } | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

/** Autointersezioni di un tratto (coppie di segmenti NON adiacenti).
 *  I punti finali che ritornano sull'inizio (raccordo di chiusura) vengono
 *  tagliati prima del conteggio: altrimenti la chiusura sembra un incrocio. */
export function countSelfCrossings(s: SimpleStroke): { xs: number; ys: number }[] {
  const dedup = dedupePoints(s);
  const b = bboxOf([s]);
  const diag = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
  const h = b.y1 - b.y0;
  const start = dedup[0]!;
  const pts = dedup.slice();
  while (pts.length > 4) {
    const last = pts[pts.length - 1]!;
    if (Math.hypot(last.x - start.x, last.y - start.y) > Math.max(4, 0.12 * diag)) break;
    pts.pop();
  }
  const hits: { xs: number; ys: number }[] = [];
  for (let i = 0; i < pts.length - 1 && hits.length <= 2; i++) {
    for (let j = i + 2; j < pts.length - 1; j++) {
      const hit = segIntersect(pts[i]!, pts[i + 1]!, pts[j]!, pts[j + 1]!);
      if (hit) {
        hits.push({ xs: (hit.x - b.x0) / Math.max(1, b.x1 - b.x0), ys: (hit.y - b.y0) / Math.max(1, h) });
        if (hits.length > 2) break;
      }
    }
  }
  return hits;
}

/** È un 8 in un solo tratto.
 *  Firme accettate (basta UNA):
 *   a) STROZZATURA: tratto chiuso e larghezza orizzontale al centro ≤ 55%
 *      della massima (gli anelli sono larghi, il punto di vita no);
 *   b) AUTointersezione al centro (8 «a croce», disegnato passando due
 *      volte per il punto di vita).
 *  Guardie: niente stelo a sinistra (B/D/θ), non più largo che alto. */
export function isEightStroke(s: SimpleStroke, b: Box): boolean {
  const h = b.y1 - b.y0;
  const w = b.x1 - b.x0;
  if (h < EIGHT_MIN_H || w < EIGHT_MIN_W) return false;
  if (w > EIGHT_MAX_WH * h) return false; // più largo che alto: non è un 8 (è ∞)
  const pts = s.points;
  if (pts.length < 8) return false;
  const start = pts[0]!;
  const end = pts[pts.length - 1]!;
  const diag = Math.hypot(w, h);
  // CHIUSO: inizio e fine quasi coincidenti
  const gap = Math.hypot(end.x - start.x, end.y - start.y);
  const closed = gap <= Math.max(0.35 * diag, 14);
  if (!closed) {
    // (segnalazione 27/9-bis: 8 letto come radice) 8 «APERTO»: la traccia
    // non si richiude ma passa comunque per il centro. Accettato SOLO se
    // le estremità sono vicine e NON divaricate in diagonale come le
    // braccia di una «x» (x-spread ≤ 0.5·w) — altrimenti sarebbe una x.
    if (gap > Math.max(0.5 * diag, 20)) return false;
    if (Math.abs(end.x - start.x) > 0.5 * w) return false;
  }
  if (hasLeftStem(pts, b)) return false; // gambo: B, D, θ — non è un 8
  // a) strozzatura al centro (SOLO se chiuso: una «s» aperta strozza
  //    anch'essa al centro e non va scambiata per un 8)
  if (closed) {
    const cy = (b.y0 + b.y1) / 2;
    const mid = horizontalExtentAt(pts, cy, 0.1 * h);
    // (6/10) una vera VITA ha DUE tratti che attraversano il centro (uno per lato): con un solo
    // attraversamento il tratto è un ARCO aperto (l'occhiello «)» di una «b», una «c») e l'estensione
    // al centro vale ~0 per costruzione. `closed` ammette uno scarto inizio-fine fino a 14 px: a
    // scrittura piccola è più di metà dell'altezza dell'occhiello (b → «18» in `3a(b+1)`).
    if (mid >= 0 && mid <= EIGHT_PINCH * w && rowCrossings(pts, cy) >= 2) return true;
  }
  // b) autointersezioni al CENTRO (8 a croce: 1 incrocio; con anelli
  //    sovrapposti la traccia incrocia se stessa 2 volte, sempre al
  //    centro) — vale anche per l'8 APERTO (guardie sopra)
  const hits = countSelfCrossings(s);
  return hits.length >= 1 && hits.length <= 2 && hits.every((cr) => cr.ys > 0.2 && cr.ys < 0.8);
}

/** È un ANELLO chiuso senza incroci (uno dei due cerchi di un 8 in due tratti). */
function isClosedLoop(s: SimpleStroke, b: Box): boolean {
  const h = b.y1 - b.y0;
  const w = b.x1 - b.x0;
  if (h < 16 || w < 12) return false;
  if (w > 1.8 * h || h > 1.8 * w) return false;
  const pts = s.points;
  if (pts.length < 6) return false;
  const start = pts[0]!;
  const end = pts[pts.length - 1]!;
  const diag = Math.hypot(w, h);
  if (Math.hypot(end.x - start.x, end.y - start.y) > Math.max(0.4 * diag, 16)) return false;
  return countSelfCrossings(s).length === 0;
}

export interface EightRewrite {
  strokes: SimpleStroke[];
  /** Ottari rilevati e rimossi dall'inchiostro */
  eights: number;
  /** Frazione orizzontale (0..1) di ogni 8 rispetto all'inchiostro
   *  restante: serve a reinserire «8» nel LaTeX alla posizione giusta
   *  (come \sqrt in rewriteRadicalSigns). */
  anchors: number[];
  /** x ASSOLUTE (centro del glifo, stesso sistema dell'inchiostro) dei segni
   *  rimossi, nello stesso ordine di `anchors`: servono a reinserirli per
   *  POSIZIONE (composeLatex.ts) invece che per frazione dell'inchiostro rimasto. */
  centers: number[];
  /** riquadro di ogni 8 rimosso: base virtuale per un eventuale esponente (8²) */
  boxes: { x0: number; x1: number; y0: number; y1: number }[];
}

/** RIMUOVE gli 8 dall'inchiostro (firma geometrica: tratto chiuso con un
 *  incrocio centrale, o due anelli chiusi impilati) e restituisce le
 *  ANCORE per reinserire «8» nel LaTeX. */
export function rewriteEights(strokes: SimpleStroke[]): EightRewrite {
  const boxes = strokes.map((s) => bboxOf([s]));
  const removed = new Set<number>();
  const centersX: number[] = [];
  const eightBoxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  let eights = 0;

  // CASO 1 — 8 in un solo tratto
  for (let i = 0; i < strokes.length; i++) {
    if (isEightStroke(strokes[i]!, boxes[i]!)) {
      removed.add(i);
      centersX.push((boxes[i]!.x0 + boxes[i]!.x1) / 2);
      eightBoxes.push({ ...boxes[i]! });
      eights++;
    }
  }

  // CASO 2 — 8 in DUE tratti: due anelli chiusi impilati, centrati, simili
  for (let i = 0; i < strokes.length; i++) {
    if (removed.has(i) || !isClosedLoop(strokes[i]!, boxes[i]!)) continue;
    for (let j = i + 1; j < strokes.length; j++) {
      if (removed.has(j) || !isClosedLoop(strokes[j]!, boxes[j]!)) continue;
      const bi = boxes[i]!, bj = boxes[j]!;
      const cxi = (bi.x0 + bi.x1) / 2, cyi = (bi.y0 + bi.y1) / 2;
      const cxj = (bj.x0 + bj.x1) / 2, cyj = (bj.y0 + bj.y1) / 2;
      const hi = bi.y1 - bi.y0, hj = bj.y1 - bj.y0;
      const wi = bi.x1 - bi.x0, wj = bj.x1 - bj.x0;
      // impilati (distanza verticale ≥ 45% dell'altezza — 27/9-bis:
      // prima 60% e gli anelli SOVRAPPOSTI di un 8 in due tratti
      // sfuggivano) e centrati
      if (Math.abs(cyi - cyj) < 0.45 * Math.max(hi, hj)) continue;
      if (Math.abs(cxi - cxj) > 0.5 * Math.max(wi, wj)) continue;
      // dimensioni simili (esclude «0» accanto ad altro)
      if (Math.min(hi, hj) / Math.max(hi, hj) < 0.4) continue;
      // non ci sono altri tratti in mezzo ai due anelli
      const yMin = Math.min(bi.y0, bj.y0), yMax = Math.max(bi.y1, bj.y1);
      let blocked = false;
      for (let k = 0; k < strokes.length; k++) {
        if (k === i || k === j || removed.has(k)) continue;
        if (boxes[k]!.y1 > yMin + 2 && boxes[k]!.y0 < yMax - 2 &&
            boxes[k]!.x1 > Math.min(cxi, cxj) && boxes[k]!.x0 < Math.max(cxi, cxj)) {
          blocked = true; break;
        }
      }
      if (blocked) continue;
      removed.add(i);
      removed.add(j);
      centersX.push((cxi + cxj) / 2);
      eightBoxes.push({
        x0: Math.min(bi.x0, bj.x0),
        x1: Math.max(bi.x1, bj.x1),
        y0: yMin,
        y1: yMax,
      });
      eights++;
      break;
    }
  }

  if (eights === 0) return { strokes, eights: 0, anchors: [], centers: [], boxes: [] };
  const kept = strokes.filter((_, i) => !removed.has(i));
  let minX = Infinity;
  let maxX = -Infinity;
  for (const s of kept) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
  }
  const anchors = centersX.map((x) =>
    !isFinite(minX) || maxX <= minX || x <= minX ? 0 : Math.min(1, (x - minX) / (maxX - minX)),
  );
  return { strokes: kept, eights, anchors, centers: centersX, boxes: eightBoxes };
}

/** PROVA DEL LOOP (27/9-bis): esiste nell'inchiostro un glifo ad ANELLO
 *  (anello chiuso oppure tratto con autointersezione)? Serve alla
 *  riparazione del «\sqrt» spurio del modello: un 8 che sfugge alla
 *  geometria (isEightStroke) resta nell'inchiostro e il modello lo legge
 *  a volte «\sqrt» (il token esiste nel vocabolario), mentre per una
 *  radice VERA il modello non produce mai «\sqrt» (produce «v», «\sigma»,
 *  «\theta» — verificato nel browser 26/9). */
export function hasLoopGlyph(strokes: SimpleStroke[]): boolean {
  for (const s of strokes) {
    const b = bboxOf([s]);
    if (isClosedLoop(s, b)) return true;
    if (s.points.length >= 8 && countSelfCrossings(s).length >= 1) return true;
  }
  return false;
}

/** Firma d'inchiostro 8 / 9 / 0 sull'INTERO pezzo (27/9-quater).
 *  Il modello legge l'8 come «θ»/«g» e il 9 come «g»/«q»/«3»: quando il
 *  pezzo è un glifo isolato questa firma dice CHI è, dal profilo:
 *  — «8»: metà ALTA larga, metà BASSA larga, VITA stretta (palestra);
 *  — «9»: anello largo in alto, gambo STRETTO in basso;
 *  — «0»: largo ovunque (vita compresa) — serve a NON scambiarlo per 8.
 *  Restituisce null se l'inchiostro non assomiglia a nessuna delle tre
 *  (es. «+», radici, pezzi con più glifi). */
export function eightOrNineFromInk(strokes: SimpleStroke[]): "8" | "9" | "0" | null {
  if (strokes.length === 0) return null;
  const b = bboxOf(strokes);
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  // ⚠️ 1,2 e non 1,4 (27/9: «27 letto 8» nella finestra dei risultati): la
  // firma vale per UN SINGOLO glifo, e un glifo ad anello (8/9/0) è più
  // alto che largo — lo stesso limite di isEightStroke (EIGHT_MAX_WH).
  if (h < 25 || w <= 0 || w / h > 1.2) return null;

  // ⚠️ GUARDIA MULTI-GRAFO (27/9: «27 letto 8» nella finestra dei
  // risultati): due cifre compatte affiancate («27», anche «88») possono
  // soddisfare la firma dell'8 (due fasce larghe con valle al centro) e la
  // scorciatoia «8 isolato» dell'hook SOVRASCRIVE il modello. Se esiste
  // una COLONNA VERTICALE VUOTA interna (≥ 2 colonne su 24, ~8% della
  // larghezza) l'inchiostro si spezza in ≥ 2 glifi affiancati: non è
  // mai un 8/9/0 (un anello unico attraversa tutte le colonne).
  {
    const C = 24;
    const occ = new Array<boolean>(C).fill(false);
    const mark = (x: number) => {
      occ[Math.min(C - 1, Math.max(0, Math.floor(((x - b.x0) / w) * C)))] = true;
    };
    for (const s of strokes) {
      const pts = s.points;
      if (pts.length === 0) continue;
      mark(pts[0]!.x);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const c = pts[i]!;
        const steps = Math.max(1, Math.ceil(Math.abs(c.x - a.x) / 3));
        for (let k = 1; k <= steps; k++) mark(a.x + ((c.x - a.x) * k) / steps);
      }
    }
    const first = occ.indexOf(true);
    const last = occ.lastIndexOf(true);
    let run = 0;
    for (let i = first; i <= last; i++) {
      if (!occ[i]) {
        run++;
        if (run >= 2) return null; // ≥ 2 glifi affiancati
      } else {
        run = 0;
      }
    }
  }

  // Profilo a 16 fette orizzontali dell'ampiezza dell'inchiostro, con
  // CAMPIONAMENTO DENSO dei segmenti (ogni ~3 px): i tratti poco densi
  // (pochi punti campionati) non devono lasciare buchi nel profilo.
  const N = 16;
  const mn = new Array<number>(N).fill(Infinity);
  const mx = new Array<number>(N).fill(-Infinity);
  const add = (x: number, y: number) => {
    const i = Math.min(N - 1, Math.max(0, Math.floor(((y - b.y0) / h) * N)));
    if (x < mn[i]) mn[i] = x;
    if (x > mx[i]) mx[i] = x;
  };
  for (const s of strokes) {
    const pts = s.points;
    if (pts.length === 0) continue;
    add(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const c = pts[i]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(c.x - a.x, c.y - a.y) / 3));
      for (let k = 1; k <= steps; k++) {
        add(a.x + ((c.x - a.x) * k) / steps, a.y + ((c.y - a.y) * k) / steps);
      }
    }
  }
  // NB: profilo GREZZO (senza piallatura): la media coi vicini RIEMPYE la
  // valle dell'8 e la firma non la vede più; il campionamento denso dei
  // segmenti rende comunque il profilo già continuo.
  const prof = mn.map((v, i) => (v === Infinity ? 0 : mx[i]! - v));
  const maxOf = (i0: number, i1: number) => {
    let m = 0;
    let idx = -1;
    for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
      if (prof[i]! > m) {
        m = prof[i]!;
        idx = i;
      }
    }
    return { m, idx };
  };
  const minOf = (i0: number, i1: number) => {
    let m = Infinity;
    for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
      if (prof[i]! < m) m = prof[i]!;
    }
    return m;
  };

  const topQuarter = maxOf(0, N / 4 - 1).m; // primo quarto: l'arco alto del 9/0 è già largo
  const topHalf = maxOf(1, N / 2 - 1); // picco alto INTERNO (l'anello del 9/8, non il bordo)
  const botHalf = maxOf(N / 2, N - 3); // picco basso interno (secondo anello dell'8)
  const bottom = maxOf(Math.floor(N * 0.7), N - 1).m; // fondo: la coda stretta del 9

  // «9»: quarto alto largo, picco dell'anello in alto (non al bordo: una V
  // ha il massimo alla prima fetta), fondo STRETTO (solo la coda)
  if (
    topQuarter >= 0.7 * w &&
    topHalf.idx >= 2 &&
    topHalf.m >= 0.7 * w &&
    bottom <= 0.5 * w
  ) {
    return "9";
  }
  // «8»: due picchi larghi (alto e basso) con VALLE profonda al centro;
  // «0»: largo ovunque SENZA valle (profilo a cupola piena)
  if (topHalf.m >= 0.7 * w && botHalf.m >= 0.7 * w && topHalf.idx < botHalf.idx) {
    const dip = minOf(topHalf.idx, botHalf.idx);
    if (dip <= 0.85 * Math.min(topHalf.m, botHalf.m)) return "8";
    if (topQuarter >= 0.7 * w && dip >= 0.92 * Math.min(topHalf.m, botHalf.m)) return "0";
  }
  return null;
}

/** Ripara il «9» letto dal modello come LETTERA «g» o «q»
 *  (segnalazione 27/9-quater: «il 9 come lettera g minuscola»; verificato
 *  nel browser: un 9 a un tratto → «3», un 9 a due tratti → «q», un 8 a
 *  un tratto → «g»). Nelle espressioni scolastiche g e q NON sono
 *  variabili usate: un g/q isolato (non dentro un comando LaTeX e non
 *  attaccato ad altre lettere) è quasi sempre un 9. «\sigma» e «\log»
 *  restano intatti (la g è preceduta da una lettera).
 *  «verdict» è la firma d'inchiostro (eightOrNineFromInk): se dice «8»
 *  (il modello legge a volte l'8 come g) il g/q diventa «8»; per «\theta»
 *  (mai legittimo nelle espressioni scolastiche: è un glifo ad anello
 *  frainteso) vale la firma: 8/9/0, e con firma nulla resta com'è. */
export function repairModelNine(latex: string, verdict?: "8" | "9" | "0" | null): string {
  let out = latex.replace(
    /(?<![a-zA-Z\\])[gqGQ](?![a-zA-Z])/g,
    () => (verdict === "8" ? "8" : "9"),
  );
  if (verdict) {
    out = out.replace(/\\theta/g, verdict);
  }
  return out;
}

/** Ripara il «\sqrt» SPURIO prodotto dal modello per un 8 frainteso
 *  (segnalazione 27/9: «il numero 8 lo confonde spesso con una radice
 *  quadrata»). Attivo SOLO se:
 *   - NON ci sono radici geometriche (radicalsFound === 0: una radice
 *     vera viene rimossa da rewriteRadicalSigns e reinserita con le
 *     ancore, quindi un \sqrt nel latex del modello sarebbe duplicato);
 *   - il latex del modello contiene «\sqrt»;
 *   - nell'inchiostro c'è un glifo ad anello (hasLoopGlyph).
 *  «\sqrt{9}» → «89» (il contenuto delle graffe resta, in giustapposizione);
 *  «\sqrt» nudo → «8». In ogni altro caso il latex resta invariato. */
export function repairModelSqrt(
  latex: string,
  radicalsFound: number,
  strokes: SimpleStroke[],
): string {
  if (radicalsFound > 0 || !latex.includes("\\sqrt")) return latex;
  if (!hasLoopGlyph(strokes)) return latex;
  return latex
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "8$1")
    .replace(/\\sqrt/g, "8");
}

export interface RadicalRewrite {
  strokes: SimpleStroke[];
  /** Radici rilevate e rimosse dall'inchiostro */
  radicals: number;
  /** Frazione orizzontale (0..1) di ogni radice rimossa rispetto
   *  all'inchiostro restante: serve a reinserire «\sqrt» nel LaTeX
   *  alla posizione proporzionale giusta (come spliceExponents). */
  anchors: number[];
  /** x ASSOLUTE (centro del glifo, stesso sistema dell'inchiostro) dei segni
   *  rimossi, nello stesso ordine di `anchors`: servono a reinserirli per
   *  POSIZIONE (composeLatex.ts) invece che per frazione dell'inchiostro rimasto. */
  centers: number[];
}

/** RIMUOVE la radice dall'inchiostro e restituisce le ANCORE per
 *  reinserire «\sqrt» nel LaTeX alla posizione giusta.
 *
 *  Perché (verificato nel browser, 26/9): il modello NON sa leggere il
 *  segno di radice — qualsiasi variante (V + barra separata, V con coda,
 *  tratto unico continuo, V sintetica pulita, con o senza radicando,
 *  radicando vicino o lontano) produce SOLO «v»/«\sigma»/«\theta» e il
 *  RADICANDO viene SEMPRE perso. Il radicando da solo invece lo legge
 *  perfettamente. Quindi: si tolgono V e barra dall'inchiostro, il modello
 *  legge il radicando («9»), e «\sqrt» viene reinserito nel LaTeX alla
 *  posizione proporzionale del segno (stessa tecnica degli esponenti in
 *  supScript.ts). La pagina e `normalizeInput` convertono già «\sqrt9» in
 *  «√9».
 *
 *  Per NON scambiare una vera lettera «v» per una radice serve la PROVA
 *  DEL VINCULUM: una barra sopra (tratto a sé vicino all'apice, con del
 *  contenuto sotto) oppure la coda orizzontale nello stesso tratto. Una
 *  «v» senza barra resta nell'inchiostro (il modello la legge bene). */
export function rewriteRadicalSigns(strokes: SimpleStroke[]): RadicalRewrite {
  const boxes = strokes.map((s) => bboxOf([s]));
  const checks: number[] = [];
  for (let i = 0; i < strokes.length; i++) {
    if (isCheckmark(strokes[i]!, boxes[i]!)) checks.push(i);
  }
  if (checks.length === 0) return { strokes, radicals: 0, anchors: [], centers: [] };

  const removed = new Set<number>();
  const radCenterX: number[] = [];
  let radicals = 0;

  for (const ci of checks) {
    const apexX = strokes[ci]!.points[strokes[ci]!.points.length - 1]!.x;
    const apexY = strokes[ci]!.points[strokes[ci]!.points.length - 1]!.y;
    const cb = boxes[ci]!;

    // PROVA 1 — vinculum NELLO STESSO tratto: coda finale orizzontale lunga
    // (si cammina all'indietro dall'ultimo punto finché il tratto resta piatto)
    const pts = strokes[ci]!.points;
    // ⚠️ (5/10 notte) la coda deve essere davvero ORIZZONTALE: oltre al passo (|dy| ≤ 7) conta
    // l'ESCURSIONE verticale totale della coda (≤ RAD_TAIL_YSPAN) e il verso a destra. Prima bastava che ogni passo
    // fosse ripido ≤ 7 e si sommava |dx| su QUALSIASI curva: il pancino della «b» (arco che
    // risale e rientra) faceva 18+ px di «coda» ed era TOLTO come radice (`(a+b)(a-b)` → `(a-1\\sqrt)`).
    let tail = 0;
    let tYMin = pts[pts.length - 1]!.y;
    let tYMax = tYMin;
    for (let k = pts.length - 1; k > 0; k--) {
      const y = pts[k - 1]!.y;
      if (Math.abs(pts[k]!.y - y) > 7) break;
      const nMin = Math.min(tYMin, y);
      const nMax = Math.max(tYMax, y);
      if (nMax - nMin > RAD_TAIL_YSPAN) break;
      // …e deve procedere verso DESTRA nel verso del gesto: la parte alta del pancino di una
      // «b/p/d» rientra verso sinistra (x che CALA) ed è piatta solo per ~20 px
      const dx = pts[k]!.x - pts[k - 1]!.x;
      if (dx < -3) break;
      tYMin = nMin;
      tYMax = nMax;
      tail += Math.max(0, dx);
    }
    if (tail >= RAD_TAIL_MIN) {
      removed.add(ci);
      radCenterX.push((cb.x0 + cb.x1) / 2);
      radicals++;
      continue;
    }

    // PROVA 2 — vinculum SEPARATO: barra orizzontale con l'estremo SINISTRO
    // vicino all'apice della V e del contenuto SOTTO
    let hasBar = false;
    for (let j = 0; j < strokes.length; j++) {
      if (j === ci || removed.has(j)) continue;
      const jb = boxes[j]!;
      if (jb.y1 - jb.y0 > RAD_H_MAX) continue;
      if (jb.x1 - jb.x0 < RAD_BAR_MIN_W) continue;
      if (Math.abs(jb.x0 - apexX) > RAD_APEX_TOL) continue;
      if (Math.abs((jb.y0 + jb.y1) / 2 - apexY) > RAD_APEX_YTOL) continue;
      // contenuto SOTTO la barra che la copre in orizzontale
      let contentBelow = false;
      for (let k = 0; k < strokes.length; k++) {
        if (k === ci || k === j || removed.has(k)) continue;
        if (boxes[k]!.y0 < jb.y1 - 2) continue; // non sta sotto
        if (boxes[k]!.x0 > jb.x1 - 0.25 * (jb.x1 - jb.x0)) continue;
        if (boxes[k]!.x1 < jb.x0 + 0.4 * (jb.x1 - jb.x0)) continue;
        contentBelow = true;
        break;
      }
      if (!contentBelow) continue;
      removed.add(j);
      hasBar = true;
      break;
    }
    if (!hasBar) continue; // niente barra = probabile lettera «v»: si lascia

    removed.add(ci);
    radCenterX.push((cb.x0 + cb.x1) / 2);
    radicals++;
  }

  if (radicals === 0) return { strokes, radicals: 0, anchors: [], centers: [] };

  // Ancore: frazione orizzontale del segno di radice rispetto all'inchiostro
  // RESTANTE (il modello vede solo quello, quindi la posizione nel LaTeX
  // si mappa su di esso)
  const kept = strokes.filter((_, i) => !removed.has(i));
  let minX = Infinity;
  let maxX = -Infinity;
  for (const s of kept) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
  }
  const anchors = radCenterX.map((x) =>
    !isFinite(minX) || maxX <= minX || x <= minX ? 0 : Math.min(1, (x - minX) / (maxX - minX)),
  );
  return { strokes: kept, radicals, anchors, centers: radCenterX };
}

// ─── FRAZIONE IMPILATA: ESTRAZIONE GEOMETRICA (riconoscimento affidabile) ──
// Problema (segnalazione 27/9: «il riconoscimento dei numeri e in
// particolare delle frazioni è ancora terribile»): il risultato si scrive
// come frazione impilata (numeratore, linea, denominatore) e il modello
// riceve TUTTO l'inchiostro insieme — ma CoMER non sa leggere la struttura
// impilata: legge «7-5», «\frac{\infty}{m/m}», cifre sbagliate, segni spurii.
// Soluzione: LA STESSA TECNICA già usata per apici, √, 8, = e −. La LINEA
// della frazione si individua GEOMETRICAMENTE (barra piatta con cifre sopra
// e sotto), numeratore e denominatore vengono TOLTI dall'inchiostro,
// riconosciuti A PARTE in modalità «numero» (dove cifre e lettere da sole
// le legge bene) e «\frac{n}{d}» viene REINSERITO nel LaTeX alla posizione
// proporzionale (ancora, come per \sqrt e «8»).

export interface StackedFraction {
  /** Tratto della linea di frazione (serve al fallback col modello) */
  lineStrokes: SimpleStroke[];
  /** Tratti del numeratore (ordinati da sinistra a destra) */
  numStrokes: SimpleStroke[];
  /** Tratti del denominatore (ordinati da sinistra a destra) */
  denStrokes: SimpleStroke[];
  /** Numeratore INGRANDITO per il riconoscimento in modalità «numero» */
  numScaled: SimpleStroke[];
  /** Denominatore INGRANDITO per il riconoscimento in modalità «numero» */
  denScaled: SimpleStroke[];
  /** Centro x della linea di frazione (per l'ancora di reinserimento) */
  cx: number;
}

export interface FracRewrite {
  /** Inchiostro SENZA le frazioni estratte (il modello vede solo questo) */
  strokes: SimpleStroke[];
  fracs: StackedFraction[];
}

export function rewriteStackedFractions(strokes: SimpleStroke[]): FracRewrite {
  if (strokes.length < 3) return { strokes, fracs: [] };
  const boxes = strokes.map((s) => bboxOf([s]));
  const removed = new Set<number>();
  const fracs: StackedFraction[] = [];

  // Altezza mediana dei tratti (per l'ingrandimento, come per gli apici)
  const heights = strokes
    .map((_, i) => boxes[i]!.y1 - boxes[i]!.y0)
    .filter((h) => h > 1)
    .sort((a, b) => a - b);
  const med = heights.length > 0 ? heights[Math.floor(heights.length / 2)]! : 60;

  // Linee di frazione candidate, da sinistra a destra: barra piatta con
  // ALMENO un tratto «da cifra» SOPRA e uno SOTTO, sovrapposti in
  // orizzontale alla barra (la firma è la stessa della guardia anti-meno).
  const lineIdx: number[] = [];
  for (let i = 0; i < strokes.length; i++) {
    const b = boxes[i]!;
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    if (w <= 1.6 * Math.max(h, 1)) continue; // non è una barra piatta
    const cy = (b.y0 + b.y1) / 2;
    let sopra = false;
    let sotto = false;
    for (let k = 0; k < strokes.length; k++) {
      if (k === i) continue;
      const o = boxes[k]!;
      if (o.y1 - o.y0 < 3 * Math.max(h, 1)) continue; // solo tratti «da cifra»
      // tratti degeneri (verticale perfetto: larghezza 0): il loro CENTRO
      // dentro la campata della linea conta come sovrapposizione
      const ocxD = (o.x0 + o.x1) / 2;
      const withinD = ocxD >= b.x0 && ocxD <= b.x1;
      const ov = Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0);
      if (!withinD && ov < 0.3 * w) continue;
      if (o.y1 <= cy) sopra = true;
      else if (o.y0 >= cy) sotto = true;
    }
    if (sopra && sotto) lineIdx.push(i);
  }
  lineIdx.sort((a, b) => boxes[a]!.x0 - boxes[b]!.x0);

  for (const li of lineIdx) {
    if (removed.has(li)) continue;
    const b = boxes[li]!;
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    const cy = (b.y0 + b.y1) / 2;
    // ⚠️ Assegnazione per POSIZIONE, non per altezza del tratto: i tratti
    // ORIZZONTALI di una cifra (la barra alta del «5», la barra del «7»)
    // hanno un bbox piatto (h≈0) e con il criterio «tratto alto» restavano
    // nell'inchiostro principale → il modello li leggeva «-r» accanto alla
    // frazione estratta. Serve solo che il tratto stia SOPRA o SOTTO il
    // CENTRO della linea e si sovrapponga in orizzontale.
    const numIdx: number[] = [];
    const denIdx: number[] = [];
    // ⚠️ PARENTESI VICINO ALLA FRAZIONE (segnalazione 19/10): un tratto MOLTO
    // più alto dei tratti della frazione (una parentesi che abbraccia o tocca
    // la frazione: ~2× il numeratore) NON è numeratore né denominatore — con
    // l'assegnazione per posizione finiva DENTRO la frazione, la lettura in
    // modalità «numero» falliva e si perdeva TUTTO il pezzo. Riferimento = il
    // tratto «da cifra» più alto con il centro DENTRO la campata della linea
    // (le parentesi stanno ai lati: centro fuori). Una parentesi stretta viene
    // scartata già a 1,1× il riferimento (le cifre sono larghe ~il loro alto).
    let digitRefH = 0;
    for (let k = 0; k < strokes.length; k++) {
      if (k === li || removed.has(k)) continue;
      const o = boxes[k]!;
      const oh2 = o.y1 - o.y0;
      if (oh2 < 3 * Math.max(h, 1)) continue;
      const ocx2 = (o.x0 + o.x1) / 2;
      if (ocx2 >= b.x0 - 0.1 * w && ocx2 <= b.x1 + 0.1 * w) digitRefH = Math.max(digitRefH, oh2);
    }
    const isBracketLike = (ow2: number, oh2: number): boolean => {
      if (digitRefH <= 0) return false;
      return oh2 > 1.25 * digitRefH || (ow2 <= 0.4 * oh2 && oh2 > 1.1 * digitRefH);
    };
    for (let k = 0; k < strokes.length; k++) {
      if (k === li || removed.has(k)) continue;
      const o = boxes[k]!;
      const ow = o.x1 - o.x0;
      const oh = o.y1 - o.y0;
      if (isBracketLike(ow, oh)) continue;
      // una barra piatta sovrapposta alla BANDA della linea è un ripasso
      // della linea stessa (tratto ripassato): non è né sopra né sotto
      if (ow > 2 * Math.max(oh, 1)) {
        const vov = Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0);
        if (vov > 0.5 * Math.max(oh, 1)) continue;
      }
      // tratto degenere (verticale perfetto: larghezza 0, es. il tratto
      // verticale del «5»): senza questa guardia la sovrapposizione
      // orizzontale è 0 e il tratto RESTA nell'inchiostro principale →
      // il modello lo legge «1» accanto alla frazione («1\frac{75}{7}»)
      const ocx = (o.x0 + o.x1) / 2;
      const within = ocx >= b.x0 && ocx <= b.x1;
      const ov = Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0);
      if (!within && ov < 0.2 * w) continue;
      // ⚠️ classificazione per CENTRO del tratto: la pancia del «5» o la
      // coda di una cifra TOCCANO la linea e con la tolleranza sull'altezza
      // della linea (poche px) restavano nell'inchiostro principale → il
      // modello produceva prefissi spurii («1\frac{75}{7}»). Il centro del
      // tratto sopra/sotto il centro della linea decide senza casi limite.
      const ocy = (o.y0 + o.y1) / 2;
      if (ocy <= cy) numIdx.push(k);
      else denIdx.push(k);
    }
    if (numIdx.length === 0 || denIdx.length === 0) continue;
    // La frazione si porta via numeratore, linea e denominatore
    numIdx.sort((a, b2) => boxes[a]!.x0 - boxes[b2]!.x0);
    denIdx.sort((a, b2) => boxes[a]!.x0 - boxes[b2]!.x0);
    const numStrokes = numIdx.map((i) => strokes[i]!);
    const denStrokes = denIdx.map((i) => strokes[i]!);
    // Ingrandimento per la modalità «numero» (stessa formula degli apici)
    const scaleGroup = (grp: SimpleStroke[], idxs: number[]): SimpleStroke[] => {
      const gb = bboxOf(grp);
      const gh = Math.max(1, gb.y1 - gb.y0);
      const scale = Math.min(5, Math.max(1.4, (med * 0.85) / gh));
      const cx0 = (gb.x0 + gb.x1) / 2;
      const cy0 = (gb.y0 + gb.y1) / 2;
      void idxs;
      return grp.map((s) => ({
        ...s,
        points: s.points.map((p) => ({
          x: cx0 + (p.x - cx0) * scale,
          y: cy0 + (p.y - cy0) * scale,
        })),
      }));
    };
    fracs.push({
      lineStrokes: [strokes[li]!],
      numStrokes,
      denStrokes,
      numScaled: scaleGroup(numStrokes, numIdx),
      denScaled: scaleGroup(denStrokes, denIdx),
      cx: (b.x0 + b.x1) / 2,
    });
    removed.add(li);
    for (const i of numIdx) removed.add(i);
    for (const i of denIdx) removed.add(i);
  }

  if (fracs.length === 0) return { strokes, fracs: [] };
  return { strokes: strokes.filter((_, i) => !removed.has(i)), fracs };
}

// ─── CIFRE DA LATEX IN MODALITÀ «NUMERO» ────────────────────────────
// In modalità «numero» il pezzo PUÒ essere solo un numero, ma il modello
// scambia le cifre con omonimi letterari («9»→g/q, «0»→o/O, «1»→l/I/i,
// «5»→s/S, «2»→z/Z, «8»→B/\infty, «6»→b). Mappo gli omonimi e filtro le
// cifre: fuori da questa modalità NON usare questa funzione (in un'espressione
// le lettere sono variabili legittime).
const NUM_HOMONYMS: [RegExp, string][] = [
  [/[gGqQ]/g, "9"],
  [/[oO]/g, "0"],
  [/[lIi|!]/g, "1"],
  [/[sS]/g, "5"],
  [/[zZ]/g, "2"],
  [/B/g, "8"],
  [/[b]/g, "6"],
];

export function digitsFromNumberLatex(latex: string): string {
  let s = latex;
  // Comandi LaTeX NOTI prima (\infty sembra un 8, non uno 0!)
  s = s.replace(/\\operatorname\{[gq]\}/g, "9");
  s = s.replace(/\\gamma|\\Gamma/g, "9");
  s = s.replace(/\\infty/g, "8");
  s = s.replace(/\\theta|\\Theta/g, "0");
  s = s.replace(/\\circ|\\bigcirc/g, "0");
  s = s.replace(/\\ell/g, "1");
  // Gli ALTRI comandi LaTeX diventano un segnaposto: senza, la «l» di
  // «\alpha» verrebbe mappata come cifra 1!
  s = s.replace(/\\[a-zA-Z]+/g, "\u0000");
  for (const [re, digit] of NUM_HOMONYMS) s = s.replace(re, digit);
  return s.replace(/[^0-9]/g, "");
}
