import { beforeEach, describe, expect, it, vi } from "vitest";

// Solo la chiamata al modello è simulata. La pipeline di riparazione,
// verifica e progressione è quella server reale. Nessun risultato
// dell'esercizio reale dell'utente è coinvolto.
const mocked = vi.hoisted(() => ({ replies: [] as string[], prompts: [] as string[] }));
vi.mock("./audio", () => ({
  chatCompletion: vi.fn(async (prompt: string) => {
    mocked.prompts.push(prompt);
    const result = mocked.replies.shift();
    if (!result) throw new Error("Fixture IA esaurita");
    return result;
  }),
}));
import { costruisciEsercizioConIA } from "./costruisci";
import { sameExpressionStructure } from "../client/src/lib/progressiveExpression";

beforeEach(() => {
  mocked.replies.length = 0;
  mocked.prompts.length = 0;
});

/* 11/11 — il box guidato EXTRA: quando il risultato di un passaggio lascia
 * una frazione con radice al denominatore che si semplifica da sola
 * (numeratore = quadrato del radicando), la costruzione deve contenerla
 * senza bocciare l'esercizio. Nessun risultato nell'espressione di input:
 * la verifica del conto è solo del motore, la frase guida solo il metodo. */
describe("costruzione con il box di semplificazione della radice al denominatore", () => {
  it("accetta il box extra (ab+1)/√(ab+1)+3 → √(ab+1)+3 e conserva la frase di metodo", async () => {
    const raw = {
      espressioneLatex: "\\dfrac{ab+1}{\\sqrt{ab+1}}+3",
      sezioni: [
        {
          title: "CALCOLI",
          boxes: [
            {
              op: "\\dfrac{ab+1}{\\sqrt{ab+1}}+3",
              answerLatex: "\\sqrt{ab+1}+3",
              prompt: "Divido numeratore e denominatore per la stessa radice.",
              simbolico: true,
            },
          ],
        },
      ],
      righeProgressive: ["\\dfrac{ab+1}{\\sqrt{ab+1}}+3", "\\sqrt{ab+1}+3"],
      risultatoFinaleLatex: "\\sqrt{ab+1}+3",
    };
    mocked.replies.push(JSON.stringify(raw));
    const out = await costruisciEsercizioConIA("\\dfrac{ab+1}{\\sqrt{ab+1}}+3");
    expect(out.tentativi).toBe(1);
    const boxes = out.esercizio.sezioni.flatMap((s) => s.boxes);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].answerLatex).toBe("\\sqrt{ab+1}+3");
    // la frase di metodo NON viene tagliata: non contiene il risultato
    expect(boxes[0].prompt).toContain("Divido numeratore e denominatore per la stessa radice.");
    expect(boxes[0].prompt).not.toContain("ab+1");
    // la catena progressiva collega il box alla riga seguente
    expect(sameExpressionStructure(out.esercizio.righeProgressive[1], "\\sqrt{ab+1}+3")).toBe(true);
  });

  it("il prompt inviato al modello contiene la regola del box di semplificazione", async () => {
    const raw = {
      espressioneLatex: "2+3",
      sezioni: [{ title: "CALCOLI", boxes: [{ op: "2+3", answerLatex: "5", prompt: "Sommo." }] }],
      righeProgressive: ["2+3", "5"],
      risultatoFinaleLatex: "5",
    };
    mocked.replies.push(JSON.stringify(raw));
    await costruisciEsercizioConIA("2+3");
    expect(mocked.prompts[0]).toContain("PRIMA di razionalizzare guarda se si semplifica da sola");
    expect(mocked.prompts[0]).toContain("QUADRATO del radicando della radice al denominatore");
    expect(mocked.prompts[0]).toContain("SOLO quando il numeratore non ha nessun fattore in comune");
  });
});
