import { describe, it, expect } from "vitest";
import { collapseRepeatedMinus, normalizeExpressionOcr, prettyExpression } from "./exprOcr";

describe("collapseRepeatedMinus — rete di sicurezza del doppio meno (27/9)", () => {
  it("due o più meni consecutivi si collassano in uno", () => {
    expect(collapseRepeatedMinus("--")).toBe("-");
    expect(collapseRepeatedMinus("5--3")).toBe("5-3");
    expect(collapseRepeatedMinus("3---8")).toBe("3-8");
  });

  it("un meno solo, le sottrazioni legittime e il resto restano intatti", () => {
    expect(collapseRepeatedMinus("-8")).toBe("-8");
    expect(collapseRepeatedMinus("3-8-2")).toBe("3-8-2");
    expect(collapseRepeatedMinus("\\sqrt9-5")).toBe("\\sqrt9-5");
    expect(collapseRepeatedMinus("2x^2+3")).toBe("2x^2+3");
  });

  it("accetta anche il meno Unicode \u2212", () => {
    expect(collapseRepeatedMinus("5\u2212\u22123")).toBe("5-3");
  });
});

describe("puntino di moltiplicazione perso nel percorso foto (26/9)", () => {
  it("«3.3» (· letto punto) → 3*3, NON il decimale 3,3", () => {
    expect(normalizeExpressionOcr("3.3")).toBe("3*3");
    expect(normalizeExpressionOcr("2.3x+1")).toBe("2*3x+1");
  });

  it("la virgola resta decimale: «2,5+1» → 2.5+1", () => {
    expect(normalizeExpressionOcr("2,5+1")).toBe("2.5+1");
  });
});

describe("potenze NUMERICHE nell'OCR (°, ? dopo una cifra)", () => {
  it("«2°+5» (lettura reale di 2³+5) → 2^2+5", () => {
    expect(normalizeExpressionOcr("2°+5")).toBe("2^2+5");
  });

  it("il simbolo spurio prima di una parentesi SI SCARTA (mai inventare «*»): «2°(3+(4-1)]:5»", () => {
    // lettura reale di «2·[3+(4-1)]:5»: il · diventava °; l'app lo scarta e
    // la giustapposizione 2(3… vale già come prodotto (l'OCR converte
    // «:» in «/»: il motore lo stampa poi come «:»)
    expect(normalizeExpressionOcr("2°(3+(4-1)]:5")).toBe("2(3+(4-1))/5");
  });
});

describe("radici nell'OCR (la √ diventa V)", () => {
  it("«V9+V16» → √9+√16 (lettura reale: «V9-2+V16:2»)", () => {
    expect(normalizeExpressionOcr("V9+V16")).toBe("√9+√16");
  });

  it("«3:V25-V16:2» → 3/√25-√16/2 (il motore stampa poi «:»)", () => {
    expect(normalizeExpressionOcr("3:V25-V16:2")).toBe("3/√25-√16/2");
  });

  it("«V(4+5):3» → √(4+5)/3", () => {
    expect(normalizeExpressionOcr("V(4+5):3")).toBe("√(4+5)/3");
  });

  it("la radice già unicode resta √", () => {
    expect(normalizeExpressionOcr("√9+1")).toBe("√9+1");
  });
});

describe("riparazione parentesi graffe e quadre lette male", () => {
  it("quadra chiusa con tonda: «(3+(4-1)]:5» → «(3+(4-1))/5»", () => {
    expect(normalizeExpressionOcr("(3+(4-1)]:5")).toBe("(3+(4-1))/5");
  });

  it("quadra aperta letta come tonda: «2*(3+(4-1)]:5» → tonda chiusa bene", () => {
    expect(normalizeExpressionOcr("2*(3+(4-1)]:5")).toBe("2*(3+(4-1))/5");
  });

  it("parentesi mancanti in fondo vengono aggiunte: «{2+[3*(4-1)]:5»", () => {
    expect(normalizeExpressionOcr("{2+[3*(4-1)]:5")).toBe("{2+[3*(4-1)]/5}");
  });

  it("le parentesi GIUSTE restano invariate (regola fissa quadre/graffe)", () => {
    expect(normalizeExpressionOcr("[2*(3+1)]:4")).toBe("[2*(3+1)]/4");
    expect(normalizeExpressionOcr("{2+[3*(4-1)]}:5")).toBe("{2+[3*(4-1)]}/5");
  });

  it("closer di troppo senza apertura: scartato", () => {
    expect(normalizeExpressionOcr("(5))+1")).toBe("(5)+1");
  });
});

describe("esponenti su lettere (regole esistenti)", () => {
  it("cifra attaccata alla lettera = esponente", () => {
    expect(normalizeExpressionOcr("3x2-5x+2")).toBe("3x^2-5x+2");
  });

  it("simboli d'apice spurii dopo una lettera prima di un operatore", () => {
    expect(normalizeExpressionOcr("2x°+1")).toBe("2x^2+1");
    expect(normalizeExpressionOcr("(x+1)?-(x-1)")).toBe("(x+1)^2-(x-1)");
  });

  it("simbolo spurio prima di una cifra: scartato, poi la cifra attaccata diventa esponente («x'2» → x^2)", () => {
    expect(normalizeExpressionOcr("3x'2-1")).toBe("3x^2-1");
  });

  it("apice letto come X maiuscola", () => {
    expect(normalizeExpressionOcr("3xX7")).toBe("3x^7");
    expect(normalizeExpressionOcr("5xX+2")).toBe("5x+2");
  });

  it("l'«=» con lettere dopo è un meno", () => {
    expect(normalizeExpressionOcr("3xX7=5xX+2")).toBe("3x^7-5x+2");
  });
});

describe("collapseRepeatedMinus — «-=» impossibile (7/10)", () => {
  it("«14-=8» → «14-8» e «[2-=1]» → «[2-1]»", () => {
    expect(collapseRepeatedMinus("14-=8")).toBe("14-8");
    expect(collapseRepeatedMinus("[2-=1]")).toBe("[2-1]");
  });
  it("«=-» (x=-3) e un «=» normale restano intatti", () => {
    expect(collapseRepeatedMinus("x=-3")).toBe("x=-3");
    expect(collapseRepeatedMinus("2x+1=5")).toBe("2x+1=5");
  });
});
