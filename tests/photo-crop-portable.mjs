import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const BASE = process.env.CROP_KIT_URL ?? 'http://127.0.0.1:3010';
const APP = BASE + (process.env.CROP_KIT_PATH ?? '/photo-crop-test');
const OUTPUT = process.env.CROP_KIT_OUTPUT ?? '/tmp/photo-crop-portable-qa';
await fs.mkdir(OUTPUT, { recursive: true });
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1500"><rect width="900" height="1500" fill="white"/><text x="50" y="100" font-size="50">Foto di prova</text></svg>');
const allCases = [
  { name: 'mobile-320', width: 320, height: 568 },
  { name: 'mobile-393', width: 393, height: 780 },
  { name: 'landscape', width: 740, height: 360 },
  { name: 'blog-stretto', width: 320, height: 568, embed: true },
  { name: 'blog-scorso', width: 393, height: 780, embed: true },
  { name: 'desktop-tastiera', width: 1280, height: 800, desktop: true },
];
const cases = process.env.CROP_CASE ? allCases.filter(c=>c.name===process.env.CROP_CASE) : allCases;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-features=LocalNetworkAccessChecks'] });
const results = [];
for (const scenario of cases) {
  const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, hasTouch: !scenario.desktop, isMobile: !scenario.desktop });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name, ok, detail });
    if (!ok) throw new Error(name);
  }
  const record = { scenario: scenario.name, checks, ok: false };
  try {
    if (scenario.embed) {
      await page.route('http://localhost:3010/__crop-kit-blog', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><header style="height:250px">Blog di prova</header><iframe title="Photo crop" src="${APP}?cornice=kit" style="width:100%;height:1500px;border:0"></iframe><footer style="height:1000px">Fine</footer><script>addEventListener('message',e=>{if(e.data?.type==='labvisivo:height')document.querySelector('iframe').style.height=Math.max(640,e.data.height)+'px'})</script></body>` }));
      await page.goto('http://localhost:3010/__crop-kit-blog');
    } else await page.goto(APP);
    const frame = scenario.embed ? page.frames().find(f => f.url().startsWith(BASE)) : page.mainFrame();
    await frame.locator('input[type=file]').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(400);
    await frame.evaluate(() => document.fonts.ready);
    if (scenario.embed) await page.evaluate(() => window.scrollTo(0, 450));
    const before = await frame.evaluate(() => ({ body: document.body.style.cssText, html: document.documentElement.style.cssText, y: scrollY }));
    const outer = await page.evaluate(() => scrollY);
    async function open() {
      await frame.locator('input[type=file]').first().setInputFiles({ name: 'foto.svg', mimeType: 'image/svg+xml', buffer: svg });
      await frame.locator('[role=dialog]').waitFor();
      await frame.waitForFunction(() => document.querySelector('[role=dialog] img')?.naturalWidth > 0);
      await page.waitForTimeout(200);
    }
    await open();
    const dialog = frame.locator('[role=dialog]');
    check('titolo senza istruzioni', await dialog.getByRole('heading',{name:'Ritaglia la foto',exact:true}).count() === 1 && await dialog.getByText(/Lascia solo il testo|Se la foto è storta/).count() === 0);
    const rect = await dialog.boundingBox();
    check('modale nel viewport visibile', rect.y >= -1 && rect.y + rect.height <= scenario.height + 1, rect);
    const buttons = await frame.locator('[data-crop-footer] > button').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { text: el.textContent.trim(), width: r.width, height: r.height, y: r.y, background: s.backgroundColor }; }));
    check('quattro comandi marroni compatti in un riquadro senza AZZERA', buttons.length === 4 && buttons[0].text === 'Ruota sinistra' && buttons[1].text === 'Ruota destra' && buttons[2].text === 'Chiudi' && buttons[3].text === 'Ritaglia' && buttons.every(b => b.background === 'rgb(168, 91, 60)' && b.height >= 44 && b.width < 200) && await frame.locator('[data-crop-controls]').count() === 1 && await frame.getByRole('button', {name: 'Azzera', exact: true}).count() === 0, buttons);
    check('pagina dietro ferma', await frame.evaluate(() => getComputedStyle(document.body).position === 'fixed'));
    const scroll = frame.locator('[data-crop-scroll]');
    if (!scenario.desktop) {
      const cdp = await context.newCDPSession(page);
      const r = await scroll.boundingBox();
      const x = r.x + 5, y = Math.min(r.y + r.height - 25, scenario.height - 100);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 120 * step / 8 }] });
        await page.waitForTimeout(20);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(150);
      check('pan interno senza spostare blog', await scroll.evaluate(el => el.scrollHeight <= el.clientHeight+1 || el.scrollTop >= Math.min(10, el.scrollHeight-el.clientHeight-1)) && Math.abs((await page.evaluate(() => scrollY)) - outer) < 2);
    }
    await frame.getByRole('button', { name: 'Ruota la foto di 90 gradi a destra' }).click();
    await frame.waitForFunction(() => document.querySelector('[role=dialog] img')?.naturalWidth === 1500);
    check('rotazione PNG reale', true);
    if (scenario.desktop) {
      const edge = frame.getByRole('slider', { name: 'Ridimensiona il lato superiore della finestra di ritaglio', exact: true });
      await edge.focus(); await page.keyboard.press('ArrowDown');
      check('geometria da tastiera', await edge.getAttribute('aria-valuenow') === '98');
    }
    // Selezione ridotta senza modificare la geometria della sorgente.
    for (const [name,key] of [['superiore','ArrowDown'],['inferiore','ArrowUp'],['sinistro','ArrowRight'],['destro','ArrowLeft']]) {
      await frame.getByRole('slider',{name:`Ridimensiona il lato ${name} della finestra di ritaglio`,exact:true}).focus();
      await page.keyboard.press('Shift+'+key);
    }
    const selection=frame.locator('[data-crop-selection]');
    check('area intera trascinabile senza icona',await selection.locator('svg,span,button').count()===0 && await selection.evaluate(el=>getComputedStyle(el).touchAction)==='none');
    const beforeMove=await selection.evaluate(el=>parseFloat(el.style.left));
    const r=await selection.boundingBox();
    const x=r.x+r.width/2,y=r.y+r.height/2;
    if(scenario.desktop){await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+12,y+6,{steps:4});await page.mouse.up();}
    else {
      const cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let n=1;n<=4;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+12*n/4,y:y+6*n/4}]});await page.waitForTimeout(20);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    check('crop si sposta direttamente col dito o mouse',await selection.evaluate(el=>parseFloat(el.style.left))>beforeMove+.2);
    await page.screenshot({ path: `${OUTPUT}/${scenario.name}.png` });
    await frame.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    const after = await frame.evaluate(() => ({ body: document.body.style.cssText, html: document.documentElement.style.cssText, y: scrollY }));
    check('chiusura ripristina stili e scroll', JSON.stringify(before) === JSON.stringify(after), { before, after });
    check('CHIUDI non produce immagini', await frame.locator('[data-photo-crop-result]').getAttribute('data-count') === '0');
    await open();
    await frame.getByRole('button', { name: 'Ritaglia', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await frame.waitForFunction(() => document.querySelector('[data-photo-crop-result]')?.getAttribute('data-count') === '1');
    check('RITAGLIA consegna un PNG reale una sola volta', (await frame.locator('[data-photo-crop-result]').textContent()) === 'image/png 900×1500');
    check('nessun errore JavaScript', errors.length === 0, errors);
    record.ok = true;
  } catch (error) {
    record.error = error.message;
    await page.screenshot({ path: `${OUTPUT}/${scenario.name}-FAILED.png` }).catch(() => {});
  }
  results.push(record);
  console.log(scenario.name, record.ok ? 'OK' : 'FAIL', record.error ?? '');
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUTPUT}/results.json`, JSON.stringify(results, null, 2));
if (results.some(result => !result.ok)) process.exitCode = 1;
