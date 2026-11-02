import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist);
for (const file of ['index.html', 'styles.css', 'app.js', 'assessment-model.js', '_headers']) await cp(resolve(root, file), resolve(dist, file));
await cp(resolve(root, 'assets'), resolve(dist, 'assets'), { recursive: true });
// Keep the original questionnaire URL working without maintaining a second application.
await cp(resolve(root, 'index.html'), resolve(dist, 'MCS_Cleaning_Business_Case_v2.3.html'));
console.log('Built dist/ — ready for Netlify.');
