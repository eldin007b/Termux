#!/usr/bin/env node
'use strict';

const blessed = require('blessed');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const TRACKING_FILE = path.join(__dirname, 'trackingByPlz.js');
const CMD_FILE = path.join(__dirname, '.next_command');

/* ================= SCREEN ================= */
const screen = blessed.screen({
    smartCSR: true,
    title: 'GLS TOOLS',
    fullUnicode: true,
    warnings: false,
    input: process.stdin,       
    output: process.stdout,     
    terminal: 'xterm-256color'
});

const header = blessed.box({
    top: 0, left: 0, width: '100%', height: 3,
    style: { bg: '#334155', fg: '#fbbf24', bold: true },
    content: '\n🛠️  GLS ALATI',
    tags: true, align: 'center'
});

const list = blessed.list({
    top: 3, left: 'center', width: '100%', bottom: 3,
    keys: true, mouse: true, vi: true,
    tags: true,
    border: { type: 'line', fg: '#fbbf24' }, 
    label: ' {bold}ODRŽAVANJE I ALATI{/bold} ', 
    style: {
        bg: '#020617', fg: 'white',
        selected: { bg: '#fbbf24', fg: '#000000', bold: true }
    },
    items: [
        ' [1] 🛠️  NPS VISUAL DEV (Test)',
        ' [2] 🔍 NPS DIJAGNOSTIKA (Debug)',
        ' [3] 📝 UREDI BAZU (Nano)',
        ' [4] 🧹 RESETIRAJ BAZU (Obriši sve)',
        ' [5] 💾 BACKUP (Spremi na mobitel)',
        ' [6] ♻️  RESTORE (Vrati s mobitela)',
        ' [7] 🗑️  OČISTI SHOTS I .JSONL LOGOVE',
        ' [0] 🔙 NATRAG NA GLAVNI MENI'
    ]
});

const footer = blessed.box({
    bottom: 0, left: 0, width: '100%', height: 3,
    style: { bg: '#334155', fg: 'white' },
    tags: true, align: 'center',
    content: '→ Desno/Enter: POKRENI  |  ← Lijevo: NATRAG'
});

screen.append(header); screen.append(list); screen.append(footer);

/* ================= LOGIC ================= */
function triggerCommand(scriptName) {
    fs.writeFileSync(CMD_FILE, scriptName);
    screen.destroy();
    process.exit(0);
}

function executeAction(index) {
    switch(index) {
        case 0: triggerCommand('nps.dev.js'); break;
        case 1: triggerCommand('debug_nps.js'); break;
        case 2: // Nano
            screen.destroy();
            const child = spawn('nano', [TRACKING_FILE], { stdio: 'inherit' });
            child.on('exit', () => {
                spawn('node', [__filename], { stdio: 'inherit' }); 
                process.exit(0);
            });
            break;
        case 3: // Reset Baze
            fs.writeFileSync(TRACKING_FILE, 'module.exports = {};');
            header.style.bg = 'green';
            header.setContent('\n✅ BAZA RESETIRANA!');
            screen.render();
            setTimeout(() => {
                 header.style.bg = '#334155';
                 header.setContent('\n🛠️  GLS ALATI');
                 screen.render();
            }, 1500);
            break;
        case 4: // BACKUP
            screen.destroy();
            try { execSync('bash backup.sh', { stdio: 'inherit' }); } catch(e) {}
            spawn('node', [__filename], { stdio: 'inherit' });
            process.exit(0);
            break;
        case 5: // RESTORE
            screen.destroy();
            try { execSync('bash restore.sh', { stdio: 'inherit' }); } catch(e) {}
            spawn('node', [__filename], { stdio: 'inherit' });
            process.exit(0);
            break;
        case 6: // OČISTI SHOTS I .JSONL
            try {
                const shotsDir = path.join(__dirname, 'shots');
                
                // 1. Obriši datoteke u folderu shots
                if (fs.existsSync(shotsDir)) {
                    const files = fs.readdirSync(shotsDir);
                    files.forEach(file => {
                        const filePath = path.join(shotsDir, file);
                        if (fs.lstatSync(filePath).isFile()) {
                            fs.unlinkSync(filePath);
                        }
                    });
                }

                // 2. Obriši sve .jsonl datoteke u glavnom folderu
                const rootFiles = fs.readdirSync(__dirname);
                rootFiles.forEach(file => {
                    if (file.endsWith('.jsonl')) {
                        fs.unlinkSync(path.join(__dirname, file));
                    }
                });

                header.style.bg = '#7f1d1d'; // Crvena boja
                header.setContent('\n✅ OBRISANI SHOTS I SVI .JSONL LOGOVI!');
                screen.render();
            } catch (err) {
                header.setContent('\n❌ GREŠKA PRI BRISANJU!');
                screen.render();
            }
            setTimeout(() => {
                 header.style.bg = '#334155';
                 header.setContent('\n🛠️  GLS ALATI');
                 screen.render();
            }, 1500);
            break;
        case 7: // NATRAG
            screen.destroy();
            process.exit(0);
            break;
    }
}

// EVENTS
list.on('select', (item, index) => executeAction(index));

list.on('keypress', (ch, key) => {
    if (key.name === 'right' || key.name === 'enter') executeAction(list.selected);
    if (key.name === 'left') { screen.destroy(); process.exit(0); }
});

screen.key(['q', 'C-c', 'escape'], () => { screen.destroy(); process.exit(0); });

// Mapiranje tipki 0-7
screen.key(['1','2','3','4','5','6','7','0'], (ch) => {
    const map = {
        '1': 0, '2': 1, '3': 2, '4': 3, 
        '5': 4, '6': 5, '7': 6, '0': 7
    };
    if (map[ch] !== undefined) {
        list.select(map[ch]);
        executeAction(map[ch]);
    }
});

list.focus();
screen.render();
