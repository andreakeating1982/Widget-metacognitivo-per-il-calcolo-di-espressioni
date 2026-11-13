import { describe, expect, it } from "vitest";
import { dotsBetweenFractions } from "./fracDots";

const st = (x0: number, y0: number, x1: number, y1: number) => ({ points: [{ x: x0, y: y0 }, { x: x1, y: y1 }] });
const frac = (x0: number, x1: number) => ({
  lineStrokes: [st(x0, 67, x1, 67)],
  numStrokes: [st(x0 + 8, 5, x0 + 20, 55)],
  denStrokes: [st(x0 + 8, 80, x0 + 20, 125)],
  numScaled: [],
  denScaled: [],
  cx: (x0 + x1) / 2,
});
const F = [frac(0, 40), frac(120, 160)] as any[];

describe("dotsBetweenFractions", () => {
  it("puntino tra due frazioni → estratto", () => {
    const dot = st(80, 67, 81, 68);
    const r = dotsBetweenFractions([dot], F);
    expect(r.centers.length).toBe(1);
    expect(r.strokes.length).toBe(0);
  });
  it("una sola frazione: nessun effetto", () => {
    const dot = st(80, 67, 81, 68);
    expect(dotsBetweenFractions([dot], [F[0]]).centers.length).toBe(0);
  });
  it("puntino fuori fascia (in basso) o grande: resta", () => {
    expect(dotsBetweenFractions([st(80, 120, 81, 121)], F).centers.length).toBe(0);
    expect(dotsBetweenFractions([st(70, 50, 95, 80)], F).centers.length).toBe(0);
  });
  it("puntino fuori dallo spazio tra le frazioni: resta", () => {
    expect(dotsBetweenFractions([st(20, 67, 21, 68)], F).centers.length).toBe(0);
    expect(dotsBetweenFractions([st(200, 67, 201, 68)], F).centers.length).toBe(0);
  });
});
