/** Profiling di riparaEsercizio sulla risposta IA salvata (loop sospetto). */
import { riparaEsercizio } from "./server/costruisci";
import { readFileSync } from "node:fs";

const raw = JSON.parse(readFileSync("/tmp/ia-raw.json", "utf-8"));
const candidato = (raw as { esercizio?: unknown }).esercizio ?? raw;
console.log("avvio riparaEsercizio…");
const esito = riparaEsercizio(candidato);
console.log("esito:", esito.esercizio ? "OK" : "NULL");
console.log("problemi:", esito.problemi);
console.log("avvertenze:", esito.avvertenze);
