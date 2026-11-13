/** (08/11) Radicali in riparaEsercizio e guarigione dei JSON troncati —
 *  foto utente «L'IA non restituisce risposte valide» sull'espressione
 *  (2√3−2√2−2+√18−√12−√6)/(2[(2)²−(√6)²]). */
import { describe, expect, it } from "vitest";
import { riparaEsercizio, riparaJsonTroncato } from "./costruisci";

const ESPRESSIONE =
  "\\dfrac{2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}}{2\\left[\\left(2\\right)^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]}";

/* La struttura dell'IA del tentativo 1 (box 8 = frazione finale pulita:
 * era il «box 9: non riesco a collegare il conto» del log di produzione). */
function esercizioRadicali(override: Record<string, unknown> = {}): unknown {
  return {
    espressioneLatex: ESPRESSIONE,
    sezioni: [
      {
        title: "POTENZE E RADICI",
        boxes: [
          { op: "\\left(2\\right)^{2}", prompt: "Moltiplico la base per sé stessa.", answerLatex: "4" },
          { op: "\\left(\\sqrt{6}\\right)^{2}", prompt: "L'esponente uguale all'indice toglie la radice.", answerLatex: "6" },
          { op: "\\sqrt{18}", prompt: "Estraggo i fattori perfetti dal radicando.", answerLatex: "3\\sqrt{2}" },
          { op: "\\sqrt{12}", prompt: "Estraggo i fattori perfetti dal radicando.", answerLatex: "2\\sqrt{3}" },
        ],
      },
      {
        title: "RADICALI SIMILI",
        boxes: [
          { op: "2\\sqrt{3}-2\\sqrt{3}", prompt: "Sommo i coefficienti dei radicali simili.", answerLatex: "0" },
          { op: "-2\\sqrt{2}+3\\sqrt{2}", prompt: "Sommo i coefficienti dei radicali simili.", answerLatex: "\\sqrt{2}" },
        ],
      },
      {
        title: "DENOMINATORE",
        boxes: [{ op: "2\\left[4-6\\right]", prompt: "Svolgo la differenza dentro le quadre.", answerLatex: "-4" }],
      },
      {
        title: "DIVISIONE FINALE",
        boxes: [
          {
            op: "\\dfrac{\\sqrt{2}-2-\\sqrt{6}}{-4}",
            prompt: "Divido il numeratore raccolto per il denominatore.",
            answerLatex: "\\dfrac{\\sqrt{2}-2-\\sqrt{6}}{-4}",
          },
        ],
      },
    ],
    righeProgressive: ["(le righe vengono ricostruite dal motore)"],
    risultatoFinaleLatex: "\\dfrac{\\sqrt{2}-2-\\sqrt{6}}{-4}",
    ...override,
  };
}

describe("riparaEsercizio con radicali (foto utente)", () => {
  it("l'esercizio completo della foto viene accettato (box finale collegato)", () => {
    const esito = riparaEsercizio(esercizioRadicali());
    expect(esito.problemi).toEqual([]);
    expect(esito.esercizio).not.toBeNull();
    const righe = esito.esercizio!.righeProgressive;
    expect(righe).toHaveLength(9); /* 8 box + espressione iniziale */
    /* l'ultima riga è la risposta dell'ultimo box ristampata dal motore */
    expect(righe[righe.length - 1]).toBe(
      "\\dfrac{\\left(\\sqrt{2} - 2 - \\sqrt{6}\\right)}{\\left(-4\\right)}",
    );
  });

  it("una risposta dell'IA sbagliata viene sostituita dal calcolo esatto del motore", () => {
    const e = esercizioRadicali() as { sezioni: Array<{ boxes: Array<Record<string, string>> }> };
    e.sezioni[0].boxes[2].answerLatex = "2\\sqrt{2}"; /* √18 ≠ 2√2 */
    const esito = riparaEsercizio(e);
    expect(esito.problemi).toEqual([]);
    expect(esito.esercizio).not.toBeNull();
    expect(esito.esercizio!.sezioni[0].boxes[2].answerLatex).toBe("3\\sqrt{2}");
    expect(esito.avvertenze.some((a) => a.includes("sostituita dal calcolo verificato del motore"))).toBe(true);
  });

  it("risultato finale mancante (JSON troncato): lo calcola il motore in forma esatta", () => {
    const esito = riparaEsercizio(esercizioRadicali({ risultatoFinaleLatex: "" }));
    expect(esito.problemi).toEqual([]);
    expect(esito.esercizio).not.toBeNull();
    expect(esito.esercizio!.risultatoFinaleLatex).toBe("\\dfrac{2 - \\sqrt{2} + \\sqrt{6}}{4}");
  });

  it("un box perso nel troncamento (catena incompleta) resta accettabile se ogni conto è verificato", () => {
    /* tolgo il box del denominatore: la catena salta dei passaggi, ma dal
     * 12/11 (foto «ancora non funziona bene») la priorità è l'affidabilità:
     * il collegamento per EQUIVALENZA accetta il box della divisione finale
     * perché op ≡ riga (razionalizzare non cambia il valore) e ogni box, il
     * riguadro e il finale restano verificati dal motore. Un rifiuto qui
     * costava un tentativo IA intero (a volte il fallimento totale). */
    const senzaDenominatore = esercizioRadicali() as {
      sezioni: Array<{ title: string; boxes: Array<unknown> }>;
    };
    senzaDenominatore.sezioni = senzaDenominatore.sezioni.filter((s) => s.title !== "DENOMINATORE");
    const esito = riparaEsercizio(senzaDenominatore);
    expect(esito.esercizio).not.toBeNull();
    expect(esito.problemi).toHaveLength(0);
    expect(esito.esercizio!.risultatoFinaleLatex).toBe(esercizioRadicali().risultatoFinaleLatex);
  });
});

describe("riparaJsonTroncato (cutoff del gateway a metà risposta)", () => {
  it("salva il prefisso completo di un JSON tagliato dentro una stringa", () => {
    const troncato =
      '{"espressioneLatex":"\\\\dfrac{1}{2}","sezioni":[{"title":"CALCOLI","boxes":[{"op":"2^{2}","prompt":"Mol","answerLatex":"4"},{"op":"\\\\sqrt{1';
    const salvo = riparaJsonTroncato(troncato) as { sezioni?: Array<{ boxes?: unknown[] }> } | null;
    expect(salvo).not.toBeNull();
    expect((salvo as { espressioneLatex: string }).espressioneLatex).toBe("\\dfrac{1}{2}");
    expect(salvo?.sezioni?.[0]?.boxes).toHaveLength(1);
  });

  it("salva un taglio dopo un numero completo", () => {
    const salvo = riparaJsonTroncato('{"a":1,"b":[2,3') as { b?: number[] } | null;
    expect(salvo).toEqual({ a: 1, b: [2, 3] });
  });

  it("un JSON malformato NON troncato resta null", () => {
    expect(riparaJsonTroncato('{"a": "ok", "b": }')).toBeNull();
  });
});
