// A component may never name a palette, direction or material.
import fs from 'node:fs';
import path from 'node:path';

const banned = /\b(phosphor|blueprint|plotter|panel-material|walnut|d[1-6]-only)\b/;
const files = [...fs.readdirSync('src/components').map((f) => path.join('src/components', f)), 'src/styles/components.css'];
const hits = files.flatMap((file) =>
  fs.readFileSync(file, 'utf8').split('\n').flatMap((line, i) => (banned.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
);
if (hits.length) {
  console.error(hits.join('\n'));
  process.exit(1);
}
console.log('Token rule holds.');
