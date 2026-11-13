import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

// QA isolata della cornice del blog: l'iframe è un documento sintetico
// intercettato da Playwright. Nessun post viene modificato e nessuna API IA o
// database viene chiamata. Verifica il ping anticipato su un salto sospetto.
const BASE=process.env.FRAME_BLOG_URL||'http://127.0.0.1:3000';
const ROOT=process.env.FRAME_PROJECT_DIR||process.cwd();
const OUT=process.env.FRAME_BLOG_OUTPUT||'/tmp/frame-blog-sync';
await fs.mkdir(OUT,{recursive:true});
const source=await fs.readFile(path.join(ROOT,'cornice-dinamica/embed-espressioni-dedicata.html'),'utf8');
const prod="var APP_URL = 'https://espressioni-monomi-polinomi.easy-peasy.site/';";
if(source.split(prod).length!==2)throw new Error('APP_URL assente o non univoco');
const snippet=source.replace(prod,"var APP_URL = window.location.origin + '/__qa-child';")
  .replaceAll('https://espressioni-monomi-polinomi.easy-peasy.site/fonts/','/fonts/');

const child=`<!doctype html><html lang="it"><meta charset="utf-8"><body>Figlio di prova
<script>
  var token = new URLSearchParams(location.search).get('cornice');
  window.qaPings = 0;
  window.qaCandidate = null;
  window.qaSend = function(height, candidateToken) {
    parent.postMessage({type:'labvisivo:height',height:height,cornice:candidateToken||token},location.origin);
  };
  window.qaRequest = function(height) { window.qaCandidate=height; window.qaSend(height); };
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'labvisivo:ping') {
      window.qaPings++;
      if (window.qaCandidate !== null) window.qaSend(window.qaCandidate);
    }
  });
  window.addEventListener('load', function(){ window.qaSend(500); });
</script></body></html>`;

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
for(const c of [{name:'desktop',width:1280,height:800},{name:'telefono',width:390,height:780,touch:true}]){
 const ctx=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:!!c.touch,hasTouch:!!c.touch});
 const page=await ctx.newPage(),checks=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const check=(name,ok,detail)=>checks.push({name,ok:Boolean(ok),detail});
 try{
  await page.route(BASE+'/__qa-frame-blog',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><main>${snippet}</main>`}));
  await page.route(BASE+'/__qa-child**',route=>route.fulfill({contentType:'text/html',body:child}));
  await page.goto(BASE+'/__qa-frame-blog');
  const iframe=page.locator('iframe.lf-iframe');
  await page.waitForFunction(()=>{
    const f=document.querySelector('iframe.lf-iframe');
    return f?.style.height==='500px'&&f.contentWindow?.qaSend;
  },null,{timeout:10000});
  const details=await iframe.evaluate(el=>({id:el.id,token:new URL(el.src).searchParams.get('cornice'),initialHeight:el.style.height}));
  check('token e altezza iniziale',Boolean(details.token)&&details.id.endsWith(details.token)&&details.initialHeight==='500px',details);
  await iframe.evaluate(el=>el.contentWindow.qaSend(2300,'token-sbagliato'));
  await page.waitForTimeout(350);
  check('token sbagliato ignorato',await iframe.evaluate(el=>el.style.height)==='500px');
  await page.evaluate(()=>window.postMessage({type:'labvisivo:height',height:2200},location.origin));
  await page.waitForTimeout(350);
  check('messaggio esterno alla propria cornice ignorato',await iframe.evaluate(el=>el.style.height)==='500px');
  const pingPrima=await iframe.evaluate(el=>el.contentWindow.qaPings);
  await iframe.evaluate(el=>el.contentWindow.qaRequest(2300));
  await page.waitForTimeout(50);
  check('il primo salto non viene applicato senza conferma',await iframe.evaluate(el=>el.style.height)==='500px');
  await page.waitForFunction(()=>document.querySelector('iframe.lf-iframe')?.style.height==='2300px',null,{timeout:1800});
  const after=await iframe.evaluate(el=>({height:el.style.height,pings:el.contentWindow.qaPings}));
  check('ping anticipato chiede conferma e applica il salto legittimo',after.pings>pingPrima&&after.height==='2300px',{pingPrima,...after});
  check('nessun errore JavaScript',errors.length===0,errors);
  await page.locator('.lf-testata').screenshot({path:path.join(OUT,`${c.name}-testata.png`)});
  results.push({scenario:c.name,ok:checks.every(x=>x.ok),checks});
 }catch(error){
  await page.screenshot({path:path.join(OUT,`${c.name}-FAIL.png`)}).catch(()=>{});
  results.push({scenario:c.name,ok:false,checks,error:String(error?.message||error)});
 }
 await ctx.close();
}
await browser.close();
await fs.writeFile(path.join(OUT,'results.json'),JSON.stringify(results,null,2)+'\n');
for(const r of results)console.log(r.scenario,r.ok?'OK':'FAIL',r.checks.length,r.error||r.checks.filter(x=>!x.ok).map(x=>x.name).join('; '));
console.log(`RISULTATI ${results.filter(x=>x.ok).length}/${results.length}`);
if(results.some(x=>!x.ok))process.exitCode=1;

