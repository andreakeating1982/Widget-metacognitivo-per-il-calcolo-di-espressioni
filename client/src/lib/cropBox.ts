/** Geometria della finestra di ritaglio (percentuali 0–100 sulla foto). */

export const MIN_BOX = 8;

export type Box = { x: number; y: number; w: number; h: number };
export type Edge = "top" | "right" | "bottom" | "left";
export type Corner = "nw" | "ne" | "sw" | "se";

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Sposta l'INTERO box di dx/dy %, restando dentro la foto (estremi inclusi). */
export function moveBox(base: Box, dxPct: number, dyPct: number): Box {
  return {
    ...base,
    x: round1(clamp(base.x + dxPct, 0, 100 - base.w)),
    y: round1(clamp(base.y + dyPct, 0, 100 - base.h)),
  };
}

/** Ridimensiona dal bordo indicato (il bordo opposto resta fisso). */
export function resizeBox(base: Box, edge: Edge, deltaPct: number): Box {
  const { x, y, w, h } = base;
  switch (edge) {
    case "top": {
      const ny = round1(clamp(y + deltaPct, 0, y + h - MIN_BOX));
      return { x, y: ny, w, h: round1(y + h - ny) };
    }
    case "bottom": {
      return { x, y, w, h: round1(clamp(h + deltaPct, MIN_BOX, 100 - y)) };
    }
    case "left": {
      const nx = round1(clamp(x + deltaPct, 0, x + w - MIN_BOX));
      return { x: nx, y, w: round1(x + w - nx), h };
    }
    case "right": {
      return { x, y, w: round1(clamp(w + deltaPct, MIN_BOX, 100 - x)), h };
    }
  }
}

/** Ridimensiona da un angolo (i due bordi opposti restano fissi). */
export function resizeCorner(base: Box, corner: Corner, dxPct: number, dyPct: number): Box {
  const { x, y, w, h } = base;
  let nx = x;
  let ny = y;
  let nw = w;
  let nh = h;
  if (corner === "nw" || corner === "sw") {
    nx = round1(clamp(x + dxPct, 0, x + w - MIN_BOX));
    nw = round1(x + w - nx);
  } else {
    nw = round1(clamp(w + dxPct, MIN_BOX, 100 - x));
  }
  if (corner === "nw" || corner === "ne") {
    ny = round1(clamp(y + dyPct, 0, y + h - MIN_BOX));
    nh = round1(y + h - ny);
  } else {
    nh = round1(clamp(h + dyPct, MIN_BOX, 100 - y));
  }
  return { x: nx, y: ny, w: nw, h: nh };
}
