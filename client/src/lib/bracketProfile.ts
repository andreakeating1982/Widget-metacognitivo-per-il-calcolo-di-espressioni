// ⚠️ PROFILO DELLA CORDA (6/10) — misure di forma INVARIANTI alla pendenza e
// alla scala per decidere se un gruppo di tratti è una PARENTESI (tonda,
// quadra, graffa) o una CIFRA (0 2 3 5 6 7 8 9…).
//
// Il classificatore storico di squareBrackets.ts confronta medie di fascia
// della x CON la x della parte centrale: una parentesi scritta inclinata
// (la pendenza è normale a mano) sposta le fasce alte e basse in direzioni
// opposte e quella confronto sbaglia (quadra inclinata → «tonda»; arco
// profondo con apice asimmetrico → «graffa»; «2» → «}»). Qui si misura la
// distanza dalla CORDA (retta fra il centro della fascia alta e il centro
// della fascia bassa): una retta inclinata ha profilo nullo, un arco una
// parabola, una quadra un altopiano, una graffa un altopiano con la punta.
import type { SimpleStroke } from "./dotSigns";

export const NB = 20; // fasce orizzontali

export interface Profile {
  /** altezza e larghezza dell'ingombro */
  gh: number;
  gw: number;
  /** corpo a SINISTRA della corda → parentesi APERTA («(», «[», «{») */
  open: boolean;
  /** scostamento (px, + = destra della corda) al centro [0,44–0,56] e alle «spalle»
   *  [0,22–0,34]∪[0,66–0,78]: la punta di una graffa sta al centro */
  uMid: number;
  uSh: number;
  /** profondità massima / altezza */
  depth: number;
  /** profilo normalizzato (1 = massimo), una voce per fascia (NaN = vuota) */
  w: number[];
  /** escursione di w nella parte centrale [0,2–0,8] */
  flat: number;
  /** w ai quarti (t ∈ [0,22–0,34] ∪ [0,66–0,78]): ≈1 altopiano, ≈0,83 arco, <0,7 punta */
  g: number;
  /** w al centro (t ∈ [0,44–0,56]) */
  mid: number;
  /** asimmetria speculare media rispetto all'asse orizzontale */
  asym: number;
  /** tratto chiuso (cappio): 0, 6, 8, 9… */
  closed: boolean;
  /** convessità massima del profilo (seconda differenza positiva, in unità di
   *  profondità) nelle due metà: un arco liscio è concavo ovunque (≤ 0), una
   *  graffa ha un FLESSO fra spalla e punta (> 0,1) */
  convex: number;
  /** ANGOLI (virate ≥ 55° su ~7% dell'altezza) e TICK orizzontali ai due capi:
   *  una quadra ne ha, una tonda (arco liscio) no */
  corners: number;
  hTick: boolean;
  /** due tratti si incrociano o uno termina nell'INTERNO dell'altro (y, x, +, 4):
   *  nelle parentesi i tratti si toccano solo alle estremità */
  crossing: boolean;
  aspect: number;
  /** ampiezza orizzontale delle estremità (8% alto e basso) / altezza: i «tick» di
   *  quadre e graffe sono larghi (≥ 0,08), le punte di una tonda no (≲ 0,05) */
  endWidth: number;
  /** frazione d'altezza (dall'estremità) a cui |w| supera 0,75: quadra ≲ 0,15,
   *  tonda ≈ 0,28, graffa ≳ 0,35 (le spalle stanno sotto 0,75) */
  rise: number;
}

interface Pt {
  x: number;
  y: number;
}

/** Infittisce la polilinea (≈ 1,5 px) per non dipendere dalla frequenza di campionamento. */
export function densify(points: Pt[], step = 1.5): Pt[] {
  if (points.length < 2) return points.slice();
  const out: Pt[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 1; k <= n; k++) {
      out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
  }
  return out;
}

function isClosedLoop(stroke: Pt[], gh: number): boolean {
  if (stroke.length < 8) return false;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of stroke) {
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  // tratto che da solo non è «alto» (un tick, un puntino): non può essere un cappio da cifra
  if (y1 - y0 < 0.45 * gh) return false;
  const dense = densify(stroke, 2);
  const n = dense.length;
  // lunghezza d'arco cumulata
  const arc: number[] = [0];
  for (let i = 1; i < n; i++) {
    arc.push(arc[i - 1]! + Math.hypot(dense[i]!.x - dense[i - 1]!.x, dense[i]!.y - dense[i - 1]!.y));
  }
  const total = arc[n - 1]!;
  if (total <= 0) return false;
  const near = 0.13 * gh;
  for (let i = 0; i < n; i += 2) {
    for (let j = i + 1; j < n; j += 2) {
      if (arc[j]! - arc[i]! < 0.4 * total) continue; // punti vicini lungo il tratto non sono un cappio
      if (Math.hypot(dense[i]!.x - dense[j]!.x, dense[i]!.y - dense[j]!.y) <= near) return true;
    }
  }
  return false;
}

/** Posizione relativa (0–1) lungo `b` del punto più vicino a `e`, e relativa distanza. */
function nearestOn(b: Pt[], e: Pt): { frac: number; dist: number } {
  let best = Infinity;
  let bi = 0;
  for (let i = 0; i < b.length; i++) {
    const d = Math.hypot(b[i]!.x - e.x, b[i]!.y - e.y);
    if (d < best) {
      best = d;
      bi = i;
    }
  }
  return { frac: b.length > 1 ? bi / (b.length - 1) : 0, dist: best };
}

function segIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

export function hasCrossing(dense: Pt[][], gh: number): boolean {
  const tol = 0.07 * gh;
  for (let i = 0; i < dense.length; i++) {
    for (let j = 0; j < dense.length; j++) {
      if (i === j) continue;
      const A = dense[i]!;
      const B = dense[j]!;
      if (A.length < 2 || B.length < 2) continue;
      // estremità di A che toccano l'INTERNO di B
      for (const e of [A[0]!, A[A.length - 1]!]) {
        const n = nearestOn(B, e);
        if (n.dist <= tol && n.frac >= 0.22 && n.frac <= 0.78) return true;
      }
      if (j < i) continue;
      // incroci veri fra segmenti (campionati ogni ~6 px)
      const sa = A.filter((_, k) => k % 4 === 0 || k === A.length - 1);
      const sb = B.filter((_, k) => k % 4 === 0 || k === B.length - 1);
      for (let p = 0; p < sa.length - 1; p++) {
        for (let q = 0; q < sb.length - 1; q++) {
          if (segIntersect(sa[p]!, sa[p + 1]!, sb[q]!, sb[q + 1]!)) {
            const fa = p / Math.max(1, sa.length - 1);
            const fb = q / Math.max(1, sb.length - 1);
            if (fa > 0.1 && fa < 0.9 && fb > 0.1 && fb < 0.9) return true;
          }
        }
      }
    }
  }
  return false;
}

/** Virate nette (≥ 55°) lungo un tratto: finestra ≈ 7% dell'altezza dell'insieme. */
export function cornersOf(stroke: Pt[], gh: number): number {
  const dense = densify(stroke, 1.5);
  const k = Math.max(3, Math.round((0.07 * gh) / 1.5));
  if (dense.length < 2 * k + 2) return 0;
  const ang = (a: Pt, b: Pt) => Math.atan2(b.y - a.y, b.x - a.x);
  const turn: number[] = new Array(dense.length).fill(0);
  for (let i = k; i < dense.length - k; i++) {
    let d = ang(dense[i]!, dense[i + k]!) - ang(dense[i - k]!, dense[i]!);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    turn[i] = Math.abs(d);
  }
  let count = 0;
  const thr = (55 * Math.PI) / 180;
  let i = k;
  while (i < dense.length - k) {
    if (turn[i]! >= thr) {
      count++;
      i += 2 * k; // stesso angolo
    } else i++;
  }
  return count;
}

/** Tratto quasi orizzontale (|dx| ≥ 2|dy|) lungo ≥ 5% dell'altezza, ai capi alto/basso. */
export function hasHorizontalTick(dense: Pt[][], y0: number, y1: number, gh: number): boolean {
  for (const st of dense) {
    if (st.length < 3) continue;
    let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
    for (const q of st) {
      sx0 = Math.min(sx0, q.x);
      sx1 = Math.max(sx1, q.x);
      sy0 = Math.min(sy0, q.y);
      sy1 = Math.max(sy1, q.y);
    }
    const w = sx1 - sx0;
    const h = sy1 - sy0;
    const atTop = sy1 <= y0 + 0.2 * gh;
    const atBot = sy0 >= y1 - 0.2 * gh;
    // tratto separato che è un tick (breve, orizzontale) in cima o in fondo
    if ((atTop || atBot) && w >= 0.05 * gh && w >= 2 * h) return true;
  }
  return false;
}

export function profileOf(strokes: SimpleStroke[], groupStrokes?: SimpleStroke[]): Profile | null {
  const dense: Pt[][] = strokes.map((s) => densify(s.points));
  const all = dense.flat();
  if (all.length < 4) return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of all) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  const gh = y1 - y0;
  const gw = x1 - x0;
  if (gh < 8) return null;

  // medie di fascia
  const sum = new Array<number>(NB).fill(0);
  const cnt = new Array<number>(NB).fill(0);
  for (const p of all) {
    const b = Math.min(NB - 1, Math.max(0, Math.floor(((p.y - y0) / gh) * NB)));
    sum[b] = sum[b]! + p.x;
    cnt[b] = cnt[b]! + 1;
  }
  const mean = sum.map((s, i) => (cnt[i]! > 0 ? s / cnt[i]! : NaN));
  // fasce vuote: interpolazione dai vicini
  for (let i = 0; i < NB; i++) {
    if (!isNaN(mean[i]!)) continue;
    let l = i - 1;
    while (l >= 0 && isNaN(mean[l]!)) l--;
    let r = i + 1;
    while (r < NB && isNaN(mean[r]!)) r++;
    if (l >= 0 && r < NB) mean[i] = mean[l]! + ((mean[r]! - mean[l]!) * (i - l)) / (r - l);
    else if (l >= 0) mean[i] = mean[l]!;
    else if (r < NB) mean[i] = mean[r]!;
  }

  // corda: centro della fascia alta (prime 2 fasce) → centro della fascia bassa (ultime 2)
  const xTop = (mean[0]! + mean[1]!) / 2;
  const xBot = (mean[NB - 1]! + mean[NB - 2]!) / 2;
  const tc = (b: number) => (b + 0.5) / NB;
  const tTop = tc(0.5); // centro delle prime 2 fasce = confine 0|1
  const tBot = tc(NB - 1.5);
  const u = mean.map((m, b) => m - (xTop + ((xBot - xTop) * (tc(b) - tTop)) / (tBot - tTop)));

  // lato del corpo: segno medio nella parte centrale
  let sm = 0;
  let sn = 0;
  for (let b = 0; b < NB; b++) {
    const t = tc(b);
    if (t >= 0.3 && t <= 0.7) {
      sm += u[b]!;
      sn++;
    }
  }
  const uAvg = (lo: number, hi: number): number => {
    let a = 0;
    let n = 0;
    for (let b = 0; b < NB; b++) {
      const t = tc(b);
      if (t >= lo && t <= hi) {
        a += u[b]!;
        n++;
      }
    }
    return n > 0 ? a / n : 0;
  };
  const uMid = uAvg(0.44, 0.56);
  const uSh = (uAvg(0.22, 0.34) + uAvg(0.66, 0.78)) / 2;
  const open = sm / Math.max(1, sn) < 0;
  const s = u.map((v) => (open ? -v : v)); // positivo = verso il corpo
  let D = 0;
  for (let b = 0; b < NB; b++) {
    const t = tc(b);
    if (t >= 0.15 && t <= 0.85) D = Math.max(D, s[b]!);
  }
  const depth = D / gh;
  const w = s.map((v) => (D > 1e-6 ? v / D : NaN));

  const avg = (lo: number, hi: number): number => {
    let a = 0;
    let n = 0;
    for (let b = 0; b < NB; b++) {
      const t = tc(b);
      if (t >= lo && t <= hi && !isNaN(w[b]!)) {
        a += w[b]!;
        n++;
      }
    }
    return n > 0 ? a / n : NaN;
  };
  let mx = -Infinity;
  let mn = Infinity;
  for (let b = 0; b < NB; b++) {
    const t = tc(b);
    if (t >= 0.2 && t <= 0.8 && !isNaN(w[b]!)) {
      mx = Math.max(mx, w[b]!);
      mn = Math.min(mn, w[b]!);
    }
  }
  const g = (avg(0.22, 0.34) + avg(0.66, 0.78)) / 2;
  const mid = avg(0.44, 0.56);
  let as = 0;
  let an = 0;
  for (let b = 1; b < NB / 2 - 1; b++) {
    const a = w[b]!;
    const c = w[NB - 1 - b]!;
    if (isNaN(a) || isNaN(c)) continue;
    as += Math.abs(a - c);
    an++;
  }
  // profilo lisciato [1,2,1]/4 e seconda differenza a passo 2 fasce
  const ws = w.map((v, i) => {
    const a = isNaN(w[i - 1] ?? NaN) ? v : w[i - 1]!;
    const c = isNaN(w[i + 1] ?? NaN) ? v : w[i + 1]!;
    return (a + 2 * v + c) / 4;
  });
  let convex = -Infinity;
  for (let b = 2; b < NB - 2; b++) {
    const t = tc(b);
    if (!((t >= 0.12 && t <= 0.45) || (t >= 0.55 && t <= 0.88))) continue;
    const d2 = ws[b - 2]! + ws[b + 2]! - 2 * ws[b]!;
    if (!isNaN(d2)) convex = Math.max(convex, d2);
  }
  const closed = dense.some((st) => isClosedLoop(st, gh));
  // «rise»: da ciascuna estremità, quanto in fretta il profilo raggiunge il 75% della profondità
  const riseFrom = (fromTop: boolean): number => {
    for (let k = 0; k < NB; k++) {
      const b = fromTop ? k : NB - 1 - k;
      if (!isNaN(w[b]!) && w[b]! >= 0.75) return (k + 0.5) / NB;
    }
    return 1;
  };
  const rise = (riseFrom(true) + riseFrom(false)) / 2;
  const extentIn = (lo: number, hi: number): number => {
    let a = Infinity;
    let b = -Infinity;
    for (const pt of all) {
      if (pt.y >= lo && pt.y <= hi) {
        a = Math.min(a, pt.x);
        b = Math.max(b, pt.x);
      }
    }
    return isFinite(a) ? b - a : 0;
  };
  const denseGroup: Pt[][] = groupStrokes ? groupStrokes.map((s) => densify(s.points)) : dense;
  const crossing = denseGroup.length >= 2 && hasCrossing(denseGroup, gh);
  const corners = dense.reduce((a, st) => a + cornersOf(st, gh), 0);
  const hTick = dense.length >= 2 && hasHorizontalTick(dense, y0, y1, gh);
  const endWidth = (extentIn(y0, y0 + 0.08 * gh) + extentIn(y1 - 0.08 * gh, y1)) / 2 / gh;
  return {
    convex: isFinite(convex) ? convex : 0,
    corners,
    hTick,
    uMid,
    uSh,
    crossing,
    endWidth,
    rise,
    gh,
    gw,
    open,
    depth,
    w,
    flat: isFinite(mx - mn) ? mx - mn : NaN,
    g,
    mid,
    asym: an > 0 ? as / an : NaN,
    closed,
    aspect: gw / gh,
  };
}

export type ProfileKind = "round" | "square" | "curly";

export interface ProfileClass {
  kind: ProfileKind;
  isOpen: boolean;
  /** 0–1: quanto la forma è inequivocabile (serve a decidere se estrarre) */
  conf: number;
}

/** Graffa = PUNTA centrale che emerge dalle «spalle» (v. test "graffa" di
 *  squareBrackets.test.ts): (A) punta oltre la corda dal lato OPPOSTO alle
 *  spalle (graffa a «3» rovesciata: spalle esterne, punta interna), oppure
 *  (B) punta dallo stesso lato ma ≥ 35% più profonda delle spalle (graffa
 *  stampata). Una «3» ha l'incavo timido: mai oltre la corda. */
export function curlyTip(p: Profile): "A" | "B" | null {
  const g = p.gh;
  // ⚠️ (5/10 notte, banco tipStats su 200 semi/classe) le estremità di una graffa si arricciano
  // poco (endWidth p10/50/90 = 0,08/0,11/0,13); la BASE della cifra «2» è larga (0,30–0,41: 106
  // «2» su 200 risultavano con punta B, qualcuna sfuggiva a digitLike e diventava `}` →
  // `-(2+3)` → `-(}+3)`) → mai graffa se endWidth > 0,22.
  if (p.endWidth > 0.22) return null;
  if (p.uMid * p.uSh < 0 && Math.abs(p.uMid) >= 0.9 * Math.abs(p.uSh) && Math.abs(p.uMid) >= 0.08 * g) return "A";
  if (
    p.uMid * p.uSh >= 0 &&
    Math.abs(p.uMid) >= 1.6 * Math.abs(p.uSh) &&
    Math.abs(p.uMid) >= 0.06 * g &&
    p.rise >= 0.4 &&
    p.g <= 0.6
  ) {
    // …e una TONDA con la pancia profonda (`(` e `)` 2–3% dei casi: rise 0,40–0,42 ed endWidth
    // 0,02–0,07, contro una graffa vera: rise ≥ 0,45 ed endWidth ≥ 0,08) non è una punta.
    if (p.rise < 0.44 && p.endWidth < 0.075) return null;
    return "B";
  }
  return null;
}

/** Veto «cifra»: una cifra (0 2 3 5 6 7 8 9) NON è mai una parentesi.
 *  Soglie tarate sul banco (lib/bench/profileStats2.test.ts): le parentesi
 *  stanno sotto aspect 0,36 / asym 0,33 / flat 0,67 (graffa 0,84); le cifre
 *  sopra aspect 0,41 / flat 0,82 (tranne «1»: asta). Un segnale FORTE basta,
 *  due segnali DEBOLI insieme bastano. La graffa (punta chiara) ha un
 *  profilo ondulato per natura: per lei contano solo cappio, incrocio e
 *  larghezza. */
export function digitLike(p: Profile): boolean {
  if (p.closed) return true; // 0 6 8 9
  if (p.crossing) return true; // y x + 4
  const tip = curlyTip(p);
  if (tip) return p.aspect > (Math.abs(p.uMid) >= 0.12 * p.gh ? 0.5 : 0.42) || (!isNaN(p.asym) && p.asym > 0.4);
  if (p.aspect > 0.47) return true;
  if (!isNaN(p.asym) && p.asym > 0.55) return true; // 5 7 (profilo non speculare)
  if (!isNaN(p.flat) && p.flat > 1.0) return true; // 2 3 4 5 (profilo ondulato)
  let soft = 0;
  if (p.aspect > 0.39) soft++;
  if (!isNaN(p.asym) && p.asym > 0.38) soft++;
  if (!isNaN(p.flat) && p.flat > 0.85) soft++;
  return soft >= 2;
}

/** Classifica un profilo come tonda / quadra / graffa (+ aperta/chiusa), o null. */
export function classifyProfile(p: Profile): ProfileClass | null {
  if (digitLike(p)) return null;
  if (p.depth < 0.03 && !curlyTip(p)) return null; // asta dritta: «1», «|», o parentesi appena accennata
  const tip = curlyTip(p);
  // graffa: la PUNTA indica il verso (a sinistra = «{» aperta)
  if (tip) return { kind: "curly", isOpen: p.uMid < 0, conf: 0.9 };
  const isOpen = p.open;
  // una quadra non è ondulata; una «3» con le due gobbe sì
  if (!isNaN(p.flat) && p.flat > 0.75) return null;
  // quadra: ANGOLI netti ai capi o tick orizzontali separati; tonda: arco liscio.
  // (endWidth non basta: un arco profondo ha le estremità larghe quanto una quadra)
  // 5/10 notte: l'«angolo» di una TONDA stretta è l'uncino finale (endWidth ≲ 0,05–0,09, rise ≥ 0,23);
  // una quadra vera ha un tick largo (endWidth ≥ 0,12–0,23, rise ≲ 0,2). Un angolo senza tick
  // largo non è una quadra (banco: «(2+3)» → «(2+3]», `)` con corners 1 endW 0,05 rise 0,40).
  const tickWide = p.endWidth >= 0.08;
  // (6/10) UN solo angolo con un tick «medio» (endWidth 0,08–0,12) NON basta: è il rumore di
  // quantizzazione di una TONDA stretta. Caso reale catturato dal canvas del browser (clientX/Y
  // troncati a interi + riscalatura 136/140): `(` di `{[(3+2)]}` 9×55 px, profilo identico alla
  // versione non quantizzata tranne `corners 0→1` ed `endW 0,06→0,08` ⇒ letta quadra ⇒ `{[[3+2)]}`.
  // Banco `lib/bench/squareRise.test.ts` (200 semi × 2 stili, quantizzazione del canvas reale, H=38):
  // la regola «corners≥1 ∧ endW≥0,08» scatta su 1/800 tonde (endW 0,09, rise 0,23) e su 655/800
  // quadre, TUTTE con endW ≥ 0,13 (p10 0,16): con endW ≥ 0,12 le quadre restano intatte. NON si può
  // usare `rise` (le quadre vere arrivano a 0,47: tagliarle a ≤ 0,27 ne perderebbe ~120/800).
  // Una quadra vera ha DUE angoli (alto e basso): con due angoli basta endW ≥ 0,08.
  const tickVeryWide = p.endWidth >= 0.12;
  if (p.hTick || (p.corners >= 1 && tickVeryWide) || (p.corners >= 2 && tickWide)) {
    return { kind: "square", isOpen, conf: (p.corners >= 2 && tickWide) || p.hTick ? 0.9 : 0.8 };
  }
  // quadra «morbida»: salita rapidissima alle spalle (rise ≤ 0,2) e punte LARGHE senza angolo netto
  // (tick scritto a mano, curvo): finora scartata come «tonda» o persa (audit: 9–20% dei `[` `]`)
  if (p.rise <= 0.2 && p.endWidth >= 0.12 && p.g >= 0.65) return { kind: "square", isOpen, conf: 0.8 };
  return { kind: "round", isOpen, conf: p.endWidth <= 0.1 ? 0.8 : 0.65 };
}

/** Arco LISCIO inequivocabile: nessun angolo, nessuna punta, profilo da parabola
 *  (g ≈ 0,71–0,83; una graffa sta sotto 0,66). Serve a RICLASSIFICARE «tonda» una
 *  forma che il legacy aveva preso per graffa (arco profondo con apice asimmetrico). */
export function smoothArc(p: Profile): boolean {
  return p.corners === 0 && !p.hTick && !curlyTip(p) && p.g >= 0.66 && p.rise < 0.38 && p.convex < 0.12 && p.endWidth <= 0.14;
}

/** (6/10) TONDA «a punta» che NON è una graffa: nessun angolo, estremità SENZA uncino
 *  (endWidth < 0,05) e stretta (aspect < 0,24). Una graffa vera ha gli uncini alle estremità
 *  (endWidth p10/p50/p90 = 0,07/0,10/0,13), almeno uno spigolo e aspect p10 = 0,21; una tonda
 *  poco profonda e tremolante (tipica a cifre piccole e con coordinate a pixel interi) ha
 *  endWidth 0,01–0,04, nessun angolo e aspect ≤ 0,20 ma può avere g 0,47–0,57 e rise 0,40–0,45
 *  come una punta («)» di `12(3)` → «}»). Banco `lib/bench/curlyStats.test.ts` (10 semi × 3 stili,
 *  5 configurazioni di altezza e arrotondamento): 0 graffe vere su 722–775 soddisfano la regola;
 *  corregge 35/38 false graffe a H=38 con pixel interi (9/9 a decimali). */
export function hooklessRound(p: Profile): boolean {
  return p.corners === 0 && p.endWidth < 0.05 && p.aspect < 0.24;
}
