import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

// Solo dati sintetici e API intercettate: nessuna chiamata IA o scrittura DB.
const base = process.env.PARENTESI_QA_URL || 'http://127.0.0.1:3173';
const fixtureFile = process.env.PARENTESI_QA_FIXTURES || '/tmp/widget-feedback-fixtures.json';
const out = process.env.PARENTESI_QA_OUTPUT || '/tmp/widget-parentesi-results';
const fixture = JSON.parse(await fs.readFile(fixtureFile, 'utf8'));
await fs.mkdir(out, { recursive: true });

const scenarios = [
  { name: 'tonde-desktop', input: '(3*(x+2)+2*(x-2))/((x-2)*(x+2))', valid: true, width: 1280, complete: true },
  { name: 'quadre-numeratore', input: '[3*(x+2)+2*(x-2)]/((x-2)*(x+2))', valid: true, width: 390 },
  { name: 'quadre-denominatore', input: '(3*(x+2)+2*(x-2))/[(x-2)*(x+2)]', valid: true, width: 390 },
  { name: 'quadre-entrambi', input: '[3*(x+2)+2*(x-2)]/[(x-2)*(x+2)]', valid: true, width: 1280 },
  { name: 'graffe-numeratore', input: '{3*[(x+2)]+2*[(x-2)]}/((x-2)*(x+2))', valid: true, width: 390 },
  { name: 'graffe-denominatore', input: '(3*(x+2)+2*(x-2))/{[(x-2)*(x+2)]}', valid: true, width: 390 },
  { name: 'graffe-entrambi-iframe', input: '{3*[(x+2)]+2*[(x-2)]}/{[(x-2)*(x+2)]}', valid: true, width: 390, embed: true },
  { name: 'miste-caratteri160', input: '{3*[x+2]+2*(x-2)}/[(x-2)*(x+2)]', valid: true, width: 320, large: true },
  { name: 'parentesi-di-tipo-diverso', input: '[3*(x+2)+2*(x-2))/[(x-2)*(x+2)]', valid: false, width: 390, recover: true, complete: true },
  { name: 'parentesi-non-chiusa', input: '[3*(x+2)+2*(x-2)/[(x-2)*(x+2)]', valid: false, width: 1280 },
  { name: 'denominatore-nullo', input: '[3*(x+2)+2*(x-2)]/{0}', valid: false, width: 390 },
  { name: 'numeratore-errato', input: '[4*(x+2)+2*(x-2)]/{[(x-2)*(x+2)]}', valid: false, width: 390 },
  { name: 'somma-non-raccolta', input: '3/(x-2)+2/(x+2)', valid: false, width: 1280 },
];
const goodMixed = '{3*[(x+2)]+2*[(x-2)]}/{[(x-2)*(x+2)]}';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-features=LocalNetworkAccessChecks'] });
const results = [];

for (const c of scenarios) {
  const row = { scenario: c.name, checks: [], errors: [], unexpectedApi: [] };
  const check = (name, passed, detail) => {
    row.checks.push({ name, ok: !!passed, ...(detail === undefined ? {} : { detail }) });
    if (!passed) throw new Error(`${name}: ${JSON.stringify(detail)}`);
  };
  const context = await browser.newContext({
    viewport: { width: c.width, height: c.width < 600 ? 780 : 800 },
    isMobile: c.width < 600, hasTouch: c.width < 600, deviceScaleFactor: 1,
  });
  await context.addInitScript(large => localStorage.setItem('wms_access', JSON.stringify({
    fontScale: large ? 1.6 : 1, lineHeight: large ? 2.6 : 1.65, ruler: false, mode: 'normale',
  })), !!c.large);
  const page = await context.newPage();
  page.on('pageerror', error => row.errors.push(error.message));
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname.startsWith('/api/esercizio/sessione/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ esercizio: fixture.coniugati }) });
    }
    row.unexpectedApi.push({ method: route.request().method(), pathname: url.pathname });
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"fixture isolata"}' });
  });
  try {
    const app = `${base}/esercizio?sid=parentesi-${c.name}&cognome=QA&nome=Studente${c.embed ? '&cornice=parentesi-test' : ''}`;
    let frame;
    if (c.embed) {
      await page.route(`${base}/__parentesi-host`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><header style="height:80px">Blog di prova</header><iframe title="App di prova" src="${app}" style="border:0;width:100%;height:640px"></iframe></body></html>` }));
      await page.goto(`${base}/__parentesi-host`);
      frame = page.frames().find(f => f.url().startsWith(`${base}/esercizio`));
      if (!frame) throw new Error('iframe sintetico mancante');
    } else {
      await page.goto(app);
      frame = page.mainFrame();
    }
    const first = frame.locator('[data-box=b1]');
    await first.waitFor();
    await frame.evaluate(() => document.fonts.ready);
    const guide = first.locator('[data-testid=istruzione-trascrizione-frazione]');
    await guide.waitFor();
    const info = await guide.evaluate(el => {
      const p = el.parentElement, style = getComputedStyle(p), span = getComputedStyle(el);
      const range = document.createRange(); range.selectNodeContents(el);
      const bounds = p.getBoundingClientRect();
      return {
        text: p.textContent.replace(/\s+/g, ' ').trim().toLocaleLowerCase('it'),
        font: parseFloat(style.fontSize), border: parseFloat(style.borderTopWidth),
        background: style.backgroundColor, display: span.display, parent: p.tagName,
        width: p.clientWidth, scrollWidth: p.scrollWidth,
        lines: [...range.getClientRects()].map(r => ({ left: r.left, right: r.right })),
        left: bounds.left, right: bounds.right,
      };
    });
    check('testo richiesto nello stesso paragrafo del metodo', info.text ===
      'porto la frazione allo stesso denominatore. scrivo così il risultato: (numeratore)/(denominatore)', info.text);
    check('nessun riquadro, testo normale e non ridotto', info.parent === 'P' && info.display === 'inline' &&
      info.font >= 18.66 && info.border === 0 && info.background === 'rgba(0, 0, 0, 0)', info);
    check('nessun testo vecchio o soluzione anticipata',
      !(await first.innerText()).toLocaleLowerCase('it').includes('come scrivere la frazione da tastiera') &&
      await frame.locator('[data-testid=pillola-formula-risolta]').count() === 0 &&
      await frame.getByText('RISULTATO FINALE', { exact: true }).count() === 0);
    check('schema leggibile senza fuoriuscite', info.scrollWidth <= info.width + 1 &&
      info.lines.every(r => r.left >= info.left - 1 && r.right <= info.right + 1), info);
    if (c.large) {
      const visibility = await guide.evaluate(el => {
        const area = el.closest('.expr-exercise-scroll');
        const range = document.createRange(); range.selectNodeContents(el);
        const lines = () => [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
        const bounds = () => area.getBoundingClientRect();
        const first = lines()[0]; area.scrollTop += first.top - bounds().top - 2;
        const topLine = lines()[0], topBounds = bounds();
        const topVisible = topLine.top >= topBounds.top - 1 && topLine.bottom <= topBounds.bottom + 1;
        const last = lines().at(-1); area.scrollTop += last.bottom - bounds().bottom + 2;
        const lastLine = lines().at(-1), endBounds = bounds();
        const bottomVisible = lastLine.top >= endBounds.top - 1 && lastLine.bottom <= endBounds.bottom + 1;
        return { topVisible, bottomVisible, scrollHeight: area.scrollHeight, clientHeight: area.clientHeight };
      });
      check('con caratteri ingranditi prima e ultima riga sono raggiungibili scorrendo', visibility.topVisible && visibility.bottomVisible, visibility);
    }
    if (c.name === 'tonde-desktop') {
      // Simuliamo il sintetizzatore: nessun audio viene inviato a servizi esterni.
      await frame.evaluate(() => {
        window.__paroleQA = [];
        window.speechSynthesis.speak = utterance => { window.__paroleQA.push(utterance.text); };
        window.speechSynthesis.cancel = () => {};
      });
      await frame.getByRole('button', { name: 'Ascolto: leggi il testo ad alta voce' }).click();
      const parole = (await frame.evaluate(() => window.__paroleQA.join(' '))).toLocaleLowerCase('it');
      check('lettura vocale pronuncia le parole dello schema senza dividerle',
        parole.includes('scrivo così il risultato') && parole.includes('numeratore') && parole.includes('denominatore') &&
        !parole.includes('nume ratore') && !parole.includes('denomi natore'));
    }
    if (['tonde-desktop', 'graffe-entrambi-iframe', 'miste-caratteri160'].includes(c.name)) {
      await guide.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      await page.screenshot({ path: path.join(out, `${c.name}.png`) });
    }
    const insert = async (box, text) => {
      await box.getByTitle('Inserisci manualmente il valore', { exact: true }).click();
      const input = box.getByRole('textbox', { name: 'Digita il valore da tastiera' });
      await input.fill(text);
      await input.press('Enter');
    };
    await insert(first, c.input);
    if (c.valid) {
      await frame.locator('[data-box=b2]').waitFor({ timeout: 12000 });
      check('risposta corretta accettata e passo successivo sbloccato',
        await first.locator('[data-testid=pillola-formula-risolta]').count() === 1 &&
        await first.getByText('RISULTATO SBAGLIATO. CALCOLA DI NUOVO').count() === 0);
    } else {
      await first.locator('p[role=status]').waitFor({ timeout: 12000 });
      check('risposta errata rifiutata senza rivelare il passaggio seguente',
        await frame.locator('[data-box=b2]').count() === 0 &&
        await first.locator('[data-testid=pillola-formula-risolta]').count() === 0);
      if (c.recover) {
        await insert(first, goodMixed);
        await frame.locator('[data-box=b2]').waitFor({ timeout: 12000 });
        check('la correzione con parentesi miste è accettata',
          await first.locator('[data-testid=pillola-formula-risolta]').count() === 1);
      }
    }
    if (c.complete) {
      for (let i = 1; i < fixture.risposteConiugati.length; i++) {
        const box = frame.locator(`[data-box=b${i + 1}]`);
        await box.waitFor();
        await insert(box, fixture.risposteConiugati[i]);
        await box.locator('[data-testid=pillola-formula-risolta]').waitFor({ timeout: 12000 });
      }
      const continua = frame.getByRole('button', { name: 'CONTINUA', exact: true });
      await continua.waitFor(); await continua.click();
      const feedback = frame.locator('[data-testid=feedback-finale]'); await feedback.waitFor();
      const expected = c.valid ? '6 su 6' : '5 su 6';
      check('punteggio conserva correttamente il primo tentativo', (await feedback.innerText()).toLocaleLowerCase('it').includes(expected), expected);
      await frame.evaluate(() => { window.__qaPdf = ''; window.open = () => ({ document: { write: html => { window.__qaPdf = html; }, close: () => {} } }); });
      await feedback.getByRole('button', { name: "Scarica il PDF con tutti i passaggi dell'espressione" }).click();
      const pdfCount = await frame.evaluate(() => new DOMParser().parseFromString(window.__qaPdf, 'text/html').querySelector('.pdf-primo-colpo')?.textContent?.trim());
      check('conteggio PDF coincide col feedback', pdfCount?.toLocaleLowerCase('it').includes(expected), pdfCount);
    }
    check('nessuna API reale o errore JavaScript', row.unexpectedApi.length === 0 && row.errors.length === 0, { api: row.unexpectedApi, errors: row.errors });
    row.ok = true;
  } catch (err) {
    row.ok = false; row.error = String(err?.message ?? err);
    await page.screenshot({ path: path.join(out, `${c.name}-FAILED.png`) }).catch(() => {});
  }
  results.push(row);
  console.log(c.name, row.ok ? 'OK' : 'FAIL', row.checks.length, row.error ?? '');
  await context.close();
}
await browser.close();
await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
console.log('RISULTATI', `${results.filter(r => r.ok).length}/${results.length}`);
if (results.some(r => !r.ok)) process.exitCode = 1;

