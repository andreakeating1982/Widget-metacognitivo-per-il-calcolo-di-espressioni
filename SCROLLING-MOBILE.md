# Ritaglio foto mobile — comportamento corretto (28/10/2026)

**Aggiornamento destinazione:** il clone è ora pubblicato nel deploy **8736**
(28/10/2026). Il numero 8731 sotto identifica la SORGENTE del cropper, non
il deploy di questa app. Stato verificato in `VERSIONE-8736.md`.

> **Nota della destinazione (Widget metacognitivo):** il testo seguente
> documenta la sorgente 8731, qui trapiantata senza cambiare CropDialog,
> hook viewport o geometria. Il deploy 8731 e i suoi risultati pubblici
> riguardano la SORGENTE, non una nuova pubblicazione di questa app.
> Qui il CSS è in `client/src/photo-crop.css` importato da `index.css`.
> Non sono stati importati ColorDialog, legenda latina o analizzatore.
> I test della destinazione usano `/espressione` e una risposta matematica
> simulata (`2+3`), non un testo latino.

## Contratto attuale

**Nel ritaglio, l'app dietro deve restare FERMA e il dito deve scorrere
DENTRO la finestra.** Questa indicazione sostituisce il vecchio pattern
26/10i–k, che richiedeva `modal={false}` anche per CropDialog e lasciava
scorrere la pagina sottostante. NON ripristinare quel comportamento.
Il ColorDialog delle parole non è stato modificato da questa correzione.

**Versione pubblicata: deploy 8731 del 28/10/2026.**
Commit runtime: `3a4159402cb0f674ca2e269007d4cfcefe86bedd`.
Nove scenari generali e quattro dedicati al drag ripetuti sul sito pubblico.
Titolo attuale **RITAGLIA LA FOTO**, senza istruzioni sotto e senza icona
centrale. Trascinamento DIRETTO dell'interno della selezione anche su touch;
scroll ancora possibile sui margini beige e nelle aree esterne al crop.

**RUOTA SINISTRA, RUOTA DESTRA, CHIUDI e RITAGLIA** sono i quattro figli
diretti di UN SOLO riquadro `data-crop-controls` (anche `data-crop-footer`),
con `role=group` ed etichetta ARIA. **AZZERA è stato rimosso**. Tutti marroni
`#a85b3c`, testo bianco, forma a pillola e testo compatto; target touch
minimo 44px. Flex-wrap centra ogni riga: una riga quando c'è spazio, due
sui telefoni; nessun bordo/separatore tra rotazioni e azioni. Altezza auto,
limite di larghezza al 50% meno gap e righe uniformi con align-items:stretch
per non sottrarre spazio alla foto. Nessuna modifica a confirm(), geometria,
viewport o blocco pagina. Per trasferire il sistema
in un'altra app usare `PHOTO-CROP-CLONABILE.md` (sorgenti incorporati).

## Cause riprodotte dal problema segnalato sul telefono

1. `modal={false}` disabilitava il blocco di Radix sulla pagina dietro.
2. Nei post del blog, `100dvh` significa l'altezza dell'IFRAME, anche quando
   è molto più alto dello schermo. Un test cross-origin a 393×780 mostrava
   un iframe alto 1576 px e una finestra alta oltre 1000 px: comandi fuori
   dallo schermo e quasi nessuno scroll interno.
3. Cinque pulsanti nel piedino fisso, con larghezza minima dettata dai testi,
   si impilavano e occupavano gran parte dello schermo.
4. La zona di spostamento del ritaglio, dopo il primo taglio, intercettava
   il gesto su tutta la selezione e impediva di scorrere toccando la foto.

## Implementazione

### 1. Lock della pagina e focus

- `CropDialog.tsx`: `<Dialog modal={true}>`, senza cambiare gli altri dialoghi.
- `useCropDialogViewport(open)` blocca body e html solo durante il ritaglio.
  Salva scrollX/Y e i valori/priorità degli stili modificati e li ripristina
  alla chiusura o allo smontaggio. Il lock usa body fixed con top negativo
  per conservare la posizione visiva anche su browser iOS.
- `position: fixed !important` è intenzionale: Radix/react-remove-scroll
  applica `position: relative !important` a body durante un modale. Senza
  questa priorità il lock aggiuntivo non è realmente fixed.
- Radix mantiene focus modale, Escape e chiusura. X e CHIUDI funzionano.

### 2. Viewport davvero visibile, anche nel blog

Il hook usa `visualViewport` nella vista autonoma e un elemento-sonda fixed
con `IntersectionObserver` nell'iframe. `intersectionRect` indica la parte
visibile nel viewport del blog anche cross-origin; `rootBounds` può essere
null e non viene usato. Nessun accesso al DOM esterno, nessun nuovo messaggio
postMessage, nessuna modifica necessaria al codice embed già incollato.

Il DialogContent riceve top/height reali e mantiene 8 px di margine. Non è
centrato sull'intera altezza dell'iframe. Alla rotazione o resize viene
ricalcolato anche l'ingrandimento di anteprima. Il bordo della foto viene
sottratto alla larghezza disponibile: l'immagine non si deforma.

**Limite del browser:** il lock riguarda l'app nell'iframe e i gesti iniziati
sul modale/overlay; non controlla il DOM di un blog cross-origin. Tocchi che
iniziano sul blog FUORI dall'iframe sono gestiti dal blog stesso.

### 3. Foto scorrevole, un solo riquadro comandi centrato

```tsx
<Dialog modal={true} open={open} onOpenChange={...}>
  <DialogContent className="lf-crop-dialog ..." style={viewportStyle}>
    <div data-crop-scroll className="lf-crop-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y">
      {/* solo titolo RITAGLIA LA FOTO e foto — nessuna istruzione */}
    </div>
    <div data-crop-footer data-crop-controls role="group" aria-label="Comandi per il ritaglio della foto" className="lf-crop-footer shrink-0 ...">
      {/* RUOTA SINISTRA, RUOTA DESTRA, CHIUDI, RITAGLIA: tutti centrati */}
    </div>
  </DialogContent>
</Dialog>
```

Le regole `.lf-crop-*` sono limitate al ritaglio in `index.css`: nessun
cambiamento ai pulsanti delle altre schermate. Altezza pulsanti automatica,
minimo touch 44 px, etichette che vanno a capo e safe-area inferiore.

### 4. Gesti distinti

- Margini beige, testata e zone della foto ESTERNE alla selezione:
  gesto verticale → scroll del corpo della finestra, quando c'è overflow.
- Bordi/angoli bianchi: `touch-none` → ridimensionamento, nessuno scroll.
- Interno della selezione: `pointer-events:auto;touch-action:none` per
  mouse E touch. Trascinamento diretto in ogni direzione, SENZA icona.
- Pointer capture sul contenitore STABILE della foto, non sulle maniglie
  che cambiano posizione. Un solo pointerId; ignorare gli altri puntatori;
  pointerup/pointercancel/lostpointercapture terminano la presa.
- Calcolare delta dall'ULTIMO evento e dal box risultante. Il vecchio
  calcolo dall'inizio accumulava un eccesso oltre i limiti: invertendo il
  dito il box restava fermo finché non veniva riassorbito (difetto riprodotto
  su produzione 8730 con mouse e touch). Non cambiare la geometria pura.
- Tastiera: frecce e Maiusc+frecce invariati, incluse maniglie.
- Foto piccole ingrandite solo a schermo, rispettando la larghezza utile.

### 5. Cornice stabile

`heightSync.ts` non invia nuove altezze quando `<html>` ha
`data-lf-crop-open`. Il body fixed non è la nuova altezza dell'app e non
deve far collassare la cornice! Dopo il ripristino degli stili, l'evento
`lf:crop-closed` richiede una nuova misura. Token, ping, soglie di tolleranza
e protezioni anti-loop restano invariati.

## Invarianti protetti

NON modificare `confirm()` per risolvere problemi di layout/scroll.
NON modificare `cropBox.ts`, `moveBox`, `resizeBox` o `resizeCorner`.
Il calcolo in percentuale e l'output PNG lossless (lato max 2200) restano
invariati. Nessuna modifica al riconoscimento IA causata dal ritaglio.
La revisione della legenda in questa versione è indipendente: il vecchio
verde dei sei altri modi è sostituito da OTHER_MOODS_COLOR in shared/types.ts.

## Collaudo ripetibile per gli sviluppatori

```bash
pnpm check
pnpm exec vitest run --no-file-parallelism
pnpm exec playwright install chromium
# Con pnpm dev già attivo su 3000, in un secondo terminale:
node tests/crop-mobile.e2e.mjs
node tests/crop-drag.e2e.mjs
```

Il test usa Chromium con touch emulato, incluso un blog di test cross-origin
(localhost e 127.0.0.1). L'eccezione LocalNetworkAccessChecks è SOLO nel
browser di test per permettere l'iframe loopback, non nel codice dell'app.

Nove scenari: 320×568, 393×780, orizzontale 740×360, blog stretto, blog normale,
blog già scorso, alto contrasto nel blog, cambio orientamento a finestra
aperta e desktop con tastiera. Verifica geometria visibile, swipe interno,
nessun trascinamento di app/blog dai gesti interni, blocco ai bordi, maniglie,
rotazione, stabilità della cornice, annullamento e ripristino stili/scroll.
Il canvas di RITAGLIA è eseguito davvero; SOLO la risposta OCR viene simulata:
nessun uso di servizi IA e nessuna affermazione sull'accuratezza OCR reale.

Il secondo test aggiunge quattro scenari dedicati: 320px, 393px, iframe
cross-origin già scorso e desktop/mouse. Verifica TUTTE le otto prese,
inversione, risposta immediata al minimo, movimento da un punto interno
non centrale in quattro direzioni, cattura stabile e cancel. Il test di
regressione FALLISCE sul difetto del limite nella base 8730 e passa nel fix.

Risultati e screenshot in `.cache/crop-mobile-qa/` (ignorata da git).
Superare questi test non equivale a un collaudo su un telefono fisico.
