import type { ChartSeries, ChartView, MarkDatum, MarkValue, SelectableSeries } from './chart-types.ts';

export const matrixMarkId = (row: number, column: number) => `cell-${row}-${column}`;
export const lineMarkId = (index: number) => `line-${index}`;

function hasVisibleMark(series: SelectableSeries, value: MarkValue) {
  if (!Array.isArray(value)) return Number.isFinite(value) && (series.type !== 'bar' || value !== 0);
  if (series.type === 'custom') return value.slice(0, 2).every(Number.isFinite);
  return Number.isFinite(value[0]) && (typeof series.symbolSize !== 'function' || series.symbolSize(value) > 0);
}

export function withMarkSelection(chart: ChartView): ChartView & { selectableIds: Set<string> } {
  const selectableIds = new Set(chart.highlightChoices?.map(({ value }) => value));
  if (chart.matrix) {
    chart.matrix.rows.forEach(({ cells }, row) => cells.forEach(({ selectable }, column) => {
      if (selectable) selectableIds.add(matrixMarkId(row, column));
    }));
    return { ...chart, selectableIds };
  }
  if (chart.highlightSeries) return { ...chart, selectableIds };

  const series = chart.option.series.map((series, index) => {
    if (series.type === 'sankey') return series;
    const data = series.data.map((datum, row): MarkDatum => {
      const item = datum && typeof datum === 'object' && !Array.isArray(datum) ? datum : { value: datum };
      if (!hasVisibleMark(series, item.value)) return item;
      const markId = `mark-${index}-${item.id ?? row}`;
      selectableIds.add(markId);
      return { ...item, markId };
    });
    if (series.type === 'line' && data.some((item, i) => item.markId && data[i - 1]?.markId)) {
      const selectionGroup = lineMarkId(index);
      selectableIds.add(selectionGroup);
      return { ...series, data, selectionGroup, triggerEvent: 'line' as const };
    }
    return { ...series, data };
  });

  function highlightSeries(selection: readonly string[]): ChartSeries[] {
    const selected = new Set(selection);
    return series.map((entry): ChartSeries => {
      if (entry.type === 'sankey') return entry;
      const groupSelected = entry.selectionGroup !== undefined && selected.has(entry.selectionGroup);
      const isActive = (item: MarkDatum) => groupSelected || (item.markId !== undefined && selected.has(item.markId));
      const style = {
        emphasis: { disabled: true },
        data: entry.data.map((item) => {
          const strength = isActive(item) ? 1 : .24;
          return {
            ...item,
            itemStyle: { ...item.itemStyle, opacity: strength * (item.itemStyle?.opacity ?? entry.itemStyle?.opacity ?? 1) },
            label: { ...item.label, opacity: strength },
            ...(entry.type === 'pie' ? { labelLine: { lineStyle: { opacity: strength } } } : {}),
          };
        }),
      };
      if (entry.type === 'custom') return {
        ...entry, ...style,
        renderItem: (params, api) => entry.renderItem(params, api, isActive(entry.data[params.dataIndex]) ? 1 : .24),
      };
      if (entry.type === 'line') return {
        ...entry, ...style,
        lineStyle: { ...entry.lineStyle, opacity: groupSelected ? 1 : entry.data.some(isActive) ? .5 : .14 },
      };
      return { ...entry, ...style };
    });
  }

  return { ...chart, selectableIds, option: { ...chart.option, series }, highlightSeries };
}
