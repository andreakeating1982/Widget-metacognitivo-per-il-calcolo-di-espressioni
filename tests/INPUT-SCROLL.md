# Seconda pagina: contenitore e barra laterale

Riferimento visivo: Applicazione-Latino-Facile, commit `39f503c`:
scrollbar nativa 4px, marrone tenue `rgba(139,92,62,.2)`, hover .35.
La repository sorgente non ha una sidebar-menu né un limite generale
fisso nella seconda pagina: il limite qui è l'aggiunta richiesta dall'utente.

## Layout compatto pubblicato8756 del29/10/2026

Il riferimento attuale è `fccd3eeb46d801b5110e2fc9a3b682e6501a4d6c`:
la cornice dedicata Latino Facile parte da **640px**. La pagina2 assume
questo limite, mantenendo toolbar fuori dallo scroll e funzioni precedenti.
Su richiesta successiva la pagina3 è adattiva fino a640px; ha un proprio
wrapper e test in `EXERCISE-SCROLL.md`, non eredita quello di pagina2.
Il riferimento storico `39f503c` sopra resta valido per lo stile scrollbar.

## Avvio

Eseguire Vite in un ambiente locale/anteprima. Nessuna IA reale e nessun
DB sono usati dai test. Il test intercetta il solo OCR con `{text:'2+3'}`
e le richieste in lettura dei dati di esercizio con una risposta fittizia.

Playwright è necessario nell'ambiente QA (non una dipendenza runtime).
Se non è installato nel progetto, copiare lo script in una cartella QA
con Playwright e Chromium installati e lanciarlo da lì:

```sh
INPUT_SCROLL_URL=https://URL-ANTEPRIMA node input-scroll.e2e.mjs
# Un solo scenario:
INPUT_SCROLL_CASE=blog-mobile INPUT_SCROLL_URL=https://URL-ANTEPRIMA node input-scroll.e2e.mjs
```

## Contratti da verificare

- Seconda pagina autonoma: altezza **min(640px, viewport visibile)**,
  anche con tastiera mobile o orientamento orizzontale.
- In iframe: altezza esterna **640px**, INDIPENDENTE da
  innerHeight dell'iframe (nessun loop parent/child). Contenuto lungo
  scorre in `.expr-input-page`, non fa crescere il documento.
- Barra accessibilità fuori dallo scroll e sempre disponibile.
- Dieci pezzi veri, pannello audio e istruzioni: nessuna crescita esterna.
- Scorrimento touch, rotella e tastiera reali. Regioni aria e focus.
- CropDialog: nucleo/PNG/maniglie/rotazione invariati. Pagina interna ferma,
  posizione ripristinata dopo chiusura, cornice congelata anche a ping.
  Hit test dei quattro comandi: nessuna notifica di sfondo può coprirli.
- Unica fonte heightSync condivisa, messaggi con token, niente observer
  locale che bypassa il lock del ritaglio.
- Prima pagina senza limite; pagina3 usa `expr-exercise-frame` e regione
  `expr-exercise-scroll`, non il wrapper di pagina2. Specifica separata.

Eseguire questa suite e quella del cropper in sequenza (due browser in
parallelo caricano lo stesso server Vite e rendono instabili i timing).
L'aggiunta rapida dei pezzi attende il commit e lo scroll automatico prima
dell'azione seguente: niente force-click e niente azioni DOM simulate.

Touch e viewport sono emulati in Chromium, non dispositivi fisici. Il blog
cross-origin è simulato; nessuna certificazione sul blog pubblico dell'utente.

