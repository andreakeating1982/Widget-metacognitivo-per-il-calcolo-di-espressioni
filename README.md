# WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI

App didattica accessibile per trascrivere un’espressione e svolgerla con
passi guidati. **Ogni risultato viene inserito dallo studente: mai anticipare
la soluzione, neanche nei suggerimenti scritti o nella lettura vocale.**

**Baseline corrente:** produzione Easy-Peasy **8756**, 29/10/2026.
**Pacchetto:** sorgenti aggiornati alla8756 per GitHub / clonazione / Render.
L'aggiornamento dello ZIP allinea guide e strumenti di verifica alla versione
già pubblicata, senza cambiare UI, motore, API o asset runtime approvati.
**Aggiornamenti pubblicati in produzione8756 (29/10):** seconda pagina con
**640px** di altezza predefinita come la cornice dedicata di Latino Facile;
terza pagina **adattiva al contenuto, fino a640px**. Entrambe conservano
lo scorrimento interno e, fuori dall'iframe, seguono anche il viewport e
la tastiera. Cropper, calcoli e PDF invariati. Pubblicazione autorizzata
e verificata; questo ZIP sostituisce il precedente pacchetto8744. Vedere
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
| Capire lo stato approvato, JS/CSS e invarianti | [VERSIONE-8756.md](VERSIONE-8756.md) |
| Lavorare come agente IA | [AGENTS.md](AGENTS.md) |
| Creare una nuova app simile senza alterare questa | [ADATTARE.md](ADATTARE.md) |
| Pubblicare tramite GitHub → Render | [RENDER.md](RENDER.md) e [render.yaml](render.yaml) |
| Riutilizzare accessibilità e filosofia didattica | [ACCESSIBILITA.md](ACCESSIBILITA.md), [FILOSOFIA-DSA.md](FILOSOFIA-DSA.md) |
| Controllare/ricostruire lo ZIP ricevuto | [docs/PACCHETTO-ESPORTABILE.md](docs/PACCHETTO-ESPORTABILE.md) |
| Vedere esiti e limiti dell'archivio ricevuto | Rapporto e checksum8756 consegnati esternamente allo ZIP, senza riferimenti circolari |
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
`pnpm dev` avvia **solo Vite**, senza `/api/*`: per le API usare Express
con `pnpm build && pnpm start`.

### IA, chiavi e dati

- Il build funziona anche senza chiave e senza database. In questa modalità
  UI, canvas e cropper sono disponibili; le rotte IA rispondono **503**.
  La costruzione IA dell’esercizio non è utilizzabile senza configurazione.
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
5. **PDF:** svolgimento realmente effettuato, anche parziale, con i dati
   studente. Non esportare il vecchio esercizio predefinito al suo posto.

### Invarianti della seconda pagina

- Contenitore ad altezza limitata e scorrimento **interno**; toolbar fuori
  dallo scroll. Produzione8756 corrente **640px**; produzione8744 precedente
  820/720px. Nessun loop di altezza dell’iframe.
- Header senza titolo/dati studente, piccolo pulsante marrone **INDIETRO**.
  Titolo e dati restano in prima pagina e nel PDF.
- Didascalia esatta **SCRIVI QUI L’ESPRESSIONE**, in grassetto scuro.
- Ogni resa KaTeX lunga sta in `piece-display`: scorrimento interno, non
  fuoriuscita dai bordi. Non ridurre il testo per farla entrare.
- Cropper: `modal={true}`, otto maniglie, drag diretto, quattro comandi
  marroni. Copiare insieme componente, hook viewport, CSS e heightSync.

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

