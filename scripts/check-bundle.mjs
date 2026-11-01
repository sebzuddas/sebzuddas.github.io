// The hero's JavaScript must stay under 40 KB gzipped.
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = 'dist/_astro';
const EAGER_LIMIT = 40;
const THREE_D_LIMIT = 220;
const gz = (file) => gzipSync(fs.readFileSync(path.join(dir, file))).length / 1024;

let failed = false;
for (const page of ['dist/index.html']) {
  const html = fs.readFileSync(page, 'utf8');
  const eager = [...new Set([...html.matchAll(/\/_astro\/([^"']+\.js)/g)].map((m) => m[1]))];
  const eagerSize = eager.reduce((sum, file) => sum + gz(file), 0);
  // Follows imports from this page, so pages with their own heavy scripts do not count.
  const reached = new Set(eager);
  for (const file of reached) {
    for (const m of fs.readFileSync(path.join(dir, file), 'utf8').matchAll(/["'`]\.?\/?(?:_astro\/)?([\w.-]+\.js)["'`]/g)) {
      if (fs.existsSync(path.join(dir, m[1]))) reached.add(m[1]);
    }
  }
  const views = [...reached].filter((f) => !eager.includes(f));
  const largest = Math.max(0, ...views.map(gz));
  console.log(`${page} loaded with the page: ${eagerSize.toFixed(1)} KB gzipped (limit ${EAGER_LIMIT})`);
  console.log(`${page} largest lazy chunk: ${largest.toFixed(1)} KB gzipped (limit ${THREE_D_LIMIT})`);
  if (!eager.length || eagerSize > EAGER_LIMIT || largest > THREE_D_LIMIT) failed = true;
}
if (failed) process.exit(1);
