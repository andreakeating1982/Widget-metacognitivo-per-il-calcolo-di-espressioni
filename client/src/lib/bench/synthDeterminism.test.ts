import { describe, expect, it } from "vitest";
import { synthExpression } from "./synthInk";
const h = (st: { points: { x: number; y: number }[] }[]) => {
  let a = 2166136261;
  for (const s of st) for (const p of s.points) { a = Math.imul(a ^ Math.round(p.x * 100), 16777619); a = Math.imul(a ^ Math.round(p.y * 100), 16777619); }
  return a >>> 0;
};
describe("determinismo del generatore", () => {
  it("stessa (expr, seed, style) → stessi tratti, qualunque sia l'ordine", () => {
    const a1 = h(synthExpression("12-5", { seed: 1352, style: "normal" }));
    synthExpression("[3]", { seed: 5, style: "tight" });
    synthExpression("x(x+1)", { seed: 77, style: "touch" });
    const a2 = h(synthExpression("12-5", { seed: 1352, style: "normal" }));
    expect(a2).toBe(a1);
  });
});
