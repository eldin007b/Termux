#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const blessed = require('blessed');
const puppeteer = require('puppeteer-core');
const agents = require('./agents'); // DODANO: Uvoz nove liste s imenima uređaja

/* CONFIG */
const CHROMIUM = '/data/data/com.termux/files/usr/bin/chromium-browser';
const STORE_FILE = path.join(__dirname, 'trackingByPlz.js');
const COMMENTS_FILE = path.join(__dirname, 'nps-com.js');
const dateStr = new Date().toISOString().split('T')[0];
const LOG_FILE = path.join(__dirname, 'nps-log-' + dateStr + '.jsonl');
const JSON_FILE = path.join(__dirname, 'nps-data-' + dateStr + '.json');
const CSV_FILE = path.join(__dirname, 'nps-data-' + dateStr + '.csv');
const SHOTS_DIR = '/storage/emulated/0/Download/Userland/gls-scraper/shots';

try { fs.mkdirSync(SHOTS_DIR, { recursive: true }); } catch(e) {}
if (!fs.existsSync(CSV_FILE)) { fs.writeFileSync(CSV_FILE, 'ID,PLZ,Score,Komentar,Status,Vrijeme,Pokusaj\n'); }

let SVI_KOMENTARI = [];
try {
    if (fs.existsSync(COMMENTS_FILE)) {
        delete require.cache[require.resolve(COMMENTS_FILE)];
        const komentariObj = require(COMMENTS_FILE);
        for (let ocjena in komentariObj) {
            if (Array.isArray(komentariObj[ocjena])) {
                SVI_KOMENTARI = SVI_KOMENTARI.concat(komentariObj[ocjena]);
            }
        }
    }
} catch (e) {}

if (SVI_KOMENTARI.length === 0) {
    SVI_KOMENTARI = ['Odličan servis', 'Brzo i efikasno', 'Preporučujem', 'Sve OK', 'Top usluga', 'Hvala vam'];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function getRandomComment() {
    if (SVI_KOMENTARI.length === 0) return null;
    return SVI_KOMENTARI[Math.floor(Math.random() * SVI_KOMENTARI.length)];
}

async function safeShot(page, filename) {
    if (!page) return;
    try {
        await Promise.race([
            page.screenshot({ path: path.join(SHOTS_DIR, filename), fullPage: false }),
            sleep(5000)
        ]);
    } catch (e) {}
}

const state = {
    ukupno: 0,
    zavreno: 0,
    greske: 0,
    preskoceno: 0,
    komentari_count: 0,
    redoslijed_count: 0,
    trenutni_id: '---',
    trenutni_plz: '---',
    trenutni_agent: '---', // DODANO: Spremište za ime uređaja
    trenutni_score: 0,
    trenutni_korak: 'Cekanje...',
    trenutni_detalj: '',
    trenutni_pokusaj: 1,
    log_redoslijed: [],
    sve_ankete: [],
    config: { 
        min_ocjena: 6, 
        max_ocjena: 10, 
        min_komentari: 0,
        max_komentari: 0,
        takeScreenshots: false,
        delaySeconds: 3,
        retryCount: 2,
        activeField: 0 
    }
};

const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    encoding: 'utf8'
});

const header = blessed.box({
    top: 0, height: 1, width: '100%', 
    content: 'NPS PLATINUM v29.1 - BALKAN PRO (FIX)',
    style: { fg: 'cyan', bold: true }
});

const stats = blessed.box({
    top: 1, height: 1, width: '100%', tags: true,
    content: 'Redoslijed: 0/0 | Zavrseno: 0/0 | Greske: 0/0 | Komentari: 0'
});

const liveBox = blessed.box({
    top: 2, left: 0, right: 0, height: 14, border: 'line', tags: true,
    label: ' LIVE STATUS ',
    style: { border: { fg: 'cyan' } }
});

const logBox = blessed.box({
    top: 16, left: 0, right: 0, bottom: 1, border: 'line', tags: true,
    label: ' LOG REDOSLIJEDA ',
    style: { border: { fg: 'cyan' } },
    keys: true, mouse: true, scrollable: true, tags: true
});

const legend = blessed.box({
    bottom: 0, left: 0, right: 0, height: 1, tags: true,
    content: '[+]OK | [-]GRESKA | [?]NEMA | [@]KOMENTAR | [M]MENI'
});

screen.append(header);
screen.append(stats);
screen.append(liveBox);
screen.append(logBox);
screen.append(legend);

function updateStats() {
    const ukupno = state.zavreno + state.greske + state.preskoceno;
    const proc = ukupno > 0 ? Math.round((state.zavreno / ukupno) * 100) : 0;
    const content = 'Redoslijed: ' + ukupno + '/' + state.ukupno + 
                   ' | Zavrseno: ' + state.zavreno + '/' + state.ukupno + ' (' + proc + '%)' +
                   ' | Greske: ' + state.greske + '/' + state.ukupno +
                   ' | Komentari: ' + state.komentari_count;
    stats.setContent(content);
    screen.render();
}

function updateLiveStatus() {
    const content = '\n' +
        '  Uređaj: {yellow-fg}' + state.trenutni_agent + '{/}\n' + // DODANO NA VRH PANELA
        '  ID: ' + state.trenutni_id + '\n' +
        '  PLZ: ' + state.trenutni_plz + '\n' +
        '  Score: ' + state.trenutni_score + '/10\n' +
        '  Pokusaj: ' + state.trenutni_pokusaj + '\n' +
        '\n' +
        '  >>> ' + state.trenutni_korak + ' <<<\n' +
        '\n' +
        '  ' + state.trenutni_detalj;

    liveBox.setContent(content);
    screen.render();
}

function addLog(icon, text) {
    const logEntry = icon + ' ' + text;
    logBox.setContent((logBox.getContent() || '') + '\n' + logEntry);
    logBox.scroll(logBox.height);
    screen.render();
}

let currentBrowser = null;
let forceStop = false;

const config = blessed.box({
    parent: screen, top: 'center', left: 'center', width: 70, height: 24, border: 'line',
    label: ' KONFIGURACIJA v29.1 - FIXED ', tags: true, hidden: true,
    style: { border: { fg: 'cyan' }, bg: '#020617' }
});

function updateConfigUI() {
    const fmtNum = function(idx, val, unit) {
        unit = unit || '';
        if (state.config.activeField === idx) {
            return ' [< ' + val + unit + ' >] ';
        } else {
            return '    ' + val + unit + '    ';
        }
    };

    const fmtToggle = function(idx, val) {
        if (state.config.activeField === idx) {
            return ' [< ' + (val ? 'DA' : 'NE') + ' >] ';
        } else {
            return '    ' + (val ? 'DA' : 'NE') + '    ';
        }
    };

    const startBtn = state.config.activeField === 7
        ? ' [[ POKRENI ]] '
        : '   [ POKRENI ]   ';

    const slikeStatus = state.config.takeScreenshots ? 'UKLJUCENE' : 'ISKLJUCENE';

    const content = '\n' +
        '  [0] Broj anketa (1-1000):    ' + fmtNum(0, state.ukupno) + '\n' +
        '  [1] Min ocjena (1-10):       ' + fmtNum(1, state.config.min_ocjena) + '\n' +
        '  [2] Max ocjena (1-10):       ' + fmtNum(2, state.config.max_ocjena) + '\n' +
        '  [3] Min komentari (0=ne):    ' + fmtNum(3, state.config.min_komentari) + '\n' +
        '  [4] Max komentari:           ' + fmtNum(4, state.config.max_komentari) + '\n' +
        '  [5] Delay med. anketa (s):   ' + fmtNum(5, state.config.delaySeconds) + '\n' +
        '  [6] Retry ako greska (0-5):  ' + fmtNum(6, state.config.retryCount) + '\n' +
        '  [7] SLIKE (' + slikeStatus + '):      ' + fmtToggle(7, state.config.takeScreenshots) + '\n' +
        '\n' +
        '           ' + startBtn + '\n' +
        '\n' +
        '  UP/DOWN: +/-  LEFT/RIGHT: Polje  SPACE/ENTER: Toggle slike  ENTER: START\n' +
        '  SLIKE: Pritisnite SPACE ili ENTER na liniji [7] za ON/OFF';

    config.setContent(content);
    screen.render();
}

screen.key(['q', 'escape', 'C-c'], async () => {
    forceStop = true;
    if (currentBrowser) try { await currentBrowser.close(); } catch(e) {}

    const jsonData = {
        datum: new Date().toISOString(),
        statistika: {
            ukupno: state.ukupno,
            zavrseno: state.zavreno,
            greske: state.greske,
            preskoceno: state.preskoceno,
            komentari: state.komentari_count,
            uspjesnost_procenat: state.ukupno > 0 ? Math.round((state.zavreno / state.ukupno) * 100) : 0
        },
        ankete: state.sve_ankete
    };

    try {
        fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2));
    } catch(e) {}

    screen.destroy();
    process.exit(0);
});

async function launchBrowser() {
    return await puppeteer.launch({
        executablePath: CHROMIUM,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-zygote', '--single-process']
    });
}

async function worker(browser, id, plz, idx, total) {
    if (forceStop || !browser) return 'GRESKA';

    state.trenutni_id = id;
    state.trenutni_plz = plz;
    state.trenutni_score = 0;
    state.redoslijed_count++;

    const score = rand(state.config.min_ocjena, state.config.max_ocjena);
    state.trenutni_score = score;

    let shouldComment = false;
    if (state.config.min_komentari > 0 && state.config.max_komentari > 0) {
        const interval = rand(state.config.min_komentari, state.config.max_komentari);
        shouldComment = (state.redoslijed_count % interval === 0);
    }

    const commText = shouldComment ? getRandomComment() : null;
    if (commText) state.komentari_count++;

    for (let attempt = 1; attempt <= (state.config.retryCount + 1); attempt++) {
        state.trenutni_pokusaj = attempt;

        const page = await browser.newPage();
        
        // PROMIJENJENO: Dohvati nasumični identitet (ime + UA) iz agents.js
        const selectedAgent = agents.getRandom();
        state.trenutni_agent = selectedAgent.name; // FIKSIRAMO IME UREĐAJA ZA OVAJ PAKET
        
        await page.setUserAgent(selectedAgent.ua); 
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

        try {
            state.trenutni_korak = 'Postavljanje identiteta';
            state.trenutni_detalj = 'Uredjaj spreman.'; 
            updateLiveStatus();
            await sleep(800);

            state.trenutni_korak = 'Ucitavanje GLS...';
            state.trenutni_detalj = 'gls-group.eu';
            updateLiveStatus();
            const t1 = Date.now();
            const url = 'https://gls-group.eu/AT/de/paket-verfolgen/?match=' + id;
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            state.trenutni_detalj = 'OK [' + ((Date.now() - t1) / 1000).toFixed(2) + 's]';
            updateLiveStatus();

            try {
                await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, a, span')).filter(el => {
                        const text = (el.innerText || el.textContent || '').toLowerCase();
                        return text.includes('akzeptieren') || text.includes('accept') || text.includes('alle');
                    });
                    if (buttons.length > 0) buttons[0].click();
                });
                await sleep(800);
            } catch (e) {}

            state.trenutni_korak = 'Unos broja paketa...';
            state.trenutni_detalj = id;
            updateLiveStatus();
            const t2 = Date.now();
            const plzInp = '#witt002_details_postalcode_input';
            await page.waitForSelector(plzInp, { timeout: 8000 });
            await page.type(plzInp, plz, { delay: 50 });
            state.trenutni_detalj = 'OK [' + ((Date.now() - t2) / 1000).toFixed(2) + 's]';
            updateLiveStatus();
            if (state.config.takeScreenshots) await safeShot(page, id + '_p' + attempt + '_1_tracking.png');

            state.trenutni_korak = 'Unos PLZ...';
            state.trenutni_detalj = plz;
            updateLiveStatus();
            const t3 = Date.now();
            await page.keyboard.press('Enter');
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
            await sleep(2000);
            state.trenutni_detalj = 'OK [' + ((Date.now() - t3) / 1000).toFixed(2) + 's]';
            updateLiveStatus();
            if (state.config.takeScreenshots) await safeShot(page, id + '_p' + attempt + '_2_plz.png');

            state.trenutni_korak = 'Provjera statusa...';
            state.trenutni_detalj = 'Trazim Zugestellt...';
            updateLiveStatus();
            const t4 = Date.now();
            const isDelivered = await page.evaluate(() => {
                return /Zugestellt|Delivered|Ausgeliefert/i.test(document.body.innerText);
            });

            if (!isDelivered) {
                state.trenutni_detalj = 'NIJE DOSTAVLJENO';
                updateLiveStatus();
                if (state.config.takeScreenshots) await safeShot(page, id + '_p' + attempt + '_3_nije_dostavljen.png');
                state.preskoceno++;
                addLog('[?]', id + ' | ' + plz + ' | Nije dostavljeno');
                updateStats();

                state.sve_ankete.push({
                    id: id,
                    plz: plz,
                    score: score,
                    komentar: commText,
                    status: 'NIJE_DOSTAVLJENO',
                    pokusaj: attempt,
                    vrijeme: new Date().toISOString()
                });

                try { await page.close(); } catch(e){}
                return 'PRESKOCENO';
            }

            state.trenutni_detalj = 'OK - Zugestellt! [' + ((Date.now() - t4) / 1000).toFixed(2) + 's]';
            updateLiveStatus();

            state.trenutni_korak = 'Klik na ocjenu...';
            state.trenutni_detalj = 'Trazim ' + score + '/10';
            updateLiveStatus();
            const t5 = Date.now();
            const clicked1 = await page.evaluate((s) => {
                const btn = Array.from(document.querySelectorAll('a, span, button')).find(el => {
                    return el.innerText && el.innerText.trim() === String(s);
                });
                if (btn) { btn.scrollIntoView({behavior:'smooth'}); btn.click(); return true; }
                return false;
            }, score);

            if (!clicked1) {
                if (attempt < state.config.retryCount + 1) {
                    state.trenutni_detalj = 'POKUSAJ ' + (attempt + 1) + '...';
                    updateLiveStatus();
                    try { await page.close(); } catch(e){}
                    await sleep(2000);
                    continue;
                }

                state.trenutni_detalj = 'GRESKA - Nije pronadjena ocjena';
                updateLiveStatus();
                if (state.config.takeScreenshots) await safeShot(page, id + '_p' + attempt + '_ERROR_ocjena.png');
                state.greske++;
                addLog('[-]', id + ' | Ocjena nije pronadjena (p' + attempt + ')');
                updateStats();

                state.sve_ankete.push({
                    id: id,
                    plz: plz,
                    score: score,
                    komentar: commText,
                    status: 'GRESKA_OCJENA',
                    pokusaj: attempt,
                    vrijeme: new Date().toISOString()
                });

                try { await page.close(); } catch(e){}
                return 'GRESKA';
            }

            state.trenutni_detalj = 'OK - Kliknuto! [' + ((Date.now() - t5) / 1000).toFixed(2) + 's]';
            updateLiveStatus();
            if (state.config.takeScreenshots) await safeShot(page, id + '_p' + attempt + '_4_ocjena.png');
            await sleep(3000);

            state.trenutni_korak = 'Cekanje ankete...';
            state.trenutni_detalj = 'Trazim novu stranicu';
            updateLiveStatus();
            const t6 = Date.now();
            let activePage = page;
            let anketaPronadjena = false;

            for (let p of await browser.pages()) {
                const url = await p.url();
                if (url.includes('questionpro') || url.includes('TakeSurvey')) {
                    activePage = p; 
                    await activePage.bringToFront(); 
                    anketaPronadjena = true;
                    break;
                }
            }

            if (!anketaPronadjena) {
                if (attempt < state.config.retryCount + 1) {
                    state.trenutni_detalj = 'POKUSAJ ' + (attempt + 1) + '...';
                    updateLiveStatus();
                    try { await page.close(); } catch(e){}
                    await sleep(2000);
                    continue;
                }

                state.trenutni_detalj = 'GRESKA - Anketa se nije otvorila';
                updateLiveStatus();
                if (state.config.takeScreenshots) await safeShot(page, id + '_p' + attempt + '_ERROR_anketa.png');
                state.greske++;
                addLog('[-]', id + ' | Anketa se nije otvorila (p' + attempt + ')');
                updateStats();

                state.sve_ankete.push({
                    id: id,
                    plz: plz,
                    score: score,
                    komentar: commText,
                    status: 'GRESKA_ANKETA',
                    pokusaj: attempt,
                    vrijeme: new Date().toISOString()
                });

                try { await page.close(); } catch(e){}
                return 'GRESKA';
            }

            // Ovdje također primjenjujemo isti identitet na novu stranicu ankete
            await activePage.setUserAgent(selectedAgent.ua);
            await activePage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

            state.trenutni_detalj = 'OK - Otvorena! [' + ((Date.now() - t6) / 1000).toFixed(2) + 's]';
            updateLiveStatus();
            await sleep(1500);
            if (state.config.takeScreenshots) await safeShot(activePage, id + '_p' + attempt + '_5_anketa.png');

            try {
                await activePage.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, a, span')).filter(el => {
                        const text = (el.innerText || el.textContent || '').toLowerCase();
                        return text.includes('akzeptieren') || text.includes('accept');
                    });
                    if (buttons.length > 0) buttons[0].click();
                });
                await sleep(500);
            } catch (e) {}

            state.trenutni_korak = 'Odabir ocjene...';
            state.trenutni_detalj = 'Cekanje radio dugmadi...';
            updateLiveStatus();
            const t7 = Date.now();
            try {
                await activePage.waitForFunction(() => {
                    return document.querySelectorAll('input[type="radio"]').length > 0;
                }, { timeout: 15000 });
            } catch (e) {}

            const clicked2 = await activePage.evaluate((s) => {
                const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
                for (let r of radios) {
                    let label = r.parentElement?.innerText || r.value || '';
                    if (label.includes(String(s))) {
                        r.scrollIntoView({behavior:'smooth'});
                        r.click();
                        r.checked = true;
                        r.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                }
                return false;
            }, score);

            state.trenutni_detalj = (clicked2 ? 'OK - ' : 'GRESKA - ') + score + '/10 [' + ((Date.now() - t7) / 1000).toFixed(2) + 's]';
            updateLiveStatus();
            if (state.config.takeScreenshots) await safeShot(activePage, id + '_p' + attempt + '_6_rating.png');
            await sleep(800);

            if (commText) {
                state.trenutni_korak = 'Unos komentara...';
                state.trenutni_detalj = 'Trazim textarea...';
                updateLiveStatus();
                const t8 = Date.now();
                try {
                    const tx = await activePage.waitForSelector('textarea', { timeout: 5000 });
                    await tx.click();

                    state.trenutni_detalj = 'Pisem: "' + commText.substring(0, 25) + '..."';
                    updateLiveStatus();

                    await tx.type(commText, { delay: 30 });
                    await sleep(500);
                    state.trenutni_detalj = 'OK [' + ((Date.now() - t8) / 1000).toFixed(2) + 's]';
                    updateLiveStatus();
                    if (state.config.takeScreenshots) await safeShot(activePage, id + '_p' + attempt + '_7_comment.png');
                    addLog('[@]', 'Komentar: ' + commText.substring(0, 30));
                } catch (e) {
                    state.trenutni_detalj = 'GRESKA - textarea nije pronadjena';
                    updateLiveStatus();
                }
            } else {
                state.trenutni_korak = 'Nema komentara';
                state.trenutni_detalj = 'Preskacanje unosa';
                updateLiveStatus();
            }

            await sleep(1000);

            state.trenutni_korak = 'Slanje obrasca...';
            state.trenutni_detalj = 'Trazim dugme Fertig/Submit...';
            updateLiveStatus();
            const t9 = Date.now();
            const formSent = await activePage.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]')).filter(b => {
                    const text = (b.innerText || b.value || '').toLowerCase();
                    return /senden|submit|fertig|weiter|next|continue/.test(text);
                });
                if (buttons.length > 0) { buttons[0].scrollIntoView({behavior:'smooth'}); buttons[0].click(); return true; }
                return false;
            });

            state.trenutni_detalj = (formSent ? 'OK - Kliknuto! ' : 'GRESKA - ') + '[' + ((Date.now() - t9) / 1000).toFixed(2) + 's]';
            updateLiveStatus();
            await sleep(3000);
            if (state.config.takeScreenshots) await safeShot(activePage, id + '_p' + attempt + '_8_submit.png');

            state.trenutni_korak = 'Provjera zahvalnice...';
            state.trenutni_detalj = 'Trazim "Vielen Dank"...';
            updateLiveStatus();
            const t10 = Date.now();
            const isSuccess = await activePage.evaluate(() => {
                return /Vielen Dank|Danke f.r Ihre Zeit|better Service|Thank you|Hvala/i.test(document.body.innerText);
            });

            if (activePage !== page) {
                try { await activePage.close(); } catch(e){}
            }

            if (isSuccess) {
                state.trenutni_detalj = 'OK - USPJEH! [' + ((Date.now() - t10) / 1000).toFixed(2) + 's]';
                updateLiveStatus();
                if (state.config.takeScreenshots) await safeShot(page, id + '_p' + attempt + '_9_success.png');

                const logEntry = { id: id, plz: plz, score: score, komentar: commText, status: 'ZAVRSENO', pokusaj: attempt, vrijeme: new Date().toISOString() };
                fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');

                let logText = id + ' | ' + plz + ' | ' + score + '/10';
                if (commText) logText += ' | Komentar';
                addLog('[+]', logText);

                state.zavreno++;
                state.sve_ankete.push({
                    id: id,
                    plz: plz,
                    score: score,
                    komentar: commText,
                    status: 'ZAVRSENO',
                    pokusaj: attempt,
                    vrijeme: new Date().toISOString()
                });

                updateStats();
                
                // Nasumična pauza između anketa
                const extraWait = rand(1000, 4000);
                await sleep(state.config.delaySeconds * 1000 + extraWait);
                
                try { await page.close(); } catch(e){}
                return 'ZAVRSENO';
            } else {
                if (attempt < state.config.retryCount + 1) {
                    state.trenutni_detalj = 'POKUSAJ ' + (attempt + 1) + '...';
                    updateLiveStatus();
                    try { await page.close(); } catch(e){}
                    await sleep(2000);
                    continue;
                }

                state.trenutni_detalj = 'GRESKA - Zahvalnica nije pronadjena';
                updateLiveStatus();
                if (state.config.takeScreenshots) await safeShot(page, id + '_p' + attempt + '_ERROR_zahvalnica.png');
                state.greske++;
                addLog('[-]', id + ' | Zahvalnica nije pronadjena (p' + attempt + ')');
                updateStats();

                state.sve_ankete.push({
                    id: id,
                    plz: plz,
                    score: score,
                    komentar: commText,
                    status: 'GRESKA_ZAHVALNICA',
                    pokusaj: attempt,
                    vrijeme: new Date().toISOString()
                });

                try { await page.close(); } catch(e){}
                return 'GRESKA';
            }

        } catch (e) {
            if (attempt < state.config.retryCount + 1) {
                state.trenutni_detalj = 'Greska - POKUSAJ ' + (attempt + 1) + '...';
                updateLiveStatus();
                try { await page.close(); } catch(er){}
                await sleep(2000);
                continue;
            } else {
                state.trenutni_detalj = 'GRESKA - ' + e.message.substring(0, 30);
                updateLiveStatus();
                if (state.config.takeScreenshots) await safeShot(page, id + '_p' + attempt + '_CATCH_ERROR.png');
                state.greske++;
                addLog('[-]', id + ' | Greska: ' + e.message.substring(0, 20));
                updateStats();

                state.sve_ankete.push({
                    id: id,
                    plz: plz,
                    score: score,
                    komentar: commText,
                    status: 'GRESKA_EXCEPTION',
                    pokusaj: attempt,
                    vrijeme: new Date().toISOString(),
                    greska: e.message.substring(0, 50)
                });

                try { await page.close(); } catch(er){}
                return 'GRESKA';
            }
        }
    }

    return 'GRESKA';
}

(async () => {
    state.config.activeField = 0;
    updateConfigUI();
    config.show();
    config.focus();

    config.on('keypress', async (ch, key) => {
        if ((key.name === 'space' || key.name === 'enter') && state.config.activeField === 7) {
            state.config.takeScreenshots = !state.config.takeScreenshots;
            updateConfigUI();
            return;
        }

        if (key.name === 'enter' && state.config.activeField !== 7) {
            config.hide();
            updateStats();
            updateLiveStatus();

            currentBrowser = await launchBrowser();

            try { delete require.cache[require.resolve(STORE_FILE)]; } catch(e){}
            const store = require(STORE_FILE);
            let all=[];
            for(let p in store) if (store[p].length > 0) store[p].forEach(id=>all.push({id: id, p: p}));

            const selected = all.sort(()=>0.5-Math.random()).slice(0, state.ukupno);
            state.ukupno = selected.length;

            for(let i=0; i<selected.length; i++){
                if(forceStop) break;
                await worker(currentBrowser, selected[i].id, selected[i].p, i+1, selected.length);
                store[selected[i].p] = store[selected[i].p].filter(x => x !== selected[i].id);
                try { fs.writeFileSync(STORE_FILE, 'module.exports = ' + JSON.stringify(store, null, 2) + ';'); } catch(e){}
                if(i < selected.length - 1 && !forceStop) await sleep(1000);
            }
            if (currentBrowser) try { await currentBrowser.close(); } catch(e) {}
            state.trenutni_korak = 'GOTOVO - Sve ankete su obradjene';
            state.trenutni_detalj = 'Izvoz u JSON fajl...';
            updateLiveStatus();
            await sleep(2000);
            screen.destroy();
            process.exit(0);
            return;
        }

        if (key.name === 'left') {
            if (state.config.activeField === 0) {
                forceStop = true;
                if (currentBrowser) try { await currentBrowser.close(); } catch(e) {}
                screen.destroy();
                process.exit(0);
            } else {
                state.config.activeField--;
                updateConfigUI();
            }
        }

        if (key.name === 'right' && state.config.activeField < 7) {
            state.config.activeField++;
            updateConfigUI();
        }

        if (key.name === 'up' || key.name === 'down') {
            const delta = key.name === 'up' ? 1 : -1;
            if (state.config.activeField === 0) {
                state.ukupno = Math.max(1, Math.min(1000, state.ukupno + delta));
            } else if (state.config.activeField === 1) {
                state.config.min_ocjena = Math.max(1, Math.min(9, state.config.min_ocjena + delta));
                if (state.config.min_ocjena > state.config.max_ocjena) state.config.max_ocjena = state.config.min_ocjena;
            } else if (state.config.activeField === 2) {
                state.config.max_ocjena = Math.max(state.config.min_ocjena, Math.min(10, state.config.max_ocjena + delta));
            } else if (state.config.activeField === 3) {
                state.config.min_komentari = Math.max(0, state.config.min_komentari + delta);
                if (state.config.min_komentari > state.config.max_komentari) state.config.max_komentari = state.config.min_komentari;
            } else if (state.config.activeField === 4) {
                state.config.max_komentari = Math.max(state.config.min_komentari, state.config.max_komentari + delta);
            } else if (state.config.activeField === 5) {
                state.config.delaySeconds = Math.max(0, Math.min(60, state.config.delaySeconds + delta));
            } else if (state.config.activeField === 6) {
                state.config.retryCount = Math.max(0, Math.min(5, state.config.retryCount + delta));
            }
            updateConfigUI();
        }
    });
})();
