import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs/promises';
import path from 'node:path';

const base = process.env.QA_URL || 'http://127.0.0.1:3000';
const fixtures = JSON.parse(await fs.readFile('/tmp/qa-razionalizzazione-fixtures.json', 'utf8'));
const out = '/tmp/qa-razionalizzazione';
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({headless:true, args:['--no-sandbox'], ...(process.env.QA_CHROMIUM ? {executablePath:process.env.QA_CHROMIUM} : {})});
const results = [];
for (const vp of [{name:'desktop',width:1280,height:800},{name:'telefono',width:393,height:780,touch:true}]) {
  for (const f of fixtures) {
    const context = await browser.newContext({ viewport:{width:vp.width,height:vp.height}, hasTouch:!!vp.touch, isMobile:!!vp.touch });
    const page = await context.newPage();
    const row={name:f.name,viewport:vp.name,checks:[],errors:[],api:[]};
    const check=(name,ok)=>{row.checks.push({name,ok:!!ok});if(!ok)throw Error(name)};
    page.on('pageerror',e=>row.errors.push(e.message));
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      if (route.request().method()==='GET' && url.pathname === '/api/esercizio/sessione/qa-rad')
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({esercizio:f.esercizio})});
      row.api.push(`${route.request().method()} ${url.pathname}`);
      return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    });
    try {
      await page.goto(`${base}/esercizio?sid=qa-rad&nome=Test&cognome=QA&classe=3A`,{waitUntil:'domcontentloaded'});
      const box=page.locator('[data-box=b1]'); await box.waitFor({timeout:15000});
      const text=await box.innerText();
      check('box guidato senza il vecchio invito a lasciare invariata la frazione', /numeratore e denominatore per la stessa radice/i.test(text) && !/lascio la somma/i.test(text));
      check('nessun risultato mostrato prima della risposta', await page.locator('[data-testid=pillola-formula-risolta]').count()===0 && await page.getByText('RISULTATO FINALE',{exact:true}).count()===0);
      await box.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,`${vp.name}-${f.name}-inizio.png`)});
      const insert=async text => {
        await box.getByTitle('Inserisci manualmente il valore',{exact:true}).click();
        const input=box.getByRole('textbox',{name:'Digita il valore da tastiera'});
        await input.fill(text); await input.press('Enter');
      };
      await insert(f.wrong);
      await box.getByText('COMPLETA IL CALCOLO PRIMA DI PROSEGUIRE.',{exact:true}).waitFor({timeout:10000});
      check('non accetta la stessa espressione non trasformata', await page.locator('[data-testid=pillola-formula-risolta]').count()===0 && await page.getByRole('button',{name:'CONTINUA',exact:true}).count()===0);
      await insert(f.answer);
      await box.locator('[data-testid=pillola-formula-risolta]').waitFor({timeout:10000});
      check('accetta una risposta corretta digitata dallo studente', await page.getByRole('button',{name:'CONTINUA',exact:true}).isVisible());
      check('nessuna API reale o errore JavaScript', row.api.length===0 && row.errors.length===0);
      await page.screenshot({path:path.join(out,`${vp.name}-${f.name}.png`)});
      row.ok=true;
    } catch(e) {
      row.ok=false;row.error=String(e?.message??e);
      await page.screenshot({path:path.join(out,`${vp.name}-${f.name}-FAILED.png`)}).catch(()=>{});
    }
    console.log(`${row.viewport} ${row.name} ${row.ok?'OK':'FAIL'} ${row.error??''}`);
    results.push(row);await context.close();
  }
}
await browser.close();
await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
if(results.some(r=>!r.ok))process.exitCode=1;

