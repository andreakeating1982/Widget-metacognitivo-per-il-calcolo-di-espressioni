# 📷 TRAPIANTO-FOTO — Esportare il tool foto+ritaglio+IA su altre app

> **Guida per l'intelligenza artificiale** — procedura completa per trapiantare
> il sistema di acquisizione da foto di QUESTA app (scatto/caricamento →
> ritaglio free-box → trascrizione IA vision → soccorso OCR locale) su
> QUALUNQUE altra app didattica simile (stesso scaffold `web-db-user` o
> `web-static` + Express). Leggi tutto il documento prima di toccare il codice.

## 1. Cos'è il tool (filosofia invariata)

- L'IA **TRASCRIVE SOLO**: mai risolvere, calcolare o semplificare. Il testo
  riconosciuto finisce in un campo/panel che l'utente CONTROLLA prima di
  confermare (stessa regola della scrittura a mano).
- Se l'IA non risponde (503, timeout, foto illeggibile), il **soccorso OCR
  locale** (Tesseract.js) legge la stessa foto: il flusso non si interrompe mai.
- La foto passa SEMPRE dal **ritaglio 8731**: box libero, otto maniglie dentro
  la foto, trascinamento diretto dell'area selezionata senza icona centrale,
  rotazione ±90°, **RUOTA SINISTRA / RUOTA DESTRA / CHIUDI / RITAGLIA** in un
  unico riquadro centrato. Uscita **PNG lossless**, lato massimo 2200 px.
  La conversione JPEG q0.92 per l'IA avviene solo DOPO, in `fileToScaledDataUrl`.
- La finestra è modale: blocca la pagina sottostante e usa il viewport
  realmente visibile anche negli iframe. Vedi `SCROLLING-MOBILE.md`.
  Il precedente `modal={false}` per CropDialog è superato.

## 2. File da copiare (percorsi identici nell'app di destinazione)

| # | File | Ruolo | Adattamento |
|---|---|---|---|
| 1 | `client/src/lib/imagePrep.ts` | `normalizePhoto` (orientamento EXIF) + `enhanceForOcr` (grigi/contrasto per il soccorso) | **intatto** |
| 2 | `client/src/lib/cropBox.ts` | Geometria free-box (`MIN_BOX`, `moveBox`, `resizeBox`, `resizeCorner`, tipi `Box/Edge/Corner`) | **intatto** |
| 3 | `client/src/components/CropDialog.tsx` | Clone del componente allegato 8731: 8 maniglie 44px, pointer capture, drag diretto, tastiera, canvas → PNG | NON modificare `confirm()` né la geometria |
| 3a | `client/src/hooks/useCropDialogViewport.ts` | Lock/ripristino stili e scroll; visualViewport e IntersectionObserver per iframe cross-origin | copiare insieme al dialogo |
| 3b | `client/src/photo-crop.css` | Comandi compatti, centrati e a capo; regole limitate a `.lf-crop-*` | importare dopo Tailwind in index.css |
| 3c | `client/src/lib/heightSync.ts` | Sospende gli invii con `data-lf-crop-open`, rimisura dopo `lf:crop-closed` | integrare solo guardia/evento, conservare protocollo e token |
| 3d | `client/src/lib/cropBox.test.ts`, `tests/crop-*.e2e.mjs` | Geometria, mobile/iframe, mouse e touch | adattare route e risposta OCR al dominio matematico |
| 4 | `client/src/lib/aiTranscribe.ts` | `aiTranscribeImage(dataUrl, kind)` → `POST /api/ai/transcribe`; `fileToScaledDataUrl` (max lato 1800); `strokesToDataUrl`; `AiUnavailableError` | **intatto** (se serve solo la foto, `strokesToDataUrl` resta inutilizzato) |
| 5 | `client/src/lib/ocr.ts` | `ocrImage(file, onProgress)` — soccorso Tesseract self-hosted (`/tess`, `/tessdata`) | **intatto**; se l'app ha già un OCR, riusare il suo |
| 6 | `client/src/lib/exprOcr.ts` | `normalizeExpressionOcr` + `prettyExpression` (pulizia dominio matematico) | **SOSTITUIRE** col normalizzatore del dominio (es. `cleanOcrText` per il latino — vedi app Latino Facile) |
| 7 | `server/index.ts` (route `POST /api/ai/transcribe`) | IA vision (`AI_CONTRACT` + `AI_INTRO_PHOTO`/`AI_INTRO_INK`, modello `gemini-3-flash`, `max_tokens: 4000` — 300 TRONCAVA le espressioni lunghe a metà! — + regola «mai interrompere a metà, parentesi bilanciate», timeout 90 s) | **adattare `AI_CONTRACT`** al dominio (vedi §4) |
| 8 | `scripts/sync-env.mjs` | Genera `shared/env.generated.ts` con la PROPRIA chiave nel SOLO bundle server | copiare lo script; NON copiare il file generato dalla sorgente |
| 9 | Dipendenze | `tesseract.js`, `openai`, `sonner`, `lucide-react` (`Camera`, `Upload`), `Dialog` shadcn | aggiungere quelle mancanti con `pnpm add` |

## 3. Blocco JSX da trapiantare (seconda pagina)

Da `client/src/pages/EspressioniExercises.tsx` (≈ righe 315–500 logica,
≈ 1255–1330 JSX): stati `cameraInputRef/uploadInputRef/cropImage/fotoBusy/
fotoProgress/MAX_FOTO_BYTES`, `handleFotoFile` (controllo 18 MB + tipo
immagine → `normalizePhoto` → `URL.createObjectURL` → apre `CropDialog`),
`closeCrop`, `onCropConfirm` (via `onCropConfirmRef` per l'ordine delle
dichiarazioni: `fileToScaledDataUrl` → `aiTranscribeImage(..., "photo")` →
catch `AiUnavailableError` → `ocrImage` → normalizza → `addPiece`/`prettyPiece`
→ `toast.success`; errore → messaggio «foto più nitida, testo scuro su sfondo
chiaro»), pulsanti **SCATTA UNA FOTO DEL TESTO** (`capture="environment"`,
stile pieno) + **CARICA UNA FOTO** (stile bordino), riga guida «Inquadra…»,
percentuale `RICONOSCIMENTO IN CORSO…`, due `<input type="file">` nascosti,
`<CropDialog open onConfirm onClose>`.

**Punto di innesto**: l'app di destinazione decide cosa farne del testo
(`onConfirm(notazione)`): qui diventa UN PEZZO (`addPiece`); altrove può finire
in un campo, in un box, in una lista. Il blocco NON calcola mai nulla.

**Dettaglio d'ordine**: `onCropConfirm` usa `addPiece`/`prettyPiece` dichiarati
DOPO: usare il pattern `onCropConfirmRef` (ref assegnata dopo, `useCallback`
stabile sopra) oppure spostare le dichiarazioni prima.

## 4. Adattare `AI_CONTRACT` al dominio

Il contratto in `server/index.ts` ha 3 parti: formato d'uscita (una riga,
simboli ammessi), REGOLE ASSOLUTE (trascrivi soltanto; `?` se illeggibile;
niente LaTeX/markdown/spiegazioni; ignora testi estranei), intro
(`AI_INTRO_PHOTO` foto libro/quaderno, `AI_INTRO_INK` tratti digitali).
Per un nuovo dominio riscrivi SOLO il formato (es. latino: parole con macron,
punteggiatura conservata) e gli esempi; le REGOLE ASSOLUTE restano.

## 5. Passi del trapianto (ordine esatto)

1. Copia i file 1–6 e i test collegati nell'app di destinazione (stessi percorsi).
2. Aggiungi `pnpm add` per le dipendenze mancanti (file 9).
3. Aggiungi la route `POST /api/ai/transcribe` al server (file 7) con
   `AI_CONTRACT` adattato (§4) + `scripts/sync-env.mjs` (file 8); chiave nel
   `.env` (MAI su git), esegui lo script.
4. Innesta il blocco JSX (§3) con `onConfirm` verso il flusso di destinazione.
5. Se l'app va in iframe su Blogger: niente permessi extra per la foto
   (è un `<input type="file">`, non `getUserMedia`); per il MICROFONO invece
   serve `allow="microphone"` (vedi `ADATTARE.md` §F).
6. Verifica: `pnpm check` verde; in preview i pulsanti aprono fotocamera/file,
   il ritaglio si apre/rotola/conferma; in produzione `POST
   /api/ai/transcribe {image, kind:"photo"}` → `{text}` HTTP 200; senza chiave
   → 503 + soccorso locale funzionante.

## 6. Cosa NON trapiantare

Il motore (`espressioni.ts`), i box di svolgimento, `costruisci.ts` (prompt/
verifica/cache/sessioni — quelli stanno in `ADATTARE-EQUAZIONI.md` §2 se
servono), il PDF, la logica pezzi oltre `addPiece`/`prettyPiece`.

## 7. Checklist finale

- [ ] Ritaglio: clone 8731, box libero, 8 maniglie dentro la foto, rotazione, RITAGLIA → PNG.
- [ ] Viewport/lock: pagina dietro ferma, scroll interno, comandi visibili anche nel blog.
- [ ] Cornice: nessun invio heightSync durante il lock, ripristino alla chiusura.
- [ ] IA trascrive SOLO (nessun calcolo nel contratto né nel flusso).
- [ ] Soccorso OCR locale attivo senza chiave IA.
- [ ] Testo destinazione controllabile dall'utente prima della conferma.
- [ ] `pnpm check` + `pnpm build` verdi; prova reale con foto di libro/quaderno.
- [ ] Chiave IA solo lato server (`grep` nel `dist/public` = 0 occorrenze).
