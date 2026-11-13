import { describe, expect, it } from "vitest";
import { exactNumericEquality } from "./numericRadicalEquality";

describe("radicali numerici: confronto esatto, non decimale arrotondato", () => {
  it.each([
    ["√8", "2√2"],
    ["2√15+√15", "3√15"],
    ["√12+√3", "3√3"],
    ["√(3/4)*√8", "√6"],
    ["√(1/4)", "1/2"],
    ["√2/√2", "1"],
    ["∛16", "2∛2"],
    ["∛(-16)", "-2∛2"],
    ["∜16", "2"],
    ["0,1+0,2", "3/10"],
  ])("%s e %s sono equivalenti", (a,b) => expect(exactNumericEquality(a,b)).toBe(true));
  it.each([
    ["√2", "1,414213562"],
    ["√8", "3√2"],
    ["√2+√3", "√5"],
    ["√8", "-2√2"],
    ["∛(-16)", "2∛2"],
  ])("%s e %s non sono esattamente equivalenti", (a,b) => expect(exactNumericEquality(a,b)).toBe(false));
  it("un'approssimazione cubica non viene accettata anche quando è molto vicina", () => {
    expect(exactNumericEquality("∛2", "1,2599210499")).not.toBe(true);
  });
  it("non indovina quando non è supportata una radice con radicando irrazionale", () => {
    expect(exactNumericEquality("√2+√3", "√(5+2√6) ")).toBeNull();
  });
});

