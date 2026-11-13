import { describe, expect, it } from "vitest";
import { riparaEsercizio } from "./costruisci";

/* (11/11) Il box guidato di semplificazione/razionalizzazione della radice
 * al denominatore deve essere GARANTITO in qualunque costruzione: anche se
 * l'IA (o un archivio vecchio) chiude l'esercizio lasciando la radice al
 * denominatore, la pipeline aggiunge da sola l'ultimo box guidato.
 * Il prompt dice solo il metodo, mai il risultato. */

function grezzo(
  espressioneLatex: string,
  boxes: unknown[],
  righeProgressive: string[],
  risultatoFinaleLatex: string,
): unknown {
  return {
    espressioneLatex,
    sezioni: [{ title: "CALCOLI", boxes }],
    righeProgressive,
    risultatoFinaleLatex,
  };
}

describe("razionalizzazione guidata garantita", () => {
  it("semplifica (ab+1)/√(ab+1) con un box extra se l'IA lo salta", () => {
    const esito = riparaEsercizio(
      grezzo(
        "\\dfrac{2}{6}+\\dfrac{ab+1}{\\sqrt{ab+1}}",
        [{ op: "\\dfrac{2}{6}", prompt: "Riduco la frazione.", answerLatex: "\\dfrac{1}{3}" }],
        ["\\dfrac{2}{6}+\\dfrac{ab+1}{\\sqrt{ab+1}}", "\\dfrac{1}{3}+\\dfrac{ab+1}{\\sqrt{ab+1}}"],
        "\\dfrac{1}{3}+\\dfrac{ab+1}{\\sqrt{ab+1}}",
      ),
    );
    expect(esito.problemi).toEqual([]);
    const e = esito.esercizio!;
    expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toBe("\\dfrac{1}{3}+\\sqrt{ab+1}");
    const boxes = e.sezioni.flatMap((s) => s.boxes);
    expect(boxes).toHaveLength(2);
    const ultimo = boxes.at(-1)!;
    expect(ultimo.answerLatex.replace(/\s/g, "")).toBe("\\dfrac{1}{3}+\\sqrt{ab+1}");
    expect(ultimo.prompt).toBe("Divido numeratore e denominatore per la stessa radice.");
    expect(ultimo.prompt).not.toContain("\\sqrt{ab+1}");
    expect(ultimo.simbolico).toBe(true);
    expect(e.righeProgressive).toHaveLength(3);
    expect(e.righeProgressive.at(-1)).toBe(e.risultatoFinaleLatex);
  });

  it("razionalizza 1/√3 → √3/3 con un box extra", () => {
    const esito = riparaEsercizio(
      grezzo(
        "\\dfrac{1}{\\sqrt{3}}+\\sqrt{4}",
        [{ op: "\\sqrt{4}", prompt: "Calcolo la radice.", answerLatex: "2" }],
        ["\\dfrac{1}{\\sqrt{3}}+\\sqrt{4}", "\\dfrac{1}{\\sqrt{3}}+2"],
        "\\dfrac{1}{\\sqrt{3}}+2",
      ),
    );
    expect(esito.problemi).toEqual([]);
    const e = esito.esercizio!;
    expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toBe("\\dfrac{\\sqrt{3}}{3}+2");
    const boxes = e.sezioni.flatMap((s) => s.boxes);
    expect(boxes).toHaveLength(2);
    expect(boxes.at(-1)!.prompt).toBe("Moltiplico numeratore e denominatore per la stessa radice.");
    expect(boxes.at(-1)!.prompt).not.toMatch(/\\sqrt|\\dfrac|[0-9]/);
  });

  it("razionalizza 2/√3 → 2√3/3 e (a+b)/√(ab) → (a+b)√(ab)/(ab)", () => {
    for (const [expr, finale] of [
      ["\\dfrac{2}{\\sqrt{3}}+\\sqrt{4}", "\\dfrac{2\\sqrt{3}}{3}+2"],
      ["\\dfrac{a+b}{\\sqrt{ab}}+\\sqrt{4}", "\\dfrac{\\left(a+b\\right)\\sqrt{ab}}{ab}+2"],
    ] as const) {
      const esito = riparaEsercizio(
        grezzo(
          expr,
          [{ op: "\\sqrt{4}", prompt: "Calcolo la radice.", answerLatex: "2" }],
          [expr, finale === "\\dfrac{2\\sqrt{3}}{3}+2" ? "\\dfrac{2}{\\sqrt{3}}+2" : "\\dfrac{a+b}{\\sqrt{ab}}+2"],
          finale === "\\dfrac{2\\sqrt{3}}{3}+2" ? "\\dfrac{2}{\\sqrt{3}}+2" : "\\dfrac{a+b}{\\sqrt{ab}}+2",
        ),
      );
      expect(esito.problemi).toEqual([]);
      const e = esito.esercizio!;
      expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toBe(finale);
      expect(e.sezioni.flatMap((s) => s.boxes).filter((b) => !b.condizioniEsistenza)).toHaveLength(2);
    }
  });

  it("elimina la radice anche quando il numeratore la contiene come fattore", () => {
    const esito = riparaEsercizio(
      grezzo(
        "\\dfrac{2a\\cdot\\sqrt{ab+1}}{\\sqrt{ab+1}}+1",
        [{ op: "1", prompt: "Parto dall'espressione.", answerLatex: "1" }],
        ["\\dfrac{2a\\cdot\\sqrt{ab+1}}{\\sqrt{ab+1}}+1"],
        "\\dfrac{2a\\cdot\\sqrt{ab+1}}{\\sqrt{ab+1}}+1",
      ),
    );
    expect(esito.problemi).toEqual([]);
    const e = esito.esercizio!;
    expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toBe("2a+1");
  });

  /* (12/11) il fattore radice è riconosciuto IN QUALSIASI POSIZIONE:
   * il box extra di semplificazione è garantito anche quando printLatex
   * giustappone senza ·, quando il radicando resta tra parentesi e quando
   * la radice compare due volte (ne resta una). */
  it.each([
    ["\\dfrac{\\sqrt{ab+1}\\cdot 2a}{\\sqrt{ab+1}}+1", "2a+1"], // radice PRIMA
    ["\\dfrac{2a\\sqrt{ab+1}}{\\sqrt{ab+1}}+1", "2a+1"], // giustapposta alla fine (senza ·)
    ["\\dfrac{\\sqrt{ab+1}2a}{\\sqrt{ab+1}}+1", "2a+1"], // giustapposta all'inizio
    ["\\dfrac{\\sqrt{ab+1}\\sqrt{ab+1}}{\\sqrt{ab+1}}+1", "\\sqrt{ab+1}+1"], // ne resta UNA
    ["\\dfrac{2a\\cdot 3\\cdot\\sqrt{ab+1}}{\\sqrt{ab+1}}+1", "6a+1"], // fattore in mezzo al prodotto
  ])("semplifica anche con la radice in posizione diversa: %s → %s", (expr, finale) => {
    const esito = riparaEsercizio(
      grezzo(expr, [{ op: "1", prompt: "Parto dall'espressione.", answerLatex: "1" }], [expr], expr),
    );
    expect(esito.problemi).toEqual([]);
    const e = esito.esercizio!;
    expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toBe(finale);
    const ultimo = e.sezioni.flatMap((s) => s.boxes).at(-1)!;
    expect(ultimo.prompt).toBe("Divido numeratore e denominatore per la stessa radice.");
    expect(ultimo.prompt).not.toContain("\\sqrt");
  });

  it("non tocca le radici con indice diverso da 2 o negativo (regola 4d)", () => {
    for (const den of ["\\sqrt[3]{a}", "\\sqrt[-3]{a}"]) {
      const expr = `\\dfrac{1}{${den}}+\\sqrt{4}`;
      const esito = riparaEsercizio(
        grezzo(
          expr,
          [{ op: "\\sqrt{4}", prompt: "Calcolo la radice.", answerLatex: "2" }],
          [expr, `\\dfrac{1}{${den}}+2`],
          `\\dfrac{1}{${den}}+2`,
        ),
      );
      expect(esito.problemi).toEqual([]);
      const e = esito.esercizio!;
      expect(e.sezioni.flatMap((s) => s.boxes).filter((b) => !b.condizioniEsistenza)).toHaveLength(1);
      expect(e.risultatoFinaleLatex).toBe(`\\dfrac{1}{${den}}+2`);
      expect(e.righeProgressive).toHaveLength(2);
    }
  });

  it("sostituisce il box che lascia l'espressione identica, come nello screenshot", () => {
    const espressione = "\\dfrac{ab+1}{\\sqrt{ab+1}}+3";
    const esito = riparaEsercizio(grezzo(espressione, [{
      op: espressione,
      prompt: "Lascio la somma così, con la frazione e il numero intero.",
      answerLatex: espressione,
    }], [espressione, espressione], espressione));
    expect(esito.problemi).toEqual([]);
    const esercizio = esito.esercizio!;
    const boxes = esercizio.sezioni.flatMap((s) => s.boxes);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].prompt).toBe("Divido numeratore e denominatore per la stessa radice.");
    expect(esercizio.risultatoFinaleLatex.replace(/\s/g, "")).toBe("\\sqrt{ab+1}+3");
    expect(esercizio.righeProgressive).toHaveLength(2);
    // Rilettura di sessioni/cache: non creare un secondo box.
    const rilettura = riparaEsercizio(esercizio);
    expect(rilettura.problemi).toEqual([]);
    expect(rilettura.esercizio!.sezioni.flatMap((s) => s.boxes)).toHaveLength(1);
  });

  it("gestisce più di tre frazioni da semplificare, senza salti", () => {
    const frazioni = ["a", "a+1", "a+2", "a+3"].map((x) => `\\dfrac{${x}}{\\sqrt{${x}}}`);
    const espressione = frazioni.join("+") + "+\\sqrt{4}";
    const finalePrima = frazioni.join("+") + "+2";
    const esito = riparaEsercizio(grezzo(espressione,
      [{ op: "\\sqrt{4}", prompt: "Calcolo la radice.", answerLatex: "2" }],
      [espressione, finalePrima], finalePrima));
    expect(esito.problemi).toEqual([]);
    const boxes = esito.esercizio!.sezioni.flatMap((s) => s.boxes).filter((b) => !b.condizioniEsistenza);
    expect(boxes).toHaveLength(5);
    expect(boxes.slice(1).every((b) => b.prompt === "Divido numeratore e denominatore per la stessa radice.")).toBe(true);
    expect(esito.esercizio!.righeProgressive).toHaveLength(6);
  });

  it("non sopprime altri addendi quando il numeratore contiene una radice", () => {
    const espressione = "\\dfrac{a+\\sqrt{b}}{\\sqrt{b}}+\\sqrt{4}";
    const finalePrima = "\\dfrac{a+\\sqrt{b}}{\\sqrt{b}}+2";
    const esito = riparaEsercizio(grezzo(espressione,
      [{ op: "\\sqrt{4}", prompt: "Calcolo la radice.", answerLatex: "2" }],
      [espressione, finalePrima], finalePrima));
    expect(esito.problemi).toEqual([]);
    const box = esito.esercizio!.sezioni.flatMap((s) => s.boxes).at(-1)!;
    expect(box.prompt).toBe("Moltiplico numeratore e denominatore per la stessa radice.");
    expect(box.answerLatex).toContain("a+");
  });

  it("non aggiunge nulla se il risultato è già senza radice al denominatore", () => {
    const esito = riparaEsercizio(
      grezzo(
        "\\dfrac{ab+1}{\\sqrt{ab+1}}+3",
        [{ op: "\\dfrac{ab+1}{\\sqrt{ab+1}}+3", prompt: "Semplifico la frazione.", answerLatex: "\\sqrt{ab+1}+3" }],
        ["\\dfrac{ab+1}{\\sqrt{ab+1}}+3", "\\sqrt{ab+1}+3"],
        "\\sqrt{ab+1}+3",
      ),
    );
    expect(esito.problemi).toEqual([]);
    const e = esito.esercizio!;
    const boxes = e.sezioni.flatMap((s) => s.boxes);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].criterioDidattico).toBe("radicale_trasformato");
    expect(boxes[0].simbolico).toBe(true);
    expect(e.risultatoFinaleLatex).toBe("\\sqrt{ab+1}+3");
  });

  it("protegge dalla ripetizione anche un box numerico già creato dall'IA", () => {
    const expr = "\\dfrac{1}{\\sqrt{4}}+2";
    const esito = riparaEsercizio(grezzo(expr, [{ op: "\\dfrac{1}{\\sqrt{4}}", answerLatex: "\\dfrac{1}{2}", prompt: "Semplifico." }],
      [expr, "\\dfrac{1}{2}+2"], "\\dfrac{1}{2}+2"));
    expect(esito.problemi).toEqual([]);
    const box = esito.esercizio!.sezioni.flatMap(s => s.boxes)[0];
    expect(box.criterioDidattico).toBe("radicale_trasformato");
    expect(box.simbolico).toBe(true);
  });

  it("non aggiunge il box se il conto non è verificabile esattamente", () => {
    /* numeratore composito non banale: se il motore non verifica, niente box */
    const expr = "\\dfrac{x^{2}+2x+1}{\\sqrt{x+1}}+\\sqrt{4}";
    const esito = riparaEsercizio(
      grezzo(
        expr,
        [{ op: "\\sqrt{4}", prompt: "Calcolo la radice.", answerLatex: "2" }],
        [expr, "\\dfrac{x^{2}+2x+1}{\\sqrt{x+1}}+2"],
        "\\dfrac{x^{2}+2x+1}{\\sqrt{x+1}}+2",
      ),
    );
    expect(esito.problemi).toEqual([]);
    const e = esito.esercizio!;
    const boxes = e.sezioni.flatMap((s) => s.boxes);
    const ultimo = boxes.at(-1)!;
    if (ultimo.prompt?.startsWith("Moltiplico")) {
      expect(e.risultatoFinaleLatex.replace(/\s/g, "")).toBe("\\dfrac{\\left(x^{2}+2x+1\\right)\\sqrt{x+1}}{x+1}+2");
    } else {
      expect(e.risultatoFinaleLatex).toBe("\\dfrac{x^{2}+2x+1}{\\sqrt{x+1}}+2");
      expect(esito.avvertenze.join(" ")).toContain("non aggiunto");
    }
  });
});

