import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const BASE=process.env.CROP_DRAG_BASE_URL??'http://127.0.0.1:3000';
const OUT=process.env.CROP_DRAG_OUTPUT??'/tmp/crop-drag-qa';
const baseline=process.env.CROP_DRAG_BASELINE==='1';
await fs.mkdir(OUT,{recursive:true});
const photo=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="900" height="900" fill="white"/><text x="80" y="120" font-size="45">Foto quadrata di prova</text></svg>');
const cases=[{name:'touch-320',w:320,h:700},{name:'touch-393',w:393,h:780},{name:'iframe-touch',w:393,h:780,embed:true},{name:'desktop-mouse',w:1280,h:900,mouse:true}];
const handles=[
 ['lato superiore',0,12,'h',-1],['lato inferiore',0,-12,'h',-1],
 ['lato sinistro',12,0,'w',-1],['lato destro',-12,0,'w',-1],
 ['dal angolo in alto a sinistra',12,12,'w',-1],['dal angolo in alto a destra',-12,12,'w',-1],
 ['dal angolo in basso a sinistra',12,-12,'w',-1],['dal angolo in basso a destra',-12,-12,'w',-1],
];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-features=LocalNetworkAccessChecks']});
const results=[];
for(const scenario of cases){
 const context=await browser.newContext({viewport:{width:scenario.w,height:scenario.h},hasTouch:!scenario.mouse,isMobile:!scenario.mouse});
 const page=await context.newPage();
 const checks=[];
 const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
 const record={name:scenario.name,checks,ok:false};
 let uploads=0;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/ai/transcribe',r=>{uploads++;return r.fulfill({contentType:'application/json',body:'{"text":"Puella amat."}'});});
 try{
  const app=BASE+'/espressione?cognome=QA&nome=Test&classe=2A&data=28%2F10%2F2026&cornice=drag-test';
  if(scenario.embed){
   await page.route('http://localhost:3000/__drag-blog',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><header style="height:300px">Blog</header><iframe src="${app}" style="width:100%;height:1500px;border:0"></iframe><footer style="height:1000px">Fine</footer><script>addEventListener('message',e=>{if(e.data?.type==='labvisivo:height')document.querySelector('iframe').style.height=Math.max(640,e.data.height)+'px'})</script></body>`}));
   await page.goto('http://localhost:3000/__drag-blog');
  }else await page.goto(app);
  const frame=scenario.embed?page.frames().find(f=>f.url().startsWith(BASE)):page.mainFrame();
  await frame.locator('input[type=file]').first().waitFor({state:'attached'});
  await frame.evaluate(()=>document.fonts.ready);
  if(scenario.embed)await page.evaluate(()=>scrollTo(0,450));
  const outer=await page.evaluate(()=>scrollY);
  const cdp=await context.newCDPSession(page);
  const close=async()=>{await frame.getByRole('button',{name:'Chiudi',exact:true}).click();await frame.locator('[role=dialog]').waitFor({state:'detached'});};
  const open=async()=>{
   await frame.locator('input[type=file]').first().setInputFiles({name:'quadrata.svg',mimeType:'image/svg+xml',buffer:photo});
   await frame.locator('[role=dialog]').waitFor();
   await frame.waitForFunction(()=>document.querySelector('[role=dialog] img')?.naturalWidth>0);
   await page.waitForTimeout(120);
  };
  const edge=name=>frame.getByRole('slider',{name:'Ridimensiona il '+name+' della finestra di ritaglio',exact:true});
  const selection=frame.locator('.lf-crop-move');
  const geometry=()=>selection.evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:parseFloat(el.style.width),h:parseFloat(el.style.height)}));
  const seed=async()=>{
   for(const [name,key] of [['lato superiore','ArrowDown'],['lato inferiore','ArrowUp'],['lato sinistro','ArrowRight'],['lato destro','ArrowLeft']]){
    await edge(name).focus();await page.keyboard.press('Shift+'+key);await page.keyboard.press('Shift+'+key);
   }
   await frame.locator('[data-crop-scroll]').evaluate(el=>{el.scrollTop=0});
  };
  let pointer;
  async function down(x,y){pointer={x,y};if(scenario.mouse){await page.mouse.move(x,y);await page.mouse.down();}else await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});}
  async function move(x,y){pointer={x,y};if(scenario.mouse)await page.mouse.move(x,y,{steps:1});else await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});await page.waitForTimeout(25);}
  async function up(){if(scenario.mouse)await page.mouse.up();else await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(30);}
  await open();
  if(!baseline){
   check('titolo essenziale, nessuna descrizione',await frame.getByRole('heading',{name:'Ritaglia la foto',exact:true}).count()===1&&await frame.locator('[role=dialog]').getByText(/Lascia solo il testo|Se la foto è storta/).count()===0);
  }
  for(const [label,dx,dy,dimension,sign] of handles){
   await seed();
   const h=label.startsWith('dal ')?frame.getByRole('slider',{name:'Ridimensiona '+label,exact:true}):edge(label);
   const r=await h.boundingBox();
   const image=await frame.locator('[role=dialog] img').boundingBox();
   const before=await geometry();
   const start={x:r.x+r.width/2,y:r.y+r.height/2};
   const scrollBefore=await frame.locator('[data-crop-scroll]').evaluate(el=>el.scrollTop);
   await down(start.x,start.y);
   for(let i=1;i<=4;i++)await move(start.x+dx*i/4,start.y+dy*i/4);
   const after=await geometry();
   const expected=Math.abs(dimension==='w'?dx:dy)/(dimension==='w'?image.width+4:image.height+4)*100;
   check(label+' segue il gesto senza soglia rigida',Math.abs((after[dimension]-before[dimension])-sign*expected)<.65,{before,after,expected});
   // Il target si è spostato: verificare il ritorno nello stesso gesto.
   await move(start.x+dx/2,start.y+dy/2);
   const reversed=await geometry();
   check(label+' risponde al cambio di direzione',reversed[dimension]>after[dimension]+.3,{after,reversed});
   await up();
   check(label+' non fa scorrere il corpo',Math.abs(await frame.locator('[data-crop-scroll]').evaluate(el=>el.scrollTop)-scrollBefore)<1);
   await close();await open();
  }
  await seed();
  // Oltrepassare il vincolo minimo e invertire 6px nello STESSO gesto.
  const h=await edge('lato superiore').boundingBox();
  const image=await frame.locator('[role=dialog] img').boundingBox();
  const sx=h.x+h.width/2,sy=h.y+h.height/2;
  const distance=(image.height+4)*.52+35;
  await down(sx,sy);await move(sx,sy+distance);
  const atLimit=await geometry();
  await move(sx,sy+distance-6);
  const reverseLimit=await geometry();
  check('inversione immediata dopo il limite minimo, senza zona morta',atLimit.h<=8.1&&reverseLimit.h>atLimit.h+.4,{atLimit,reverseLimit});
  await up();await close();await open();await seed();
  if(!baseline)check('nessuna icona o pulsante necessario al centro',await selection.locator('svg,span,button').count()===0&&await selection.evaluate(el=>getComputedStyle(el).touchAction)==='none');
  // Trascinare da un punto interno NON centrale, quattro direzioni.
  for(const [name,dx,dy] of [['destra',10,0],['sinistra',-10,0],['basso',0,10],['alto',0,-10]]){
   const r=await selection.boundingBox();const before=await geometry();
   const x=r.x+r.width*.58,y=r.y+r.height*.42;
   await down(x,y);for(let n=1;n<=4;n++)await move(x+dx*n/4,y+dy*n/4);await up();
   const after=await geometry();
   check('spostamento diretto '+name+' da area interna non centrale',Math.abs(after.w-before.w)<.11&&Math.abs(after.h-before.h)<.11&&(dx===0?Math.sign(after.y-before.y)===Math.sign(dy):Math.sign(after.x-before.x)===Math.sign(dx)),{before,after});
  }
  // Capture rimane sul contenitore fermo e non sul box che si muove.
  const r=await selection.boundingBox();await down(r.x+r.width/2,r.y+r.height/2);
  check('capture sul contenitore stabile della foto',await frame.locator('[role=dialog] img').evaluate(img=>{const w=img.parentElement;for(let id=1;id<100;id++)if(w.hasPointerCapture(id))return true;return false;}));
  if(!scenario.mouse){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(50);
   const before=await geometry();
   // Hover sintetico dopo cancel NON deve trascinare il crop.
   await frame.evaluate(()=>window.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:100,clientY:100,bubbles:true})));
   check('pointercancel termina il drag senza movimenti residui',JSON.stringify(before)===JSON.stringify(await geometry()));
  }else await up();
  check('app e blog fermi durante i gesti',Math.abs((await page.evaluate(()=>scrollY))-outer)<2);
  check('nessun invio IA/OCR durante il trascinamento',uploads===0);
  await page.screenshot({path:OUT+'/'+scenario.name+'.png'});
  await close();
  check('nessun errore JavaScript',errors.length===0,errors);
  record.ok=true;
 }catch(e){record.error=e.message;await page.screenshot({path:OUT+'/'+scenario.name+'-FAILED.png'}).catch(()=>{});}
 results.push(record);console.log(scenario.name,record.ok?'OK':'FAIL',record.error??'',checks.length+' controlli');await context.close();
}
await browser.close();await fs.writeFile(OUT+'/results.json',JSON.stringify(results,null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
