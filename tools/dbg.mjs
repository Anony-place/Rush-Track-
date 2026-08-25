import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--no-sandbox', '--disable-gpu', '--mute-audio'],
  headless: 'shell',
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 500)));
page.on('console', m => console.log('CONSOLE[' + m.type() + ']:', m.text().slice(0, 300)));
page.on('requestfailed', r => console.log('REQFAIL:', r.url(), r.failure()?.errorText));
await page.goto('http://localhost:8080/?qa=1', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));
const state = await page.evaluate(() => ({
  qa: !!window.__qa, fonts: document.fonts.status,
  modules: performance.getEntriesByType('resource').filter(e => e.initiatorType === 'script' || e.name.endsWith('.js')).map(e => e.name.replace(location.origin, '')),
}));
console.log(JSON.stringify(state, null, 1));
await browser.close();
