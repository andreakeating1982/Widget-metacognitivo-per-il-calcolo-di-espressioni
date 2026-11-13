import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

// Dati ed esercizi sintetici: tutte le API sono intercettate, senza IA o DB.
// L'HTML catturato è quello prodotto dal vero pulsante SCARICA PDF.
const base = process.env.PDF_QA_URL || 'http://127.0.0.1:3000';
const fixturePath = process.env.PDF_QA_FIXTURES || '/tmp/widget-feedback-fixtures.json';
const out = process.env.PDF_QA_OUTPUT || '/tmp/widget-pdf-intestazione';
const katexDir = process.env.PDF_QA_KATEX || path.resolve(process.cwd(), 'node_modules/katex/dist');
const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
await fs.mkdir(out, { recursive: true });

const casi = [
  { nome:'perfetto-desktop', width:1280, height:800, dati:{cognome:'Rossi',nome:'Anna',classe:'3A',data:'07/11/2026'}, errori:[], rigaUnica:true },
  { nome:'misto-telefono-iframe', width:390, height:780, touch:true, embed:true, dati:{cognome:'Bianchi',nome:'Luca',classe:'2B',data:'07/11/2026'}, errori:[0], rigaUnica:true },
  { nome:'zero-desktop', width:1280, height:800, dati:{cognome:'Verdi',nome:'Maria',classe:'1C',data:'07/11/2026'}, errori:[0,1,2], rigaUnica:true },
  { nome:'dati-lunghi', width:320, height:680, touch:true, dati:{cognome:'Lunghissimocognome'.repeat(6),nome:'Annalungaconiugata'.repeat(4),classe:'3A-LABORATORIO-'.repeat(5),data:'07/11/2026'}, errori:[0], rigaUnica:false },
  { nome:'caratteri-speciali', width:1280, height:800, dati:{cognome:"D'Amico & Figli",nome:'Ada <b>Prova</b>',classe:'3A & 3B',data:'07/11/2026'}, errori:[], rigaUnica:false },
  { nome:'senza-dati-studente', width:1280, height:800, dati:{}, errori:[1], rigaUnica:false },
];

const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-features=LocalNetworkAccessChecks']});
const results = [];
for (const c of casi.filter(c=>!process.env.PDF_QA_CASE||c.nome===process.env.PDF_QA_CASE)) {
  const ctx = await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:!!c.touch,hasTouch:!!c.touch});
  // La fixture viene servita dal fetch del browser, senza chiamare API o DB.
  // Non usare page.route per le API: in Chromium può bloccare il primo CSS
  // richiesto da un popup creato con document.write, impedendo il test reale.
  await ctx.addInitScript(esercizio => {
    const originale=window.fetch.bind(window);
    window.__qaApiEvents=[];
    window.fetch=async (input,init) => {
      const raw=typeof input==='string'?input:(input instanceof URL?input.href:input.url);
      const url=new URL(raw,window.location.href);
      const metodo=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
      if (url.origin===window.location.origin&&url.pathname.startsWith('/api/')) {
        if (metodo==='GET'&&url.pathname.startsWith('/api/esercizio/sessione/')) {
          return new Response(JSON.stringify({esercizio}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        window.__qaApiEvents.push(`${metodo} ${url.pathname}`);
        return new Response('{"error":"solo dati sintetici"}',{status:503,headers:{'Content-Type':'application/json'}});
      }
      return originale(input,init);
    };
  },fixture.numeric);
  if (c.nome==='perfetto-desktop') {
    // Il popup è reale; evitiamo solo il dialogo di stampa della macchina QA.
    await ctx.addInitScript(() => {
      window.__qaPrintCalls=0;
      window.print=()=>{window.__qaPrintCalls+=1;};
    });
  }
  const page = await ctx.newPage();
  const row = {scenario:c.nome, checks:[], errors:[], unexpectedApi:[]};
  const check = (name, ok, detail) => {
    row.checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});
    if (!ok) throw new Error(`${name}: ${JSON.stringify(detail)}`);
  };
  page.on('pageerror', e => row.errors.push(e.message));
  page.on('request', req => {
    const url=new URL(req.url());
    if (url.origin===new URL(base).origin&&url.pathname.startsWith('/api/')) row.unexpectedApi.push(`RETE ${req.method()} ${url.pathname}`);
  });
  let printCtx;
  try {
    const p = new URLSearchParams({sid:`pdf-qa-${c.nome}`,...c.dati});
    if (c.embed) p.set('cornice','pdf-qa');
    const app = `${base}/esercizio?${p.toString()}`;
    let frame;
    if (c.embed) {
      await page.route(`${base}/__pdf-qa-host`, route => route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><header style="height:40px">Blog di prova</header><iframe title="Widget" src="${app.replace(/&/g,'&amp;')}" style="border:0;width:100%;height:640px"></iframe></body></html>`}));
      await page.goto(`${base}/__pdf-qa-host`);
      await page.locator('iframe').waitFor();
      frame = page.frames().find(f => f.url().startsWith(`${base}/esercizio`));
      if (!frame) throw new Error('Iframe sintetico non trovato');
    } else {
      await page.goto(app);
      frame = page.mainFrame();
    }
    await frame.locator('[data-box=b1]').waitFor();
    const insert = async (id, value) => {
      const box = frame.locator(`[data-box=b${id}]`);
      await box.getByTitle('Inserisci manualmente il valore',{exact:true}).click();
      const input = box.getByRole('textbox',{name:'Digita il valore da tastiera'});
      await input.fill(value);
      await input.press('Enter');
      return box;
    };
    for (let i=0; i<fixture.risposteNumeriche.length; i++) {
      const box = frame.locator(`[data-box=b${i+1}]`);
      await box.waitFor();
      if (c.errori.includes(i)) {
        await insert(i+1,'0');
        await box.getByText('RISULTATO SBAGLIATO. CALCOLA DI NUOVO',{exact:true}).waitFor();
      }
      await insert(i+1,fixture.risposteNumeriche[i]);
      await box.locator('[data-testid=pillola-formula-risolta]').waitFor();
    }
    await frame.getByRole('button',{name:'CONTINUA',exact:true}).click();
    const feedback = frame.locator('[data-testid=feedback-finale]');
    await feedback.waitFor();
    const esatte = fixture.risposteNumeriche.length - c.errori.length;
    const expected = `Risposte giuste al primo colpo: ${esatte} su ${fixture.risposteNumeriche.length}`;
    const feedbackTesto = await feedback.innerText();
    // L'accessibilità dell'app può mostrare tutto maiuscolo via CSS.
    check('il feedback mostra il conteggio previsto',feedbackTesto.toLocaleLowerCase('it').includes(expected.toLocaleLowerCase('it')),feedbackTesto);
    if (c.nome==='perfetto-desktop') {
      // Aprire una vera finestra di stampa; viene sostituita solo la chiamata
      // alla stampante, non window.open né document.write. Il popup carica il
      // CSS KaTeX remoto come l'app: intercettare la sua primissima richiesta
      // in Chromium/Playwright può bloccare la finestra appena creata.
      const [popup]=await Promise.all([
        page.waitForEvent('popup',{timeout:15000}),
        feedback.getByRole('button',{name:"Scarica il PDF con tutti i passaggi dell'espressione"}).click(),
      ]);
      await popup.locator('.pdf-primo-colpo').waitFor({timeout:15000});
      await popup.waitForFunction(()=>window.__qaPrintCalls>0,null,{timeout:30000});
      check('il pulsante apre davvero la finestra di stampa con il conteggio corretto',
        (await popup.locator('.pdf-primo-colpo').textContent())?.trim()===expected);
      await popup.close();
    }
    await frame.evaluate(() => { window.__pdfQa=''; window.open=()=>({document:{write:html=>{window.__pdfQa=html},close:()=>{}}}); });
    await feedback.getByRole('button',{name:"Scarica il PDF con tutti i passaggi dell'espressione"}).click();
    const doc = await frame.evaluate(() => {
      const html=window.__pdfQa, d=new DOMParser().parseFromString(html,'text/html');
      const header=d.querySelector('.pdf-intestazione');
      return {html,
        punteggio:d.querySelector('.pdf-primo-colpo')?.textContent?.trim(),
        dati:[...d.querySelectorAll('.pdf-dati-studente>span')].map(x=>x.textContent),
        datiTesto:d.querySelector('.pdf-dati-studente')?.textContent??'',
        ordine:[...(header?.children||[])].map(x=>x.className),
        markupImprevisto:header?.querySelectorAll('img,script,svg,b').length??0,
        righe:[...d.querySelectorAll('annotation')].map(x=>x.textContent),
        risultato:d.body.textContent.includes('RISULTATO FINALE')};
    });
    check('identico conteggio nel PDF e nel feedback',doc.punteggio===expected,doc.punteggio);
    const nomeCompleto=[c.dati.cognome,c.dati.nome].filter(Boolean).join(' ');
    const expectedDati=[nomeCompleto,c.dati.classe?`Classe ${c.dati.classe}`:'',c.dati.data||''].filter(Boolean);
    check('dati studente completi e nella sequenza attesa',JSON.stringify(doc.dati)===JSON.stringify(expectedDati),doc.dati);
    check('campi separati anche come testo accessibile',doc.datiTesto===expectedDati.join(' '),doc.datiTesto);
    check('conteggio subito dopo i dati oppure in testa se assenti',doc.ordine.join('|')===(expectedDati.length?'pdf-dati-studente|pdf-primo-colpo':'pdf-primo-colpo'),doc.ordine);
    check('eventuali caratteri speciali non diventano tag eseguibili',doc.markupImprevisto===0,doc.markupImprevisto);
    check('PDF dello svolgimento effettivo e risultato finale',doc.risultato&&fixture.numeric.righeProgressive.every(r=>doc.righe.includes(r)),doc.righe);

    // Verifica A4 con i font e KaTeX locali: non usa CDN e non stampa fisicamente.
    printCtx = await browser.newContext({viewport:{width:643,height:1050}});
    const printPage = await printCtx.newPage();
    await printPage.route('https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/**', route => {
      const name=path.basename(new URL(route.request().url()).pathname);
      const target=name==='katex.min.css'?path.join(katexDir,name):path.join(katexDir,'fonts',name);
      return route.fulfill({path:target,headers:{'access-control-allow-origin':'*','cross-origin-resource-policy':'cross-origin'}}).catch(()=>route.abort());
    });
    // Partire dall'origine dell'app: una pagina about:blank in un server
    // statico senza CORS non può caricare i font self-hosted del progetto.
    await printPage.goto(`${base}/`,{waitUntil:'load'});
    await printPage.emulateMedia({media:'print'});
    const htmlNoPrint=doc.html.replace(/<script>window\.onload=function\(\)\{window\.print\(\)\}<\/script>/,'');
    await printPage.setContent(htmlNoPrint,{waitUntil:'networkidle'});
    await printPage.evaluate(()=>document.fonts.ready);
    const layout = await printPage.evaluate(() => {
      const header=document.querySelector('.pdf-intestazione'), dati=header.querySelector('.pdf-dati-studente'), punteggio=header.querySelector('.pdf-primo-colpo');
      const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height}};
      const riga=dati?rect(dati):null;
      const voci=dati?[...dati.children].map(el=>({rect:rect(el),font:getComputedStyle(el).fontFamily,size:parseFloat(getComputedStyle(el).fontSize),text:el.textContent})):[];
      const fragments=dati?[...dati.children].flatMap(el=>{const range=document.createRange();range.selectNodeContents(el);return [...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}));}):[];
      return {header:rect(header),riga,punteggio:rect(punteggio),voci,fragments,
        scrollWidth:header.scrollWidth,clientWidth:header.clientWidth,
        fontCaricato:document.fonts.check('14pt OpenDyslexic')&&document.fonts.check('700 14pt OpenDyslexic')};
    });
    check('font OpenDyslexic caricato e testo almeno 14 pt',layout.fontCaricato&&layout.voci.every(v=>v.font.includes('OpenDyslexic')&&v.size>=18.6),layout);
    check('nessun taglio o fuoriuscita orizzontale dei dati',layout.scrollWidth<=layout.clientWidth+1&&(!layout.riga||layout.fragments.every(r=>r.left>=layout.riga.left-1&&r.right<=layout.riga.right+1)),layout);
    check('conteggio stampato sotto la riga dei dati',!layout.riga||layout.punteggio.top>=layout.riga.bottom-1,layout);
    if (c.rigaUnica) {
      const tops=layout.voci.map(v=>v.rect.top);
      // Font OpenDyslexic bold e regular hanno metriche leggermente diverse:
      // l'allineamento sulla baseline può produrre 2 px di scarto verticale.
      check('dati usuali sulla stessa riga in A4',tops.length===3&&Math.max(...tops)-Math.min(...tops)<=4,layout.voci);
    }
    if (c.nome==='dati-lunghi') {
      check('dati lunghi possono andare a capo senza riduzioni o tagli',layout.riga.height>32&&layout.voci.every(v=>v.size>=18.6),layout);
    }
    const pdfPath=path.join(out,`${c.nome}.pdf`);
    await printPage.pdf({path:pdfPath,format:'A4',printBackground:true,preferCSSPageSize:true});
    await printPage.screenshot({path:path.join(out,`${c.nome}.png`),fullPage:true});
    const pdfInfo=execFileSync('pdfinfo',[pdfPath],{encoding:'utf8'});
    check('documento realmente in formato A4',/Page size:.*\(A4\)/.test(pdfInfo));
    const text=execFileSync('pdftotext',['-raw',pdfPath,'-'],{encoding:'utf8'}).replace(/\s+/g,' ');
    const compatta=s=>s.replace(/\s+/g,'');
    check('conteggio presente nel PDF A4 reale',text.includes(expected),text.slice(0,400));
    check('dati completi presenti nel PDF A4 reale',expectedDati.every(s=>compatta(text).includes(compatta(s))),text.slice(0,500));
    check('risultato svolto nel PDF A4 reale',text.includes('RISULTATO FINALE'));
    row.unexpectedApi.push(...await frame.evaluate(()=>window.__qaApiEvents||[]));
    check('nessuna API reale inattesa e nessun errore JavaScript',row.unexpectedApi.length===0&&row.errors.length===0,{api:row.unexpectedApi,errors:row.errors});
    await fs.writeFile(path.join(out,`${c.nome}-layout.json`),JSON.stringify(layout,null,2));
    row.ok=true;
  } catch (err) {
    row.ok=false; row.error=String(err?.message??err);
    await page.screenshot({path:path.join(out,`${c.nome}-FAILED.png`)}).catch(()=>{});
  } finally {
    if (printCtx) await printCtx.close();
    await ctx.close();
  }
  results.push(row);
  console.log(c.nome,row.ok?'OK':'FAIL',row.checks.length,row.error??'');
}
await browser.close();
await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');
console.log(`RISULTATI ${results.filter(x=>x.ok).length}/${results.length}`);
if (results.some(x=>!x.ok)) process.exitCode=1;

