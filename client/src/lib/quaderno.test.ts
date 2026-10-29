import { describe, it, expect } from "vitest";
import { chiaveRiga, dedupeRigheAdiacenti } from "./quaderno";

describe("dedupeRigheAdiacenti (segnalazione 27/9: rigo duplicato nel quaderno)", () => {
  it("elimina il rigo consecutivo identico al precedente", () => {
    const righe = [
      "(2+5^2):(4^2-2\\cdot5-3)+48:(6^2-2^3)",
      "27 : 3 + 48 : 28",
      "27 : 3 + 48 : 28", // duplicato consecutivo
      "27 : 3 = 9",
      "48 : 28 = 12/7",
      "9 + 12/7 = 75/7",
      "75/7",
    ];
    expect(dedupeRigheAdiacenti(righe, (r) => r)).toEqual([
      "(2+5^2):(4^2-2\\cdot5-3)+48:(6^2-2^3)",
      "27 : 3 + 48 : 28",
      "27 : 3 = 9",
      "48 : 28 = 12/7",
      "9 + 12/7 = 75/7",
      "75/7",
    ]);
  });

  it("confronta a spazi normalizzati (stessa riga con spaziatura diversa)", () => {
    expect(chiaveRiga("27  :   3   + 48 : 28")).toBe("27 : 3 + 48 : 28");
    const righe = ["27 : 3 + 48 : 28", "27  : 3  +  48 : 28"];
    expect(dedupeRigheAdiacenti(righe, (r) => r)).toHaveLength(1);
  });

  it("NON tocca righi uguali NON consecutivi (possono tornare dopo altri passi)", () => {
    const righe = ["5 + 3 = 8", "2 · 4 = 8", "5 + 3 = 8"];
    expect(dedupeRigheAdiacenti(righe, (r) => r)).toHaveLength(3);
  });

  it("una sequenza senza duplicati resta invariata", () => {
    const righe = ["27 : 3 = 9", "48 : 28 = 12/7", "9 + 12/7 = 75/7"];
    expect(dedupeRigheAdiacenti(righe, (r) => r)).toEqual(righe);
  });

  it("funziona con oggetti e funzione chiave (passi del motore)", () => {
    const passi = [
      { latex: "27 : 3 + 48 : 28", op: "27:3" },
      { latex: "27 : 3 + 48 : 28", op: "48:28" },
      { latex: "9 + 12/7", op: "9+12/7" },
    ];
    expect(dedupeRigheAdiacenti(passi, (p) => p.latex)).toEqual([
      { latex: "27 : 3 + 48 : 28", op: "27:3" },
      { latex: "9 + 12/7", op: "9+12/7" },
    ]);
  });
});
