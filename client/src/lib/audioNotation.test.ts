import { describe, it, expect } from "vitest";
import { normalizeAudioNotation } from "./audioNotation";

describe("normalizeAudioNotation (giro 25, dettato vocale)", () => {
  it("rimuove gli spazi e i meno unicode", () => {
    expect(normalizeAudioNotation("[ 3 - 1⁄3 + ( 1⁄4 · 2⁄9 )^2 ]")).toBe("[3-1⁄3+(1⁄4·2⁄9)^2]");
    expect(normalizeAudioNotation("1 − 2")).toBe("1-2");
  });

  it("converte la barra in frazione impilata ⁄, ma non i due punti", () => {
    expect(normalizeAudioNotation("5 : (1/5)")).toBe("5:(1⁄5)");
    expect(normalizeAudioNotation("2/3·3/4")).toBe("2⁄3·3⁄4");
    expect(normalizeAudioNotation("(x+1)/(2x-3)")).toBe("(x+1)/(2x-3)"); // espressioni: resta /
  });

  it("converte ÷ in : e preserva · e ^", () => {
    expect(normalizeAudioNotation("6 ÷ 2")).toBe("6:2");
    expect(normalizeAudioNotation("(3⁄4)^2·1+1")).toBe("(3⁄4)^2·1+1");
  });

  it("gestisce casi vuoti e decimali", () => {
    expect(normalizeAudioNotation("")).toBe("");
    expect(normalizeAudioNotation("   ")).toBe("");
    expect(normalizeAudioNotation("3,5 + 1/2")).toBe("3,5+1⁄2");
  });
});
