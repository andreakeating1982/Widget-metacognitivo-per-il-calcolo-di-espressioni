// ⚠️ BANCO DI PROVA (6/10) — catalogo dei casi di scrittura a mano.
// Sintassi dell'espressione (stessa di synthInk.ts): cifre, x y a b,
// + - * (= puntino di moltiplicazione) : = ( ) [ ] { }, ^d = esponente d.
// «Elementi» = caratteri (l'app ne ammette al massimo 5 per pezzo; il banco conserva i casi piu' lunghi, scritti quando il limite era 8).

export interface BenchCase {
  id: string;
  cls: string;
  expr: string;
}

export const CLASSES: Record<string, string> = {
  P1: "Solo parentesi di seguito",
  P2: "Parentesi con contenuto",
  P3: "Parentesi + numeri adiacenti",
  P4: "Parentesi annidate con operatori",
  P5: "Parentesi con lettere",
  P6: "Potenze",
  P7: "Numeri e segni",
  P8: "Frazioni impilate",
  P9: "Parentesi e frazioni",
};

const RAW: Record<string, string[]> = {
  P1: ["((", "))", "[(", ")]", "{[", "]}", "{[(", ")]}", ")(", "][", "}{", "({", "})", "[[", "]]", "{{", "}}", "([", "(["],
  P2: ["(2)", "[3]", "{4}", "(2+3)", "[2-1]", "{5+1}", "((2))", "[(2)]", "{[(2)]}", "((2+3))", "[(2+3)]", "{[2]}", "[{2}]"],
  P3: [
    "3(2+1)", "(2+1)3", "2(3)", "(3)2", "5[2+1]", "[2+1]5", "3{2+1}", "{2+1}3", "(2)(3)", "[2][3]", "(2+3)(4-1)",
    "2(3+4)5", "12(3)", "(3)12", "4(5)6", "10[2]", "(7)8", "[9]0", "8(6)", "(1)(1)", "2[(3)]", "3[2(1)]",
  ],
  P4: [
    "[(2+3)*4]", "2*[3+(4-1)]", "((2+3)*(4-1))", "[2*(3+4)]:5", "(2+3)*(4-1)", "{2*[3-(1+1)]}", "[(5-2)*(4+1)]",
    "-(2+3)", "-[3-1]", "(-3)", "(-2)*(-3)", "3-(2-1)", "5-[2+(3-1)]", "3*[2+1]", "3*(2+1)", "2*(3-1)*4",
  ],
  P5: ["(x+1)(x-1)", "x(x+1)", "(x+1)x", "3x(2x+1)", "(a+b)(a-b)", "2(a+b)", "[x+(y-1)]", "3a(b+1)", "3*[2x+1]", "(2x-1)(x+3)", "x[x+1]"],
  P6: ["(2+1)^2", "[3]^2", "2^3", "4^2", "3^2", "5^2", "(2^2)", "(3^2)*2", "2^2*3", "(-2)^2", "x^2", "(x+1)^2", "3x^2", "(x^2)", "2^2+3^2"],
  // (7/10, giro 8) Frazioni impilate: «<n|d>» = n sopra, barra, d sotto (sintassi SOLO del banco)
  P8: ["<1|2>", "<3|4>", "<2|3>", "<5|6>", "<7|8>", "<1|5>", "<9|2>", "<12|5>", "<3|10>", "<x|2>", "<1|x>", "<2|3>+<1|3>", "<1|2>*<3|4>", "3<1|2>", "-<2|5>", "<1|2>:<3|4>", "<a|b>", "<2x|3>"],
  P7: ["7", "12", "305", "48", "1000", "9", "86", "2+3", "12-5", "45+78", "6*8", "18:3", "2+3=5", "36:4", "7*9", "0", "14-8", "56+4"],
  // (19/10) PARENTESI E FRAZIONI: la segnalazione «il riconoscimento delle
  // parentesi vicino alle frazioni è difficoltoso». La parentesi sintetica è
  // alta 1,15–1,55×H, la frazione ≈ 2×H: sono il caso critico (parentesi più
  // corte della frazione accanto/attorno ad essa).
  P9: ["(<1|2>)", "[<3|4>]", "{<2|5>}", "(<1|2>):3", "2[<3|4>]", "(<1|2>+<3|4>)", "[<2|3>]-1", "3*(<1|5>)", "(<1|2>)[<3|4>]", "{<1|2>}+5"],
};

// Stessa regola dell'app (lib/pieceCount.ts): le graffe { } NON contano nel limite di elementi.
export { countElements } from "../pieceCount";

export const CASES: BenchCase[] = Object.entries(RAW).flatMap(([cls, list]) =>
  list.map((expr, i) => ({ id: `${cls}-${String(i + 1).padStart(2, "0")}`, cls, expr })),
);

/** Forma canonica per il confronto: stessa lettura, notazioni diverse. */
export function canon(s: string): string {
  return s
    .replace(/\\left|\\right/g, "")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\cdot|\\times|\\bullet|·|×/g, "*")
    .replace(/\\div|÷|\//g, ":")
    .replace(/\^\{([^{}]*)\}/g, "^$1")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\s+/g, "");
}
