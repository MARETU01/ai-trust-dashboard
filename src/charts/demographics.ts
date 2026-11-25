import { AGE_GROUPS, EXPERIENCE_GROUPS, TRUST_LEVELS, count, percent, share, type SurveyStats } from '../survey.ts';
import type { Translate } from '../i18n.ts';
import type { ChartView, Matrix, TooltipLine } from '../chart-types.ts';
import { chartFont, palette } from '../chart-theme.ts';
import { ageLabels, aiIds, aiLabels, trustLabels, valueAndN, responseLine, tip, chart, axisLabels, valueAxis, categoryAxis, categoryHover, matrixTip, itemTable, matrixTable, mix, heatColor, heatmap, colorLegend } from './shared.ts';

export function ageDistribution({ demographics }: SurveyStats, t: Translate): ChartView {
  const values = AGE_GROUPS.map(([id]) => demographics.counts[id]);
  const n = demographics.n;
  return {
    empty: !n, n, nLabel: 'reported age',
    legend: colorLegend(t, ageLabels, palette.ages),
    table: itemTable(t, 'Age group', ageLabels, values, values.map(() => n)),
    option: chart({
      color: palette.ages,
      graphic: [{
        type: 'group', left: 'center', top: 'middle', silent: true, children: [
          { type: 'text', style: { text: count(n), x: 0, y: -14, textAlign: 'center', font: `700 27px ${chartFont}`, fill: palette.ink } },
          { type: 'text', style: { text: t('Reported age'), x: 0, y: 17, textAlign: 'center', font: `12px ${chartFont}`, fill: palette.muted } },
        ],
      }],
      tooltip: { formatter: (params) => !Array.isArray(params) && typeof params.value === 'number'
        ? tip(t, params.name, [responseLine(t, params.value, n)]) : '' },
      series: [{
        type: 'pie', radius: ['51%', '74%'], center: ['50%', '50%'], stillShowZeroSum: false,
        itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 4 },
        label: { show: true, formatter: ({ value }) => percent(typeof value === 'number' ? share(value, n) : null), color: palette.ink, fontSize: 11 },
        labelLine: { length: 9, length2: 6, lineStyle: { color: '#b6adc9' } },
        data: ageLabels.flatMap((name, i) => values[i] ? [{ id: `age-${i}`, name, value: values[i], itemStyle: { color: palette.ages[i] } }] : []),
      }],
    }),
  };
}

export function adoption({ adoption: groups }: SurveyStats, t: Translate): ChartView {
  const values = aiIds.map((id) => groups.map((group) => group.counts[id]));
  const totals = aiIds.map(() => groups.map((group) => group.n));
  return {
    ...heatmap(t, ageLabels, aiLabels.map((name) => t(name)), values, totals, { label: 'AI use by age group' }),
    n: groups.reduce((sum, group) => sum + group.n, 0),
    scale: { low: heatColor(0), high: heatColor(60), end: '60%+' },
  };
}

export function trustAcrossAge({ ageTrust: groups }: SurveyStats, t: Translate): ChartView {
  const values = groups.map(({ counts }) => TRUST_LEVELS.map((level) => counts[level]));
  const totals = groups.map((group) => TRUST_LEVELS.map(() => group.n));
  const legend = colorLegend(t, trustLabels, palette.trust);
  const portions = [[1, -1], [0, -1], [2, -0.5], [2, 0.5], [3, 1], [4, 1]];
  const { tooltip, axisTooltip } = categoryHover(ageLabels, (i) => tip(t, t('Ages {group}', { group: ageLabels[i] }), [
    ...trustLabels.map((label, j): TooltipLine => [label, valueAndN(values[i][j], groups[i].n)]),
    ['Valid responses', count(groups[i].n)],
  ]));
  return {
    n: groups.reduce((sum, group) => sum + group.n, 0),
    legend, table: matrixTable(t, 'Age group', ageLabels, trustLabels, values, totals),
    option: chart({
      grid: { top: 9, right: 32, bottom: 27, left: 60 },
      xAxis: valueAxis(100, { min: -100, splitNumber: 4, axisLabel: { ...axisLabels, formatter: (value) => `${Math.abs(value)}%` } }),
      yAxis: categoryAxis(ageLabels, { inverse: true, axisLine: { show: false }, tooltip: axisTooltip }),
      tooltip,
      series: [
        portions[2], portions[0], portions[1], portions[3], portions[4], portions[5],
      ].map(([status, sign]) => ({
        type: 'bar', name: t(trustLabels[status]), stack: 'trust', barMaxWidth: 23,
        itemStyle: { color: palette.trust[status], borderColor: '#fff', borderWidth: 0.5 },
        data: groups.map(({ n }, index) => n ? sign * (share(values[index][status], n) ?? 0) : null),
      })),
    }),
  };
}

export function experienceLearning({ learning }: SurveyStats, t: Translate): ChartView {
  const groups = aiLabels.slice(0, 3).map((name) => t(name));
  const experienceLabels = EXPERIENCE_GROUPS.map((name) => t(name));
  const totals = learning.map((row) => row.map(({ n }) => n));
  const max = Math.max(1, ...totals.flat());
  const matrix: Matrix = {
    headers: experienceLabels,
    label: t('AI learning rate by work experience'),
    rows: groups.map((name, i) => ({
      name,
      cells: learning[i].map(({ yes, n }, j) => {
        const pct = share(yes, n);
        return {
          value: percent(pct),
          selectable: n > 0,
          className: 'bubble-cell',
          tooltip: matrixTip(t, `${name} · ${experienceLabels[j]}`, yes, n),
          bubble: n ? { '--bubble': `${22 + 44 * Math.sqrt(n / max)}px`, '--bubble-fill': mix('#e2d4f1', '#78cfb4', (pct ?? 0) / 100) } : undefined,
        };
      }),
    })),
  };
  return {
    matrix, n: totals.flat().reduce((sum, n) => sum + n, 0),
    table: matrixTable(t, 'AI use', groups, experienceLabels, learning.map((row) => row.map(({ yes }) => yes)), totals),
  };
}
