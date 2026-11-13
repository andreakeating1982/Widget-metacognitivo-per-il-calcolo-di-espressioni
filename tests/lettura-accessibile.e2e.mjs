import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import http from 'node:http';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// API sempre simulate; nessuna sessione, cache, o chiamata IA dell'utente.
const base = process.env.QA_URL || 'http://127.0.0.1:3043';
const executablePath = process.env.QA_CHROMIUM || undefined;
await fs.mkdir('/tmp/widget-tts-qa',{recursive:true});
const op = String.raw`\dfrac{2{,}05}{\sqrt[-13]{x+1}}+0{,}\overline{06}`;
const fixture = { espressioneLatex: op, sezioni:[{title:'CALCOLO', boxes:[{op, answerLatex:'987654321', prompt:'Eseguo il calcolo.'}]}], righeProgressive:[op,'987654321'], risultatoFinaleLatex:'987654321' };
// Un piccolo blog di prova su un'altra porta rende il collaudo cross-origin
// ripetibile senza toccare il post vero né scrivere file nel progetto.
let blogServer;
let blogUrl = process.env.QA_BLOG_URL;
if (!blogUrl) {
  const source = await fs.readFile('cornice-dinamica/embed-espressioni-dedicata.html','utf8');
  const appMarker = "var APP_URL = 'https://espressioni-monomi-polinomi.easy-peasy.site/';";
  if (source.split(appMarker).length !== 2) throw Error('URL della cornice assente o duplicato');
  const snippet = source
    .replace(appMarker, `var APP_URL = '${base.replace(/\/$/, '')}/';`)
    .replaceAll('https://espressioni-monomi-polinomi.easy-peasy.site/fonts/', `${base.replace(/\/$/, '')}/fonts/`);
  const body = `<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${snippet}</body></html>`;
  blogServer = http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(body)});
  await new Promise(resolve=>blogServer.listen(0,'127.0.0.1',resolve));
  blogUrl=`http://127.0.0.1:${blogServer.address().port}/`;
}
const browser = await chromium.launch({headless:true, executablePath, args:['--no-sandbox']});
const results = [];
for (const screen of [
  {name:'desktop-stessa-origine', width:1280, height:820, touch:false, cross:false},
  {name:'telefono-stessa-origine', width:390, height:780, touch:true, cross:false},
  {name:'desktop-origini-diverse', width:1280, height:820, touch:false, cross:true},
  {name:'telefono-origini-diverse', width:390, height:780, touch:true, cross:true},
]) {
  const context = await browser.newContext({viewport:{width:screen.width,height:screen.height}, hasTouch:screen.touch, isMobile:screen.touch});
  // Si catturano i segmenti realmente inviati all'API del browser: non si
  // pretende di misurare il timbro o la pronuncia dell'altoparlante.
  await context.addInitScript(() => {
    window.__tts = { chunks:[], auto:true, generation:0, cancelled:0 };
    class FakeUtterance { constructor(text) { this.text = text; } }
    const synth = {
      speaking:false,
      getVoices:() => [{lang:'it-IT',name:'Voce italiana test',localService:true}],
      addEventListener:()=>{}, removeEventListener:()=>{},
      cancel(){ window.__tts.generation++; window.__tts.cancelled++; this.speaking=false; },
      speak(u){
        const generation=window.__tts.generation;
        window.__tts.chunks.push(u.text); this.speaking=true;
        if (u.onstart) u.onstart();
        if (window.__tts.auto) setTimeout(()=>{
          if (window.__tts.generation!==generation) return;
          this.speaking=false; if (u.onend) u.onend();
        },0);
      },
    };
    Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{value:FakeUtterance,configurable:true});
  });
  const page = await context.newPage();
  const row={screen:screen.name, checks:[], errors:[], unexpectedApi:[]};
  const check=(name,ok,detail='')=>{row.checks.push({name,ok:!!ok,detail});if(!ok)throw Error(`${name}: ${detail}`)};
  page.on('pageerror',e=>row.errors.push(e.message));
  page.on('requestfailed',r=>row.errors.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text())});
  await page.route('**/api/**', route => {
    const u=new URL(route.request().url());
    if (route.request().method()==='GET' && u.pathname==='/api/esercizio/sessione/qa-tts')
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({esercizio:fixture})});
    row.unexpectedApi.push(`${route.request().method()} ${u.pathname}`);
    return route.fulfill({status:503,contentType:'application/json',body:'{}'});
  });
  async function read(frame) {
    await frame.evaluate(()=>{window.__tts.chunks=[];window.__tts.auto=true;});
    await frame.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).click();
    await frame.waitForFunction(()=>window.__tts.chunks.length>0 && !window.speechSynthesis.speaking,{timeout:20000});
    return await frame.evaluate(()=>({chunks:[...window.__tts.chunks],text:window.__tts.chunks.join(' ').toLowerCase()}));
  }
  try {
    if (screen.cross) {
      // L'host del post e quello dell'app differiscono, come nel blog Blogger.
      await page.goto(blogUrl,{waitUntil:'domcontentloaded'});
    } else await page.goto(`${base}/anteprima-cornice.html`,{waitUntil:'domcontentloaded'});
    await page.locator('iframe').first().waitFor();
    const iframeElement=await page.locator('iframe').first().elementHandle();
    const frame=await iframeElement.contentFrame();
    if(!frame) throw Error('Cornice senza app');
    if(screen.cross) {
      await frame.waitForURL(url => url.origin === new URL(base).origin, {timeout:15000});
      check('post e app su origini diverse',new URL(page.url()).origin !== new URL(frame.url()).origin,`${page.url()} | ${frame.url()}`);
    }
    await frame.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).waitFor({timeout:20000});
    let got=await read(frame);
    check('pagina iniziale: intestazione letta',got.text.includes('widget metacognitivo'),got.text);
    check('pagina iniziale: pulsante ENTRA letto',got.text.includes('pulsante entra'),got.text);
    check('pagina iniziale: campi annunciati',got.text.includes('campo nome') && got.text.includes('campo cognome'),got.text);
    check('prima pagina: nessun segmento eccessivo',got.chunks.every(c=>c.length<=180));

    await frame.getByLabel('Nome',{exact:true}).fill('Studente');
    await frame.getByLabel('Cognome',{exact:true}).fill('Prova');
    await frame.evaluate(()=>{window.__tts.auto=false;});
    await frame.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).click();
    await frame.getByRole('button',{name:'ENTRA',exact:true}).click();
    await frame.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).waitFor();
    check('cambio pagina ferma la lettura precedente',await frame.evaluate(()=>!window.speechSynthesis.speaking));
    await frame.getByRole('button',{name:'TRASCRIZIONE AUDIO E CON TASTIERA'}).click();
    await frame.getByLabel('Notazione da tastiera').fill('0,1_6per+rad13(x+1)+2,05');
    got=await read(frame);
    check('pagina input: pulsante e campo letti',got.text.includes('pulsante chiudi la trascrizione') && got.text.includes('campo notazione da tastiera'),got.text);
    check('pagina input: decimale con zero pronunciato',got.text.includes('due virgola zero cinque'),got.text);
    check('pagina input: periodo pronunciato',got.text.includes('periodo sei fine periodo'),got.text);
    check('pagina input: radice indice 13 pronunciata',got.text.includes('radice con indice tredici di'),got.text);

    // Carica la pagina di svolgimento soltanto con la fixture intercettata.
    await frame.goto(`${base}/esercizio?sid=qa-tts&nome=Studente&cognome=Prova`,{waitUntil:'domcontentloaded'});
    await frame.locator('[data-box=b1]').waitFor({timeout:20000});
    await frame.evaluate(()=>{
      const hidden=document.createElement('div'); hidden.style.display='none'; hidden.textContent='nonleggereottomila'; document.body.append(hidden);
      const hiddenAria=document.createElement('div'); hiddenAria.setAttribute('aria-hidden','true');hiddenAria.textContent='nonleggerenovemila'; document.body.append(hiddenAria);
      const invisible=document.createElement('div');invisible.className='sr-only';invisible.textContent='nonleggerediecimila';document.body.append(invisible);
      const long=document.createElement('p');long.textContent='inizioverificalunga '+Array.from({length:200},(_,i)=>`parola${i}`).join(' ')+' fineverificalunga';document.body.append(long);
    });
    got=await read(frame);
    check('esercizio: frazione e radice lette',got.text.includes('inizio frazione') && got.text.includes('radice con indice meno tredici di') && got.text.includes('fine frazione'),got.text);
    check('esercizio: decimale e periodo letti',got.text.includes('due virgola zero cinque') && got.text.includes('periodo zero sei fine periodo'),got.text);
    check('esercizio: pulsanti letti',got.text.includes('pulsante mostra soluzione') && got.text.includes('pulsante calcolatrice') && got.text.includes('pulsante riconosci'),got.text);
    check('esercizio: nessuna soluzione prima del clic',!got.text.includes('987654321'),got.text);
    check('contenuti nascosti esclusi',!got.text.includes('nonleggereottomila')&&!got.text.includes('nonleggerenovemila')&&!got.text.includes('nonleggerediecimila'),got.text);
    check('lettura lunga arriva alla fine',got.text.includes('inizioverificalunga')&&got.text.includes('fineverificalunga')&&got.chunks.length>5,got.text.slice(-250));
    check('esercizio: nessun segmento oltre 180 caratteri',got.chunks.every(c=>c.length<=180));
    await frame.getByTestId('mostra-soluzione').click();
    got=await read(frame);
    check('soluzione letta solo quando è visibile',got.text.includes('soluzione in formato calcolatrice')&&got.text.includes('987654321'),got.text);
    await frame.evaluate(()=>{window.__tts.auto=false;});
    await frame.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).click();
    await frame.getByTestId('mostra-soluzione').click();
    check('chiudere la soluzione ferma la lettura precedente',await frame.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).isVisible() && await frame.evaluate(()=>!window.speechSynthesis.speaking));
    got=await read(frame);
    check('soluzione non letta dopo che viene nascosta',!got.text.includes('987654321'),got.text);
    // La seconda pressione interrompe anche se la voce non è ancora partita.
    await frame.evaluate(()=>{window.__tts.chunks=[];window.__tts.auto=false;});
    await frame.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).click();
    await frame.getByRole('button',{name:'Ascolto: interrompi la lettura ad alta voce'}).click();
    check('stop immediato',await frame.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).isVisible() && await frame.evaluate(()=>!window.speechSynthesis.speaking));
    check('nessuna API reale o errore JavaScript',row.unexpectedApi.length===0 && row.errors.length===0,JSON.stringify({api:row.unexpectedApi,errors:row.errors}));
    row.ok=true;
  } catch(e) { row.ok=false;row.error=String(e?.message??e);row.frames=page.frames().map(f=>f.url());await page.screenshot({path:`/tmp/widget-tts-qa/${screen.name}-error.png`}).catch(()=>{}); }
  console.log(`${row.screen}: ${row.ok?'OK':'ERRORE'} ${row.error??''} (${row.checks.length} controlli)`);
  results.push(row); await context.close();
}
await browser.close();
if (blogServer) await new Promise(resolve=>blogServer.close(resolve));
await fs.writeFile('/tmp/widget-tts-qa/risultati.json',JSON.stringify(results,null,2));
if(results.some(r=>!r.ok))process.exitCode=1;

