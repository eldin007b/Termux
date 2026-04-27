const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'nps-log.jsonl');

console.log('\n📊 NPS STATISTIKA\n');

if (!fs.existsSync(LOG_FILE)) {
  console.log('⚠ Nema nps-log.jsonl fajla.');
  process.exit(0);
}

const lines = fs.readFileSync(LOG_FILE, 'utf8')
  .split('\n')
  .filter(Boolean);

if (!lines.length) {
  console.log('⚠ Log postoji ali je prazan.');
  process.exit(0);
}

let total = 0;
let byScore = {};
let promoters = 0, passives = 0, detractors = 0;

for (const l of lines) {
  try {
    const j = JSON.parse(l);
    if (j.status !== 'SCORE+COMMENT') continue;

    total++;
    byScore[j.score] = (byScore[j.score] || 0) + 1;

    if (j.score >= 9) promoters++;
    else if (j.score >= 7) passives++;
    else detractors++;
  } catch {}
}

console.log(`Ukupno poslanih NPS: ${total}\n`);

console.log('Raspodjela po ocjenama:');
Object.keys(byScore).sort((a,b)=>b-a).forEach(s=>{
  console.log(`  ${s}/10 → ${byScore[s]}`);
});

console.log('\nNPS segmenti:');
console.log(`  😊 Promoters (9–10): ${promoters}`);
console.log(`  😐 Passives (7–8):  ${passives}`);
console.log(`  😠 Detractors (0–6): ${detractors}`);

const npsScore = total
  ? Math.round(((promoters - detractors) / total) * 100)
  : 0;

console.log(`\n⭐ REALNI NPS SCORE: ${npsScore}`);

console.log('\nEnter za povratak...');
process.stdin.once('data', () => process.exit(0));
