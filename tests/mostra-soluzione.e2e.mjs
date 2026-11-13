import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs/promises';
import path from 'node:path';

// Fixture didattiche sintetiche, tutte le API sono intercettate; non vengono
// lette o scritte sessioni, cache o esercizi dell'utente.
const base = process.env.QA_URL || 'http://127.0.0.1:3000';
const out = '/tmp/qa-mostra-soluzione';
await fs.mkdir(out,{recursive:true});
const fixture = (op, answer, extra={}) => ({espressioneLatex:op, sezioni:[{title:'CALCOLO',boxes:[{op,answerLatex:answer,prompt:'Eseguo il calcolo.',...extra}]}], righeProgressive:[op,answer],risultatoFinaleLatex:answer});
const cases = [
  {nome:'frazione', esercizio:fixture('\\dfrac{2}{6}','\\dfrac{1}{3}')},
  {nome:'radicale-letterale', esercizio:fixture('\\dfrac{ab+1}{\\sqrt{ab+1}}+3','\\sqrt{ab+1}+3',{simbolico:true,criterioDidattico:'radicale_trasformato'})},
  {nome:'fratta', esercizio:fixture('\\dfrac{x^2+6x}{-x^2+3x+4}','\\dfrac{x^2+6x}{-x^2+3x+4}',{simbolico:true})},
  {nome:'indice-negativo', esercizio:fixture('\\sqrt[-3]{a+1}\\cdot1','\\sqrt[-3]{a+1}',{simbolico:true})},
  {nome:'indice-12', esercizio:fixture('\\sqrt[12]{a+1}\\cdot1','\\sqrt[12]{a+1}',{simbolico:true})},
  {nome:'quattro-variabili', esercizio:fixture('\\sqrt{a+b+c+x}\\cdot1','\\sqrt{a+b+c+x}',{simbolico:true})},
  {nome:'due-box', esercizio:{espressioneLatex:'1+1+2',sezioni:[{title:'CALCOLO',boxes:[{op:'1+1',answerLatex:'2',prompt:'Sommo.'},{op:'2+2',answerLatex:'4',prompt:'Sommo ancora.'}]}],righeProgressive:['1+1+2','2+2','4'],risultatoFinaleLatex:'4'}},
];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
for(const viewport of [{nome:'desktop',width:1280,height:800},{nome:'telefono',width:390,height:780,touch:true}]) for(const c of cases){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},hasTouch:!!viewport.touch,isMobile:!!viewport.touch});
  const page=await context.newPage();
  const row={viewport:viewport.nome,caso:c.nome,checks:[],errors:[],api:[]};
  const check=(test,ok)=>{row.checks.push({test,ok:!!ok});if(!ok)throw Error(test)};
  page.on('pageerror',e=>row.errors.push(e.message));
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url());
    if(route.request().method()==='GET' && url.pathname==='/api/esercizio/sessione/qa-mostra') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({esercizio:c.esercizio})});
    row.api.push(route.request().method()+' '+url.pathname);
    return route.fulfill({status:503,contentType:'application/json',body:'{}'});
  });
  try {
    await page.goto(`${base}/esercizio?sid=qa-mostra&nome=Test&cognome=QA&classe=3A`,{waitUntil:'domcontentloaded'});
    const count=c.esercizio.sezioni[0].boxes.length;
    for(let i=1;i<=count;i++){
      const box=page.locator(`[data-box=b${i}]`);await box.waitFor({timeout:12000});
      const button=box.getByTestId('mostra-soluzione');await button.waitFor({timeout:12000});
      check(`box ${i}: risposta inizialmente nascosta`,await box.getByTestId('soluzione-calcolatrice').count()===0 && await button.getAttribute('aria-expanded')==='false');
      check(`box ${i}: nessun inserimento automatico`,await page.locator('[data-testid=pillola-formula-risolta]').count()===i-1);
      await button.click();
      const solution=box.getByTestId('soluzione-calcolatrice');await solution.waitFor();
      const testo=(await solution.innerText()).trim();
      check(`box ${i}: notazione lineare`,!!testo && !/\n|\\|[{}]|non disponibile/i.test(testo));
      if(c.nome==='radicale-letterale' || c.nome==='indice-negativo' || c.nome==='indice-12') check(`box ${i}: variabili minuscole`, /[a-z]/.test(testo) && !/[A-Z]/.test(testo));
      check(`box ${i}: apertura non risolve`,await page.locator('[data-testid=pillola-formula-risolta]').count()===i-1 && await button.getAttribute('aria-expanded')==='true');
      const rects = await Promise.all([
        box.getByTitle('Inserisci manualmente il valore',{exact:true}).boundingBox(),
        box.getByTestId('calculator-open').boundingBox(), button.boundingBox(), solution.boundingBox(),
      ]);
      const overlaps=(a,b)=>a && b && Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>0.5 && Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>0.5;
      check(`box ${i}: pulsanti senza sovrapposizioni`,rects.every(Boolean) && !overlaps(rects[0],rects[1]) && !overlaps(rects[0],rects[2]) && !overlaps(rects[1],rects[2]) && !overlaps(rects[2],rects[3]));
      check(`box ${i}: soluzione su una riga`,await solution.locator('span').evaluate(el=>getComputedStyle(el).whiteSpace==='nowrap'));
      if(i===1){
        await box.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(out,`${viewport.nome}-${c.nome}-visibile.png`)});
      }
      await button.click();
      check(`box ${i}: secondo clic nasconde`,await box.getByTestId('soluzione-calcolatrice').count()===0 && await button.getAttribute('aria-expanded')==='false');
      await button.click();
      await box.getByTitle('Inserisci manualmente il valore',{exact:true}).click();
      const input=box.getByRole('textbox',{name:'Digita il valore da tastiera'});
      check(`box ${i}: input resta vuoto`,await input.inputValue()==='');
      const editingButton=box.getByTestId('mostra-soluzione');
      await editingButton.click();
      check(`box ${i}: si nasconde anche mentre si digita`,await box.getByTestId('soluzione-calcolatrice').count()===0);
      await input.fill(testo);await input.press('Enter');
      await box.locator('[data-testid=pillola-formula-risolta]').waitFor({timeout:10000});
      check(`box ${i}: soluzione digitata accettata`,await box.locator('[data-testid=pillola-formula-risolta]').count()===1);
    }
    check('esercizio risolto solo dopo inserimento',await page.getByRole('button',{name:'CONTINUA',exact:true}).isVisible());
    check('nessuna API reale o errore JavaScript',row.api.length===0 && row.errors.length===0);
    row.ok=true;
  }catch(e){row.ok=false;row.error=String(e?.message??e);await page.screenshot({path:path.join(out,`${viewport.nome}-${c.nome}-errore.png`)}).catch(()=>{});}
  console.log(`${row.viewport} ${row.caso} ${row.ok?'OK':'FAIL'} ${row.error??''}`);
  results.push(row);await context.close();
}
await browser.close();
await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
if(results.some(r=>!r.ok))process.exitCode=1;

