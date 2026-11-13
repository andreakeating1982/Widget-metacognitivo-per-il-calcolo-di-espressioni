import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

// Collaudo ripetibile di UI + fixture riparate dal server. Tutte le rotte
// /api/ sono intercettate: nessuna IA remota, nessuna scrittura a database.
const base = process.env.STUDENT_FLOW_URL || 'http://127.0.0.1:3000';
const fixturePath = process.env.STUDENT_FLOW_FIXTURES || '/tmp/widget-student-flow-fixtures.json';
const out = process.env.STUDENT_FLOW_OUTPUT || '/tmp/widget-student-flow-results';
const katexDir = process.env.STUDENT_FLOW_KATEX || path.resolve(process.cwd(),'node_modules/katex/dist');
await fs.mkdir(out,{recursive:true});
const fixtures = JSON.parse(await fs.readFile(fixturePath,'utf8'));
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const viewports = [
  {name:'desktop', width:1280,height:800},
  {name:'mobile', width:393,height:780,touch:true},
];
const results=[];
for (const viewport of viewports) {
  for (const fixture of fixtures) {
    const context = await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:!!viewport.touch,hasTouch:!!viewport.touch});
    const page=await context.newPage();
    const row={scenario:fixture.name,viewport:viewport.name,checks:[],unexpectedApi:[],errors:[]};
    const check=(name,ok,detail)=>{row.checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
    let builtBody=null, savedBody=null;
    page.on('pageerror',e=>row.errors.push(e.message));
    await page.route('**/api/**',async route=>{
      const req=route.request(), url=new URL(req.url()), p=url.pathname;
      const ok=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
      if(req.method()==='POST' && p==='/api/ai/costruisci-esercizio') {
        builtBody=req.postDataJSON(); return ok({jobId:'qa-job'});
      }
      if(req.method()==='GET' && p==='/api/ai/costruisci-esercizio') {
        return ok({stato:'fatto',tentativo:1,esercizio:fixture.esercizio});
      }
      if(req.method()==='POST' && p==='/api/esercizio/attivo') {
        savedBody=req.postDataJSON(); return ok({sid:fixture.name});
      }
      if(req.method()==='GET' && p===`/api/esercizio/sessione/${encodeURIComponent(fixture.name)}`) {
        return ok({esercizio:fixture.esercizio});
      }
      row.unexpectedApi.push({method:req.method(),path:p});
      return ok({error:'Chiamata bloccata dal collaudo isolato'},503);
    });
    try {
      const student='cognome=QA&nome=Percorso&classe=3A&data=2026-11-07';
      if(['aritmetica-progressiva','frazioni-letterali-foto'].includes(fixture.name)) {
        await page.goto(`${base}/espressione?${student}`);
        await page.getByRole('button',{name:'TRASCRIZIONE AUDIO E CON TASTIERA',exact:true}).click();
        const source=page.getByRole('textbox',{name:'Notazione da tastiera'});
        await source.fill(fixture.input);
        const build=page.getByRole('button',{name:"Fai costruire con l'intelligenza artificiale l'esercizio su misura da questa espressione"});
        check('costruzione abilitata dopo la trascrizione',await build.isEnabled());
        await build.click();
        await page.getByText("L'IA STA COSTRUENDO L'ESERCIZIO",{exact:true}).waitFor();
        check('avanzamento durante la costruzione simulata',true);
        await page.waitForURL(/\/esercizio\?/, {timeout:25000});
        const confrontabile = value => value?.replace(/·/g,'*').replace(/⁄/g,'/');
        check('job e salvataggio personali trasmettono la traccia',confrontabile(builtBody?.espressione)===confrontabile(fixture.input)&&savedBody?.espressione===builtBody?.espressione&&!!savedBody?.esercizio,{built:builtBody?.espressione,saved:savedBody?.espressione});
        check('il sid della sessione viene conservato nella navigazione',new URL(page.url()).searchParams.get('sid')===fixture.name,page.url());
      } else {
        await page.goto(`${base}/esercizio?sid=${encodeURIComponent(fixture.name)}&${student}`);
      }
      const first=page.locator('[data-box=b1]');
      await first.waitFor();
      check('espressione corretta caricata nella sessione',await page.locator('annotation').first().textContent()===fixture.esercizio.espressioneLatex);
      check('risposta non compilata e nessun risultato finale anticipato',await page.getByText('RISULTATO FINALE',{exact:true}).count()===0 && await page.locator('[data-testid=pillola-formula-risolta]').count()===0 && await page.getByRole('button',{name:"Scarica il PDF con tutti i passaggi dell'espressione"}).count()===0);
      if(fixture.name==='aritmetica-progressiva') {
        const body=await page.locator('.expr-exercise-scroll').innerText();
        check('il testo e gli ausili del modello non anticipano il primo risultato',!body.includes('12'),body.slice(0,1200));
      }
      async function insert(id,value) {
        const box=page.locator(`[data-box=b${id}]`);
        await box.getByTitle('Inserisci manualmente il valore',{exact:true}).click();
        const input=box.getByRole('textbox',{name:'Digita il valore da tastiera'});
        await input.fill(value); await input.press('Enter');
        return box;
      }
      await insert(1,fixture.wrong);
      await first.getByText('RISULTATO SBAGLIATO. CALCOLA DI NUOVO',{exact:true}).waitFor();
      check('risposta errata non rivela risultato e non apre il box seguente',await page.locator('[data-box=b2]').count()===0 && await page.locator('[data-testid=pillola-formula-risolta]').count()===0 && await page.getByText('RISULTATO FINALE',{exact:true}).count()===0);
      for(let i=0;i<fixture.answers.length;i++) {
        const box=await insert(i+1,fixture.answers[i]);
        if (i===fixture.answers.length-1) {
          const continua=page.getByRole('button',{name:'CONTINUA',exact:true});await continua.waitFor({timeout:10000});
          check('terza pagina completata senza pulsante PDF',await page.getByRole('button',{name:/Scarica il PDF/}).count()===0);
          await continua.click();
          const feedback=page.locator('[data-testid=feedback-finale]');
          await feedback.waitFor({timeout:10000});
          check('schermata finale distinta con conteggio dei primi tentativi',
            (await feedback.innerText()).toLocaleLowerCase('it').includes(`${fixture.answers.length-1} su ${fixture.answers.length}`));
          check('la schermata finale non ripete il risultato',!(await feedback.innerText()).includes('RISULTATO FINALE')&&await feedback.locator('.katex,annotation').count()===0);
          await feedback.getByRole('button',{name:'RIVEDI I PASSAGGI'}).click();
        }
        await box.locator('[data-testid=pillola-formula-risolta]').waitFor({timeout:10000});
        const annotation=await box.locator('[data-testid=pillola-formula-risolta] annotation').textContent();
        check(`risposta ${i+1} confermata e riga coerente`,annotation===fixture.esercizio.righeProgressive[i+1],{annotation,expected:fixture.esercizio.righeProgressive[i+1]});
        if(i<fixture.answers.length-1) {
          if(fixture.name==='quadre-graffe' && i===0) {
            check('il passaggio mantiene graffe e quadre annidate',annotation.includes('\\left\\{\\left['),annotation);
            await box.locator('[data-testid=pillola-formula-risolta]').scrollIntoViewIfNeeded();
            await page.screenshot({path:path.join(out,`${viewport.name}-quadre-graffe-passaggio.png`)});
          }
          check(`dopo il passaggio ${i+1} il risultato finale è ancora nascosto`,await page.getByText('RISULTATO FINALE',{exact:true}).count()===0);
          await page.locator(`[data-box=b${i+2}]`).waitFor();
        }
      }
      await page.getByText('RISULTATO FINALE',{exact:true}).waitFor();
      check('tornando ai passaggi non appare alcun PDF',await page.getByRole('button',{name:/Scarica il PDF/}).count()===0);
      await page.getByRole('button',{name:'CONTINUA',exact:true}).click();
      const pdf=page.locator('[data-testid=feedback-finale]').getByRole('button',{name:"Scarica il PDF con tutti i passaggi dell'espressione"});
      await pdf.scrollIntoViewIfNeeded();
      await page.evaluate(()=>{window.__qaPdfHtml='';window.open=()=>({document:{write:html=>{window.__qaPdfHtml=html},close:()=>{}}});});
      await pdf.click();
      const captured=await page.evaluate(()=>{const html=window.__qaPdfHtml,d=new DOMParser().parseFromString(html,'text/html');return {html,text:d.body.textContent,rows:[...d.querySelectorAll('annotation')].map(x=>x.textContent),punteggio:d.querySelector('.pdf-primo-colpo')?.textContent?.trim()};});
      check('il PDF contiene dati sintetici e tutte le sole righe svolte',captured.text.includes('QA Percorso')&&captured.text.includes('Classe 3A')&&captured.text.includes('RISULTATO FINALE')&&fixture.esercizio.righeProgressive.every(r=>captured.rows.includes(r)),captured.rows);
      check('nel PDF il primo tentativo sbagliato resta conteggiato come nel feedback',captured.punteggio===`Risposte giuste al primo colpo: ${fixture.answers.length-1} su ${fixture.answers.length}`,captured.punteggio);
      check('il documento PDF non eredita il limite di altezza schermo',!/expr-exercise-frame|expr-exercise-scroll|max-height/.test(captured.html));
      if(fixture.name==='frazioni-letterali-foto') {
        check('nel PDF la frazione letterale risolta rimane impilata',captured.rows[1]?.includes('\\dfrac')&&!captured.rows[1]?.includes(' : '),captured.rows[1]);
      }
      if(fixture.name==='quadre-graffe') {
        check('nel PDF il passaggio conserva graffe e quadre annidate',captured.rows[1]?.includes('\\left\\{\\left['),captured.rows[1]);
      }
      check('nessuna chiamata API reale o inattesa',row.unexpectedApi.length===0,row.unexpectedApi);
      check('nessun errore JavaScript nella pagina',row.errors.length===0,row.errors);
      if(['aritmetica-progressiva','frazioni-letterali-foto','quadre-graffe'].includes(fixture.name)) {
        await fs.writeFile(path.join(out,`${viewport.name}-${fixture.name}.html`),captured.html);
        await page.screenshot({path:path.join(out,`${viewport.name}-${fixture.name}.png`)});
      }
      row.ok=true;
    } catch(err) {
      row.ok=false;row.error=String(err?.message??err);
      await page.screenshot({path:path.join(out,`${viewport.name}-${fixture.name}-FAILED.png`)}).catch(()=>{});
    }
    console.log(row.viewport,row.scenario,row.ok?'OK':'FAIL',row.checks.length,row.error??'');
    results.push(row);
    await context.close();
  }
}
// Sessione inesistente: attendere realmente la risposta simulata; il default
// deve restare nascosto SIA durante il caricamento SIA dopo l'errore.
for (const viewport of viewports) {
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:!!viewport.touch,hasTouch:!!viewport.touch});
  const page=await context.newPage();
  const row={scenario:'sessione-inesistente',viewport:viewport.name,checks:[],unexpectedApi:[],errors:[]};
  const check=(name,ok,detail)=>{row.checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
  page.on('pageerror',e=>row.errors.push(e.message));
  await page.route('**/api/**',async route=>{
    if(new URL(route.request().url()).pathname==='/api/esercizio/sessione/inesistente') {
      await new Promise(resolve=>setTimeout(resolve,1800));
      return route.fulfill({status:404,contentType:'application/json',body:'{"error":"fixture inesistente"}'});
    }
    row.unexpectedApi.push(route.request().url());
    return route.fulfill({status:503,contentType:'application/json',body:'{}'});
  });
  try {
    await page.goto(`${base}/esercizio?sid=inesistente`);
    await page.getByRole('status').filter({hasText:'Carico lo svolgimento'}).waitFor();
    check('nessun esercizio predefinito durante il caricamento',await page.locator('[data-box]').count()===0);
    await page.getByRole('alert').waitFor();
    check('sessione assente: avviso senza un esercizio diverso',await page.locator('[data-box]').count()===0&&await page.getByText("L'ESPRESSIONE DA RISOLVERE",{exact:true}).count()===0);
    check('nessuna API inattesa o errore JavaScript',row.unexpectedApi.length===0&&row.errors.length===0);
    row.ok=true;
  } catch(err){row.ok=false;row.error=String(err?.message??err);}
  console.log(row.viewport,row.scenario,row.ok?'OK':'FAIL',row.checks.length,row.error??'');
  results.push(row);await context.close();
}
// Il documento HTML generato dal pulsante reale viene anche renderizzato in
// A4 da Chromium; il CSS KaTeX è servito dal pacchetto locale, nessun CDN.
for (const {fixture, label} of [
  {fixture:'frazioni-letterali-foto',label:'frazioni-letterali'},
  {fixture:'quadre-graffe',label:'quadre-graffe'},
]) {
  let context;
  try {
    const html=await fs.readFile(path.join(out,`desktop-${fixture}.html`),'utf8');
    context=await browser.newContext();const page=await context.newPage();
    await page.route('https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/**',async route=>{
      const file=path.basename(new URL(route.request().url()).pathname);
      const target=file==='katex.min.css'?path.join(katexDir,file):path.join(katexDir,'fonts',file);
      try {return route.fulfill({path:target,headers:{'access-control-allow-origin':'*','cross-origin-resource-policy':'cross-origin'}});}
      catch {return route.abort();}
    });
    await page.setContent(html.replace(/<script>window\.onload=function\(\)\{window\.print\(\)\}<\/script>/,''),{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    await page.pdf({path:path.join(out,`verifica-${label}.pdf`),format:'A4',printBackground:true,preferCSSPageSize:true});
    await page.screenshot({path:path.join(out,`verifica-${label}-pdf.png`),fullPage:true});
    console.log(`PDF sintetico A4 ${label} renderizzato con il CSS KaTeX locale`);
  } catch(err) {
    results.push({scenario:`render-pdf-a4-${label}`,viewport:'desktop',ok:false,error:String(err?.message??err),checks:[]});
    console.error(`render-pdf-a4-${label} FAIL`,err);
  } finally {
    if (context) await context.close();
  }
}
await browser.close();
await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');
console.log(`RISULTATI ${results.filter(x=>x.ok).length}/${results.length}`);
if(results.some(x=>!x.ok))process.exitCode=1;

