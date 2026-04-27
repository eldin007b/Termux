#!/usr/bin/env node
'use strict';

const blessed = require('blessed');
const fs = require('fs');
const path = require('path');

const TRACKING_FILE = path.join(__dirname, 'trackingByPlz.js');
const CMD_FILE = path.join(__dirname, '.next_command');

/* ================= HELPERS ================= */
function getStats() {
    let ids = 0, plz = 0, size = '0 KB';
    if (fs.existsSync(TRACKING_FILE)) {
        try {
            const stats = fs.statSync(TRACKING_FILE);
            size = (stats.size / 1024).toFixed(2) + ' KB';
            delete require.cache[require.resolve(TRACKING_FILE)];
            const data = require(TRACKING_FILE);
            plz = Object.keys(data).length;
            for (const k in data) ids += data[k].length;
        } catch (e) {}
    }
    return { ids, plz, size };
}

/* ================= SCREEN ================= */
const screen = blessed.screen({
    smartCSR: true,
    title: 'GLS PLATINUM v6.2',
    fullUnicode: true,
    warnings: false,
    input: process.stdin,       
    output: process.stdout,     
    terminal: 'xterm-256color'
});

const header = blessed.box({
    top: 0, left: 0, width: '100%', height: 3,
    style: { bg: '#0f172a', fg: '#38bdf8', bold: true },
    content: '\n💎 GLS PLATINUM {cyan-fg}v6.2{/cyan-fg}',
    tags: true, align: 'center'
});

const list = blessed.list({
    top: 3, left: 'center', width: '100%', bottom: 4,
    keys: true, mouse: true, vi: true,
    tags: true, // <--- OVO JE NEDOSTAJALO ZA BOLD NASLOV!
    border: { type: 'line', fg: '#334155' },
    label: ' {bold}GLAVNI IZBORNIK{/bold} ',
    style: {
        bg: '#020617', fg: 'white',
        selected: { bg: '#38bdf8', fg: '#0f172a', bold: true }
    },
    items: [
        ' [1] 🚀 NPS AUTOMATION',
        ' [2] 💎 BETTERMILE PRO',
        ' [3] 📊 GLS SCRAPER',
        ' [4] ⚙️  ODRŽAVANJE I ALATI',
        ' [5] 🚪 IZLAZ'
    ]
});

const footer = blessed.box({
    bottom: 0, left: 0, width: '100%', height: 3,
    style: { bg: '#0f172a', fg: 'gray' },
    tags: true, align: 'center',
    content: '→ Desno/Enter: POKRENI | ← Lijevo: IZLAZ'
});

const statsBox = blessed.box({
    bottom: 3, left: 0, width: '100%', height: 1,
    style: { bg: '#020617', fg: 'white' },
    tags: true, align: 'center',
    content: 'Učitavanje...'
});

screen.append(header); screen.append(list); screen.append(statsBox); screen.append(footer);

/* ================= LOGIC ================= */
function updateStats() {
    const s = getStats();
    statsBox.setContent(`📦 PAKETI: {green-fg}${s.ids}{/} | 📍 ZONE: {green-fg}${s.plz}{/} | 💾 DB: {cyan-fg}${s.size}{/}`);
    screen.render();
}

function triggerCommand(scriptName) {
    fs.writeFileSync(CMD_FILE, scriptName);
    screen.destroy();
    process.exit(0);
}

function executeAction(index) {
    switch(index) {
        case 0: triggerCommand('nps.js'); break;      
        case 1: triggerCommand('bm.js'); break;       
        case 2: triggerCommand('scraper.js'); break;  
        case 3: triggerCommand('tools.js'); break;    
        case 4: triggerCommand('EXIT'); break;        
    }
}

// EVENTS
list.on('select', (item, index) => executeAction(index));

list.on('keypress', (ch, key) => {
    if (key.name === 'right') executeAction(list.selected);
    if (key.name === 'left') triggerCommand('EXIT');
});

screen.key(['q', 'C-c'], () => triggerCommand('EXIT'));
screen.key(['1','2','3','4','5'], (ch) => {
    const map = {'1':0, '2':1, '3':2, '4':3, '5':4};
    if(map[ch] !== undefined) {
        list.select(map[ch]);
        executeAction(map[ch]);
    }
});

updateStats();
list.focus();
screen.render();
