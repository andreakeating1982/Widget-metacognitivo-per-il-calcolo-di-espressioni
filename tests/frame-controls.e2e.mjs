import { chromium } from 'playwright';
import fs from 'node:fs/promises';

// Collaudo della cornice REALE, senza toccare il post Blogger o il database.
const BASE=process.env.FRAME_CONTROLS_URL||'http://127.0.0.1:3000';
const OUT=process.env.FRAME_CONTROLS_OUTPUT||'/tmp/frame-controls-qa';
const ROOT=process.env.FRAME_PROJECT_DIR||process.cwd();
const cases=[
 {name:'mobile-280',w:280,h:600},
 {name:'mobile-320',w:320,h:568},
 {name:'mobile-393',w:393,h:780},
 {name:'landscape',w:740,h:360},
 {name:'desktop',w:1280,h:800,desktop:true},
];
const selected=process.env.FRAME_CASE?cases.filter(x=>x.name===process.env.FRAME_CASE):cases;
if(!selected.length)throw new Error('Scenario FRAME_CASE sconosciuto');
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
for(const c of selected){
 const context=await browser.newContext({viewport:{width:c.w,height:c.h},isMobile:!c.desktop,hasTouch:!c.desktop,deviceScaleFactor:1});
 const page=await context.newPage();
 const record={name:c.name,ok:false,checks:[]}, errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok,detail)=>record.checks.push({name,ok:Boolean(ok),detail});
 try{
  await page.goto(BASE+'/anteprima-cornice.html');
  await page.locator('.lf-cornice .lf-testata').waitFor();
  await page.waitForFunction(()=>{const f=document.querySelector('.lf-iframe');return f?.contentDocument?.querySelector('input[aria-label="Nome"]')});
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:'body button { color:#f8f1e4; background:transparent; } body svg { width:1px; height:1px; fill:black; stroke:black; }'});
  await page.waitForTimeout(400);
  const facts=await page.evaluate(()=>{
   const header=document.querySelector('.lf-testata'),frame=document.querySelector('.lf-cornice');
   const hr=header.getBoundingClientRect(), fr=frame.getBoundingClientRect();
   const rect=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});
   const lum=rgb=>{const n=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4});return .2126*n[0]+.7152*n[1]+.0722*n[2]};
   const buttons=[...header.querySelectorAll('.lf-btn')].map(btn=>{
    const r=btn.getBoundingClientRect(),style=getComputedStyle(btn),svg=btn.querySelector('svg'),path=svg?.querySelector('path'),ir=svg?.getBoundingClientRect(),sr=svg?getComputedStyle(svg):null;
    const a=lum(style.color),b=lum(style.backgroundColor),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const center=r.x+r.width/2;
    const hitAt=y=>{const hit=document.elementFromPoint(center,y);return hit===btn||btn.contains(hit)};
    const label=btn.querySelector('.lf-lbl'),before=getComputedStyle(btn,'::before');
    return {label:btn.getAttribute('aria-label'),text:label?.textContent.trim(),labelVisible:!!label&&getComputedStyle(label).display!=='none',rect:rect(r),icon:ir&&rect(ir),background:style.backgroundColor,borderColor:style.borderTopColor,borderRadius:style.borderRadius,color:style.color,fontSize:style.fontSize,contrast,stroke:sr?.stroke,strokeWidth:sr?.strokeWidth,d:path?.getAttribute('d'),paths:svg?.querySelectorAll('path').length,directPaths:svg?.querySelectorAll(':scope > path').length,hitCenter:hitAt(r.y+r.height/2),hitAbove:hitAt(r.top-5),hitBelow:hitAt(r.bottom+5),targetAbove:parseFloat(before.top),targetBelow:parseFloat(before.bottom),targetHeight:parseFloat(before.height)};
   });
   return {header:rect(hr),frame:rect(fr),buttons,docWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,title:header.querySelector('.lf-titolo').textContent.trim()};
  });
  const [full,reload]=facts.buttons;
  const separate=full.rect.right<=reload.rect.left+1||reload.rect.right<=full.rect.left+1||full.rect.bottom<=reload.rect.top+1||reload.rect.bottom<=full.rect.top+1;
  check('titolo corretto e due pulsanti con etichette della foto',facts.title==='WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI'&&facts.buttons.length===2&&full.text==='Schermo intero'&&reload.text==='Ricarica'&&facts.buttons.every(b=>b.labelVisible),facts);
  check('pulsanti senza overflow o sovrapposizione',facts.buttons.every(b=>b.rect.height>=32&&b.rect.width>=44&&b.rect.left>=facts.header.left-1&&b.rect.right<=facts.header.right+1&&b.rect.top>=facts.header.top-1&&b.rect.bottom<=facts.header.bottom+1)&&separate&&facts.docWidth<=facts.viewport+1,facts);
  check('area tappabile estesa a 44px, anche fuori dal bordo',facts.buttons.every(b=>b.hitCenter&&b.hitAbove&&b.hitBelow&&b.targetHeight>=44),facts.buttons.map(b=>({label:b.label,height:b.rect.height,targetHeight:b.targetHeight,hitCenter:b.hitCenter,hitAbove:b.hitAbove,hitBelow:b.hitBelow,top:b.targetAbove,bottom:b.targetBelow})));
  check('icone originali da 16px interamente nel pulsante',facts.buttons.every(b=>Math.abs(b.icon.width-16)<0.1&&Math.abs(b.icon.height-16)<0.1&&b.icon.left>=b.rect.left-1&&b.icon.right<=b.rect.right+1&&b.icon.top>=b.rect.top-1&&b.icon.bottom<=b.rect.bottom+1),facts.buttons);
  check('sfondo chiaro, bordo sottile e testo scuro come nella foto',facts.buttons.every(b=>b.background==='rgb(253, 251, 248)'&&b.borderColor==='rgb(222, 219, 214)'&&b.borderRadius==='10px'&&b.fontSize==='12px'&&b.color==='rgb(46, 32, 24)'&&b.stroke==='rgb(46, 32, 24)'&&b.contrast>=4.5&&parseFloat(b.strokeWidth)===2),facts.buttons.map(b=>({color:b.color,bg:b.background,border:b.borderColor,radius:b.borderRadius,font:b.fontSize,stroke:b.stroke,contrast:b.contrast,strokeWidth:b.strokeWidth})));
  check('un solo path diretto per ogni icona, nessun path annidato',facts.buttons.every(b=>b.paths===1&&b.directPaths===1),facts.buttons.map(b=>({paths:b.paths,directPaths:b.directPaths})));
  check('icona schermo conserva quattro angoli e ricarica conserva la freccia',((full.d||'').match(/M/g)||[]).length===4&&(reload.d||'').includes('M21 3v5h-5'),facts.buttons.map(b=>b.d));
  check('pulsanti con etichetta accessibile e title',await page.getByRole('button',{name:'Apri a schermo intero'}).count()===1&&await page.getByRole('button',{name:"Ricarica l'app"}).count()===1&&await page.locator('.lf-btn[title]').count()===2);
  await page.locator('.lf-testata').screenshot({path:`${OUT}/${c.name}-header.png`});
  await page.screenshot({path:`${OUT}/${c.name}-page.png`});
  const fsBtn=page.getByRole('button',{name:'Apri a schermo intero'});
  await fsBtn.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  check('focus da tastiera visibile',await fsBtn.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')&&parseFloat(getComputedStyle(el).outlineWidth)>=2));
  if(c.desktop){
   await fsBtn.click();
  }else{
   // Tocco reale cinque pixel sopra il bordo visibile: rientra nell'area
   // tattile estesa e non deve colpire il titolo o un altro pulsante.
   const bounds=await fsBtn.boundingBox();
   await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y-5);
  }
  await page.waitForFunction(()=>document.fullscreenElement?.classList.contains('lf-cornice'),null,{timeout:5000});
  check('schermo intero apre la cornice (touch fuori bordo su mobile)',await page.evaluate(()=>document.fullscreenElement?.classList.contains('lf-cornice')));
  await fsBtn.click();
  await page.waitForFunction(()=>!document.fullscreenElement,null,{timeout:5000});
  check('uscita da schermo intero',await page.evaluate(()=>!document.fullscreenElement));
  const iframe=page.locator('iframe.lf-iframe');
  const app=page.frames().find(f=>f.url().startsWith(BASE)&&f!==page.mainFrame());
  if(!app)throw new Error('App in cornice non trovata');
  await app.getByLabel('Nome',{exact:true}).fill('SoloProva');
  await iframe.evaluate(el=>{el.contentWindow.__qaBeforeReload=true});
  const reloadBtn=page.getByRole('button',{name:"Ricarica l'app"});
  // La compilazione del campo nell'iframe può aver fatto scorrere il post:
  // riportare il comando nel viewport prima di simulare un tocco umano.
  await reloadBtn.scrollIntoViewIfNeeded();
  if(c.desktop){
   await reloadBtn.click();
  }else{
   // Verifica anche il bordo inferiore dell'area tattile estesa.
   const bounds=await reloadBtn.boundingBox();
   await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y+bounds.height+5);
  }
  await page.waitForFunction(()=>{const f=document.querySelector('iframe.lf-iframe');return f?.contentDocument?.querySelector('input[aria-label="Nome"]')&&f.contentWindow.__qaBeforeReload!==true},null,{timeout:10000});
  const fresh=page.frames().find(f=>f.url().startsWith(BASE)&&f!==page.mainFrame());
  check('ricarica riapre davvero l’app senza ricaricare il post',await fresh.getByLabel('Nome',{exact:true}).inputValue()===''&&await page.locator('.nota-anteprima').count()===1);
  check('nessun errore JavaScript',errors.length===0,errors);
  record.ok=record.checks.every(x=>x.ok);
  if(!record.ok)record.error=record.checks.filter(x=>!x.ok).map(x=>x.name).join('; ');
 }catch(err){record.error=String(err?.message||err);await page.screenshot({path:`${OUT}/${c.name}-FAIL.png`}).catch(()=>{});}
 results.push(record);console.log(c.name,record.ok?'OK':'FAIL',record.checks.length,record.error||'');
 await context.close();
}
// Due copie autonome: ricaricare una non deve intercettare l'altra.
if(!process.env.FRAME_CASE){
 const record={name:'due-cornici-isolate',ok:false,checks:[]};
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
 const check=(name,ok,detail)=>record.checks.push({name,ok:Boolean(ok),detail});
 try{
  const source=await fs.readFile(ROOT+'/cornice-dinamica/embed-espressioni-dedicata.html','utf8');
  const prod="var APP_URL = 'https://espressioni-monomi-polinomi.easy-peasy.site/';";
  if(source.split(prod).length!==2)throw new Error('App URL inatteso nel file dedicato');
  const snippet=source.replace(prod,"var APP_URL = window.location.origin + '/';").replaceAll('https://espressioni-monomi-polinomi.easy-peasy.site/fonts/','/fonts/');
  await page.route(BASE+'/__qa-due-cornici',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><main>${snippet}<div style="height:10px"></div>${snippet}</main>`}));
  await page.goto(BASE+'/__qa-due-cornici');
  await page.waitForFunction(()=>document.querySelectorAll('.lf-cornice').length===2&&[...document.querySelectorAll('.lf-iframe')].every(f=>f.contentDocument?.querySelector('input[aria-label="Nome"]')),null,{timeout:15000});
  await page.waitForTimeout(1300);
  const identity=await page.evaluate(()=>[...document.querySelectorAll('.lf-cornice')].map(el=>({id:el.id,token:new URL(el.querySelector('iframe').src).searchParams.get('cornice')})));
  check('token e id distinti',identity[0].id!==identity[1].id&&identity[0].token!==identity[1].token,identity);
  const frames=page.locator('.lf-iframe');
  await frames.nth(1).evaluate(el=>{el.contentWindow.__qaOtherFrame=true});
  await page.locator('.lf-cornice').nth(0).locator('.lf-reload').click();
  await page.waitForTimeout(1000);
  check('ricarica solo la cornice scelta',await frames.nth(1).evaluate(el=>el.contentWindow.__qaOtherFrame===true));
  const before=await frames.nth(1).evaluate(el=>el.getBoundingClientRect().height);
  await frames.nth(0).evaluate((el,token)=>el.contentWindow.eval(`parent.postMessage({type:'labvisivo:height',height:2999,cornice:'${token}'}, '*')`),identity[1].token);
  await page.waitForTimeout(550);
  const after=await frames.nth(1).evaluate(el=>el.getBoundingClientRect().height);
  check('messaggio da un’altra app non ridimensiona la cornice',Math.abs(after-before)<=2,{before,after});
  record.ok=record.checks.every(x=>x.ok);
  if(!record.ok)record.error=record.checks.filter(x=>!x.ok).map(x=>x.name).join('; ');
 }catch(err){record.error=String(err?.message||err);await page.screenshot({path:`${OUT}/due-cornici-FAIL.png`}).catch(()=>{});}
 results.push(record);console.log(record.name,record.ok?'OK':'FAIL',record.checks.length,record.error||'');
 await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/results.json`,JSON.stringify(results,null,2));
console.log(`RISULTATI ${results.filter(x=>x.ok).length}/${results.length}`);
if(results.some(x=>!x.ok))process.exitCode=1;

