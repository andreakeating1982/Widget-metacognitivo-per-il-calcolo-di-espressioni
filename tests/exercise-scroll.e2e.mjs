import { chromium } from 'playwright';
import fs from 'node:fs/promises';

// Layout-only QA: synthetic exercise sessions, no real AI/database calls.
// Copy into the existing QA environment with Playwright; no runtime test route.
const BASE=process.env.EXERCISE_SCROLL_URL??'http://127.0.0.1:3000';
const OUT=process.env.EXERCISE_SCROLL_OUTPUT??'/tmp/exercise-scroll-qa';
await fs.mkdir(OUT,{recursive:true});
const longPrompt=('Rileggo i segni, individuo la singola operazione da eseguire e scrivo personalmente il risultato prima di procedere. ').repeat(5);
const longExercise={
 espressioneLatex:'2+3+4+1',
 sezioni:[{title:'1. CALCOLO UN PASSAGGIO ALLA VOLTA',boxes:[
  {id:'b1',op:'2+3',prompt:longPrompt,answerLatex:'5'},
  {id:'b2',op:'5+4',answerLatex:'9'},
  {id:'b3',op:'9+1',answerLatex:'10'},
 ]}],
 righeProgressive:['2+3+4+1','5+4+1','9+1','10'],risultatoFinaleLatex:'10',
};
const shortExercise={espressioneLatex:'2+3',sezioni:[{title:'1. CALCOLO',boxes:[{id:'b1',op:'2+3',answerLatex:'5'}]}],righeProgressive:['2+3','5'],risultatoFinaleLatex:'5'};
const allCases=[
 {name:'desktop',width:1280,height:800},
 {name:'mobile-320',width:320,height:568,touch:true},
 {name:'mobile-393',width:393,height:780,touch:true},
 {name:'landscape',width:740,height:360,touch:true},
 {name:'blog-mobile',width:393,height:780,touch:true,embed:true},
 {name:'blog-desktop',width:1280,height:800,embed:true},
 {name:'accessibilita-160',width:393,height:780,touch:true,embed:true,access:true},
];
const cases=process.env.EXERCISE_SCROLL_CASE?allCases.filter(c=>c.name===process.env.EXERCISE_SCROLL_CASE):allCases;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-features=LocalNetworkAccessChecks']});
const results=[];
for(const c of cases){
 const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:!!c.touch,hasTouch:!!c.touch,deviceScaleFactor:1});
 await context.addInitScript(access=>{
  localStorage.setItem('wms_access',JSON.stringify({fontScale:access?1.6:1,lineHeight:access?2.6:1.65,ruler:false,mode:access?'contrasto':'normale'}));
 },!!c.access);
 const page=await context.newPage();
 const row={name:c.name,checks:[]};
 const check=(name,ok,detail)=>{row.checks.push({name,ok:!!ok,detail});if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
 const errors=[],unexpectedApi=[];
 let fixture=longExercise,frame;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>{
  const req=r.request(),url=new URL(req.url());
  if(req.method()==='GET'&&url.pathname.startsWith('/api/esercizio/'))return r.fulfill({contentType:'application/json',body:JSON.stringify({esercizio:fixture})});
  unexpectedApi.push({path:url.pathname,method:req.method()});
  return r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated layout test"}'});
 });
 const APP=BASE+'/esercizio?sid=layout-fixture&cognome=QA&nome=Layout&classe=3A&data=2026-10-29';
 try{
  if(c.embed){
   await page.route('http://localhost:3000/__exercise-scroll-blog',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><header style="height:180px">Blog simulato — solo collaudo</header><iframe title="App" src="${APP}&cornice=exercise-scroll-test" style="display:block;border:0;width:100%;height:1600px"></iframe><footer style="height:900px">Fine post</footer><script>window.heights=[];addEventListener('message',e=>{const f=document.querySelector('iframe');if(e.source===f.contentWindow&&e.data?.type==='labvisivo:height'&&e.data.cornice==='exercise-scroll-test'){heights.push(e.data);f.style.height=e.data.height+'px'}})</script></body></html>`}));
   await page.goto('http://localhost:3000/__exercise-scroll-blog');
   frame=page.frames().find(f=>f.url().startsWith(BASE));
   await page.evaluate(()=>scrollTo(0,180));
  }else{await page.goto(APP);frame=page.mainFrame();}
  const shell=()=>frame.locator('.expr-exercise-frame');
  const scroll=()=>frame.locator('.expr-exercise-scroll');
  const measure=()=>frame.evaluate(()=>{
   const f=document.querySelector('.expr-exercise-frame'),s=document.querySelector('.expr-exercise-scroll'),t=document.querySelector('[role=toolbar]');
   return {frame:f.getBoundingClientRect().height,page:s.clientHeight,content:s.scrollHeight,top:s.scrollTop,toolbar:t.getBoundingClientRect().height,toolbarTop:t.getBoundingClientRect().top,docHeight:document.documentElement.scrollHeight,docWidth:document.documentElement.scrollWidth,width:document.documentElement.clientWidth,windowY:scrollY,overflow:getComputedStyle(s).overflowY,bar:getComputedStyle(s,'::-webkit-scrollbar').width,maxHeight:getComputedStyle(f).maxHeight,natural:document.querySelector('.lf-svolgimento').getBoundingClientRect().height};
  });
  await scroll().waitFor();
  await frame.getByText(longPrompt,{exact:true}).waitFor();
  await frame.evaluate(()=>document.fonts.ready);await page.waitForTimeout(750);
  const cap=c.embed?640:Math.min(640,c.height),initial=await measure();row.initial=initial;
  check('altezza massima compatta con contenuto lungo',Math.abs(initial.frame-cap)<=1&&initial.content>initial.page+40,{initial,cap});
  check('regione visibile, non collassata, accessibile da tastiera',initial.page>120&&await scroll().getAttribute('tabindex')==='0'&&await scroll().getAttribute('role')==='region',initial);
  check('scrollbar4px e nessun overflow orizzontale documento',initial.bar==='4px'&&initial.docWidth<=initial.width+1,initial);
  const typography=await frame.locator('h2').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),root:parseFloat(getComputedStyle(document.documentElement).fontSize)}));
  check('font della terza pagina invariati',Math.abs(typography.font-typography.root*1.125)<0.1,typography);
  check('nessun risultato o PDF anticipato',await frame.getByText('RISULTATO FINALE',{exact:true}).count()===0&&await frame.getByRole('button',{name:/Scarica il PDF/}).count()===0&&await frame.locator('[data-testid=pillola-formula-risolta]').count()===0&&await frame.locator('[data-box=b2]').count()===0);
  await scroll().focus();await page.keyboard.press('Control+End');await page.waitForTimeout(200);
  const keyboard=await measure();
  check('scorrimento interno da tastiera senza spostare toolbar',keyboard.top>50&&Math.abs(keyboard.toolbarTop-initial.toolbarTop)<1&&keyboard.windowY===initial.windowY,keyboard);
  await scroll().evaluate(el=>{el.scrollTop=0});
  if(c.embed)await page.evaluate(()=>scrollTo(0,180));
  await page.waitForTimeout(150);
  const box=await scroll().boundingBox();
  if(c.touch){
   const cdp=await context.newCDPSession(page),x=box.x+8,y=Math.min(c.height-35,box.y+box.height-30);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-120*i/8}]});await page.waitForTimeout(25);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else{await page.mouse.move(box.x+15,Math.min(c.height-35,box.y+160));await page.mouse.wheel(0,250);}
  await page.waitForTimeout(300);
  check('dito emulato o rotella scorrono dentro',(await measure()).top>15,await measure());
  const openKeyboard=async(id)=>{
   const card=frame.locator(`[data-box=${id}]`);
   await card.getByTitle('Inserisci manualmente il valore',{exact:true}).click();
   const input=card.getByRole('textbox',{name:'Digita il valore da tastiera'});
   await input.waitFor({state:'visible'});return {card,input};
  };
  let {card,input}=await openKeyboard('b1');
  check('risposta iniziale vuota e scritta soltanto dallo studente',await input.inputValue()==='');
  await card.getByRole('button',{name:/ISTRUZIONI PER SCRIVERE DA TASTIERA/}).click();
  await card.getByLabel('Regole di trascrizione da tastiera').waitFor();
  check('istruzioni lunghe non allungano la cornice',(await measure()).frame<=cap+1,await measure());
  await card.getByRole('button',{name:/NASCONDI LE ISTRUZIONI/}).click();
  await input.fill('0');await input.press('Enter');
  await card.getByText('RISULTATO SBAGLIATO. CALCOLA DI NUOVO',{exact:true}).waitFor();
  check('errore non rivela risposta e non apre il box seguente',await frame.locator('[data-box=b2]').count()===0&&await frame.locator('[data-testid=pillola-formula-risolta]').count()===0);
  for(const [i,value]of ['5','9','10'].entries()){
   const entry=await openKeyboard('b'+(i+1));await entry.input.fill(value);await entry.input.press('Enter');
   await entry.card.locator('[data-testid=pillola-formula-risolta]').waitFor();
   if(i<2)await frame.locator(`[data-box=b${i+2}]`).waitFor();
   check('passaggio'+(i+1)+' confermato senza crescita esterna',(await measure()).frame<=cap+1&&await frame.locator('[data-testid=pillola-formula-risolta]').count()===i+1,await measure());
  }
  const pdfButton=frame.getByRole('button',{name:'Scarica il PDF con tutti i passaggi dell\'espressione'});
  await pdfButton.scrollIntoViewIfNeeded();
  check('pulsante PDF finale raggiungibile con scroll interno',await pdfButton.isVisible()&&(await measure()).top>0,await measure());
  // Capture the existing PDF document.write via a local test stub: no popup,
  // external print service or change to the actual PDF generation function.
  await frame.evaluate(()=>{window.__qaPdfHtml='';window.open=()=>({document:{write:html=>{window.__qaPdfHtml=html},close:()=>{}}});});
  await pdfButton.click();
  const pdf=await frame.evaluate(()=>{const html=window.__qaPdfHtml,d=new DOMParser().parseFromString(html,'text/html');return {text:d.body.textContent,rows:[...d.querySelectorAll('annotation')].map(a=>a.textContent),clipped:/expr-exercise|max-height|overflow-y/.test(html)};});
  check('PDF mantiene dati e tutte le righe senza limite640',pdf.text.includes('QA Layout')&&pdf.text.includes('Classe 3A')&&pdf.text.includes('RISULTATO FINALE')&&longExercise.righeProgressive.every(r=>pdf.rows.includes(r))&&!pdf.clipped,pdf);
  await scroll().evaluate(el=>{el.scrollTop=0});
  if(c.embed)await page.evaluate(()=>scrollTo(0,180));
  await page.screenshot({path:OUT+'/'+c.name+'-long.png'});
  fixture=shortExercise;
  await frame.goto(BASE+'/esercizio?sid=layout-short'+(c.embed?'&cornice=exercise-scroll-test':''));
  await frame.locator('.expr-exercise-scroll').waitFor();
  await frame.waitForFunction(()=>document.querySelector('h3')?.textContent==='1. CALCOLO');
  await frame.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
  const shortBefore=await measure();
  const shortEntry=await openKeyboard('b1');await shortEntry.input.fill('5');await shortEntry.input.press('Enter');
  await frame.getByText('RISULTATO FINALE',{exact:true}).waitFor();await page.waitForTimeout(650);
  const shortAfter=await measure();row.short={before:shortBefore,after:shortAfter};
  check('esercizio di un box resta leggibile entro il massimo',shortAfter.frame>shortAfter.toolbar+100&&shortAfter.frame<=cap+1,row.short);
  // Even a completed one-box exercise can naturally exceed640px with
  // accessible fonts/cards. Check intrinsic shrink/grow in an isolated
  // DOM clone, without hiding any real exercise content or changing CSS.
  const intrinsic=await frame.evaluate(()=>{
   const original=document.querySelector('.expr-exercise-frame'),clone=original.cloneNode(true);
   clone.style.cssText=`position:fixed;top:0;left:0;width:${original.clientWidth}px;visibility:hidden;pointer-events:none`;
   const s=clone.querySelector('.expr-exercise-scroll'),p=document.createElement('p');
   p.textContent='Contenuto breve sintetico — solo prova layout';p.style.cssText='height:80px;margin:0';s.replaceChildren(p);
   document.body.append(clone);
   const m=()=>({frame:clone.getBoundingClientRect().height,page:s.clientHeight,content:s.scrollHeight});
   const short=m();p.style.height='1200px';const long=m();p.style.height='80px';const shrunk=m();clone.remove();
   return {note:'Isolated DOM clone; not a real exercise state or a source/CSS change',short,long,shrunk};
  });row.intrinsic=intrinsic;
  check('layout auto si accorcia e ricresce senza collasso',intrinsic.short.frame>80&&intrinsic.short.frame<cap-1&&Math.abs(intrinsic.long.frame-cap)<=1&&intrinsic.long.content>intrinsic.long.page&&Math.abs(intrinsic.shrunk.frame-intrinsic.short.frame)<1,intrinsic);
  if(c.embed){
   await page.evaluate(()=>{const f=document.querySelector('iframe');f.style.height='1700px';f.contentWindow.postMessage({type:'labvisivo:ping'},'*')});
   await page.waitForTimeout(850);
   const h=await page.locator('iframe').evaluate(el=>el.getBoundingClientRect().height),now=await measure(),messages=await page.evaluate(()=>heights);
   check('cornice si restringe al contenuto senza loop con token',Math.abs(h-Math.ceil(now.frame))<=1&&messages.length>0&&messages.every(m=>m.cornice==='exercise-scroll-test'&&m.height<=641),{height:h,frame:now.frame,messages});
  }else{
   const reducedHeight=Math.max(240,c.height-200);
   await page.setViewportSize({width:c.width,height:reducedHeight});await page.waitForTimeout(200);
   check('tastiera mobile o viewport ridotto rispettato',(await measure()).frame<=Math.min(640,reducedHeight)+1,await measure());
   await page.setViewportSize({width:c.width,height:c.height});await page.waitForTimeout(150);
  }
  if(c.embed)await page.evaluate(()=>scrollTo(0,180));
  await page.screenshot({path:OUT+'/'+c.name+'-short.png'});
  // Check print only AFTER asserting screen-height messages: the print
  // stylesheet intentionally removes640px, so those deliberate heights
  // must not be mistaken for a screen/iframe resize regression.
  await page.emulateMedia({media:'print'});
  check('stampa rimuove limiti e scroll',await shell().evaluate(el=>getComputedStyle(el).maxHeight)==='none'&&await scroll().evaluate(el=>getComputedStyle(el).overflowY)==='visible');
  await page.emulateMedia({media:'screen'});await page.waitForTimeout(200);
  check('ritorno a schermo ripristina il limite',(await measure()).frame<=cap+1,await measure());
  await frame.goto(BASE+'/espressione'+(c.embed?'?cornice=exercise-scroll-test':''));
  await frame.locator('.expr-input-page').waitFor();await page.waitForTimeout(200);
  check('seconda pagina rimane al suo limite precedente',await frame.locator('.expr-exercise-frame').count()===0&&Math.abs(await frame.locator('.expr-input-frame').evaluate(el=>el.getBoundingClientRect().height)-cap)<=1);
  await frame.goto(BASE+'/');await frame.locator('.lf-welcome').waitFor();
  check('prima pagina non limitata e variabile viewport rimossa',await frame.locator('.expr-exercise-frame,.expr-input-frame').count()===0&&await frame.evaluate(()=>document.documentElement.style.getPropertyValue('--expr-visible-height'))==='');
  check('nessuna chiamata IA o scrittura dati',unexpectedApi.length===0,unexpectedApi);
  check('nessun errore JavaScript',errors.length===0,errors);
  row.ok=true;
 }catch(e){row.ok=false;row.error=e.message;row.errors=errors;try{row.measure=await frame?.evaluate(()=>({body:document.body.innerText.slice(-2500),frame:document.querySelector('.expr-exercise-frame')?.getBoundingClientRect().toJSON(),page:document.querySelector('.expr-exercise-scroll')?.getBoundingClientRect().toJSON()}));}catch{}await page.screenshot({path:OUT+'/'+c.name+'-FAILED.png'}).catch(()=>{});}
 results.push(row);console.log(c.name,row.ok?'OK':'FAIL',row.checks.length,row.error??'');
 await context.close();
}
await browser.close();
await fs.writeFile(OUT+'/results.json',JSON.stringify(results,null,2));
console.log('RISULTATI',results.filter(r=>r.ok).length+'/'+results.length);
if(results.some(r=>!r.ok))process.exitCode=1;

