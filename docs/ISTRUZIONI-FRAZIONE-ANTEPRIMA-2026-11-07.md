# Istruzioni delle frazioni e parentesi — pubblicazione 9033

## Stato

La modifica è stata pubblicata come produzione **9033** dopo l'anteprima
condivisa e il consenso esplicito dell'utente. La produzione 9029 è la
baseline precedente. Checkpoint funzionale: `e79b09c`; quello immediatamente
precedente al deploy è `ca220d9`. Il client servito dall'anteprima e da
entrambi i domini di produzione usa `index-BDI0Itr8.js`, SHA-256
`98f0adbd8a12ee7d7138d012cf14798e1e6a112bcd0a13a8bcbbca69e74b639c`.
Dettagli e limiti del controllo online in `DEPLOY-9033.md`. Il rilascio non
aggiorna il blog, GitHub, Render o il DOCX delle cornici.

## Cosa cambia

- Nella terza pagina il consiglio in un riquadro separato è rimosso. Per una
  risposta frazionaria composta il testo del metodo include la breve frase
  «Scrivo così il risultato: (numeratore)/(denominatore)». Nel caso indicato
  la frase completa inizia con «Porto la frazione allo stesso denominatore.»;
  gli altri metodi esistenti restano invariati. Le parole sono uno schema,
  non la soluzione. La frase è nel normale paragrafo, senza sfondo o bordo.
- Testo nero scalabile e almeno 14 pt a dimensione normale. Su schermi molto
  stretti con caratteri ingranditi si manda a capo senza ridurre i caratteri.
  La lettura vocale usa parole intere; non vengono rivelati risultati.
- Per le sessioni già create il testo visibile viene aggiornato senza
  riscrivere i dati salvati. Il suggerimento soppresso della frazione
  impilata non viene reintrodotto.
- Si accettano parentesi tonde, quadre e graffe come delimitatori di
  numeratore e/o denominatore, anche annidate, purché la risposta sia
  matematicamente equivalente e rispetti l'eventuale criterio didattico.
  La valutazione già lo supportava: il parser non è stato alterato. Le
  parentesi non bilanciate, un denominatore nullo o valori errati restano
  sbagliati. Ripetere la somma originale non conta come frazione unica.

## Collaudi con dati sintetici

- `pnpm check`, 956 test client superati e 28 saltati; 19 test server con IA
  e archivi simulati. I test saltati non provano il modello di scrittura.
- 13/13 scenari browser specifici: tutte le parentesi, errori e correzione,
  punteggio al primo colpo e PDF coerente, lettura vocale simulata e assenza
  di soluzione anticipata; desktop, telefono, iframe e font 160% emulati.
- Regressione: 9/9 scenari feedback, 6/6 intestazione PDF, 16/16 percorsi
  studente; due PDF di prova A4 renderizzati. In aggiunta, sulla vera
  anteprima si sono ripetuti i 13/13 scenari parentesi, 9/9 feedback e 6/6
  PDF. In tutte le prove browser le API erano intercettate.
- Controllo grafico automatico a 1440 e 390 px. Il controllo generale rileva
  aspetti preesistenti della prima pagina e della toolbar (titolo h1, contrasto
  e dimensione di alcuni comandi); non sono stati modificati in questa
  richiesta. Il font generico CSS `math` è rilevato come fallback dal controllo.

I dispositivi e la lettura vocale erano simulati: non sono prove su un
telefono fisico, una stampante o un servizio IA reale. Nessun database
è stato scritto intenzionalmente per il collaudo.

