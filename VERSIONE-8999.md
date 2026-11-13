# Versione pubblicata 8999 — Widget Metacognitivo

## Identità e precedenza

- Pubblicazione autorizzata il **7 novembre 2026**, dopo anteprima condivisa.
- App: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**.
- Indirizzo: https://espressioni-monomi-polinomi.easy-peasy.site/
- Servizio: https://deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app/
- Sorgenti runtime pubblicati: checkpoint
  `d03a73df1ead94fd0eba82ae3bac2e7cf2ec484e`.
- `MANIFEST-SHA256.json` identifica il commit delle sorgenti esportate. Il
  commit del pacchetto può essere successivo, con sole guide e strumenti
  di verifica aggiornati dopo la pubblicazione: non equivale a un nuovo deploy.

`VERSIONE-8756.md` e le sue guide datate restano **storici**. Questa versione
è quella da ricostruire; non ripristinare gli asset o le affermazioni della
8756 come se fossero correnti.

## Asset pubblicati e controllati

| File | SHA-256 |
|---|---|
| `assets/index-6REOV0_r.js` | `b9bce11d3ff22bc35ad96e86d68bd5743a304ffa77f1f5b9d4f0694b5e4ee81b` |
| `assets/index-DpITYsgm.css` | `5784c87fc48d3a31ec207134d0f6203b5f68e0b58e70548514561cc2ac70c185` |

Gli asset su entrambi gli indirizzi pubblici coincidono con la build approvata.
Confrontare anche tutti i file `dist/public` quando la baseline locale è
accessibile. Non distribuire `dist/index.js` né `shared/env.generated.ts`:
il bundle server può contenere credenziali.

## Funzioni e invarianti

- Pagina 2 a 640px e pagina 3 ad altezza naturale fino a 640px, con toolbar
  esterna e scroll interno. Regione pagina 3 `expr-exercise-scroll`, non il
  selettore storico `expr-exercise-page`. Primo schermo senza limite compatto.
- Il cropper 8731 resta modale con otto maniglie, drag, rotazione e PNG;
  `photo-crop.css` adatta i quattro comandi anche al testo ingrandito, senza
  restringere il font. Non modificare `confirm()` o `cropBox.ts` per il layout.
- La cornice dedicata ha pulsanti avorio chiaro con bordo sottile e icone
  scure complete da 16px, etichette visibili, focus e area tattile estesa.
  Il suo protocollo `labvisivo:height`, il token e i filtri restano invariati.
- La trascrizione di foto/audio non calcola. Ogni risultato lo inserisce lo
  studente: **mai anticipare la soluzione**, anche in testi o lettura vocale.
  Non reintrodurre i suggerimenti verdi rimossi o l'avviso permanente sulla
  frazione impilata. Usare il puntino per la moltiplicazione.
- Validazione e passaggi gestiscono i casi matematici verificati; per frazioni
  complesse in tastiera delimitare numeratore e denominatore con parentesi.
  Non affermare che qualsiasi espressione o forma equivalente sia supportata.
- PDF dello svolgimento effettivamente inserito, sessioni personali `sid`,
  frazioni impilate e parentesi conservate. Limiti in `FILOSOFIA-DSA.md` e
  `docs/COLLAUDO-ESPRESSIONI-2026-11-07.md`.

## Esiti e limiti

Suite sorgente: **886 test client passati, 28 saltati; 16 test server passati**
con IA e archivi simulati. Type-check/build, controlli matematici e collaudi
browser precedenti sono documentati nei rapporti in `docs/`. La cornice di
produzione è stata verificata su desktop e mobile emulato; la richiesta API
vuota restituisce 400 senza chiamare il modello. Non sono prove su telefoni
fisici né una certificazione dell'IA live. Il test del nuovo archivio e il
suo checksum sono registrati in un rapporto esterno allo ZIP.

## Blogger

Il deploy aggiorna l'app, **non il codice già incollato nel post**. Per i
pulsanti ripristinati sostituire separatamente il solo embed dedicato con
`cornice-dinamica/embed-espressioni-dedicata.html` (o il Codice 14 nel DOCX
aggiornato di questa sessione). La Cornice Universale del PDF è distinta e
non va modificata. Per qualunque futuro deploy attendere nuova autorizzazione.

