import { TASKS, TASK_STATES, count, percent, share, type SurveyStats } from '../survey.ts';
import { translations, type Translate } from '../i18n.ts';
import type { ChartView, TooltipLine } from '../chart-types.ts';
import { chartFont, palette } from '../chart-theme.ts';
import { valueAndN, tip, chart, valueAxis, categoryAxis, categoryHover, matrixTable, colorLegend } from './shared.ts';

export function tasksStack({ tasks }: SurveyStats, t: Translate): ChartView {
  const orderedTasks = tasks.map((task, i) => ({
    ...task,
    name: TASKS[i][0] === 'task_maintaining_documentation' ? 'Creating or maintaining documentation' : TASKS[i][1],
  })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const names = orderedTasks.map(({ name }) => t(name));
  const values = orderedTasks.map(({ counts }) => counts);
  const totals = orderedTasks.map(({ n }) => n);
  const table = matrixTable(t, 'Task', names, TASK_STATES, values, totals.map((n) => TASK_STATES.map(() => n)));
  const { tooltip, axisTooltip } = categoryHover(names, (i) => tip(t, names[i], [
    ...TASK_STATES.map((label, j): TooltipLine => [label, valueAndN(values[i][j], totals[i])]),
    ['Valid task responses', count(totals[i])],
  ]));
  const highlightChoices = TASK_STATES.flatMap((value, i) => values.some((row) => row[i] > 0) ? [{ value, label: t(value) }] : []);
  return {
    empty: !tasks.some(({ n }) => n),
    sample: taskSample(t, totals),
    legend: colorLegend(t, TASK_STATES, palette.tasks).reverse(),
    highlightChoices,
    table: {
      headers: [...table.headers, t('Valid responses')],
      rows: table.rows.map((row, i) => [...row, count(totals[i])]),
    },
    option: chart({
      grid: { top: 8, right: 25, bottom: 27, left: t === translations.en ? 228 : 106 },
      xAxis: valueAxis(), yAxis: categoryAxis(names, { inverse: true, axisLine: { show: false }, tooltip: axisTooltip }),
      tooltip,
      series: TASK_STATES.map((name, i) => ({
        type: 'bar', name: t(name), selectionGroup: name, stack: 'status', barMaxWidth: 19,
        itemStyle: { color: palette.tasks[i] },
        data: orderedTasks.map(({ n, counts }) => share(counts[i], n)),
        label: { show: true, position: 'inside', color: '#555555', fontFamily: chartFont, fontSize: 12, fontWeight: 400,
          formatter: ({ value }) => typeof value === 'number' && value >= 15 ? percent(value) : '' },
      })),
      media: [{ query: { minWidth: 800 }, option: {
        grid: { left: t === translations.en ? 310 : 140 },
        xAxis: { axisLabel: { fontSize: 14 } }, yAxis: { axisLabel: { fontSize: 16 } },
        series: TASK_STATES.map(() => ({ type: 'bar', barMaxWidth: 32, label: { fontSize: 18 } })),
      } }],
    }),
  };
}

function taskSample(t: Translate, totals: number[]) {
  const low = Math.min(...totals);
  const high = Math.max(...totals);
  return t('Valid n by task · {range}', { range: `${count(low)}${low === high ? '' : `–${count(high)}`}` });
}
