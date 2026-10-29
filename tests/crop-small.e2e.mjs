import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const BASE=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const out='/tmp/crop8731-extra';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:393,height:780},hasTouch:true,isMobile:true});
const page=await ctx.newPage();const records=[];
function check(name,ok,detail){records.push({name,ok,detail});if(!ok)throw Error(name);}
try{
 await page.goto(BASE+'/photo-crop-test');
 await page.locator('input[type=file]').first().waitFor({state:'attached'});
 await page.evaluate(()=>document.fonts.ready);
 const before=await page.evaluate(()=>({body:document.body.style.cssText,html:document.documentElement.style.cssText,y:scrollY}));
 async function open(width,height){
  const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><path d="M0,0L${width},${height}" stroke="black"/></svg>`);
  await page.locator('input[type=file]').first().setInputFiles({name:'foto.svg',mimeType:'image/svg+xml',buffer:svg});
  await page.locator('[role=dialog]').waitFor();
  await page.waitForFunction(()=>document.querySelector('[role=dialog] img')?.naturalWidth>0);
  await page.waitForTimeout(200);
 }
 await open(60,90);
 const image=await page.locator('[role=dialog] img').evaluate(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height,nw:el.naturalWidth,nh:el.naturalHeight}});
 check('foto piccola ingrandita solo a schermo',image.w>image.nw,image);
 check('foto piccola senza deformazione',Math.abs(image.w/image.h-image.nw/image.nh)<0.015,image);
 check('tutte le otto maniglie disponibili',await page.locator('[role=dialog] [role=slider]').count()===8);
 await page.keyboard.press('Escape');await page.locator('[role=dialog]').waitFor({state:'detached'});
 check('Escape chiude senza produrre PNG',await page.locator('[data-photo-crop-result]').getAttribute('data-count')==='0');
 await open(60,90);await page.locator('[data-slot=dialog-close]').click();
 await page.locator('[role=dialog]').waitFor({state:'detached'});
 check('X chiude e la stessa foto si puo riselezionare',await page.locator('[data-photo-crop-result]').getAttribute('data-count')==='0');
 const after=await page.evaluate(()=>({body:document.body.style.cssText,html:document.documentElement.style.cssText,y:scrollY}));
 check('Escape/X ripristinano stili e scroll',JSON.stringify(before)===JSON.stringify(after),{before,after});
 await open(3000,5000);
 await page.getByRole('button',{name:'Ritaglia',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-photo-crop-result]')?.getAttribute('data-count')==='1');
 const expectedW=Math.round(3000*2200/5000);
 check('foto grande PNG limitata a 2200px senza cambiare proporzioni',await page.locator('[data-photo-crop-result]').textContent()===`image/png ${expectedW}×2200`);
 console.log('EXTRA',records.length,'controlli OK');
}finally{await fs.writeFile(out+'/results.json',JSON.stringify(records,null,2));await browser.close();}

