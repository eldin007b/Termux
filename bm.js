#!/usr/bin/env node
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const blessed = require('blessed');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

/* --- KONFIGURACIJA --- */
const CHROMIUM_PATH = '/data/data/com.termux/files/usr/bin/chromium-browser';
const BM_EMAIL = 'transportklagenfurt@gmail.com';
const BM_PASS = 'B&d19102420';
const STORE_FILE = path.join(__dirname, 'trackingByPlz.js');
const URL_LIVE_STATUS = 'https://backoffice.bettermile.com/#/depot/gls-at/57/statistics/live-status';

/* --- SUPABASE KONFIGURACIJA --- */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_TABLE = 'contact'; 

let baseApiUrl = (SUPABASE_URL || '').replace(/\/$/, '');
if (baseApiUrl.includes('/rest/v1')) baseApiUrl = baseApiUrl.split('/rest/v1')[0];
const SUPABASE_API = SUPABASE_URL ? `${baseApiUrl}/rest/v1/${SUPABASE_TABLE}` : '';

const color = {
    cyan: '{cyan-fg}', green: '{green-fg}', red: '{red-fg}',
    yellow: '{yellow-fg}', blue: '{blue-fg}', gray: '{gray-fg}',
    white: '{white-fg}', end: '{/}'
};

/* ================= UTILS ================= */
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getW() {
    const total = Math.max(screen.width - 4, 40);
    return {
        tura: Math.floor(total * 0.15),
        adr:  Math.floor(total * 0.08),
        plz:  Math.floor(total * 0.15),
        pkg:  Math.floor(total * 0.12),
        state: Math.floor(total * 0.40)
    };
}

function P(text, width) {
    let s = String(text || '');
    const clean = s.replace(/{.*?}/g, '');
    const padding = width - clean.length;
    if (padding < 0) return clean.substring(0, width - 1) + '…';
    return s + ' '.repeat(padding);
}

function loadStore() {
    if (!fs.existsSync(STORE_FILE)) return {};
    try {
        const content = fs.readFileSync(STORE_FILE, 'utf8').trim();
        const jsonPart = content.replace(/^(module\.exports\s*=\s*)/, '').replace(/;$/, '');
        return JSON.parse(jsonPart);
    } catch (e) { return {}; }
}

function saveStore(data) {
    fs.writeFileSync(STORE_FILE, 'module.exports = ' + JSON.stringify(data, null, 2) + ';\n', 'utf8');
}

/* ================= SUPABASE UPSERT ================= */
async function sendToSupabase(tourId, address, name, phone) {
    if (!SUPABASE_API || !SUPABASE_KEY || !address || !name) return; 

    // Ostavlja njemačka slova ÄÖÜß i sortira ih za savršenu detekciju duplikata
    const ime_norm = name.toUpperCase().replace(/[^A-ZŽĆČĐŠÄÖÜß ]/g, '').split(' ').filter(Boolean).sort().join(' ');

    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates' 
    };

    const payload = {
        tura: tourId,
        adresa: address, 
        ime: name,       
        ime_norm: ime_norm
    };

    if (phone && phone.length > 5) {
        payload.telefon = phone;
    }

    const url = `${SUPABASE_API}?on_conflict=adresa,ime_norm`;

    try {
        await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
    } catch (err) {}
}

/* ================= SCREEN SETUP ================= */
const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    title: 'BM PLATINUM v26.19',
    input: process.stdin,
    output: process.stdout,
    terminal: 'xterm-256color'
});

const header = blessed.box({
  top: 0, height: 3, width: '100%', align: 'center', tags: true,
  style: { bg: '#020617', fg: 'cyan', bold: true },
  content: '\n🚀 {bold}BETTERMILE PLATINUM v26.19 (REGEX MASTER){/bold}'
});

const statusBar = blessed.box({
  top: 3, height: 1, width: '100%', tags: true,
  style: { bg: '#0f172a', fg: 'yellow' },
  content: ' STATUS: Inicijalizacija...'
});

const activeTable = blessed.listtable({
  top: 4, left: 0, width: '100%', height: 5, border: { type: 'line' },
  tags: true,
  style: { border: { fg: '#334155' }, header: { fg: 'cyan', bold: true }, cell: { fg: 'white' } }
});

const legend = blessed.box({
  top: 9, left: 0, width: '100%', height: 1, tags: true,
  style: { bg: '#020617' },
  content: ' {green-fg}🟢 OK{/} | {cyan-fg}🔵 NEW{/} | {gray-fg}⚪ PRAZNO{/} | {red-fg}← MENU{/}'
});

const logList = blessed.list({
  top: 10, left: 0, right: 0, bottom: 1,
  border: { type: 'line' },
  keys: true, mouse: true, tags: true,
  scrollbar: { ch: ' ', track: { bg: '#1e293b' }, style: { bg: '#38bdf8' } },
  style: { border: { fg: '#1e293b' }, selected: { bg: '#0f172a', bold: true } }
});

screen.append(header); screen.append(statusBar); screen.append(activeTable);
screen.append(legend); screen.append(logList);

/* ================= UI UPDATES ================= */
function setStatus(txt) {
    statusBar.setContent(` STATUS: ${txt}`);
    screen.render();
}

function refreshHeaders() {
    const W = getW();
    const h = [P('TURA', W.tura), P('#', W.adr), P('PLZ', W.plz), P('PKT', W.pkg), P('STATE', W.state)];
    activeTable.setData([h, activeTable.rows[1] || h.map(() => '—')]);
    screen.render();
}

screen.on('resize', refreshHeaders);

function setActiveRow({tura, adr, plz, pkg, state}) {
    const W = getW();
    let c = state.includes('NEW') ? color.green : color.cyan;
    if (state === 'PRAZNO') c = color.gray;
    const h = [P('TURA', W.tura), P('#', W.adr), P('PLZ', W.plz), P('PKT', W.pkg), P('STATE', W.state)];
    activeTable.setData([h, [P(tura, W.tura), P(adr, W.adr), P(plz, W.plz), P(pkg, W.pkg), `${c}${P(state, W.state)}${color.end}`]]);
    screen.render();
}

function addLogRow(tura, adr, plz, pkg, state, isNew = false) {
    const W = getW();
    let c = isNew ? color.green : color.gray;
    let icon = isNew ? '🟢' : '⚪';
    if (state.includes('NEW')) { c = color.cyan; icon = '🔵'; }

    const rowStr = `${color.cyan}${P(tura, W.tura)}${color.end}│` +
                   `${color.white}${P(adr, W.adr)}${color.end}│` +
                   `${P(plz, W.plz)}│` +
                   `${P(pkg, W.pkg)}│` +
                   `${c}${icon} ${P(state, W.state-2)}${color.end}`;

    logList.addItem(rowStr);
    logList.scrollTo(logList.items.length);
    screen.render();
}

/* ================= CONTROL & SELECTOR ================= */
let forceStop = false;
let currentBrowser = null;

async function exitToMenu() {
    forceStop = true;
    if (currentBrowser) try { await currentBrowser.close(); } catch(e) {}
    screen.destroy();
    console.log("Povratak u glavni izbornik...");
    process.exit(0);
}

screen.key(['left'], async () => { await exitToMenu(); });
screen.key(['q', 'escape', 'C-c'], async () => { await exitToMenu(); });

const selector = blessed.box({
  parent: screen, top: 'center', left: 'center', width: 38, height: 10, border: 'line',
  label: ' {cyan-fg}IZBOR TURE{/cyan-fg} ', tags: true, hidden: true,
  style: { border: { fg: 'cyan' }, bg: '#020617' }
});

let turaOptions = [];
let turaIdx = 0;

function updateTuraSelector() {
    const tura = turaOptions[turaIdx];
    selector.setContent(`\n  IZABERI TURU NA STANJU:\n\n      {yellow-fg}{bold} <  [ ${tura} ]  > {/bold}{/yellow-fg}\n\n  {gray-fg}↑/↓: Promjeni · →: POKRENI{/gray-fg}`);
    screen.render();
}

/* ================= MAIN LOGIC ================= */
(async () => {
    refreshHeaders();
    setStatus('Pokrećem Chromium...');
    currentBrowser = await puppeteer.launch({
        executablePath: CHROMIUM_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=site-per-process', '--disable-accelerated-2d-canvas', '--disable-gpu', '--disable-dev-shm-usage', '--no-zygote', '--single-process']
    });

    const page = await currentBrowser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const type = req.resourceType();
        if (type === 'image' || type === 'font' || type === 'media') req.abort();
        else req.continue();
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        setStatus('Učitavam prijavu...');
        await page.goto('https://backoffice.bettermile.com/#/login', { waitUntil: 'domcontentloaded', timeout: 60000 });

        try {
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const target = buttons.find(b => {
                    const t = b.innerText.toLowerCase();
                    return t.includes('akzeptieren') || t.includes('accept') || t.includes('prihvati');
                });
                if (target) target.click();
            });
            await sleep(1000);
        } catch (e) {}

        setStatus('Unosim podatke...');
        const emailSelector = 'input[type="email"], input[name="email"], input[name="username"], #username, #login-form_username';
        const passSelector = 'input[type="password"], input[name="password"], #password, #login-form_password';

        try { await page.waitForSelector(emailSelector, { visible: true, timeout: 15000 }); } catch (e) { throw new Error("Login polje nije pronađeno."); }

        await page.type(emailSelector, BM_EMAIL);
        await page.type(passSelector, BM_PASS);
        await page.keyboard.press('Enter');

        try { await page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 15000}); } catch(e){}

        setStatus('Provjera terminala...');
        try {
            await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('terminal'), {timeout: 4000});
            await page.evaluate(() => {
                const btn = document.querySelector('button.primary') || document.querySelector('button');
                if (btn) btn.click();
            });
            await sleep(2000);
        } catch (e) {}

        setStatus('Skeniram meni tura...');
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(URL_LIVE_STATUS, { waitUntil: 'domcontentloaded', timeout: 60000 });

        try { await page.waitForFunction(() => document.body.innerText.match(/\b86\d{2}\b/), {timeout: 20000}); } catch(e) {}

        turaOptions = await page.evaluate(() => {
            const matches = document.body.innerText.match(/\b86\d{2}\b/g) || [];
            const found = [...new Set(matches)].sort();
            return found.length > 0 ? ['SVE TURE', ...found] : [];
        });

        if (turaOptions.length === 0) {
            setStatus('{red-fg}Nema tura na stanju!{/}');
            await sleep(3000); await exitToMenu();
        }

        selector.show(); selector.focus(); updateTuraSelector();

        selector.on('keypress', async (ch, key) => {
            if (forceStop) return;
            if (key.name === 'up') { turaIdx = (turaIdx + 1) % turaOptions.length; updateTuraSelector(); }
            if (key.name === 'down') { turaIdx = (turaIdx - 1 + turaOptions.length) % turaOptions.length; updateTuraSelector(); }
            if (key.name === 'right') {
                const selected = turaOptions[turaIdx];
                const toRun = selected === 'SVE TURE' ? turaOptions.slice(1) : [selected];
                selector.hide(); await runScraper(page, toRun);
            }
        });

    } catch (e) {
        setStatus(`{red-fg}GREŠKA: ${e.message.substring(0, 45)}{/}`);
        await sleep(5000); await exitToMenu();
    }
})();

async function runScraper(page, selectedTours) {
    let collected = loadStore();

    for (const tour of selectedTours) {
        if (forceStop) break;

        setStatus(`Priprema za turu ${tour}...`);
        await page.goto('about:blank');
        await sleep(200);

        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(URL_LIVE_STATUS, { waitUntil: 'domcontentloaded' });

        setStatus(`Tražim turu ${tour}...`);
        try { await page.waitForFunction(() => document.body.innerText.includes('86'), {timeout: 15000}); } catch(e) {}

        let clickedTour = await page.evaluate((t) => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(l => l.innerText.trim() === t);
            if (target) { target.click(); return true; }
            return false;
        }, tour);

        if (!clickedTour) continue;

        setStatus(`Ulazim u ${tour} - Čekam adrese...`);
        try {
            await page.waitForFunction(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.some(b => b.innerText && /^DEL\s*\d+$/.test(b.innerText.trim()));
            }, {timeout: 20000});
        } catch(e) { continue; }

        await page.setViewport({ width: 1280, height: 8000 });
        await sleep(1500); 

        let currentIndex = 0;
        
        while (!forceStop) {
            const buttons = await page.$$('button');
            let validChips = [];
            
            for (const btn of buttons) {
                const text = await page.evaluate(el => el.innerText, btn);
                const match = text ? text.trim().match(/^DEL\s*(\d+)$/) : null;
                if (match) validChips.push({ btn: btn, expected: parseInt(match[1], 10) });
            }

            if (validChips.length === 0 || currentIndex >= validChips.length) break; 

            const currentBtnInfo = validChips[currentIndex];
            const currentBtn = currentBtnInfo.btn;
            const expectedPkgs = currentBtnInfo.expected;
            const stopLabel = (currentIndex + 1).toString();
            
            setStatus(`[${tour}] Adresa ${stopLabel}/${validChips.length} (Čekam ${expectedPkgs} kom)...`);

            try { await page.evaluate(el => el.click(), currentBtn); } catch(e) { currentIndex++; continue; }

            let foundIds = [];
            let plz = '0000';
            
            let dbAddress = '';
            let dbName = '';
            let dbPhone = '';

            try {
                await page.waitForFunction((expected) => {
                    const txt = document.body.innerText;
                    return (txt.match(/TrackID/ig) || []).length >= expected;
                }, {timeout: 2500}, expectedPkgs);
            } catch (e) {}

            try {
                const data = await page.evaluate(() => {
                    const txt = document.body.innerText;
                    
                    // --- 1. TRACKING ID (Pouzdan, vraćen iz verzije 16) ---
                    const foundIds = [...new Set([...txt.matchAll(/TrackID\s+([A-Z0-9]+)/ig)].map(m => m[1]))];
                    
                    // --- 2. ADRESA I PLZ ---
                    let extPlz = '0000';
                    let extAddress = '';
                    
                    // Trik: Adresa u popisu NEMA zarez, ali adresa u prozorčiću IMA zarez (npr. Ulica 1, 9344)
                    const addrRegex = /([A-Za-zÄÖÜäöüßžćčđšŽĆČĐŠ\s\-]+\s+\d+[a-zA-Z]?),\s*(\d{4})/g;
                    const allAddrs = [...txt.matchAll(addrRegex)];
                    if (allAddrs.length > 0) {
                        const lastMatch = allAddrs[allAddrs.length - 1]; // Uzima zadnji pronađeni, to je onaj u prozorčiću
                        extPlz = lastMatch[2];
                        let ulica = lastMatch[1].replace(/^\d+\s+/, '').trim(); // Miče redni broj
                        extAddress = ulica + " " + extPlz;
                    } else {
                        // Sigurnosna mreža ako nema zareza
                        const pMatch = txt.match(/(\d{4})\b/g);
                        if (pMatch) extPlz = pMatch[pMatch.length - 1];
                    }

                    // --- 3. IME ---
                    let extName = '';
                    // Traži "DEL " iza kojeg idu isključivo slova (tako ignorira "DEL 1" iz pozadine)
                    // Prestaje tražiti čim naiđe na crticu, plus, broj ili neku drugu ključnu riječ
                    const nameRegex = /\bDEL\s+([A-Za-zžćčđšŽĆČĐŠäöüßÄÖÜ\-\s]{2,60}?)(?=\s*-|\s*\+|\d|\bEBp\b|\bBP\b|Euro|Busin|Track|FDF|COL|$)/ig;
                    const allNames = [...txt.matchAll(nameRegex)];
                    if (allNames.length > 0) {
                        extName = allNames[allNames.length - 1][1].replace(/[\n\t]+/g, ' ').trim();
                    }

                    // --- 4. TELEFON ---
                    let extPhone = '';
                    const phoneMatch = txt.match(/\+\d{9,15}/);
                    if (phoneMatch) extPhone = phoneMatch[0];

                    return {
                        p: extPlz,
                        ids: foundIds,
                        adr: extAddress,
                        nam: extName,
                        phn: extPhone
                    };
                });

                plz = data.p;
                foundIds = data.ids;
                dbAddress = data.adr;
                dbName = data.nam;
                dbPhone = data.phn;
            } catch (e) {}

            // Slanje u bazu
            if (dbAddress && dbName) {
                sendToSupabase(tour, dbAddress, dbName, dbPhone);
            }

            // Ažuriranje lokalnog fajla i ekrana
            if (foundIds.length > 0) {
                let newInThisStop = 0;
                for (const id of foundIds) {
                    if (!collected[plz]) collected[plz] = [];
                    if (!collected[plz].includes(id)) {
                        collected[plz].push(id);
                        newInThisStop++;
                    }
                }
                saveStore(collected);
                const stateLabel = newInThisStop > 0 ? `NEW: ${newInThisStop}` : 'OK';
                setActiveRow({ tura: tour, adr: stopLabel, plz, pkg: foundIds.length, state: stateLabel });
                addLogRow(tour, stopLabel, plz, foundIds.length, stateLabel, newInThisStop > 0);
            } else {
                setActiveRow({ tura: tour, adr: stopLabel, plz: plz, pkg: 0, state: 'PRAZNO' });
                addLogRow(tour, stopLabel, plz, 0, 'PRAZNO', false);
            }

            // Gasimo prozorčić
            try {
                await page.keyboard.press('Escape');
                await sleep(150); 
            } catch(e) {}

            currentIndex++;
        }
    }
    setStatus('{green-fg}SVE TURE ODRADENE - Povratak u meni...{/}');
    await sleep(3000); await exitToMenu();
}
