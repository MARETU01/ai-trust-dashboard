import { AGE_GROUPS, AI_USE_GROUPS, count, percent, share } from '../survey.ts';
import type { Translate } from '../i18n.ts';
import type { EChartsOption, TooltipComponentOption } from 'echarts';
import type { ChartOption, LegendItem, Matrix, TooltipContent, TooltipLine } from '../chart-types.ts';
import { adoptionColors, chartFont, communityColors, contrastText, palette } from '../chart-theme.ts';

export const ageLabels = AGE_GROUPS.map(([, label]) => label);
export const aiIds = AI_USE_GROUPS.map(([id]) => id);
export const aiLabels = AI_USE_GROUPS.map(([, label]) => label);
export const trustLabels = ['Highly distrust', 'Somewhat distrust', 'Neutral', 'Somewhat trust', 'Highly trust'];
const noMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const htmlEntities: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => htmlEntities[char]);
export const valueAndN = (value: number, n: number) => n ? `${percent(share(value, n))} (${count(value)})` : '—';
export const responseLine = (t: Translate, value: number, n: number): TooltipLine =>
  [t('{value} of {total} valid responses', { value: count(value), total: count(n) }), percent(share(value, n))];

export function tip(t: Translate, title: string, rows: readonly TooltipLine[]) {
  const content = rows.map(([label, value]) =>
    `<div class="tip-line"><span>${escape(t(label))}</span><b>${escape(String(value))}</b></div>`);
  return `<div class="tooltip-content"><strong class="tip-title">${escape(t(title))}</strong>${content.join('')}</div>`;
}

export function chart({ tooltip, ...option }: ChartOption): ChartOption {
  return {
    animation: !noMotion,
    animationDuration: 320,
    animationDurationUpdate: 220,
    textStyle: { fontFamily: chartFont, color: palette.ink },
    tooltip: {
      trigger: 'item', triggerOn: 'mousemove|click', appendTo: 'body', enterable: false,
      showDelay: 0, hideDelay: 0, transitionDuration: 0, className: 'chart-tooltip',
      backgroundColor: 'transparent', padding: 0, borderWidth: 0, shadowBlur: 0, shadowColor: 'transparent',
      ...tooltip,
    },
    ...option,
  };
}

export const lineAxis = { show: true, lineStyle: { color: palette.grid } };
export const axisLabels = { color: palette.muted, fontSize: 12, hideOverlap: true };
type CartesianAxis = Extract<NonNullable<EChartsOption['xAxis']>, { type?: string }>;
type ValueAxis = Extract<CartesianAxis, { type?: 'value' }>;
export const valueAxis = (max = 100, extra: Omit<ValueAxis, 'type'> = {}): ValueAxis => ({
  type: 'value', min: 0, max, splitNumber: 5,
  axisLabel: { ...axisLabels, formatter: '{value}%' },
  splitLine: lineAxis, axisTick: { show: false }, axisLine: { show: false }, ...extra,
});

type AxisTooltip = { show: boolean; formatter: (params: { value: unknown }) => string };
type CategoryAxis = Extract<CartesianAxis, { type?: 'category' }> & { tooltip?: AxisTooltip };

export const categoryAxis = (data: string[], extra: Omit<CategoryAxis, 'type' | 'data'> = {}): CategoryAxis => ({
  type: 'category', data, axisLabel: { ...axisLabels, interval: 0 },
  axisTick: { show: false }, axisLine: { lineStyle: { color: palette.grid } },
  ...extra,
});

export function categoryHover(labels: readonly string[], describe: (index: number) => string, axis: 'x' | 'y' | 'angle' = 'y') {
  const describeLabel = (label: unknown) => {
    if (typeof label !== 'string') return '';
    const index = labels.indexOf(label);
    return index === -1 ? '' : describe(index);
  };
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        axis, type: axis === 'angle' ? 'line' : 'shadow',
        label: { show: false }, shadowStyle: { color: palette.hover },
      },
      formatter: (points) => {
        const point = Array.isArray(points) ? points[0] : points;
        return point && 'axisValueLabel' in point ? describeLabel(point.axisValueLabel) : '';
      },
    } satisfies TooltipComponentOption,
    axisTooltip: { show: true, formatter: ({ value }) => describeLabel(value) } satisfies AxisTooltip,
  };
}

export function matrixTip(t: Translate, title: string, value: number, n: number): TooltipContent {
  return {
    title,
    lines: [
      [t('Share'), percent(share(value, n))],
      [t('Responses'), count(value)],
      [t('Valid responses'), count(n)],
    ],
  };
}

export const itemTable = (t: Translate, label: string, names: readonly string[], values: number[], totals: number[]) => ({
  headers: [label, 'Share', 'Responses', 'Valid responses'].map((name) => t(name)),
  rows: names.map((name, i) => [name, percent(share(values[i], totals[i])), count(values[i]), count(totals[i])]),
});

export function matrixTable(t: Translate, label: string, names: readonly string[], headers: readonly string[], values: number[][], totals: number[][]) {
  return {
    headers: [label, ...headers].map((name) => t(name)),
    rows: names.map((name, i) => [name, ...values[i].map((val, j) => valueAndN(val, totals[i][j]))]),
  };
}

export function mix(a: string, b: string, value: number) {
  const channels = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const from = channels(a);
  const to = channels(b);
  const amount = Math.max(0, Math.min(1, value));
  return `#${from.map((start, i) => Math.round(start + (to[i] - start) * amount).toString(16).padStart(2, '0')).join('')}`;
}

export function heatColor(value: number | null, diverging = false) {
  if (value == null) return palette.missing;
  if (diverging) {
    const { low, middle, high } = communityColors;
    return value <= 50 ? mix(low, middle, value / 50) : mix(middle, high, (value - 50) / 50);
  }
  const { min, max, steps } = adoptionColors;
  const index = Math.max(0, Math.min(steps.length - 1, Math.floor((value - min) / (max - min) * steps.length)));
  return steps[index];
}

export function heatmap(t: Translate, headers: readonly string[], names: readonly string[], values: number[][], totals: number[][],
  { diverging = false, labels = 'all', label }: { diverging?: boolean; labels?: 'all' | 'row-extrema'; label: string }) {
  const rows: Matrix['rows'] = names.map((name, i) => {
    const percentages = values[i].map((value, j) => share(value, totals[i][j]));
    let minColumn = -1;
    let maxColumn = -1;
    percentages.forEach((pct, column) => {
      if (pct == null) return;
      // Label the first occurrence of a tie; missing groups are not extrema.
      if (minColumn === -1 || pct < percentages[minColumn]!) minColumn = column;
      if (maxColumn === -1 || pct > percentages[maxColumn]!) maxColumn = column;
    });
    return {
      name,
      cells: values[i].map((value, j) => {
        const n = totals[i][j];
        const pct = percentages[j];
        const fill = heatColor(pct, diverging);
        return {
          value: percent(pct),
          showValue: labels === 'all' || j === minColumn || j === maxColumn,
          selectable: n > 0,
          tooltip: matrixTip(t, `${name} · ${headers[j]}`, value, n),
          style: { '--cell-fill': fill, '--cell-text': contrastText(fill) },
        };
      }),
    };
  });
  return { matrix: { headers, rows, label: t(label) }, table: matrixTable(t, 'Group', names, headers, values, totals) };
}

export function colorLegend(t: Translate, names: readonly string[], colors: readonly string[]): LegendItem[] {
  return names.map((name, i) => [t(name), colors[i], name]);
}
