import { describe, expect, it } from "vitest";
import { synthExpression, type SpacingStyle } from "./bench/synthInk";
import { detectBracketKinds, promoteRoundOpeners, restoreSquareBrackets, rewriteBrackets } from "./squareBrackets";

/**
 * Regressione 6/10 — graffa DEBOLE letta «tonda»: abbinamento esplicito con la chiusura FORTE.
 *
 * Le tonde non entrano in `promotePairs` (restano al modello). A cifre piccole e pixel interi una `{`
 * disegnata in un tratto solo ha un profilo da «tonda con un angolo» (nessuna punta rilevata, uncino
 * 0,09–0,10, depth 0,12–0,15): il modello la legge `(` e `{5+1}` diventava `(5+1}`. Prima la salvava
 * per caso la regola degli angoli di `classifyProfile` (la dichiarava «quadra debole» e `promotePairs`
 * la faceva graffa insieme alla `}` forte). Stretta quella regola (una `(` rumorosa non deve
 * diventare `[`: `{[(3+2)]}` → `{[[3+2)]}` nel browser), la salvezza è ESPLICITA: una chiusura graffa
 * FORTE senza apertura graffa, la cui apertura più vicina non abbinata è una TONDA, non può essere
 * `(…}` (matematica non valida) ⇒ l'apertura è una graffa debole. SOLO l'apertura: una `)` senza `(`
 * rilevata è un caso comune (tonda bassa saltata) e `{2·(3+1)}` non deve rompersi.
 */
type K = "round" | "square" | "curly";
const pc = (kind: K, isOpen: boolean, cx: number, strength: "strong" | "weak" = "weak", gh = 100) => ({
  kind,
  isOpen,
  cx,
  gh,
  strength,
});

describe("promoteRoundOpeners (unit)", () => {
  it("`(5+1}`: la tonda che apre è promossa a graffa FORTE", () => {
    const open = pc("round", true, 0);
    const close = pc("curly", false, 100, "strong");
    const promoted = promoteRoundOpeners([close], [open], 60, [50]);
    expect(promoted).toEqual([open]);
    expect(open.kind).toBe("curly");
    expect(open.strength).toBe("strong");
    expect(close.kind).toBe("curly");
  });

  it("`{(2+1)}` ben tipata: nessuna promozione (la `)` chiude la `(`, la `}` chiude la `{`)", () => {
    const co = pc("curly", true, 0, "strong");
    const cc = pc("curly", false, 100, "strong");
    const ro = pc("round", true, 20);
    const rc = pc("round", false, 80);
    expect(promoteRoundOpeners([co, cc], [ro, rc], 60, [50])).toEqual([]);
    expect([ro.kind, rc.kind]).toEqual(["round", "round"]);
  });

  it("`(2+3)`: solo tonde, nessuna promozione", () => {
    const ro = pc("round", true, 0);
    const rc = pc("round", false, 100);
    expect(promoteRoundOpeners([], [ro, rc], 60, [50])).toEqual([]);
    expect(ro.kind).toBe("round");
  });

  it("`{2·(3+1)}` con la `(` NON rilevata: la `)` resta tonda (la chiusura non si promuove mai)", () => {
    const co = pc("curly", true, 0, "strong");
    const cc = pc("curly", false, 100, "strong");
    const rc = pc("round", false, 80);
    expect(promoteRoundOpeners([co, cc], [rc], 60, [50])).toEqual([]);
    expect(rc.kind).toBe("round");
  });

  it("un'apertura BASSA (non più alta del contenuto) non si promuove", () => {
    const open = pc("round", true, 0, "weak", 50);
    const close = pc("curly", false, 100, "strong");
    expect(promoteRoundOpeners([close], [open], 60, [50])).toEqual([]);
    expect(open.kind).toBe("round");
  });

  it("senza contenuto fra le due non si promuove (coppia vuota)", () => {
    const open = pc("round", true, 0);
    const close = pc("curly", false, 100, "strong");
    expect(promoteRoundOpeners([close], [open], 60, [250])).toEqual([]);
    expect(open.kind).toBe("round");
  });

  it("una chiusura graffa DEBOLE non basta (serve la firma forte)", () => {
    const open = pc("round", true, 0);
    const close = pc("curly", false, 100, "weak");
    expect(promoteRoundOpeners([close], [open], 60, [50])).toEqual([]);
    expect(open.kind).toBe("round");
  });

  it("promuove l'apertura più VICINA non abbinata, non una più esterna", () => {
    const outer = pc("round", true, 0);
    const inner = pc("round", true, 20);
    const close = pc("curly", false, 100, "strong");
    expect(promoteRoundOpeners([close], [outer, inner], 60, [50])).toEqual([inner]);
    expect(outer.kind).toBe("round");
    expect(inner.kind).toBe("curly");
  });

  it("una tonda già abbinata alla sua `)` non viene toccata: si promuove solo quella rimasta sola", () => {
    const lone = pc("round", true, 0);
    const paired = pc("round", true, 10);
    const pairedClose = pc("round", false, 60);
    const close = pc("curly", false, 100, "strong");
    expect(promoteRoundOpeners([close], [lone, paired, pairedClose], 60, [30])).toEqual([lone]);
    expect(paired.kind).toBe("round");
    expect(pairedClose.kind).toBe("round");
  });

  it("le quadre non c'entrano: `[…}` resta affare di promotePairs", () => {
    const sq = pc("square", true, 0, "weak");
    const close = pc("curly", false, 100, "strong");
    expect(promoteRoundOpeners([close, sq], [], 60, [50])).toEqual([]);
  });
});

const at38 = (expr: string, style: SpacingStyle, seed: number) => {
  const strokes = synthExpression(expr, { seed, style, H: 38 });
  for (const st of strokes) for (const p of st.points) { p.x = Math.round(p.x); p.y = Math.round(p.y); }
  return strokes;
};
const tag = (b: { kind: string; isOpen: boolean }) => `${b.kind[0]}${b.isOpen ? "(" : ")"}`;

describe("rewriteBrackets: la `{` debole di cifre piccole (H=38, pixel interi) è estratta come graffa", () => {
  const styles: SpacingStyle[] = ["normal", "tight", "touch"];

  it.each(styles)("`{5+1}` seme 9467 (%s): graffa aperta + graffa chiusa, restano 5 tratti", (style) => {
    const rb = rewriteBrackets(at38("{5+1}", style, 9467) as never);
    expect(rb.brackets.map(tag)).toEqual(["c(", "c)"]);
    expect(rb.strokes).toHaveLength(5);
  });

  it.each(styles)("`{[(2)]}` seme 1718 (%s): `{ [ ] }` estratte, la tonda resta al modello", (style) => {
    const rb = rewriteBrackets(at38("{[(2)]}", style, 1718) as never);
    expect(rb.brackets.map(tag)).toEqual(["c(", "s(", "s)", "c)"]);
    expect(rb.strokes).toHaveLength(3);
  });

  it("`(5+1)` (solo tonde) non estrae nulla e non toglie nessun tratto", () => {
    const strokes = at38("(5+1)", "normal", 9467);
    const rb = rewriteBrackets(strokes as never);
    expect(rb.brackets).toEqual([]);
    expect(rb.strokes).toHaveLength(strokes.length);
  });
});

describe("detectBracketKinds / restoreSquareBrackets applicano la STESSA promozione di rewriteBrackets", () => {
  // `finalizePiece` chiama restoreSquareBrackets con l'inchiostro INTERO (anche i tratti già estratti):
  // se la classificazione grezza vedesse ancora una tonda, la `{` appena estratta tornerebbe `(`
  // (`{5+1}` → `(5+1}`, verificato col modello reale prima della correzione).
  const styles: SpacingStyle[] = ["normal", "tight", "touch"];

  it.each(styles)("`{5+1}` seme 9467 (%s): aperta e chiusa sono graffe", (style) => {
    const k = detectBracketKinds(at38("{5+1}", style, 9467) as never);
    expect(k.opens).toEqual(["curly"]);
    expect(k.closes).toEqual(["curly"]);
  });

  it.each(styles)("`{5+1}` seme 9467 (%s): restoreSquareBrackets NON ri-tipa la `{` a `(`", (style) => {
    expect(restoreSquareBrackets("{5+1}", at38("{5+1}", style, 9467) as never)).toBe("{5+1}");
  });

  it.each(styles)("`{[(2)]}` seme 1718 (%s): { [ ( … ) ] }", (style) => {
    const k = detectBracketKinds(at38("{[(2)]}", style, 1718) as never);
    expect(k.opens).toEqual(["curly", "square", "round"]);
    expect(k.closes).toEqual(["round", "square", "curly"]);
    expect(restoreSquareBrackets("{[(2)]}", at38("{[(2)]}", style, 1718) as never)).toBe("{[(2)]}");
  });

  it("`(5+1)` (solo tonde) resta tonda in aperta e chiusa", () => {
    const k = detectBracketKinds(at38("(5+1)", "normal", 9467) as never);
    expect(k.opens.every((x) => x === "round")).toBe(true);
    expect(k.closes.every((x) => x === "round")).toBe(true);
  });
});

import { promoteRoundClosers } from "./squareBrackets";

describe("promoteRoundClosers (unit)", () => {
  const mk = (kind: "round" | "square", isOpen: boolean, cx: number, gh = 80, strength: "strong" | "weak" = "strong") => ({ kind, isOpen, cx, gh, strength });
  it("[ forte + ) tonda non abbinata -> la tonda diventa ]", () => {
    const open = mk("square", true, 10);
    const close = mk("round", false, 90);
    expect(promoteRoundClosers([open], [close], 60, [50])).toEqual([close]);
    expect(close.kind).toBe("square");
  });
  it("( ) tonde abbinate non si toccano", () => {
    const o = mk("round", true, 20);
    const c = mk("round", false, 80);
    expect(promoteRoundClosers([mk("square", true, 10)], [o, c], 60, [50])).toEqual([]);
  });
  it("quadra gia' chiusa: nessuna promozione", () => {
    expect(promoteRoundClosers([mk("square", true, 10), mk("square", false, 70)], [mk("round", false, 90)], 60, [50])).toEqual([]);
  });
  it("[ debole: nessuna promozione", () => {
    expect(promoteRoundClosers([mk("square", true, 10, 80, "weak")], [mk("round", false, 90)], 60, [50])).toEqual([]);
  });
  it("tonda bassa o senza contenuto in mezzo: nessuna promozione", () => {
    expect(promoteRoundClosers([mk("square", true, 10)], [mk("round", false, 90, 60)], 60, [50])).toEqual([]);
    expect(promoteRoundClosers([mk("square", true, 10)], [mk("round", false, 90)], 60, [200])).toEqual([]);
  });
  it("{[2)}: la tonda dopo la [ forte diventa ], la } non e' toccata", () => {
    const r = mk("round", false, 70);
    expect(promoteRoundClosers([mk("curly", true, 5) as never, mk("square", true, 20), mk("curly", false, 95) as never], [r], 60, [45])).toEqual([r]);
  });
});

import { promotePairs } from "./squareBrackets";

describe("promotePairs: chiusura debole quasi alta (7/10)", () => {
  const mk = (kind: "round" | "square", isOpen: boolean, cx: number, gh: number, strength: "strong" | "weak") => ({ kind, isOpen, cx, gh, strength });
  it("[ forte + ] debole di 45 su cifre di 43 -> coppia forte", () => {
    const o = mk("square", true, 10, 57, "strong");
    const c = mk("square", false, 90, 45, "weak");
    promotePairs([o, c], 43, [50]);
    expect(c.strength).toBe("strong");
  });
  it("una «1» (altezza = cifre, 43 su 43) NON diventa ]", () => {
    const o = mk("square", true, 10, 57, "strong");
    const c = mk("square", false, 90, 43, "weak");
    promotePairs([o, c], 43, [50]);
    expect(c.strength).toBe("weak");
  });
  it("chiusura molto bassa rispetto all'apertura: nessuna promozione", () => {
    const o = mk("square", true, 10, 80, "strong");
    const c = mk("square", false, 90, 46, "weak");
    promotePairs([o, c], 43, [50]);
    expect(c.strength).toBe("weak");
  });
  it("senza contenuto in mezzo: nessuna promozione", () => {
    const o = mk("square", true, 10, 57, "strong");
    const c = mk("square", false, 30, 45, "weak");
    promotePairs([o, c], 43, [200]);
    expect(c.strength).toBe("weak");
  });
});

import { inferMissingCloser } from "./squareBrackets";

describe("inferMissingCloser (chiusura per esclusione)", () => {
  const bx = (x: number, w: number, h: number) => ({ x0: x, x1: x + w, y0: 60, y1: 60 + h });
  const opener = { idxs: [0], kind: "square" as const, isOpen: true, gb: bx(31, 11, 43), strength: "strong" as const };
  // [ 2 + 1 ] 5  (indici: 0 [, 1 due, 2 uno, 3 ], 4 cinque)
  const base = [bx(31, 11, 43), bx(51, 20, 36), bx(104, 8, 34), bx(124, 9, 50), bx(144, 18, 42), bx(86, 10, 24)];
  it("`[2+1]5`: la `]` alta e sottile e' individuata", () => {
    const r = inferMissingCloser(base, [opener]);
    expect(r?.idxs).toEqual([3]);
    expect(r?.strength).toBe("weak");
  });
  it("un «1» alto quanto le altre cifre NON e' una chiusura", () => {
    const b = [...base];
    b[3] = bx(124, 8, 36);
    expect(inferMissingCloser(b, [opener])).toBeNull();
  });
  it("senza apertura quadra forte: nessuna inferenza", () => {
    expect(inferMissingCloser(base, [])).toBeNull();
    expect(inferMissingCloser(base, [{ ...opener, strength: "weak" as const }])).toBeNull();
  });
  it("chiusura quadra gia' presente: nessuna inferenza", () => {
    const closer = { idxs: [3], kind: "square" as const, isOpen: false, gb: base[3]!, strength: "strong" as const };
    expect(inferMissingCloser(base, [opener, closer])).toBeNull();
  });
  it("due tratti alti e sottili: ambiguo, nessuna inferenza", () => {
    const b = [...base, bx(170, 8, 50)];
    expect(inferMissingCloser(b, [opener])).toBeNull();
  });
  it("nessun contenuto fra apertura e candidata: nessuna inferenza", () => {
    const b = [bx(31, 11, 43), bx(48, 9, 50), bx(70, 20, 36), bx(100, 8, 34), bx(120, 18, 42)];
    expect(inferMissingCloser(b, [opener])).toBeNull();
  });
});
