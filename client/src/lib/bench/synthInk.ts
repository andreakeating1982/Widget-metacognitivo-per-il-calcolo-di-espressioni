// ⚠️ BANCO DI PROVA (6/10) — generatore di scrittura a mano SINTETICA.
// Produce tratti (Stroke[]) con variabilità umana: forme alternative di cifre
// e parentesi, direzione di tracciamento, pendenza, inclinazione, tremore,
// spaziatura stretta o a contatto fra i segni, altezza delle parentesi.
// Serve SOLO ai test (lib/bench/*): non entra nel bundle dell'app.
import type { Stroke } from "../../components/MathDrawCanvas";

export type Rng = () => number;
type P = [number, number];

export function mulberry32(seed: number): Rng {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: Rng): number => {
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const pick = <T,>(r: Rng, xs: T[]): T => xs[Math.min(xs.length - 1, Math.floor(r() * xs.length))]!;
const range = (r: Rng, a: number, b: number): number => a + (b - a) * r();

/** Glifo: coordinate dei tratti in un quadrato unitario (x∈[0,1] → larghezza
 *  w·H, y∈[0,1] → da top a bottom, in unità di altezza-cifra H). */
interface Glyph {
  w: number;
  top: number;
  bottom: number;
  strokes: P[][];
  smooth: boolean;
  /** forma che non si ribalta mai (cifre: direzione naturale) */
  keepDir?: boolean;
}

const DIGITS: Record<string, Glyph[]> = {
  "0": [
    { w: 0.55, top: 0, bottom: 1, smooth: true, keepDir: true, strokes: [[[0.55, 0], [0.15, 0.15], [0.02, 0.5], [0.15, 0.88], [0.55, 1], [0.9, 0.85], [1, 0.5], [0.88, 0.14], [0.52, 0.0]]] },
  ],
  "1": [
    { w: 0.34, top: 0, bottom: 1, smooth: false, keepDir: true, strokes: [[[0.1, 0.3], [0.62, 0], [0.62, 1]]] },
    { w: 0.2, top: 0, bottom: 1, smooth: false, keepDir: true, strokes: [[[0.5, 0], [0.5, 1]]] },
    { w: 0.5, top: 0, bottom: 1, smooth: false, keepDir: true, strokes: [[[0.2, 0.28], [0.55, 0], [0.55, 1]], [[0.15, 1], [0.95, 1]]] },
  ],
  "2": [
    { w: 0.55, top: 0, bottom: 1, smooth: true, keepDir: true, strokes: [[[0.05, 0.25], [0.22, 0.04], [0.58, 0.0], [0.92, 0.2], [0.82, 0.5], [0.45, 0.72], [0.05, 1], [0.97, 1]]] },
    { w: 0.55, top: 0, bottom: 1, smooth: true, keepDir: true, strokes: [[[0.08, 0.2], [0.4, 0.0], [0.8, 0.15], [0.8, 0.42], [0.1, 1], [0.95, 0.97]]] },
  ],
  "3": [
    { w: 0.52, top: 0, bottom: 1, smooth: true, keepDir: true, strokes: [[[0.08, 0.1], [0.42, 0.0], [0.82, 0.12], [0.78, 0.4], [0.4, 0.5], [0.88, 0.62], [0.88, 0.88], [0.5, 1], [0.05, 0.9]]] },
    { w: 0.52, top: 0, bottom: 1, smooth: false, keepDir: true, strokes: [[[0.1, 0.0], [0.85, 0.0], [0.45, 0.45], [0.88, 0.62], [0.85, 0.9], [0.5, 1], [0.05, 0.88]]] },
  ],
  "4": [
    { w: 0.58, top: 0, bottom: 1, smooth: false, keepDir: true, strokes: [[[0.68, 0], [0.04, 0.68], [0.98, 0.68]], [[0.72, 0.3], [0.72, 1]]] },
    { w: 0.58, top: 0, bottom: 1, smooth: false, keepDir: true, strokes: [[[0.1, 0], [0.05, 0.62], [0.97, 0.64]], [[0.7, 0], [0.7, 1]]] },
    { w: 0.58, top: 0, bottom: 1, smooth: false, keepDir: true, strokes: [[[0.7, 0], [0.04, 0.68], [0.98, 0.68]], [[0.7, 0.2], [0.7, 1]]] },
  ],
  "5": [
    { w: 0.52, top: 0, bottom: 1, smooth: true, keepDir: true, strokes: [[[0.9, 0.0], [0.22, 0.0], [0.14, 0.46], [0.6, 0.38], [0.92, 0.62], [0.85, 0.9], [0.5, 1], [0.05, 0.88]]] },
    { w: 0.52, top: 0, bottom: 1, smooth: true, keepDir: true, strokes: [[[0.2, 0.02], [0.13, 0.46], [0.6, 0.38], [0.92, 0.62], [0.85, 0.9], [0.5, 1], [0.05, 0.88]], [[0.2, 0.0], [0.92, 0.0]]] },
  ],
  "6": [
    { w: 0.54, top: 0, bottom: 1, smooth: true, keepDir: true, strokes: [[[0.8, 0.04], [0.4, 0.2], [0.1, 0.6], [0.2, 0.95], [0.6, 1], [0.92, 0.76], [0.72, 0.46], [0.3, 0.5], [0.1, 0.72]]] },
  ],
  "7": [
    { w: 0.52, top: 0, bottom: 1, smooth: false, keepDir: true, strokes: [[[0.05, 0.02], [0.95, 0.02], [0.4, 1]]] },
    { w: 0.52, top: 0, bottom: 1, smooth: false, keepDir: true, strokes: [[[0.05, 0.02], [0.95, 0.02], [0.4, 1]], [[0.3, 0.56], [0.8, 0.56]]] },
  ],
  "8": [
    { w: 0.54, top: 0, bottom: 1, smooth: true, keepDir: true, strokes: [[[0.5, 0.0], [0.15, 0.14], [0.2, 0.4], [0.55, 0.54], [0.9, 0.74], [0.5, 1], [0.1, 0.78], [0.5, 0.54], [0.86, 0.4], [0.85, 0.14], [0.5, 0.0]]] },
    { w: 0.54, top: 0, bottom: 1, smooth: true, keepDir: true, strokes: [[[0.5, 0.5], [0.15, 0.25], [0.45, 0.0], [0.85, 0.22], [0.5, 0.5], [0.12, 0.76], [0.5, 1], [0.9, 0.76], [0.5, 0.5]]] },
  ],
  "9": [
    { w: 0.54, top: 0, bottom: 1, smooth: true, keepDir: true, strokes: [[[0.86, 0.3], [0.6, 0.0], [0.2, 0.1], [0.1, 0.35], [0.5, 0.56], [0.88, 0.36], [0.86, 0.7], [0.62, 1]]] },
    { w: 0.54, top: 0, bottom: 1, smooth: true, keepDir: true, strokes: [[[0.9, 0.3], [0.55, 0.0], [0.12, 0.25], [0.5, 0.55], [0.9, 0.3]], [[0.9, 0.3], [0.85, 1]]] },
  ],
};

const LETTERS: Record<string, Glyph[]> = {
  x: [{ w: 0.4, top: 0.38, bottom: 1, smooth: false, strokes: [[[0.05, 0], [0.95, 1]], [[0.95, 0], [0.05, 1]]] }],
  y: [{ w: 0.4, top: 0.38, bottom: 1.4, smooth: false, strokes: [[[0.05, 0], [0.5, 0.58]], [[0.95, 0], [0.4, 0.8], [0.15, 1]]] }],
  a: [{ w: 0.4, top: 0.38, bottom: 1, smooth: true, strokes: [[[0.8, 0.15], [0.4, 0.0], [0.05, 0.5], [0.4, 1.0], [0.8, 0.8]], [[0.85, 0.0], [0.85, 1.0]]] }],
  b: [{ w: 0.4, top: -0.05, bottom: 1, smooth: true, strokes: [[[0.1, 0], [0.1, 1]], [[0.1, 0.55], [0.55, 0.38], [0.92, 0.65], [0.55, 1.0], [0.1, 0.9]]] }],
};

/** Un punto (cdot, due punti): tocco di penna con 1–3 campioni vicinissimi
 *  (nell'app un tocco genera 1–3 punti, mai un tratto lungo). */
const dotStroke = (cx: number, cy: number, r: Rng): P[] => {
  const n = 1 + Math.floor(r() * 3);
  const out: P[] = [[cx, cy]];
  for (let i = 1; i < n; i++) out.push([cx + i * 0.004 * (r() - 0.3), cy + i * 0.004 * (r() - 0.3)]);
  return out;
};

function roundParen(open: boolean, r: Rng): Glyph {
  const s = range(r, 0.35, 0.85); // freccia dell'arco (sagitta) rispetto alla larghezza
  const skew = range(r, 0.8, 1.25);
  const xe = 0.88;
  const pts: P[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const tt = Math.pow(t, skew);
    const bump = 4 * tt * (1 - tt);
    pts.push(open ? [xe - s * bump, t] : [1 - xe + s * bump, t]);
  }
  return { w: range(r, 0.2, 0.34), top: 0, bottom: 1, smooth: true, strokes: [pts] };
}

function squareBracket(open: boolean, r: Rng): Glyph {
  const mirror = (p: P): P => (open ? p : [1 - p[0], p[1]]);
  const kind = r();
  const pts1: P[] = [[0.92, 0.0], [0.14, 0.0], [0.14, 1.0], [0.92, 1.0]].map((p) => mirror(p as P));
  if (kind < 0.62) {
    return { w: range(r, 0.2, 0.3), top: 0, bottom: 1, smooth: false, strokes: [pts1] };
  }
  if (kind < 0.85) {
    // due tratti: «⌈» poi «⌊»
    return {
      w: range(r, 0.2, 0.3), top: 0, bottom: 1, smooth: false,
      strokes: [[[0.92, 0.0], [0.14, 0.0], [0.14, 0.52]].map((p) => mirror(p as P)), [[0.14, 0.48], [0.14, 1.0], [0.92, 1.0]].map((p) => mirror(p as P))],
    };
  }
  // tre tratti: asta + due tick
  return {
    w: range(r, 0.2, 0.3), top: 0, bottom: 1, smooth: false,
    strokes: [[[0.14, 0.0], [0.14, 1.0]].map((p) => mirror(p as P)), [[0.14, 0.0], [0.92, 0.0]].map((p) => mirror(p as P)), [[0.14, 1.0], [0.92, 1.0]].map((p) => mirror(p as P))],
  };
}

function curlyBrace(open: boolean, r: Rng): Glyph {
  const mirror = (p: P): P => (open ? p : [1 - p[0], p[1]]);
  const tip = range(r, 0.02, 0.18);
  const one: P[] = ([
    [0.85, 0.0], [0.55, 0.05], [0.46, 0.2], [0.44, 0.36], [0.34, 0.46], [tip, 0.5],
    [0.34, 0.54], [0.44, 0.64], [0.46, 0.8], [0.55, 0.95], [0.85, 1.0],
  ] as P[]).map(mirror);
  if (r() < 0.78) return { w: range(r, 0.26, 0.4), top: 0, bottom: 1, smooth: true, strokes: [one] };
  // due metà (tratto alto + tratto basso)
  const up = one.slice(0, 6);
  const dn = one.slice(5);
  return { w: range(r, 0.26, 0.4), top: 0, bottom: 1, smooth: true, strokes: [up, dn] };
}

function operatorGlyph(ch: string, r: Rng): Glyph | null {
  const tilt = range(r, -0.04, 0.04);
  switch (ch) {
    case "+":
      return r() < 0.5
        ? { w: 0.5, top: 0.26, bottom: 0.78, smooth: false, strokes: [[[0, 0.5 + tilt], [1, 0.5 - tilt]], [[0.5, 0], [0.5 + tilt, 1]]] }
        : { w: 0.5, top: 0.26, bottom: 0.78, smooth: false, strokes: [[[0.5, 0], [0.5 + tilt, 1]], [[0, 0.5 + tilt], [1, 0.5 - tilt]]] };
    case "-":
      return { w: 0.42, top: 0.5, bottom: 0.54, smooth: false, strokes: [[[0, 0.5 + tilt * 3], [1, 0.5 - tilt * 3]]] };
    case "*":
    case "·":
      return { w: 0.1, top: 0.46, bottom: 0.54, smooth: false, strokes: [dotStroke(0.5, 0.5, r)] };
    case ":":
      return { w: 0.1, top: 0.22, bottom: 0.8, smooth: false, strokes: [dotStroke(0.5, 0.05, r), dotStroke(0.5, 0.95, r)] };
    case "=":
      return { w: 0.5, top: 0.36, bottom: 0.66, smooth: false, strokes: [[[0, 0.1 + tilt], [1, 0.1 - tilt]], [[0, 0.9 + tilt], [1, 0.9 - tilt]]] };
    default:
      return null;
  }
}

function glyphFor(ch: string, r: Rng): Glyph {
  if (DIGITS[ch]) return pick(r, DIGITS[ch]!);
  if (LETTERS[ch]) return pick(r, LETTERS[ch]!);
  if (ch === "(") return roundParen(true, r);
  if (ch === ")") return roundParen(false, r);
  if (ch === "[") return squareBracket(true, r);
  if (ch === "]") return squareBracket(false, r);
  if (ch === "{") return curlyBrace(true, r);
  if (ch === "}") return curlyBrace(false, r);
  const op = operatorGlyph(ch, r);
  if (op) return op;
  throw new Error(`glifo non definito: ${ch}`);
}

// ---- campionamento -----------------------------------------------------------

function catmull(pts: P[], per = 8): P[] {
  if (pts.length < 3) return pts;
  const out: P[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

function resample(pts: P[], step: number): P[] {
  if (pts.length < 2) return pts;
  const out: P[] = [pts[0]!];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d === 0) continue;
    let prev = a;
    while (acc + d >= step) {
      const k = (step - acc) / d;
      const q: P = [prev[0] + (b[0] - prev[0]) * k, prev[1] + (b[1] - prev[1]) * k];
      out.push(q);
      d = Math.hypot(b[0] - q[0], b[1] - q[1]);
      prev = q;
      acc = 0;
    }
    acc += d;
  }
  const last = pts[pts.length - 1]!;
  const end = out[out.length - 1]!;
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > 0.5) out.push(last);
  return out;
}

// ---- layout dell'espressione --------------------------------------------------

export type SpacingStyle = "normal" | "tight" | "touch";

export interface SynthOpts {
  seed: number;
  /** altezza di una cifra, px (default casuale 46–68) */
  H?: number;
  style?: SpacingStyle;
  /** 0 = scrittura ordinata, 1 = molto sciatta (tremore, pendenza) */
  sloppy?: number;
  lineWidth?: number;
  /** intervallo altezza parentesi in unità di H (default [1.15, 1.55]) */
  parenScale?: [number, number];
}

interface Item {
  ch: string;
  sup: boolean;
  /** frazione impilata «<n|d>» (solo banco, classe P8) */
  fr?: { n: string; d: string };
}

function parse(expr: string): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i]!;
    if (c === " ") continue;
    if (c === "<") {
      const end = expr.indexOf(">", i);
      const body = expr.slice(i + 1, end);
      const [n, d] = body.split("|");
      items.push({ ch: "<", sup: false, fr: { n: n!, d: d! } });
      i = end;
      continue;
    }
    if (c === "^") {
      const n = expr[i + 1];
      if (n === undefined) throw new Error("esponente mancante in " + expr);
      // (25/10) apice MULTI-CARATTERE: «2^-2» disegna «-» e «2» entrambi
      // in apice (serve per il banco dell'esponente negativo).
      if (n === "-") {
        items.push({ ch: "-", sup: true });
        i++;
        const d = expr[i + 1];
        if (d === undefined) throw new Error("esponente mancante dopo «-» in " + expr);
        items.push({ ch: d, sup: true });
        i++;
        continue;
      }
      items.push({ ch: n, sup: true });
      i++;
      continue;
    }
    items.push({ ch: c, sup: false });
  }
  return items;
}

const isParen = (c: string): boolean => "()[]{}".includes(c);

/** Glifo a cui appartiene un tratto (per l'audit della geometria). */
export interface Owner {
  idx: number;
  ch: string;
  sup: boolean;
}

export function synthExpression(expr: string, opts: SynthOpts): Stroke[] {
  return synthDetailed(expr, opts).strokes;
}

export function synthDetailed(expr: string, opts: SynthOpts): { strokes: Stroke[]; owners: Owner[] } {
  const r = mulberry32(opts.seed);
  const H = opts.H ?? range(r, 46, 68);
  const style = opts.style ?? "normal";
  const sloppy = opts.sloppy ?? 0.35;
  const lw = opts.lineWidth ?? 4;
  const [pmin, pmax] = opts.parenScale ?? [1.15, 1.55];
  const gaps: Record<SpacingStyle, [number, number]> = {
    normal: [0.16, 0.42],
    tight: [0.03, 0.15],
    touch: [-0.1, 0.04],
  };
  const [gMin, gMax] = gaps[style];
  const slant = range(r, -0.08, 0.14) * (0.5 + sloppy);
  const baseY = 100;
  let cursor = 30;
  const strokes: Stroke[] = [];
  const owners: Owner[] = [];
  const items = parse(expr);

  items.forEach((it, idx) => {
    if (it.fr) {
      // (7/10, giro 8) frazione impilata: numeratore sopra, barra, denominatore sotto, centrati
      const gapF = idx === 0 ? 0 : H * range(r, gMin, gMax);
      const sub = (txt: string): Stroke[] => synthDetailed(txt, { seed: opts.seed + 17 + idx, H: H * 0.8, style: "normal", sloppy, lineWidth: lw }).strokes;
      const nS = sub(it.fr.n);
      const dS = sub(it.fr.d);
      const bb = (ss: Stroke[]) => {
        const xs = ss.flatMap((q) => q.points.map((pt) => pt.x));
        const ys = ss.flatMap((q) => q.points.map((pt) => pt.y));
        return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      };
      const nb = bb(nS);
      const db = bb(dS);
      const W = Math.max(nb.x1 - nb.x0, db.x1 - db.x0) + H * range(r, 0.25, 0.5);
      const fx0 = cursor + gapF;
      const barY = baseY - 0.5 * H + gauss(r) * 0.03 * H;
      const place2 = (ss: Stroke[], b: { x0: number; x1: number; y0: number; y1: number }, dx: number, dy: number) =>
        ss.map((q) => ({ ...q, points: q.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) }));
      const gapV = H * range(r, 0.14, 0.3);
      const nPlaced = place2(nS, nb, fx0 + W / 2 - (nb.x0 + nb.x1) / 2, barY - gapV - nb.y1);
      const dPlaced = place2(dS, db, fx0 + W / 2 - (db.x0 + db.x1) / 2, barY + gapV - db.y0);
      const bar: Stroke = { points: Array.from({ length: 14 }, (_, k) => ({ x: fx0 + (W * k) / 13, y: barY + gauss(r) * 0.01 * H + (k / 13) * range(r, -0.05, 0.05) * H })), lineWidth: lw };
      for (const q of [...nPlaced, bar, ...dPlaced]) {
        strokes.push(q);
        owners.push({ idx, ch: "<", sup: false });
      }
      cursor = fx0 + W;
      return;
    }
    const g = glyphFor(it.ch, r);
    const paren = isParen(it.ch);
    const supScale = it.sup ? 0.5 : 1;
    // altezza di riferimento del glifo e suo riquadro verticale ASSOLUTO
    let Hg = H * supScale;
    let gt: number; // y alta del riquadro
    let gb: number; // y bassa del riquadro
    if (paren) {
      Hg = H * range(r, pmin, pmax);
      // centrata sull'asse (0.5H sopra la linea di base) con piccola deriva
      const cy = baseY - 0.5 * H + gauss(r) * 0.04 * H;
      gt = cy - Hg / 2;
      gb = cy + Hg / 2;
    } else {
      // esponente: mezza altezza, appena sopra la cima della cifra di base
      const ref = baseY - H + (it.sup ? -0.12 * H : 0);
      gt = ref + g.top * Hg;
      gb = ref + g.bottom * Hg;
    }
    const width = g.w * Hg;
    const gap = idx === 0 ? 0 : H * range(r, gMin, gMax);
    const x0 = cursor + gap;
    const sc = 1 + gauss(r) * 0.05 * (0.5 + sloppy);
    const rot = gauss(r) * 0.04 * (0.5 + sloppy);
    const cxg = x0 + width / 2;
    const cyg = (gt + gb) / 2;
    // (u,v) del glifo → px: scala + rotazione attorno al centro, poi pendenza
    const place = (u: number, v: number): P => {
      const x = x0 + u * width;
      const y = gt + v * (gb - gt);
      const dx = (x - cxg) * sc;
      const dy = (y - cyg) * sc;
      const rx = dx * Math.cos(rot) - dy * Math.sin(rot);
      const ry = dx * Math.sin(rot) + dy * Math.cos(rot);
      return [cxg + rx + slant * -ry, cyg + ry];
    };

    const flipOk = !g.keepDir;
    const dsDefault = range(r, 3.2, 5.2);
    g.strokes.forEach((sp) => {
      let ctrl: P[] = sp.map(([u, v]) => [u + gauss(r) * 0.018 * (1 + sloppy), v + gauss(r) * 0.018 * (1 + sloppy)] as P);
      if (flipOk && r() < 0.5) ctrl = ctrl.slice().reverse();
      let pts = ctrl.map(([u, v]) => place(u, v));
      if (g.smooth) pts = catmull(pts, 6);
      pts = resample(pts, dsDefault);
      // rumore LISCIO (come una mano vera: ondulazione lenta lungo il tratto)
      // + rumore minuscolo per punto (sensore): niente zigzag ad alta frequenza
      const amp = (0.012 + 0.016 * sloppy) * H;
      const l1 = range(r, 0.35, 0.9) * H;
      const l2 = range(r, 0.9, 1.8) * H;
      const ph = [r() * 6.283, r() * 6.283, r() * 6.283, r() * 6.283];
      let arc = 0;
      const points = pts.map(([x, y], i) => {
        if (i > 0) arc += Math.hypot(x - pts[i - 1]![0], y - pts[i - 1]![1]);
        const wx = amp * (Math.sin((6.283 * arc) / l1 + ph[0]!) * 0.6 + Math.sin((6.283 * arc) / l2 + ph[1]!) * 0.4);
        const wy = amp * (Math.sin((6.283 * arc) / l1 + ph[2]!) * 0.6 + Math.sin((6.283 * arc) / l2 + ph[3]!) * 0.4);
        return { x: x + wx + gauss(r) * 0.25, y: y + wy + gauss(r) * 0.25 };
      });
      strokes.push({ points, lineWidth: lw });
      owners.push({ idx, ch: it.ch, sup: it.sup });
    });
    cursor = x0 + width;
  });
  return { strokes, owners };
}

/** Disegna i tratti su un PNG (per ispezione visiva delle prove). */
export async function strokesToPng(strokes: Stroke[], canvasModule: any, file: string, w = 520, h = 160): Promise<void> {
  const fs = await import("node:fs");
  const c = canvasModule.createCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#111";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    ctx.lineWidth = s.lineWidth;
    ctx.beginPath();
    s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    if (s.points.length === 1) ctx.lineTo(s.points[0]!.x + 0.1, s.points[0]!.y);
    ctx.stroke();
  }
  fs.writeFileSync(file, c.toBuffer("image/png"));
}
