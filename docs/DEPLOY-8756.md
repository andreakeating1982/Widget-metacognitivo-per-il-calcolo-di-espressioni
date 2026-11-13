# Produzione8756 — 29ottobre2026

**Nota successiva sul pacchetto:** richiesta e preparazione dello ZIP8756
con skill aggiornate dopo il rilascio. La sezione «ZIP e documentazione»
in fondo descrive la situazione al momento del deploy, prima della nuova
esportazione. Consultare VERSIONE-8756 e il manifest del pacchetto corrente.

## Autorizzazione e identità

Pubblicazione richiesta dall'utente con «deploy in produzione», in un
messaggio successivo alla consegna della preview verificata delle pagine2/3.
Servizio esistente aggiornato; nessuna nuova app e nessun cambio di URL.

- Progetto corrente: `/home/user/espressioni-monomi-polinomi`.
- Titolo: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**.
- DeploymentId: **8756**, stato active.
- Pubblico: https://espressioni-monomi-polinomi.easy-peasy.site
- Cloud Run: https://deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app
- Runtime approvato/testato: `82602edcb86273a2c2ae997cc97ac30dcaef2dba`.
- Checkpoint immediatamente prima del deploy:
  `4868ef6e873ac659cc64581fc346dc60cca649e6`.
  Differenza rispetto al runtime approvato: solo checklist di autorizzazione.
- Questa nota e l'aggiornamento dei README sono successivi al rilascio;
  non richiedono e non autorizzano un altro deploy.

## Modifiche pubblicate

- Pagina2 `/espressione`: altezza predefinita640px, scroll interno.
- Pagina3 `/esercizio`: altezza naturale in base al contenuto fino a640px,
  scroll interno quando il contenuto supera tale massimo.
- Toolbar accessibilità esterna allo scroll; viewport/tastiera fuori iframe
  possono ridurre ulteriormente il contenitore.
- Nessuna modifica a motore, risultati, API, sessioni, generazione PDF,
  font e nucleo cropper durante questo rilascio.
- URL e protocollo/token dell'embed invariati: non occorre sostituire il
  codice Blogger esistente per ricevere il nuovo frontend pubblicato.

## Verifiche effettive post-deploy

1. Sia dominio pubblico sia Cloud Run: HTTP200, titolo corretto e
   riferimenti ai nuovi bundle.
2. JS e CSS scaricati dal sito pubblico identici byte-per-byte a quelli
   della build approvata; SHA-256:

   - `index-4q0PEhNN.js`:
     `734e0af599b2e49ae52bc3660155b241af6fc7223b2b3ea356ed05a4dc340d7c`
   - `index-G2fFP9TG.css`:
     `d86a90702741b80a751a8c76ee9f7e5a68fcf13cd939a768c1c941a1655eb2e8`

3. Font OpenDyslexic Regular/Bold-v2: HTTP200, MIME font/woff2, file
   WOFF2 reali e confronto binario identico con gli asset locali.
4. Nel Chrome connesso dell'utente, sulle pagine pubbliche: scorrimento
   riconosciuto dentro le regioni nominate, non nell'intero documento.
   Terza pagina:238px; seconda pagina:53px, nei contenuti disponibili
   in quella verifica. Toolbar rimasta disponibile. Nessuna risposta immessa.
5. Smoke della configurazione IA con stringa parlata vuota: HTTP400 con
   errore previsto «Testo mancante», non503. Il percorso conferma la
   configurazione del client server prima della validazione input;
   nessuna generazione reale, sessione creata o scrittura al database.

## Collaudo precedente della stessa build

- Terza pagina:7/7 scenari e168controlli.
- Regressione seconda pagina/cropper:7/7 scenari e151controlli.
- Tipi/build superati;738test unitari passati e28saltati.
- Touch/viewport mobile e iframe nei test E2E erano simulati in Chromium;
  nessuna certificazione su telefoni fisici o sul blog pubblico.
- Il generatore PDF reale era stato verificato catturandone localmente
  l'HTML su fixture sintetiche, senza stampante fisica.
- Queste suite non sono state ripetute sulla produzione: verifica hash
  e smoke browser della stessa versione, senza modificare dati reali.

## ZIP e documentazione

Il precedente ZIP consegnato conserva la baseline8744 e non è stato
rigenerato implicitamente dal deploy. Le note in `VERSIONE-8744.md` e gli
esiti storici restano corretti per quel pacchetto, non per il layout8756.
Per ricostruire la versione attuale usare il checkpoint di questo rilascio.

