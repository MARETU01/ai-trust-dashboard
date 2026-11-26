import { percent, share, type SurveyStats } from '../survey.ts';
import type { Translate } from '../i18n.ts';
import type { ChartView } from '../chart-types.ts';
import { communityColors, palette } from '../chart-theme.ts';
import { aiLabels, responseLine, tip, chart, valueAxis, categoryAxis, categoryHover, itemTable, heatmap } from './shared.ts';

export function technologyRankings(data: SurveyStats['languages'], t: Translate, dots = false): ChartView {
  const { n, items } = data;
  const names = items.map(({ name }) => name);
  const values = items.map(({ count }) => count);
  const percentages = values.map((value) => share(value, n));
  const scale = Math.min(100, Math.max(20, Math.ceil(Math.max(0, ...percentages.map((value) => value ?? 0)) / 10) * 10));
  const { tooltip, axisTooltip } = categoryHover(names, (i) => tip(t, names[i], [responseLine(t, values[i], n)]));
  return {
    n, table: itemTable(t, dots ? 'Database' : 'Language', names, values, values.map(() => n)),
    option: chart({
      grid: { top: 6, right: 51, bottom: 29, left: dots ? 126 : 81 },
      xAxis: valueAxis(scale), yAxis: categoryAxis(names, { inverse: true, axisLine: { show: false }, tooltip: axisTooltip }),
      tooltip,
      series: [{
        type: dots ? 'scatter' : 'bar',
        data: dots ? percentages.map((value, i) => [value, i]) : percentages,
        itemStyle: { color: dots ? palette.databases : palette.languages, opacity: 1, borderRadius: 0 },
        symbol: 'circle', symbolSize: dots ? (point) => 26 * Math.sqrt(Math.max(0, point[0] ?? 0) / scale) : 13, barMaxWidth: 15,
        label: { show: true, position: 'right', formatter: ({ dataIndex }) => percent(percentages[dataIndex]), color: palette.muted, fontSize: 11 },
      }],
    }),
  };
}

export function communityUse({ community }: SurveyStats, t: Translate): ChartView {
  const names = community[0].items.map(({ name }) => t(name));
  const values = names.map((_, i) => community.map(({ items }) => items[i].count));
  const totals = names.map(() => community.map(({ n }) => n));
  const labels = aiLabels.map((label) => t(label === 'Infrequent' ? 'Less often' : label));
  return {
    ...heatmap(t, labels, names, values, totals, { diverging: true, label: 'Community use by AI use and intent' }),
    n: community.reduce((sum, { n }) => sum + n, 0),
    scale: { ...communityColors, end: '100%' },
  };
}
