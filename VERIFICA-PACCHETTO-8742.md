# Verifica del pacchetto 8742

**Esito: ricostruzione riuscita da una nuova estrazione, senza chiavi di
produzione e senza database.** Questo ZIP sostituisce i pacchetti precedenti
(8736, 8737).

## Versione inclusa

App WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI, produzione **8742**.
URL: https://espressioni-monomi-polinomi.easy-peasy.site
Commit funzionale pubblicato: `f7531736680fc9b1d3b1fa1cc79a4f5228418a6b`.
Il manifest del pacchetto riporta il commit documentale finale e gli hash
individuali dei file. Il codice runtime non è stato modificato né ridistribuito
per questa richiesta di ZIP/skill.

Include TUTTE le versioni pubblicate: scorrimento interno della seconda
pagina (8737) e rifiniture dell'header (8742) — titolo dell'app e riga dati
studente rimossi dalla pagina 2 (restano in prima pagina e nel PDF), piccolo
pulsante marrone INDIETRO con aria-label, didascalia «SCRIVI QUI
L'ESPRESSIONE IN UNO O PIU' PEZZI.». Specifica tecnica:
`SECONDA-PAGINA-SCROLL.md`. Guide di avvio/riuso: REBUILD, ADATTARE,
RENDER, ACCESSIBILITA, AGENTS e FILOSOFIA-DSA.

## Ricostruzione effettivamente eseguita

Verificati via SHA-256 **322 file** della prima
estrazione. Installazione in cartella nuova, senza copiare node_modules,
.env, dist o file generati. Variabili API/DB rimosse dall'ambiente di prova.

| Passo | Esito | Tempo |
|---|---|---|
| corepack | riuscito | 0.12 s |
| install | riuscito | 5.25 s |
| check | riuscito | 10.37 s |
| unit | riuscito | 19.39 s |
| build | riuscito | 8.75 s |

**738 test unitari superati, 28 saltati** (fixture/banchi facoltativi).
Il server generato contiene chiave IA vuota, come atteso per uno ZIP sicuro.

**Tutti i 37 file di `dist/public` sono identici**
a quelli della build approvata della produzione 8742: nessun file mancante,
aggiunto o diverso. JS e CSS sono stati anche scaricati nuovamente dal sito
pubblico e confrontati byte per byte prima di ricostruire:

- `/assets/index-9ZFZAM8U.js`: `5495761b57ca48c394010656499bb1639fa85fb97f9d430e941b9bf29e3f7a2d`.
- `/assets/index-BC87wU0f.css`: `ef5e84996df581bc7c4777eeddbf57848756743457ec9c463d103cf1712f0115`.

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

## Collaudo browser già completato prima del deploy 8742

- Layout scrollbar: **7 scenari /151 controlli**.
- Regressione cropper: **9 scenari /223 controlli**.
- Rifiniture header verificate online dopo il deploy (titolo/dati assenti,
  INDIETRO presente, didascalia corretta; HTTP 200, asset identici).

Touch e viewport emulati in Chromium; blog cross-origin simulato, OCR mock.
Non è una certificazione su telefoni fisici o sul blog pubblico dell'utente.
Le due suite vanno eseguite in sequenza, attendendo gli autoscroll.
Risultati: tests/input-scroll-results.json.

## Nota sui deploy

I primi due tentativi del deploy di produzione (8739, 8741) sono falliti per
indisponibilità temporanea del servizio («14 UNAVAILABLE»); il terzo (8742)
è riuscito ed è stato verificato online prima di dichiararlo completato.

## Controllo dell'archivio definitivo

Dopo la ricostruzione sono stati aggiunti soltanto questo rapporto e le
spuntature della checklist; nessun sorgente o asset funzionale è variato.
Il controllo finale confronta tutti i payload con il manifest dell'estrazione
ricostruita e ammette soltanto queste variazioni documentali.

Archivio verificato con CRC e manifest SHA-256 per ciascun file. Escluse
credenziali, dati runtime/DB, .git, node_modules e dist; conservati ONNX,
WASM/Tesseract, font, PDF pubblico, test, fixture, lockfile e patches.
Il checksum dell'intero ZIP è in `SHA256SUMS.txt` allegato alla consegna.
