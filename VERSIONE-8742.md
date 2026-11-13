# Versione pubblicata 8742 — 28 ottobre 2026

## Riferimento verificato

- App: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**.
- URL: https://espressioni-monomi-polinomi.easy-peasy.site
- Deploy **8742**, approvato esplicitamente dall'utente e attivo.
- Commit funzionale pubblicato: `f7531736680fc9b1d3b1fa1cc79a4f5228418a6b`.
- JS: `index-9ZFZAM8U.js` — SHA-256
  `5495761b57ca48c394010656499bb1639fa85fb97f9d430e941b9bf29e3f7a2d`.
- CSS: `index-BC87wU0f.css` — SHA-256
  `ef5e84996df581bc7c4777eeddbf57848756743457ec9c463d103cf1712f0115`.

Nota di trasparenza: i primi due tentativi di deploy (8739, 8741) sono
falliti per indisponibilità temporanea del servizio; il terzo (8742) è
riuscito e verificato online: HTTP 200 e JS/CSS identici byte per byte
alla build approvata. Le modifiche documentali e lo ZIP non costituiscono
un nuovo deploy.

## Novità: rifiniture della seconda pagina (da foto utente)

- **Rimossi** l'intestazione «WIDGET METACOGNITIVO PER IL CALCOLO DI
  ESPRESSIONI» e la riga dati studente (Cognome — Classe — Data) dalla
  cima della seconda pagina. Restano richiesti in prima pagina e nel PDF.
- **INDIETRO**: al posto del link «← Torna alla home» ora c'è un piccolo
  pulsante marrone (token primary, `text-xs`, `px-3 py-1.5`) con
  `aria-label="Torna alla pagina iniziale"`, visibile sempre.
- Didascalia fase input: «**SCRIVI QUI L'ESPRESSIONE IN UNO O PIU' PEZZI.**»
  (eliminato «DA SVOLGERE,»).

Il resto è invariato: scrollbar interna stile Latino Facile, cropper 8731,
prima pagina e svolgimento/PDF.

## Verifiche della versione pubblicata

- Typecheck, **738 test superati / 28 saltati** e build riusciti.
- Browser online: titolo e dati studente assenti, pulsante INDIETRO
  marrone presente, didascalia corretta.

## Pacchetto, sicurezza e avvio

Vale tutto quanto già documentato in VERSIONE-8737.md e
VERIFICA-PACCHETTO-8737.md: sorgenti completi senza credenziali né dati di
esecuzione, propria `EASY_PEASY_API_KEY` nell'ambiente server/build, DB
facoltativa. La verifica della ricostruzione dello ZIP corrente è in
VERIFICA-PACCHETTO-8742.md.

