// ─── Righi del quaderno «RICOPIA SUL QUADERNO» ────────────────────
//
// Segnalazione 27/9 (quaderno PDF, espressione (2+5²):(4²−2·5−3)+48:(6²−2³)):
// il rigo «27 : 3 + 48 : 28» — l'espressione senza parentesi — compariva DUE
// volte consecutive (chiusura del RICOPIA del punto 3 + prima riga del
// RICOPIA del punto 4 «Calcolo in ordine»). Oltre alla correzione alla
// fonte, il quaderno usa un FILTRO DI SICUREZZA usato sia dall'anteprima
// sia dal PDF: prima del rendering ogni rigo consecutivo identico al
// precedente viene eliminato (dedup adiacente), così il quaderno non può
// più contenere righi ripetuti anche se in futuro cambia la logica dei passi.

/** Normalizza una riga per il confronto: spazi collassati e trim. */
export function chiaveRiga(riga: string): string {
  return riga.replace(/\s+/g, " ").trim();
}

/**
 * Dedup adiacente: rimuove ogni riga identica (a confronto normalizzato)
 * alla precedente. Le righe non consecutivamente uguali restano (un rigo
 * può tornare legittimamente dopo altri passi).
 */
export function dedupeRigheAdiacenti<T>(righe: T[], chiave: (r: T) => string): T[] {
  const out: T[] = [];
  let prev: string | null = null;
  for (const r of righe) {
    const k = chiaveRiga(chiave(r));
    if (k && k === prev) continue;
    if (k) prev = k;
    out.push(r);
  }
  return out;
}
