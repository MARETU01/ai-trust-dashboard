import { AGE_GROUPS, EXPERIENCE_GROUPS, TRUST_LEVELS, count, percent, share, type SurveyStats } from '../survey.ts';
import type { Translate } from '../i18n.ts';
import type { ChartView, Matrix, TooltipLine } from '../chart-types.ts';
import { adoptionColors, learningColors, palette } from '../chart-theme.ts';
import { ageLabels, aiIds, aiLabels, trustLabels, valueAndN, responseLine, tip, chart, valueAxis, categoryAxis, categoryHover, matrixTip, itemTable, matrixTable, mix, heatColor, heatmap, colorLegend } from './shared.ts';

export function ageDistribution({ demographics }: SurveyStats, t: Translate): ChartView {
  const values = AGE_GROUPS.map(([id]) => demographics.counts[id]);
  const n = demographics.n;
  return {
    empty: !n, n, nLabel: 'reported age',
    legend: colorLegend(t, ageLabels, palette.ages),
    table: itemTable(t, 'Age group', ageLabels, values, values.map(() => n)),
    option: chart({
      color: palette.ages,
      tooltip: { formatter: (params) => !Array.isArray(params) && typeof params.value === 'number'
        ? tip(t, params.name, [responseLine(t, params.value, n)]) : '' },
      series: [{
        type: 'pie', radius: ['42%', '76%'], center: ['50%', '50%'], stillShowZeroSum: false,
        itemStyle: { borderColor: palette.paper, borderWidth: 1, borderRadius: 0 },
        label: { show: true, formatter: ({ value }) => percent(typeof value === 'number' ? share(value, n) : null), color: palette.ink, fontSize: 13 },
        labelLine: { show: false },
        data: ageLabels.flatMap((name, i) => values[i] ? [{ id: `age-${i}`, name, value: values[i], itemStyle: { color: palette.ages[i] } }] : []),
      }],
      media: [{ query: { minWidth: 800 }, option: { series: [{ type: 'pie', label: { fontSize: 20 } }] } }],
    }),
  };
}

export function adoption({ adoption: groups }: SurveyStats, t: Translate): ChartView {
  const values = aiIds.map((id) => groups.map((group) => group.counts[id]));
  const totals = aiIds.map(() => groups.map((group) => group.n));
  return {
    ...heatmap(t, ageLabels, aiLabels.map((name) => t(name)), values, totals, { label: 'AI use by age group' }),
    n: groups.reduce((sum, group) => sum + group.n, 0),
    scale: {
      low: heatColor(0), high: heatColor(100), colors: adoptionColors.steps,
      start: `${adoptionColors.min}%`, end: `${adoptionColors.max}%+`,
    },
  };
}

export function trustAcrossAge({ ageTrust: groups }: SurveyStats, t: Translate): ChartView {
  const values = groups.map(({ counts }) => TRUST_LEVELS.map((level) => counts[level]));
  const totals = groups.map((group) => TRUST_LEVELS.map(() => group.n));
  const legend = colorLegend(t, trustLabels, palette.trust);
  const portions = [[1, -1], [0, -1], [2, -0.5], [2, 0.5], [3, 1], [4, 1]];
  const left = Math.max(65, ...values.map((row, i) => 5 * Math.ceil((share(row[0] + row[1] + row[2] / 2, groups[i].n) ?? 0) / 5)));
  const right = Math.max(60, ...values.map((row, i) => 5 * Math.ceil((share(row[3] + row[4] + row[2] / 2, groups[i].n) ?? 0) / 5)));
  const { tooltip, axisTooltip } = categoryHover(ageLabels, (i) => tip(t, t('Ages {group}', { group: ageLabels[i] }), [
    ...trustLabels.map((label, j): TooltipLine => [label, valueAndN(values[i][j], groups[i].n)]),
    ['Valid responses', count(groups[i].n)],
  ]));
  return {
    n: groups.reduce((sum, group) => sum + group.n, 0),
    legend, table: matrixTable(t, 'Age group', ageLabels, trustLabels, values, totals),
    option: chart({
      grid: { top: 9, right: 42, bottom: 27, left: 60 },
      xAxis: valueAxis(right, { min: -left, interval: 20, axisLabel: { show: false },
        name: `${t('Distrust')}     ${t('Neutral')}     ${t('Trust')}`, nameLocation: 'middle', nameGap: 10 }),
      yAxis: categoryAxis(ageLabels, { inverse: true, axisLine: { show: false }, tooltip: axisTooltip }),
      tooltip,
      series: [
        portions[2], portions[0], portions[1], portions[3], portions[4], portions[5],
      ].map(([status, sign], index) => ({
        type: 'bar', name: t(trustLabels[status]), stack: 'trust', barMaxWidth: 23,
        itemStyle: { color: palette.trust[status], borderColor: palette.paper, borderWidth: 0.5 },
        data: groups.map(({ n }, index) => n ? sign * (share(values[index][status], n) ?? 0) : null),
        label: { show: status === 0 || status === 4, position: status === 0 ? 'insideLeft' : 'right',
          color: palette.ink, fontSize: 12, formatter: ({ value }) => typeof value === 'number' ? percent(Math.abs(value)) : '' },
        ...(index === 0 ? { markLine: { silent: true, symbol: 'none', label: { show: false },
          lineStyle: { color: palette.centerLine, width: 2, type: 'dashed' }, data: [{ xAxis: 0 }] } } : {}),
      })),
      media: [{ query: { minWidth: 800 }, option: {
        yAxis: { axisLabel: { fontSize: 16 } }, xAxis: { nameTextStyle: { fontSize: 18 } },
        series: portions.map(() => ({ type: 'bar', barMaxWidth: 40, label: { fontSize: 18 } })),
      } }],
    }),
  };
}

export function experienceLearning({ learning }: SurveyStats, t: Translate): ChartView {
  const groups = aiLabels.slice(0, 3).map((name) => t(name));
  const experienceLabels = EXPERIENCE_GROUPS.map((name) => t(name));
  const totals = learning.map((row) => row.map(({ n }) => n));
  const respondentTotal = learning.flat().reduce((sum, { respondents }) => sum + respondents, 0);
  const validTotal = totals.flat().reduce((sum, n) => sum + n, 0);
  const max = Math.max(1, ...learning.flat().map(({ respondents }) => respondents));
  const matrix: Matrix = {
    headers: experienceLabels,
    label: t('AI learning rate by work experience'),
    rows: groups.map((name, i) => ({
      name,
      cells: learning[i].map(({ yes, n, respondents }, j) => {
        const pct = share(yes, n);
        const tooltip = matrixTip(t, `${name} · ${experienceLabels[j]}`, yes, n);
        return {
          value: percent(pct),
          selectable: respondents > 0,
          className: 'bubble-cell',
          tooltip: { ...tooltip, lines: [...tooltip.lines, [t('Respondents in group'), count(respondents)]] },
          bubble: respondents ? {
            '--bubble': String(Math.sqrt(respondents / max)),
            '--bubble-fill': pct == null ? palette.missing : mix(learningColors.low, learningColors.high,
              (pct - learningColors.min) / (learningColors.max - learningColors.min)),
          } : undefined,
        };
      }),
    })),
  };
  return {
    matrix, n: respondentTotal,
    sample: t('Group n = {total} · valid AI-learning n = {valid}', { total: count(respondentTotal), valid: count(validTotal) }),
    table: {
      headers: ['AI use', 'Work experience', 'Share', 'Responses', 'Valid AI-learning responses', 'Respondents in group'].map((label) => t(label)),
      rows: learning.flatMap((row, i) => row.map(({ yes, n, respondents }, j) => [
        groups[i], experienceLabels[j], percent(share(yes, n)), count(yes), count(n), count(respondents),
      ])),
    },
  };
}
