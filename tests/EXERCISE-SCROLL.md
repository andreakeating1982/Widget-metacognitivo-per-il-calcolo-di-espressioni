# Terza pagina — altezza adattiva e scroll interno

Richiesta del29/10/2026, successiva alla seconda pagina640px.
Solo `/esercizio`: altezza naturale fino a640px; la toolbar è esterna
alla regione scroll `expr-exercise-scroll`, raggiungibile da tastiera.

## Esecuzione isolata

Usare l'ambiente QA già dotato di Playwright, senza modificare le
dipendenze dell'app:

```sh
cp tests/exercise-scroll.e2e.mjs /percorso/qa/exercise-scroll.e2e.mjs
cd /percorso/qa
EXERCISE_SCROLL_URL=http://127.0.0.1:3000 \
EXERCISE_SCROLL_OUTPUT=/tmp/exercise-scroll-qa \
node exercise-scroll.e2e.mjs
```

Facoltativo `EXERCISE_SCROLL_CASE=desktop` per un solo scenario.
La regressione pagina2 usa `tests/input-scroll.e2e.mjs`, separatamente.
Non aggiungere route QA all'app. Non usare sessioni o dati di produzione.

## Contratti verificati

-7 viewport: desktop, mobile320/393, landscape, iframe blog mobile/desktop,
accessibilità160% e contrasto; nessun overflow orizzontale del documento.
- Altezza <=640px, oppure <=viewport visibile fuori dall'iframe; toolbar
  ferma, scrollbar4px, focus della regione, gesti/tastiera di scorrimento.
- Fixture di sessione sintetica con3box: prima vuoti, errore senza risultato,
  avanzamento solo dopo risposte immesse via UI e pannello istruzioni lungo.
- PDF generato dal gestore reale ma catturato localmente con un test stub
  di `window.open/document.write`: tutte le righe e i dati sintetici,
  nessun limite altezza ereditato. NON è una certificazione di stampante.
- `@media print` rimuove i limiti del wrapper; `screen` li ripristina.
  Tale prova si esegue DOPO il controllo dei messaggi altezza a schermo:
  le maggiori altezze volutamente richieste dalla stampa non sono loop
  del layout screen. Il PDF vero apre già un documento separato.
- Un box semplice/completato può comunque superare naturalmente640px:
  le card e i font reali NON si rimpiccioliscono per forzarlo a entrare.
  Un clone DOM isolato, a CSS invariato, prova separatamente la capacità
  intrinseca del layout di crescere e restringersi sotto/sopra il massimo.
  Tale clone NON è uno stato reale dell'esercizio né una screenshot UI.
- Iframe iniziato a1600px e forzato poi a1700px: ping/height/token lo
  riportano al contenuto effettivo <=640px senza loop di crescita.
- Prima pagina non limitata e seconda pagina640px conservata.
- Classi distinte dallo storico `expr-exercise-page` per non attivarne
  le vecchie regole tipografiche; nessuna modifica ai font del flusso attuale.

## Limiti

API sessione simulate, nessuna IA reale e nessuna scrittura al database.
Touch e viewport sono emulati in Chromium: non sono test su telefoni fisici
o sul blog pubblico. I risultati della suite vanno conservati separatamente
dai test unitari738 e dai rapporti antecedenti alla modifica.

