import { describe, it, expect } from "vitest";
import { rifinisciFrase } from "../../../server/costruisci";

describe("rifinisciFrase (testi guida)", () => {
  it("potenze: la base compare N volte, non «per sé stessa N volte»", () => {
    expect(rifinisciFrase("Moltiplico la base per sé stessa due volte.")).toBe("Scrivo la base due volte e le moltiplico.");
  });
  it("niente gergo «in croce»", () => {
    expect(rifinisciFrase("Inverto la seconda frazione e semplifico in croce.")).toContain("semplifico numeratori e denominatori");
  });
  it("decimali: metodo chiaro", () => {
    expect(rifinisciFrase("Scrivo il decimale come frazione decimale e la riduco.")).toContain("denominatore 10, 100");
  });
  it("non tocca frasi già buone", () => {
    const ok = "Sommo i coefficienti dei termini con la stessa parte letterale.";
    expect(rifinisciFrase(ok)).toBe(ok);
  });
});
