import { TASKS, TASK_STATES, count, percent, share, type SurveyStats } from '../survey.ts';
import { translations, type Translate } from '../i18n.ts';
import type { ChartView, TooltipLine } from '../chart-types.ts';
import { contrastText, palette } from '../chart-theme.ts';
import { valueAndN, tip, chart, lineAxis, valueAxis, categoryAxis, categoryHover, itemTable, matrixTable, colorLegend } from './shared.ts';

export function tasksStack({ tasks }: SurveyStats, t: Translate): ChartView {
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
        label: { show: true, position: 'inside', color: contrastText(palette.tasks[i]), fontSize: 11, formatter: ({ value }) => typeof value === 'number' && value >= 9 ? percent(value) : '' },
      })),
    }),
  };
}

function taskSample(t: Translate, totals: number[]) {
  const low = Math.min(...totals);
  const high = Math.max(...totals);
  return t('Valid n by task · {range}', { range: `${count(low)}${low === high ? '' : `–${count(high)}`}` });
}

export function usageRose({ tasks }: SurveyStats, t: Translate): ChartView {
  const order = tasks.map(({ n, counts }, i) => ({
    id: TASKS[i][0], name: t(TASKS[i][1]), label: t(TASKS[i][2]), n, current: counts[0] + counts[1],
  })).sort((a, b) => (share(b.current, b.n) ?? -1) - (share(a.current, a.n) ?? -1));
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
        axisLabel: { color: palette.muted, fontSize: 11, interval: 0, margin: 12 },
        axisTick: { show: false }, axisLine: { show: false }, splitLine: { show: true, lineStyle: { color: palette.grid } },
      },
      radiusAxis: {
        type: 'value', min: 0, max: 100, interval: 25, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { show: false }, splitLine: lineAxis,
      },
      tooltip,
      series: [{
        type: 'bar', coordinateSystem: 'polar', roundCap: false,
        data: order.map(({ id, n, current }) => ({ id, value: share(current, n), itemStyle: { color: palette.taskUsage[id], opacity: 1 } })),
      }],
    }),
  };
}
