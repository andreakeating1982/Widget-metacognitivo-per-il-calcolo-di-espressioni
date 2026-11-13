# WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI

App didattica accessibile per trascrivere un’espressione e svolgerla con
passi guidati. **Ogni risultato viene inserito dallo studente.** Su richiesta
esplicita dell'utente è disponibile in ogni box il pulsante MOSTRA SOLUZIONE:
la risposta del solo box resta nascosta finché il pulsante non viene premuto,
appare in formato calcolatrice su una riga e può essere nuovamente nascosta.
L'app non la inserisce automaticamente; suggerimenti e lettura vocale non la
anticipano.

**Produzione corrente:** deploy Easy-Peasy **9213**, pubblicato con consenso
esplicito il 13/11/2026 (ora italiana); checkpoint funzionale `95eaed5`.
La 9213 migliora la lettura ad alta voce (ASCOLTO): legge formule, decimali,
periodici, pulsanti e campi visibili, mai le risposte nascoste, e si arresta
al cambio pagina o quando la soluzione viene nascosta. Le scritture senza
valore assoluto sono valide solo con le **condizioni aggiuntive** indicate,
distinte dalle C.E.; gli altri casi non sono svolti. MOSTRA SOLUZIONE resta
facoltativa e il PDF conserva le condizioni. Dettagli, verifiche e limiti:
[DEPLOY-9213.md](docs/DEPLOY-9213.md). La 9212 è la baseline funzionale
precedente (condizioni di segno) e la 9197 è storica.
La produzione **9162** (pulsante MOSTRA SOLUZIONE: la risposta del solo box
si vede solo su richiesta, si può nascondere e non viene mai inserita
automaticamente) e la **9148** (razionalizzazione guidata) sono precedenti.

Il deploy **9097** del 9/11/2026, checkpoint `068b912`, è una baseline più vecchia.
Radicali ad INDICI DIVERSI: motore esteso a radici di INDICE QUALUNQUE
(da 2 a 99, anche negativi), comandi tastiera `rad5`, `rad13`, `rad45`…
(a due cifre finché scritti senza spazi; «rad2 9» resta √9) e costruzione
deterministica STESSO INDICE (m.c.m. degli indici, radicando alizzato alla
potenza che manca). Somme di fratte GENERICHE senza IA: N addendi (fino a 6),
numeratori polinomiali, addendi interi, prodotto e quoziente di due frazioni;
il box extra di semplificazione della radice al denominatore è garantito in
codice (radice come fattore in qualunque posizione). CONDIZIONI DI ESISTENZA
(12/11): il motore tenta di costruire una sezione C.E. esatta in testa alle
espressioni fratte supportate — un box per ogni denominatore originale distinto («(x+1) ≠ 0 → x ≠ -1»), radici di grado 1 e 2
(quadrato perfetto) e fattore x^k; se l'elenco completo non è garantito
(grado > 2, radici irrazionali, esponenti negativi) il denominatore non
produce box, mai una C.E. incompleta. I box C.E. non toccano le righe
progressive e sopravvivono ai ricaricamenti dall'archivio; la risposta del
PDF parziale compare solo quando lo studente l'ha calcolata. Restano
preservati periodici, parentesi dei radicali e puntino; la trascrizione OCR
va sempre controllata; ogni risposta deve inserirla lo studente. Verifiche
e limiti: [deploy 9097](docs/DEPLOY-9097.md). Le release precedenti sono
cronologia.
Vedere [deploy 9055](docs/DEPLOY-9055.md), [deploy 9052](docs/DEPLOY-9052.md), [deploy 9038](docs/DEPLOY-9038.md), [deploy 9033](docs/DEPLOY-9033.md),
[deploy 9029](docs/DEPLOY-9029.md), [deploy 9019](docs/DEPLOY-9019.md) e
[feedback e prodotti notevoli](docs/FEEDBACK-PRODOTTI-ANTEPRIMA.md).

**PDF pubblicato:** subito dopo i dati dello studente riporta lo stesso
conteggio delle risposte giuste al primo colpo mostrato nel feedback. I dati
stanno su una riga quando lo spazio lo consente e vanno a capo senza tagli
se sono lunghi. Verifiche e limiti: [collaudo PDF](docs/COLLAUDO-PDF-PRIMO-COLPO-ANTEPRIMA.md).

**Modifica pubblicata nella 9033:** l'indicazione sulla scrittura frazionaria
è parte del testo normale, senza riquadro; sono verificate le parentesi tonde,
quadre e graffe, anche annidate. Dettagli e limiti in
[istruzioni e parentesi](docs/ISTRUZIONI-FRAZIONE-ANTEPRIMA-2026-11-07.md).
Lo ZIP della 9029 è storico e non include la modifica 9033.

**Correzione pubblicata nella 9038:** alcune somme e differenze di frazioni
letterali, incluso il caso fotografato con fattore esterno, seguono un percorso
guidato verificato; le formule lunghe scorrono nel box. Ambito, verifiche e
limiti in [collaudo fratte](docs/COLLAUDO-FRATTE-FATTORE-ESTERNO-ANTEPRIMA.md)
e [test fratte](tests/FRATTE-FOTO.md). Le prove browser usano API simulate;
il servizio IA live non è stato verificato.

La produzione 8999 è la baseline precedente: correzioni matematiche e di
sessione, comandi adattivi del ritaglio e pulsanti chiari della cornice.
Vedere [VERSIONE-8999](VERSIONE-8999.md), [deploy 8999](docs/DEPLOY-8999.md),
[collaudo esteso](docs/COLLAUDO-ESPRESSIONI-2026-11-07.md) e
[collaudo pulsanti](docs/COLLAUDO-PULSANTI-2026-11-07.md). Il post Blogger
non cambia automaticamente e lo ZIP precedente 8999 non include il rilascio
9019. Anche la produzione8756 resta cronologia.

**Cornice del blog:** su indicazione dell'utente, `cornice-dinamica/
embed-espressioni-dedicata.html` è stata allineata alla cornice già presente
nel post MATEMATICA il 7/11/2026. Lo snippet è identico al feed pubblico
(SHA-256 `d7cd547a6f0ba53815a12dd0adcc16276cf02b3a91a16a74b46d8cbcf1968a4c`).
Non è stato modificato o ripubblicato il post. Per lo ZIP consegnato sulla
base 9019 gli asset JS/CSS erano identici alla produzione 9019 e cambiava
solo l'HTML di prova `anteprima-cornice.html`; la successiva modifica PDF
pubblicata nella 9029 cambia il client e non è compresa nel vecchio ZIP.
Dettagli della fonte e dei test: [cornice sul blog](docs/CORNICE-BLOG-2026-11-07.md).

**Base di layout introdotta in produzione8756 (29/10):** seconda pagina con
**640px** di altezza predefinita come la cornice dedicata di Latino Facile;
terza pagina **adattiva al contenuto, fino a640px**. Entrambe conservano
lo scorrimento interno e, fuori dall'iframe, seguono anche il viewport e
la tastiera. Tali limiti di layout restano validi anche nella 9019; le
successive correzioni sono descritte nelle guide correnti. Vedere
[rilascio8756](docs/DEPLOY-8756.md),
[seconda pagina](docs/ALTEZZA-COMPATTA-PREVIEW.md) e
[terza pagina](docs/TERZA-PAGINA-ADATTIVA.md).

Nome storico del repository: `espressioni-monomi-polinomi`.
Il nome npm ereditato `espressione-frazioni-potenze` è intenzionalmente
conservato con il suo lockfile: non indica un altro pacchetto da installare.

## Parti da qui

| Obiettivo | Guida autorevole |
|---|---|
| Avviare la stessa app da ZIP o GitHub | [REBUILD.md](REBUILD.md) |
| Stato attuale e invarianti | Produzione 9213: lettura accessibile di formule e pulsanti, condizioni di segno aggiuntive, C.E., PDF e limiti; [DEPLOY-9213.md](docs/DEPLOY-9213.md) |
| Lavorare come agente IA | [AGENTS.md](AGENTS.md) |
| Creare una nuova app simile senza alterare questa | [ADATTARE.md](ADATTARE.md) |
| **Clonare completamente e sviluppare varianti per equazioni** | [GUIDA-IA-CLONAZIONE-EQUAZIONI.md](GUIDA-IA-CLONAZIONE-EQUAZIONI.md) e `scripts/clona-app-equazioni.py` |
| Pubblicare tramite GitHub → Render | [RENDER.md](RENDER.md) e [render.yaml](render.yaml) |
| Riutilizzare accessibilità e filosofia didattica | [ACCESSIBILITA.md](ACCESSIBILITA.md), [FILOSOFIA-DSA.md](FILOSOFIA-DSA.md) |
| Controllare/ricostruire lo ZIP ricevuto | [docs/PACCHETTO-ESPORTABILE.md](docs/PACCHETTO-ESPORTABILE.md) |
| Collaudare feedback, prodotti notevoli e PDF con dati fittizi | [tests/FEEDBACK-PRODOTTI.md](tests/FEEDBACK-PRODOTTI.md) e [collaudo PDF](docs/COLLAUDO-PDF-PRIMO-COLPO-ANTEPRIMA.md) |
| Vedere esiti e limiti dell'archivio ricevuto | Rapporto e checksum del nuovo ZIP, consegnati esternamente senza riferimenti circolari |
| Consultare l'audit precedente (storico8744) | [docs/VERIFICA-RIORDINO-2026-10-29.md](docs/VERIFICA-RIORDINO-2026-10-29.md) |

## Avvio rapido — Node 22

Entrare nella cartella che contiene `package.json`, non nella cartella
esterna creata dall’estrazione dello ZIP.

```sh
corepack enable
pnpm install --frozen-lockfile --prod=false
pnpm check
(cd client && pnpm exec vitest run)
pnpm build
pnpm start
```

Aprire `http://localhost:3000`. Conflitto di porta: `PORT=3100 pnpm start`.
Non esiste uno script `pnpm test`; il comando reale è quello sopra.
`pnpm dev` compila e avvia **Express con le API**, come nell'anteprima;
per applicare nuove modifiche al sorgente occorre riavviarlo. Per il solo
frontend con aggiornamento Vite usare `pnpm dev:client`: questa modalità
non fornisce le API e va usata con fixture simulate nei test. L'anteprima e
la produzione possono condividere il database: non usare dati reali per i
test automatizzati e non eseguire script di pulizia o ripristino.

### IA, chiavi e dati

- Il build funziona anche senza chiave e senza database. UI, canvas e cropper
  sono disponibili; le funzioni che chiamano l'IA rispondono **503**. Alcune
  costruzioni supportate dal motore deterministico funzionano senza IA;
  negli altri casi la costruzione richiede la configurazione della chiave.
- Per attivare le funzioni IA impostare la propria `EASY_PEASY_API_KEY`
  nell’ambiente **server** (su Render: Environment). Non usare `VITE_*`.
  Il build genera `shared/env.generated.ts`; non copiarlo da un’altra app.
- Per uso locale è disponibile [.env.example](.env.example), con valori
  sensibili vuoti. `.env`, `shared/env.generated.ts` e `dist/index.js`
  non devono essere pubblicati né condivisi.
- `DATABASE_URL` è facoltativa. Senza DB, cache/sessioni usano `/tmp` e
  non hanno persistenza garantita tra riavvii o istanze. Non usare i dati
  di produzione per ricostruire o collaudare questo pacchetto.

## Flusso attuale

1. **Dati studente:** Cognome, Nome, Classe, Data.
2. **Trascrizione:** mano, audio/tastiera o foto; più pezzi, senza il vecchio
   limite di elementi. L’utente controlla la trascrizione.
3. **Foto:** SCATTA/CARICA → normalizzazione → cropper 8731 modale → PNG
   → trascrizione IA/OCR, senza eseguire le operazioni fotografate.
4. **COSTRUISCI L’ESERCIZIO CON L’IA:** terza pagina con sessione `sid`,
   box progressivi, risultati inseriti dall’utente e verifica deterministica.
5. **Feedback e PDF:** completati tutti i box, «CONTINUA» apre il feedback
   con messaggio commisurato alle stelle; il PDF è disponibile soltanto lì
   e contiene lo svolgimento effettivo e i dati studente, non l'esercizio
   predefinito. Il PDF pubblicato riporta sotto i dati anche il conteggio
   al primo colpo. Il feedback non ripete il risultato finale.

### Invarianti della seconda pagina

- Contenitore ad altezza limitata e scorrimento **interno**; toolbar fuori
  dallo scroll. Il limite **640px**, introdotto prima della 8999, resta in
  produzioni9019 e9029; produzione8744 precedente
  820/720px. Nessun loop di altezza dell’iframe.
- Header senza titolo/dati studente, piccolo pulsante marrone **INDIETRO**.
  Titolo e dati restano in prima pagina e nel PDF.
- Didascalia esatta **SCRIVI QUI L’ESPRESSIONE**, in grassetto scuro.
- Ogni resa KaTeX lunga sta in `piece-display`: scorrimento interno, non
  fuoriuscita dai bordi. Non ridurre il testo per farla entrare.
- Cropper: `modal={true}`, otto maniglie, drag diretto, quattro comandi
  marroni. Il footer adatta le righe quando il font viene ingrandito, senza
  ridurre il testo o far uscire icone e parole. Copiare insieme componente,
  hook viewport, CSS e heightSync.
- Cornice Blogger: `/anteprima-cornice.html` mostra nell'ambiente corrente
  i pulsanti chiari nello stile della foto, con icone scure complete. Il build
  la genera dal file dedicato in `cornice-dinamica/`. Il codice già incollato
  nel post non cambia da solo.

Dettagli: [SECONDA-PAGINA-SCROLL.md](SECONDA-PAGINA-SCROLL.md),
[TRAPIANTO-FOTO.md](TRAPIANTO-FOTO.md),
[COLLAUDO-PHOTO-CROP-8731.md](COLLAUDO-PHOTO-CROP-8731.md).

### Invarianti della terza pagina

- `/esercizio` usa `expr-exercise-frame` con altezza naturale fino a640px;
  la regione `expr-exercise-scroll` scorre internamente e ha nome ARIA,
  `tabIndex=0` e focus visibile. Toolbar esterna allo scroll.
- Usare `flex:0 1 auto` e `min-height:0`: il contenuto breve non collassa;
  quello lungo scorre senza ridurre i caratteri. Prima pagina non limitata.
- Non rinominare la regione in `expr-exercise-page`: quel selettore storico
  attiverebbe altre regole tipografiche. Non duplicare heightSync.
- In stampa rimuovere limiti/overflow del wrapper. Il PDF dello svolgimento
  resta generato dal documento separato già esistente.
- Test sintetici della stessa versione:7scenari/168controlli pagina3,
  più7/151 per la regressione pagina2/cropper; non sono prove su telefoni fisici.

Dettagli: [docs/TERZA-PAGINA-ADATTIVA.md](docs/TERZA-PAGINA-ADATTIVA.md),
[tests/EXERCISE-SCROLL.md](tests/EXERCISE-SCROLL.md).

## Struttura del repository

```text
client/                      React/TypeScript/Tailwind, input e svolgimento
  public/                    font, ONNX, WASM, Tesseract, quaderno pubblico
  src/pages/WelcomePage.tsx   prima pagina e dati studente
  src/pages/EspressioniExercises.tsx   seconda pagina /espressione
  src/pages/EsercizioFrazioni.tsx     terza pagina /esercizio e PDF attuale
server/                      Express, API IA, sessioni/cache facoltative
shared/                      contratti e costanti (escluso env.generated.ts)
patches/                     patch dipendenze necessarie al lockfile
scripts/                     build env, export e verifica portabile
  export-verified.py          export da Git pulito + scansione credenziali
  verify-package.py           manifest / ricostruzione / smoke test isolati
tests/                       E2E e fixture sintetiche, non route runtime
  test_export_tools.py       test Python degli strumenti di packaging
cornice-dinamica/            embed Blogger dedicato, lite e universale
docs/                        guida del pacchetto, audit, documenti storici
.github/workflows/ci.yml      install → tipi → Vitest → build → artifact CLIENT
render.yaml                  Blueprint Web Service Node/Express
pnpm-lock.yaml               installazione riproducibile (non rigenerare)
```

Lo ZIP aggiunge `MANIFEST-SHA256.json` con commit sorgente, esclusioni,
numero di payload, dimensioni e hash. Il manifest non elenca se stesso.
Non sono inclusi credenziali, database/sessioni, `.git`, `node_modules`,
`dist` né diagnostici standalone identificati.

## Render e GitHub

Caricare il **contenuto della cartella dell’app** nella root del repository,
comprese `.github`, `.gitignore`, `.env.example` e `patches`.
Non caricare soltanto lo ZIP e non annidare involontariamente un’altra
cartella prima di `package.json` / `render.yaml`.

Usare un **Web Service Node**, non uno Static Site. Il Blueprint installa
anche le dipendenze di sviluppo necessarie al build con `--prod=false`,
esegue il type-check e avvia Express sulla porta assegnata da Render.
La chiave IA va inserita personalmente; persistenza e ambiente richiedono
la propria configurazione. Questa consegna **non crea** repository né servizi.

La CI usa la stessa directory Vitest documentata (`client`) e conserva
come artifact soltanto `dist/public`, **mai il bundle server con fallback
credenziali**. La CI e l’autodeploy Render non sono automaticamente un gate:
leggere [RENDER.md](RENDER.md) prima di abilitare aggiornamenti automatici.

## Clonazione e componenti riusabili

In [ADATTARE.md](ADATTARE.md) sono separati clone identico, variante di
contenuti/lingua, nuova matematica e trapianto di componenti. Non basta
cambiare il titolo per supportare equazioni generiche, disequazioni o quiz.

- [ADATTARE-EQUAZIONI.md](ADATTARE-EQUAZIONI.md): specifica per una nuova
  variante equazioni, con validazione deterministica e test dedicati.
- [ESPORTA-PAGINE-1-2-EQUAZIONI.md](ESPORTA-PAGINE-1-2-EQUAZIONI.md): riuso
  delle pagine input e accessibilità, con i contratti di layout8756.
- [TRAPIANTO-FOTO.md](TRAPIANTO-FOTO.md): tool foto completo.
- [IMPLEMENTAZIONE-IA.md](IMPLEMENTAZIONE-IA.md), [GUIDA-IA.md](GUIDA-IA.md):
  dettagli e note tecniche storiche; le istruzioni correnti hanno precedenza.

## Embed e accessibilità

Per Blogger usare [cornice-dinamica/embed-espressioni-dedicata.html](cornice-dinamica/embed-espressioni-dedicata.html).
Cambiare `APP_URL` solo dopo avere verificato il nuovo URL di destinazione.
Conservare token, filtro `event.source`, anti-loop e `allow="microphone"`.
Guida: [cornice-dinamica/README.md](cornice-dinamica/README.md).

**Sezione ACCESSIBILITÀ ben segnalata:** [ACCESSIBILITA.md](ACCESSIBILITA.md).
OpenDyslexic auto-ospitato, barra regolazioni, TTS, focus, ARIA, contrasto,
righello e PDF restano invariati nei cloni. La notazione KaTeX conserva
il proprio font matematico. Non è una certificazione WCAG o PDF/UA.

## Stato pubblicato e archivio

Sito della baseline: `https://espressioni-monomi-polinomi.easy-peasy.site`.
Nessun nuovo deploy è autorizzato dalla richiesta di questo ZIP.

Le versioni 8736 / 8737 / 8742 / 8744 e i relativi rapporti restano alla radice
come **cronologia**, non certificano il nuovo archivio.
Il precedente README completo è conservato in
[docs/storico/README-prima-riordino-2026-10-29.md](docs/storico/README-prima-riordino-2026-10-29.md);
contiene flussi superati e titoli storici, da non ripristinare.
`GUIDA-UNICA.html` resta conservata come guida ereditata delle biquadratiche:
non è caricata dall’app e non descrive il flusso attuale.

Licenza dichiarata nel package: MIT. Per redistribuzione controllare
anche le licenze dei singoli font, modelli e dipendenze.

