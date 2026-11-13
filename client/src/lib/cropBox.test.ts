import { describe, expect, it } from "vitest";
import { MIN_BOX, moveBox, resizeBox, resizeCorner } from "./cropBox";

const full = { x: 0, y: 0, w: 100, h: 100 };

describe("resizeBox — lato destro (il bordo che non si restringeva)", () => {
  it("restringe trascinando verso sinistra (delta negativo)", () => {
    expect(resizeBox(full, "right", -25)).toEqual({ x: 0, y: 0, w: 75, h: 100 });
  });
  it("può arrivare fino a MIN_BOX", () => {
    expect(resizeBox(full, "right", -100).w).toBe(MIN_BOX);
  });
  it("non sfora il bordo destro della foto", () => {
    const shrunk = { x: 10, y: 0, w: 50, h: 100 };
    expect(resizeBox(shrunk, "right", 80).w).toBe(90);
  });
  it("allarga di nuovo dopo un restringimento", () => {
    const mid = { x: 0, y: 0, w: 60, h: 100 };
    expect(resizeBox(mid, "right", 20).w).toBe(80);
  });
});

describe("resizeBox — gli altri tre lati", () => {
  it("sinistra: restringe spostando il bordo verso destra", () => {
    expect(resizeBox(full, "left", 20)).toEqual({ x: 20, y: 0, w: 80, h: 100 });
  });
  it("alto: restringe spostando il bordo verso il basso", () => {
    expect(resizeBox(full, "top", 15)).toEqual({ x: 0, y: 15, w: 100, h: 85 });
  });
  it("basso: restringe con delta negativo", () => {
    expect(resizeBox(full, "bottom", -30)).toEqual({ x: 0, y: 0, w: 100, h: 70 });
  });
});

describe("resizeCorner", () => {
  it("angolo SE restringe larghezza e altezza", () => {
    expect(resizeCorner(full, "se", -20, -10)).toEqual({ x: 0, y: 0, w: 80, h: 90 });
  });
  it("angolo NE restringe da destra e dall'alto", () => {
    expect(resizeCorner(full, "ne", -25, 10)).toEqual({ x: 0, y: 10, w: 75, h: 90 });
  });
});

describe("moveBox", () => {
  it("resta dentro la foto", () => {
    const b = { x: 10, y: 10, w: 40, h: 40 };
    expect(moveBox(b, 80, 80)).toEqual({ x: 60, y: 60, w: 40, h: 40 });
  });
});
