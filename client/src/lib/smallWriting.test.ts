import { describe, expect, it } from "vitest";
import { isSmallWriting, medianStrokeHeight } from "./smallWriting";

const col = (x: number, h: number) => ({ points: [{ x, y: 10 }, { x, y: 10 + h }] });

describe("smallWriting", () => {
  it("cifre di 38 px = scrittura piccola", () => {
    expect(isSmallWriting([col(10, 38), col(40, 38), col(70, 36)])).toBe(true);
  });
  it("cifre di 50 px o più: nessun suggerimento", () => {
    expect(isSmallWriting([col(10, 50), col(40, 55), col(70, 60)])).toBe(false);
  });
  it("puntini e trattini (<15 px) non abbassano la mediana", () => {
    expect(medianStrokeHeight([col(10, 60), col(40, 62), col(70, 4), col(90, 3), col(110, 2)])).toBe(62);
    expect(isSmallWriting([col(10, 60), col(40, 62), col(70, 4), col(90, 3), col(110, 2)])).toBe(false);
  });
  it("nessun tratto o soli segni piccoli: nessun suggerimento", () => {
    expect(isSmallWriting([])).toBe(false);
    expect(isSmallWriting([col(10, 5)])).toBe(false);
  });
});
