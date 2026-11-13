import { describe, expect, it } from "vitest";
import { rewritePlusSigns } from "./plusSigns";

const line = (x0: number, y0: number, x1: number, y1: number, n = 12) => ({
  points: Array.from({ length: n }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / (n - 1), y: y0 + ((y1 - y0) * i) / (n - 1) })),
});
const tall = line(5, 0, 5, 38); // cifra alta di riferimento (maxH = 38)

describe("rewritePlusSigns", () => {
  it("croce centrata (orizzontale + verticale) → «+» estratto, centro = x del verticale", () => {
    const r = rewritePlusSigns([tall, line(40, 19, 60, 19), line(50, 9, 50, 29)]);
    expect(r.pluses).toBe(1);
    expect(r.centers[0]).toBeCloseTo(50, 3);
    expect(r.strokes.length).toBe(1);
  });
  it("«4» chiuso (verticale + orizzontale a ~70% / ~75%): NON è un «+»", () => {
    const four = [line(60, 5, 60, 35), line(45, 27, 63, 27)];
    expect(rewritePlusSigns([tall, ...four]).pluses).toBe(0);
  });
  it("«t» (traversa a ~30%): NON è un «+»", () => {
    expect(rewritePlusSigns([tall, line(50, 0, 50, 30), line(42, 9, 58, 9)]).pluses).toBe(0);
  });
  it("«1» con piede e «7» col cappello: NON sono «+»", () => {
    expect(rewritePlusSigns([tall, line(50, 0, 50, 30), line(42, 30, 58, 30)]).pluses).toBe(0);
    expect(rewritePlusSigns([tall, line(50, 0, 50, 30), line(42, 0, 58, 0)]).pluses).toBe(0);
  });
  it("bracci storti o curvi (cifra «x» a due diagonali): nessuna estrazione", () => {
    expect(rewritePlusSigns([tall, line(40, 9, 60, 29), line(60, 9, 40, 29)]).pluses).toBe(0);
  });
  it("due croci vicine («2+3+4»): entrambe estratte, in ordine di x", () => {
    const r = rewritePlusSigns([tall, line(30, 19, 46, 19), line(38, 11, 38, 27), line(80, 19, 96, 19), line(88, 11, 88, 27)]);
    expect(r.pluses).toBe(2);
    expect(r.centers[0]).toBeLessThan(r.centers[1]!);
  });
  it("bracci troppo diversi (verticale doppio dell'orizzontale): nessuna estrazione", () => {
    expect(rewritePlusSigns([tall, line(40, 19, 50, 19), line(45, 0, 45, 38)]).pluses).toBe(0);
  });
});
