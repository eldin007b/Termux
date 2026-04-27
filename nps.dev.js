const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/* ================== MODERNI UI & STIL ================== */
const C = {
  r:'\x1b[31m', g:'\x1b[32m', y:'\x1b[33m', b:'\x1b[34m',
  c:'\x1b[36m', w:'\x1b[37m', B:'\x1b[1m', d:'\x1b[2m', x:'\x1b[0m',
  revB: '\x1b[37m\x1b[44m', // White on Blue
  revG: '\x1b[30m\x1b[42m'  // Black on Green
};

const log = {
  i: m => console.log(`${C.c}ℹ ${m}${C.x}`),
  s: m => console.log(`${C.g}✅ ${m}${C.x}`),
  w: m => console.log(`${C.y}⚠ ${m}${C.x}`),
  e: m => console.log(`${C.r}❌ ${m}${C.x}`),
  shotLog: f => console.log(`${C.d}   📸 Screenshot: ${f}${C.x}`)
};

const line = (char = '─') => C.d + char.repeat(55) + C.x;

/* ================== CONFIG ================== */
const CHROMIUM_PATH = '/data/data/com.termux/files/usr/bin/chromium-browser';
const HEADLESS = true;
const BASE_URL = 'https://gls-group.eu/AT/de/paket-verfolgen/';
const STORE_FILE = path.join(__dirname, 'trackingByPlz.js');
const MSG_FILE = path.join(__dirname, 'nps-com.js');
const SHOTS_DIR = path.join(__dirname, 'shots');
const PAUSE_MIN = 20;
const PAUSE_MAX = 45;
const AFTER_SUBMIT_WAIT = 4000;

/* ================== SCREENSHOTS ================== */
if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });
// Brišemo stare slike da ne gušimo memoriju
fs.readdirSync(SHOTS_DIR).forEach(f => { if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOTS_DIR, f)); });

let SHOT_I = 0;
async function shot(page, label) {
  const f = `${String(++SHOT_I).padStart(3, '0')}_${label}.png`.replace(/[^a-z0-9_.-]/gi, '_');
  try {
      await page.screenshot({ path: path.join(SHOTS_DIR, f), fullPage: false }); 
      log.shotLog(f);
  } catch {}
}

/* ================== DATA ================== */
let MSG = {};
try { MSG = require(MSG_FILE); } catch { MSG = { 10: ["Top"], 9: ["Ok"] }; }

const WEIGHTS = [{ s: 10, w: 50 }, { s: 9, w: 30 }, { s: 8, w: 20 }];
const pickScore = () => {
  let t = WEIGHTS.reduce((a, b) => a + b.w, 0), r = Math.random() * t;
  for (const x of WEIGHTS) { if ((r -= x.w) <= 0) return x.s }
  return 10;
};
const pickMsg = s => {
    const list = MSG[s];
    if (list && list.length && Math.random() < 0.2) return list[Math.floor(Math.random() * list.length)];
    return null;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ================== CORE ================== */
async function sendNPS(browser, trackId, plz, idx, total) {
  const score = pickScore();
  const msg = pickMsg(score);

  console.log(`\n${C.revB}  PROCES [${idx}/${total}]  ${C.x}`);
  console.log(`📦 ${C.B}Paket:${C.x} ${C.c}${trackId}${C.x} | 📍 ${C.B}PLZ:${C.x} ${C.c}${plz}${C.x}`);
  console.log(line());

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  
  // Blokada teških resursa
  await page.setRequestInterception(true);
  page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'font', 'media'].includes(type)) req.abort();
      else req.continue();
  });

  try {
    await page.goto(`${BASE_URL}?match=${trackId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await shot(page, '1_loaded');

    // COOKIE KILLER
    try {
        await page.evaluate(() => {
            const banner = document.getElementById('onetrust-banner-sdk');
            if(banner) banner.remove();
            const btn = document.querySelector('#s-all-bn');
            if(btn) btn.click();
        });
        await wait(500);
    } catch {}

    // PLZ UNOS
    const plzInSel = '#witt002_details_postalcode_input';
    try {
        await page.waitForSelector(plzInSel, { visible: true, timeout: 5000 });
        await page.type(plzInSel, plz);
        await page.keyboard.press('Enter');
        await wait(2000);
        await shot(page, '2_plz_entered');
    } catch {} 

    // PROVJERA DOSTAVE
    const delivered = await page.evaluate(() => {
        const t = document.body.innerText;
        return t.includes('Zugestellt') || t.includes('Delivered');
    });

    if (!delivered) {
      log.w("Paket nije dostavljen (ili krivi PLZ). Preskačem.");
      await shot(page, 'SKIP_not_delivered');
      return { ok: false, skip: true };
    }

    // OCJENJIVANJE
    console.log(`⭐ ${C.B}Biram ocjenu:${C.x} ${C.y}${score}/10${C.x}`);
    
    // FORCE CLICK LOGIKA
    const clicked = await page.evaluate((s) => {
        const all = Array.from(document.querySelectorAll('a, div, span'));
        const btn = all.find(el => el.innerText.trim() === String(s) && (el.tagName === 'A' || el.classList.contains('nps-scale-point')));
        if (btn) { btn.click(); return true; }
        return false;
    }, score);

    if (!clicked) {
        log.e("Nisam našao gumb za ocjenu (već ocijenjeno?).");
        await shot(page, 'ERROR_no_button');
        return { ok: false };
    }
    await shot(page, '3_clicked');

    // KOMENTAR
    if (msg) {
        try {
            await page.waitForSelector('textarea', { visible: true, timeout: 5000 });
            await page.type('textarea', msg);
            
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                const send = btns.find(b => b.innerText.includes('Senden') || b.innerText.includes('Send'));
                if(send) send.click();
            });
            await wait(1000);
            console.log(`📝 ${C.B}Komentar:${C.x} ${C.w}"${msg}"${C.x}`);
        } catch {}
    } else {
        await wait(1000);
    }

    log.s('ZAVRŠENO');
    await shot(page, '4_done');
    console.log(line('═'));
    return { ok: true };

  } catch (e) {
    log.e(`Greška: ${e.message.split('\n')[0]}`);
    await shot(page, 'FATAL_ERROR');
    return { ok: false };
  } finally {
    await page.close();
  }
}

/* ================== MAIN ================== */
(async () => {
  console.clear();
  console.log(`${C.b}${C.B}╔═══════════════════════════════════════════════════╗${C.x}`);
  console.log(`${C.b}${C.B}║       GLS NPS DEV TOOLS v2.1 (OPTIMIZED)          ║${C.x}`);
  console.log(`${C.b}${C.B}╚═══════════════════════════════════════════════════╝${C.x}`);

  if (!fs.existsSync(STORE_FILE)) return log.w("Baza podataka (trackingByPlz.js) ne postoji!");
  
  const store = require(STORE_FILE);
  let pairs = [];
  for (const p in store) for (const id of store[p]) pairs.push({ plz: p, id });

  if (!pairs.length) return log.w("Baza je prazna.");
  log.i(`Ukupno dostupno: ${pairs.length}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const n = parseInt(await new Promise(r => rl.question(`\n${C.B}Koliko NPS poslati? ${C.x}`, r)), 10) || 0;
  rl.close();

  if (n <= 0) process.exit(0);

  const sel = pairs.sort(() => Math.random() - 0.5).slice(0, n);
  
  // MEMORY SAVER BROWSER SETUP
  const br = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: HEADLESS,
    args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-zygote',
        '--single-process'
    ]
  });

  let successCount = 0;
  for (let i = 0; i < sel.length; i++) {
    const res = await sendNPS(br, sel[i].id, sel[i].plz, i + 1, sel.length);
    if (res.ok && !res.skip) successCount++;

    if (i < sel.length - 1) {
      const p = Math.floor(Math.random() * (PAUSE_MAX - PAUSE_MIN + 1)) + PAUSE_MIN;
      for (let s = p; s > 0; s--) {
        process.stdout.write(`\r${C.d}⏳ Pauza: ${C.y}${s}s ${C.d}(ne gasi Termux)${C.x}  `);
        await wait(1000);
      }
    }
  }

  await br.close();
  console.log(`\n\n${C.revG}  IZVJEŠTAJ: Poslano ${successCount} | Ukupno obrađeno ${sel.length}  ${C.x}\n`);
  
  // OBAVEZNO: Exit code 0 da start.sh nastavi
  process.exit(0);
})();
