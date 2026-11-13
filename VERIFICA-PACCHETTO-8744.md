# Rapporto precedente del pacchetto 8744 (cronologia)

Questo documento descrive il pacchetto precedente al nuovo audit del
29/10/2026. Per il nuovo ZIP vedere `docs/VERIFICA-RIORDINO-2026-10-29.md`
e il rapporto JSON esterno specifico del file consegnato. Non usare il
vecchio checksum o conteggio come verifica del nuovo archivio.

# Verifica del pacchetto 8744

**Esito: ricostruzione riuscita da una nuova estrazione, senza chiavi di
produzione e senza database.** Questo ZIP sostituisce i pacchetti precedenti
(8736, 8737, 8742).

## Versione inclusa

App WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI, produzione **8744**.
URL: https://espressioni-monomi-polinomi.easy-peasy.site
Commit funzionale pubblicato: `a90d5972c9f46adbfbc24f994f30ab4e976f7957`.
Il manifest del pacchetto riporta il commit documentale finale e gli hash
individuali dei file. Il codice runtime non è stato modificato né ridistribuito
per questa richiesta di ZIP/skill.

Include TUTTE le versioni pubblicate: scorrimento interno della seconda
pagina (8737), header rifinito (8742) e, da foto mobile, **pezzi lunghi con
scorrimento DENTRO il box** (classe `piece-display`, niente più fuoriuscita
dai bordi su schermo stretto) con didascalia solo «SCRIVI QUI L'ESPRESSIONE»
in grassetto nero. Regola applicata anche ai box «Espressione trascritta» e
«Controlla prima di confermare». Specifica: `SECONDA-PAGINA-SCROLL.md`. Guide
di avvio/riuso: REBUILD, ADATTARE, RENDER, ACCESSIBILITA, AGENTS e FILOSOFIA-DSA.

## Ricostruzione effettivamente eseguita

Verificati via SHA-256 **324 file** della prima
estrazione. Installazione in cartella nuova, senza copiare node_modules,
.env, dist o file generati. Variabili API/DB rimosse dall'ambiente di prova.

| Passo | Esito | Tempo |
|---|---|---|
| corepack | riuscito | 0.14 s |
| install | riuscito | 5.75 s |
| check | riuscito | 10.93 s |
| unit | riuscito | 19.37 s |
| build | riuscito | 9.01 s |

**738 test unitari superati, 28 saltati** (fixture/banchi facoltativi).
Il server generato contiene chiave IA vuota, come atteso per uno ZIP sicuro.

**Tutti i 37 file di `dist/public` sono identici**
a quelli della build approvata della produzione 8744: nessun file mancante,
aggiunto o diverso (regola `piece-display` presente nel CSS del bundle).
JS e CSS sono stati anche scaricati nuovamente dal sito pubblico e
confrontati byte per byte prima di ricostruire:

- `/assets/index-BnuQEBUp.js`: `c68d11243554e58fb2c21bff0e3d7dd50f8948c7aba9f4e53be448636e2262db`.
- `/assets/index-D1FTbNg8.css`: `7699ceeb6be69e7f4524154b148e17564845da855e682538beabd96be09ebe43`.

Il bundle server senza chiave è intenzionalmente diverso da quello pubblico:
non si distribuisce un bundle contenente le credenziali di produzione.

## Smoke test Express locale isolato

- Pagina principale: HTTP **200**.
- Font OpenDyslexic: HTTP **200**.
- API IA senza chiave: HTTP **503**, atteso.
- COOP: `same-origin`; COEP: `require-corp`.
- Nessun database, sessione reale o operazione IA usata nel test.

Le funzioni IA richiedono la propria EASY_PEASY_API_KEY nell'ambiente
server/build. Non sono operative senza chiave; il pacchetto non contiene
quella della produzione. Senza DB cache e sessioni sono temporanee.

## Riordino 29/10/2026: pacchetto pronto per GitHub, clonazione e Render

Riordino **solo documentale**, runtime identico alla produzione 8744
(verifica ricostruzione del 28/10 restata valida; il client non è cambiato,
quindi i 37 file e i loro hash coincidono ancora con gli asset pubblicati).

- README con indice gerarchico (parti da qui, ricostruisci, clona/adatta,
  Render+accessibilità, dettagli tecnici, cronologia) e nota sul file
  ereditato `GUIDA-UNICA.html` (guida stampabile dell'app storica delle
  equazioni biquadratiche, conservata per riferimento, non caricata
  dall'app). Albero pulito confermato prima dell'export.
- Comandi di test uniformati in README/AGENTS/ADATTARE a
  `(cd client && pnpm exec vitest run)` (738 superati, 28 saltati): NON
  esiste uno script `pnpm test`. `pnpm dev` serve solo il frontend
  (niente `/api/*`): per provare le API, `pnpm build && pnpm start`.
- `ISTRUZIONI-GITHUB.txt` riscritta per QUESTA app (era rimasta quella del
  widget biquadratiche): stato 8744, varianti possibili, passi Render,
  comandi di verifica, struttura del progetto.
- `FILOSOFIA-DSA.md` aggiunta ai file obbligatori di `scripts/export-verified.py`.
- Ricostruzione pulita del 29/10 da nuova estrazione (325 file SHA-256,
  senza chiave né DB): corepack/install/check/Vitest/build riusciti,
  738 superati + 28 saltati, 37 file client identici, smoke Express
  root 200 e IA senza chiave 503 atteso. Il controllo finale dell'archivio
  vale su QUESTO zip: manifest SHA-256 per ciascun file, CRC superato,
  scansione credenziali superata senza stampare valori.

## Collaudo browser già completato prima del deploy 8744

- Layout scrollbar: **7 scenari /151 controlli**.
- Regressione cropper: **9 scenari /223 controlli**.
- Overflow con pezzo lunghissimo di prova: pagina senza fuoriuscita
  orizzontale, box con scorrimento interno, pulsanti ✎/✕ sempre visibili,
  didascalia in grassetto confermata (il clone MathML invisibile di KaTeX
  va ignorato nei controlli di contenimento).
- Rifiniture header verificate online (titolo/dati assenti, INDIETRO
  presente, didascalia corretta; HTTP 200, asset identici).

Touch e viewport emulati in Chromium; blog cross-origin simulato, OCR mock.
Non è una certificazione su telefoni fisici o sul blog pubblico dell'utente.

## Nota sulla propagazione del deploy 8744

Subito dopo il deploy il sito serviva ancora gli asset vecchi; ricontrollato
dopo attesa: HTTP 200 e asset identici alla build approvata, schermata online
conforme. Non dare per riuscita la verifica online alla prima risposta.

## Controllo dell'archivio definitivo

Dopo la ricostruzione sono stati aggiunti soltanto questo rapporto e le
spuntature della checklist; nessun sorgente o asset funzionale è variato.
Il controllo finale confronta tutti i payload con il manifest dell'estrazione
ricostruita e ammette soltanto queste variazioni documentali.

Archivio verificato con CRC e manifest SHA-256 per ciascun file. Escluse
credenziali, dati runtime/DB, .git, node_modules e dist; conservati ONNX,
WASM/Tesseract, font, PDF pubblico, test, fixture, lockfile e patches.
Il checksum dell'intero ZIP è in `SHA256SUMS.txt` allegato alla consegna.
