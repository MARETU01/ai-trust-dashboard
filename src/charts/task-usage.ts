import { TASKS, count, percent, share, type SurveyStats } from '../survey.ts';
import type { Translate } from '../i18n.ts';
import type { ChartView } from '../chart-types.ts';
import { chartFont, palette } from '../chart-theme.ts';
import { chart, itemTable, tip } from './shared.ts';

export function usageRose({ taskUsage }: SurveyStats, t: Translate): ChartView {
  const order = taskUsage.map(({ n, counts }, i) => ({
    id: TASKS[i][0], name: t(TASKS[i][1]),
    label: t(TASKS[i][0] === 'task_deployment_and_monitoring' ? 'Deploy / monitor' : TASKS[i][2]),
    n, current: counts[0] + counts[1],
  })).sort((a, b) => (share(b.current, b.n) ?? -1) - (share(a.current, a.n) ?? -1));
  const max = Math.max(1, ...order.map(({ current, n }) => share(current, n) ?? 0));
  const low = Math.min(...order.map(({ n }) => n));
  const high = Math.max(...order.map(({ n }) => n));
  return {
    empty: !order.some(({ n }) => n),
    sample: t('Valid n by task · {range}', { range: `${count(low)}${low === high ? '' : `–${count(high)}`}` }),
    table: itemTable(t, 'Task', order.map(({ name }) => name), order.map(({ current }) => current), order.map(({ n }) => n)),
    option: chart({
      tooltip: { formatter: (params) => {
        if (Array.isArray(params)) return '';
        const item = order[params.dataIndex];
        return tip(t, item.name, [['Currently using AI', percent(share(item.current, item.n))], ['Valid task responses', count(item.n)]]);
      } },
      series: [{
        type: 'custom', coordinateSystem: 'none',
        data: order.map(({ id, n, current }, i) => ({ id, value: [share(current, n), i] })),
        renderItem: (params, api, opacity = 1) => {
          const item = order[params.dataIndex];
          const value = share(item.current, item.n);
          if (value == null) return;
          const width = api.getWidth();
          const height = api.getHeight();
          const cx = width / 2;
          const cy = height / 2;
          const outer = Math.max(1, Math.min(width / 2 - 112, height / 2 - 66));
          const inner = outer * 0.085;
          // Equal angles with area proportional to the actual task percentage.
          const radius = Math.sqrt(inner ** 2 + (outer ** 2 - inner ** 2) * value / max);
          const angle = 2 * Math.PI / order.length;
          const start = -Math.PI / 3 + params.dataIndex * angle;
          const middle = start + angle / 2;
          const x = Math.cos(middle);
          const y = Math.sin(middle);
          const fontSize = Math.max(12, Math.min(18, width / 70, height / 28));
          return {
            type: 'group', children: [
              { type: 'sector', shape: { cx, cy, r: radius, r0: inner, startAngle: start, endAngle: start + angle },
                style: { fill: palette.taskUsage[item.id], opacity } },
              { type: 'line', shape: { x1: cx + radius * Math.cos(start), y1: cy + radius * Math.sin(start),
                x2: cx + (outer + 16) * Math.cos(start), y2: cy + (outer + 16) * Math.sin(start) },
                style: { stroke: palette.guide, lineWidth: 1, opacity } },
              { type: 'text', style: {
                x: cx + (outer + 32) * x, y: cy + (outer + 32) * y,
                text: `${item.label}\n${percent(value)}`, fontFamily: chartFont, fontSize, lineHeight: fontSize + 3,
                align: x > 0.2 ? 'left' : x < -0.2 ? 'right' : 'center', verticalAlign: 'middle', fill: palette.muted, opacity,
              } },
            ],
          };
        },
      }],
    }),
  };
}
