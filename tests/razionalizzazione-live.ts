import { costruisciEsercizioConIA, trascrizioneFedele, validoPerArchivio } from "../server/costruisci";

// Verifica del modello vero senza HTTP di archiviazione: nessuna scrittura su
// cache, sessioni o esercizio attivo. Non stampa mai risposte nel riepilogo.
const casi = [
  { nome: "box-screenshot", sorgente: "(ab+1)⁄√(ab+1)+3", guida: true },
  { nome: "foto-trascrizione-precedente", sorgente: "(√(ab+1))^2⁄√(ab+1)+(2⁄6)^-1", guida: false },
];
const risultati = await Promise.all(casi.map(async c => {
  try {
    const { esercizio, tentativi, avvertenze } = await costruisciEsercizioConIA(c.sorgente);
    const boxes = esercizio.sezioni.flatMap(s => s.boxes);
    const riletto = validoPerArchivio(esercizio);
    const fedele = trascrizioneFedele(c.sorgente, esercizio.espressioneLatex);
    const boxGuida = boxes.some(b => /numeratore e denominatore per la stessa radice/i.test(b.prompt || ""));
    const ok = fedele && !!riletto && boxes.length > 0 && (!c.guida || boxGuida);
    return { nome: c.nome, ok, tentativi, fedele, boxes: boxes.length, boxGuida, riletto: !!riletto, avvertenze };
  } catch(e) {
    return { nome: c.nome, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}));
console.log("RISULTATO_LIVE=" + JSON.stringify(risultati));
if (risultati.some(r => !r.ok)) process.exitCode = 1;

