# Rilascio in produzione 9038 — 7 novembre 2026

## Identità e approvazione

- App: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**.
- Dominio: https://espressioni-monomi-polinomi.easy-peasy.site/
- Servizio: https://deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app/
- Deploy Easy-Peasy **9038**, nel servizio esistente, eseguito dopo la
  condivisione dell'anteprima e il «sì, pubblica in produzione» dell'utente
  in un messaggio successivo.
- Checkpoint della correzione `574a0e09802256a18bf39a0f2dbd5766edcaaf0b`;
  checkpoint immediatamente precedente al deploy `895ade6d61dda6da819603e81d308cd960724565`
  (ulteriori cambiamenti di sola documentazione). Il precedente rilascio
  **9033** è documentato in `DEPLOY-9033.md`.

## Modifiche pubblicate

Alcune somme e differenze riconoscibili di due frazioni letterali, compreso
il caso fotografato con un fattore esterno, hanno un percorso deterministico
con passaggi verificati. Il fattore esterno non viene confuso con il
numeratore. La fedeltà distingue la struttura della traccia pur trattando
correttamente `/` e `⁄`. Le formule lunghe scorrono nel loro contenitore,
anche da tastiera e con caratteri ingranditi. Il percorso precedente dei
coniugati è preservato.

Il generatore è **circoscritto**, non risolve tutte le espressioni fratte;
quelle che non garantisce passano al flusso IA precedente. Non promettere
che il percorso IA riesca in ogni caso. Ogni risultato è scritto dallo
studente; non anticiparlo né a video né con la lettura vocale.
Restano invariati l'istruzione normale sulle frazioni, il riconoscimento
delle parentesi tonde/quadre/graffe, il conteggio del primo colpo e il PDF
solo nel feedback. Ambito tecnico e test in
`COLLAUDO-FRATTE-FATTORE-ESTERNO-ANTEPRIMA.md` e
`ISTRUZIONI-FRAZIONE-ANTEPRIMA-2026-11-07.md`.

## Verifiche e limiti

- Entrambi i domini pubblicati servono titolo, client e CSS identici
  all'anteprima approvata. JS `index-BFByotI7.js`, SHA-256
  `dbee09925f33385c422694628121dce52187a372259ece81b4c5162dd12fb4f5`;
  CSS `index-D6pcemJP.css`, SHA-256
  `e1c328148ea7947f99c587066e0f93456dcaff0ea8260cd30ea421302c67393e`.
- La pagina iniziale è stata aperta nel Chrome personale; `/esercizio`
  risponde e il font WOFF2 online corrisponde a quello della build.
  La route di stato in sola lettura risponde per un job inesistente.
- Suite locali: `pnpm check` e build riusciti; **956 test client passati,
  28 saltati**; **45 test server** con archivi e modello simulati.
- Su client pubblicato con API intercettate: caso fotografato/iframe
  **3/3**, percorso studente **16/16**, parentesi **13/13**, feedback
  **9/9**, intestazione e conteggio PDF **6/6**. Desktop, telefono e
  touch sono emulati; i dati sono sintetici.
- La prova diretta del modello IA non è partita per un errore dello script
  di test: **non** è stata verificata l'IA live. Non sono state create,
  modificate o cancellate sessioni reali. Non è un collaudo su un telefono
  fisico, una stampante o una certificazione di accessibilità.
- Lo scanner di accessibilità segnala in pagina iniziale problemi di
  contrasto sul pulsante ENTRA, assenza di h1 e dimensioni di alcuni
  pulsanti. Erano presenti anche nella baseline 9033 e non sono stati
  oggetto di questo intervento.

Il deploy non modifica autonomamente il post Blogger, un repository GitHub
né Render. I vecchi ZIP 9029 e precedenti sono storici. Gli aggiornamenti
di sola documentazione e le esportazioni successive non sono nuovi deploy.
Per un futuro rilascio occorrono nuovamente checkpoint, anteprima condivisa
e consenso esplicito successivo.

