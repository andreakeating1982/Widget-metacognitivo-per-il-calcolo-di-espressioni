import { describe, expect, it } from "vitest";
import { closeWideGaps } from "./gapClose";

const stroke = (x0: number, x1: number, y0 = 0, y1 = 100) => ({
  points: [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
  ],
});

const xr = (s: { points: { x: number }[] }): [number, number] => [
  Math.min(...s.points.map((p) => p.x)),
  Math.max(...s.points.map((p) => p.x)),
];

describe("closeWideGaps", () => {
  it("accorcia un vuoto largo alla misura massima (frazione dell'altezza)", () => {
    // altezza 100, vuoto di 150 px fra le colonne → portato a 20
    const out = closeWideGaps([stroke(0, 30), stroke(180, 210)], 0.2);
    expect(xr(out[0]!)).toEqual([0, 30]);
    expect(xr(out[1]!)).toEqual([50, 80]);
  });

  it("non tocca i vuoti già stretti e restituisce lo stesso array", () => {
    const st = [stroke(0, 30), stroke(40, 70)];
    expect(closeWideGaps(st, 0.2)).toBe(st);
  });

  it("tratti sovrapposti in x restano nella stessa colonna", () => {
    const out = closeWideGaps([stroke(0, 30), stroke(10, 25, 40, 60), stroke(300, 330)], 0.2);
    expect(xr(out[1]!)).toEqual([10, 25]);
    expect(xr(out[2]!)).toEqual([50, 80]);
  });

  it("più vuoti: si sommano gli accorciamenti, l'ordine dei tratti non cambia", () => {
    const out = closeWideGaps([stroke(0, 20), stroke(120, 140), stroke(300, 320)], 0.2);
    expect(xr(out[0]!)).toEqual([0, 20]);
    expect(xr(out[1]!)).toEqual([40, 60]);
    expect(xr(out[2]!)).toEqual([80, 100]);
  });

  it("frazione ≤ 0, un solo tratto o altezza nulla: nessuna modifica", () => {
    const st = [stroke(0, 30), stroke(300, 330)];
    expect(closeWideGaps(st, 0)).toBe(st);
    const one = [stroke(0, 30)];
    expect(closeWideGaps(one, 0.2)).toBe(one);
    const flat = [stroke(0, 30, 5, 5), stroke(300, 330, 5, 5)];
    expect(closeWideGaps(flat, 0.2)).toBe(flat);
  });

  it("non muta i tratti originali (copia)", () => {
    const a = stroke(0, 30);
    const b = stroke(180, 210);
    closeWideGaps([a, b], 0.2);
    expect(xr(b)).toEqual([180, 210]);
  });
});

describe("closeWideGaps con buchi (holesX)", () => {
  it("chiude solo il vuoto che contiene un elemento tolto", () => {
    // due vuoti larghi: il primo (30→180) contiene un buco a x=100, il secondo (210→400) no
    const out = closeWideGaps([stroke(0, 30), stroke(180, 210), stroke(400, 430)], 0.2, [100]);
    expect(xr(out[1]!)).toEqual([50, 80]);
    expect(xr(out[2]!)).toEqual([270, 300]); // spostato solo dal primo accorciamento (130)
  });

  it("senza buchi nei vuoti non cambia nulla (stesso array)", () => {
    const st = [stroke(0, 30), stroke(180, 210)];
    expect(closeWideGaps(st, 0.2, [500])).toBe(st);
    expect(closeWideGaps(st, 0.2, [])).toBe(st);
  });
});
