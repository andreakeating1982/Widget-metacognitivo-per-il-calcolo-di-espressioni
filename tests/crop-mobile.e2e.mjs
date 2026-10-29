import { chromium } from 'playwright';
import fs from 'node:fs/promises';
// Avviare prima pnpm dev sulla porta 3000. Nessuna richiesta IA reale.
// Adattamento alla destinazione matematica: risposta OCR sintetica valida,
// attesa del pezzo trascritto e freeze cornice misurato DOPO il lock.
const BASE=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const APP=BASE+'/espressione?cognome=QA&nome=Test&classe=2A&data=28%2F10%2F2026';
const out=process.env.CROP_QA_OUTPUT ?? new URL('../.cache/crop-mobile-qa',import.meta.url).pathname;
await fs.mkdir(out,{recursive:true});
const photo=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1500"><rect width="900" height="1500" fill="#fffdf6"/><g font-family="serif" font-size="38" fill="#111"><text x="50" y="100">Magistratuum romanorum auctoritas</text><text x="50" y="165">magna erat. Senatus rem publicam</text><text x="50" y="230">administrabat. Consules exercitum</text><text x="50" y="295">ducebant. Cives leges servabant.</text><text x="50" y="420">Gallia est omnis divisa in partes tres.</text><text x="50" y="600">Puella ancillam amat.</text><text x="50" y="780">Amici in horto ambulant.</text><text x="50" y="1000">Romani urbem defendunt.</text><text x="50" y="1300">Omnia vincit amor.</text></g></svg>`);
const allCases=[
 {name:'mobile-320',width:320,height:568},
 {name:'mobile-393',width:393,height:780},
 {name:'mobile-landscape',width:740,height:360},
 {name:'blog-320',width:320,height:568,embed:true},
 {name:'blog-393',width:393,height:780,embed:true},
 {name:'blog-scrolled',width:393,height:780,embed:true,scroll:650},
 {name:'blog-high-contrast',width:393,height:780,embed:true,hc:true},
 {name:'mobile-orientation-change',width:393,height:780,orientation:true},
 {name:'desktop',width:1280,height:800,desktop:true},
];
const cases=process.env.CROP_CASE ? allCases.filter(c=>c.name===process.env.CROP_CASE) : allCases;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-features=LocalNetworkAccessChecks']});
const results=[];
async function swipe(cdp,x,y,dy){
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+dy*i/10}]});await new Promise(r=>setTimeout(r,25));}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await new Promise(r=>setTimeout(r,600));
}
for(const c of cases){
 const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:!c.desktop,hasTouch:!c.desktop,deviceScaleFactor:1});
 const page=await context.newPage();
 const item={name:c.name,width:c.width,height:c.height,checks:[]};
 const check=(name,ok,detail)=>{item.checks.push({name,ok,detail});if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let transcriptions=0;
 await page.route('**/api/ai/transcribe',r=>{transcriptions++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:'2+3'})})});
 try{
  if(c.embed){
   await page.route('http://localhost:3000/__qa-blog**',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><header style="height:220px;background:#eee">Post del blog</header><div style="margin:0 12px"><h3>WIDGET METACOGNITIVO</h3><iframe title="App" src="${APP}&cornice=test" style="width:100%;height:1500px;border:0"></iframe></div><footer style="height:1000px">Fine del post</footer><script>window.heights=[];addEventListener('message',e=>{if(e.data?.type==='labvisivo:height'){heights.push(e.data.height);document.querySelector('iframe').style.height=Math.max(640,e.data.height)+'px';}})</script></body></html>`}));
   await page.goto('http://localhost:3000/__qa-blog');
   await page.waitForTimeout(1200);
  }else await page.goto(APP);
  const frame=c.embed?page.frames().find(f=>f.url().startsWith(BASE)):page.mainFrame();
  await frame.locator('input[type=file]').first().waitFor({state:'attached'});
  /* questa app: nessuna textarea obbligatoria a questa fase */
  await frame.evaluate(()=>document.fonts.ready);
  if(c.embed)await page.evaluate(y=>window.scrollTo(0,y),c.scroll??240);
  else await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,100)});
  if(c.hc)await frame.evaluate(()=>document.documentElement.classList.add('lf-hc'));
  const pre=await frame.evaluate(()=>({body:document.body.style.cssText,html:document.documentElement.style.cssText,y:scrollY}));
  const outerBefore=await page.evaluate(()=>scrollY);
  // La normalizzazione file e il caricamento iniziale del canvas possono
  // cambiare l'altezza PRIMA che il ritaglio acquisisca il lock; non sono
  // resize durante il dialogo. La misura di riferimento si prende al lock.
  let frameHeightBefore=null;
  const open=async()=>{
   await frame.locator('input[type=file]').first().setInputFiles({name:'testo-latino.svg',mimeType:'image/svg+xml',buffer:photo});
   await frame.locator('[role=dialog]').waitFor({state:'visible'});
   await frame.locator('[role=dialog] img').waitFor();
   await frame.waitForFunction(()=>document.querySelector('[role=dialog] img')?.naturalWidth>0);
   await page.waitForTimeout(200);
  };
  await open();
  if(c.embed)frameHeightBefore=await page.locator('iframe').evaluate(el=>el.getBoundingClientRect().height);
  const lockedOuter=await page.evaluate(()=>scrollY);
  if(c.embed)check('apertura non sposta il blog',Math.abs(lockedOuter-outerBefore)<2,{outerBefore,lockedOuter});
  const d=frame.locator('[role=dialog]');
  check('titolo RITAGLIA LA FOTO senza istruzioni visibili',await d.getByRole('heading',{name:'Ritaglia la foto',exact:true}).count()===1&&await d.getByText(/Lascia solo il testo latino|Se la foto è storta/).count()===0);
  const rect=await d.boundingBox();
  check('finestra interamente nello schermo',rect.y>=-1&&rect.y+rect.height<=c.height+1,{rect});
  const footer=await frame.locator('[data-crop-footer]').boundingBox();
  check('pulsanti principali sempre visibili',footer.y>=rect.y&&footer.y+footer.height<=rect.y+rect.height+1,{footer});
  const closeButton=frame.getByRole('button',{name:'Chiudi',exact:true});
  const cropButton=frame.getByRole('button',{name:'Ritaglia',exact:true});
  const buttons=await frame.locator('[data-crop-controls] > button').evaluateAll(elements=>elements.map(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {label:el.textContent.trim(),background:s.backgroundColor,color:s.color,width:r.width,height:r.height,radius:s.borderRadius,fontSize:s.fontSize,x:r.x,y:r.y};}));
  check('quattro comandi in un unico riquadro senza AZZERA',await frame.locator('[data-crop-controls]').count()===1&&buttons.length===4&&await frame.getByRole('button',{name:'Azzera',exact:true}).count()===0&&await frame.locator('[data-crop-tools]').count()===0,buttons);
  check('CHIUDI e RITAGLIA presenti senza vecchie etichette',await closeButton.count()===1&&await cropButton.count()===1);
  check('tutti i quattro pulsanti marroni con scritta bianca',buttons.every(b=>b.background==='rgb(168, 91, 60)'&&b.color==='rgb(255, 255, 255)'),buttons);
  check('tutti i pulsanti compatti ma target touch almeno 44px',buttons.every(b=>b.height>=44&&b.width<200),buttons);
  const grouping=await frame.locator('[data-crop-controls]').evaluate(el=>{const parent=el.getBoundingClientRect();const rows=[];for(const btn of el.querySelectorAll(':scope > button')){const r=btn.getBoundingClientRect();let row=rows.find(row=>Math.abs(row.y-r.y)<3);if(!row){row={y:r.y,left:r.x,right:r.right};rows.push(row)}else{row.left=Math.min(row.left,r.x);row.right=Math.max(row.right,r.right)}}return {center:parent.x+parent.width/2,rows};});
  check('tutte le righe dei comandi centrate nel medesimo riquadro',grouping.rows.every(row=>Math.abs((row.left+row.right)/2-grouping.center)<2),grouping);
  const lock=await frame.evaluate(()=>({position:getComputedStyle(document.body).position,style:document.body.style.cssText,locked:document.documentElement.hasAttribute('data-lf-crop-open')}));
  check('pagina sottostante bloccata',lock.position==='fixed'&&lock.locked,lock);
  await page.screenshot({path:`${out}/${c.name}-initial.png`});
  const scroll=frame.locator('[data-crop-scroll]');
  const dimensions=await scroll.evaluate(el=>({h:el.clientHeight,s:el.scrollHeight}));
  check('corpo non compresso dal riquadro comandi e scorrevole quando necessario',dimensions.h>=80&&dimensions.s>=dimensions.h,dimensions);
  if(!c.desktop){
   const cdp=await context.newCDPSession(page);
   const s=await scroll.boundingBox();
   const start=Math.min(s.y+s.height-25,c.height-100);
   await swipe(cdp,s.x+5,start,-Math.min(160,s.height/2));
   const after=await scroll.evaluate(el=>el.scrollTop);
   check('dito scorre dentro la finestra quando il contenuto eccede',dimensions.s<=dimensions.h+1||after>=Math.min(20,dimensions.s-dimensions.h-1),{after,dimensions});
   check('gesto interno non scorre app/blog',Math.abs((await page.evaluate(()=>scrollY))-lockedOuter)<2,{before:lockedOuter,after:await page.evaluate(()=>scrollY)});
   // Al fondo del contenuto lo swipe non deve propagarsi alla pagina esterna.
   await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight});
   await swipe(cdp,s.x+5,start,-Math.min(120,s.height/2));
   check('nessuna propagazione ai bordi',Math.abs((await page.evaluate(()=>scrollY))-lockedOuter)<2);
   // Drag touch di una maniglia: la geometria cambia ma il corpo NON scorre.
   await scroll.evaluate(el=>{const img=el.querySelector('img');el.scrollTop=img.offsetTop});
   await page.waitForTimeout(100);
   // Dopo il drag la maniglia può uscire dalla regione visibile dello
   // scroll: mantenere il selettore DOM per leggere il valore risultante,
   // senza chiedere nuovamente un nodo nell'albero accessibile ritagliato.
   const h=frame.locator('[role="slider"][aria-label="Ridimensiona il lato superiore della finestra di ritaglio"]');
   await h.scrollIntoViewIfNeeded();
   const hb=await h.boundingBox();
   const st=await scroll.evaluate(el=>el.scrollTop);
   check('maniglia touch esposta prima del gesto',await h.evaluate(el=>{
    const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+10);
    return hit===el||el.contains(hit);
   }));
   await swipe(cdp,hb.x+hb.width/2,hb.y+10,40);
   const selected=await h.getAttribute('aria-valuenow');
   check('maniglia touch ridimensiona il ritaglio',Number(selected)<100,{selected});
   check('drag maniglia non scorre il corpo',Math.abs((await scroll.evaluate(el=>el.scrollTop))-st)<2);
   // Contratto nuovo: TUTTA la selezione trascina, non è una zona di pan.
   const selectedArea=frame.locator('[data-crop-selection]');
   check('area selezionata touch diretta e senza icona',await selectedArea.evaluate(el=>getComputedStyle(el).touchAction==='none'&&el.children.length===0));
   const b=await scroll.evaluate(el=>el.scrollTop);
   const sr=await scroll.boundingBox();
   await swipe(cdp,sr.x+5,Math.min(sr.y+sr.height-25,c.height-100),-60);
   check('scroll interno ancora possibile sui margini del crop',await scroll.evaluate(el=>el.scrollTop)>=b);
  }
  const right=frame.getByRole('button',{name:'Ruota la foto di 90 gradi a destra'});
  await right.scrollIntoViewIfNeeded();
  await right.click();
  await frame.waitForFunction(()=>{const i=document.querySelector('[role=dialog] img');return i?.naturalWidth===1500&&i?.naturalHeight===900});
  check('rotazione 90 gradi corretta',true);
  if(c.orientation){
   await page.setViewportSize({width:780,height:393});
   await page.waitForTimeout(500);
   const nr=await d.boundingBox();
   check('cambio orientamento ricalcola finestra',nr.y>=0&&nr.y+nr.height<=394,{nr});
  }
  if(c.desktop){
   const edge=frame.getByRole('slider',{name:'Ridimensiona il lato superiore della finestra di ritaglio',exact:true});
   await edge.focus();await page.keyboard.press('ArrowDown');
   check('maniglie da tastiera preservate',Number(await edge.getAttribute('aria-valuenow'))===98);
  }
  await page.screenshot({path:`${out}/${c.name}.png`});
  check('nessun invio IA prima della conferma',transcriptions===0);
  if(c.embed){
   const height=await page.locator('iframe').evaluate(el=>el.getBoundingClientRect().height);
   check('cornice non si ridimensiona durante il ritaglio',height===frameHeightBefore,{height,frameHeightBefore});
  }
  await frame.getByRole('button',{name:'Chiudi',exact:true}).click();
  await d.waitFor({state:'detached'});
  const post=await frame.evaluate(()=>({body:document.body.style.cssText,html:document.documentElement.style.cssText,y:scrollY,locked:document.documentElement.hasAttribute('data-lf-crop-open')}));
  // La seconda pagina aggiorna --expr-visible-height alla rotazione: non è
  // uno stile del lock e NON deve tornare alla misura prima della rotazione.
  // Confrontare tutti gli altri stili senza nascondere eventuali residui.
  const stylesWithoutViewport = css => Object.fromEntries(css.split(';')
    .map(x=>x.trim()).filter(Boolean).map(x=>{
      const sep=x.indexOf(':');return [x.slice(0,sep).trim(),x.slice(sep+1).trim()];
    }).filter(([name])=>name!=='--expr-visible-height').sort(([a],[b])=>a.localeCompare(b)));
  check('chiusura ripristina stili del lock e posizione app',post.body===pre.body&&JSON.stringify(stylesWithoutViewport(post.html))===JSON.stringify(stylesWithoutViewport(pre.html))&&Math.abs(post.y-pre.y)<2&&!post.locked,{pre,post});
  if(!c.embed){
   const viewportState=await frame.evaluate(()=>({
     variable:parseFloat(document.documentElement.style.getPropertyValue('--expr-visible-height')),
     visible:Math.floor(window.visualViewport?.height??innerHeight),
     frame:document.querySelector('.expr-input-frame').getBoundingClientRect().height,
     width:innerWidth,
   }));
   const expectedHeight=Math.min(viewportState.visible,viewportState.width<640?720:820);
   check('altezza pagina segue il viewport corrente anche dopo rotazione',viewportState.variable===viewportState.visible&&Math.abs(viewportState.frame-expectedHeight)<2,viewportState);
  }
  // Nuova apertura + conferma reale del canvas; soltanto la risposta OCR è simulata.
  await open();
  await frame.getByRole('button',{name:'Ritaglia',exact:true}).click();
  await d.waitFor({state:'detached'});
  // «Pezzi trascritti» è un aria-label del contenitore, non testo visibile.
  // Verificare il contenitore accessibile e la sua formula realmente resa.
  const pieces=frame.locator('[aria-label="Pezzi trascritti"]');
  await pieces.locator('.katex').first().waitFor({state:'visible',timeout:10000});
  check('pezzo matematico atteso trascritto senza soluzione',await pieces.locator('.katex annotation').evaluateAll(els=>els.some(el=>el.textContent.replace(/\s/g,'').includes('2+3'))));
  check('conferma produce immagine e completa il flusso foto (OCR simulato)',transcriptions===1,{transcriptions});
  check('nessun errore JS',errors.length===0,errors);
  item.ok=true;
 }catch(e){item.ok=false;item.error=e.message;await page.screenshot({path:`${out}/${c.name}-FAILED.png`}).catch(()=>{});}
 results.push(item);console.log(c.name,item.ok?'OK':'FAIL',item.error??'',item.checks.length+' controlli');
 await context.close();
}
await browser.close();
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
const fail=results.filter(r=>!r.ok);
console.log('RISULTATI',results.length-fail.length+'/'+results.length,'scenari');
if(fail.length)process.exitCode=1;
