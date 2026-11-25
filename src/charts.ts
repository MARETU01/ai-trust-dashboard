import {
  AGE_GROUPS, AI_USE_GROUPS, COMPLEX_RATINGS, EXPERIENCE_GROUPS, MODELS, SENTIMENTS,
  TASKS, TASK_STATES, THREAT_LEVELS, TRUST_LEVELS, count, percent, share,
  type SurveyStats,
} from './survey.ts';
import { translations, type Translate } from './i18n.ts';
import type { EChartsOption, TooltipComponentOption } from 'echarts';
import type { ChartOption, ChartSeries, ChartView, LegendItem, Matrix, TooltipContent, TooltipLine } from './chart-types.ts';
import { chartFont, communityColors, palette } from './chart-theme.ts';

const ageLabels = AGE_GROUPS.map(([, label]) => label);
const aiIds = AI_USE_GROUPS.map(([id]) => id);
const aiLabels = AI_USE_GROUPS.map(([, label]) => label);
const trustLabels = ['Highly distrust', 'Somewhat distrust', 'Neutral', 'Somewhat trust', 'Highly trust'];
const noMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const htmlEntities: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => htmlEntities[char]);
const valueAndN = (value: number, n: number) => n ? `${percent(share(value, n))} (${count(value)})` : '—';
const responseLine = (t: Translate, value: number, n: number): TooltipLine =>
  [t('{value} of {total} valid responses', { value: count(value), total: count(n) }), percent(share(value, n))];

function tip(t: Translate, title: string, rows: readonly TooltipLine[]) {
  const content = rows.map(([label, value]) =>
    `<div class="tip-line"><span>${escape(t(label))}</span><b>${escape(String(value))}</b></div>`);
  return `<div class="tooltip-content"><strong class="tip-title">${escape(t(title))}</strong>${content.join('')}</div>`;
}

function chart({ tooltip, ...option }: ChartOption): ChartOption {
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

const lineAxis = { show: true, lineStyle: { color: palette.grid } };
const axisLabels = { color: palette.muted, fontSize: 11, hideOverlap: true };
type CartesianAxis = Extract<NonNullable<EChartsOption['xAxis']>, { type?: string }>;
type ValueAxis = Extract<CartesianAxis, { type?: 'value' }>;
const valueAxis = (max = 100, extra: Omit<ValueAxis, 'type'> = {}): ValueAxis => ({
  type: 'value', min: 0, max, splitNumber: 5,
  axisLabel: { ...axisLabels, formatter: '{value}%' },
  splitLine: lineAxis, axisTick: { show: false }, axisLine: { show: false }, ...extra,
});

type AxisTooltip = { show: boolean; formatter: (params: { value: unknown }) => string };
type CategoryAxis = Extract<CartesianAxis, { type?: 'category' }> & { tooltip?: AxisTooltip };

const categoryAxis = (data: string[], extra: Omit<CategoryAxis, 'type' | 'data'> = {}): CategoryAxis => ({
  type: 'category', data, axisLabel: { ...axisLabels, interval: 0 },
  axisTick: { show: false }, axisLine: { lineStyle: { color: palette.grid } },
  ...extra,
});

function categoryHover(labels: readonly string[], describe: (index: number) => string, axis: 'x' | 'y' | 'angle' = 'y') {
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
        label: { show: false }, shadowStyle: { color: '#6854a014' },
      },
      formatter: (points) => {
        const point = Array.isArray(points) ? points[0] : points;
        return point && 'axisValueLabel' in point ? describeLabel(point.axisValueLabel) : '';
      },
    } satisfies TooltipComponentOption,
    axisTooltip: { show: true, formatter: ({ value }) => describeLabel(value) } satisfies AxisTooltip,
  };
}

function matrixTip(t: Translate, title: string, value: number, n: number): TooltipContent {
  return {
    title,
    lines: [
      [t('Share'), percent(share(value, n))],
      [t('Responses'), count(value)],
      [t('Valid responses'), count(n)],
    ],
  };
}

const itemTable = (t: Translate, label: string, names: readonly string[], values: number[], totals: number[]) => ({
  headers: [label, 'Share', 'Responses', 'Valid responses'].map((name) => t(name)),
  rows: names.map((name, i) => [name, percent(share(values[i], totals[i])), count(values[i]), count(totals[i])]),
});

function matrixTable(t: Translate, label: string, names: readonly string[], headers: readonly string[], values: number[][], totals: number[][]) {
  return {
    headers: [label, ...headers].map((name) => t(name)),
    rows: names.map((name, i) => [name, ...values[i].map((val, j) => valueAndN(val, totals[i][j]))]),
  };
}

function mix(a: string, b: string, value: number) {
  const channels = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const from = channels(a);
  const to = channels(b);
  return `rgb(${from.map((start, i) => Math.round(start + (to[i] - start) * value)).join(',')})`;
}

function heatColor(value: number | null, diverging = false) {
  if (value == null) return '#f4f2f8';
  if (diverging) {
    const { low, middle, high } = communityColors;
    return value <= 50 ? mix(low, middle, value / 50) : mix(middle, high, (value - 50) / 50);
  }
  return mix('#f1edf9', '#59438d', Math.min(value / 60, 1));
}

function heatmap(t: Translate, headers: readonly string[], names: readonly string[], values: number[][], totals: number[][],
  { diverging = false, label }: { diverging?: boolean; label: string }) {
  const rows: Matrix['rows'] = names.map((name, i) => ({
    name,
    cells: values[i].map((value, j) => {
      const n = totals[i][j];
      const pct = share(value, n);
      return {
        value: percent(pct),
        selectable: n > 0,
        tooltip: matrixTip(t, `${name} · ${headers[j]}`, value, n),
        style: { '--cell-fill': heatColor(pct, diverging), '--cell-text': !diverging && (pct ?? 0) >= 45 ? '#fff' : palette.ink },
      };
    }),
  }));
  return { matrix: { headers, rows, label: t(label) }, table: matrixTable(t, 'Group', names, headers, values, totals) };
}

function colorLegend(t: Translate, names: readonly string[], colors: readonly string[]): LegendItem[] {
  return names.map((name, i) => [t(name), colors[i], name]);
}

function ageDistribution({ demographics }: SurveyStats, t: Translate): ChartView {
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

function adoption({ adoption: groups }: SurveyStats, t: Translate): ChartView {
  const values = aiIds.map((id) => groups.map((group) => group.counts[id]));
  const totals = aiIds.map(() => groups.map((group) => group.n));
  return {
    ...heatmap(t, ageLabels, aiLabels.map((name) => t(name)), values, totals, { label: 'AI use by age group' }),
    n: groups.reduce((sum, group) => sum + group.n, 0),
    scale: { low: heatColor(0), high: heatColor(60), end: '60%+' },
  };
}

function trustAcrossAge({ ageTrust: groups }: SurveyStats, t: Translate): ChartView {
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

function experienceLearning({ learning }: SurveyStats, t: Translate): ChartView {
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

function technologyRankings(data: SurveyStats['languages'], t: Translate, dots = false): ChartView {
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
        itemStyle: { color: dots ? '#55b49a' : palette.purple, opacity: 1, borderRadius: [0, 5, 5, 0] },
        symbol: 'circle', symbolSize: 13, barMaxWidth: 15,
        label: { show: true, position: 'right', formatter: ({ dataIndex }) => percent(percentages[dataIndex]), color: palette.muted, fontSize: 10 },
      }],
    }),
  };
}

function communityUse({ community }: SurveyStats, t: Translate): ChartView {
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

export const modelHighlightGroups = ['Used in the past year', 'Wanted in the next year'];
export const modelLinksGroup = 'Model links';

function modelSankey({ modelPairs, modelN }: SurveyStats, t: Translate): ChartView {
  const labels = MODELS.map(([, name]) => t(name));
  const links = modelPairs.flatMap((counts, source) => counts.flatMap((value, target) => value ? [{
    id: `link-${source}-${target}`, source: `used${source}`, target: `wanted${target}`,
    value, sourceIndex: source, targetIndex: target,
  }] : []));
  const data = ['used', 'wanted'].flatMap((prefix, depth) => labels.flatMap((name, i) => {
    const values = depth === 0 ? modelPairs[i] : modelPairs.map((row) => row[i]);
    const value = values.reduce((sum, count) => sum + count, 0);
    return value ? [{
      name: `${prefix}${i}`, labelText: name, depth, value, itemStyle: { color: palette.models[i] },
    }] : [];
  }));
  const highlightChoices = [
    ...data.map(({ name, labelText, depth }) => ({ value: name, label: labelText, group: modelHighlightGroups[depth] })),
    ...links.map(({ id, sourceIndex, targetIndex }) => ({
      value: id, label: `${labels[sourceIndex]} → ${labels[targetIndex]}`, group: modelLinksGroup,
    })),
  ];
  const fadedLabelOpacity = 0.1;
  function highlightSeries(selection: readonly string[]): ChartSeries[] {
    const selected = new Set(selection);
    const outlined = new Set(selection);
    const connected = new Set(selection);
    const styledLinks = links.map((link) => {
      const selectedLink = selected.has(link.id);
      const active = selectedLink || selected.has(link.source) || selected.has(link.target);
      if (selectedLink) {
        outlined.add(link.source);
        outlined.add(link.target);
      }
      if (active) {
        connected.add(link.source);
        connected.add(link.target);
      }
      return { ...link, lineStyle: { opacity: selected.size ? (active ? 0.68 : 0.08) : 0.32 } };
    });
    return [{
      type: 'sankey', left: 2, right: 2, top: 5, bottom: 7, draggable: false,
      nodeAlign: 'justify', nodeGap: 8, nodeWidth: 88, layoutIterations: 0,
      data: data.map((node) => {
        const muted = selected.size > 0 && !connected.has(node.name);
        return {
          ...node,
          itemStyle: {
            ...node.itemStyle, opacity: muted ? 0.24 : 1,
            borderColor: palette.ink, borderWidth: outlined.has(node.name) ? 2 : 0,
          },
          label: { opacity: muted ? fadedLabelOpacity : 1 },
        };
      }),
      links: styledLinks,
      emphasis: { focus: 'adjacency', disabled: selected.size > 0 },
      lineStyle: { color: 'source', curveness: 0.48 },
      blur: { itemStyle: { opacity: 0.36 }, lineStyle: { opacity: 0.12 }, label: { opacity: fadedLabelOpacity } },
      label: { position: 'inside', formatter: ({ data }) => typeof data === 'object' && data && 'labelText' in data
        ? String(data.labelText) : '', color: '#231b35', fontSize: 11, fontWeight: 600, width: 82, overflow: 'break' },
    }];
  }
  return {
    n: modelN, nLabel: 'answered both model questions',
    highlightChoices, highlightSeries,
    table: { headers: [t('Used / wanted'), ...labels], rows: labels.map((name, i) => [name, ...modelPairs[i].map(count)]) },
    option: chart({
      tooltip: { formatter: (params) => {
        if (Array.isArray(params)) return '';
        const { data, dataType, value } = params;
        if (typeof data !== 'object' || !data || typeof value !== 'number') return '';
        if (dataType === 'edge' && 'sourceIndex' in data && typeof data.sourceIndex === 'number'
          && 'targetIndex' in data && typeof data.targetIndex === 'number') {
          return tip(t, 'Model co-selection', [
            [modelHighlightGroups[0], labels[data.sourceIndex]], [modelHighlightGroups[1], labels[data.targetIndex]],
            ['Respondents selecting both', count(value)],
          ]);
        }
        if ('labelText' in data && typeof data.labelText === 'string' && 'depth' in data && typeof data.depth === 'number') {
          return tip(t, data.labelText, [
            ['Model group', t(modelHighlightGroups[data.depth])],
            ['Pair selections across links', count(value)],
          ]);
        }
        return '';
      } },
      series: highlightSeries([]),
    }),
  };
}

function tasksStack({ tasks }: SurveyStats, t: Translate): ChartView {
  const names = TASKS.map(([, name]) => t(name));
  const values = tasks.map(({ counts }) => counts);
  const totals = tasks.map(({ n }) => n);
  const table = matrixTable(t, 'Task', names, TASK_STATES, values, totals.map((n) => TASK_STATES.map(() => n)));
  const { tooltip, axisTooltip } = categoryHover(names, (i) => tip(t, names[i], [
    ...TASK_STATES.map((label, j): TooltipLine => [label, valueAndN(values[i][j], totals[i])]),
    ['Valid task responses', count(totals[i])],
  ]));
  const highlightChoices = TASK_STATES.flatMap((value, i) => values.some((row) => row[i] > 0) ? [{ value, label: t(value) }] : []);
  return {
    empty: !tasks.some(({ n }) => n),
    sample: taskSample(t, totals),
    legend: colorLegend(t, TASK_STATES, palette.tasks),
    highlightChoices,
    table: {
      headers: [...table.headers, t('Valid responses')],
      rows: table.rows.map((row, i) => [...row, count(totals[i])]),
    },
    option: chart({
      grid: { top: 8, right: 25, bottom: 27, left: t === translations.en ? 192 : 106 },
      xAxis: valueAxis(), yAxis: categoryAxis(names, { inverse: true, axisLine: { show: false }, tooltip: axisTooltip }),
      tooltip,
      series: TASK_STATES.map((name, i) => ({
        type: 'bar', name: t(name), selectionGroup: name, stack: 'status', barMaxWidth: 19,
        itemStyle: { color: palette.tasks[i] },
        data: tasks.map(({ n, counts }) => share(counts[i], n)),
        label: { show: true, position: 'inside', color: '#25213c', fontSize: 10, formatter: ({ value }) => typeof value === 'number' && value >= 9 ? percent(value) : '' },
      })),
    }),
  };
}

function complexTasks({ complexity }: SurveyStats, t: Translate): ChartView {
  const groups = [...complexity].reverse();
  const labels = aiLabels.slice(0, 3).reverse().map((name) => t(name));
  const values = groups.map(({ counts }) => COMPLEX_RATINGS.map((name) => counts[name]));
  const totals = groups.map(({ n }) => COMPLEX_RATINGS.map(() => n));
  const { tooltip, axisTooltip } = categoryHover(labels, (i) => tip(t, labels[i], [
    ...COMPLEX_RATINGS.map((label, j): TooltipLine => [label, valueAndN(values[i][j], groups[i].n)]),
    ['Valid responses', count(groups[i].n)],
  ]), 'x');
  return {
    n: groups.reduce((sum, { n }) => sum + n, 0),
    legend: colorLegend(t, COMPLEX_RATINGS, palette.complex),
    table: matrixTable(t, 'AI use', labels, COMPLEX_RATINGS, values, totals),
    option: chart({
      grid: { top: 9, right: 22, bottom: 29, left: 44 },
      xAxis: categoryAxis(labels, { boundaryGap: true, tooltip: axisTooltip }), yAxis: valueAxis(),
      tooltip,
      series: COMPLEX_RATINGS.map((name, i) => ({
        type: 'line', name: t(name), symbol: 'circle', symbolSize: 7,
        itemStyle: { color: palette.complex[i] }, lineStyle: { width: 2.5 },
        data: groups.map(({ n }, index) => share(values[index][i], n)),
      })),
    }),
  };
}

function sentimentDumbbell({ sentimentTrust }: SurveyStats, t: Translate): ChartView {
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
      xAxis: valueAxis(), yAxis: categoryAxis(labels, { inverse: true, axisLine: { show: false }, tooltip: axisTooltip }),
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
          return {
            type: 'group', children: [
              { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: '#bcb2ce', lineWidth: 3, opacity } },
              ...[a, b].map(([cx, cy], i) => ({ type: 'circle' as const, shape: { cx, cy, r: 5.5 }, style: { fill: colors[i], opacity } })),
            ],
          };
        },
      }],
    }),
  };
}

function ageThreat({ jobThreat: groups }: SurveyStats, t: Translate): ChartView {
  const values = groups.map(({ counts }) => THREAT_LEVELS.map((name) => counts[name]));
  const totals = groups.map(({ n }) => THREAT_LEVELS.map(() => n));
  const max = Math.max(1, ...values.flat());
  const { tooltip, axisTooltip } = categoryHover(ageLabels, (i) => tip(t, t('Ages {group}', { group: ageLabels[i] }), [
    ...THREAT_LEVELS.map((label, j): TooltipLine => [label, valueAndN(values[i][j], groups[i].n)]),
    ['Valid responses', count(groups[i].n)],
  ]));
  return {
    n: groups.reduce((sum, { n }) => sum + n, 0),
    legend: colorLegend(t, THREAT_LEVELS, palette.threat),
    table: matrixTable(t, 'Age group', ageLabels, THREAT_LEVELS, values, totals),
    option: chart({
      grid: { top: 9, right: 25, bottom: 30, left: 55 },
      xAxis: valueAxis(), yAxis: categoryAxis(ageLabels, { inverse: true, tooltip: axisTooltip }),
      tooltip,
      series: THREAT_LEVELS.map((name, j) => ({
        type: 'scatter', name: t(name), encode: { x: 0, y: 1 }, itemStyle: { color: palette.threat[j], opacity: 0.69 },
        data: groups.map(({ n }, i) => [share(values[i][j], n), i, values[i][j]]),
        symbolSize: (point) => point[2] ? 6 + 39 * Math.sqrt(point[2] / max) : 0,
      })),
    }),
  };
}

function taskSample(t: Translate, totals: number[]) {
  const low = Math.min(...totals);
  const high = Math.max(...totals);
  return t('Valid n by task · {range}', { range: `${count(low)}${low === high ? '' : `–${count(high)}`}` });
}

function usageRose({ tasks }: SurveyStats, t: Translate): ChartView {
  const order = tasks.map(({ n, counts }, i) => ({
    id: TASKS[i][0], name: t(TASKS[i][1]), label: t(TASKS[i][2]), n, current: counts[0] + counts[1],
  })).sort((a, b) => (share(b.current, b.n) ?? -1) - (share(a.current, a.n) ?? -1));
  const colors = [...palette.ages, ...palette.tasks, palette.pink, palette.purple];
  const labels = order.map(({ label }) => label);
  const { tooltip, axisTooltip } = categoryHover(labels, (i) => {
    const { name, n, current } = order[i];
    return tip(t, name, [['Currently using AI', percent(share(current, n))], ['Valid task responses', count(n)]]);
  }, 'angle');
  return {
    empty: !order.some(({ n }) => n),
    sample: taskSample(t, order.map(({ n }) => n)),
    table: itemTable(t, 'Task', order.map(({ name }) => name), order.map(({ current }) => current), order.map(({ n }) => n)),
    option: chart({
      polar: { radius: '65%', center: ['50%', '51%'] },
      angleAxis: {
        type: 'category', data: labels, startAngle: 90, tooltip: axisTooltip,
        axisLabel: { color: palette.muted, fontSize: 10, interval: 0, margin: 12 },
        axisTick: { show: false }, axisLine: { show: false }, splitLine: { show: true, lineStyle: { color: palette.grid } },
      },
      radiusAxis: {
        type: 'value', min: 0, max: 100, interval: 25, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { show: false }, splitLine: lineAxis,
      },
      tooltip,
      series: [{
        type: 'bar', coordinateSystem: 'polar', roundCap: false,
        data: order.map(({ id, n, current }, i) => ({ id, value: share(current, n), itemStyle: { color: colors[i], opacity: 0.9 } })),
      }],
    }),
  };
}

export const makeChart = {
  ages: ageDistribution, adoption, trust: trustAcrossAge, learning: experienceLearning,
  languages: (stats, t) => technologyRankings(stats.languages, t),
  databases: (stats, t) => technologyRankings(stats.databases, t, true),
  community: communityUse, models: modelSankey, taskStatus: tasksStack,
  complex: complexTasks, sentiment: sentimentDumbbell, threat: ageThreat, taskUsage: usageRose,
} satisfies Record<string, (stats: SurveyStats, t: Translate) => ChartView>;
