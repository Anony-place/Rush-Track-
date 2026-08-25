import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--no-sandbox', '--disable-gpu', '--mute-audio'],
  headless: 'shell',
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.stack?.split('\n').slice(0,4).join(' | ')));
page.on('console', m => { if (m.type() === 'error') console.log('CERR:', m.text().slice(0, 200), m.location()?.url); });
await page.goto('http://localhost:8080/?qa=1', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2500));
await browser.close();
