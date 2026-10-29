// ─── Parentesi QUADRE: recupero geometrico (riconoscimento a mano) ──
//
// Il modello CoMER HA i token [ e ] nel vocabolario, ma una quadra
// disegnata a mano viene spesso letta come tonda (segnalazione 26/9:
// «[-(3²:3)+1] : [-(2·2³)-2]» riconosciuta con la seconda coppia di
// quadre diventata tonda). Le regole dell'app dicono che il TIPO di
// parentesi scritto dall'utente non si cambia mai (wrapParen mantiene
// quadre/graffe/tonde), quindi qui l'INCHIOSTRO fa da verità:
//
//   1. si individuano nell'inchiostro le shape ALTE (quadre e tonde):
//      un gruppo di tratti alto quasi quanto l'espressione;
//   2. una shape è una QUADRA se contiene un tratto VERTICALE (l'aste):
//      la maggior parte della sua altezza ha pendenza quasi nulla
//      (una tonda è curva: la pendenza cresce verso le estremità);
//   3. il lato (aperta/chiuse) si deduce dai tick orizzontali (se
//      separati) o dalle estremità del tratto (se la quadra è un solo
//      tratto: per [ partono a destra dell'aste, per ] a sinistra);
//   4. le shape (in ordine di x) si allineano con le parentesi del
//      testo riconosciuto (in ordine di comparsa): se i conteggi
//      coincidono, quelle disegnate quadre diventano [ ] nel testo.
//      Se i conteggi NON coincidono (il modello ha perso/aggiunto
//      parentesi) non si tocca nulla — mai trasformazioni a caso.

import type { SimpleStroke } from "./dotSigns";
import { classifyProfile, curlyTip, digitLike, hooklessRound, profileOf, smoothArc } from "./bracketProfile";

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Soglie (canvas ~150–170 px, cifra ~60 px)
const GROUP_GAP = 12; // gap max tra tratti della stessa shape
const TALL_FRAC = 0.68; // shape alta ≥ 68% dell'altezza dell'espressione
const SHAFT_SLOPE = 0.25; // |dx/dy| ≤ 0.25 → tratto "verticale"
const SHAFT_FRAC = 0.5; // ≥ 50% dell'altezza con pendenza nulla → aste
const SHAFT_MAX_W = 0.3; // aste: larghezza ≤ 30% della sua altezza
const SIDE_MIN = 2.5; // px: differenza minima per decidere il lato

function bboxOf(points: { x: number; y: number }[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/** (20/10) Tratti della STRUTTURA FRAZIONE (linea + tratti sopra + sotto):
 *  barra piatta (w > 1,6·h) con tratti «da cifra» (≥ 3·h) sopra e sotto,
 *  sovrapposti in orizzontale — stessa firma di rewriteStackedFractions
 *  (inkSigns.ts). Serve a escludere la frazione dal riferimento d'altezza
 *  delle parentesi (v. shapeCandidatesCore). */
function fractionStructureIdx(strokes: SimpleStroke[], boxes: Box[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < strokes.length; i++) {
    const b = boxes[i]!;
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    if (w <= 1.6 * Math.max(h, 1)) continue;
    const cy = (b.y0 + b.y1) / 2;
    const sopra: number[] = [];
    const sotto: number[] = [];
    for (let k = 0; k < strokes.length; k++) {
      if (k === i) continue;
      const o = boxes[k]!;
      if (o.y1 - o.y0 < 3 * Math.max(h, 1)) continue;
      const ocxD = (o.x0 + o.x1) / 2;
      const withinD = ocxD >= b.x0 && ocxD <= b.x1;
      const ov = Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0);
      if (!withinD && ov < 0.3 * w) continue;
      if (o.y1 <= cy) sopra.push(k);
      else if (o.y0 >= cy) sotto.push(k);
    }
    if (sopra.length > 0 && sotto.length > 0) {
      out.add(i);
      for (const k of sopra) out.add(k);
      for (const k of sotto) out.add(k);
    }
  }
  return out;
}

function boxesOverlap(a: Box, b: Box, gap: number): boolean {
  return (
    a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1
  );
}

/** Raggruppa i tratti in shape (union-find con gap GROUP_GAP) */
function groupStrokes(strokes: SimpleStroke[], boxes: Box[]): number[][] {
  const parent = strokes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < strokes.length; i++) {
    for (let j = i + 1; j < strokes.length; j++) {
      if (boxesOverlap(boxes[i]!, boxes[j]!, GROUP_GAP)) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[b] = a;
      }
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < strokes.length; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }
  return [...groups.values()];
}

/** Quanta parte del tratto (in altezza) è "verticale" (pendenza ~nulla) */
function verticalFraction(points: { x: number; y: number }[]): number {
  const sorted = [...points].sort((a, b) => a.y - b.y);
  let totalDy = 0;
  let straightDy = 0;
  for (let i = 1; i < sorted.length; i++) {
    const dy = sorted[i]!.y - sorted[i - 1]!.y;
    if (dy <= 0.5) continue; // segmenti orizzontali (tick): ignorati
    const dx = Math.abs(sorted[i]!.x - sorted[i - 1]!.x);
    totalDy += dy;
    if (dx / dy <= SHAFT_SLOPE) straightDy += dy;
  }
  if (totalDy < 10) return 0;
  return straightDy / totalDy;
}

/** x del tratto all'altezza y (interpolazione lungo la polilinea) */
function xAtY(points: { x: number; y: number }[], y: number): number | null {
  const sorted = [...points].sort((a, b) => a.y - b.y);
  if (sorted.length === 0) return null;
  if (y <= sorted[0]!.y) return sorted[0]!.x;
  const last = sorted[sorted.length - 1]!;
  if (y >= last.y) return last.x;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.y >= y) {
      const a = sorted[i - 1]!;
      const b = sorted[i]!;
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return a.x + t * (b.x - a.x);
    }
  }
  return null;
}

/** media x dei punti nella banda verticale [t0, t1] dell'ingombro; se la
 *  banda è vuota (tratti con pochi punti), interpola al centro banda */
function bandMeanX(points: { x: number; y: number }[], box: Box, t0: number, t1: number): number {
  const lo = box.y0 + t0 * (box.y1 - box.y0);
  const hi = box.y0 + t1 * (box.y1 - box.y0);
  let sum = 0;
  let n = 0;
  for (const p of points) {
    if (p.y >= lo && p.y <= hi) {
      sum += p.x;
      n++;
    }
  }
  if (n > 0) return sum / n;
  return xAtY(points, (lo + hi) / 2) ?? NaN;
}

export type BracketKind = "square" | "round" | "curly";

interface ShapeClass {
  isOpen: boolean;
  kind: BracketKind;
  x0: number;
  /** Firma: strong = inequivocabile (graffa; quadra con tick a ENTRAMBE
   *  le estremità o a un tratto con entrambe le estremità deviate dalla
   *  stessa parte), weak = dubbia (quadra multi-tratto con UN tick solo:
   *  anche un «1» con flag+piede può somigliarli). La soglia di altezza
   *  per l'estrazione dipende dalla firma (vedi rewriteBrackets). */
  strength: "strong" | "weak";
}

/** Caso B — GOMITO della graffa (5/10): distanza della x dal livello della
 *  punta a una banda di distanza (0,34–0,44 e 0,56–0,66 dell'altezza). Una
 *  graffa ha due archi che si incontrano AD ANGOLO alla punta: la x si
 *  stacca presto (2–11 px). Una tonda è un arco liscio con derivazione
 *  nulla alla punta: la x resta attaccata (~0,3–0,8 px). */
function angularKink(
  pts: { x: number; y: number }[],
  box: Box,
  midX: number,
): number {
  return (
    (Math.abs(bandMeanX(pts, box, 0.34, 0.44) - midX) +
      Math.abs(bandMeanX(pts, box, 0.56, 0.66) - midX)) /
    2
  );
}

/** PUNTA IN ECCESSO (5/10 sera). Una tonda è, per il profilo x(y), un arco liscio:
 *  una parabola x = c0 + c1·t + c2·t² la spiega quasi tutta. Una graffa (o il suo
 *  zigzag «<») ha invece una PUNTA localizzata che sporge oltre il miglior fit
 *  parabolico. Misura (adimensionale, ≈0 per un arco liscio, >0,1 per una punta):
 *  (x reale al centro − x del fit al centro) / punta, con segno positivo se la x
 *  reale sporge PIÙ del fit verso il lato della punta. Più robusta del solo
 *  «kink» in pixel, che dipende da tremolio e profondità dell'arco. */
function tipExcess(pts: { x: number; y: number }[], box: Box, midX: number): number {
  const gh = box.y1 - box.y0;
  if (pts.length < 4 || gh <= 0) return 0;
  // densifica (passo ≈ gh/60) senza unire salti fra tratti lontani
  const dense: { t: number; x: number }[] = [];
  const step = gh / 60;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    dense.push({ t: (a.y - box.y0) / gh, x: a.x });
    const b = pts[i + 1];
    if (!b) break;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d > step && d <= 0.25 * gh) {
      const n = Math.floor(d / step);
      for (let k = 1; k <= n; k++) {
        const f = k / (n + 1);
        dense.push({ t: (a.y + (b.y - a.y) * f - box.y0) / gh, x: a.x + (b.x - a.x) * f });
      }
    }
  }
  // minimi quadrati x = c0 + c1 t + c2 t²
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, r0 = 0, r1 = 0, r2 = 0;
  for (const d of dense) {
    const t = d.t, t2 = t * t;
    s0 += 1; s1 += t; s2 += t2; s3 += t2 * t; s4 += t2 * t2;
    r0 += d.x; r1 += d.x * t; r2 += d.x * t2;
  }
  const det =
    s0 * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s3 * s2) + s2 * (s1 * s3 - s2 * s2);
  if (Math.abs(det) < 1e-9) return 0;
  const c0 = (r0 * (s2 * s4 - s3 * s3) - s1 * (r1 * s4 - s3 * r2) + s2 * (r1 * s3 - s2 * r2)) / det;
  const c1 = (s0 * (r1 * s4 - s3 * r2) - r0 * (s1 * s4 - s3 * s2) + s2 * (s1 * r2 - r1 * s2)) / det;
  const c2 = (s0 * (s2 * r2 - r1 * s3) - s1 * (s1 * r2 - r1 * s2) + r0 * (s1 * s3 - s2 * s2)) / det;
  const fitMid = c0 + c1 * 0.5 + c2 * 0.25;
  // estremità (x del fit a t=0 e t=1 = c0, c0+c1+c2): la punta è midX − estremità
  const fitEnds = (c0 + (c0 + c1 + c2)) / 2;
  const spike = midX - fitEnds;
  if (Math.abs(spike) < 1e-6) return 0;
  return (midX - fitMid) / spike;
}

/** CASO B — la punta è quella di una GRAFFA? (5/10 sera, calibrata sul banco).
 *  Il solo «kink ≥ max(1 px, 8% punta)» prendeva per graffa il 48% delle tonde
 *  scritte col tremolio che arrivano a questo ramo (e la restore le riscriveva «{»).
 *  Servono DUE prove indipendenti: kink/punta ≥ 0,25 (il gomito si stacca subito
 *  dalla punta) E punta in eccesso ≥ 0,10 rispetto al miglior fit parabolico.
 *  Banco (lib/bench/kinkStats.test.ts): 0 falsi positivi su 261 tonde; 87% delle
 *  477 graffe e 100% della variante «estremità all'estremo». Uno zigzag «<» a 5
 *  punti ha kink/punta 0,13–0,22 e punta in eccesso ≈ 0,07: statisticamente
 *  identico a una tonda, e come tale resta tonda. */
function isBraceTip(
  pts: { x: number; y: number }[],
  box: Box,
  midX: number,
  spike: number,
): boolean {
  const sp = Math.abs(spike);
  if (sp < 1e-6) return false;
  return angularKink(pts, box, midX) / sp >= 0.25 && tipExcess(pts, box, midX) >= 0.1;
}

/** ⚠️ 6/10 — RAFFINAMENTO COL PROFILO DELLA CORDA (bracketProfile.ts).
 *  Il classificatore storico confronta fasce della x con la x del centro e
 *  non è invariante alla pendenza: sul banco di prova (scrittura sintetica,
 *  lib/bench/) una «2» isolata risultava «}» nell'80% dei casi, una tonda
 *  profonda «graffa» nel 15%, una quadra inclinata «tonda» nel 28%. Il
 *  profilo misura la distanza dalla CORDA (invariante a pendenza e scala):
 *  (1) VETO cifra — chiusa/cappio, incrocio, larga, profilo asimmetrico o
 *  ondulato → mai una parentesi; (2) il TIPO (tonda/quadra/graffa) e il
 *  verso si prendono dal profilo quando il legacy è in disaccordo;
 *  (3) un gruppo che il legacy lascia senza classe ma il profilo riconosce
 *  con sicurezza diventa candidato DEBOLE (soglia di altezza più severa). */
/** Barra «da E»: tratto extra orizzontale, a metà altezza della spina, che ne
 *  sovrappone la x e si estende a destra (la barra centrale di una «E» alta). Una
 *  cifra o un segno VICINO (fuso nel gruppo solo perché il gap è piccolo) non lo è. */
function looksLikeEBar(i: number, strokes: SimpleStroke[], gb: Box): boolean {
  const b = bboxOf(strokes[i]!.points);
  const gh = gb.y1 - gb.y0;
  const w = b.x1 - b.x0;
  const h = Math.max(1, b.y1 - b.y0);
  const cy = (b.y0 + b.y1) / 2;
  return (
    w >= 1.5 * h &&
    cy > gb.y0 + 0.2 * gh &&
    cy < gb.y1 - 0.2 * gh &&
    // la barra PARTE dalla spina (gb = ingombro della spina, senza i tick) e si
    // estende a destra; un segno dopo la quadra parte oltre i tick
    b.x0 <= gb.x1 + 0.03 * gh &&
    b.x0 >= gb.x0 - 0.1 * gh &&
    b.x1 >= gb.x1 + 0.08 * gh
  );
}

function refineWithProfile(
  legacy: ShapeClass | null,
  innerIdxs: number[],
  strokes: SimpleStroke[],
  gb: Box,
  groupIdxs?: number[],
): ShapeClass | null {
  // I null del legacy sono spesso GUARDIE volute («E» alta, «3» alta, asta
  // nuda, quadra con UN tick solo = forse un «1» con flag). Il profilo può
  // quindi PROMUOVERE un null solo a QUADRA inequivocabile: almeno due angoli
  // netti o tick orizzontali separati, nessun tratto extra nel gruppo (la
  // barra centrale di una «E» sarebbe un extra), stretta e non ondulata.
  if (!legacy) {
    // 5/10 sera: prima OGNI tratto extra bloccava la promozione → una quadra a
    // contatto con una cifra («2[2») restava non rilevata nel 42% dei casi.
    // Ora blocca solo una barra «da E» (looksLikeEBar); le cifre vicine no.
    if (groupIdxs && groupIdxs.some((i) => !innerIdxs.includes(i) && looksLikeEBar(i, strokes, gb))) return null;
    const pr = profileOf(innerIdxs.map((i) => strokes[i]!));
    if (!pr || digitLike(pr)) return null;
    const pq = classifyProfile(pr);
    // (5/10 notte) anche la quadra «morbida» (conf 0,8: salita rapida + punte larghe, nessun angolo
    // netto) viene promossa — era il grosso dei `[` `]` persi del banco (9–20%)
    const softSquare = pr.rise <= 0.2 && pr.endWidth >= 0.12 && pr.g >= 0.65;
    // (24/10, banco H=38: `]` quasi-dritta di `5[2+1]` — profilo quadra conf 0,9 ma depth
    // 0,0349 contro soglia 0,035, mancata per 1/10000. Una quadra quasi-dritta ha per natura
    // profondità minima: la soglia scende a 0,03, restano aspect/flat/rise a escludere le cifre.)
    if (
      pq?.kind === "square" &&
      (pq.conf >= 0.9 || softSquare) &&
      pr.aspect <= 0.34 &&
      pr.flat <= 0.7 &&
      pr.depth >= 0.03
    ) {
      return { isOpen: pq.isOpen, kind: "square", x0: gb.x0, strength: "weak" };
    }
    return null;
  }
  // (l'incrocio si valuta sui soli tratti INTERNI: il gruppo contiene anche i
  // vicini fusi — cifre accanto — che non devono far scartare la parentesi)
  void groupIdxs;
  const prof = profileOf(innerIdxs.map((i) => strokes[i]!));
  if (!prof) return legacy;
  const pc = classifyProfile(prof);
  // 1) VETO cifra — ECCETTO per una QUADRA FORTE multi-tratto (asta + ≥ 2 tick sullo stesso lato
  //    a entrambe le estremità): i tick che attraversano l'asta fanno scattare `cross` e il
  //    profilo unito la scambia per cifra (5/10 notte, banco P1: la `]` in tre tratti di `]]`
  //    non veniva mai estratta). I tick simmetrici di una «I»/«1» col piede sono già scartati
  //    dal legacy (tickX − shaftX ≈ 0).
  //    Solo se il veto nasce dall'INCROCIO (`crossing`): una `)` + due tick lontani NON è una quadra.
  const strongMultiSquare =
    legacy.kind === "square" && legacy.strength === "strong" && innerIdxs.length >= 3 && prof.crossing;
  if (digitLike(prof) && !strongMultiSquare) return null;
  const tip = curlyTip(prof);
  // 2) RITIPAGGIO — asimmetrico: il legacy è tarato su disegni reali (graffe
  //    «a 3» rovesciata, quadre a un tick…) quindi lo si contraddice solo
  //    davanti a un'evidenza netta del profilo
  if (legacy.kind === "curly") {
    // arco liscio, senza punta né angoli → era una TONDA profonda
    if (smoothArc(prof)) return { isOpen: prof.open, kind: "round", x0: gb.x0, strength: "weak" };
    // (6/10) tonda «a punta» (poco profonda e tremolante: cifre piccole, pixel interi) scambiata per
    // graffa FORTE e poi tolta dall'inchiostro e reinserita come «}»: senza uncini alle estremità, senza
    // angoli e stretta non è una graffa (vedi hooklessRound: 0 graffe vere perse sul banco).
    if (hooklessRound(prof)) return { isOpen: prof.open, kind: "round", x0: gb.x0, strength: "weak" };
    return legacy;
  }
  if (legacy.kind === "round") {
    if (tip && pc?.kind === "curly" && !hooklessRound(prof)) return { isOpen: pc.isOpen, kind: "curly", x0: gb.x0, strength: "strong" };
    if (pc?.kind === "square" && pc.conf >= 0.8 && !tip) {
      return { isOpen: pc.isOpen, kind: "square", x0: gb.x0, strength: pc.conf >= 0.9 ? "strong" : "weak" };
    }
    return legacy;
  }
  // legacy quadra: si tiene (ha le guardie su asta+tick); solo la punta netta la fa graffa
  if (tip && pc?.kind === "curly" && prof.corners === 0 && !hooklessRound(prof)) {
    return { isOpen: pc.isOpen, kind: "curly", x0: gb.x0, strength: "strong" };
  }
  // ⚠️ TONDA stretta «schiacciata» scambiata dal legacy per quadra FORTE (5/10 notte: `(2+3)` →
  // `(2+3]`): nessun angolo, nessun tick (endWidth < 0,08) e il profilo dice arco → tonda debole.
  // Con UN angolo ma curvatura NETTA (depth ≥ 0,1: la quadra vera ha il fianco retto, depth ~0,06)
  // e profilo «tonda» a conf ≥ 0,8 vale lo stesso (5/10 notte, P1: `))` → la prima `)` era `]`).
  if (
    pc?.kind === "round" &&
    !prof.hTick &&
    prof.endWidth < 0.08 &&
    (prof.corners === 0 || (prof.corners === 1 && prof.depth >= 0.1 && pc.conf >= 0.8))
  ) {
    return { isOpen: pc.isOpen, kind: "round", x0: gb.x0, strength: "weak" };
  }
  return legacy;
}

function classifyFromGroup(
  innerIdxs: number[],
  strokes: SimpleStroke[],
  boxes: Box[],
  gb: Box,
  groupIdxs?: number[],
  forceProfile = false,
): ShapeClass | null {
  return refineWithProfile(
    classifyFromGroupLegacy(innerIdxs, strokes, boxes, gb, groupIdxs, forceProfile),
    innerIdxs,
    strokes,
    gb,
    groupIdxs,
  );
}

/** Classifica una shape (gruppo di tratti) dato il suo ingombro gb e i
 *  tratti candidati "interni" (per le quadre multi-tratto: aste + tick). */
function classifyFromGroupLegacy(
  innerIdxs: number[],
  strokes: SimpleStroke[],
  boxes: Box[],
  gb: Box,
  /** TUTTO il gruppo di tratti (non solo l'unità assorbita): la guardia
   *  anti-«E» deve vedere anche i tratti NON assorbiti — es. la barra
   *  centrale di una E, che non è un tick né in alto né in basso. */
  groupIdxs?: number[],
  /** Salta la ricerca dell'asta e va DIRETTO al profilo x(y): serve nel
   *  fallback su unità intere il cui risultato per-spina è già fallito —
   *  una GRAFFA IN DUE METÀ ha metà con frazione verticale alta (il tratto
   *  dritto verso la punta) e senza il flag l'asta «ruba» sempre il
   *  percorso, condannando il profilo unito a non essere mai provato
   *  (rip. unit: graffa in due tratti → mai estratta → il modello legge
   *  «\sum»). */
  forceProfile = false,
): ShapeClass | null {
  const gh = gb.y1 - gb.y0;
  if (gh < 20) return null;

  // cerca l'ASTE: un tratto prevalentemente verticale e stretto
  let shaft = -1;
  if (!forceProfile) {
    for (const i of innerIdxs) {
      const sw = boxes[i]!.x1 - boxes[i]!.x0;
      const sh = boxes[i]!.y1 - boxes[i]!.y0;
      if (verticalFraction(strokes[i]!.points) >= SHAFT_FRAC && sw <= SHAFT_MAX_W * sh) {
        shaft = i;
        break;
      }
    }
  }

  if (shaft === -1) {
    // nessuna aste → tonda o GRAFFA: il profilo x(y) decide.
    // GRAFFA (27/9: «il riconoscimento ha difficoltà con le graffe»): due
    // RIGONFIAMENTI che sporgono OLTRE le estremità e una PUNTA centrale
    // che sporge dal lato OPPOSTO. Firma che né una tonda (profilo
    // monotono: i rigonfiamenti stanno fra estremità e punta) né una «3»
    // (le estremità stanno dal STESSO lato della punta centrale) posseggono.
    const pts = innerIdxs.flatMap((i) => strokes[i]!.points);
    const endX =
      (bandMeanX(pts, gb, 0, 0.12) + bandMeanX(pts, gb, 0.88, 1)) / 2;
    const midX = bandMeanX(pts, gb, 0.44, 0.56);
    const bulgeX =
      (bandMeanX(pts, gb, 0.18, 0.32) + bandMeanX(pts, gb, 0.68, 0.82)) / 2;
    if (!isFinite(endX) || !isFinite(midX) || !isFinite(bulgeX)) return null;
    const margin = Math.max(SIDE_MIN, 0.04 * gh);
    const spike = midX - endX; // punta oltre le estremità («{»: negativa)
    const bulge = bulgeX - endX; // rigonfiamenti oltre le estremità
    // ⚠️ la punta di una graffa sporge ALMENO quanto i rigonfiamenti (60%):
    // una «3» ha l'incavo centrale molto più timido dei suoi archi.
    if (
      Math.abs(spike) > margin &&
      Math.abs(bulge) > margin &&
      spike * bulge < 0 &&
      Math.abs(spike) >= 0.6 * Math.abs(bulge)
    ) {
      return { isOpen: spike < 0, kind: "curly", x0: gb.x0, strength: "strong" };
    }
    // ⚠️ CASO B — GRAFFA CON ESTREMITÀ SULL'ESTREMO (5/10: «la graffa
    // disegnata viene spesso riconosciuta come SUM»): chi disegna la graffa
    // SENZA l'arricciatura finale ha estremità al punto più largo: il
    // rigonfiamento NON sporge oltre le estremità (bulge ≈ 0 o dallo stesso
    // lato della punta) e il profilo coincide con quello di una TONDA → la
    // graffa resta nell'inchiostro e il modello la legge «\sum» (rip. unit:
    // canoniche con estremità all'estremo, a zigzag e in DUE tratti → tutte
    // NON estratte). Distinguere da tonda e «3»:
    //  - la «3» ha rigonfiamenti enormi rispetto all'incavo centrale
    //    (|bulge| ≤ 0,35×|spike| la esclude);
    //  - la TONDA è un arco LISCIO: alla punta la derivazione è nulla (la x
    //    a una banda di distanza resta attaccata alla punta); la graffa ha
    //    un GOMITO (kink): i due archi si incontrano ad angolo e la x si
    //    stacca subito (rip.: arco ~0,1 px contro graffa ~3-11 px).
    if (
      Math.abs(spike) > margin &&
      // rigonfiamento: per una graffa resta DIETRO la punta (stesso lato,
      // ≤ 65% — un «2» ha il diagonale quasi lungo quanto la punta: 83%) o
      // è una timida arricciatura verso l'interno (≤ 35%, lato opposto).
      // Una «3» (rigonfiamenti opposti e enormi) resta esclusa.
      ((spike * bulge >= 0 && Math.abs(bulge) <= 0.65 * Math.abs(spike)) ||
        (spike * bulge < 0 && Math.abs(bulge) <= 0.35 * Math.abs(spike)))
    ) {
      const kink = angularKink(pts, gb, midX);
      if (isBraceTip(pts, gb, midX, spike)) {
        return { isOpen: spike < 0, kind: "curly", x0: gb.x0, strength: "strong" };
      }
    }
    if (endX - midX > SIDE_MIN)
      return { isOpen: true, kind: "round", x0: gb.x0, strength: "weak" };
    if (midX - endX > SIDE_MIN)
      return { isOpen: false, kind: "round", x0: gb.x0, strength: "weak" };
    return null;
  }

  const shaftBox = boxes[shaft]!;

  // GUARDIA anti-«E»: una lettera con barra centrale (E) ha un tick ANCHE a
  // metà altezza — una quadra no (solo tick in alto e in basso).
  // ⚠️ 5/10 («parentesi e numeri messi insieme»): la barra deve essere anche
  // ADIACENTE ALL'ASTA in orizzontale. Scrittura fitta: l'inchiostro si
  // incatena (GROUP_GAP 12) e la barra di un «+» o di un «=» finisce nello
  // STESSO gruppo della quadra; senza il controllo orizzontale la barra a
  // metà altezza, anche a 60 px di distanza, scartava la quadra VERA
  // (rip. unit: «3[2+1]» gap 0 → nessuna quadra estratta).
  const shaftX = (shaftBox.x0 + shaftBox.x1) / 2;
  const group = groupIdxs ?? innerIdxs;
  const midTick = group.some((i) => {
    if (i === shaft) return false;
    const tw = boxes[i]!.x1 - boxes[i]!.x0;
    const th = boxes[i]!.y1 - boxes[i]!.y0;
    if (tw > 0.6 * gh || th > 0.3 * gh) return false;
    const cx = (boxes[i]!.x0 + boxes[i]!.x1) / 2;
    if (Math.abs(cx - shaftX) > 0.45 * gh) return false;
    const cyT = (boxes[i]!.y0 + boxes[i]!.y1) / 2;
    if (!(cyT > shaftBox.y0 + 0.35 * gh && cyT < shaftBox.y1 - 0.35 * gh)) return false;
    // ⚠️ 5/10, parte 2 («parentesi e numeri messi insieme»): a scrittura
    // incollata la barra del «+» o del «=» finisce nel gruppo della quadra
    // ANCHE a pochi px dall'asta (rip. unit: barra a 8 px → quadra chiusa
    // scartata). Ma una barra di «+» ha una BARRA VERTICALE che la attraversa
    // al centro, e una barra di «=» ha una SECONDA BARRA PARALLELA: una
    // lettera E non ha nessuna delle due. Se il candidato ha un compagno
    // incrociato o parallelo NON è una barra di E → la quadra resta valida.
    const crossed = group.some((j) => {
      if (j === i || j === shaft) return false;
      const jw = boxes[j]!.x1 - boxes[j]!.x0;
      const jh = boxes[j]!.y1 - boxes[j]!.y0;
      if (jh <= jw) return false; // compagno verticale
      const jcx = (boxes[j]!.x0 + boxes[j]!.x1) / 2;
      const jcy = (boxes[j]!.y0 + boxes[j]!.y1) / 2;
      return Math.abs(jcx - cx) <= 0.12 * gh && Math.abs(jcy - cyT) <= 0.12 * gh;
    });
    if (crossed) return false;
    const parallel = group.some((j) => {
      if (j === i || j === shaft) return false;
      const jw = boxes[j]!.x1 - boxes[j]!.x0;
      const jh = boxes[j]!.y1 - boxes[j]!.y0;
      if (jh > jw) return false; // compagno orizzontale
      if (jw > 0.6 * gh || jh > 0.3 * gh) return false;
      const jcy = (boxes[j]!.y0 + boxes[j]!.y1) / 2;
      return Math.abs(jcy - cyT) <= 0.18 * gh;
    });
    return !parallel;
  });
  if (midTick) return null;

  // QUADRA: il lato dai tick orizzontali vicini alle estremità dell'aste…
  const tickIdxs = innerIdxs.filter((i) => {
    if (i === shaft) return false;
    const tw = boxes[i]!.x1 - boxes[i]!.x0;
    const th = boxes[i]!.y1 - boxes[i]!.y0;
    if (tw > 0.6 * gh || th > 0.3 * gh) return false; // troppo grande per un tick
    const cyT = (boxes[i]!.y0 + boxes[i]!.y1) / 2;
    const nearTop = cyT <= shaftBox.y0 + 0.25 * gh;
    const nearBottom = cyT >= shaftBox.y1 - 0.25 * gh;
    return nearTop || nearBottom;
  });
  if (tickIdxs.length > 0) {
    const tickX =
      tickIdxs.reduce((s, i) => s + (boxes[i]!.x0 + boxes[i]!.x1) / 2, 0) / tickIdxs.length;
    const shaftX = (shaftBox.x0 + shaftBox.x1) / 2;
    // firma FORTE solo se ci sono tick a ENTRAMBE le estremità: con un
    // tick solo anche un «1» con flag (o con piede) potrebbe somigliarli
    const nearTopOf = (i: number) =>
      (boxes[i]!.y0 + boxes[i]!.y1) / 2 <= shaftBox.y0 + 0.25 * gh;
    const nearBotOf = (i: number) =>
      (boxes[i]!.y0 + boxes[i]!.y1) / 2 >= shaftBox.y1 - 0.25 * gh;
    const bothEnds = tickIdxs.some(nearTopOf) && tickIdxs.some(nearBotOf);
    const strength = bothEnds ? "strong" : "weak";
    if (tickX - shaftX > SIDE_MIN) return { isOpen: true, kind: "square", x0: gb.x0, strength };
    if (shaftX - tickX > SIDE_MIN) return { isOpen: false, kind: "square", x0: gb.x0, strength };
    return null;
  }
  // …oppure, se la quadra è un solo tratto, dalle ESTREMITÀ: ENTRAMBE le
  // bande (alto e basso) devono spostarsi nella STESSA direzione rispetto
  // alla parte centrale dell'aste (un «1» con flag ha solo l'estremità
  // alta deviata → non è una quadra).
  const pts = strokes[shaft]!.points;
  const endTop = bandMeanX(pts, shaftBox, 0, 0.12);
  const endBot = bandMeanX(pts, shaftBox, 0.88, 1);
  const midX = bandMeanX(pts, shaftBox, 0.44, 0.56);
  if (!isFinite(endTop) || !isFinite(endBot) || !isFinite(midX)) return null;
  // GUARDIA anti-«0» boxy (4/10): uno «0» chiuso parte e arriva quasi allo
  // stesso punto; una quadra no (il tratto finisce al tick opposto, ma il
  // ciclo NON si richiude). Anche uno «0» disegnato a spigoli vivi resta
  // nell'inchiostro.
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (Math.hypot(last.x - first.x, last.y - first.y) <= 0.2 * gh) return null;
  const margin = Math.max(SIDE_MIN, 0.04 * gh);
  const devTop = endTop - midX;
  const devBot = endBot - midX;
  // GUARDIA anti-ARCO (5/10: «le tonde non le riconosce più, specialmente
  // vicino ad altre parentesi o numeri»): una tonda STRETTA (larghezza ≤ ~14
  // px, scritta stretta per far posto al contenuto) ha verticalFraction
  // alta → finisce QUI come «aste», e con ENTRAMBE le estremità deviate dal
  // STESSO lato passava la firma della QUADRA a un tratto: veniva estratta
  // e reinserita come «[»/«]» (sweep su 126 varianti disegnate: 46 falsi
  // positivi con w 8–14 e h 85–130). Una quadra VERA ha il fianco RETTO:
  // la x resta su midX fino quasi alle estremità (la deviazione è
  // concentrata nei tick); un arco devia GRADUALMENTE (a ~20% d'altezza è
  // già deviato oltre 1/3 della deviazione finale).
  const mid1 = bandMeanX(pts, shaftBox, 0.15, 0.25);
  const mid2 = bandMeanX(pts, shaftBox, 0.75, 0.85);
  const curved =
    (isFinite(mid1) && Math.sign(mid1 - midX) === Math.sign(devTop) &&
      Math.abs(mid1 - midX) > 0.35 * Math.abs(devTop)) ||
    (isFinite(mid2) && Math.sign(mid2 - midX) === Math.sign(devBot) &&
      Math.abs(mid2 - midX) > 0.35 * Math.abs(devBot));
  if (curved) {
    // ⚠️ CASO B prima di ribattezzare TONDA (5/10: «la graffa disegnata
    // viene spesso riconosciuta come SUM»): una graffa con le ESTREMITÀ
    // VERTICALI (inizia e finisce con un tratto dritto → frazione
    // verticale ≥ 50%) finisce QUI come «aste», e la deviazione GRADUALE
    // verso la punta la fa passare per arco. Ma la sua PUNTA è ANGOLARE
    // (gomito): firma da graffa con estremità sull'estremo (rip. unit:
    // variante estremità-all'estremo → «round», resta in inchiostro, il
    // modello legge «\sum»). Una tonda VERA ha la punta liscia: kink
    // ~0,3-0,8 px; una graffa angolare ~2-11 px (soglia 1,5 px ≈ 3× l'arco).
    const spikeS = -((devTop + devBot) / 2);
    // rigonfiamento (stessa formula del percorso profilo): esclude il «2»,
    // il cui diagonale sporge quasi quanto la punta
    const bulgeS =
      (bandMeanX(pts, shaftBox, 0.18, 0.32) + bandMeanX(pts, shaftBox, 0.68, 0.82)) / 2 -
      (midX - spikeS);
    if (
      Math.abs(spikeS) > margin &&
      ((spikeS * bulgeS >= 0 && Math.abs(bulgeS) <= 0.65 * Math.abs(spikeS)) ||
        (spikeS * bulgeS < 0 && Math.abs(bulgeS) <= 0.35 * Math.abs(spikeS))) &&
      isBraceTip(pts, shaftBox, midX, spikeS)
    ) {
      return { isOpen: spikeS < 0, kind: "curly", x0: gb.x0, strength: "strong" };
    }
    // è un ARCO: lo classifichiamo TONDA (resta nell'inchiostro: il modello
    // legge bene «(»/«)», verificato nel browser) e NON quadra.
    if (devTop > SIDE_MIN && devBot > SIDE_MIN)
      return { isOpen: true, kind: "round", x0: gb.x0, strength: "weak" };
    if (-devTop > SIDE_MIN && -devBot > SIDE_MIN)
      return { isOpen: false, kind: "round", x0: gb.x0, strength: "weak" };
    return null;
  }
  if (devTop > margin && devBot > margin) {
    return { isOpen: true, kind: "square", x0: gb.x0, strength: "strong" };
  }
  if (-devTop > margin && -devBot > margin) {
    return { isOpen: false, kind: "square", x0: gb.x0, strength: "strong" };
  }
  return null; // aste nuda senza tick né estremità laterali: ambigua
}

/** Rileva nell'inchiostro le shape alte (tonde, quadre e graffe), in
 *  ordine di x, col TIPO di ciascuna. */
export interface ShapeCandidate {
  idxs: number[];
  kind: BracketKind;
  isOpen: boolean;
  gb: Box;
  strength: "strong" | "weak";
}

/** Separa i tratti in cluster per gap orizzontale: due parentesi «larghe»
 *  (graffe) con una cifra in mezzo finiscono nello stesso gruppo ma sono
 *  DUE shape distinte, da classificare separatamente. */
function clusterByXGap(idxs: number[], boxes: Box[], gap: number): number[][] {
  const sorted = [...idxs].sort((a, b) => boxes[a]!.x0 - boxes[b]!.x0);
  const clusters: number[][] = [];
  let cur: number[] = [];
  let maxX1 = -Infinity;
  for (const i of sorted) {
    if (cur.length === 0 || boxes[i]!.x0 - maxX1 <= gap) {
      cur.push(i);
    } else {
      clusters.push(cur);
      cur = [i];
    }
    maxX1 = Math.max(maxX1, boxes[i]!.x1);
  }
  if (cur.length > 0) clusters.push(cur);
  return clusters;
}

/** Tratti CORTI del gruppo da assorbire in un'unità dominante come tick
 *  di QUADRA MULTI-TRATTO (4/10: «la quadra quasi sempre aggiunge un meno
 *  (-) a destra [-»): la quadra disegnata in TRATTI SEPARATI (aste + tick
 *  in alto/in basso) non veniva MAI classificata — l'unità conteneva solo
 *  l'asta nuda (che da sola non ha la firma delle estremità) e i trattini
 *  restavano nell'inchiostro, dove il modello li legge come un MENO (o la
 *  quadra spariva). I tick assorbiti entrano nella firma E vengono TOLTI
 *  dall'inchiostro insieme all'asta. */
function absorbBracketTicks(
  unit: number[],
  groupIdxs: number[],
  strokes: SimpleStroke[],
  boxes: Box[],
  gb: Box,
): number[] {
  const gh = gb.y1 - gb.y0;
  if (gh < 20) return [];
  let shaft = -1;
  for (const i of unit) {
    const sw = boxes[i]!.x1 - boxes[i]!.x0;
    const sh = boxes[i]!.y1 - boxes[i]!.y0;
    if (verticalFraction(strokes[i]!.points) >= SHAFT_FRAC && sw <= SHAFT_MAX_W * sh) {
      shaft = i;
      break;
    }
  }
  if (shaft === -1) return [];
  const shaftBox = boxes[shaft]!;
  const shaftX = (shaftBox.x0 + shaftBox.x1) / 2;
  // compagni con criterio LARGO (per la guardia anti-«+»: il tratto
  // verticale di un «+» è stretto, non passa il filtro tick ma deve
  // comunque essere visto come compagno dell'orizzontale)
  const loose = groupIdxs.filter((i) => {
    if (i === shaft) return false;
    const tw = boxes[i]!.x1 - boxes[i]!.x0;
    const th = boxes[i]!.y1 - boxes[i]!.y0;
    return tw <= 0.6 * gh && th <= 0.3 * gh;
  });
  const short = loose.filter((i) => {
    const tw = boxes[i]!.x1 - boxes[i]!.x0;
    const th = boxes[i]!.y1 - boxes[i]!.y0;
    // un tick è un TRATTINO: né un punto di «:» (troppo stretto) né un
    // pezzo di contenuto (troppo largo o troppo alto)
    return tw >= Math.max(4, 0.05 * gh) && th <= 0.15 * gh;
  });
  // ASSEGNAZIONE ALL'ASTA PIÙ VICINA (6/10, banco P2/P4): un tick appartiene all'asta che TOCCA,
  // non a un altro tratto verticale del gruppo (la `)` di `(2)]`, la `1` di `1]`). Prima ogni asta
  // del gruppo entro 0,45·h assorbiva i tick della `]` vicina e nasceva una falsa «quadra aperta
  // forte» (la `)` + i tick della `]`) che rubava tick e tonda → `[(2)]` letto `[12[]`.
  const hGap = (a: Box, b: Box): number => Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const rivals = groupIdxs.filter((j) => {
    if (j === shaft) return false;
    const bj = boxes[j]!;
    const w = bj.x1 - bj.x0;
    const h = bj.y1 - bj.y0;
    return h >= 0.6 * gh && verticalFraction(strokes[j]!.points) >= SHAFT_FRAC && w <= SHAFT_MAX_W * h;
  });
  const out: number[] = [];
  for (const i of short) {
    const cx = (boxes[i]!.x0 + boxes[i]!.x1) / 2;
    const cy = (boxes[i]!.y0 + boxes[i]!.y1) / 2;
    const nearTop = cy <= shaftBox.y0 + 0.25 * gh;
    const nearBottom = cy >= shaftBox.y1 - 0.25 * gh;
    if (!nearTop && !nearBottom) continue;
    if (Math.abs(cx - shaftX) > 0.45 * gh) continue;
    // il tick TOCCA la sua asta (distanza orizzontale fra i riquadri ≤ 0,2·h) …
    if (hGap(boxes[i]!, shaftBox) > 0.2 * gh) continue;
    // … ed è più vicino a questa asta che a ogni altra asta del gruppo
    const closeness = (b: Box): number => hGap(boxes[i]!, b) + 0.05 * Math.abs(cx - (b.x0 + b.x1) / 2);
    if (rivals.some((j) => closeness(boxes[j]!) < closeness(shaftBox))) continue;
    // GUARDIA anti-«+»: due trattini con centri quasi coincidenti sono un
    // segno più (o una x) vicino all'estremità della quadra: NON sono tick
    // → nessuno dei due si assorbe (il contenuto resta intero, il modello
    // legge tutto). Due tick VERI stanno alle estremità opposte, lontani.
    const plus = loose.some((j) => {
      if (j === i) return false;
      const cjx = (boxes[j]!.x0 + boxes[j]!.x1) / 2;
      const cjy = (boxes[j]!.y0 + boxes[j]!.y1) / 2;
      return Math.hypot(cjx - cx, cjy - cy) < 0.2 * gh;
    });
    if (plus) continue;
    out.push(i);
  }
  return out;
}

/** Rileva nell'inchiostro le shape alte candidate, in ordine di x, con il
 *  tipo classificato. Se più tratti dominanti finiscono nello stesso gruppo
 *  (gap di ingombro) ma sono distaccati in orizzontale, vengono classificati
 *  SINGOLAMENTE (una cifra in mezzo non deve fondere le firme). */
/** Fonde le DUE METÀ IMPILATE di una parentesi disegnata in due tratti (la quadra «⌐ + └»,
 *  la graffa «⌜ + ⌞»): ciascuna è alta ~50% della parentesi, quindi nessuna è «dominante» e,
 *  con la scrittura stretta, il gruppo si fonde con le cifre vicine («2]2»: unità [2,metà,metà,2]
 *  → cifra → nessun candidato). Fuse in UN tratto virtuale la parentesi diventa un tratto
 *  alto e stretto come tutti gli altri. (5/10 notte, audit: «—» 9–20% di `[` `]` `{` `}`.)
 *
 *  Condizioni (tutte): metà alta e metà bassa ciascuna 30–72% dell'altezza totale H; sovrapposizione
 *  verticale fra −0,2H e +0,35H; ingombro unito stretto (≤ 0,5H); centri x entro 0,25H; le due
 *  estremità più vicine entro 0,22H (continuità del gesto); H ≥ 1,2× la mediana dei tratti
 *  restanti (le cifre) — una coppia di cifre/frazione non è mai più alta di tutto il resto. */
export function mergeStackedHalves(strokes: SimpleStroke[]): { merged: SimpleStroke[]; members: number[][] } {
  const n = strokes.length;
  const identity = () => ({ merged: strokes, members: strokes.map((_, i) => [i]) });
  if (n < 2) return identity();
  const boxes = strokes.map((st) => bboxOf(st.points));
  const hs = boxes.map((b) => b.y1 - b.y0);
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  interface Pair { i: number; j: number; d: number; mode: 0 | 1 | 2 | 3 }
  const pairs: Pair[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const bi = boxes[i]!, bj = boxes[j]!;
      if (bi.y0 > bj.y0) continue; // i = metà ALTA
      const H = Math.max(bi.y1, bj.y1) - Math.min(bi.y0, bj.y0);
      if (H < 24) continue;
      const hi = hs[i]! / H, hj = hs[j]! / H;
      if (hi < 0.3 || hi > 0.72 || hj < 0.3 || hj > 0.72) continue;
      const ov = bi.y1 - bj.y0;
      if (ov < -0.2 * H || ov > 0.35 * H) continue;
      const uw = Math.max(bi.x1, bj.x1) - Math.min(bi.x0, bj.x0);
      if (uw > 0.5 * H) continue;
      if (Math.abs((bi.x0 + bi.x1) / 2 - (bj.x0 + bj.x1) / 2) > 0.25 * H) continue;
      const ti = strokes[i]!.points, tj = strokes[j]!.points;
      if (ti.length < 2 || tj.length < 2) continue;
      const cand: [number, 0 | 1 | 2 | 3][] = [
        [dist(ti[ti.length - 1]!, tj[0]!), 0], // alta + bassa
        [dist(ti[ti.length - 1]!, tj[tj.length - 1]!), 1], // alta + bassa rovesciata
        [dist(ti[0]!, tj[0]!), 2], // alta rovesciata + bassa
        [dist(ti[0]!, tj[tj.length - 1]!), 3], // entrambe rovesciate
      ];
      cand.sort((a, b) => a[0] - b[0]);
      if (cand[0]![0] > 0.22 * H) continue;
      // altezza rispetto al resto (cifre): mediana dei tratti restanti più bassi di 0,85H
      const rest = hs.filter((_, k) => k !== i && k !== j && hs[k]! < 0.85 * H && hs[k]! >= 12).sort((a, b) => a - b);
      if (rest.length > 0) {
        const med = rest[Math.floor(rest.length / 2)]!;
        if (H < 1.2 * med) continue;
      }
      pairs.push({ i, j, d: cand[0]![0], mode: cand[0]![1] });
    }
  }
  if (pairs.length === 0) return identity();
  pairs.sort((a, b) => a.d - b.d);
  const taken = new Set<number>();
  const chosen: Pair[] = [];
  for (const pr of pairs) {
    if (taken.has(pr.i) || taken.has(pr.j)) continue;
    taken.add(pr.i);
    taken.add(pr.j);
    chosen.push(pr);
  }
  const mergedAt = new Map<number, { stroke: SimpleStroke; members: number[] }>();
  const skip = new Set<number>();
  for (const pr of chosen) {
    const top = strokes[pr.i]!, bot = strokes[pr.j]!;
    const tp = pr.mode === 2 || pr.mode === 3 ? [...top.points].reverse() : top.points;
    const bp = pr.mode === 1 || pr.mode === 3 ? [...bot.points].reverse() : bot.points;
    const first = Math.min(pr.i, pr.j);
    mergedAt.set(first, { stroke: { ...top, points: [...tp, ...bp] }, members: [pr.i, pr.j] });
    skip.add(Math.max(pr.i, pr.j));
  }
  const merged: SimpleStroke[] = [];
  const members: number[][] = [];
  for (let k = 0; k < n; k++) {
    if (skip.has(k)) continue;
    const m = mergedAt.get(k);
    merged.push(m ? m.stroke : strokes[k]!);
    members.push(m ? m.members : [k]);
  }
  return { merged, members };
}

/** `relaxed`: soglia di altezza SENZA il riferimento «cifra» (tratto più corto): serve solo al
 *  test «pezzo di SOLE parentesi» (rewriteBrackets), dove nessuna cifra può esserci e le parentesi
 *  di una sequenza hanno altezze molto diverse (`}}` 59 e 76 px: la più corta, fra 59 e 1,1×59,
 *  veniva presa come «cifra» e si AUTO-ESCLUDEVA). */
export function shapeCandidates(strokes: SimpleStroke[], relaxed = false): ShapeCandidate[] {
  const { merged, members } = mergeStackedHalves(strokes);
  if (merged === strokes) return shapeCandidatesCore(strokes, relaxed);
  const fused = new Set<number>();
  members.forEach((m, k) => {
    if (m.length > 1) fused.add(k);
  });
  return shapeCandidatesCore(merged, relaxed, fused).map((c) => ({ ...c, idxs: c.idxs.flatMap((m) => members[m]!) }));
}

function shapeCandidatesCore(strokes: SimpleStroke[], relaxed = false, fused?: Set<number>): ShapeCandidate[] {
  const out: ShapeCandidate[] = [];
  if (strokes.length === 0) return out;
  const boxes = strokes.map((s) => bboxOf(s.points));
  // ⚠️ PARENTESI VICINO A UNA FRAZIONE (segnalazione 19/10: «il riconoscimento
  // delle parentesi vicino alle frazioni rimane difficoltoso»): una frazione
  // impilata è ALTA ~2× una cifra (numeratore + linea + denominatore) e con
  // l'altezza dell'espressione GONFIATA dalla frazione la soglia TALL_FRAC
  // (0,68·exprH ≈ 1,5 cifre) escludeva le parentesi scritte alte quanto le
  // cifre — restavano nell'inchiostro dove il modello le scambiava per altro.
  // Il riferimento d'altezza (exprH e tratti «da cifra») si calcola SENZA i
  // tratti della struttura frazione (linea + sopra + sotto, stessa firma di
  // rewriteStackedFractions in inkSigns.ts). Se il pezzo è SOLO frazione si
  // torna all'altezza piena (nessuna parentesi da cercare comunque).
  const fracIdx = fractionStructureIdx(strokes, boxes);
  const refBoxes = fracIdx.size > 0 && fracIdx.size < strokes.length
    ? boxes.filter((_, i) => !fracIdx.has(i))
    : boxes;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const b of refBoxes) {
    y0 = Math.min(y0, b.y0);
    y1 = Math.max(y1, b.y1);
  }
  const exprH = y1 - y0;
  // Soglia di altezza: le parentesi (tonde, quadre e graffe) sono MOLTO più
  // alte delle cifre. La soglia tiene conto del tratto alto più corto (di
  // solito una cifra): una shape deve superarlo del 10% — così una cifra
  // (o una «l») alta quanto le altre NON è mai una parentesi, nemmeno
  // disegnata con un tratto dritto, ma una tonda solo un po' più alta
  // resta candidata.
  const strokeHs = refBoxes
    .map((b) => b.y1 - b.y0)
    .filter((hh) => hh >= 20)
    .sort((a, b) => a - b);
  // ⚠️ 4/10 («scrivo insieme di seguito graffa, quadra e tonda»): il
  // riferimento «cifra» è il tratto CHIARAMENTE più corto (< 85% del più
  // alto). Prima si takeva il tratto alto più corto IN ASSOLUTO: in un
  // pezzo di sole parentesi ({[() la parentesi più corta era essa stessa
  // il riferimento (1,1×110 = 121 > 110) e si AUTO-ESCLUDEVA: nessuna
  // candidata, il modello leggeva tutto e sbagliava le graffe.
  const maxH = strokeHs.length > 0 ? strokeHs[strokeHs.length - 1]! : 0;
  const shorter = strokeHs.filter((hh) => hh < 0.85 * maxH);
  const shortestTall = shorter.length > 0 ? shorter[0]! : 0;
  const minH = relaxed ? TALL_FRAC * exprH : Math.max(TALL_FRAC * exprH, 1.1 * shortestTall);

  for (const idxs of groupStrokes(strokes, boxes)) {
    const gb: Box = {
      x0: Math.min(...idxs.map((i) => boxes[i]!.x0)),
      y0: Math.min(...idxs.map((i) => boxes[i]!.y0)),
      x1: Math.max(...idxs.map((i) => boxes[i]!.x1)),
      y1: Math.max(...idxs.map((i) => boxes[i]!.y1)),
    };
    const gh = gb.y1 - gb.y0;
    // (24/10, banco H=38 `[(5-2)*(4+1)]`: la `]` in due metà fuse (42 px) restava sotto minH
    // (43,5) per 1,5 px — ma due metà impilate allineate con continuità di gesto (mergeStackedHalves:
    // allineamento x, larghezza, altezza ≥1,2× la mediana) non sono mai una cifra: per i gruppi
    // interamente composti da tratti fusi la soglia scende a 0,8×. Resta tutta la catena di
    // guardie (firma, kept, abbinamento) a escludere eventuali fusi spuri.
    const gMinH = fused && idxs.every((i) => fused.has(i)) ? 0.8 * minH : minH;
    if (minH <= 0 || gh < gMinH) continue;

    // Tratti che dominano l'altezza del gruppo: ogni cluster orizzontale di
    // dominanti è una shape a sé (es. due graffe con una cifra in mezzo;
    // una cifra il cui ingombro si tocca con una parentesi resta esclusa).
    // ⚠️ 5/10 (graffa letta «\sum»): oltre ai dominanti (≥ 85%) entrano nelle
    // unità anche i tratti di ALTEZZA MEDIA (≥ 45% del gruppo): le DUE METÀ
    // di una graffa disegnata in due tratti sono alte ~55% ciascuna — con
    // una cifra ALTA vicina (dominante) restavano FUORI da ogni unità e la
    // graffa non veniva mai provata (rip. unit: «1} a due tratti, cifre
    // alte» → solo la graffa aperta estratta, la chiusa restava
    // nell'inchiostro e il modello la leggeva «\sum»). La separazione
    // orizzontale resta a carico di clusterByXGap (gap 8).
    const dominant = idxs.filter((i) => boxes[i]!.y1 - boxes[i]!.y0 >= 0.85 * gh);
    const midH = idxs.filter(
      (i) =>
        !dominant.includes(i) && boxes[i]!.y1 - boxes[i]!.y0 >= 0.45 * gh,
    );
    const seeds = [...dominant, ...midH];
    const units =
      seeds.length >= 1 ? clusterByXGap(seeds, boxes, 8) : [idxs];
    for (const inner of units) {
      const innerGb: Box =
        inner === idxs
          ? gb
          : {
              x0: Math.min(...inner.map((i) => boxes[i]!.x0)),
              y0: Math.min(...inner.map((i) => boxes[i]!.y0)),
              x1: Math.max(...inner.map((i) => boxes[i]!.x1)),
              y1: Math.max(...inner.map((i) => boxes[i]!.y1)),
            };
      // ⚠️ PARENTESI + NUMERI MESSI INSIEME (5/10: «difficoltà con le
      // parentesi e numeri messi insieme»): una CIFRA ALTA (≥ 85% del gruppo)
      // è dominante e finisce NELL'UNITÀ della parentesi quando la scritta è
      // fitta (x-gap ≤ 8). Conseguenze: (a) la cifra veniva ESTRATTA insieme
      // alla parentesi e SPARIVA dall'inchiostro; (b) la ricerca dell'asta
      // prendeva la PRIMA verticale — se era la cifra («1») la classificazione
      // falliva e la VERA parentesi (es. quadra chiusa) restava nell'inchiostro
      // dove il modello la scambia per altro. FIX: si prova OGNI tratto
      // verticale dell'unità come spina; il candidato comprende SOLO asta +
      // tick (mai le cifre, che restano nell'inchiostro per il modello).
      const shaftLike = (i: number): boolean => {
        const sw = boxes[i]!.x1 - boxes[i]!.x0;
        const sh = boxes[i]!.y1 - boxes[i]!.y0;
        return verticalFraction(strokes[i]!.points) >= SHAFT_FRAC && sw <= SHAFT_MAX_W * sh;
      };
      const verticals = inner.filter(shaftLike);
      let classified = false;
      for (const s of verticals) {
        // QUADRA MULTI-TRATTO (4/10): i tick separati della STESSA quadra si
        // assorbono PRIMA della classificazione, così entrano nella firma E
        // vengono tolti dall'inchiostro con l'asta (il modello non li vede →
        // nessun «-» spurio accanto alla quadra). Assorbimento RELATIVO ALLA
        // SPINA provata (unità = [s] soltanto).
        const ticks = absorbBracketTicks([s], idxs, strokes, boxes, innerGb);
        const full = [s, ...ticks];
        const shape = classifyFromGroup(full, strokes, boxes, innerGb, idxs);
        if (!shape) continue;
        // 5/10 sera: il candidato porta l'INGOMBRO DEI SUOI TRATTI (asta + tick),
        // non quello dell'unità. Prima, con due parentesi nella stessa unità
        // («[3]» fuso) o con una cifra media fusa, TUTTI i candidati avevano lo
        // stesso centro (quello dell'unità) e cx — che decide ordine e punto di
        // reinserimento — cadeva in mezzo alla cifra.
        const ownGb: Box = {
          x0: Math.min(...full.map((i) => boxes[i]!.x0)),
          y0: Math.min(...full.map((i) => boxes[i]!.y0)),
          x1: Math.max(...full.map((i) => boxes[i]!.x1)),
          y1: Math.max(...full.map((i) => boxes[i]!.y1)),
        };
        out.push({
          idxs: full,
          kind: shape.kind,
          isOpen: shape.isOpen,
          gb: ownGb,
          strength: shape.strength,
        });
        classified = true;
      }
      if (classified) {
        // ⚠️ (5/10 notte, parentesi chiuse scritte di seguito «]}», «)}») un'asta classificata
        // non esaurisce l'unità: un altro tratto ALTO e NON verticale (la graffa `}` a un tratto)
        // restava nell'inchiostro e il banco la leggeva `]`/`)` (`{2*[3-(1+1)]}` 6/6 sbagliato). Si
        // prova DA SOLO ogni tratto rimasto alto almeno il 45% del gruppo (e 0,8× minH).
        const usedNow = new Set(out.flatMap((o) => o.idxs));
        for (const sIdx of inner) {
          if (usedNow.has(sIdx) || shaftLike(sIdx)) continue;
          const sGb: Box = { ...boxes[sIdx]! };
          if (sGb.y1 - sGb.y0 < Math.max(0.8 * minH, 0.45 * gh)) continue;
          const shapeS = classifyFromGroup([sIdx], strokes, boxes, sGb, idxs);
          if (!shapeS) continue;
          out.push({
            idxs: [sIdx],
            kind: shapeS.kind,
            isOpen: shapeS.isOpen,
            gb: sGb,
            strength: shapeS.strength,
          });
        }
        continue;
      }
      // ⚠️ 5/10, parte 4: unità fusa con DUE O PIÙ tratti NON verticali
      // quasi alti quanto il gruppo (graffa + cifra alta incollata, es.
      // «3{» con la 3 alta quanto la graffa): il profilo unito si corrompe
      // e — quando riesce — INGHITTISCE la cifra (rip. browser: «3{2+1}»
      // gap 4 → candidato [d3+graffa] e la cifra spariva dall'inchiostro).
      // Una vera graffa in DUE METÀ ha metà alte (~55-60%), mai quasi alte
      // quanto il gruppo: con ≥2 tratti full-height non verticali si
      // classifica ogni tratto DA SOLO e non si prova mai il profilo unito.
      const fullish = inner.filter(
        (i) => !shaftLike(i) && boxes[i]!.y1 - boxes[i]!.y0 >= 0.8 * gh,
      );
      if (fullish.length >= 2) {
        for (const s of fullish) {
          const sGb: Box = {
            x0: boxes[s]!.x0,
            y0: boxes[s]!.y0,
            x1: boxes[s]!.x1,
            y1: boxes[s]!.y1,
          };
          if (sGb.y1 - sGb.y0 < minH) continue;
          const shapeS = classifyFromGroup([s], strokes, boxes, sGb, idxs);
          if (!shapeS) continue;
          out.push({
            idxs: [s],
            kind: shapeS.kind,
            isOpen: shapeS.isOpen,
            gb: sGb,
            strength: shapeS.strength,
          });
        }
        continue;
      }
      // Nessuna spina verticale ha passato la firma (o l'unità non ha spine):
      // percorso PROFilo sull'unità intera — graffa in un tratto o in due
      // metà, oppure graffa stretta a una cifra che aveva bloccato tutto.
      // ⚠️ 5/10: il profilo si prova SENZA ricerca asta SOLO se TUTTI i
      // tratti dell'unità sono shaft-like (graffa in DUE METÀ: ogni metà ha
      // il tratto dritto verso la punta → frazione verticale ~0,8, ma
      // insieme formano la graffa). Con il flag sempre attivo una «E» alta
      // (spina + barra centrale: il profilo unito dà un incavo spurio) e
      // unità miste fini in classified spuri (regressioni rip. unit).
      const allShaft = inner.length >= 2 && inner.every(shaftLike);
      const full = inner.concat(absorbBracketTicks(inner, idxs, strokes, boxes, innerGb));
      let shape = classifyFromGroup(full, strokes, boxes, innerGb, idxs, allShaft);
      // ⚠️ 5/10 (graffa letta «\sum», caso «{3}»): il profilo unito di un'unità
      // FUSA è attendibile solo se OGNI tratto raggiunge la cima o il fondo
      // dell'unità — le due metà di una graffa sì, una CIFRA MEDIA incollata
      // (che copre solo la fascia centrale) NO: il suo profilo mergede con la
      // graffa dà una curva spuria (rip. unit: «{3}» → curla chiusa spuria su
      // [cifra, graffa] che in GUARDIA 2 diventava ancora e bloccava
      // l'estrazione della graffa vera, lasciando cifra E graffa
      // nell'inchiostro). Si azzera la shape: i singoli tratti e il
      // leave-one-out classificheranno la graffa pulita.
      if (shape && inner.length >= 2) {
        const ghU = innerGb.y1 - innerGb.y0;
        const touches = (i: number): boolean =>
          boxes[i]!.y0 <= innerGb.y0 + 0.15 * ghU ||
          boxes[i]!.y1 >= innerGb.y1 - 0.15 * ghU;
        if (!inner.every(touches)) shape = null;
      }
      // con profilo FORZATO su unità tutta shaft-like solo una GRAFFA è
      // attendibile (le due metà fusede possono dare profili da tonda:
      // rip. unit «1} a due tratti, cifre alte» → tonda debole spuria che
      // bloccava il leave-one-out e la graffa chiusa si perdeva).
      // Una TONDA da profilo unito è pulita solo per unità di UN tratto;
      // per unità FUSE (≥ 2 tratti: cifra+parentesi sovrapposte in x,
      // unite dai semi di altezza media) il profilo mergede non è
      // affidabile (rip. unit «{3}» → unità [cifra, graffa chiusa] → tonda
      // spuria che bloccava l'estrazione della graffa chiusa): diventa un
      // RIPIEGO — prima si provano i singoli tratti e il leave-one-out,
      // e solo se non producono nulla si accetta la tonda fusa.
      let mergedRound: ShapeClass | null = null;
      if (shape) {
        if (shape.kind !== "round" && (!allShaft || shape.kind === "curly")) {
          out.push({
            idxs: full,
            kind: shape.kind,
            isOpen: shape.isOpen,
            gb: innerGb,
            strength: shape.strength,
          });
          continue;
        }
        if (shape.kind === "round" && inner.length === 1) {
          out.push({
            idxs: full,
            kind: shape.kind,
            isOpen: shape.isOpen,
            gb: innerGb,
            strength: shape.strength,
          });
          continue;
        }
        if (shape.kind === "round") mergedRound = shape;
      }
      // ⚠️ 5/10, parte 3 («parentesi e numeri messi insieme»): se l'unità
      // mescola un tratto VERTICALE (una «1» alta incollata alla parentesi)
      // con tratti curvi, il profilo unito si CORROMPE (rip. browser:
      // «3{2+1}» con cifre alte → graffa chiusa non estratta, il modello
      // leggeva «y» al posto di «1}»). Riprova con i SINGOLI tratti NON
      // verticali: la graffa da sola ha la firma giusta, la cifra resta
      // nell'inchiostro per il modello.
      let singletonFound = false;
      {
        // NB: senza gate sui verticals — una cifra incollata può NON essere
        // shaft-like col criterio stretto (larghezza > 30% della SUA altezza)
        // e i singoli tratti vanno provati comunque (rip. unit «{3}»).
        for (const s of inner.filter((i) => !shaftLike(i))) {
          const sGb: Box = {
            x0: boxes[s]!.x0,
            y0: boxes[s]!.y0,
            x1: boxes[s]!.x1,
            y1: boxes[s]!.y1,
          };
          if (sGb.y1 - sGb.y0 < minH) continue;
          const shapeS = classifyFromGroup([s], strokes, boxes, sGb, idxs);
          if (!shapeS) continue;
          out.push({
            idxs: [s],
            kind: shapeS.kind,
            isOpen: shapeS.isOpen,
            gb: sGb,
            strength: shapeS.strength,
          });
          singletonFound = true;
        }
      }
      if (singletonFound) continue;
      // LEAVE-ONE-OUT (solo se i singoli non hanno prodotto nulla): si
      // riprova il profilo (FORZATO, senza ricerca asta) su ogni sottoinsieme
      // di ≥ 2 tratti che esclude un tratto alla volta — una graffa in DUE
      // metà incollata a una cifra verticale (tutti shaft-like) ha il
      // profilo unito corrotto dalla cifra: senza la cifra la firma torna
      // (rip. unit: «1} a due tratti» → sottoinsieme [metà sup, metà inf] →
      // graffa chiusa; la cifra resta nell'inchiostro per il modello).
      for (const skip of inner) {
        const subset = inner.filter((i) => i !== skip);
        if (subset.length < 2) continue; // i singoli sono coperti qui sopra
        // Le metà della STESSA graffa si SOVRAPPONGONO in x (stessa colonna);
        // una cifra accanto NO (rip. unit: «1» + metà graffa → sovrapposizione
        // nulla → subset rifiutato, la cifra non viene più inghiottita).
        const sortedX = [...subset].sort((a, b) => boxes[a]!.x0 - boxes[b]!.x0);
        let overlapOK = true;
        for (let i = 1; i < sortedX.length; i++) {
          const a = boxes[sortedX[i - 1]!]!;
          const b = boxes[sortedX[i]!]!;
          const ov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
          const minW = Math.min(a.x1 - a.x0, b.x1 - b.x0);
          if (ov < 0.5 * minW) {
            overlapOK = false;
            break;
          }
        }
        if (!overlapOK) continue;
        const subGb: Box = {
          x0: Math.min(...subset.map((i) => boxes[i]!.x0)),
          y0: Math.min(...subset.map((i) => boxes[i]!.y0)),
          x1: Math.max(...subset.map((i) => boxes[i]!.x1)),
          y1: Math.max(...subset.map((i) => boxes[i]!.y1)),
        };
        if (subGb.y1 - subGb.y0 < minH) continue;
        const fullS = subset.concat(absorbBracketTicks(subset, idxs, strokes, boxes, subGb));
        const shapeS = classifyFromGroup(fullS, strokes, boxes, subGb, idxs, true);
        if (!shapeS) continue;
        out.push({
          idxs: fullS,
          kind: shapeS.kind,
          isOpen: shapeS.isOpen,
          gb: subGb,
          strength: shapeS.strength,
        });
        // NB: nessun break — nell'unità fusa possono esserci DUE parentesi.
      }
      // RIPIEGO: nessun singolo tratto né leave-one-out ha prodotto nulla →
      // si accetta la tonda dal profilo fuso (meglio che perdere del tutto
      // la classificazione; il modello nel frattempo legge la tonda bene).
      if (mergedRound) {
        out.push({
          idxs: full,
          kind: mergedRound.kind,
          isOpen: mergedRound.isOpen,
          gb: innerGb,
          strength: mergedRound.strength,
        });
      }
    }
  }
  out.sort((a, b) => a.gb.x0 - b.gb.x0);
  return out;
}

export function detectBracketKinds(strokes: SimpleStroke[]): {
  opens: BracketKind[];
  closes: BracketKind[];
} {
  const opens: { kind: BracketKind; x0: number }[] = [];
  const closes: { kind: BracketKind; x0: number }[] = [];
  const shapes = shapeCandidates(strokes);
  // ⚠️ STESSE decisioni di rewriteBrackets (5/10 notte): senza l'abbinamento apri/chiudi una `}`
  // estratta e già tipata correttamente («{2+1}3») veniva ri-tipata `]` da questa classificazione
  // grezza (restoreSquareBrackets) perché il suo profilo la dava «quadra debole».
  const refs = contentRefs(strokes.map((st) => bboxOf(st.points)), shapes);
  const paired = shapes
    .filter((c) => c.kind !== "round")
    .map((c) => ({
      c,
      p: {
        kind: c.kind,
        isOpen: c.isOpen,
        cx: (c.gb.x0 + c.gb.x1) / 2,
        gh: c.gb.y1 - c.gb.y0,
        strength: c.strength,
      } as PairCand,
    }));
  const pairThreshold = Math.max(refs.othersMax, ROUND_FAMILY_FRAC * refs.roundMax);
  promotePairs(
    paired.map((x) => x.p),
    pairThreshold,
    refs.contentXs,
  );
  // (6/10) STESSA promozione di rewriteBrackets: una `{` debole letta tonda, chiusa da una `}` forte,
  // è una graffa. Senza questo passo `restoreSquareBrackets` (che lavora sull'inchiostro INTERO, anche
  // sui tratti già estratti) ri-tipava `(` la `{` che rewriteBrackets aveva appena estratto come graffa:
  // `{5+1}` → `(5+1}`.
  const roundPaired = shapes
    .filter((c) => c.kind === "round")
    .map((c) => ({
      c,
      p: {
        kind: c.kind,
        isOpen: c.isOpen,
        cx: (c.gb.x0 + c.gb.x1) / 2,
        gh: c.gb.y1 - c.gb.y0,
        strength: c.strength,
      } as PairCand,
    }));
  promoteRoundOpeners(
    paired.map((x) => x.p),
    roundPaired.map((x) => x.p),
    pairThreshold,
    refs.contentXs,
  );
  promoteRoundClosers(
    paired.map((x) => x.p),
    roundPaired.map((x) => x.p),
    pairThreshold,
    refs.contentXs,
  );
  const typed = new Map<(typeof shapes)[number], BracketKind>(
    [...paired, ...roundPaired].map((x) => [x.c, x.p.kind]),
  );
  for (const c of shapes) {
    const kind = typed.get(c) ?? c.kind;
    if (c.isOpen) opens.push({ kind, x0: c.gb.x0 });
    else closes.push({ kind, x0: c.gb.x0 });
  }
  opens.sort((a, b) => a.x0 - b.x0);
  closes.sort((a, b) => a.x0 - b.x0);
  return {
    opens: opens.map((o) => o.kind),
    closes: closes.map((c) => c.kind),
  };
}


/** Rileva nell'inchiostro le shape alte (quadre e tonde), in ordine di x.
 *  (API storica: true = quadra; usata dal percorso di mappatura.) */
export function detectBracketShapes(strokes: SimpleStroke[]): {
  opens: boolean[];
  closes: boolean[];
} {
  const kinds = detectBracketKinds(strokes);
  return {
    opens: kinds.opens.map((k) => k === "square"),
    closes: kinds.closes.map((k) => k === "square"),
  };
}

// ─── ESTRAZIONE delle parentesi graffe e quadre (riconoscimento a mano) ──
//
// Il modello legge una graffa disegnata come «3»/«\sum» (verificato nel
// browser: «{3}» → «33\sum2») e le quadre a volte spariscono o mutano
// tipo. STESSA TECNICA di √, 8, = e − (inkSigns.ts): le shape ALTE
// classificate come GRAFFA o QUADRA vengono TOLTE dall'inchiostro, il
// modello legge il contenuto (che sa leggere bene) e le parentesi vengono
// REINSERITE nel LaTeX alla posizione proporzionale (ancore). Le TONDE
// restano nell'inchiostro: il modello le legge bene e la mappatura
// (restoreSquareBrackets) corregge il tipo dove serve.
//
// GUARDIE anti-falsi-positivi (una lettera/cifra NON è mai una parentesi):
// 1. soglia di altezza PER-FIRMA (4/10: «una parentesi più qualche numero
//    accanto» e «{[() scritti di seguito»): con la vecchia soglia unica
//    1,3× bastava una tonda (o una cifra) quasi alta quanto le parentesi
//    per bloccare TUTTO. Ora firma FORTE (graffa; quadra con tick a
//    ENTRAMBE le estremità; quadra a un tratto con entrambe le estremità
//    deviate) → 1,0× del contenuto più alto; firma DEBOLE (quadra
//    multi-tratto con un tick solo) → 1,3× come prima;
// 2. pezzo di SOLE graffe/quadre (nessun altro tratto): si estrae tutto
//    tranne un'ANCORA (l'ultima quadra a destra, che il modello legge
//    meglio di una graffa) che resta nell'inchiostro — l'inchiostro vuoto
//    non darebbe al modello nulla da leggere; con le TONDE presenti non
//    serve: la soglia 1,0× le supera e restano loro il contenuto;
// 3. firma della graffa rigida (due rigonfiamenti oltre le estremità +
//    punta centrale opposta) — una «3» non la soddisfa;
// 4. quadra a un tratto: ENTRAMBE le estremità deviate dalla stessa parte
//    (un «1» con flag ha solo quella alta — e il piede sta DALL'ALTRA);
// 5. niente barra centrale (anti-«E»); quadra multi-tratto con UN tick
//    solo = firma DEBOLE (soglia 1,3×).

export interface BracketInsertion {
  kind: BracketKind;
  isOpen: boolean;
  /** centro x della shape (assoluto: stesso sistema dell'inchiostro) */
  cx: number;
}

export interface BracketsRewrite {
  /** inchiostro SENZA le parentesi estratte (graffe e quadre) */
  strokes: SimpleStroke[];
  /** parentesi estratte, in ordine di x */
  brackets: BracketInsertion[];
  /** riquadro di ogni parentesi estratta (stesso ordine di `brackets`): BASE VIRTUALE di un
   *  esponente («[3]²»: la quadra è stata tolta dall'inchiostro, ma l'esponente è suo) */
  boxes: Box[];
}

/** (7/10) soglia minima (× contenuto) per una chiusura debole che completa una coppia con apertura alta */
export const NEAR_TALL_FRAC = 1.04;

interface PairCand {
  kind: BracketKind;
  isOpen: boolean;
  cx: number;
  gh: number;
  strength: "strong" | "weak";
}

/** Abbinamento apri/chiudi fra le candidate (quadre/graffe) in ordine di x: una chiusura cerca
 *  l'apertura non abbinata PIÙ VICINA dello stesso tipo (pila). Muta le candidate. */
export function promotePairs(cands: PairCand[], othersMax: number, contentXs?: number[]): void {
  const sorted = [...cands].sort((a, b) => a.cx - b.cx);
  const stack: PairCand[] = [];
  const tall = (c: PairCand) => othersMax <= 0 || c.gh >= 1.12 * othersMax;
  // una coppia vera RACCHIUDE del contenuto: due «1» (candidate deboli) scritti uno accanto
  // all'altro, senza nulla in mezzo, non sono mai «[» e «]» (contentXs = x dei tratti non-parentesi
  // e delle tonde; omesso = nessun vincolo)
  const encloses = (o: PairCand, c: PairCand) =>
    !contentXs || contentXs.some((x) => x > o.cx && x < c.cx);
  for (const c of sorted) {
    if (c.isOpen) {
      stack.push(c);
      continue;
    }
    // 1) apertura dello stesso tipo
    let k = -1;
    for (let t = stack.length - 1; t >= 0; t--) {
      if (stack[t]!.kind === c.kind) {
        k = t;
        break;
      }
    }
    if (k >= 0) {
      const o = stack.splice(k, 1)[0]!;
      // basta che sia alta la candidata DEBOLE: la forte passa già da sola la sua soglia (1,0×)
      const weakOk = (x: PairCand) => x.strength === "strong" || tall(x);
      // (7/10) CHIUSURA debole «quasi alta» (1,04–1,12× il contenuto): `{[2]}` → `{[2)}`, `5-[2+(3-1)]`
      // (banco H=38: `]` di 45–48 px contro cifre di 43). Solo se l'APERTURA dello stesso tipo e'
      // alta/forte, la chiusura e' almeno il 75% dell'apertura e racchiude del contenuto; una «1» con
      // flag (≈ 1,00× il contenuto) resta fuori grazie alla soglia 1,04.
      const nearTall = (x: PairCand) =>
        othersMax > 0 && x.gh >= NEAR_TALL_FRAC * othersMax && x.gh >= 0.75 * o.gh;
      const closerOk = weakOk(c) || (!c.isOpen && c.strength === "weak" && weakOk(o) && nearTall(c));
      if ((o.strength === "weak" || c.strength === "weak") && weakOk(o) && closerOk && encloses(o, c)) {
        o.strength = "strong";
        c.strength = "strong";
      }
      continue;
    }
    // 2) tipi diversi «graffa / quadra»: confusione tipica `}` ↔ `]` (audit 5–7%). Se uno dei due
    //    è FORTE graffa e l'altro DEBOLE quadra, la coppia è graffa.
    const o = stack[stack.length - 1];
    if (o && o.kind !== c.kind && o.kind !== "round" && c.kind !== "round") {
      const curlyStrong = (x: PairCand) => x.kind === "curly" && x.strength === "strong";
      const squareWeak = (x: PairCand) => x.kind === "square" && x.strength === "weak";
      if ((curlyStrong(o) && squareWeak(c)) || (squareWeak(o) && curlyStrong(c))) {
        if (tall(o) && tall(c) && encloses(o, c)) {
          o.kind = "curly";
          c.kind = "curly";
          o.strength = "strong";
          c.strength = "strong";
          stack.pop();
        }
      }
    }
  }
}

/** (6/10) Graffa DEBOLE letta «tonda»: abbinamento ESPLICITO con la chiusura graffa FORTE.
 *
 *  Le tonde non entrano in `promotePairs` (restano al modello). A cifre piccole e pixel interi una `{`
 *  disegnata in un tratto solo ha un profilo da «tonda con un angolo» (nessuna punta rilevata, uncino
 *  0,09–0,10, depth 0,12–0,15) e il modello la legge `(`: `{5+1}` → `(5+1}`. Prima la salvava per CASO
 *  la regola degli angoli di `classifyProfile` (la dichiarava «quadra debole» e il passo 2 di
 *  `promotePairs` la faceva graffa insieme alla `}` forte). Stretta quella regola — una `(` rumorosa
 *  non deve diventare `[` (`{[(3+2)]}` → `{[[3+2)]}` nel browser) — la salvezza va resa ESPLICITA:
 *  una chiusura graffa FORTE senza apertura graffa, la cui apertura più vicina non abbinata è una
 *  TONDA, non può essere `(…}` (non è matematica valida) ⇒ l'apertura è una graffa debole.
 *
 *  SOLO l'APERTURA: una `)` senza `(` rilevata è un caso comune (tonda bassa saltata) e promuoverla a
 *  graffa romperebbe `{2·(3+1)}`. Guardie come in `promotePairs`: alta (≥ 1,12× il contenuto) e con
 *  del contenuto in mezzo.
 *
 *  `cands`: candidate quadre/graffe (le graffe sono già state abbinate da `promotePairs`);
 *  `rounds`: TUTTE le tonde rilevate (aperture e chiusure: servono ad abbinare le `( )` vere, che non
 *  vanno mai toccate). Muta le tonde promosse (kind → "curly", strength → "strong") e le restituisce:
 *  il chiamante le aggiunge alle candidate. */
export function promoteRoundOpeners<T extends PairCand>(
  cands: T[],
  rounds: T[],
  othersMax: number,
  contentXs?: number[],
): T[] {
  const tall = (c: PairCand) => othersMax <= 0 || c.gh >= 1.12 * othersMax;
  const encloses = (o: PairCand, c: PairCand) =>
    !contentXs || contentXs.some((x) => x > o.cx && x < c.cx);
  const events = [...cands.filter((c) => c.kind === "curly"), ...rounds].sort((a, b) => a.cx - b.cx);
  const stack: T[] = [];
  const promoted: T[] = [];
  for (const e of events) {
    if (e.isOpen) {
      stack.push(e);
      continue;
    }
    // la chiusura abbina l'apertura non abbinata PIÙ VICINA dello stesso tipo (pila)
    let k = -1;
    for (let t = stack.length - 1; t >= 0; t--) {
      if (stack[t]!.kind === e.kind) {
        k = t;
        break;
      }
    }
    if (k >= 0) {
      stack.splice(k, 1);
      continue;
    }
    // graffa FORTE che chiude senza apertura graffa e con una TONDA come apertura più vicina
    if (e.kind === "curly" && e.strength === "strong") {
      const o = stack[stack.length - 1];
      if (o && o.kind === "round" && tall(o) && tall(e) && encloses(o, e)) {
        o.kind = "curly";
        o.strength = "strong";
        stack.pop();
        promoted.push(o);
      }
    }
  }
  return promoted;
}

/** (7/10) SPECULARE di promoteRoundOpeners: quadra FORTE che APRE, poi una TONDA di chiusura non
 *  abbinata (`{[2)}`, `[(2+3)` letta `)` invece di `]`): la tonda e' in realta' la `]`.
 *  Solo CHIUSURE tonde: una `)` senza `(` e' comune ma qui c'e' una `[` forte aperta e non chiusa,
 *  quindi l'unica chiusura plausibile e' quella. Guardie come in promoteRoundOpeners (alta >= 1,12x
 *  il contenuto, contenuto in mezzo). Muta le tonde promosse (kind square, strong) e le restituisce. */
export function promoteRoundClosers<T extends PairCand>(
  cands: T[],
  rounds: T[],
  othersMax: number,
  contentXs?: number[],
): T[] {
  const tall = (c: PairCand) => othersMax <= 0 || c.gh >= 1.12 * othersMax;
  const encloses = (o: PairCand, c: PairCand) =>
    !contentXs || contentXs.some((x) => x > o.cx && x < c.cx);
  const events = [...cands.filter((c) => c.kind === "square"), ...rounds].sort((a, b) => a.cx - b.cx);
  const stack: T[] = [];
  const promoted: T[] = [];
  for (const e of events) {
    if (e.isOpen) {
      stack.push(e);
      continue;
    }
    // una chiusura abbina l'apertura non abbinata PIU' VICINA dello stesso tipo
    let k = -1;
    for (let t = stack.length - 1; t >= 0; t--) {
      if (stack[t]!.kind === e.kind) {
        k = t;
        break;
      }
    }
    if (k >= 0) {
      stack.splice(k, 1);
      continue;
    }
    // tonda che chiude senza apertura tonda e con una QUADRA FORTE come apertura piu' vicina
    if (e.kind === "round") {
      const o = stack[stack.length - 1];
      if (o && o.kind === "square" && o.strength === "strong" && tall(o) && tall(e) && encloses(o, e)) {
        e.kind = "square";
        e.strength = "strong";
        promoted.push(e);
      }
    }
  }
  return promoted;
}

/** (7/10) CHIUSURA PER ESCLUSIONE: una quadra FORTE che apre e nessuna chiusura quadra rilevata
 *  (`3[2(1)]`, `[2+1]5`: la `]` e' quasi dritta e la `)` o la «1» non la distinguono). Un'apertura
 *  forte senza chiusura e' matematicamente incompleta: se a destra, con contenuto in mezzo, c'e'
 *  UN SOLO tratto libero sottile e nettamente piu' alto delle cifre (≥1,3× la mediana e ≥1,15× la
 *  piu' alta delle altre; ≥85% dell'apertura; larghezza ≤ 0,45·altezza), e' la `]`. Restituisce una
 *  candidata DEBOLE (poi vale tutta la catena di guardie: promotePairs, soglie di altezza). Mai se
 *  esiste gia' una chiusura quadra non abbinata, se i candidati sono 2+, o con meno di 3 cifre. */
export function inferMissingCloser(boxes: Box[], shapes: ShapeCandidate[]): ShapeCandidate | null {
  const squares = shapes.filter((c) => c.kind === "square").sort((a, b) => a.gb.x0 - b.gb.x0);
  const stack: ShapeCandidate[] = [];
  let strayClose = false;
  for (const c of squares) {
    if (c.isOpen) stack.push(c);
    else if (stack.length > 0) stack.pop();
    else strayClose = true;
  }
  if (strayClose) return null;
  const openers = stack.filter((c) => c.strength === "strong");
  if (openers.length !== 1 || stack.length !== 1) return null;
  const o = openers[0]!;
  const oh = o.gb.y1 - o.gb.y0;
  const used = new Set(shapes.flatMap((c) => c.idxs));
  const free: number[] = [];
  for (let i = 0; i < boxes.length; i++) if (!used.has(i)) free.push(i);
  const hOf = (i: number) => boxes[i]!.y1 - boxes[i]!.y0;
  const wOf = (i: number) => boxes[i]!.x1 - boxes[i]!.x0;
  // (24/10, banco H=38 `x[x+1]`: il contenuto minuto — x, +, 1 da 19–33 px contro la `]` da 53 —
  // restava sotto 0,45× il massimo (la `]` stessa!) e `solid` non arrivava a 4 tratti. Il massimo è
  // gonfiato proprio dalla candidata: si usa la MEDIANA dei tratti liberi, stabile. Le guardie vere
  // restano `hits` (1,3×med, 1,15×max, 0,85×apertura) e `between` (contenuto in mezzo).)
  const sortedFree = free.map(hOf).sort((a, b) => a - b);
  const medFree = sortedFree[Math.floor(sortedFree.length / 2)] ?? 0;
  const solid = free.filter((i) => hOf(i) >= 0.45 * medFree);
  if (solid.length < 4) return null; // 3 cifre + la candidata
  const ox = (o.gb.x0 + o.gb.x1) / 2;
  const hits = solid.filter((i) => {
    if ((boxes[i]!.x0 + boxes[i]!.x1) / 2 <= ox) return false;
    const others = solid.filter((j) => j !== i).map(hOf).sort((a, b) => a - b);
    const med = others[Math.floor(others.length / 2)]!;
    const mx = others[others.length - 1]!;
    return (
      wOf(i) <= 0.45 * hOf(i) && hOf(i) >= 1.3 * med && hOf(i) >= 1.15 * mx && hOf(i) >= 0.85 * oh
    );
  });
  if (hits.length !== 1) return null;
  const i = hits[0]!;
  const cx = (boxes[i]!.x0 + boxes[i]!.x1) / 2;
  const between = free.some((j) => j !== i && (boxes[j]!.x0 + boxes[j]!.x1) / 2 > ox && (boxes[j]!.x0 + boxes[j]!.x1) / 2 < cx);
  if (!between) return null;
  return { idxs: [i], kind: "square", isOpen: false, gb: boxes[i]!, strength: "weak" };
}

/** Coefficiente di «famiglia»: le TONDE sono parentesi come quadre e graffe, quindi l'altezza di
 *  una quadra/graffa va confrontata con quella delle tonde in modo MORBIDO (non alla pari delle
 *  cifre). 5/10 notte, banco P4: in `2·[3+(4-1)]` la `]` (59 px) e la `[` (67) erano più basse
 *  della `(` tonda (75) e la soglia «≥ 1,0× il contenuto più alto, tonde comprese» BLOCCAVA
 *  tutto: ogni parentesi di una scrittura nidificata ha la sua altezza. */
export const ROUND_FAMILY_FRAC = 0.7;

/** Riferimenti di altezza/posizione del contenuto per le guardie su quadre e graffe.
 *  `othersMax`: tratto più alto che NON sia parentesi (cifre, lettere, operatori);
 *  `roundMax`: tratto più alto fra le tonde riconosciute come tali;
 *  `contentXs`: x dei centri dei tratti che non sono quadre/graffe (cifre, operatori, tonde). */
export function contentRefs(
  boxes: Box[],
  shapes: { idxs: number[]; kind: BracketKind }[],
): { othersMax: number; roundMax: number; contentXs: number[] } {
  const bracket = new Set<number>();
  const round = new Set<number>();
  for (const c of shapes) for (const i of c.idxs) (c.kind === "round" ? round : bracket).add(i);
  let othersMax = 0;
  let roundMax = 0;
  const contentXs: number[] = [];
  // ⚠️ TRATTO ALTO E SOTTILE «da parentesi» (5/10 notte, `3[2(1)]`: la `)` tonda scritta quasi dritta
  // (9×63) non è riconoscibile come candidata — è indistinguibile da un «1» — ma è alta 1,45× le
  // cifre e fissava othersMax a 63 bloccando le quadre esterne (59/57)): un tratto sottile
  // (larghezza ≤ 0,35·altezza) ≥ 1,25× l'altezza MEDIANA delle cifre (tratti ≥ 45% del più alto) è
  // trattato come una tonda, non come contenuto.
  const free: number[] = [];
  for (let i = 0; i < boxes.length; i++) if (!bracket.has(i) && !round.has(i)) free.push(i);
  const hOf = (i: number) => boxes[i]!.y1 - boxes[i]!.y0;
  const wOf = (i: number) => boxes[i]!.x1 - boxes[i]!.x0;
  const maxFree = free.reduce((m, i) => Math.max(m, hOf(i)), 0);
  const solid = free.filter((i) => hOf(i) >= 0.45 * maxFree);
  const parenLike = new Set<number>();
  for (const i of solid) {
    const others = solid.filter((j) => j !== i).map(hOf).sort((a, b) => a - b);
    if (others.length < 2) continue; // serve un riferimento di cifre (almeno due altri tratti)
    const med = others[Math.floor(others.length / 2)]!;
    if (wOf(i) <= 0.35 * hOf(i) && hOf(i) >= 1.25 * med) parenLike.add(i);
  }
  for (let i = 0; i < boxes.length; i++) {
    if (bracket.has(i)) continue;
    const b = boxes[i]!;
    const h = b.y1 - b.y0;
    contentXs.push((b.x0 + b.x1) / 2);
    if (round.has(i) || parenLike.has(i)) roundMax = Math.max(roundMax, h);
    else othersMax = Math.max(othersMax, h);
  }
  return { othersMax, roundMax, contentXs };
}

/** «Pezzo di SOLE parentesi»: se OGNI tratto appartiene a una parentesi (tonde comprese) non
 *  c'è alcuna cifra con cui confonderle e il modello — che su sole parentesi legge «c», «1», «i»,
 *  «\int», «j» — non serve. Restituisce le candidate scelte (una per tratto, la più forte/alta),
 *  oppure null. Guardie: nessun tratto resta fuori; ogni candidata è una tonda o ha firma FORTE;
 *  una quadra DEBOLE (un solo tick, può essere una «1» con flag) è ammessa solo se il pezzo ha
 *  ≥ 2 parentesi e almeno una tonda o una candidata FORTE che le fa da ancora. */
export function bracketOnlyPiece<T extends ShapeCandidate>(strokes: SimpleStroke[], shapes: T[]): T[] | null {
  if (shapes.length === 0) return null;
  const ranked = [...shapes].sort(
    (a, b) =>
      (b.strength === "strong" ? 1 : 0) - (a.strength === "strong" ? 1 : 0) ||
      b.gb.y1 - b.gb.y0 - (a.gb.y1 - a.gb.y0),
  );
  const used = new Set<number>();
  const chosen: T[] = [];
  for (const c of ranked) {
    if (c.idxs.some((i) => used.has(i))) continue;
    chosen.push(c);
    for (const i of c.idxs) used.add(i);
  }
  if (used.size !== strokes.length) return null;
  const anchored = chosen.some((c) => c.kind === "round" || c.strength === "strong");
  const weakOk = chosen.length >= 2 && anchored;
  if (!chosen.every((c) => c.kind === "round" || c.strength === "strong" || weakOk)) return null;
  return chosen;
}

/** (6/10) COMPLETAMENTO dei pezzi di SOLE parentesi per la scrittura PICCOLA.
 *
 *  A cifre di ~38 px una tonda (o una quadra «morbida») ha pochi punti (passo ~4 px) e fasce vuote:
 *  il classificatore a fasce (legacy) dà null e `refineWithProfile` da null promuove solo a quadra
 *  inequivocabile, mai a tonda. In un pezzo di sole parentesi basta UN tratto non coperto perché
 *  `bracketOnlyPiece` fallisca e tutto passi al modello, che su sole parentesi legge «CV», «1(», «\\pi»
 *  (banco P1 a H=38 con pixel interi: 97% → 81%). Qui, SOLO come ultimo tentativo di quel percorso,
 *  per ogni tratto alto non coperto si guarda il PROFILO: tonda con confidenza ≥ 0,8 (arco con
 *  profondità ≥ 0,06: una «1» ha ≈ 0) o quadra con angolo e tick largo (conf ≥ 0,8), non cifra,
 *  stretto (aspect ≤ 0,34) e alto quasi quanto la candidata più alta (≥ 75%: in una sequenza le
 *  parentesi hanno altezze simili; una cifra è più bassa). La quadra entra DEBOLE: `bracketOnlyPiece`
 *  la ammette solo con ≥ 2 parentesi e un'ancora tonda o forte. Un pezzo con una cifra non viene
 *  mai completato: la cifra resta scoperta e `bracketOnlyPiece` fallisce come prima. */
export function completeBracketOnly<T extends ShapeCandidate>(strokes: SimpleStroke[], shapes: T[]): ShapeCandidate[] {
  const covered = new Set(shapes.flatMap((c) => c.idxs));
  if (covered.size === 0 || covered.size >= strokes.length) return shapes;
  const refH = Math.max(...shapes.map((c) => c.gb.y1 - c.gb.y0));
  const extra: ShapeCandidate[] = [];
  for (let i = 0; i < strokes.length; i++) {
    if (covered.has(i)) continue;
    const gb = bboxOf(strokes[i]!.points);
    if (gb.y1 - gb.y0 < 0.75 * refH) continue;
    const prof = profileOf([strokes[i]!]);
    if (!prof || prof.aspect > 0.34) continue;
    const pc = classifyProfile(prof);
    if (!pc || pc.conf < 0.8) continue;
    if (pc.kind === "round" && prof.depth >= 0.06) {
      extra.push({ idxs: [i], kind: "round", isOpen: pc.isOpen, gb, strength: "weak" });
    } else if (pc.kind === "square" && prof.corners >= 1 && prof.endWidth >= 0.12) {
      extra.push({ idxs: [i], kind: "square", isOpen: pc.isOpen, gb, strength: "weak" });
    }
  }
  return extra.length > 0 ? [...shapes, ...extra] : shapes;
}

/** Estrae dall'inchiostro le shape classificate come GRAFFA o QUADRA
 *  (guardie in testa al blocco qui sopra). Le tonde restano. */
export function rewriteBrackets(strokes: SimpleStroke[]): BracketsRewrite {
  if (strokes.length === 0) return { strokes, brackets: [], boxes: [] };
  const boxes = strokes.map((s) => bboxOf(s.points));
  interface Cand {
    idxs: number[];
    kind: BracketKind;
    isOpen: boolean;
    cx: number;
    gh: number;
    gb: Box;
    strength: "strong" | "weak";
  }
  const cands: Cand[] = [];
  let allShapes = shapeCandidates(strokes);

  // PEZZO DI SOLE PARENTESI (5/10 sera, banco P1: «((» → «c», «))» → «1)»,
  // «{[(» → …; erano il 21% giusti). Se OGNI tratto dell'inchiostro appartiene a una
  // parentesi (tonde comprese) non c'è nessuna cifra con cui confonderle e il
  // modello — che su sole tonde legge «c», «1», «l» — non serve: si estraggono
  // TUTTE, in ordine di x, e la pipeline compone il LaTeX senza chiamarlo.
  // Guardie: ogni candidata è una tonda oppure ha firma FORTE (una quadra a un
  // solo tick può essere un «1» con flag), nessun tratto resta fuori, e le
  // candidate non si sovrappongono (si tiene la più alta/forte per tratto).
  // PASSAGGIO 1: soglie normali. PASSAGGIO 2 (solo se il primo lascia tratti scoperti): soglia
  // «rilassata» — in un pezzo di sole parentesi le altezze variano molto (5/10 notte, banco P1:
  // `}}`, `)]}`, `]}`, `{[(` erano 0–17% giusti perché la parentesi più bassa si auto-escludeva).
  // La COPERTURA di tutti i tratti resta la garanzia: se c'è anche una sola cifra, non è coperta.
  const relaxedShapes = shapeCandidates(strokes, true);
  const onlyBrackets =
    bracketOnlyPiece(strokes, allShapes) ??
    bracketOnlyPiece(strokes, relaxedShapes) ??
    bracketOnlyPiece(strokes, completeBracketOnly(strokes, relaxedShapes));
  if (onlyBrackets) {
    const sorted = onlyBrackets
      .map((c) => ({ kind: c.kind, isOpen: c.isOpen, cx: (c.gb.x0 + c.gb.x1) / 2, box: c.gb }))
      .sort((a, b) => a.cx - b.cx);
    return {
      strokes: [],
      brackets: sorted.map(({ box: _b, ...rest }) => rest),
      boxes: sorted.map((c) => c.box),
    };
  }

  // (7/10) `]` quasi dritta non rilevata: chiusura per esclusione (vedi inferMissingCloser)
  const inferred = inferMissingCloser(boxes, allShapes);
  if (inferred) allShapes = [...allShapes, inferred];
  for (const c of allShapes) {
    if (c.kind === "round") continue;
    cands.push({
      idxs: c.idxs,
      kind: c.kind,
      isOpen: c.isOpen,
      cx: (c.gb.x0 + c.gb.x1) / 2,
      gh: c.gb.y1 - c.gb.y0,
      gb: c.gb,
      strength: c.strength,
    });
  }
  if (cands.length === 0) return { strokes, brackets: [], boxes: [] };

  // GUARDIA 1 (soglia per-firma): le candidate devono essere più alte del
  // resto del contenuto (tonde comprese: restano nell'inchiostro per il
  // modello). Con la soglia unica 1,3× bastava una tonda (o una cifra)
  // quasi alta quanto le parentesi per BLOCCARE tutto — nella sequenza {[()
  // non veniva estratto nulla e il modello, che sbaglia le graffe, leggeva
  // male (4/10). Ora la soglia dipende dalla FIRMA:
  //   strong (graffa; quadra con tick a ENTRAMBE le estremità; quadra a un
  //          tratto con entrambe le estremità deviate) → 1,0×: alla stessa
  //          altezza del contenuto si estrae comunque;
  //   weak   (quadra multi-tratto con UN tick solo: può somigliare a un
  //          «1» con flag) → 1,3× come prima.
  const { othersMax, roundMax, contentXs } = contentRefs(boxes, allShapes);

  // ABBINAMENTO (5/10 notte): una candidata DEBOLE che chiude (o apre) una FORTE dello stesso tipo
  // è quasi certamente una parentesi vera: `10[2]` → `10[2)` (la `]` debole restava al modello,
  // che la legge «)»), `[2][3]`, `{2+1}3` (graffa chiusa letta «quadra debole» → si adegua
  // all'apertura FORTE graffa). Coppie di DEBOLI dello stesso tipo si promuovono a vicenda.
  // Guardia di altezza: una promossa deve comunque superare di ≥ 12% il resto del contenuto.
  promotePairs(cands, Math.max(othersMax, ROUND_FAMILY_FRAC * roundMax), contentXs);
  // (6/10) graffa debole letta TONDA: abbinamento esplicito con la `}` forte (vedi promoteRoundOpeners)
  const roundCands: Cand[] = allShapes
    .filter((c) => c.kind === "round")
    .map((c) => ({
      idxs: c.idxs,
      kind: c.kind,
      isOpen: c.isOpen,
      cx: (c.gb.x0 + c.gb.x1) / 2,
      gh: c.gb.y1 - c.gb.y0,
      gb: c.gb,
      strength: c.strength,
    }));
  cands.push(
    ...promoteRoundOpeners(cands, roundCands, Math.max(othersMax, ROUND_FAMILY_FRAC * roundMax), contentXs),
  );
  // (7/10) quadra forte aperta e `]` letta tonda: promozione della CHIUSURA (vedi promoteRoundClosers)
  cands.push(
    ...promoteRoundClosers(cands, roundCands, Math.max(othersMax, ROUND_FAMILY_FRAC * roundMax), contentXs),
  );

  if (othersMax <= 0 && roundMax <= 0) {
    // GUARDIA 2 (rivista, 4/10 e 5/10: «{[ scritti di seguito», graffa
    // SINGOLA disegnata da sola): pezzo di SOLE graffe/quadre. Prima si
    // estrae tutto tranne un'ANCORA lasciata al modello — ma la verifica
    // nel browser (5/10) ha mostrato che il modello sbaglia ANCHE
    // l'ancora (una graffa sola diventa «r»/«\sum») e la pipeline ha ora
    // il percorso «pezzo con SOLO segni sintetizzati» (LaTeX diretto
    // senza modello): si estraggono TUTTE le candidate FORTE, anche una
    // sola, e il modello non viene chiamato affatto. Le candidate deboli
    // (quadra multi-tratto con un tick solo: può essere una «1» con
    // flag) restano al modello.
    const strong = cands.filter((c) => c.strength === "strong").sort((a, b) => a.cx - b.cx);
    if (strong.length >= 1) {
      const removeA = new Set(strong.flatMap((c) => c.idxs));
      return {
        strokes: strokes.filter((_, i) => !removeA.has(i)),
        brackets: strong.map((c) => ({ kind: c.kind, isOpen: c.isOpen, cx: c.cx })),
        boxes: strong.map((c) => c.gb),
      };
    }
    return { strokes, brackets: [], boxes: [] };
  }

  // soglia: contenuto NON-parentesi (1,0× firma forte, 1,3× debole) e — in modo più morbido —
  // le tonde, della stessa famiglia (0,7× forte, 0,9× debole)
  const needOf = (c: { strength: "strong" | "weak" }) => {
    const strong = c.strength === "strong";
    return Math.max(
      (strong ? 1.0 : 1.3) * othersMax,
      (strong ? ROUND_FAMILY_FRAC : 0.9) * roundMax,
    );
  };
  const kept = cands.filter((c) => c.gh >= needOf(c) - 0.01);
  // (24/10, banco H=38 `[(5-2)*(4+1)]`: la `]` esterna (42 px, strong, due metà fuse) resta
  // sotto 0,7× la `)` interna (62 px) per 1,4 px e viene scartata mentre la `[` resta → `[…)».
  // Ogni parentesi nidificata ha la sua altezza: una FORTE scartata per poco (≥90% della soglia)
  // che ABBINATA (stesso tipo, lato opposto, contenuto in mezzo) a una tenuta si recupera — una
  // coppia abbinata con firma inequivocabile non è mai una cifra spuria. Solo strong: le weak
  // (un «1» con flag) restano escluse dal recupero.
  const dropped = cands.filter((c) => c.gh < needOf(c) - 0.01);
  for (const d of dropped) {
    if (d.strength !== "strong" || d.gh < 0.9 * needOf(d)) continue;
    const mate = kept.find(
      (k) =>
        k.kind === d.kind &&
        k.isOpen !== d.isOpen &&
        contentXs.some((x) => x > Math.min(k.cx, d.cx) && x < Math.max(k.cx, d.cx)),
    );
    if (mate) kept.push(d);
  }
  if (kept.length === 0) return { strokes, brackets: [], boxes: [] };

  const remove = new Set(kept.flatMap((c) => c.idxs));
  const keptSorted = [...kept].sort((a, b) => a.cx - b.cx);
  return {
    strokes: strokes.filter((_, i) => !remove.has(i)),
    brackets: keptSorted.map((c) => ({ kind: c.kind, isOpen: c.isOpen, cx: c.cx })),
    boxes: keptSorted.map((c) => c.gb),
  };
}

/** Ripristina le parentesi QUADRE e GRAFFE nel testo riconosciuto usando
 *  l'inchiostro come verità: ogni parentesi del testo (in ordine) che
 *  nell'inchiostro è una quadra diventa [ ] e una graffa { } (e viceversa,
 *  se il modello ha scritto un tipo diverso da quello disegnato). Le graffe
 *  dei COMANDI LaTeX (\frac{..}{..}, \sqrt{..}, ^{..}, _{..}) NON contano:
 *  solo le parentesi dell'utente. Se i conteggi non coincidono, non tocca
 *  nulla. */
export function restoreSquareBrackets(latex: string, strokes: SimpleStroke[]): string {
  if (!latex || strokes.length === 0) return latex;
  const shapes = detectBracketKinds(strokes);
  if (shapes.opens.every((k) => k === "round") && shapes.closes.every((k) => k === "round")) {
    return latex;
  }

  // Parentesi DELL'UTENTE nel testo: ( ) [ ] { } — MAI le graffe dei
  // comandi (\frac{..}{..}, \sqrt{..}, ^{..}, _{..} sono raggruppamenti
  // LaTeX, non parentesi scritte dallo studente).
  const KIND_CHAR: Record<BracketKind, string> = { square: "[", round: "(", curly: "{" };
  const KIND_CLOSE: Record<BracketKind, string> = { square: "]", round: ")", curly: "}" };
  const CMD_SKIP: Record<string, number> = {
    frac: 2,
    dfrac: 2,
    tfrac: 2,
    cfrac: 2,
    binom: 2,
    sqrt: 1,
  };
  // pos = inizio del delimitatore («\» compreso per le forme \{ ecc.,
  // len = 2) così la sostituzione riscrive la COPPIA («\{» → «[»).
  const parens: { pos: number; ch: string; len: number }[] = [];
  const stack: string[] = [];
  let wellFormed = true;
  const push = (pos: number, ch: string, len: number) => {
    parens.push({ pos, ch, len });
    if ("([{".includes(ch)) {
      stack.push(ch);
    } else {
      const o = stack.pop();
      const CLOSE_TO_OPEN: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
      if (!o || o !== CLOSE_TO_OPEN[ch]) wellFormed = false;
    }
  };
  const skipBalanced = (from: number): number => {
    // from punta su «{»: ritorna l'indice DOPO la graffa bilanciata
    let depth = 0;
    let m = from;
    while (m < latex.length) {
      const c = latex[m]!;
      if (c === "\\") m++;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return m + 1;
      }
      m++;
    }
    return m;
  };

  let i = 0;
  while (i < latex.length) {
    const ch = latex[i]!;
    if (ch === "\\") {
      const d = latex[i + 1];
      if (d && "()[]{}".includes(d)) {
        // \{ \} \[ \] \( \): parentesi dell'utente delimitata
        push(i, d, 2);
        i += 2;
        continue;
      }
      let k = i + 1;
      let name = "";
      while (k < latex.length && /[a-zA-Z]/.test(latex[k]!)) {
        name += latex[k];
        k++;
      }
      if (name === "left" || name === "right") {
        // \left\{ \right\} ecc.: il delimitatore che segue è dell'utente
        const d2 = latex[k];
        if (d2 === "\\") {
          const d3 = latex[k + 1];
          if (d3 && "()[]{}".includes(d3)) {
            push(k, d3, 2);
            i = k + 2;
          } else {
            i = k + 2;
          }
          continue;
        }
        if (d2 && "()[]{}".includes(d2)) {
          push(k, d2, 1);
          i = k + 1;
          continue;
        }
        i = k;
        continue;
      }
      const groups = CMD_SKIP[name];
      if (groups) {
        // salta le `groups` graffe bilanciate del comando
        let need = groups;
        let m = k;
        while (need > 0 && m < latex.length) {
          if (latex[m] === "{") {
            m = skipBalanced(m);
            need--;
          } else {
            m++;
          }
        }
        i = m;
        continue;
      }
      i = k;
      continue;
    }
    if (ch === "^" || ch === "_") {
      // esponente/indice: le graffe non sono parentesi dell'utente
      if (latex[i + 1] === "{") {
        i = skipBalanced(i + 1);
        continue;
      }
      i++;
      continue;
    }
    if ("([{".includes(ch) || ")]}".includes(ch)) push(i, ch, 1);
    i++;
  }
  if (!wellFormed || stack.length > 0) return latex;

  const opens = parens.filter((p) => "([{".includes(p.ch));
  const closes = parens.filter((p) => ")]}".includes(p.ch));
  if (opens.length !== shapes.opens.length || closes.length !== shapes.closes.length) {
    return latex;
  }

  const replacements = new Map<number, { len: number; ch: string }>();
  opens.forEach((p, i) => {
    const want = KIND_CHAR[shapes.opens[i]!];
    if (p.ch !== want) replacements.set(p.pos, { len: p.len, ch: want });
  });
  closes.forEach((p, i) => {
    const want = KIND_CLOSE[shapes.closes[i]!];
    if (p.ch !== want) replacements.set(p.pos, { len: p.len, ch: want });
  });
  if (replacements.size === 0) return latex;
  let out = "";
  let cursor = 0;
  for (const p of [...parens].sort((a, b) => a.pos - b.pos)) {
    const r = replacements.get(p.pos);
    if (!r) continue;
    out += latex.slice(cursor, p.pos) + r.ch;
    cursor = p.pos + r.len;
  }
  out += latex.slice(cursor);
  return out;
}

// ─── Rete di sicurezza anti-«\sum» (5/10: «la graffa disegnata viene
// spesso riconosciuta come SUM») ──────────────────────────────────────────
// Una graffa che SFUGGE all'estrazione geometrica resta nell'inchiostro e
// il modello CoMER la decodifica «\sum» (token del vocabolario; in queste
// espressioni una sommatoria non esiste mai). Questo helper individua
// nell'inchiostro RESIDUO (quello dato al modello) le shape ALTE con firma
// da graffa: sia classificate «curly», sia «round deboli» con la punta
// sporgente — una graffa sfuggita ha esattamente quel profilo, e il lato
// (aperta/chiusa) derivato dalla posizione della punta coincide con quello
// della graffa. Il risultato serve a useMathRecognition per sostituire ogni
// «\sum» del modello con la graffa attestata dall'inchiostro.
export interface CurlyResidue {
  isOpen: boolean;
  cx: number;
}

export function detectCurlyResidues(strokes: SimpleStroke[]): CurlyResidue[] {
  if (strokes.length === 0) return [];
  return shapeCandidates(strokes)
    .filter((c) => {
      const gh = c.gb.y1 - c.gb.y0;
      if (gh < 40) return false; // una graffa è sempre alta
      return c.kind === "curly" || (c.kind === "round" && c.strength === "weak");
    })
    .map((c) => ({ isOpen: c.isOpen, cx: (c.gb.x0 + c.gb.x1) / 2 }));
}
