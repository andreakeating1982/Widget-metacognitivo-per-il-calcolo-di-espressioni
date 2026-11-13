/** (08/11) Radicali con LETTERE: sostituzione numerica multipla, prodotti
 *  notevoli e radicale di quoziente — foto utente «ci sono ancora dei
 *  problemi» sull'espressione √((a²−1)/3):(3a+3). L'IA produceva i box
 *  giusti ma il verificatore li bocciava con «non verificabile con il
 *  motore disponibile» perché nessun percorso sapeva leggere radicali
 *  con lettere. */
import { describe, expect, it } from "vitest";
import {
  lettereLibere,
  riparaEsercizio,
  sostituisciLettere,
  verificaPerSostituzione,
  contoGiusto,
} from "./costruisci";

describe("sostituisciLettere (prodotti impliciti, comandi LaTeX intatti)", () => {
  it("sostituisce la lettera in a^{2} e in 3a senza toccare \\dfrac", () => {
    const s = sostituisciLettere("\\sqrt{\\dfrac{a^{2}-1}{3}}:(3a+3)", { a: 5 });
    expect(s).toBe("\\sqrt{\\dfrac{5^{2}-1}{3}}:(3·5+3)");
  });

  it("rende esplicito il prodotto tra lettere (ab → v·v) e tra lettera e parentesi", () => {
    expect(sostituisciLettere("ab+1", { a: 2, b: 3 })).toBe("2·3+1");
    expect(sostituisciLettere("x2+3(2x)", { x: 1 })).toBe("1·2+3(2·1)");
    expect(sostituisciLettere("x2", { x: -2 })).toBe("(-2)·2");
    /* solo «a» è nei valori: «b» resta lettera (sostituzione selettiva). */
    expect(sostituisciLettere("a(b+1)", { a: 2 })).toBe("2·(b+1)");
    expect(sostituisciLettere("\\sqrt{ab}", { a: 2, b: 3 })).toBe("\\sqrt{2·3}");
  });

  it("non tocca i comandi LaTeX (la «a» di \\dfrac, la «x» di \\times)", () => {
    expect(lettereLibere("\\dfrac{a}{b}")).toEqual(["a", "b"]);
    expect(sostituisciLettere("\\dfrac{a}{3}", { a: 7 })).toBe("\\dfrac{7}{3}");
    /* \times non è nel vocabolario consentito, ma non deve comunque
       rompersi se comparisse: la «x» dentro \times resta intatta. */
    expect(sostituisciLettere("\\times x", { x: 4 })).toBe("\\times 4");
  });
});

describe("verificaPerSostituzione (radicali con lettere)", () => {
  const OP_BOX3 = "\\sqrt{\\dfrac{(a-1)(a+1)}{3}}:[3(a+1)]";
  const AN_BOX3 = "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}";

  it("verifica il mega-box dell'IA (quoziente + divisione + razionalizzazione)", () => {
    const esito = verificaPerSostituzione(OP_BOX3, AN_BOX3);
    expect(esito?.ok).toBe(true);
    expect(esito?.via).toContain("sostituzione numerica multipla");
  });

  it("verifica la proprietà del quoziente e del prodotto dei radicali", () => {
    expect(verificaPerSostituzione("\\sqrt{\\dfrac{(a-1)(a+1)}{3}}", "\\dfrac{\\sqrt{(a-1)(a+1)}}{\\sqrt{3}}")?.ok).toBe(true);
    // La seconda forma non è definita per a < −1, dove la prima lo è.
    expect(verificaPerSostituzione("\\sqrt{(a-1)(a+1)}", "\\sqrt{a-1}\\cdot\\sqrt{a+1}")?.ok).toBe(false);
  });

  it("verifica la semplificazione del fattore comune (√(a+1):(a+1) → 1/√(a+1))", () => {
    expect(verificaPerSostituzione("\\sqrt{a+1}:(a+1)", "\\dfrac{1}{\\sqrt{a+1}}")?.ok).toBe(true);
  });

  it("verifica l'espressione intera contro il risultato finale", () => {
    expect(verificaPerSostituzione("\\sqrt{\\dfrac{a^{2}-1}{3}}:(3a+3)", AN_BOX3)?.ok).toBe(true);
  });

  it("boccia forme davvero diverse (denominatore con a−1)", () => {
    const esito = verificaPerSostituzione(OP_BOX3, "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a-1)}");
    expect(esito?.ok).toBe(false);
  });

  it("non assume positivo il valore delle lettere nelle radici pari", () => {
    /* √(x²) = |x| per ogni x reale; √(x²) = x solo per x ≥ 0. */
    expect(verificaPerSostituzione("\\sqrt{x^{2}}", "x")?.ok).toBe(false);
    expect(verificaPerSostituzione("\\sqrt{x^{2}}", "\\left|x\\right|")?.ok).toBe(true);
    /* √(x⁴) = x² e ∛(x³) = x valgono su tutti i reali */
    expect(verificaPerSostituzione("\\sqrt{x^{4}}", "x^{2}")?.ok).toBe(true);
    expect(verificaPerSostituzione("\\sqrt[3]{x^{3}}", "x")?.ok).toBe(true);
    /* SENZA radici con lettere la non-assunzione di positività resta:
       le forme davvero diverse si bocciano sempre. */
    expect(verificaPerSostituzione("x^{2}", "x")?.ok).toBe(false);
  });

  it("non decide quando i campioni validi sono troppo pochi (dominio stretto)", () => {
    /* √(a−40): definito solo con a=47 → 1 campione < 3 → il motore tace. */
    expect(verificaPerSostituzione("\\sqrt{a-40}", "\\sqrt{a-40}")).toBeNull();
  });

  it("senza lettere non entra (null: passano gli altri percorsi)", () => {
    expect(verificaPerSostituzione("\\sqrt{18}", "3\\sqrt{2}")).toBeNull();
  });
});

describe("contoGiusto con radicali letterali (integrazione)", () => {
  it("box 1 e 2: prodotti notevoli già verificabili come razionali esatti", () => {
    expect(contoGiusto("a^{2}-1", "(a-1)(a+1)")).toEqual({ ok: true, via: "razionale esatto" });
    expect(contoGiusto("3a+3", "3(a+1)")).toEqual({ ok: true, via: "razionale esatto" });
  });

  it("box 3 dell'IA: adesso verificabile per sostituzione", () => {
    const esito = contoGiusto(
      "\\sqrt{\\dfrac{(a-1)(a+1)}{3}}:[3(a+1)]",
      "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}",
    );
    expect(esito.ok).toBe(true);
  });

  it("razionalizzazione numerica (1/√3 → √3/3) resta sul percorso numerico", () => {
    expect(contoGiusto("\\dfrac{1}{\\sqrt{3}}", "\\dfrac{\\sqrt{3}}{3}").ok).toBe(true);
  });

  it("una risposta sbagliata non passa in nessun modo", () => {
    expect(contoGiusto("a^{2}+1", "(a-1)(a+1)").ok).toBe(false);
    expect(
      contoGiusto("\\sqrt{\\dfrac{a^{2}-1}{3}}:(3a+3)", "\\dfrac{\\sqrt{3(a^{2}-1)}}{3(a+1)}").ok,
    ).toBe(false);
  });
});

describe("riparaEsercizio accetta la struttura letterale dell'IA (foto no.png)", () => {
  it("guarisce il risultato finale mancante con l'ultimo box verificato (IA che tronca)", () => {
    const catena = [
      { op: "a^{2}-1", answerLatex: "(a-1)(a+1)" },
      { op: "3a+3", answerLatex: "3(a+1)" },
      { op: "\\sqrt{\\dfrac{(a-1)(a+1)}{3}}", answerLatex: "\\dfrac{\\sqrt{(a-1)(a+1)}}{\\sqrt{3}}" },
      /* trasformazione su punti diversi della riga → op = INTERA espressione */
      { op: "\\dfrac{\\sqrt{(a-1)(a+1)}}{\\sqrt{3}}:\\left[3(a+1)\\right]", answerLatex: "\\dfrac{\\sqrt{(a-1)(a+1)}}{3(a+1)\\sqrt{3}}" },
      { op: "\\dfrac{\\sqrt{(a-1)(a+1)}}{3(a+1)\\sqrt{3}}", answerLatex: "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}" },
    ];
    const esito = riparaEsercizio({
      espressioneLatex: "\\sqrt{\\dfrac{a^{2}-1}{3}}:\\left(3a+3\\right)",
      sezioni: [{ title: "SCOMPONI", boxes: catena }],
      /* risultatoFinaleLatex ASSENTE: la risposta dell'ultimo box lo sostituisce */
    });
    expect(esito.esercizio).not.toBeNull();
    expect(esito.esercizio?.risultatoFinaleLatex).toBe("\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}");
    expect(esito.avvertenze.some((a) => a.includes("assunto dalla risposta dell'ultimo box"))).toBe(true);
  });

  it("costruisce l'esercizio dai 3 box ricevuti nel log di diagnostica", () => {
    const raw = {
      espressioneLatex: "\\sqrt{\\dfrac{a^{2}-1}{3}}:(3a+3)",
      sezioni: [
        {
          title: "SCOMPOSIZIONE",
          boxes: [
            { op: "a^{2}-1", prompt: "Riconosco la differenza di quadrati.", answerLatex: "(a-1)(a+1)", simbolico: true },
            { op: "3a+3", prompt: "Raccolgo il fattore comune.", answerLatex: "3(a+1)", simbolico: true },
          ],
        },
        {
          title: "RADICALE E DIVISIONE",
          boxes: [
            {
              op: "\\sqrt{\\dfrac{(a-1)(a+1)}{3}}:[3(a+1)]",
              prompt: "Spacco la radice della frazione e razionalizzo il denominatore.",
              answerLatex: "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}",
              simbolico: true,
            },
          ],
        },
      ],
      righeProgressive: [
        "\\sqrt{\\dfrac{a^{2}-1}{3}}:(3a+3)",
        "\\sqrt{\\dfrac{(a-1)(a+1)}{3}}:(3a+3)",
        "\\sqrt{\\dfrac{(a-1)(a+1)}{3}}:[3(a+1)]",
        "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}",
      ],
      risultatoFinaleLatex: "\\dfrac{\\sqrt{3(a^{2}-1)}}{9(a+1)}",
    };
    const esito = riparaEsercizio(raw);
    expect(esito.esercizio).not.toBeNull();
    expect(esito.problemi).toEqual([]);
    /* (12/11) il denominatore (3a+3) aggiunge la sezione CONDIZIONI DI
       ESISTENZA in testa: 2 sezioni di calcolo + 1 di C.E. */
    expect(esito.esercizio?.sezioni.length).toBe(3);
    expect(esito.esercizio?.sezioni[0]!.title).toBe("CONDIZIONI DI ESISTENZA (C.E.)");
    expect(esito.esercizio?.sezioni[0]!.boxes[0]!.answerLatex).toBe("-1");
  });
});

/* (10/11, foto «non mi costruisce l'esercizio») GIUSTAPPOSIZIONE: in
 * √(ab^{-1}) la «a» è seguita da «b» e la «b» preceduta da «a»: la regola del
 * singolo carattere non vedeva né «a» né «b», il verificatore non sapeva
 * valutare i box e la costruzione falliva con «non verificabile con il
 * motore disponibile» + «risultato finale mancante». */
describe("lettereLibere con lettere attaccate (giustapposizione)", () => {
  it("vede a e b in √(ab^{-1})", () => {
    expect(lettereLibere("\\dfrac{3}{4}x^{-1}\\sqrt{ab^{-1}}")).toEqual(
      expect.arrayContaining(["a", "b", "x"]),
    );
    expect(lettereLibere("\\sqrt{ab^{-1}}").sort()).toEqual(["a", "b"]);
  });

  it("non confonde i comandi LaTeX e le parole chiave con variabili", () => {
    expect(lettereLibere("\\dfrac{\\sqrt{a-1}}{3}")).toEqual(["a"]);
    expect(lettereLibere("0,4_6per∛(2)+\\sqrt{2}")).toEqual([]);
    expect(lettereLibere("rad3(8)+\\overline{6}")).toEqual([]);
    expect(lettereLibere("\\sqrt{2}+1")).toEqual([]);
  });

  it("verifica i box A−A → 0 dell'espressione in foto (termini identici e opposti)", () => {
    const A = "\\dfrac{3}{4}x^{-1}\\sqrt{ab^{-1}}";
    expect(verificaPerSostituzione(`${A}-${A}`, "0")?.ok).toBe(true);
    const B = "\\dfrac{1}{6}\\sqrt[4]{ab^{-2}}";
    expect(verificaPerSostituzione(`${B}-${B}`, "0")?.ok).toBe(true);
    const C = "\\left(\\dfrac{1}{3}\\right)^{-3}\\sqrt{ab^{-1}}";
    expect(verificaPerSostituzione(`${C}-${C}`, "0")?.ok).toBe(true);
  });

  it("verifica il risultato finale 2 dell'espressione in foto", () => {
    /* numeratore e denominatore: tutti i termini si cancellano a coppie,
       restano ∛(a⁻²b/x) con coefficienti 7/15 e 7/30 → il quoziente è 2. */
    const intera =
      "\\dfrac{0,75x^{-1}\\sqrt{ab^{-1}}-0,75x^{-1}\\sqrt{ab^{-1}}+0,4\\overline{6}\\sqrt[3]{\\dfrac{a^{-2}b}{x}}+0,1\\overline{6}\\sqrt[4]{ab^{-2}}-0,1\\overline{6}\\sqrt[4]{ab^{-2}}}{1,25x^{-1}\\sqrt{ab^{-1}}-1,25x^{-1}\\sqrt{ab^{-1}}+0,2\\overline{3}\\sqrt[3]{\\dfrac{a^{-2}b}{x}}+0,\\overline{3}^{-3}\\sqrt{ab^{-1}}-0,\\overline{3}^{-3}\\sqrt{ab^{-1}}}";
    expect(verificaPerSostituzione(intera, "2")?.ok).toBe(true);
  });
});
