# Deploy autorizzato 8999 — 7 novembre 2026

## Pubblicazione

- Utente: consenso esplicito successivo all'anteprima condivisa, richiesta
  «Deploy in produzione, poi ridammi il pacchetto zip aggiornato e aggiorna le skills».
- Progetto della chat: `espressioni-monomi-polinomi`, con percorso locale
  `/home/user/espressioni-monomi-polinomi`; la directory reale è la variante
  universale `/home/user/espressione-frazioni-potenze`, non un'altra app.
- Checkpoint runtime: `d03a73df1ead94fd0eba82ae3bac2e7cf2ec484e`.
- Deploy Easy-Peasy: **8999, active**, servizio esistente aggiornato.
- Sito: https://espressioni-monomi-polinomi.easy-peasy.site/
- Servizio: https://deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app/

Il runtime comprende i miglioramenti matematici/sessione collaudati il 7/11,
il footer del cropper adattivo e la pagina di prova della cornice con i
pulsanti chiari come nella foto. Il deployment **non modifica** il post
Blogger né il DOCX già consegnato.

## Controlli effettivi

- Entrambi i domini servono titolo corretto e gli asset client
  `index-6REOV0_r.js` / `index-DpITYsgm.css`; confronto byte per byte con la
  build approvata, rispettivamente SHA-256 `b9bce11d3ff22bc35ad96e86d68bd5743a304ffa77f1f5b9d4f0694b5e4ee81b`
  e `5784c87fc48d3a31ec207134d0f6203b5f68e0b58e70548514561cc2ac70c185`.
- Font OpenDyslexic Regular e Bold WOFF2: risposta reale e confronto hash
  con i file della build. Pagina di prova della cornice identica al sorgente.
- Browser: app visibile; cornice di prova in produzione verificata con
  **13 controlli desktop e 13 mobile emulato**, inclusi schermo intero,
  ricarica, focus, SVG completi, etichette e spazio di tocco.
- Richiesta `POST /api/ai/parse-spoken` con JSON vuoto: **400** di validazione;
  non ha chiamato l'IA né scritto dati. Non certifica l'inferenza reale.
- Suite sulla sorgente runtime: **886 client passati / 28 saltati**,
  **16 server passati** con modello e archivi simulati. `pnpm check` e build
  erano riusciti prima della pubblicazione. Vedi i rapporti di collaudo per
  i casi matematici, PDF e limiti di equivalenza.

Non sono stati usati dati personali, cancellate righe, avviate migrazioni o
chiamati servizi IA live. Mobile e touch sono emulati, non dispositivi fisici.

## Cornice Blogger

La cornice inserita nel post è un blocco HTML autonomo. Per aggiornarne le
icone e lo stile occorre sostituire quel solo blocco col contenuto di
`cornice-dinamica/embed-espressioni-dedicata.html` o del **Codice 14** del
DOCX aggiornato nella sessione; non confondere con la Cornice Universale PDF.
Il post non è stato modificato automaticamente.

Per la ricostruzione dello ZIP usare `VERSIONE-8999.md`, `REBUILD.md` e il
rapporto esterno del pacchetto effettivamente testato. Ogni successivo
rilascio richiede una nuova anteprima e un nuovo consenso esplicito.

