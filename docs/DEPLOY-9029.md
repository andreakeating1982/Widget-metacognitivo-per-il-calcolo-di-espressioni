# Rilascio in produzione 9029 — 7 novembre 2026

## Versione autorizzata

- Applicazione: WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI.
- Sito: https://espressioni-monomi-polinomi.easy-peasy.site/
- Servizio: https://deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app/
- Deploy Easy-Peasy **9029**, servizio esistente aggiornato.
- Runtime applicativo: checkpoint `2d1f166aac6166abfaba0e6840076b9ef88b22c4`.
  Il checkpoint distribuito `58f6edca61b9929c10075032b8d834efa0232a6c`
  aggiunge soltanto note di avanzamento, non cambia il runtime.
- Anteprima condivisa e conferma esplicita dell'utente in un messaggio
  successivo. La pubblicazione non modifica il post Blogger.

## PDF pubblicato

Nel PDF completo, dal feedback finale, cognome/nome, classe e data stanno su
una riga quando c'è spazio; i dati lunghi vanno a capo senza tagli. Subito
sotto compare «Risposte giuste al primo colpo: X su Y», calcolato con lo
stesso dato del feedback. Il PDF parziale interno non presenta un punteggio
come finale. Restano invariati il flusso didattico, la cornice e il principio
che ogni risultato deve essere inserito dallo studente.

## Verifiche post-deploy

- Entrambi gli URL restituiscono il titolo dell'app e i bundle approvati.
- JS `index-xAuyHR0D.js`: SHA-256
  `b93fcfd0cff2ab994f4680062519dbce872b3863171b99e5a017314ef0aab35f`.
- CSS `index-Bg2H0_BO.css`: SHA-256
  `fc6092b5df609b122a62e8184c4e648f4dadbcf30cc9bd2759ebe830136f7d8d`.
- Font OpenDyslexic Regular: file WOFF2 reale, SHA-256
  `2ebd6cbe970e7fae3451bf236fc5b33bef133152f392ec2dfe0a9095ba6cffd0`,
  coincidente con quello locale.
- Sul dominio pubblico: **6/6 scenari PDF** con conteggi 0/parziale/totale,
  dati lunghi, caratteri speciali, assenza di dati, finestra di stampa e PDF
  A4 sintetici; **9/9 scenari feedback**, compresi telefono e iframe emulati.
  Le sessioni e le risposte sono sintetiche; non si è usata IA live né sono
  stati modificati dati reali. Il popup reale usa KaTeX pubblico, i rendering
  PDF isolati usano KaTeX locale. Non è stata usata una stampante fisica.
- Nel Chrome dell'utente, il post MATEMATICA mostra la cornice già esistente
  e l'app caricata nella pagina iniziale. Il dominio dell'app è invariato.
  Non è stato modificato il post né testato l'intero percorso sul blog reale.

I test preventivi di tipi, client/server e i 16 percorsi studente sono
riportati in `COLLAUDO-PDF-PRIMO-COLPO-ANTEPRIMA.md`. Il controllo automatico
aveva segnalato limiti preesistenti nella prima pagina non interessata da
questo intervento; non sono stati presentati come corretti.

## Archivio precedente

Lo ZIP **9019** già consegnato non comprende questa modifica PDF. Il toolkit
storico di verifica conteneva hash 9019; l'export successivo usa gli hash 9029
e va collaudato sull'archivio effettivo. Il deploy non ha prodotto uno ZIP;
né il deploy né l'export modificano GitHub/Render o installano automaticamente
nuove skill nell'account. Risultati del pacchetto nel rapporto esterno.

