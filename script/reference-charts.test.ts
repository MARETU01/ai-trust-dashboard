import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseSurvey } from '../src/parse-survey.ts';
import { createSurvey, summarize, surveyFields, type SurveyCsvRow } from '../src/survey.ts';

// Visible percentages transcribed from tableau_fig/00.png–12.png, in survey.ts domain order.
// The unlabelled Sankey nodes are checked against the source co-selection counts.
// Figure 12 has a narrower population than Figure 08; do not merge their tallies.
const survey = parseSurvey(readFileSync(new URL('../data/data.csv', import.meta.url), 'utf8'));
const stats = summarize(survey);
const pct = (value: number, n: number) => n ? (100 * value / n).toFixed(2) : null;
const formatted = (values: number[]) => values.map((value) => value.toFixed(2));

test('00: age distribution', () => {
  assert.deepEqual(Object.values(stats.demographics.counts).map((value) => pct(value, stats.demographics.n)),
    formatted([18.87, 33.84, 27.13, 12.86, 5.38, 1.93]));
});

test('01: adoption within each age group', () => {
  const expected = [
    [47.17, 19.10, 13.68, 2.71, 17.33], [51.12, 17.85, 12.82, 3.98, 14.24],
    [48.72, 17.66, 13.74, 5.28, 14.60], [45.10, 17.71, 14.50, 7.28, 15.41],
    [33.78, 15.43, 15.48, 12.04, 23.27], [22.25, 11.66, 16.16, 14.04, 35.89],
  ];
  assert.deepEqual(stats.adoption.map(({ counts, n }) => Object.values(counts).map((v) => pct(v, n))), expected.map(formatted));
});

test('02: trust endpoints within each age group', () => {
  assert.deepEqual(stats.ageTrust.map(({ counts, n }) => [pct(counts['Highly distrust'], n), pct(counts['Highly trust'], n)]),
    [[20.59, 3.28], [19.36, 3.31], [19.59, 3.10], [18.10, 2.84], [19.90, 2.80], [21.07, 3.09]].map(formatted));
});

test('03: AI learning by experience and use frequency', () => {
  assert.deepEqual(stats.learning.map((row) => row.map(({ yes, n }) => pct(yes, n))),
    [[81.86, 87.36, 89.84], [69.41, 77.08, 82.68], [50.97, 58.56, 63.79]].map(formatted));
});

test('03: Tableau bubble sizes include respondents with missing learning answers', () => {
  assert.deepEqual(stats.learning.map((row) => row.map(({ respondents }) => respondents)),
    [[4216, 3502, 7162], [1473, 1180, 2825], [983, 960, 2277]]);
  assert.deepEqual(stats.learning.map((row) => row.map(({ n }) => n)),
    [[4212, 3498, 7154], [1471, 1178, 2823], [981, 958, 2270]]);
});

test('03: filtered group size remains separate from the learning-rate denominator', () => {
  const blank = Object.fromEntries(surveyFields.map((field) => [field, ''])) as SurveyCsvRow;
  const sample = createSurvey([
    { ...blank, country: 'A', ai_use_group: 'daily', work_experience_years: '3', ai_learning: 'yes_for_work' },
    { ...blank, country: 'B', ai_use_group: 'daily', work_experience_years: '3' },
  ]);
  assert.deepEqual(summarize(sample).learning[0][0], { n: 1, yes: 1, respondents: 2 });
  assert.deepEqual(summarize(sample, { country: 'A' }).learning[0][0], { n: 1, yes: 1, respondents: 1 });
  assert.deepEqual(summarize(sample, { country: 'B' }).learning[0][0], { n: 0, yes: 0, respondents: 1 });
});

test('04: top ten languages', () => {
  assert.deepEqual(stats.languages.items.map(({ count }) => pct(count, stats.languages.n)),
    formatted([66.32, 62.20, 58.83, 58.13, 48.95, 43.76, 29.55, 27.95, 23.63, 23.27]));
});

test('05: top ten databases', () => {
  assert.deepEqual(stats.databases.items.map(({ count }) => pct(count, stats.databases.n)),
    formatted([56.86, 41.41, 38.35, 30.81, 28.63, 24.53, 22.94, 17.01, 10.81, 9.98]));
});

test('06: community row minima and maxima', () => {
  const ranges = stats.community[0].items.map((_, i) => {
    const values = stats.community.map(({ items, n }) => 100 * items[i].count / n);
    return [Math.min(...values).toFixed(2), Math.max(...values).toFixed(2)];
  });
  assert.deepEqual(ranges, [[82.46, 88.35], [57.33, 69.57], [47.04, 66.92], [45.69, 56.25], [41.40, 54.62],
    [27.02, 40.09], [21.03, 45.08], [16.63, 35.77], [15.52, 20.93], [9.17, 22.47]].map(formatted));
});

test('07: co-selection node totals preserve all respondent links', () => {
  assert.equal(stats.modelN, 11845);
  assert.deepEqual(stats.modelPairs.map((row) => row.reduce((a, b) => a + b, 0)), [17671, 15478, 28678, 13156, 16484, 22011]);
  assert.deepEqual(stats.modelPairs[0].map((_, i) => stats.modelPairs.reduce((sum, row) => sum + row[i], 0)),
    [19178, 14607, 25739, 12472, 16571, 24911]);
});

test('08: displayed task-status percentages, with values below 15% omitted', () => {
  const expected = [[40.64, 23.91, 23.99], [38.61, 19.98, 17.81, 16.32], [33.01, 20.89, 27.11],
    [22.88, 26.20, 33.28], [18.79, 58.92], [21.12, 22.83, 32.39], [32.66, 22.97, 30.44],
    [19.21, 25.96, 37.17], [15.85, 23.64, 49.73], [19.00, 64.76], [19.38, 57.11], [20.25, 21.23, 32.54], [19.15, 24.45, 33.54]];
  assert.deepEqual(stats.tasks.map(({ counts, n }) => counts.filter((v) => 100 * v / n >= 15).map((v) => pct(v, n))),
    expected.map(formatted));
});

test('09: ratings within current AI-use groups', () => {
  assert.deepEqual(stats.complexity.map(({ counts, n }) => Object.values(counts).map((v) => pct(v, n))),
    [[45.79, 16.56, 35.23, 2.43], [26.71, 17.15, 49.91, 6.23], [15.37, 14.54, 56.68, 13.42]].map(formatted));
});

test('10: favorable respondents who distrust AI outputs', () => {
  const favorable = stats.sentimentTrust[1];
  assert.equal(pct(favorable.counts['Highly distrust'] + favorable.counts['Somewhat distrust'], favorable.n), '32.35');
});

test('11: job threat within each age group', () => {
  assert.deepEqual(stats.jobThreat.map(({ counts, n }) => Object.values(counts).map((v) => pct(v, n))),
    [[15.72, 22.53, 61.75], [14.57, 21.07, 64.36], [15.28, 21.58, 63.15],
      [15.61, 21.13, 63.26], [13.60, 19.59, 66.81], [9.57, 14.83, 75.60]].map(formatted));
});

test('12: current AI use among professional developers who use AI', () => {
  assert.deepEqual(stats.taskUsage.map(({ counts, n }) => pct(counts[0] + counts[1], n)),
    formatted([59.12, 71.16, 54.94, 36.86, 17.89, 41.14, 49.08, 33.13, 23.68, 10.81, 15.09, 41.85, 35.44]));
});

test('12: filters intersect the reference population and reset restores the baseline', () => {
  const china = summarize(survey, { country: 'China' }).taskUsage[1];
  assert.equal(china.n, 124);
  assert.equal(china.counts[0] + china.counts[1], 98);
  for (const filters of [{ aiUse: 'plan_to_use' }, { aiUse: 'no_plans_to_use' }, { country: '__missing_country__' }] as const) {
    const filtered = summarize(survey, filters);
    assert.ok(filtered.taskUsage.every(({ n }) => n === 0));
  }
  assert.deepEqual(summarize(survey, {}).taskUsage, stats.taskUsage);
});
