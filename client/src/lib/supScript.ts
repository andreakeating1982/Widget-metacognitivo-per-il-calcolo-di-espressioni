// ─── Esponenti in apice: analisi geometrica dei tratti (scrittura a mano) ──
//
// Il modello di riconoscimento (CoMER/ONNX) PERDE spesso gli esponenti
// scritti piccoli e in alto (x², (2x)³): la trascrizione diventa «x» (apice
// sparito) o «x2» (letto come 2x). Come già fatto per i segni puntinati
// (vedi `dotSigns.ts`), si risolve con un'analisi GEOMETRICA dell'inchiostro:
//
//   1. i tratti vengono raggruppati in caratteri (cluster);
//   2. un cluster è un ESPONENTE se è piccolo (altezza < 62% della mediana)
//      e sta chiaramente IN ALTO rispetto al carattere alla sua sinistra
//      (la base);
//   3. gli esponenti vengono TOLTI dall'inchiostro principale (così il
//      modello non li legge più come cifre a livello base) e riconosciuti
//      A PARTE, ingranditi, in modalità «numero» (le cifre isolate si
//      riconoscono benissimo);
//   4. il risultato viene riattaccato al LaTeX come ^{d} nel punto giusto
//      (dopo la lettera o la parentesi della base), con una mappatura
//      proporzionale della posizione della base tra i cluster.

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

// Soglie in px (canvas ~150–170 px di altezza, carattere ~50–70 px)
// (segnalazione 27/9: esponenti attaccati alla base non venivano separati
// e il modello li leggeva come cifra a livello base, es. 5² → «52»)
const GAP_X = 12; // max gap orizzontale tra tratti dello stesso carattere
const GAP_Y = 12; // max gap verticale tra tratti dello stesso carattere
const SUP_MAX_H = 0.75; // altezza apice < 75% dell'altezza di riferimento
//   (27/9-septies: da 68% a 75% — un apice medio-ALTO sfuggiva e il modello
//   lo leggeva come cifra a livello base, es. x² → «x2»)
const SUP_MAX_GAP = 1.4; // distanza orizzontale apice→base < 1.4 × riferimento
/* 27/9-duodecies: da 0.08 a 0.05. Il centro della base cambia con la sua
   ALTEZZA: contro una «)» molto alta (cy = centro parentesi) la soglia era
   più severa in valore assoluto che contro la cifra, e un esponente
   scritto poco sollevato passava col 2 interno ma veniva scartato con
   quello esterno (trascrizione (2²) senza la potenza sulla «)»); il 5%
   resta comunque sopra la riga di base: un glifo scritto ALLA BASE
   (centro ≈ centro della base) viene ancora escluso. */
const SUP_RISE = 0.05; // centro dell'apice almeno 5% sopra il centro della base
// ⚠️ 6/10 (banco P6: `(-2)^2` 5 letture su 6 sbagliate, `(2+3)(4-1)` → `(2+3)^{4}(-1)`): la cifra
// DENTRO una parentesi è alta ~74% della parentesi e il suo centro sta ~6% sopra il centro di
// questa → soddisfaceva TUTTE le soglie e diventava «apice» della «(» o della «)». Un vero
// esponente sta in ALTO: il suo FONDO non scende sotto il centro della base (tolleranza 12% h).
const SUP_BOTTOM = 0.12;
const BASE_MIN_H = 0.45; // altezza minima di una BASE valida (% del riferimento)
//   (27/9-novies, «potenza di potenza» (2²)²: dentro le parentesi la CIFRA
//   è più bassa delle parentesi (h ≈ 50–70%) e con il vecchio pool di basi
//   «normali» (h ≥ 75%) l'apice del 2 interno NON poteva agganciarsi al 2:
//   finiva sulla parentesi di apertura — esponente nel posto sbagliato,
//   «(²2)²» — o restava all'inchiostro e veniva letto come cifra a livello
//   base. Gli apici veri (≤ ~25% del riferimento) restano esclusi dal pool,
//   quindi nessuna catena apice→apice.)

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

function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** q-ésimo percentile (0..1). Serve perché la MEDIANA da sola fallisce
 *  con pochi caratteri: in «x²» le altezze sono [57, 31] → mediana 44 →
 *  soglia 27 → il piccolo 2 (31 px) viene considerato «normale» e resta
 *  al modello, che lo legge come «<2» (segnalazione 26/9: «x²» → «x<2»). */
function percentile(vals: number[], q: number): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

interface Cluster {
  idx: number[]; // indici dei tratti
  box: Box; // bbox unita
  cx: number;
  /** solo per le BASI VIRTUALI (elementi estratti dall'inchiostro): chiave dell'elemento */
  key?: string;
}

/** Elemento TOLTO dall'inchiostro (parentesi chiusa quadra/graffa, 8) che può essere la
 *  BASE di un esponente: «[3]²», «{x+1}³», «8²». Senza di lui l'esponente si agganciava al
 *  carattere precedente nell'inchiostro rimasto («[3²]»). */
export interface ExtraBase {
  key: string;
  box: Box;
}

/** Raggruppa i tratti in caratteri: due tratti sono lo stesso carattere se
 *  i loro bounding box sono vicini sia in orizzontale sia in verticale. */
function clusterStrokes(strokes: SimpleStroke[]): Cluster[] {
  const boxes = strokes.map((s) => bboxOf([s]));
  const parent = strokes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let i = 0; i < strokes.length; i++) {
    for (let j = i + 1; j < strokes.length; j++) {
      const dx = Math.max(boxes[i]!.x0, boxes[j]!.x0) - Math.min(boxes[i]!.x1, boxes[j]!.x1);
      const dy = Math.max(boxes[i]!.y0, boxes[j]!.y0) - Math.min(boxes[i]!.y1, boxes[j]!.y1);
      if (dx <= GAP_X && dy <= GAP_Y) union(i, j);
    }
  }
  const map = new Map<number, number[]>();
  for (let i = 0; i < strokes.length; i++) {
    const r = find(i);
    if (!map.has(r)) map.set(r, []);
    map.get(r)!.push(i);
  }
  const clusters: Cluster[] = [];
  for (const idx of map.values()) {
    const box = bboxOf(idx.map((i) => strokes[i]!));
    clusters.push({ idx, box, cx: (box.x0 + box.x1) / 2 });
  }
  clusters.sort((a, b) => a.cx - b.cx);
  return clusters;
}

/** Il cluster è un OPERATORE «−» o «+» (non una cifra né una lettera)?
 *  5/10 sera, banco P5/P6: il «+» e il «−» stanno sull'ASSE della riga, cioè PIÙ IN
 *  ALTO del centro di una lettera minuscola («x», «y»: centro a ~70% dell'altezza
 *  cifra) e sono più piccoli di una cifra → soddisfano TUTTE le soglie di un apice
 *  (h < 75%, centro ≥ 5% sopra la base): «x+1» → «x^{+}1», «2x−1» → «2x^{−}1», e il
 *  modello non vedeva più il segno («2·1», «x ( x )», «1 + 1»). Un esponente
 *  «+»/«−» isolato non esiste in questo dominio (potenze con esponente intero
 *  positivo), quindi i segni non sono MAI apici né basi di apici.
 *   - «−»: un tratto solo, ben più largo che alto;
 *   - «+»: una sbarra orizzontale e una verticale che si incrociano NEL CENTRO
 *     (una «t» ha la sbarra al 25–40% dell'asta: non è un «+»). */
function isOperatorCluster(c: Cluster, strokes: SimpleStroke[]): boolean {
  const bs = c.idx.map((i) => bboxOf([strokes[i]!]));
  const dims = bs.map((b) => ({ w: b.x1 - b.x0, h: b.y1 - b.y0 }));
  if (c.idx.length === 1) {
    const { w, h } = dims[0]!;
    return w >= 3 * Math.max(h, 2);
  }
  if (c.idx.length !== 2) return false;
  const hi = dims.findIndex((d) => d.w >= 1.8 * Math.max(d.h, 2));
  const vi = dims.findIndex((d) => d.h >= 1.8 * Math.max(d.w, 2));
  if (hi < 0 || vi < 0 || hi === vi) return false;
  const hb = bs[hi]!;
  const vb = bs[vi]!;
  const hw = hb.x1 - hb.x0;
  const vh = vb.y1 - vb.y0;
  if (hw < 0.6 * vh || hw > 1.7 * vh) return false;
  const vx = (vb.x0 + vb.x1) / 2;
  const hy = (hb.y0 + hb.y1) / 2;
  const fx = (vx - hb.x0) / Math.max(1, hw);
  const fy = (hy - vb.y0) / Math.max(1, vh);
  return fx >= 0.3 && fx <= 0.7 && fy >= 0.38 && fy <= 0.62;
}

export interface SupExponent {
  /** Tratti originali dell'apice */
  strokes: SimpleStroke[];
  /** Tratti INGRANDITI (per il riconoscimento isolato in modalità «numero») */
  scaled: SimpleStroke[];
  /** Posizione della base tra i cluster «normali» (0 = primo da sinistra) */
  baseIndex: number;
  /** Quanti sono i cluster «normali» (senza gli apici) */
  baseCount: number;
  /** x ASSOLUTA del centro della base (cluster dell'inchiostro, o elemento estratto) */
  baseX: number;
  /** chiave dell'elemento estratto che fa da base (se la base non è nell'inchiostro) */
  baseKey?: string;
}

export interface SupRewrite {
  /** Inchiostro principale, SENZA gli apici */
  strokes: SimpleStroke[];
  /** Apici rilevati, ordinati da sinistra a destra */
  sups: SupExponent[];
}

/** ⚠️ RECUPERO APEXE FUSO (27/9-septies, «2 alla seconda» sempre difficile):
 *  quando l'apice TOCCA la base (scrittura frettolosa), i due glifi finiscono
 *  nello stesso cluster e la geometria TRA cluster non li separa più. Si
 *  cerca DENTRO il cluster un sottogruppo d'apice: tratti BASSI e in ALTO
 *  che PARTONO nella metà destra della base.
 *
 *  Guardie anti-falsi-positivi (i controesemi partono tutti a SINISTRA o
 *  stanno in BASSO): la barra del «t» e il puntino dell'«i» partono a
 *  sinistra del centro della base; la coda della «y», la pancia del «5», il
 *  braccio basso della «k» stanno in basso (trascinano il bbox in basso →
 *  rinuncia); un puntino è troppo piccolo (apice < 15% dell'altezza).
 *  Restituisce gli INDICI dei tratti d'apice e il LATO: "right" = l'apice
 *  parte nella metà destra della base (caso x² fuso: la base È il cluster);
 *  "left" = l'apice FINISCE nella metà sinistra (caso (2²)²: il ² interno
 *  tocca la «)» — l'apice appartiene al GLIFO PRECEDENTE e la base va
 *  cercata fuori dal cluster, vedi il chiamante). null se ambiguo. */
function findMergedApexGroups(
  c: Cluster,
  strokes: SimpleStroke[],
  H: number,
): { idx: number[]; side: "right" | "left" }[] | null {
  const B = c.box;
  const tall: number[] = [];
  const rest: number[] = [];
  for (const i of c.idx) {
    const b = bboxOf([strokes[i]!]);
    (b.y1 - b.y0 > 0.62 * H ? tall : rest).push(i);
  }
  if (tall.length === 0 || rest.length === 0) return null;
  const baseBox = bboxOf(tall.map((i) => strokes[i]!));
  const baseH = baseBox.y1 - baseBox.y0;
  const baseW = baseBox.x1 - baseBox.x0;
  const cyB = (baseBox.y0 + baseBox.y1) / 2;
  // ⚠️ DUE GRUPPI, non uno (27/9-undecies, «potenza di potenza» stretta):
  // in (2²)² scritto serrato il ² interno tocca la «)» a SINISTRA e quello
  // esterno la tocca a DESTRA: i tre glifi finiscono in UN cluster. Sul
  // bbox UNITO dei tratti piccoli le due regole laterali falliscono entrambe
  // (l'apice «parte» a sinistra E «finisce» a destra) → prima si rinunciava
  // a TUTTO e il modello perdeva l'esponente esterno. Ora i tratti piccoli
  // si dividono per lato rispetto al centro del tratto alto e ogni gruppo
  // viene validato da solo: sinistro → glifo precedente, destro → il cluster.
  const baseCx = (baseBox.x0 + baseBox.x1) / 2;
  const left: number[] = [];
  const right: number[] = [];
  for (const i of rest) {
    const b = bboxOf([strokes[i]!]);
    ((b.x0 + b.x1) / 2 < baseCx ? left : right).push(i);
  }
  const groups: { idx: number[]; side: "right" | "left" }[] = [];
  for (const [idx, side] of [
    [left, "left"],
    [right, "right"],
  ] as const) {
    if (idx.length === 0 || idx.length > 3) continue;
    const apexBox = bboxOf(idx.map((i) => strokes[i]!));
    // il gruppo sta tutto nella parte ALTA del cluster (una coda bassa
    // trascina il bbox sotto la soglia → non è base+apice puliti)
    if (apexBox.y1 > B.y0 + 0.78 * H) continue;
    const apexH = apexBox.y1 - apexBox.y0;
    if (apexH < 0.15 * H || apexH >= baseH) continue;
    // a destra: il gruppo PARTE nella metà destra della base (x² fuso);
    // a sinistra: il gruppo FINISCE nella metà sinistra (² fuso con la «)»)
    const ok =
      side === "right"
        ? apexBox.x0 >= baseBox.x0 + 0.5 * baseW
        : apexBox.x1 <= baseBox.x1 - 0.5 * baseW;
    if (!ok) continue;
    // centro del gruppo chiaramente sopra il centro della base
    const cyA = (apexBox.y0 + apexBox.y1) / 2;
    if (cyA > cyB - SUP_RISE * baseH) continue;
    groups.push({ idx, side });
  }
  return groups.length > 0 ? groups : null;
}

/** n punti equidistanti (per lunghezza d'arco) lungo il tratto */
function resampleByArc(pts: { x: number; y: number }[], n: number): { x: number; y: number }[] {
  if (pts.length === 0) return [];
  if (pts.length === 1) return Array.from({ length: n }, () => ({ x: pts[0]!.x, y: pts[0]!.y }));
  const acc: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  }
  const total = acc[acc.length - 1]!;
  if (total === 0) return Array.from({ length: n }, () => ({ x: pts[0]!.x, y: pts[0]!.y }));
  const out: { x: number; y: number }[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (j < pts.length - 1 && acc[j]! < target) j++;
    const seg = acc[j]! - acc[j - 1]!;
    const t = seg === 0 ? 0 : (target - acc[j - 1]!) / seg;
    out.push({
      x: pts[j - 1]!.x + (pts[j]!.x - pts[j - 1]!.x) * t,
      y: pts[j - 1]!.y + (pts[j]!.y - pts[j - 1]!.y) * t,
    });
  }
  return out;
}

/** I due tratti hanno la STESSA FORMA (stessa traiettoria, in un verso o nell'altro)? */
function sameStrokeShape(a: SimpleStroke, b: SimpleStroke): boolean {
  const ra = resampleByArc(a.points, 24);
  const rb = resampleByArc(b.points, 24);
  if (ra.length === 0 || rb.length === 0) return false;
  const bb = bboxOf([a]);
  const diag = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0);
  const lim = Math.max(1.5, Math.min(4, 0.15 * diag));
  let fwd = 0;
  let rev = 0;
  for (let i = 0; i < ra.length; i++) {
    fwd += Math.hypot(ra[i]!.x - rb[i]!.x, ra[i]!.y - rb[i]!.y);
    rev += Math.hypot(ra[i]!.x - rb[rb.length - 1 - i]!.x, ra[i]!.y - rb[rb.length - 1 - i]!.y);
  }
  return Math.min(fwd, rev) / ra.length <= lim;
}

/** Deduplica dei tratti IDENTICI (27/9-septies, pezzo 2 reale): nella
 *  scrittura reale può capitare che lo stesso tratto venga registrato DUE
 *  volte (ripasso del tratto, double-event del canvas). Nella diagnosi del
 *  pezzo 2 il ² interno compariva duplicato con lo STESSO bbox: le due
 *  copie venivano fuse in un unico gruppo apice e il modello number
 *  leggeva «22». Rimuovo i tratti che coincidono con uno già visto.
 *
 *  ⚠️ 5/10 sera — BUG GRAVE: il criterio era il solo BBOX (±3 px). Le DUE
 *  DIAGONALI di una «x» (e della croce ×) hanno lo STESSO bbox — da angolo a
 *  angolo, uno speculare all'altro — e la seconda veniva cancellata come
 *  «duplicato»: la «x» arrivava al modello come un tratto solo, letto «1» o
 *  «/», o spariva («x[x+1]» → «1[+1]», «(x+1)x» → «(1+1)»: banco P5, 23
 *  letture su 28 rovinate dalla pipeline mentre il modello da solo le
 *  leggeva giuste). Un vero duplicato ha anche la stessa TRAIETTORIA: oltre
 *  al bbox si confronta la forma (24 punti per lunghezza d'arco, stesso verso
 *  o inverso, distanza media ≤ min(4 px, 15% della diagonale)). */
export function dedupeIdenticalStrokes(
  strokes: SimpleStroke[],
  tol = 3,
): SimpleStroke[] {
  const out: SimpleStroke[] = [];
  for (const s of strokes) {
    const b = bboxOf([s]);
    const dup = out.some((o) => {
      const ob = bboxOf([o]);
      return (
        Math.abs(ob.x0 - b.x0) <= tol &&
        Math.abs(ob.y0 - b.y0) <= tol &&
        Math.abs(ob.x1 - b.x1) <= tol &&
        Math.abs(ob.y1 - b.y1) <= tol &&
        sameStrokeShape(o, s)
      );
    });
    if (!dup) out.push(s);
  }
  return out;
}

/** Isola gli esponenti in apice dall'inchiostro principale. */
export function extractSuperscripts(
  strokes: SimpleStroke[],
  extraBases: ExtraBase[] = [],
): SupRewrite {
  if (strokes.length === 0 || (strokes.length < 2 && extraBases.length === 0)) {
    return { strokes, sups: [] };
  }
  const clusters = clusterStrokes(strokes);
  // BASI VIRTUALI: stesso formato dei cluster, senza tratti
  const virt: Cluster[] = extraBases.map((b) => ({
    idx: [],
    box: b.box,
    cx: (b.box.x0 + b.box.x1) / 2,
    key: b.key,
  }));
  // ⚠️ NIENTE early return sul cluster unico: se l'apice TOCCA la base i
  // due glifi finiscono in UN cluster solo, e il recupero interno
  // (findMergedApex) è l'unico che può separarli (27/9-septies).

  const heights = [...clusters, ...virt].map((c) => c.box.y1 - c.box.y0);
  // Riferimento d'altezza: il carattere PIÙ ALTO (mai sotto la mediana).
  // (segnalazione 27/9, esponente 2 non riconosciuto) Con solo DUE caratteri
  // (base + apice) il 75° percentile viene interpolato verso il basso
  // ([80, 52] → 73) e un apice grande (65% della base) sfuggiva alla
  // classificazione. Con il massimo [80, 52] → 80 e l'apice 52 px
  // (< 68% × 80) è correttamente un apice.
  const med = Math.max(median(heights), ...heights);
  if (med <= 0) return { strokes, sups: [] };

  const normal = clusters.filter((c) => c.box.y1 - c.box.y0 >= SUP_MAX_H * med);
  if (normal.length === 0 && virt.length === 0) return { strokes, sups: [] };

  // ⚠️ Pool delle BASE valide (27/9-novies, «potenza di potenza» (2²)²):
  // una base non deve essere per forza «normale» (h ≥ 75% del riferimento):
  // basta che non sia un APICE (h ≥ 45%). Le cifre dentro le parentesi
  // (h ≈ 50–70% delle parentesi) diventano basi legittime per i propri
  // esponenti; le guardie per-candidato restano: base più grande dell'apice
  // (hB > h), apice chiaramente in alto (SUP_RISE), distanza orizzontale
  // (SUP_MAX_GAP), base a sinistra.
  const basePool = clusters.filter(
    (c) => c.box.y1 - c.box.y0 >= BASE_MIN_H * med && !isOperatorCluster(c, strokes),
  );
  // le basi virtuali partecipano alla gara per distanza: un apice a destra di «]» ha come
  // base la quadra (gap piccolo), non la cifra che la precede nell'inchiostro
  const candidateBases = [...basePool, ...virt];

  const found: { cluster: Cluster; base: Cluster }[] = [];
  const supSet = new Set<Cluster>();
  for (const c of clusters) {
    const h = c.box.y1 - c.box.y0;
    if (h >= SUP_MAX_H * med) continue;
    if (isOperatorCluster(c, strokes)) continue; // «+» e «−» non sono apici
    const cyC = (c.box.y0 + c.box.y1) / 2;
    let best: Cluster | null = null;
    let bestGap = Infinity;
    for (const b of candidateBases) {
      if (b.cx >= c.cx) continue; // la base sta a sinistra dell'apice
      const gap = c.box.x0 - b.box.x1;
      if (gap > SUP_MAX_GAP * med) continue;
      const cyB = (b.box.y0 + b.box.y1) / 2;
      const hB = b.box.y1 - b.box.y0;
      if (cyC > cyB - SUP_RISE * hB) continue; // non abbastanza in alto
      if (c.box.y1 > cyB + SUP_BOTTOM * hB) continue; // il fondo scende oltre il centro: non è in alto
      if (hB <= h) continue; // la base è più grande dell'apice
      if (gap < bestGap) {
        bestGap = gap;
        best = b;
      }
    }
    if (best) {
      found.push({ cluster: c, base: best });
      supSet.add(c);
    }
  }
  // (25/10) APICE NEGATIVO («2^-2» scritto a mano): la BARRA del meno,
  // se è tra la base e la cifra dell'apice e sta ALLA STESSA ALTEZZA
  // dell'apice (rialzata rispetto alla base), appartiene all'ESPONENTE:
  // viene ASSORBITA nel gruppo apice (il modello la legge insieme alla
  // cifra in modalità «numero» → «-2»). Banco ONE: senza l'assorbimento
  // il finale era «2^{2}{-}»; col grezzo il modello leggeva «2^{-2}».
  // ⚠️ Guardia anti-falsi-positivi («5-8^2»: il meno è alla BASE):
  // la barra deve essere CHIARAMENTE SOPRA il centro della base
  // (≥ 15% dell'altezza base) ed ESSERE PRIMA dell'apice in x.
  const isBarCluster = (c: Cluster): boolean => {
    if (c.idx.length !== 1) return false;
    const w = c.box.x1 - c.box.x0;
    const h = c.box.y1 - c.box.y0;
    return w > 0 && h <= w * 0.35 && w < med * 0.9;
  };
  for (const f of found) {
    const sb = f.cluster.box;
    const bb = f.base.box;
    const baseH = Math.max(1, bb.y1 - bb.y0);
    for (const c of clusters) {
      if (supSet.has(c) || isBarCluster(c) === false) continue;
      const cb = c.box;
      const cyBar = (cb.y0 + cb.y1) / 2;
      const cyBase = (bb.y0 + bb.y1) / 2;
      const cyOk =
        cyBar >= sb.y0 - med * 0.2 &&
        cyBar <= sb.y1 + med * 0.2 &&
        cyBar < cyBase - baseH * 0.15; // rialzato rispetto alla base
      const beforeSup = cb.x1 <= sb.x0 + med * 0.15 && sb.x0 - cb.x1 <= med * 0.6;
      if (cyOk && beforeSup) {
        f.cluster.idx.push(...c.idx);
        f.cluster.box = {
          x0: Math.min(cb.x0, sb.x0),
          x1: Math.max(cb.x1, sb.x1),
          y0: Math.min(cb.y0, sb.y0),
          y1: Math.max(cb.y1, sb.y1),
        };
        f.cluster.cx = (f.cluster.box.x0 + f.cluster.box.x1) / 2;
        supSet.add(c);
      }
    }
  }

  // (niente early return se found è vuoto: l'apice può essere FUSO nella
  // base — stesso cluster — e viene recuperato da findMergedApexGroups
  // sotto; 27/9-septies «2 alla seconda»)

  // ⚠️ Costruzione dei cluster «normali» con intercettazione dei
  // MEGA-CLUSTER (27/9-terzies): un cluster con PIÙ tratti alti viene
  // spezzato nei suoi glifi e i suoi apici estratti subito, così baseCount
  // resta allineato al LaTeX e ogni apice riceve la propria base.
  const mainClusters: Cluster[] = [];
  const mainIdx = new Set<number>();
  const mergedSups: { idx: number[]; base: Cluster }[] = [];
  for (const c of clusters) {
    if (supSet.has(c)) continue;
    const hC = c.box.y1 - c.box.y0;
    const mega = hC > 0 && c.idx.length >= 3 ? splitMegaCluster(c, strokes) : null;
    if (mega) {
      for (const s of mega.mainSubs) {
        mainClusters.push(s);
        for (const i of s.idx) mainIdx.add(i);
      }
      mergedSups.push(...mega.sups);
      continue;
    }
    mainClusters.push(c);
    for (const i of c.idx) mainIdx.add(i);
  }

  // ⚠️ RECUPERO APEXE FUSO: si cerca l'apice DENTRO ogni cluster normale
  // rimasto (apice che tocca la base = stesso cluster). Gli apici fusi
  // vengono tolti dall'inchiostro principale come gli altri. Può esserci
  // PIÙ di un gruppo nello stesso cluster (27/9-undecies: ² interno a
  // sinistra della «)» ed esterno a destra, tutti e tre fusi).
  for (const c of mainClusters) {
    const hC = c.box.y1 - c.box.y0;
    if (hC <= 0 || c.idx.length < 2) continue;
    // NB: i sotto-cluster nati da splitMegaCluster non arrivano qui con
    // apici dentro (gli apici sono già stati tolti), e i cluster «normali»
    // con un solo tratto alto seguono la via storica qui sotto.
    const groups = findMergedApexGroups(c, strokes, hC);
    if (!groups) continue;
    for (const apex of groups) {
    const apexBox = bboxOf(apex.idx.map((i) => strokes[i]!));
    const apexH = apexBox.y1 - apexBox.y0;
    if (apex.side === "right") {
      // apice a destra del tratto alto (x² fuso, o ² esterno fuso con la
      // «)» che lo precede): la base È il cluster
      for (const i of apex.idx) mainIdx.delete(i);
      mergedSups.push({ idx: apex.idx, base: c });
      continue;
    }
    // ⚠️ apice a SINISTRA del tratto alto (27/9-decies, (2²)²: il ² interno
    // tocca la «)» e i due glifi finiscono nello stesso cluster): l'apice
    // appartiene al glifo PRECEDENTE → base = il cluster valido più vicino
    // a sinistra dell'apice (la cifra «2», NON la parentesi che lo fonde).
    let best: Cluster | null = null;
    let bestGap = Infinity;
    for (const b of basePool) {
      if (b === c || supSet.has(b)) continue;
      const gap = apexBox.x0 - b.box.x1;
      if (gap < 0 || gap > SUP_MAX_GAP * med) continue;
      const hB = b.box.y1 - b.box.y0;
      if (hB <= apexH) continue;
      const cyA = (apexBox.y0 + apexBox.y1) / 2;
      const cyB = (b.box.y0 + b.box.y1) / 2;
      if (cyA > cyB - SUP_RISE * hB) continue;
      if (gap < bestGap) {
        bestGap = gap;
        best = b;
      }
    }
    if (best) {
      for (const i of apex.idx) mainIdx.delete(i);
      mergedSups.push({ idx: apex.idx, base: best });
    }
    }
  }
  const main = strokes.filter((_, i) => mainIdx.has(i));

  const sups: SupExponent[] = [
    ...found.map(({ cluster, base }) => {
      const h = Math.max(1, cluster.box.y1 - cluster.box.y0);
      const cx0 = cluster.cx;
      const cy0 = (cluster.box.y0 + cluster.box.y1) / 2;
      const scale = Math.min(5, Math.max(1.4, (med * 0.85) / h));
      const scaledStrokes = cluster.idx.map((i) => {
        const s = strokes[i]!;
        return {
          ...s,
          points: s.points.map((p) => ({
            x: cx0 + (p.x - cx0) * scale,
            y: cy0 + (p.y - cy0) * scale,
          })),
        };
      });
      const isVirtual = base.idx.length === 0;
      const baseIndex = isVirtual ? -1 : indexOfBase(base, cluster.box, mainClusters);
      return {
        strokes: cluster.idx.map((i) => strokes[i]!),
        scaled: scaledStrokes,
        baseIndex,
        baseCount: mainClusters.length,
        baseX: !isVirtual && baseIndex >= 0 ? mainClusters[baseIndex]!.cx : base.cx,
        baseKey: base.key,
      };
    }),
    ...mergedSups.map(({ idx, base }) => {
      const ab = bboxOf(idx.map((i) => strokes[i]!));
      const h = Math.max(1, ab.y1 - ab.y0);
      const cx0 = (ab.x0 + ab.x1) / 2;
      const cy0 = (ab.y0 + ab.y1) / 2;
      const scale = Math.min(5, Math.max(1.4, (med * 0.85) / h));
      const scaledStrokes = idx.map((i) => {
        const s = strokes[i]!;
        return {
          ...s,
          points: s.points.map((p) => ({
            x: cx0 + (p.x - cx0) * scale,
            y: cy0 + (p.y - cy0) * scale,
          })),
        };
      });
      const baseIndex = indexOfBase(base, ab, mainClusters);
      return {
        strokes: idx.map((i) => strokes[i]!),
        scaled: scaledStrokes,
        baseIndex,
        baseCount: mainClusters.length,
        baseX: baseIndex >= 0 ? mainClusters[baseIndex]!.cx : base.cx,
        baseKey: undefined,
      };
    }),
  ].sort((a, b) => {
    const ba = bboxOf(a.strokes);
    const bb = bboxOf(b.strokes);
    return (ba.x0 + ba.x1) / 2 - (bb.x0 + bb.x1) / 2;
  });

  return { strokes: main, sups };
}

/** Unione-find sui tratti indicati con una data tolleranza orizzontale
 *  (usata per raggruppare i glifi compatti dentro un mega-cluster). */
/** Indice della base tra i cluster normali. Se il cluster base è stato
 *  SPEZZATO da splitMegaCluster (mega-cluster), la base «orfa» viene
 *  riportata al sotto-cluster che l'apice segue (gap orizzontale minimo).
 *  27/9-quinquies, pezzo 2 REALE dell'utente: il ² esterno sta in un
 *  cluster separato con base = il mega-cluster originale; dopo lo split
 *  quel cluster non è più tra i normali → baseIndex −1 → esponente
 *  fuori posto (nella trascrizione reale: «(2²²)²»). */
function indexOfBase(base: Cluster, apexBox: Box, mainClusters: Cluster[]): number {
  const direct = mainClusters.indexOf(base);
  if (direct >= 0) return direct;
  let best = -1;
  let bestGap = Infinity;
  mainClusters.forEach((m, k) => {
    const gap = apexBox.x0 - m.box.x1;
    if (gap < -2 * GAP_X) return;
    if (gap < bestGap) {
      bestGap = gap;
      best = k;
    }
  });
  return best;
}

function tightGroups(idx: number[], strokes: SimpleStroke[], gapX: number): number[][] {
  const boxes = idx.map((i) => bboxOf([strokes[i]!]));
  const parent = idx.map((_, k) => k);
  const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k]!)));
  for (let a = 0; a < idx.length; a++) {
    for (let b = a + 1; b < idx.length; b++) {
      const dx = Math.max(boxes[a]!.x0, boxes[b]!.x0) - Math.min(boxes[a]!.x1, boxes[b]!.x1);
      const dy = Math.max(boxes[a]!.y0, boxes[b]!.y0) - Math.min(boxes[a]!.y1, boxes[b]!.y1);
      if (dx <= gapX && dy <= GAP_Y) parent[find(b)!] = find(a)!;
    }
  }
  const map = new Map<number, number[]>();
  idx.forEach((i, k) => {
    const r = find(k)!;
    if (!map.has(r)) map.set(r, []);
    map.get(r)!.push(i);
  });
  return [...map.values()];
}

/** Gap per ri-aggruppare i glifi PRINCIPALI di un mega-cluster: più stretto
 *  del clustering normale, perché la scrittura serrata concatena anche
 *  glifi DIVERSI (nella scrittura reale «(2²)²» la cifra arriva a 12 px
 *  dalla «)» e tutto fonde in un cluster unico). I tratti di uno stesso
 *  glifo si toccano o si sovrappongono (gap ≈ 0), quindi un gap piccolo
 *  separa glifi diversi senza smembrarli. */
const GAP_SPLIT = 6;

/** ⚠️ MEGA-CLUSTER (27/9-terzies, dai tratti reali dell'utente): in scrittura
 *  serrata «(2²)²» TUTTI e cinque i glifi finiscono in UN cluster (la «(»
 *  tocca la cifra, il ² interno tocca cifra e «)», la «)» tocca il ²
 *  esterno) → il recupero per-gruppo salda ² interno ed esterno in UN solo
 *  esponente con base l'intero cluster e la trascrizione perde la potenza
 *  sulla parentesi («(2²)»). Qui si risolve a quale glifo ogni gruppo
 *  piccolo CAVALCA: un apice sta vicino in orizzontale al suo glifo e ne
 *  copre la cima (fondo dell'apice ≈ cima della base), è piccolo rispetto
 *  alla base ed è chiaramente in alto. I tratti rimasti (glifi principali)
 *  si ri-aggruppano con il gap da split in sotto-cluster: baseCount torna
 *  ad allinearsi col LaTeX e ogni apice riceve la sua base.
 *  Restituisce i sotto-cluster «normali» e gli apici con la loro base,
 *  oppure null se non è un mega-cluster o non c'è nessun apice a cavallo
 *  (in tal caso si proseguono le vie normali). */
function splitMegaCluster(
  c: Cluster,
  strokes: SimpleStroke[],
): { mainSubs: Cluster[]; sups: { idx: number[]; base: Cluster }[] } | null {
  const H = c.box.y1 - c.box.y0;
  const tall: number[] = [];
  const rest: number[] = [];
  for (const i of c.idx) {
    const b = bboxOf([strokes[i]!]);
    (b.y1 - b.y0 > 0.62 * H ? tall : rest).push(i);
  }
  if (tall.length < 2 || rest.length === 0) return null;
  // ⚠️ cavalcazione PER SINGOLO TRATTO (non per gruppi preformati): nella
  // scrittura reale la cifra e il suo ² si toccano (dx −4) e un gruppo
  // unico «cifra+apice» non cavalcherebbe nulla (il bbox della cifra
  // trascina il gruppo a metà altezza). Ogni tratto piccolo cerca da solo
  // il glifo su cui cavalca; i tratti che cavalcano la STESSA base vengono
  // poi fusi in un unico apice (² a due tratti).
  const allIdx = [...tall, ...rest].sort(
    (a, b) => bboxOf([strokes[a]!]).x0 - bboxOf([strokes[b]!]).x0,
  );
  const boxes = new Map<number, Box>(allIdx.map((i) => [i, bboxOf([strokes[i]!])]));
  const riding = new Map<number, number>(); // tratto → tratto-base
  for (const i of allIdx) {
    if (tall.includes(i)) continue;
    const ab = boxes.get(i)!;
    const apexH = ab.y1 - ab.y0;
    const apexCy = (ab.y0 + ab.y1) / 2;
    let best = -1;
    let bestScore = Infinity;
    for (const j of allIdx) {
      if (j === i || riding.has(j)) continue; // un apice non fa da base
      const bb = boxes.get(j)!;
      // ⚠️ adiacenza (27/9-quater): un apice sta in alto a DESTRA del suo
      // glifo → la base deve FINIRE prima (o quasi) della fine dell'apice.
      // Nella scrittura reale il ² può sovrapporsi in PROFONDITÀ alla cifra
      // (fino a −20 px): il vecchio limite gap ≥ −GAP_X scartava la cifra e
      // il ² interno finiva sulla «)» che sta DOPO → due apici sulla stessa
      // base → esponente «22». Tolleranza in coda 1,5×GAP_X per il ² scritto
      // sopra il centro del glifo.
      if (bb.x1 > ab.x1 + 1.5 * GAP_X) continue;
      // il CENTRO dell'apice non sporge troppo a destra del fondo della base
      if ((ab.x0 + ab.x1) / 2 - bb.x1 > 2 * GAP_X) continue;
      const candH = bb.y1 - bb.y0;
      if (candH <= apexH) continue; // la base è più grande dell'apice
      if (apexH >= 0.75 * candH) continue;
      // troppo piccolo in ENTRAMBE le dimensioni = puntino dell'i (mai un
      // apice); una barra orizzontale di un ² a due tratti è bassa ma LARGA
      if (apexH < 0.12 * candH && ab.x1 - ab.x0 < 6) continue;
      // l'apice cavalca la CIMA della base: il suo fondo supera di poco
      // il top del glifo su cui sta (non è un glifo affiancato a metà altezza)
      const score = ab.y1 - bb.y0;
      if (score > 0.35 * candH) continue;
      const candCy = (bb.y0 + bb.y1) / 2;
      if (apexCy > candCy - SUP_RISE * candH) continue; // non abbastanza in alto
      if (score < bestScore) {
        bestScore = score;
        best = j;
      }
    }
    if (best >= 0) riding.set(i, best);
  }
  if (riding.size === 0) return null;
  // un apice = i tratti d'apice vicini tra loro (² a due o tre tratti):
  // la prossimità li salda anche quando cavalcano tratti diversi della
  // stessa base (es. x disegnata con due diagonali); la base del gruppo
  // è quella del primo tratto (i tratti-base finiscono comunque nello
  // stesso sotto-cluster dopo il ri-aggruppamento)
  const ridingStrokes = [...riding.keys()].sort(
    (a, b) => boxes.get(a)!.x0 - boxes.get(b)!.x0,
  );
  const sups = tightGroups(ridingStrokes, strokes, GAP_X)
    .map((idx) => ({ idx, baseStroke: riding.get(idx[0]!)! }))
    .sort(
      (a, b) =>
        bboxOf(a.idx.map((i) => strokes[i]!)).x0 -
        bboxOf(b.idx.map((i) => strokes[i]!)).x0,
    );
  // sotto-cluster dei glifi principali (stesso schema del clustering,
  // ma con il gap da split per spezzare le catene tra glifi diversi)
  const mainStrokeIdx = allIdx.filter((i) => !riding.has(i));
  const subBoxes = mainStrokeIdx.map((i) => bboxOf([strokes[i]!]));
  const parent = mainStrokeIdx.map((_, k) => k);
  const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k]!)));
  for (let a = 0; a < mainStrokeIdx.length; a++) {
    for (let b = a + 1; b < mainStrokeIdx.length; b++) {
      const dx = Math.max(subBoxes[a]!.x0, subBoxes[b]!.x0) - Math.min(subBoxes[a]!.x1, subBoxes[b]!.x1);
      const dy = Math.max(subBoxes[a]!.y0, subBoxes[b]!.y0) - Math.min(subBoxes[a]!.y1, subBoxes[b]!.y1);
      if (dx <= GAP_SPLIT && dy <= GAP_Y) parent[find(b)!] = find(a)!;
    }
  }
  const subMap = new Map<number, number[]>();
  mainStrokeIdx.forEach((i, k) => {
    const r = find(k)!;
    if (!subMap.has(r)) subMap.set(r, []);
    subMap.get(r)!.push(i);
  });
  const mainSubs: Cluster[] = [...subMap.values()].map((idx) => {
    const box = bboxOf(idx.map((i) => strokes[i]!));
    return { idx, box, cx: (box.x0 + box.x1) / 2 };
  });
  // la base di ogni apice = il sotto-cluster che contiene il suo glifo base
  const outSups = sups.map(({ idx, baseStroke }) => {
    const base = mainSubs.find((s) => s.idx.includes(baseStroke)) ?? mainSubs[0]!;
    return { idx, base };
  });
  return { mainSubs, sups: outSups };
}

/** Toglie dal LaTeX gli esponenti che il modello potrebbe aver scritto da sé
 *  (senza i tratti degli apici in input sarebbe solo un'impostura): gli
 *  esponenti veri vengono riattaccati da `spliceExponents`. */
export function stripModelExponents(latex: string): string {
  return latex
    .replace(/\^\{[0-9]+\}/g, "")
    .replace(/\^\([0-9]+\)/g, "")
    .replace(/\^[0-9]/g, "")
    .replace(/\^/g, "");
}

export interface SpliceExp {
  /** Cifre dell'esponente riconosciute (es. "2", "3") */
  digits: string;
  /** Posizione della base tra i cluster normali */
  baseIndex: number;
  /** Numero di cluster normali */
  baseCount: number;
}

/** Riattacca gli esponenti al LaTeX come ^{d}, nel punto giusto.
 *
 *  Punti di aggancio: dopo ogni lettera «libra» (non parte di un comando
 *  LaTeX), dopo ogni cifra e dopo ogni parentesi chiusa ) ] }. La posizione
 *  è scelta in modo proporzionale: la base numero i su n cluster porta al
 *  punto (i+1)/n dell'espressione — così 3xy² aggancia dopo y, x²y³ dopo
 *  x e dopo y, (2x)³ dopo la parentesi, 5² dopo il 5. */
export function spliceExponents(latex: string, exps: SpliceExp[]): string {
  if (exps.length === 0 || !latex) return latex;

  // 1) punti di aggancio (indice DOPO il carattere)
  const pts: { pos: number; taken: boolean }[] = [];
  let i = 0;
  while (i < latex.length) {
    const ch = latex[i]!;
    if (ch === "\\") {
      // salta il comando LaTeX (\left, \cdot, …): le sue lettere non contano
      i++;
      while (i < latex.length && /[a-zA-Z]/.test(latex[i]!)) i++;
      continue;
    }
    if (/[0-9a-zA-Z)\]}]/.test(ch)) pts.push({ pos: i + 1, taken: false });
    i++;
  }
  if (pts.length === 0) return latex;

  // 2) esponenti già scritti dal modello → punto occupato: il punto seguito
  //    da «^» e TUTTI i punti interni al gruppo ^{...} (inserire lì creerebbe
  //    un doppio apice tipo x^{2^{3}})
  for (const p of pts) {
    if (latex.slice(p.pos).startsWith("^")) p.taken = true;
  }
  for (let k = 0; k < latex.length; k++) {
    if (latex[k] !== "^") continue;
    let end = k + 1;
    if (latex[end] === "{") {
      let depth = 1;
      end++;
      while (end < latex.length && depth > 0) {
        if (latex[end] === "{") depth++;
        else if (latex[end] === "}") depth--;
        end++;
      }
    } else if (/[0-9]/.test(latex[end] ?? "")) {
      while (end < latex.length && /[0-9]/.test(latex[end]!)) end++;
    } else continue;
    for (const p of pts) if (p.pos > k && p.pos <= end) p.taken = true;
  }

  // 2-bis) ⚠️ esponenti MULTI-CIFRA con cifre in CLUSTER SEPARATI (audit
  //    4/10, «Ricontrolla gli esponenti»): «5¹⁰» scritto con l'1 e lo 0
  //    distaccati produce DUE apici con la STESSA base (stesso baseIndex e
  //    baseCount). Le cifre si FONDONO prima dell'inserimento: altrimenti
  //    la seconda cifra cade sul punto libero più vicino (esponente sul
  //    glifo successivo: «x^{1}y^{0}») o si perde («5^{1}»). L'ordine delle
  //    cifre è quello di scrittura (extractSuperscripts ordina per x).
  const expsMerged: SpliceExp[] = [];
  for (const e of exps) {
    const last = expsMerged[expsMerged.length - 1];
    if (last && last.baseIndex === e.baseIndex && last.baseCount === e.baseCount) {
      last.digits += e.digits;
    } else {
      expsMerged.push({ ...e });
    }
  }

  // 3) posizione proporzionale per ogni esponente, raggruppata per punto
  const byPoint = new Map<number, string>();
  for (const e of expsMerged) {
    let target =
      e.baseCount > 1
        ? Math.round(((e.baseIndex + 1) / e.baseCount) * pts.length) - 1
        : 0;
    target = Math.max(0, Math.min(pts.length - 1, target));
    if (pts[target]!.taken) {
      // punto occupato → il punto libero più vicino
      let bestD = Infinity;
      let bestI = -1;
      for (let k = 0; k < pts.length; k++) {
        if (pts[k]!.taken) continue;
        const d = Math.abs(k - target);
        if (d < bestD) {
          bestD = d;
          bestI = k;
        }
      }
      if (bestI === -1) continue;
      target = bestI;
    }
    pts[target]!.taken = true;
    const pos = pts[target]!.pos;
    byPoint.set(pos, (byPoint.get(pos) ?? "") + e.digits);
  }

  // 4) inserimento da destra a sinistra (gli indici restano validi)
  let out = latex;
  for (const [pt, digits] of [...byPoint.entries()].sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, pt) + "^{" + digits + "}" + out.slice(pt);
  }
  return out;
}
