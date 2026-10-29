# 💡 FILOSOFIA-DSA — La filosofia dell'app per studenti DSA/discalculici

**Questa sezione è pensata per essere CLONATA dall'IA in altre app simili.**
Se stai costruendo una nuova app didattica per studenti con DSA/BES/discalculia
(qualunque materia: matematica, lingue, geografia, scienze…), leggi qui i principi
invariabili e applica la **checklist di clonazione** in fondo. La materia cambia:
la filosofia no.

---

## A chi è rivolta

Studenti con **disturbi specifici dell'apprendimento (DSA), BES e disabilità
intellettiva di grado grave**, in particolare **discalculia**. Le conseguenze
progettuali sono radicali e non negoziabili:

- il **carico cognitivo** di ogni schermata deve essere minimo (un concetto, un
  operazione, un campo alla volta);
- lo studente deve **fare LUI** ogni passaggio: l'app guida, non sostituisce;
- ogni feedback deve essere **immediato, chiaro, non umiliante**;
- tutto ciò che si vede a schermo deve essere **leggibile** (font OpenDyslexic,
  testo grande, alto contrasto opzionale).

## I 12 principi (invariabili)

### 1. Segmento minimo: UNA operazione per volta
Ogni box/passo contiene **esattamente un calcolo**. Mai due operazioni nello
stesso campo. L'app scompone l'esercizio in segmenti minimi (`sezioni` → `box`),
ognuno con un solo risultato semplice da inserire. Se un passaggio richiede due
controlli, sono DUE box.

### 2. L'app non esegue MAI un calcolo al posto dello studente
Il risultato di ogni operazione è **scritto dallo studente** (a mano sul canvas,
con la tastiera di trascrizione o dettato a voce). L'app:
- **riconosce** la scrittura (non la calcola);
- mostra il risultato solo se ed è stato **inserito dall'utente**;
- non compila MAI automaticamente un campo.
> Foto storica: la frase doveva dire «MOLTIPLICO SOTTO RADICE» e invece diceva
> anche «= RADICE DI 6» — il regalo della soluzione è il fallimento peggiore.

### 3. «Non dire mai la soluzione, neanche per iscritto»
Le frasi esplicative guidano il **METODO**, mai il **RISULTATO**:
- CONSENTITO nominare i dati già visibili nel box («tre quarti per otto»,
  «la radice di 9» quando √9 è scritto, «mcm(2,3)=6»): sono metodo;
- VIETATO anticipare ciò che lo studente deve scrivere: niente «= numero»,
  niente «fa/è/diventa/ottengo/ossia + risultato», niente «RADICE DI 6» se √6 è
  la risposta, niente frazioni a parole della risposta.
**Doppia protezione**: (1) istruzioni severe al prompt dell'IA con esempi
giusto/sbagliato; (2) **sanitizer deterministico** che taglia la soluzione dalle
frasi prima di mostrarle (in questo repo: `client/src/lib/promptSicuri.ts`,
integrato in `riparaEsercizio`). Se una frase si svuota del tutto, resta un
invito al metodo: «Applica il metodo e scrivi tu il risultato.»

### 4. Frasi procedurali BREVI
Le frasi aiutano alleggerendo il carico cognitivo: **una riga, un verbo d'azione**,
tono concreto («Sommo i radicali simili sommando i coefficienti»). Mai paragrafi,
mai spiegazioni teoriche dentro il flusso di lavoro: la teoria sta altrove o non
c'è.

### 5. Notazione fedele — l'app trascrive, non corregge lo stile
- Frazioni **SEMPRE impilate** (numeratore sopra, linea, denominatore sotto);
  **mai decimali con la virgola** come risultato («10,5» vietato ovunque).
- Moltiplicazione con il **puntino `·`**, mai con la «x».
- Parentesi del **tipo scritto** dallo studente: quadre restano quadre, graffe
  restano graffe, tonde tonde.
- I segni scritti a mano o in foto vengono riconosciuti così come sono: ` : ` resta
  ` : `, l'apice resta apice; l'app non «sistema» la notazione a modo suo.

### 6. Risposte equivalenti accettate (a valore o a forma)
Se più scritture sono matematicamente equivalenti, sono tutte corrette:
es. `9`, `3^2` e `(1/3)^-2`; `3√15` scritto a mano, battuto o notato in forme
diverse. La verifica è **a valore** (motore esatto) o **a forma** (confronto
simbolico), non a stringa letterale. La risposta sbagliata invece è sbagliata
per tutti i mezzi: canvas e tastiera devono dare lo stesso verdetto.

### 7. Feedback: chiaro, rosso, senza numeri altrui
- Risposta sbagliata → messaggio rosso fisso: **«RISULTATO SBAGLIATO. CALCOLA
  DI NUOVO»**. **Mai** mostrare il numero errato riconosciuto (niente pillole
  blu con lo sbaglio).
- Messaggi di riconoscimento: piccoli, rossi, **non in grassetto**.
- Errori dell'IA/riconoscimento in **italiano** semplice, mai inglesi tecnici.
- Risposta corretta → verde, box successivo sbloccato. La progressione è la
  ricompensa.

### 8. Input protetto finché non è pronto (anti-scarabocchi)
I canvas di scrittura sono **non interattivi finché non hanno misurato il
contenitore**: velo «CARICAMENTO…» + pulsanti disattivati. L'input anticipato
produce scarabocchi sfasati (le coordinate cambiano al termine del layout) e lo
studente se ne accorge solo dopo: frustrazione evitabile a costo zero.

### 9. Accessibilità: pannello a portata di dito
Barra fissa con (vedi `ACCESSIBILITA.md` per il codice esatto):
- **font OpenDyslexic auto-ospitato** (nessuna CDN: funziona anche offline e in
  iframe con COEP stretto);
- dimensione font, interlinea, **righello di lettura**, alto contrasto, modalità
  scura, **maiuscole** (via CSS, per non alterare il LaTeX), **ascolto** (TTS
  con auto-stop ~20 s, auto-lingua);
- annunci **ARIA** (`role=status`, `aria-live`, `aria-pressed`) su ogni controllo;
- testi a schermo ≥ 14 pt (le eccezioni sono solo pagine di benvenuto consolidate).

### 10. RICOPIA SUL QUADERNO + PDF della sessione
Lo svolgimento vero dello studente si esporta in **PDF**: intestazione Cognome,
Nome, Classe, Data; passaggi in colonna, centrati, neri; **RISULTATO FINALE in
marrone**; frazioni impilate; niente risultati automatici. Il PDF dell'AI MAI
del default: se l'esercizio è incompleto, il PDF è parziale e senza RISULTATO
FINALE.

### 11. «L'IA propone, il motore dispone»
L'IA può: scomporre l'esercizio, proporre frasi, trascrivere foto, verificare
passi. Il **motore deterministico locale** decide SEMPRE cosa è corretto:
- ogni conto proposto dall'IA è ricalcolato (`latexValue`, polinomi, fratte
  esatte, sostituzione); se non torna, viene ricalcolato dal motore stesso;
- l'IA non ha mai l'ultima parola su ciò che lo studente vede come «giusto»;
- senza IA (chiave assente, timeout) l'app resta **completamente funzionante**.

### 12. Foto/ritaglio/dettatura: ingressi multipli, controllo umano finale
Foto scattata o caricata → **ritaglio libero** (maniglie, rotazione) →
trascrizione IA vision (mai troncata: `max_tokens` alti + regola anti-troncamento)
→ OCR di soccorso → il testo va in un campo **modificabile** che lo studente
controlla prima di procedere. La foto NON esegue mai operazioni: trascrive solo.
La dettatura vocale auto-stoppa (~20 s) senza perdere il testo.

---

## Tabella regola → implementazione → test

| # | Regola | Implementazione (questo repo) | Come si verifica |
|---|--------|-------------------------------|------------------|
| 1 | Segmento minimo | `server/costruisci.ts` (sezioni/box), prompt IA «ogni box UN solo calcolo» | contare le operazioni per box in un esercizio costruito |
| 2 | Studente calcola | campi vuoti, nessun autofill; `EspressioniExercises.tsx` | aprire un box: il campo è vuoto |
| 3 | Mai la soluzione | `client/src/lib/promptSicuri.ts` + regola 5 del prompt (`server/costruisci.ts`) | `promptSicuri.test.ts` («= RADICE DI 6» viene tagliato) |
| 4 | Frasi brevi | `prompt` dei box (una riga) | revisione visiva |
| 5 | Notazione fedele | `espressioni.ts` (`risultatoLatex`, `fracToLatex`, `wrapParen`), MAI `\frac` inline né virgole | suite `espressioni.test.ts` |
| 6 | Equivalenti | `evaluateLatex` a valore, `stessaForma` a forma | `evaluateLatex.test.ts` (9 / 3^2 / (1/3)^-2) |
| 7 | Feedback | messaggio rosso fisso, `hideValue` su errore | screenshot con risposta sbagliata |
| 8 | Anti-scarabocchi | `MathDrawCanvas` `onReady` + velo, RICONOSCI/✎ disattivati fino a pronto | scrivere subito dopo l'apertura: non si disegna |
| 9 | Accessibilità | `ACCESSIBILITA.md` (tabella «Dove nel codice») | checklist di ACCESSIBILITA.md |
| 10 | PDF sessione | `scaricaPdf` con dipendenze dallo svolgimento VERO | PDF con dati dello studente |
| 11 | IA sì, motore giudice | `aiVerify.ts`, `riparaEsercizio`, audit `auditConti` | `server/costruisci.test.ts` |
| 12 | Foto con controllo | `CropDialog` + campo modificabile ✎ | foto → ritaglio → correzione a mano |

---

## Checklist di clonazione per una NUOVA app (qualunque materia)

Quando costruisci una nuova app DSA partendo da questa filosofia, verifica PUNTO
PER PUNTO prima di consegnare:

- [ ] **Un concetto per schermata**: niente sovraccarico, niente scrolling obbligato.
- [ ] **Ogni risposta è dell'utente**: nessun campo precompilato, nessun «suggerimento»
      che mostra la risposta (test: il risultato è mai presente nel DOM prima dell'input?).
- [ ] **Le frasi parlano di metodo**: cerca nei testi «=», «fa», «risultato», «ossia»
      seguiti dal valore atteso → devono sparire (sanitizer o revisione manuale).
- [ ] **Frazioni impilate, mai decimali con virgola** (se la materia le prevede).
- [ ] **Risposte equivalenti accettate**; verifica a valore/forma, non a stringa.
- [ ] **Errore rosso fisso, senza mostrare lo sbaglio riconosciuto.**
- [ ] **Input disabilitato finché il canvas/layout non è pronto.**
- [ ] **OpenDyslexic auto-ospitato + pannello accessibilità + ARIA** (riusa
      `ACCESSIBILITA.md` di questa app: le misure sono portabili tali e quali).
- [ ] **PDF dello svolgimento vero** con intestazione studente e risultati solo
      se completi.
- [ ] **IA senza potere decisionale**: il motore locale verifica ogni conto;
      l'app funziona anche senza IA.
- [ ] **Suite di test** che copre le regole sopra (ogni regola = almeno un test).
- [ ] **Guida FILOSOFIA-DSA.md inclusa** nel pacchetto della nuova app.

## PROMPT DI CLONAZIONE (da incollare all'IA)

> Costruisci una nuova app didattica per studenti DSA/discalculici su [ARGOMENTO].
> Principi INVARIABILI (da `FILOSOFIA-DSA.md`):
> 1. Un'operazione per box; l'esercizio è scomposto in segmenti minimi.
> 2. L'utente scrive OGNI risultato: l'app riconosce, non calcola, non autofilla.
> 3. Le frasi guida il METODO e non rivelano MAI la soluzione (né in cifre, né a
>    parole, né in simboli); i dati visibili si possono nominare. Prevedi un
>    sanitizer che taglia la soluzione dalle frasi.
> 4. Frazioni impilate, mai decimali con la virgola; notazione fedele a ciò che
>    l'utente scrive (·, :, apici, tipo di parentesi).
> 5. Accetta risposte equivalenti (verifica a valore o a forma col motore locale).
> 6. Errore: messaggio rosso fisso «RISULTATO SBAGLIATO. CALCOLA DI NUOVO», mai
>    mostrare il numero errato; corretto: verde e box successivo sbloccato.
> 7. Canvas/input disattivati finché il layout non è pronto (anti-scarabocchi).
> 8. OpenDyslexic auto-ospitato, pannello accessibilità (font, interlinea, righello,
>    contrasto, TTS con auto-stop), ARIA completo, testi ≥ 14 pt.
> 9. PDF dello svolgimento VERO (intestazione studente, passaggi in colonna,
>    RISULTATO FINALE in marrone solo se completi).
> 10. «L'IA propone, il motore dispone»: ogni contenuto IA è verificato dal motore
>     deterministico locale; senza IA l'app funziona lo stesso.
> Materiali riusabili: `ACCESSIBILITA.md` e `TRAPIANTO-FOTO.md` di questa app.

---

*Filosofia consolidata con l'utente dall'aprile 2026 in poi, su correzioni
esplicite a ogni violazione («non dire mai la soluzione neanche per iscritto» è
la formulazione dell'utente, 26/10/2026). Se una nuova funzione deve scegliere
tra «più aiuto» e «studente fa da solo», vince sempre il secondo.*
