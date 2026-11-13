# Rilascio in produzione 9033 — 7 novembre 2026

## Identità e approvazione

- Applicazione: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**.
- URL permanente: https://espressioni-monomi-polinomi.easy-peasy.site/
- Servizio: https://deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app/
- Deploy Easy-Peasy **9033** sul servizio esistente, dopo anteprima condivisa
  e consenso esplicito dell'utente in un messaggio successivo.
- Checkpoint funzionale verificato dell'anteprima: `e79b09c56a5ea12ca7ebc5fb3d6691941755e6a5`.
  Checkpoint immediatamente prima della produzione:
  `ca220d91a754d0d9439355f6c422c5e5567a6848`; rispetto al precedente
  contiene soltanto documentazione e avanzamento, non modifiche di runtime.
- Il precedente rilascio **9029** è documentato in `DEPLOY-9029.md`.

## Modifica pubblicata

L'istruzione sul risultato frazionario composto è nel normale testo del
metodo, senza riquadro grigio: «Scrivo così il risultato:
(numeratore)/(denominatore)». Non si anticipa la soluzione. La valutazione
accetta risposte corrette con parentesi tonde, quadre e graffe, anche
annidate e a numeratore o denominatore; il parser già lo supportava e non è
stato modificato. La risposta deve essere equivalente e rispettare il
criterio didattico; parentesi sbilanciate e denominatori nulli sono rifiutati.

## Verifiche e limiti

- Entrambi gli URL rispondono con il titolo dell'app e gli stessi bundle
  dell'anteprima approvata. JS `index-BDI0Itr8.js`, SHA-256
  `98f0adbd8a12ee7d7138d012cf14798e1e6a112bcd0a13a8bcbbca69e74b639c`;
  CSS `index-mjxQNLQT.css`, SHA-256
  `0e85df9174d48a21bc74e0c77d50522a4698360545f63e70d93dce3ba98f7599`.
- Il client pubblicato contiene la nuova istruzione e non contiene il titolo
  del vecchio riquadro. La route `/esercizio` risponde HTTP 200. Il font
  `OpenDyslexic-Regular-v2.woff2` online è un WOFF2 reale e coincide con
  quello locale, SHA-256
  `2ebd6cbe970e7fae3451bf236fc5b33bef133152f392ec2dfe0a9095ba6cffd0`.
- Prima del rilascio: type-check e build riusciti, 956 test client superati e
  28 saltati, 19 test server con mock; sull'anteprima effettiva, 13/13
  scenari parentesi, 9/9 feedback e 6/6 intestazione PDF con dati e API
  simulati. Dettagli in `ISTRUZIONI-FRAZIONE-ANTEPRIMA-2026-11-07.md`.
- Il browser Chrome personale non ha risposto al tentativo di apertura
  post-deploy: **non** è stato eseguito un percorso interattivo nel browser
  di produzione per questo rilascio. Identità dei file e controlli HTTP non
  sostituiscono un collaudo su dispositivi reali. Non sono state inviate
  richieste all'IA, create sessioni reali o modificati dati per la verifica.

Il deploy non modifica il post Blogger o GitHub/Render. Non è stato generato
un nuovo ZIP: quello della 9029 e i suoi hash sono storici e non includono
la modifica 9033. Non è stato aggiornato alcun file di skill in questo
rilascio. Per una nuova pubblicazione occorrono nuovamente anteprima,
condivisione e successiva autorizzazione esplicita.

