# Seconda pagina compatta — produzione8756,29/10/2026

## Stato corrente pubblicato

Pagina2 **640px**, oppure viewport visibile se minore fuori dall'iframe;
pagina3 adattiva al contenuto fino a640px. Entrambe con toolbar esterna
allo scroll. Rilascio8756 autorizzato, pubblicato e verificato; vedere
`VERSIONE-8756.md`, `docs/DEPLOY-8756.md`, `docs/TERZA-PAGINA-ADATTIVA.md`.
I limiti820/720 e «terza pagina invariata» nelle sezioni storiche seguenti
non descrivono il runtime corrente. In pagina3 mantenere il nome
`expr-exercise-scroll` (non `expr-exercise-page`) e flex-basis:auto.
Il nuovo ZIP8756 ricostruisce entrambi i wrapper pubblicati.

## Origine della modifica compatta — 29/10/2026

Su nuova richiesta da foto mobile: **640px** predefiniti, identici al
valore iniziale `.lf-iframe` della cornice dedicata Latino Facile,
repository aggiornata commit `fccd3eeb46d801b5110e2fc9a3b682e6501a4d6c`.
Autonoma: `min(640px, viewport visibile)`; iframe:640px indipendenti.
Non usare `height:auto` con `flex:1 1 0` sul figlio: collassa il contenuto.
Dettagli e collaudo in `docs/ALTEZZA-COMPATTA-PREVIEW.md`.
Le sezioni seguenti conservano la storia della produzione8744 precedente.
Per il comportamento attuale prevalgono le specifiche8756 sopra.

## Cronologia8744 — richiesta e riferimento

La seconda pagina deve mantenere un'altezza ragionevole, anche con molti
pezzi, pannello audio/tastiera e ritaglio foto. Riferimento richiesto:
https://github.com/andreakeating1982/Applicazione-Latino-Facile
(commit `39f503c`).

Nel riferimento la barra laterale è la **scrollbar nativa** sottile,
non una sidebar di navigazione: 4px, marrone `rgba(139,92,62,.2)`, hover .35,
angoli 3px. Lo stile esisteva già in entrambe le app. Il riferimento NON
contiene un limite fisso generale della pagina: qui si aggiunge il
contenitore richiesto, mantenendo quello stesso stile.

## Comportamento

- SOLO `/espressione`: barra accessibilità esterna e sempre disponibile;
  titolo, dati, canvas, pezzi e comandi scorrono in un'unica area interna.
- Autonoma: altezza massima complessiva **820px** (desktop) / **720px**
  (larghezza <640px), mai superiore al viewport visibile. VisualViewport
  aggiorna l'altezza anche quando si riduce lo spazio per la tastiera.
- Iframe/blog: altezza complessiva **820px /720px** indipendente da quella
  dell'iframe. NON usare `100vh` come riferimento dentro una cornice
  auto-alta: il parent usa l'altezza del child e viceversa, causando loop.
- Pannelli e pezzi lunghi scorrono internamente: nessun limite ai pezzi,
  nessuna riduzione dei font, niente comandi o testi eliminati.
- Mouse, touch e tastiera (regione con nome e `tabIndex=0`). Alto contrasto
  conserva una scrollbar scura visibile; focus chiaramente indicato.
- Il cropper mantiene viewport, dialogo modale e PNG approvati: lo scroll
  della pagina interna viene congelato e poi ripristinato alla chiusura.
- Le notifiche della pagina sono nascoste SOLO mentre è aperto il ritaglio:
  non possono coprire i suoi quattro comandi dopo l'aggiunta rapida dei pezzi.
  Non sono cancellate e tornano visibili alla chiusura se non già scadute.
- Prima e terza pagina NON ricevono il limite o la scrollbar interna.

## File modificati e invarianti

- `App.tsx`: wrapper `expr-input-frame` solo se `useRoute('/espressione')`;
  aggiornamento `--expr-visible-height` SOLO standalone, cleanup su uscita.
- `EspressioniExercises.tsx`: `expr-input-page`, regione con nome e focus;
  rimosso SOLO il vecchio observer locale del body che mandava messaggi
  senza token e senza guardia crop. L'unica fonte ora è `initHeightSync()`.
- `index.css`: frame flex limitato, area scroll, layout embedded indipendente
  dal viewport del child, congelamento con `data-lf-crop-open`, stampa libera.
- **`position:relative` necessario su frame e area scroll**: il MathML
  invisibile assoluto di KaTeX altrimenti può riferirsi al body e sfuggire
  al clipping, gonfiando `documentElement.scrollHeight` pur con body basso.
  Riprodotto con dieci pezzi; corretto senza toccare formule o riconoscimento.

NON cambiare `CropDialog.tsx`, hook viewport, `confirm()`, `cropBox.ts`,
`photo-crop.css`, OCR, motore, costruzione IA, PDF o dati. Nessuna modifica
al protocollo heightSync, token, ping o cornice Blogger.

## Prove ripetibili

`tests/input-scroll.e2e.mjs`, istruzioni `tests/INPUT-SCROLL.md`:
sette scenari con dieci pezzi veri, pannelli, rotella/touch/tastiera,
conferma PNG e mock OCR. Regressione `tests/crop-mobile.e2e.mjs`.
Touch/viewport/keyboard sono emulati in Chromium, non telefoni fisici;
blog cross-origin simulato, nessuna prova sul blog pubblico del docente.

**Miglioria approvata e pubblicata nel deploy 8737.** Commit funzionale
`f2f285102a92deae1ae35175ba64cc49722bfb42`; URL e hash in VERSIONE-8737.md.
HTTP 200 e JS/CSS identici alla versione approvata verificati su URL pubblico
e Cloud Run; scorrimento interno provato nel browser online. Aggiornare
soltanto documenti/skill e ZIP non autorizza un nuovo deploy.

## Rifiniture header (produzione 8742, stessa data)

Su richiesta (foto utente) nella seconda pagina sono RIMOSSI il titolo
«WIDGET METACOGNITIVO…» e la riga dati studente (restano in prima pagina e
nel PDF); il link «← Torna alla home» è sostituito dal piccolo pulsante
marrone **INDIETRO** (token primary, `text-xs px-3 py-1.5`, aria-label
«Torna alla pagina iniziale», sempre visibile); didascalia input
«SCRIVI QUI L'ESPRESSIONE IN UNO O PIU' PEZZI.» senza «DA SVOLGERE,».
Commit `f7531736680fc9b1d3b1fa1cc79a4f5228418a6b`; hash in VERSIONE-8742.md.
NON reintrodurre titolo né riga dati nell'header di pagina 2. Lo ZIP 8742
comprende sia lo scorrimento interno sia queste rifiniture.

## Pezzi lunghi e didascalia finale (produzione 8744, stessa data)

Da foto mobile: i pezzi troppo lunghi uscivano dai bordi della card. Ora
gli span KaTeX dei pezzi hanno classe `piece-display` con `flex-1 min-w-0`
e la regola CSS abilita lo scorrimento orizzontale DENTRO ciascun box
(`.katex-display` con margini ridotti, `width max-content`, `min-width
100%`): pezzi corti centrati come prima, pezzi lunghi contenuti. Stessa
classe anche al box «Espressione trascritta» del pannello audio/tastiera e
al riquadro «Controlla prima di confermare». Didascalia solo «SCRIVI QUI
L'ESPRESSIONE» in `text-foreground font-bold`. Collaudato con un pezzo
lunghissimo di prova: pagina senza overflow orizzontale, box con
scorrimento interno. Hash in VERSIONE-8744.md.


## Esito del collaudo finale

- `pnpm check` e `pnpm build`: riusciti.
- Suite unitari: **738 superati, 28 saltati**.
- Nuovo layout: **7/7 scenari**, 151 controlli riusciti.
- Regressione ritaglio: **9/9 scenari**, 223 controlli riusciti.
- Tutti i sorgenti invarianti elencati sopra identici al checkpoint 8736.
- Il primo test della rotazione confrontava tutto il CSS inline, compresa
  la nuova variabile del viewport. Fallimento del test, non del ripristino:
  ora verifica tutti gli stili del lock SEPARATAMENTE dalla variabile, che
  deve riflettere il viewport corrente (393px dopo rotazione, non 780px).
- Risultati riproducibili: `tests/input-scroll-results.json`.
