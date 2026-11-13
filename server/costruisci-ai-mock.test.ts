import { beforeEach, describe, expect, it, vi } from "vitest";

// Solo la chiamata al modello è simulata. La pipeline di riparazione,
// fedeltà, progressione e preparazione del prompt è quella server reale.
// Nessuna route, database, file di archivio o servizio esterno è coinvolto.
const mocked = vi.hoisted(() => ({ replies: [] as string[], prompts: [] as string[] }));
vi.mock("./audio", () => ({
  chatCompletion: vi.fn(async (prompt: string) => {
    mocked.prompts.push(prompt);
    const result = mocked.replies.shift();
    if (!result) throw new Error("Fixture IA esaurita");
    return result;
  }),
}));
import { costruisciEsercizioConIA, riparaEsercizio } from "./costruisci";
import { sameExpressionStructure } from "../client/src/lib/progressiveExpression";

const expression = (latex: string, first: string, result: string) => ({
  espressioneLatex: latex,
  sezioni: [{ title: "CALCOLI", boxes: [{ op: first, answerLatex: result, prompt: "Calcolo." }] }],
  righeProgressive: [latex, result],
  risultatoFinaleLatex: result,
});

beforeEach(() => { mocked.replies.length = 0; mocked.prompts.length = 0; });

describe("pipeline IA simulata e verificata, senza dati reali", () => {
  it("ripara righe e suggerimenti del modello prima di consegnarli", async () => {
    const raw = {
      espressioneLatex: "2+3*4",
      sezioni: [{ title: "CALCOLI", boxes: [
        { op: "3*4", answerLatex: "12", prompt: "Moltiplico: il risultato è 12.", extraLatex: "12" },
        { op: "2+12", answerLatex: "14", prompt: "Sommo." },
      ] }],
      righeProgressive: ["2+3*4", "14", "14"],
      risultatoFinaleLatex: "14",
    };
    mocked.replies.push(JSON.stringify(raw));
    const out = await costruisciEsercizioConIA("2+3*4");
    expect(out.tentativi).toBe(1);
    expect(sameExpressionStructure(out.esercizio.righeProgressive[1],"2+12")).toBe(true);
    expect(out.esercizio.sezioni[0].boxes[0].extraLatex).toBeUndefined();
    expect(out.esercizio.sezioni[0].boxes[0].prompt).not.toContain("12");
  });
  it("se il modello cambia la traccia, riprova e non consegna la prima risposta", async () => {
    mocked.replies.push(JSON.stringify(expression("1+4","1+4","5")));
    mocked.replies.push(JSON.stringify(expression("2+3","2+3","5")));
    const out=await costruisciEsercizioConIA("2+3");
    expect(out.tentativi).toBe(2);
    expect(out.esercizio.espressioneLatex).toBe("2+3");
    expect(mocked.prompts).toHaveLength(2);
  });
  it("l'esempio inviato al modello è JSON valido, aritmeticamente coerente e completo", async () => {
    mocked.replies.push(JSON.stringify(expression("2+3","2+3","5")));
    await costruisciEsercizioConIA("2+3");
    const match=mocked.prompts[0].match(/ESPRESSIONE: \(1\/2\+1\/3\):\(1\/4\)\n([^\n]+)/);
    expect(match).not.toBeNull();
    const sample=JSON.parse(match![1]);
    const checked=riparaEsercizio(sample);
    expect(checked.esercizio).not.toBeNull();
    expect(checked.esercizio!.sezioni.flatMap(s=>s.boxes)).toHaveLength(2);
    expect(sameExpressionStructure(checked.esercizio!.righeProgressive.at(-1)!,sample.risultatoFinaleLatex)).toBe(true);
  });
});

