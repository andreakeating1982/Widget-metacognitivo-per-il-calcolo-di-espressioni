# Collaudo PHOTO CROPPER 8731 — Widget metacognitivo

**Data:** 28/10/2026. **Stato aggiornato:** pubblicato con autorizzazione nel
**deploy 8736**, verificato sul sito pubblico. I risultati seguenti sono i
collaudi eseguiti prima della pubblicazione; dettagli in `VERSIONE-8736.md`.

## Fedeltà al documento allegato

Il nucleo è copiato byte per byte da
`CLONARE-PHOTO-CROPPER-AGGIORNATO-8731.md`, senza riscriverne UI,
geometria, rotazione o conferma. Import CSS e guardia/evento heightSync sono
le sole integrazioni strutturali. Il consumer foto continua a ricevere
un File e a trascrivere un pezzo, senza calcolare la soluzione.

| File | SHA-256 |
|---|---|
| `client/src/components/CropDialog.tsx` | `e2dffc70087006413bee0a6e6b12668af7f9258110ee4d389aeb98f09728d76c` |
| `client/src/hooks/useCropDialogViewport.ts` | `27d001e1b8cdf6945bb075f778fb6ea60a2eb6d07748087b11bb8fa910baba80` |
| `client/src/lib/cropBox.ts` | `89cf51024d1a24aabe68b7daf115af7c11e28e480130c8e3b7740ae25105e8b7` |
| `client/src/lib/cropBox.test.ts` | `5a8db110f03ec6e8bfdc7aa905d2e9c4e6c3fc30eaaa15a3962cad069b0c42a6` |
| `client/src/photo-crop.css` | `69b25e24ea94e188edf3a750d797c2a192d51c383bc01d9eb0560201340db84d` |

## Verifiche

- Typecheck finale: superato.
- Build finale: superata; fixture temporanea assente dal bundle.
- Test unitari: **738 superati**, **28 saltati**; 51 file superati e 28 saltati.
- Nessuna modifica a server, costruzione esercizi, validazione matematica,
  pre-processing OCR, pagine di svolgimento/PDF o dati del database.

| Batteria E2E | Scenari superati | Controlli |
|---|---:|---:|
| Fixture portabile | 6 | 72 |
| Pagina reale mobile/iframe | 9 | 210 |
| Drag mouse/touch | 4 | 143 |
| **Totale** | **19** | **425** |

Ulteriori **7 controlli** su foto piccole, nessuna deformazione,
chiusura X/Escape, riapertura dello stesso file, ripristino stili/scroll e
PNG grande limitato a 2200px. La fixture è rimossa da `client/src`; i
sorgenti per ripetere i test restano solo in `tests/fixtures/photo-crop`.

### Dettaglio scenari

- Fixture portabile: `mobile-320` — OK, 12 controlli.
- Fixture portabile: `mobile-393` — OK, 12 controlli.
- Fixture portabile: `landscape` — OK, 12 controlli.
- Fixture portabile: `blog-stretto` — OK, 12 controlli.
- Fixture portabile: `blog-scorso` — OK, 12 controlli.
- Fixture portabile: `desktop-tastiera` — OK, 12 controlli.
- Pagina reale mobile/iframe: `mobile-320` — OK, 23 controlli.
- Pagina reale mobile/iframe: `mobile-393` — OK, 23 controlli.
- Pagina reale mobile/iframe: `mobile-landscape` — OK, 23 controlli.
- Pagina reale mobile/iframe: `blog-320` — OK, 25 controlli.
- Pagina reale mobile/iframe: `blog-393` — OK, 25 controlli.
- Pagina reale mobile/iframe: `blog-scrolled` — OK, 25 controlli.
- Pagina reale mobile/iframe: `blog-high-contrast` — OK, 25 controlli.
- Pagina reale mobile/iframe: `mobile-orientation-change` — OK, 24 controlli.
- Pagina reale mobile/iframe: `desktop` — OK, 17 controlli.
- Drag mouse/touch: `touch-320` — OK, 36 controlli.
- Drag mouse/touch: `touch-393` — OK, 36 controlli.
- Drag mouse/touch: `iframe-touch` — OK, 36 controlli.
- Drag mouse/touch: `desktop-mouse` — OK, 35 controlli.

## Note sui test corretti

I primi run contenevano tre assunzioni non valide per questa destinazione:
route fixture non ricaricata nella cache Vite; risposta OCR latina invece
di un'espressione; ricerca di «Pezzi trascritti» nel testo visibile anziché
nell'aria-label reale. Il freeze iframe si misura dopo il lock (non durante
il caricamento iniziale). Corretti solo gli adattamenti della suite:
nessuna correzione al nucleo copiato è stata necessaria.

## Limiti e ripetibilità

I test touch usano Chromium emulato, non telefoni fisici. Le chiamate OCR
nella suite della pagina reale sono simulate: il PNG del canvas e il
passaggio al consumer sono reali. Nessuna chiamata IA a pagamento per il
collaudo. Un blog cross-origin simulato verifica layout, scroll e altezza:
non è un test effettuato direttamente sul blog pubblico del docente.

Istruzioni di ripetizione: `tests/PHOTO-CROP.md`. Per produrre una nuova
versione pubblica servono checkpoint e autorizzazione esplicita dell'utente.
