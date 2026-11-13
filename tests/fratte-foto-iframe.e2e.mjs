import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

// La fixture deriva dal costruttore e dal riparatore veri; tutte le API
// vengono intercettate. Nessun dato di studenti o servizio esterno.
const base = process.env.FRATTE_QA_URL || 'http://127.0.0.1:3174';
const fixtureFile = process.env.FRATTE_QA_FIXTURES || '/tmp/widget-student-flow-fixtures.json';
const out = process.env.FRATTE_QA_OUTPUT || '/tmp/widget-fratte-iframe';
const fixture = JSON.parse(await fs.readFile(fixtureFile, 'utf8')).find(x => x.name === 'frazioni-letterali-foto');
if (!fixture || fixture.answers.length !== 7) throw new Error('Fixture della foto non valida');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const results = [];

for (const scenario of [
  { name: 'desktop', width: 1280, height: 820 },
  { name: 'telefono-iframe', width: 390, height: 780, embed: true },
  { name: 'caratteri-160-iframe', width: 320, height: 740, embed: true, large: true },
]) {
  const checks = [], errors = [], unexpectedApi = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
    if (!ok) throw new Error(`${name}: ${JSON.stringify(detail)}`);
  };
  const context = await browser.newContext({
    viewport: { width: scenario.width, height: scenario.height },
    isMobile: scenario.width < 600, hasTouch: scenario.width < 600,
  });
  await context.addInitScript(large => localStorage.setItem('wms_access', JSON.stringify({
    fontScale: large ? 1.6 : 1, lineHeight: large ? 2.6 : 1.65, ruler: false, mode: 'normale',
  })), !!scenario.large);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname === '/api/esercizio/sessione/qa-foto') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ esercizio: fixture.esercizio }) });
    }
    unexpectedApi.push({ method: route.request().method(), path: url.pathname });
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"test isolato"}' });
  });
  let frame;
  try {
    const appUrl = `${base}/esercizio?sid=qa-foto${scenario.embed ? '&cornice=qa-fratte' : ''}`;
    if (scenario.embed) {
      const host = `${base}/__qa-fratte-host`;
      await page.route(host, route => route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><header style="height:64px">Blog di prova</header><iframe title="Widget di prova" src="${appUrl}" style="border:0;width:100%;height:640px"></iframe></body></html>`,
      }));
      await page.goto(host);
      await page.locator('iframe').waitFor();
      frame = page.frames().find(f => f.url().includes('/esercizio?sid=qa-foto'));
      if (!frame) throw new Error('Iframe di prova non trovato');
    } else {
      await page.goto(appUrl);
      frame = page.mainFrame();
    }
    await frame.locator('[data-box=b1]').waitFor();
    await frame.evaluate(() => document.fonts.ready);
    const first = frame.locator('[data-box=b1]');
    const opFirst = await first.locator('annotation').first().textContent();
    check('il primo box è il fattore esterno, non la soluzione', opFirst === fixture.esercizio.sezioni[0].boxes[0].op);
    check('i risultati non appaiono prima dell’input', await frame.locator('[data-testid=pillola-formula-risolta]').count() === 0 &&
      await frame.locator('[data-box=b2]').count() === 0 && await frame.getByText('RISULTATO FINALE', { exact: true }).count() === 0);
    const hint = first.locator('[data-testid=istruzione-trascrizione-frazione]');
    await hint.waitFor();
    const structure = await hint.evaluate(el => {
      const p = el.parentElement, s = getComputedStyle(p);
      return { text: p.textContent.replace(/\s+/g, ' ').trim(), tag: p.tagName, background: s.backgroundColor,
        border: parseFloat(s.borderTopWidth), scrollWidth: p.scrollWidth, width: p.clientWidth,
        font: parseFloat(s.fontSize) };
    });
    check('istruzione nel testo normale senza riquadro', /Moltiplico il numeratore per il fattore esterno\./.test(structure.text) &&
      structure.text.includes('(numeratore)/(denominatore)') && structure.tag === 'P' &&
      structure.background === 'rgba(0, 0, 0, 0)' && structure.border === 0 && structure.font >= 18.6, structure);
    check('istruzione e pagina senza sbordamenti orizzontali', structure.scrollWidth <= structure.width + 1 &&
      await frame.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), structure);
    if (scenario.large) {
      const accesso = await hint.evaluate(el => {
        const area = el.closest('.expr-exercise-scroll'), p = el.parentElement;
        const range = document.createRange(); range.selectNodeContents(p);
        const lines = () => [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0).sort((a, b) => a.top - b.top);
        const bounds = () => area.getBoundingClientRect();
        let line = lines()[0]; area.scrollTop += line.top - bounds().top - 2;
        line = lines()[0]; const a = bounds();
        const first = line.top >= a.top - 1 && line.bottom <= a.bottom + 1;
        line = lines().at(-1); area.scrollTop += line.bottom - bounds().bottom + 2;
        line = lines().at(-1); const b = bounds();
        const last = line.top >= b.top - 1 && line.bottom <= b.bottom + 1;
        return { first, last, scrollHeight: area.scrollHeight, clientHeight: area.clientHeight };
      });
      check('con caratteri 160% prima e ultima riga sono raggiungibili scorrendo', accesso.first && accesso.last, accesso);
    }
    if (scenario.name === 'desktop') {
      await frame.evaluate(() => {
        window.__vociQA = [];
        window.speechSynthesis.speak = u => window.__vociQA.push(u.text);
        window.speechSynthesis.cancel = () => {};
      });
      await frame.getByRole('button', { name: 'Ascolto: leggi il testo ad alta voce' }).click();
      const spoken = (await frame.evaluate(() => window.__vociQA.join(' '))).toLocaleLowerCase('it');
      check('ascolto riproduce il metodo senza aggiungere una soluzione', spoken.includes('fattore esterno') &&
        spoken.includes('numeratore') && spoken.includes('denominatore') && !spoken.includes('risultato finale'));
    }
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `${scenario.name}-primo-box.png`) });
    const submit = async (box, text) => {
      await box.getByTitle('Inserisci manualmente il valore', { exact: true }).click();
      const input = box.getByRole('textbox', { name: 'Digita il valore da tastiera' });
      await input.fill(text); await input.press('Enter');
    };
    await submit(first, fixture.answers[0]);
    const second = frame.locator('[data-box=b2]');
    await second.waitFor({ timeout: 15000 });
    check('parentesi quadre e graffe sbloccano il secondo passo', await first.locator('[data-testid=pillola-formula-risolta]').count() === 1);
    check('il secondo box insegna il denominatore comune',
      (await second.innerText()).toLocaleLowerCase('it').includes('porto la frazione allo stesso denominatore'));
    if (scenario.large) {
      const accessoSecondo = await second.locator('p').filter({ hasText: 'Porto la frazione allo stesso denominatore' }).evaluate(el => {
        const area = el.closest('.expr-exercise-scroll');
        const range = document.createRange(); range.selectNodeContents(el);
        const lines = () => [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0).sort((a, b) => a.top - b.top);
        const bounds = () => area.getBoundingClientRect();
        let line = lines()[0]; area.scrollTop += line.top - bounds().top - 2;
        line = lines()[0]; const first = line.top >= bounds().top - 1 && line.bottom <= bounds().bottom + 1;
        line = lines().at(-1); area.scrollTop += line.bottom - bounds().bottom + 2;
        line = lines().at(-1); const last = line.top >= bounds().top - 1 && line.bottom <= bounds().bottom + 1;
        return { first, last };
      });
      check('anche il metodo del secondo box ingrandito è leggibile per intero scorrendo',
        accessoSecondo.first && accessoSecondo.last, accessoSecondo);
    }
    const misuraFormula = async locator => locator.evaluate(el => {
      const d = document.documentElement, inner = el.firstElementChild, rect = el.getBoundingClientRect();
      el.scrollLeft = 0;
      const start = inner.getBoundingClientRect();
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      const inizio = start.left >= rect.left - 1;
      el.scrollLeft = max;
      const end = inner.getBoundingClientRect();
      const fine = end.right <= rect.right + 1;
      return { docScroll: d.scrollWidth, docWidth: d.clientWidth, width: el.clientWidth, max,
        overflow: getComputedStyle(el).overflowX, tabIndex: el.tabIndex, inizio, fine };
    });
    const misureSecondo = await misuraFormula(second.getByRole('region', { name: /Operazione del box 2/ }));
    check('secondo box senza sbordamenti e formula interamente raggiungibile',
      misureSecondo.docScroll <= misureSecondo.docWidth + 1 && misureSecondo.inizio && misureSecondo.fine &&
      (!misureSecondo.max || (misureSecondo.overflow === 'auto' && misureSecondo.tabIndex === 0)), misureSecondo);
    if (scenario.large && misureSecondo.max > 0) {
      const operazione = second.getByRole('region', { name: /Operazione del box 2/ });
      await operazione.evaluate(el => { el.scrollLeft = 0; el.focus(); });
      for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(250);
      check('la tastiera sposta orizzontalmente la formula ingrandita',
        await operazione.evaluate(el => el.scrollLeft > 0));
      await operazione.evaluate(el => { el.scrollLeft = 0; });
    }
    await second.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `${scenario.name}-secondo-box.png`) });
    await submit(second, fixture.answers[1]);
    await frame.locator('[data-box=b3]').waitFor({ timeout: 15000 });
    check('la frazione scritta con parentesi diverse è accettata', await second.locator('[data-testid=pillola-formula-risolta]').count() === 1 &&
      await frame.getByText('RISULTATO FINALE', { exact: true }).count() === 0);
    const misuraVerde = await misuraFormula(second.getByRole('region', { name: /Calcolo verificato del box 2/ }));
    const misuraPillola = await misuraFormula(second.locator('[data-testid=pillola-formula-risolta]'));
    check('calcolo verificato e pillola blu scorrono per intero anche da tastiera',
      [misuraVerde, misuraPillola].every(m => m.inizio && m.fine && (!m.max || (m.overflow === 'auto' && m.tabIndex === 0))),
      { verde: misuraVerde, pillola: misuraPillola });
    if (scenario.large) {
      // Non fermarsi ai primi due box: le formule progressive possono essere
      // più lunghe quando si svolgono numeratore e denominatore.
      for (let i = 3; i <= fixture.answers.length; i++) {
        const box = frame.locator(`[data-box=b${i}]`);
        await box.waitFor({ timeout: 15000 });
        const before = await misuraFormula(box.getByRole('region', { name: new RegExp(`Operazione del box ${i}`) }));
        check(`box ${i}: operazione ingrandita interamente raggiungibile`,
          before.inizio && before.fine && (!before.max || (before.overflow === 'auto' && before.tabIndex === 0)), before);
        await submit(box, fixture.answers[i - 1]);
        await box.locator('[data-testid=pillola-formula-risolta]').waitFor({ timeout: 15000 });
        const after = await misuraFormula(box.locator('[data-testid=pillola-formula-risolta]'));
        check(`box ${i}: passaggio completato e pillola interamente raggiungibile`,
          after.inizio && after.fine && (!after.max || (after.overflow === 'auto' && after.tabIndex === 0)), after);
      }
      check('il percorso con caratteri ingranditi raggiunge il pulsante CONTINUA',
        await frame.getByRole('button', { name: 'CONTINUA', exact: true }).isVisible());
    }
    check('nessun errore JavaScript o chiamata API reale', errors.length === 0 && unexpectedApi.length === 0, { errors, unexpectedApi });
    results.push({ scenario: scenario.name, ok: true, checks });
    console.log(scenario.name, 'OK', checks.length);
  } catch (error) {
    const message = String(error?.message ?? error);
    results.push({ scenario: scenario.name, ok: false, checks, error: message });
    console.log(scenario.name, 'FAIL', message);
    await page.screenshot({ path: path.join(out, `${scenario.name}-FAILED.png`) }).catch(() => {});
  }
  await context.close();
}
await browser.close();
await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
console.log('RISULTATI', `${results.filter(r => r.ok).length}/${results.length}`);
if (results.some(r => !r.ok)) process.exitCode = 1;

