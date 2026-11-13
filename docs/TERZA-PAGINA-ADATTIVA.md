# Terza pagina adattiva — anteprima 29/10/2026

## Richiesta

Applicare anche alla terza pagina `/esercizio` l'altezza compatta dello
stile Latino, seguendo il contenuto e conservando lo scorrimento interno.
La seconda pagina era già stata collaudata a640px nel checkpointc498c69.
Questa estensione non autorizza un deploy di produzione.

## Implementazione

- `App.tsx`: wrapper `expr-exercise-frame` SOLO per `/esercizio`;
  la toolbar resta fuori dalla regione scroll. L'effetto viewport già
  esistente gestisce ora sia pagina2 sia pagina3, ma mai l'iframe.
- `EsercizioFrazioni.tsx`: aggiunta soltanto una regione esterna nominata,
  `tabIndex=0`, `expr-exercise-scroll`. Il contenuto `.lf-svolgimento`,
  sessioni, risposte, progressione, formule e generazione PDF sono invariati.
- CSS: wrapper con `height:auto;max-height:640px` nell'iframe; standalone
  `max-height:min(640px,var(--expr-visible-height,100dvh))`.
  Regione con `flex:0 1 auto;min-height:0;overflow-y:auto`:
  la base automatica preserva l'altezza naturale di un contenuto corto,
  a differenza di flex-basis0 che lo farebbe collassare.
- Selettore nuovo `expr-exercise-scroll`, distinto dallo storico
  `expr-exercise-page` che applica propri font a un'altra UI. Non attivare
  sulla terza pagina le sue vecchie regole tipografiche.
- `position:relative` su frame e regione per contenere il MathML KaTeX.
  Scrollbar4px marrone, focus visibile, contrasto e touch preservati.
- Stampa: limiti e overflow rimossi in `@media print`; il PDF attuale
  apre già un documento separato, che non eredita questo contenitore.
- Unico `initHeightSync` esistente, nessun nuovo observer e nessuna
  dipendenza dall'altezza inviata al parent. La cornice si adatta al
  wrapper fino a640px; i passaggi ulteriori scorrono dentro.

## Verifica preliminare effettiva

- Primo scenario desktop completo:24controlli passati su fixture sintetica.
- Tipi e build superati; unit test738passati/28saltati.
- Nel Chrome dell'utente, dopo ricaricamento, `browser_scroll_down` ha
  riconosciuto la regione nominata e scrollato242px DENTRO il pannello,
  lasciando visibile la toolbar; non la pagina intera.
- Confronto visivo iframe mobile393px: altezza prima952,72px ricostruita
  con override CSS del contenitore precedente, dopo640px reali; carattere
  titolo18px in entrambi, contenuto823px con area scroll502px nel dopo.
  Nessun accesso alla produzione o a sessioni utente per tale confronto.

## Distinzione stampa/schermo nel collaudo

La stampa toglie intenzionalmente il limite640 per non tagliare i passaggi.
Il primo test mescolava le altezze della prova `emulateMedia(print)` a
quelle screen; è stato corretto l'ordine del TEST, non heightSync o PDF.
Il contratto dei messaggi a schermo si verifica prima di attivare print.

## Collaudo finale

Completato: **7/7 scenari, 168 controlli superati** per la terza pagina.
Desktop, mobile320/393, landscape, iframe blog mobile/desktop e
accessibilità160% con contrasto: scrollbar, focus e toolbar stabili,
risposte immesse via UI su fixture sintetica, errore senza anticipazione
della risposta, progressione, pannello tastiera e PDF verificati.
Il test del clone DOM isolato conferma che il layout si restringe sotto
il limite quando il contenuto effettivo è breve; non forza a essere breve
un esercizio che, con i font accessibili, richiede naturalmente più spazio.

Risultati: `tests/exercise-scroll-results.json`; test ripetibile:
`tests/exercise-scroll.e2e.mjs`, istruzioni `tests/EXERCISE-SCROLL.md`.
Regressione separata della seconda pagina e cropper: **7/7 scenari,
151 controlli superati**, in `tests/input-scroll-page3-regression-results.json`.
Tipi e build superati; unit test738passati e28saltati.

L'audit del sorgente verifica che, rimosso il solo wrapper esterno,
`EsercizioFrazioni.tsx` è identico al checkpointc498c69: logica delle
risposte, contenuti, sessioni e generatore PDF non sono stati modificati.
Le sole modifiche runtime sono App.tsx, index.css e il wrapper JSX.

API di sessione e IA simulate; nessuna scrittura al database utente.
PDF HTML catturato localmente dalla funzione reale, non prova di stampa
fisica. Viewport/touch emulati in Chromium, non telefoni fisici o blog
pubblico. Nessuna ripetizione dei test già riusciti durante la consegna.

## Rilascio

Preview condivisa e approvata con messaggio successivo «deploy in produzione».
Pubblicato e verificato il29/10/2026: **produzione8756**, URL pubblico invariato.
Dettagli, commit e checksum in `DEPLOY-8756.md`. Il precedente ZIP8744
non è stato rigenerato. Le frasi «anteprima» sopra documentano la fase
di sviluppo precedente all'autorizzazione, non lo stato del sito corrente.

