import { chromium } from 'playwright';
import fs from 'node:fs/promises';

// E2E isolato sulla pagina reale: foto sintetica, trascrizione mock, nessun DB.
// Misura testo, icone e bordi, oltre alla sola visibilità del riquadro footer.
const BASE = process.env.CROP_CONTROLS_URL || 'http://127.0.0.1:3000';
const OUT = process.env.CROP_CONTROLS_OUTPUT || '/tmp/crop-controls-qa';
const APP = `${BASE}/espressione?cognome=QA&nome=Ritaglio&classe=2A&cornice=qa-crop-buttons`;
const PHOTO = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1500"><rect width="900" height="1500" fill="#fffdf6"/><text x="65" y="160" font-size="60">2 + 3</text></svg>');
const cases = [
  {name:'mobile-280',width:280,height:600},
  {name:'mobile-320',width:320,height:568},
  {name:'mobile-360',width:360,height:640},
  {name:'mobile-393',width:393,height:780},
  {name:'mobile-320-grande',width:320,height:568,scale:1.6},
  {name:'mobile-393-grande',width:393,height:780,scale:1.6},
  {name:'landscape-grande',width:740,height:360,scale:1.6},
  {name:'blog-320',width:320,height:568,embed:true},
  {name:'blog-393-grande',width:393,height:780,embed:true,scale:1.6},
  {name:'desktop',width:1280,height:800,desktop:true},
];
const selected = process.env.CROP_CONTROLS_CASE ? cases.filter(c => c.name === process.env.CROP_CONTROLS_CASE) : cases;
if (!selected.length) throw new Error('Scenario CROP_CONTROLS_CASE sconosciuto');
await fs.mkdir(OUT,{recursive:true});
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-features=LocalNetworkAccessChecks']});
const results = [];
for (const c of selected) {
  const context = await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:!c.desktop,hasTouch:!c.desktop,deviceScaleFactor:1});
  if (c.scale) await context.addInitScript(scale => { try { localStorage.setItem('wms_access',JSON.stringify({fontScale:scale,lineHeight:2.6,ruler:false,mode:'contrasto'})); } catch {} },c.scale);
  // Osserva il File prodotto dal vero cropper senza cambiare contenuto o API.
  await context.addInitScript(()=>{ const NativeFile=window.File; window.__qaCropFile=null; window.File=class extends NativeFile { constructor(parts,name,options){super(parts,name,options);if(name==='foto_ritagliata.png')window.__qaCropFile={type:this.type,size:this.size};} }; });
  const page = await context.newPage();
  const record = {name:c.name, checks:[], ok:false};
  const errors = [];
  let ocrCalls=0, ocrImage=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/ai/transcribe',route=>{ ocrCalls++; try { const body=route.request().postDataJSON(); ocrImage=body?.kind==='photo'&&body?.image?.startsWith('data:image/jpeg'); } catch {} return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:'2+3'})}); });
  const check=(name,ok,detail)=>{record.checks.push({name,ok:Boolean(ok),detail});};
  try {
    if (c.embed) {
      await page.route('http://localhost:3000/__qa-crop-buttons',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><header style="height:180px">Simulazione del post</header><div style="margin:0 8px"><iframe title="App" src="${APP}" style="width:100%;height:1400px;border:0"></iframe></div><footer style="height:900px">Fine post</footer><script>window.heights=[];addEventListener('message',e=>{const f=document.querySelector('iframe');if(e.source===f.contentWindow&&e.data?.type==='labvisivo:height'&&e.data.cornice==='qa-crop-buttons'){heights.push(e.data.height);f.style.height=Math.max(640,e.data.height)+'px'}})</script></body></html>`}));
      await page.goto('http://localhost:3000/__qa-crop-buttons');
      await page.waitForTimeout(1000);
      await page.evaluate(()=>scrollTo(0,180));
    } else await page.goto(APP);
    const frame = c.embed ? page.frames().find(f=>f.url().startsWith(BASE)) : page.mainFrame();
    if (!frame) throw new Error('Iframe dell’app non disponibile');
    await frame.locator('input[type=file]').first().waitFor({state:'attached'});
    await frame.evaluate(()=>document.fonts.ready);
    const dialog=frame.locator('[role=dialog]');
    const open=async()=>{
      await frame.locator('input[type=file]').first().setInputFiles({name:'foto-sintetica.svg',mimeType:'image/svg+xml',buffer:PHOTO});
      await dialog.waitFor({state:'visible'});
      await frame.waitForFunction(()=>document.querySelector('[role=dialog] img')?.naturalWidth>0);
      await page.waitForTimeout(250);
    };
    await open();
    const info=await dialog.evaluate(d=>{
      const footer=d.querySelector('[data-crop-controls]');
      const f=footer.getBoundingClientRect(),dr=d.getBoundingClientRect();
      const box=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});
      const intersect=(a,b)=>a.left<b.right-0.5&&a.right>b.left+0.5&&a.top<b.bottom-0.5&&a.bottom>b.top+0.5;
      const buttons=[...footer.querySelectorAll(':scope > button')].map(btn=>{
        const r=btn.getBoundingClientRect(), cs=getComputedStyle(btn);
        const walker=document.createTreeWalker(btn,NodeFilter.SHOW_TEXT);
        const words=[];
        while(walker.nextNode()) {
          const node=walker.currentNode;
          for(const m of node.textContent.matchAll(/\S+/g)) {
            const range=document.createRange();range.setStart(node,m.index);range.setEnd(node,m.index+m[0].length);
            const rs=[...range.getClientRects()].filter(x=>x.width&&x.height).map(box);
            words.push({text:m[0],rects:rs});
          }
        }
        const icons=[...btn.querySelectorAll('svg')].map(el=>box(el.getBoundingClientRect()));
        const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return {label:btn.textContent.trim(),rect:box(r),icons,words,scrollWidth:btn.scrollWidth,clientWidth:btn.clientWidth,fontSize:parseFloat(cs.fontSize),hit:hit===btn||btn.contains(hit)};
      });
      const tolerance=1.5;
      const inside=(inner,outer)=>inner.left>=outer.left-tolerance&&inner.right<=outer.right+tolerance&&inner.top>=outer.top-tolerance&&inner.bottom<=outer.bottom+tolerance;
      const contents=buttons.flatMap(b=>[...b.icons,...b.words.flatMap(w=>w.rects)].map(r=>({label:b.label,rect:r,inside:inside(r,b.rect)})));
      const overlaps=buttons.flatMap(b=>b.icons.flatMap(i=>b.words.flatMap(w=>w.rects.filter(t=>intersect(i,t)).map(t=>({label:b.label,icon:i,text:t})))));
      const buttonOverlaps=[];
      for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++)if(intersect(buttons[i].rect,buttons[j].rect))buttonOverlaps.push([buttons[i].label,buttons[j].label]);
      return {footer:box(f),dialog:box(dr),buttons,contents,overlaps,buttonOverlaps,footerInsideDialog:inside(f,dr),splitWords:buttons.flatMap(b=>b.words.filter(w=>w.rects.length>1).map(w=>({label:b.label,word:w.text,rects:w.rects})))};
    });
    const footerMain=await frame.locator('[data-crop-controls]').boundingBox();
    check('quattro pulsanti e otto maniglie',info.buttons.length===4&&await dialog.locator('[role=slider]').count()===8,{buttons:info.buttons.length});
    check('footer interamente visibile nel dialogo e nello schermo',info.footerInsideDialog&&footerMain.y>=-1&&footerMain.y+footerMain.height<=c.height+1,{footer:info.footer,footerMain,dialog:info.dialog});
    check('pulsanti dentro il footer e senza sovrapposizioni',info.buttons.every(b=>b.rect.left>=info.footer.left-1&&b.rect.right<=info.footer.right+1&&b.rect.top>=info.footer.top-1&&b.rect.bottom<=info.footer.bottom+1)&&info.buttonOverlaps.length===0,{buttons:info.buttons.map(b=>({label:b.label,rect:b.rect})),overlaps:info.buttonOverlaps});
    check('icone e parole interamente dentro i pulsanti',info.contents.every(v=>v.inside)&&info.buttons.every(b=>b.scrollWidth<=b.clientWidth+1),{outside:info.contents.filter(v=>!v.inside),buttons:info.buttons.map(b=>({label:b.label,scroll:b.scrollWidth,client:b.clientWidth}))});
    check('icone e testo non si sovrappongono',info.overlaps.length===0,info.overlaps);
    check('nessuna parola spezzata a metà',info.splitWords.length===0,info.splitWords);
    check('target almeno 44px e raggiungibili',info.buttons.every(b=>b.rect.width>=44&&b.rect.height>=44&&b.hit),info.buttons.map(b=>({label:b.label,w:b.rect.width,h:b.rect.height,hit:b.hit})));
    check('testo segue la dimensione accessibile senza riduzioni',info.buttons.every(b=>b.fontSize>=14*(c.scale||1)-0.5),info.buttons.map(b=>({label:b.label,font:b.fontSize})));
    await page.screenshot({path:`${OUT}/${c.name}.png`});
    const photoScroll=dialog.locator('[data-crop-scroll]');
    const scrollMetrics=await photoScroll.evaluate(el=>({clientHeight:el.clientHeight,scrollHeight:el.scrollHeight}));
    const scrollBounds=await photoScroll.boundingBox();
    check('la foto ha un’area scorrevole separata dai pulsanti',scrollMetrics.clientHeight>=80&&scrollBounds.y+scrollBounds.height<=footerMain.y+1,{scrollMetrics,scrollBounds,footerMain});
    const lowerHandle=dialog.getByRole('slider',{name:'Ridimensiona il lato inferiore della finestra di ritaglio'});
    await lowerHandle.scrollIntoViewIfNeeded();
    await lowerHandle.focus();
    const beforeHandle=Number(await lowerHandle.getAttribute('aria-valuenow'));
    await page.keyboard.press('ArrowUp');
    const afterHandle=Number(await lowerHandle.getAttribute('aria-valuenow'));
    const footerAfter=await frame.locator('[data-crop-controls]').boundingBox();
    check('la maniglia inferiore si raggiunge e si usa anche con font grande',afterHandle<beforeHandle&&Math.abs(footerAfter.y-footerMain.y)<1,{beforeHandle,afterHandle,footerMain,footerAfter});
    const left=frame.getByRole('button',{name:'Ruota la foto di 90 gradi a sinistra'});
    const right=frame.getByRole('button',{name:'Ruota la foto di 90 gradi a destra'});
    await left.click();
    await frame.waitForFunction(()=>{const i=document.querySelector('[role=dialog] img');return i?.naturalWidth===1500&&i.naturalHeight===900});
    await right.click();
    await frame.waitForFunction(()=>{const i=document.querySelector('[role=dialog] img');return i?.naturalWidth===900&&i.naturalHeight===1500});
    check('entrambe le rotazioni funzionano',true);
    check('nessuna trascrizione prima della conferma',ocrCalls===0,ocrCalls);
    await frame.getByRole('button',{name:'Chiudi',exact:true}).click();
    await dialog.waitFor({state:'detached'});
    check('chiusura libera il blocco del dialogo',!(await frame.evaluate(()=>document.documentElement.hasAttribute('data-lf-crop-open'))));
    await open();
    await frame.getByRole('button',{name:'Ritaglia',exact:true}).click();
    await dialog.waitFor({state:'detached'});
    await frame.locator('[aria-label="Pezzi trascritti"] .katex').first().waitFor({timeout:10000});
    const cropFile=await frame.evaluate(()=>window.__qaCropFile);
    // Il cropper emette PNG; il consumer IA lo ridimensiona in JPEG a qualità
    // 0.92 prima della richiesta. Il mock osserva il contratto esistente.
    check('conferma PNG e trascrizione simulata funzionano',ocrCalls===1&&ocrImage&&cropFile?.type==='image/png'&&cropFile?.size>0,{ocrCalls,ocrImage,cropFile});
    check('nessun errore JavaScript',errors.length===0,errors);
    record.ok=record.checks.every(x=>x.ok);
    if(!record.ok) record.error=record.checks.filter(x=>!x.ok).map(x=>x.name).join('; ');
  } catch(err) {
    record.error=String(err?.message||err);
    await page.screenshot({path:`${OUT}/${c.name}-FAIL.png`}).catch(()=>{});
  }
  results.push(record);
  console.log(c.name,record.ok?'OK':'FAIL',record.checks.length,record.error||'');
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/results.json`,JSON.stringify(results,null,2));
console.log(`RISULTATI ${results.filter(x=>x.ok).length}/${results.length}`);
if(results.some(x=>!x.ok))process.exitCode=1;

