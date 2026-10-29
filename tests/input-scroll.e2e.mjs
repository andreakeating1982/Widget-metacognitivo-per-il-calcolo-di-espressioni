import { chromium } from 'playwright';
import fs from 'node:fs/promises';

// Test del contenitore seconda pagina; IA simulata, nessun database usato.
// Copiare in un ambiente QA con Playwright (vedi tests/INPUT-SCROLL.md).
const BASE=process.env.INPUT_SCROLL_URL??'http://127.0.0.1:3000';
const OUT=process.env.INPUT_SCROLL_OUTPUT??'/tmp/input-scroll-qa';
await fs.mkdir(OUT,{recursive:true});
const APP=BASE+'/espressione?cognome=QA&nome=Scroll&classe=2A';
const PHOTO=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1500"><rect width="900" height="1500" fill="white"/><text x="60" y="200" font-size="60">2 + 3</text></svg>');
const allCases=[
 {name:'desktop',width:1280,height:800},
 {name:'mobile-320',width:320,height:568,touch:true},
 {name:'mobile-393',width:393,height:780,touch:true},
 {name:'landscape',width:740,height:360,touch:true},
 {name:'blog-mobile',width:393,height:780,touch:true,embed:true},
 {name:'blog-desktop',width:1280,height:800,embed:true},
 {name:'accessibilita-160',width:393,height:780,touch:true,embed:true,access:true},
];
const cases=process.env.INPUT_SCROLL_CASE?allCases.filter(c=>c.name===process.env.INPUT_SCROLL_CASE):allCases;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-features=LocalNetworkAccessChecks']});
const results=[];
for(const c of cases){
 const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:!!c.touch,hasTouch:!!c.touch,deviceScaleFactor:1});
 const page=await context.newPage();
 const row={name:c.name,checks:[]};
 const check=(name,ok,detail)=>{row.checks.push({name,ok,detail});if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
 const errors=[];
 let ocrCalls=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/ai/transcribe',r=>{ocrCalls++;return r.fulfill({contentType:'application/json',body:JSON.stringify({text:'2+3'})})});
 await page.route('**/api/esercizio/**',r=>r.fulfill({status:404,contentType:'application/json',body:'{"error":"fixture non presente"}'}));
 if(c.access)await context.addInitScript(()=>localStorage.setItem('wms_access',JSON.stringify({fontScale:1.6,lineHeight:2.6,ruler:false,mode:'contrasto'})));
 try{
  if(c.embed){
   await page.route('http://localhost:3000/__input-scroll-blog',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><header style="height:220px">Blog simulato</header><iframe title="App" src="${APP}&cornice=input-scroll-test" style="display:block;border:0;width:100%;height:1500px"></iframe><footer style="height:900px">Fine post</footer><script>window.heights=[];addEventListener('message',e=>{const f=document.querySelector('iframe');if(e.source===f.contentWindow&&e.data?.type==='labvisivo:height'){heights.push(e.data);f.style.height=e.data.height+'px'}})</script></body></html>`}));
   await page.goto('http://localhost:3000/__input-scroll-blog');
  }else await page.goto(APP);
  const frame=c.embed?page.frames().find(f=>f.url().startsWith(BASE)):page.mainFrame();
  const shell=frame.locator('.expr-input-frame');
  const scroll=frame.locator('.expr-input-page');
  await scroll.waitFor();
  await frame.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(700);
  const measure=()=>frame.evaluate(()=>{const s=document.querySelector('.expr-input-page'),f=document.querySelector('.expr-input-frame');return {frame:f.getBoundingClientRect().height,scroll:s.clientHeight,content:s.scrollHeight,top:s.scrollTop,body:document.body.scrollHeight,windowY:scrollY,docHeight:document.documentElement.scrollHeight,bodyHeight:document.body.getBoundingClientRect().height,shellTop:f.getBoundingClientRect().top,shellScroll:f.scrollTop,rootHeight:document.getElementById('root').getBoundingClientRect().height,width:document.documentElement.clientWidth,documentWidth:document.documentElement.scrollWidth,bar:getComputedStyle(s,'::-webkit-scrollbar').width};});
  const initial=await measure();
  // Altezza compatta della cornice dedicata Latino Facile: 640px.
  // Standalone: non superare il viewport visibile (tastiera/landscape).
  const target=c.embed?640:Math.min(c.height,640);
  check('altezza esterna delimitata e indipendente dal contenuto',Math.abs(initial.frame-target)<=1,{initial,target});
  check('nessun overflow orizzontale della pagina',initial.documentWidth<=initial.width+1,initial);
  check('scrollbar sottile 4px come Latino Facile',initial.bar==='4px',initial.bar);
  check('regione raggiungibile da tastiera',await scroll.getAttribute('tabindex')==='0'&&await scroll.getAttribute('role')==='region');
  const toolbarTop=await frame.locator('[role=toolbar]').evaluate(el=>el.getBoundingClientRect().top);
  const openPanel=async()=>{
   await frame.getByRole('button',{name:'TRASCRIZIONE AUDIO E CON TASTIERA',exact:true}).click();
   const field=frame.getByRole('textbox',{name:'Notazione da tastiera'});
   await field.waitFor({state:'attached'});
   await field.scrollIntoViewIfNeeded();
   await field.waitFor({state:'visible'});
  };
  await openPanel();
  await frame.getByRole('button',{name:/ISTRUZIONI PER SCRIVERE DA TASTIERA/}).click();
  const longPanel=await measure();
  check('pannello audio e istruzioni non allungano la pagina',Math.abs(longPanel.frame-initial.frame)<=1,longPanel);
  check('il contenuto lungo ha davvero overflow interno',longPanel.content>longPanel.scroll+50,longPanel);
  await scroll.focus();await page.keyboard.press('Control+End');await page.waitForTimeout(300);
  const keyScroll=await measure();
  check('scorrimento verticale da tastiera funziona',keyScroll.top>100,keyScroll);
  check('toolbar resta ferma mentre il contenuto scorre',Math.abs((await frame.locator('[role=toolbar]').evaluate(el=>el.getBoundingClientRect().top))-toolbarTop)<1);
  await frame.getByRole('textbox',{name:'Notazione da tastiera'}).fill('2+3');
  await frame.getByRole('button',{name:/AGGIUNGI COME PEZZO/}).click();
  await frame.locator('[aria-label="Pezzi trascritti"] .katex').first().waitFor();
  // L'app scorre sul pezzo dopo 200ms; attendere anche la fine dello smooth
  // prima di riaprire, come tra due azioni umane. Nessun force click.
  await page.waitForTimeout(650);
  // Dieci pezzi reali generati tramite i comandi dell'app, non DOM fittizio.
  for(let i=0;i<9;i++){
   await openPanel();
   await frame.getByRole('textbox',{name:'Notazione da tastiera'}).fill('+1');
   await frame.getByRole('button',{name:/AGGIUNGI COME PEZZO/}).click();
   await frame.waitForFunction(count=>document.querySelectorAll('[aria-label="Pezzi trascritti"] > div').length===count,i+2);
   await page.waitForTimeout(650);
  }
  await page.waitForTimeout(350);
  const many=await measure();
  check('dieci pezzi confermati mantengono la stessa altezza',Math.abs(many.frame-initial.frame)<=1&&await frame.locator('[aria-label="Pezzi trascritti"] > div').count()===10,many);
  // Gesto vero: wheel mouse o sequenza touch CDP, su una zona non canvas.
  await scroll.evaluate(el=>{el.scrollTop=0});
  if(c.embed)await page.evaluate(()=>window.scrollTo(0,220));
  await page.waitForTimeout(200);
  if(c.touch){
   const cdp=await context.newCDPSession(page);
   const box=await scroll.boundingBox();
   const x=box.x+8,y=Math.min(c.height-50,box.y+box.height-40);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-130*i/8}]});await page.waitForTimeout(25)}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
   const box=await scroll.boundingBox();await page.mouse.move(box.x+30,Math.min(c.height-40,box.y+200));await page.mouse.wheel(0,300);
  }
  await page.waitForTimeout(350);
  check('gesto dito o rotella scorre dentro la seconda pagina',(await measure()).top>20,await measure());
  // Apertura dal tasto visibile: conserva la posizione interna al ritaglio.
  await frame.getByRole('button',{name:'Carica una foto dell\'espressione dal dispositivo'}).scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const beforeCrop=await measure();
  const heightsBefore=c.embed?await page.locator('iframe').evaluate(el=>el.getBoundingClientRect().height):null;
  await frame.locator('input[type=file]').first().setInputFiles({name:'prova.svg',mimeType:'image/svg+xml',buffer:PHOTO});
  const dialog=frame.getByRole('dialog');
  await dialog.waitFor();
  await frame.waitForFunction(()=>document.querySelector('[role=dialog] img')?.naturalWidth>0);
  await page.waitForTimeout(300);
  const locked=await measure();
  check('ritaglio non allunga la pagina e congela il suo scroll',locked.frame===beforeCrop.frame&&Math.abs(locked.top-beforeCrop.top)<2&&await scroll.evaluate(el=>getComputedStyle(el).overflowY)==='hidden',{beforeCrop,locked});
  const d=await dialog.boundingBox();
  check('ritaglio interamente visibile nello schermo',d.y>=-1&&d.y+d.height<=c.height+1,d);
  check('otto maniglie e quattro comandi preservati',await dialog.getByRole('slider').count()===8&&await dialog.locator('[data-crop-controls] > button').count()===4);
  const exposedControls=await dialog.locator('[data-crop-controls] > button').evaluateAll(buttons=>buttons.map(btn=>{
   const r=btn.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   return {label:btn.textContent.trim(),exposed:hit===btn||btn.contains(hit)};
  }));
  check('nessun toast o altro elemento copre i quattro comandi',exposedControls.every(x=>x.exposed),exposedControls);
  check('nessun invio OCR prima della conferma',ocrCalls===0);
  if(c.embed){
   const count=await page.evaluate(()=>heights.length);
   await page.evaluate(()=>{document.querySelector('iframe').contentWindow.postMessage({type:'labvisivo:ping'},'*')});
   await page.waitForTimeout(500);
   check('nessun resize della cornice durante ritaglio neppure con ping',await page.evaluate(()=>heights.length)===count&&await page.locator('iframe').evaluate(el=>el.getBoundingClientRect().height)===heightsBefore,{count,heightsBefore});
  }
  await page.screenshot({path:OUT+'/'+c.name+'-crop.png'});
  await dialog.getByRole('button',{name:'Chiudi',exact:true}).click();await dialog.waitFor({state:'detached'});
  await page.waitForTimeout(250);
  const afterClose=await measure();
  check('chiusura ripristina posizione e scrollbar interne',Math.abs(afterClose.top-beforeCrop.top)<2&&afterClose.frame===initial.frame&&await scroll.evaluate(el=>getComputedStyle(el).overflowY)==='auto',{beforeCrop,afterClose});
  // Conferma PNG e consumer OCR reali, con sola risposta del modello mock.
  await frame.locator('input[type=file]').first().setInputFiles({name:'prova.svg',mimeType:'image/svg+xml',buffer:PHOTO});
  await dialog.waitFor();await frame.waitForFunction(()=>document.querySelector('[role=dialog] img')?.naturalWidth>0);
  await dialog.getByRole('button',{name:'Ritaglia',exact:true}).click();
  await dialog.waitFor({state:'detached'});
  await frame.waitForFunction(()=>document.querySelectorAll('[aria-label="Pezzi trascritti"] > div').length===11);
  check('PNG confermato trascritto in un nuovo pezzo senza calcolo',ocrCalls===1&&await frame.locator('[aria-label="Pezzi trascritti"] .katex annotation').last().textContent()==='2+3');
  check('altezza invariata dopo conferma foto',(await measure()).frame===initial.frame);
  if(c.embed){
   await page.waitForTimeout(500);
   const messages=await page.evaluate(()=>heights);
   check('messaggi altezza tutti con token e senza crescite',messages.length>0&&messages.every(m=>m.cornice==='input-scroll-test'&&m.height<=target+2),messages);
  }
  await scroll.evaluate(el=>el.scrollTop=0);
  // Le notifiche transitorie dell'aggiunta rapida non sono il layout finale.
  await page.waitForTimeout(4500);
  await page.screenshot({path:OUT+'/'+c.name+'-page.png'});
  if(!c.embed){
   // Simula viewport ridotto (es. tastiera mobile) e poi rotazione/ripristino.
   await page.setViewportSize({width:c.width,height:Math.max(240,c.height-180)});
   await page.waitForTimeout(150);
   const reduced=await measure();
   check('pagina autonoma segue il viewport ridotto',reduced.frame<=Math.max(240,c.height-180)+1,reduced);
   await page.setViewportSize({width:c.width,height:c.height});
   await page.goto(BASE+'/');
   check('prima pagina senza contenitore limitato',await page.locator('.lf-welcome').count()===1&&await page.locator('.expr-input-frame').count()===0);
   await page.goto(BASE+'/esercizio');
   await page.locator('.expr-exercise-scroll').waitFor();
   check('terza pagina usa il proprio contenitore adattivo',await page.locator('.expr-input-frame').count()===0&&await page.locator('.expr-exercise-frame').count()===1);
  }
  check('nessun errore JavaScript',errors.length===0,errors);
  row.ok=true;
 }catch(e){row.ok=false;row.error=e.message;row.overflow=await page.frames().find(f=>f.url().startsWith(BASE))?.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().bottom+scrollY>850&&getComputedStyle(el).position==='absolute').slice(0,20).map(el=>({tag:el.tagName,class:el.className,rect:el.getBoundingClientRect().toJSON(),position:getComputedStyle(el).position,top:getComputedStyle(el).top,text:el.textContent.slice(0,80)})));await page.screenshot({path:OUT+'/'+c.name+'-FAILED.png'}).catch(()=>{});}
 results.push(row);console.log(c.name,row.ok?'OK':'FAIL',row.checks.length,row.error??'');
 await context.close();
}
await browser.close();
await fs.writeFile(OUT+'/results.json',JSON.stringify(results,null,2));
console.log('RISULTATI',results.filter(r=>r.ok).length+'/'+results.length);
if(results.some(r=>!r.ok))process.exitCode=1;

