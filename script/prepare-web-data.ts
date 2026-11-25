import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { parseSurvey } from '../src/parse-survey.ts';
import { summarize, type SurveySummary } from '../src/survey.ts';

const source = new URL('../data/data.csv', import.meta.url);
const generated = new URL('../src/generated/', import.meta.url);
const csv = await readFile(source);
const survey = parseSurvey(csv.toString('utf8'));
const result: SurveySummary = { filters: survey.filters, stats: summarize(survey) };
const summary = JSON.stringify(result);
const compressed = gzipSync(csv, { level: 9 });

await mkdir(generated, { recursive: true });
await Promise.all([
  writeFile(new URL('summary.json', generated), summary),
  writeFile(new URL('survey.csv.gz', generated), compressed),
]);
console.log(`Prepared survey data (${Buffer.byteLength(summary).toLocaleString('en-US')} bytes of summary, ${compressed.length.toLocaleString('en-US')} bytes of compressed responses).`);
