import { COMPLEX_RATINGS, SENTIMENTS, THREAT_LEVELS, count, percent, share, type SurveyStats } from '../survey.ts';
import type { Translate } from '../i18n.ts';
import type { ChartView, TooltipLine } from '../chart-types.ts';
import { palette } from '../chart-theme.ts';
import { ageLabels, aiLabels, valueAndN, tip, chart, valueAxis, categoryAxis, categoryHover, matrixTable, colorLegend } from './shared.ts';

export function complexTasks({ complexity }: SurveyStats, t: Translate): ChartView {
  const groups = [...complexity].reverse();
  const labels = aiLabels.slice(0, 3).reverse().map((name) => t(name));
  const values = groups.map(({ counts }) => COMPLEX_RATINGS.map((name) => counts[name]));
  const totals = groups.map(({ n }) => COMPLEX_RATINGS.map(() => n));
  const max = Math.max(60, ...groups.flatMap(({ n }, i) => values[i].map((value) => 10 * Math.ceil((share(value, n) ?? 0) / 10))));
  const { tooltip, axisTooltip } = categoryHover(labels, (i) => tip(t, labels[i], [
    ...COMPLEX_RATINGS.map((label, j): TooltipLine => [label, valueAndN(values[i][j], groups[i].n)]),
    ['Valid responses', count(groups[i].n)],
  ]), 'x');
  return {
    n: groups.reduce((sum, { n }) => sum + n, 0),
    legend: colorLegend(t, COMPLEX_RATINGS, palette.complex).reverse(),
    table: matrixTable(t, 'AI use', labels, COMPLEX_RATINGS, values, totals),
    option: chart({
      grid: { top: 22, right: 36, bottom: 29, left: 44 },
      xAxis: categoryAxis(labels, { boundaryGap: true, tooltip: axisTooltip }), yAxis: valueAxis(max, { interval: 10 }),
      tooltip,
      series: COMPLEX_RATINGS.map((name, i) => ({
        type: 'line', name: t(name), symbol: 'circle', symbolSize: 7, showSymbol: i === 0 || i === 2,
        itemStyle: { color: palette.complex[i] }, lineStyle: { width: 2.5 },
        data: groups.map(({ n }, index) => share(values[index][i], n)),
        label: { show: i === 0 || i === 2, position: i === 0 ? 'top' : 'bottom', color: palette.ink, fontSize: 12,
          formatter: ({ value, dataIndex }) => typeof value === 'number' && (i === 0 || dataIndex === 2) ? percent(value) : '' },
      })),
      media: [{ query: { minWidth: 800 }, option: {
        xAxis: { axisLabel: { fontSize: 16 } }, yAxis: { axisLabel: { fontSize: 16 } },
        series: COMPLEX_RATINGS.map(() => ({ type: 'line', symbolSize: 9, lineStyle: { width: 3 }, label: { fontSize: 18 } })),
      } }],
    }),
  };
}

export function sentimentDumbbell({ sentimentTrust }: SurveyStats, t: Translate): ChartView {
  const values = sentimentTrust.map(({ counts }) => [
    counts['Highly distrust'] + counts['Somewhat distrust'],
    counts['Somewhat trust'] + counts['Highly trust'],
    counts['Neither trust nor distrust'],
  ]);
  const totals = sentimentTrust.map(({ n }) => [n, n, n]);
  const colors = [palette.purple, palette.green];
  const labels = SENTIMENTS.map((name) => t(name));
  const { tooltip, axisTooltip } = categoryHover(labels, (i) => tip(t, labels[i], [
    ...['Distrust', 'Trust', 'Neutral'].map((label, j): TooltipLine => [label, valueAndN(values[i][j], sentimentTrust[i].n)]),
    ['Valid responses', count(sentimentTrust[i].n)],
  ]));
  return {
    n: sentimentTrust.reduce((sum, { n }) => sum + n, 0),
    legend: colorLegend(t, ['Distrust', 'Trust'], colors),
    table: matrixTable(t, 'AI sentiment', labels, ['Distrust', 'Trust', 'Neutral'], values, totals),
    option: chart({
      grid: { top: 9, right: 26, bottom: 28, left: 109 },
      xAxis: valueAxis(100, { interval: 10 }), yAxis: categoryAxis(labels, { inverse: true, axisLine: { show: false }, tooltip: axisTooltip }),
      tooltip,
      series: [{
        type: 'custom', encode: { x: [0, 1], y: 2 },
        data: values.map(([a, b], i) => [share(a, sentimentTrust[i].n), share(b, sentimentTrust[i].n), i]),
        renderItem: (_params, api, opacity = 1) => {
          const first = api.value(0);
          const second = api.value(1);
          if (typeof first !== 'number' || typeof second !== 'number' || !Number.isFinite(first) || !Number.isFinite(second)) return;
          const a = api.coord([first, api.value(2)]);
          const b = api.coord([second, api.value(2)]);
          const radius = Math.max(6.5, Math.min(12, api.getHeight() / 50));
          return {
            type: 'group', children: [
              { type: 'line', shape: { x1: Math.min(a[0], b[0]), y1: a[1], x2: Math.max(a[0], b[0]), y2: b[1] },
                style: { stroke: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                  colorStops: [{ offset: 0, color: '#cdcdcd' }, { offset: 1, color: '#68747e' }] }, lineWidth: 4, opacity } },
              ...[a, b].map(([cx, cy], i) => ({ type: 'circle' as const, shape: { cx, cy, r: radius }, style: { fill: colors[i], opacity } })),
            ],
          };
        },
      }],
      media: [{ query: { minWidth: 800 }, option: {
        grid: { left: 155 }, xAxis: { axisLabel: { fontSize: 14 } }, yAxis: { axisLabel: { fontSize: 16 } },
      } }],
    }),
  };
}

export function ageThreat({ jobThreat: groups }: SurveyStats, t: Translate): ChartView {
  const values = groups.map(({ counts }) => THREAT_LEVELS.map((name) => counts[name]));
  const totals = groups.map(({ n }) => THREAT_LEVELS.map(() => n));
  const max = Math.max(1, ...values.flat());
  const { tooltip, axisTooltip } = categoryHover(ageLabels, (i) => tip(t, t('Ages {group}', { group: ageLabels[i] }), [
    ...THREAT_LEVELS.map((label, j): TooltipLine => [label, valueAndN(values[i][j], groups[i].n)]),
    ['Valid responses', count(groups[i].n)],
  ]));
  return {
    n: groups.reduce((sum, { n }) => sum + n, 0),
    legend: [1, 2, 0].map((i) => colorLegend(t, THREAT_LEVELS, palette.threat)[i]),
    table: matrixTable(t, 'Age group', ageLabels, THREAT_LEVELS, values, totals),
    option: chart({
      grid: { top: 9, right: 25, bottom: 30, left: 55 },
      xAxis: valueAxis(Math.max(80, ...groups.flatMap(({ n }, i) => values[i].map((value) => 10 * Math.ceil((share(value, n) ?? 0) / 10)))), { interval: 10 }),
      yAxis: categoryAxis(ageLabels, { inverse: true, tooltip: axisTooltip }),
      tooltip,
      series: THREAT_LEVELS.map((name, j) => ({
        type: 'scatter', name: t(name), encode: { x: 0, y: 1 }, itemStyle: { color: palette.threat[j], opacity: 1 },
        data: groups.map(({ n }, i) => [share(values[i][j], n), i, values[i][j]]),
        symbolSize: (point) => point[2] ? 74 * Math.sqrt(point[2] / max) : 0,
      })),
      media: [{ query: { minWidth: 800 }, option: {
        grid: { left: 80, right: 40 }, xAxis: { axisLabel: { fontSize: 14 } }, yAxis: { axisLabel: { fontSize: 16 } },
        series: THREAT_LEVELS.map(() => ({ type: 'scatter',
        symbolSize: (point: number[]) => point[2] ? 110 * Math.sqrt(point[2] / max) : 0 })) } }],
    }),
  };
}
