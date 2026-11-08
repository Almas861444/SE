// Measures v1 (initial/app.js) vs v2 (final/src, excluding data/) -- every number is computed here.
// Usage: node scripts/metrics.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const listJs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? listJs(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);
const stripComments = (src) => src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const read = (files) => files.map((f) => stripComments(fs.readFileSync(f, 'utf8'))).join('\n');
const count = (src, re) => (src.match(re) || []).length;

const v1Files = [path.join(root, 'initial/app.js')];
const v2Files = listJs(path.join(root, 'final/src')).filter((f) => !f.includes(`${path.sep}data${path.sep}`));
const v1 = read(v1Files), v2 = read(v2Files);

const measures = [
  ['Time-parsing implementations (v1: split(\':\') sites; v2: HHMM.exec sites)', count(v1, /split\(':'\)/g), count(v2, /HHMM\.exec\(/g)],
  ['Time-format validation regex copies', count(v1, /\^\(\[01\]\\d\|2\[0-3\]\)/g), count(v2, /\^\(\[01\]\\d\|2\[0-3\]\)/g)],
  ['Literal 120 (max duration) in rule code', count(v1, /\b120\b/g), count(v2, /\b120\b/g)],
  ['Copies of message "End time must be after the start time."', count(v1, /End time must be after the start time\./g), count(v2, /End time must be after the start time\./g)],
  ['Copies of message "Enter start and end times in HH:MM format"', count(v1, /Enter start and end times in HH:MM format/g), count(v2, /Enter start and end times in HH:MM format/g)],
  ['Copies of message "A booking can last at most"', count(v1, /A booking can last at most/g), count(v2, /A booking can last at most/g)],
  ['Result/error markup templates (v1: box/error divs; v2: result template)', count(v1, /class="box |<p class="error">/g), count(v2, /class="result result--/g)]
];

const loc = (files) => files.map((f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length);
console.log('Measure'.padEnd(78), 'v1'.padStart(3), 'v2'.padStart(3));
let extraV1 = 0, extraV2 = 0;
for (const [name, a, b] of measures) {
  console.log(name.padEnd(78), String(a).padStart(3), String(b).padStart(3));
  extraV1 += Math.max(a - 1, 0); extraV2 += Math.max(b - 1, 0);
}
console.log(`\nDuplicated logic locations (copies beyond the first, summed over the ${measures.length} measures): v1 = ${extraV1}, v2 = ${extraV2}, removed = ${extraV1 - extraV2}`);

console.log('\nCode structure');
console.log(`v1: ${v1Files.length} source file, ${loc(v1Files)[0]} code lines (rules + data + DOM in one file)`);
const all2 = listJs(path.join(root, 'final/src'));
for (const f of all2) console.log(`v2: ${path.relative(root, f).padEnd(34)} ${String(loc([f])[0]).padStart(3)} code lines`);
console.log(`v2: ${all2.length} source modules, ${loc(all2).reduce((a, b) => a + b, 0)} code lines in total (incl. data/rooms.js)`);
console.log(`DOM access (document.*) in v1 file: ${count(v1, /document\./g)} | in v2 modules outside ui/main.js: ${count(read(v2Files.filter((f) => !f.endsWith('main.js'))), /document\./g)}`);
