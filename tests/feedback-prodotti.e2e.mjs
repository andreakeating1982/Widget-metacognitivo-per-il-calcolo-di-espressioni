import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

// Tutte le API sono simulate: non scrive nulla al database né chiama l'IA.
const base=process.env.FEEDBACK_URL||'http://127.0.0.1:3000';
const fixtureFile=process.env.FEEDBACK_FIXTURES||'/tmp/widget-feedback-fixtures.json';
const out=process.env.FEEDBACK_OUTPUT||'/tmp/widget-feedback-results';
// Override quando il test è eseguito in una cartella QA separata; altrimenti
// risolvere KaTeX dalla cartella corrente anziché da un percorso della sandbox.
const katexDir=process.env.FEEDBACK_KATEX||path.resolve(process.cwd(),'node_modules/katex/dist');
const f=JSON.parse(await fs.readFile(fixtureFile,'utf8'));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-features=LocalNetworkAccessChecks']});
const cases=[
 {name:'numerico-perfetto-desktop',width:1280,height:800,kind:'numeric',perfect:true},
 {name:'numerico-errore-mobile',width:320,height:640,kind:'numeric',touch:true,perfect:false},
 {name:'numerico-una-stella-mobile',width:390,height:780,kind:'numeric',touch:true,perfect:false,wrongTwo:true},
 {name:'numerico-zero-stelle-desktop',width:1280,height:800,kind:'numeric',perfect:false,wrongAll:true},
 {name:'coniugati-perfetto-desktop',width:1280,height:800,kind:'coniugati',perfect:true},
 {name:'coniugati-quattro-stelle',width:1280,height:800,kind:'coniugati',perfect:false,oneError:true},
 {name:'coniugati-errori-mobile',width:390,height:780,kind:'coniugati',touch:true,perfect:false},
 {name:'coniugati-blog-mobile',width:390,height:780,kind:'coniugati',touch:true,perfect:true,embed:true},
 {name:'coniugati-font160',width:320,height:680,kind:'coniugati',touch:true,perfect:true,large:true},
];
const results=[];
for(const c of cases){
 const ctx=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:!!c.touch,hasTouch:!!c.touch,deviceScaleFactor:1});
 await ctx.addInitScript(large=>localStorage.setItem('wms_access',JSON.stringify({fontScale:large?1.6:1,lineHeight:large?2.6:1.65,ruler:false,mode:'normale'})),!!c.large);
 const page=await ctx.newPage();const exercise=f[c.kind],answers=c.kind==='coniugati'?f.risposteConiugati:f.risposteNumeriche;
 const wrongIndices=c.perfect?[]:c.wrongAll?[0,1,2]:c.wrongTwo?[0,1]:c.oneError?[0]:c.kind==='numeric'?[0]:[0,4,5];
 const row={scenario:c.name,checks:[],errors:[],unexpectedApi:[]};
 const check=(name,ok,detail)=>{row.checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
 page.on('pageerror',e=>row.errors.push(e.message));
 await page.route('**/api/**',r=>{
  const u=new URL(r.request().url());
  if(r.request().method()==='GET'&&u.pathname.startsWith('/api/esercizio/sessione/'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({esercizio:exercise})});
  row.unexpectedApi.push({path:u.pathname,method:r.request().method()});
  return r.fulfill({status:503,contentType:'application/json',body:'{"error":"fixture isolata"}'});
 });
 let frame;
 try{
  const app=`${base}/esercizio?sid=feedback-${c.name}&cognome=QA&nome=Feedback&classe=3A&data=2026-11-07${c.embed?'&cornice=feedback-test':''}`;
  if(c.embed){
   await page.route(`${base}/__feedback-host`,r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><header style="height:120px">Blog di prova</header><iframe title="App" src="${app}" style="border:0;width:100%;height:640px"></iframe><footer>Fine pagina di prova</footer></body></html>`}));
   await page.goto(`${base}/__feedback-host`);frame=page.frames().find(x=>x.url().startsWith(base+'/esercizio'));
   if(!frame)throw Error('iframe non trovato');
  }else{await page.goto(app);frame=page.mainFrame();}
  await frame.locator('[data-box=b1]').waitFor();
  await frame.evaluate(()=>document.fonts.ready);
  const first=frame.locator('[data-box=b1]');
  check('nessun risultato o PDF prima del lavoro',await frame.getByText('RISULTATO FINALE',{exact:true}).count()===0&&await frame.locator('[data-testid=feedback-finale]').count()===0&&await frame.getByRole('button',{name:"Scarica il PDF con tutti i passaggi dell'espressione"}).count()===0);
  check('non appare il passaggio successivo prima della risposta',await frame.locator('[data-box=b2]').count()===0);
  if(c.kind==='coniugati'){
   const guida=first.locator('[data-testid=istruzione-trascrizione-frazione]');
   await guida.waitFor();
   const testoMetodo=(await guida.evaluate(el=>el.parentElement.textContent)).replace(/\s+/g,' ').trim().toLocaleLowerCase('it');
   check('schema generico nello stesso testo normale del metodo',testoMetodo===
    'porto la frazione allo stesso denominatore. scrivo così il risultato: (numeratore)/(denominatore)',testoMetodo);
   check('nessun vecchio riquadro o testo prolisso',!(await first.innerText()).toLocaleLowerCase('it').includes('come scrivere la frazione da tastiera'));
   const stile=await guida.evaluate(el=>{
    const p=el.parentElement,s=getComputedStyle(p),g=getComputedStyle(el);
    return {tag:el.tagName,parent:p.tagName,font:parseFloat(s.fontSize),
      border:parseFloat(s.borderTopWidth),background:s.backgroundColor,inline:g.display};
   });
   check('testo normale senza bordo, sfondo grigio o riduzione dei caratteri',
    stile.tag==='SPAN'&&stile.parent==='P'&&stile.inline==='inline'&&stile.font>=18.66&&
    stile.border===0&&stile.background==='rgba(0, 0, 0, 0)',stile);
   // Misurare ciascuna riga del testo anche con font ingrandito: il contenitore
   // principale altrimenti nasconderebbe eventuale overflow orizzontale.
   const schema=await guida.evaluate(el=>{
    const range=document.createRange();range.selectNodeContents(el);
    const p=el.parentElement,bordo=p.getBoundingClientRect();
    return {width:p.clientWidth,scrollWidth:p.scrollWidth,left:bordo.left,right:bordo.right,
      righe:[...range.getClientRects()].map(r=>({left:r.left,right:r.right,width:r.width}))};
   });
   check('schema leggibile dentro le istruzioni anche a font ingrandito',
    schema.scrollWidth<=schema.width+1&&schema.righe.every(r=>r.left>=schema.left-1&&r.right<=schema.right+1),schema);
   check('nessuna soluzione anticipata nelle annotazioni visibili',!(await frame.locator('[data-box=b1] annotation').allTextContents()).includes(exercise.risultatoFinaleLatex));
   await guida.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));
   await page.screenshot({path:path.join(out,`${c.name}-istruzione.png`)});
  }
  const insert=async(id,value)=>{
   const box=frame.locator(`[data-box=b${id}]`);
   await box.getByTitle('Inserisci manualmente il valore',{exact:true}).click();
   const input=box.getByRole('textbox',{name:'Digita il valore da tastiera'});
   await input.fill(value);await input.press('Enter');return box;
  };
  if(wrongIndices.includes(0)){
   if(c.kind==='numeric'){
    await insert(1,'0');await first.getByText('RISULTATO SBAGLIATO. CALCOLA DI NUOVO',{exact:true}).waitFor();
   }else{
    await insert(1,'3/(x-2)+2/(x+2)');
    await first.getByText('RACCOGLI I TERMINI IN UNA SOLA FRAZIONE.',{exact:true}).waitFor();
    check('una somma equivalente non viene scambiata per una singola frazione',await frame.locator('[data-box=b2]').count()===0);
   }
  }
  for(let i=0;i<answers.length;i++){
   const box=frame.locator(`[data-box=b${i+1}]`);
   await box.waitFor();
   const label=box.getByText('INSERISCI IL RISULTATO:',{exact:true});
   const spazio=await label.evaluate(el=>{
    const root=el.parentElement,precedente=root.previousElementSibling;
    return {gap:el.getBoundingClientRect().top-precedente.getBoundingClientRect().bottom,
     margin:getComputedStyle(root).marginTop,font:getComputedStyle(el).fontSize};
   });
   check(`spazio tra istruzione e input nel box ${i+1}`,spazio.gap>=15,spazio);
   if(i===0&&['numerico-perfetto-desktop','numerico-errore-mobile'].includes(c.name)){
    await label.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));
    await page.screenshot({path:path.join(out,`${c.name}-spaziatura.png`)});
   }
   if(c.kind==='numeric'&&i>0&&wrongIndices.includes(i)){
    await insert(i+1,'0');
    await box.getByText('RISULTATO SBAGLIATO. CALCOLA DI NUOVO',{exact:true}).waitFor();
    check(`primo tentativo errato nel box ${i+1} non apre i successivi`,i===answers.length-1||await frame.locator(`[data-box=b${i+2}]`).count()===0);
   }
   if(wrongIndices.includes(i)&&c.kind==='coniugati'&&i===4){
    await insert(i+1,'6-4');await box.getByText('COMPLETA IL CALCOLO PRIMA DI PROSEGUIRE.',{exact:true}).waitFor();
    check('somma non svolta non rivela il risultato',await frame.locator('[data-box=b6]').count()===0);
   }
   if(c.kind==='coniugati'&&i===answers.length-1){
    const metodo=(await box.innerText()).toLocaleLowerCase('it');
    check('il passaggio finale spiega il metodo senza dare la risposta',metodo.includes('somma per differenza')&&
     !(await box.locator('annotation').allTextContents()).includes(exercise.sezioni.at(-1).boxes[0].answerLatex));
    const metodoElement=box.getByText('Riconosco una somma per differenza e calcolo la differenza dei quadrati.');
    await metodoElement.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));
    const visibilita=await metodoElement.evaluate(el=>{
     const r=el.getBoundingClientRect(),s=document.querySelector('.expr-exercise-scroll').getBoundingClientRect();
     return {top:r.top,bottom:r.bottom,scrollTop:s.top,scrollBottom:s.bottom,viewport:innerHeight};
    });
    check('metodo interamente leggibile con scorrimento verticale',visibilita.top>=visibilita.scrollTop-1&&visibilita.bottom<=Math.min(visibilita.scrollBottom,visibilita.viewport)+1,visibilita);
    await page.screenshot({path:path.join(out,`${c.name}-prodotto-notevole.png`)});
   }
   if(wrongIndices.includes(i)&&c.kind==='coniugati'&&i===5){
    const before=await box.innerText();
    check('il metodo del prodotto notevole è visibile senza risultato',before.toLocaleLowerCase('it').includes('somma per differenza')&&!before.includes('x² − 4'),before.slice(0,900));
    await insert(i+1,'(x+2)*(x-2)');await box.getByText('COMPLETA IL CALCOLO PRIMA DI PROSEGUIRE.',{exact:true}).waitFor();
    check('prodotto ripetuto non viene presentato come risultato svolto',await frame.locator('[data-testid=feedback-finale]').count()===0);
   }
   await insert(i+1,answers[i]);
   if(i<answers.length-1){
    await box.locator('[data-testid=pillola-formula-risolta]').waitFor({timeout:15000});
    await frame.locator(`[data-box=b${i+2}]`).waitFor();
    check(`passo ${i+1} accettato senza anticipare il finale`,await frame.getByText('RISULTATO FINALE',{exact:true}).count()===0);
   }
  }
  const feedback=frame.locator('[data-testid=feedback-finale]');
  const continua=frame.getByRole('button',{name:'CONTINUA',exact:true});
  await continua.waitFor({timeout:15000});
  check('al termine si resta nella terza pagina fino a CONTINUA',await feedback.count()===0&&await frame.getByText('RISULTATO FINALE',{exact:true}).count()===1);
  check('nessun pulsante PDF nella terza pagina completata',await frame.getByRole('button',{name:/Scarica il PDF/i}).count()===0);
  check('nessuna lode ottimo anticipata nella pagina dei passaggi',await frame.getByText(/OTTIMO LAVORO/i).count()===0);
  await continua.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${c.name}-continua.png`)});
  await continua.click();await feedback.waitFor({timeout:15000});
  const correct=answers.length-wrongIndices.length;
  const stars=correct===answers.length?5:correct===0?0:Math.max(1,Math.min(4,Math.floor(correct/answers.length*5)));
  const expectedMessage=stars===5?'OTTIMO LAVORO!':stars>=3?'HAI FATTO UN BUON LAVORO!':'CONTINUA A ESERCITARTI!';
  const content=await feedback.innerText();
  check('pagina finale in italiano e punteggio corretto',content.includes('HAI TERMINATO!')&&content.includes(expectedMessage)&&content.toLocaleLowerCase('it').includes(`${correct} su ${answers.length}`),content);
  check('nel feedback non viene ripetuto il risultato finale',!content.includes('RISULTATO FINALE')&&await feedback.locator('.katex,annotation').count()===0,content);
  // Tailwind assegna border-style:solid globalmente anche con spessore zero:
  // ciò che determina una cornice visibile è lo spessore, non lo stile solo.
  const titolo=await feedback.locator('#titolo-esito-finale').evaluate(el=>({focused:document.activeElement===el,outline:getComputedStyle(el).outlineStyle,borderWidth:getComputedStyle(el).borderTopWidth,shadow:getComputedStyle(el).boxShadow}));
  check('titolo senza cornice e con focus accessibile',titolo.focused&&titolo.outline==='none'&&parseFloat(titolo.borderWidth)===0&&titolo.shadow==='none',titolo);
  const gruppoStelle=feedback.getByRole('img',{name:`${stars} stelle su 5`});
  check('cinque stelline e descrizione accessibile',await gruppoStelle.count()===1&&await gruppoStelle.locator('svg').count()===5);
  check('solo schermata finale: passaggi temporaneamente nascosti',await frame.locator('[data-box]').count()===0);
  check('focus sul titolo conclusivo',await frame.evaluate(()=>document.activeElement?.id)==='titolo-esito-finale',await frame.evaluate(()=>document.activeElement?.outerHTML?.slice(0,220)));
  const layout=await feedback.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,screen:document.documentElement.clientWidth,doc:document.documentElement.scrollWidth,style:getComputedStyle(el).fontFamily}));
  check('nessuno sbordamento orizzontale della pagina finale',layout.scrollWidth<=layout.width+1&&layout.doc<=layout.screen+1,layout);
  const scroll=frame.locator('.expr-exercise-scroll');
  await scroll.evaluate(el=>{el.scrollTop=0});await page.waitForTimeout(200);
  await page.screenshot({path:path.join(out,`${c.name}-top.png`)});
  const pdf=feedback.getByRole('button',{name:"Scarica il PDF con tutti i passaggi dell'espressione"});
  await pdf.scrollIntoViewIfNeeded();
  const box=await pdf.boundingBox();
  check('pulsante PDF leggibile e raggiungibile',await pdf.isVisible()&&!!box&&box.height>=44&&box.width>=100,box);
  await page.screenshot({path:path.join(out,`${c.name}-pdf.png`)});
  await frame.evaluate(()=>{window.__qaPdf='';window.open=()=>({document:{write:html=>{window.__qaPdf=html},close:()=>{}}});});
  await pdf.click();
  const doc=await frame.evaluate(()=>{const html=window.__qaPdf,d=new DOMParser().parseFromString(html,'text/html');return {html,text:d.body.textContent,rows:[...d.querySelectorAll('annotation')].map(x=>x.textContent),punteggio:d.querySelector('.pdf-primo-colpo')?.textContent?.trim(),ordine:[...d.querySelector('.pdf-intestazione')?.children??[]].map(x=>x.className)};});
  check('PDF dei passaggi effettivi con dati sintetici e risultato solo al completamento',doc.text.includes('QA Feedback')&&doc.text.includes('Classe 3A')&&doc.text.includes('RISULTATO FINALE')&&exercise.righeProgressive.every(r=>doc.rows.includes(r)),doc.rows);
  check('il PDF riporta esattamente il conteggio del feedback',doc.punteggio===`Risposte giuste al primo colpo: ${correct} su ${answers.length}`,doc.punteggio);
  check('il conteggio è subito dopo la riga dei dati studente',doc.ordine.join('|')==='pdf-dati-studente|pdf-primo-colpo',doc.ordine);
  if(c.name==='coniugati-perfetto-desktop')await fs.writeFile(path.join(out,'pdf-catturato.html'),doc.html);
  await feedback.getByRole('button',{name:'RIVEDI I PASSAGGI'}).click();
  await frame.locator('[data-box=b1]').waitFor();
  check('si possono rivedere tutti i passaggi senza perdere il lavoro',await frame.locator('[data-testid=pillola-formula-risolta]').count()===answers.length);
  check('anche rivedendo i passaggi il PDF resta soltanto nel feedback',await frame.getByRole('button',{name:/Scarica il PDF/i}).count()===0&&await frame.getByRole('button',{name:'VEDI IL FEEDBACK'}).count()===0);
  await frame.getByRole('button',{name:'CONTINUA',exact:true}).click();await feedback.waitFor();
  check('tornando al feedback il conteggio è conservato',(await feedback.innerText()).toLocaleLowerCase('it').includes(`${correct} su ${answers.length}`));
  await feedback.getByRole('button',{name:"Scarica il PDF con tutti i passaggi dell'espressione"}).click();
  const secondoPunteggio=await frame.evaluate(()=>new DOMParser().parseFromString(window.__qaPdf,'text/html').querySelector('.pdf-primo-colpo')?.textContent?.trim());
  check('anche il PDF dopo la revisione conserva il primo tentativo',secondoPunteggio===`Risposte giuste al primo colpo: ${correct} su ${answers.length}`,secondoPunteggio);
  check('nessuna chiamata API reale inattesa e nessun errore JS',row.unexpectedApi.length===0&&row.errors.length===0,{api:row.unexpectedApi,errors:row.errors});
  row.ok=true;
 }catch(e){row.ok=false;row.error=String(e?.message??e);await page.screenshot({path:path.join(out,`${c.name}-FAILED.png`)}).catch(()=>{});}
 results.push(row);console.log(c.name,row.ok?'OK':'FAIL',row.checks.length,row.error??'');
 await ctx.close();
}
// Rendering A4 della stampa HTML catturata: PDF di prova, senza stampante.
try{
 const html=await fs.readFile(path.join(out,'pdf-catturato.html'),'utf8');
 const ctx=await browser.newContext();const page=await ctx.newPage();
 await page.route('https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/**',route=>{
  const name=path.basename(new URL(route.request().url()).pathname);
  const target=name==='katex.min.css'?path.join(katexDir,name):path.join(katexDir,'fonts',name);
  return route.fulfill({path:target,headers:{'access-control-allow-origin':'*','cross-origin-resource-policy':'cross-origin'}}).catch(()=>route.abort());
 });
 await page.setContent(html.replace(/<script>window\.onload=function\(\)\{window\.print\(\)\}<\/script>/,''),{waitUntil:'networkidle'});
 await page.evaluate(()=>document.fonts.ready);
 await page.pdf({path:path.join(out,'prova-pdf-a4.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
 await page.screenshot({path:path.join(out,'prova-pdf-a4.png'),fullPage:true});
 await ctx.close();console.log('PDF A4 sintetico renderizzato');
}catch(e){results.push({scenario:'pdf-a4-render',ok:false,error:String(e?.message??e),checks:[]});console.error('PDF A4 FAIL',e);}
await browser.close();
await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
console.log('RISULTATI',results.filter(x=>x.ok).length+'/'+results.length);
if(results.some(x=>!x.ok))process.exitCode=1;

