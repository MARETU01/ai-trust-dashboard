import type { CSSProperties } from 'react';
import type {
  BarSeriesOption, CustomSeriesOption, CustomSeriesRenderItem, EChartsOption,
  LineSeriesOption, PieSeriesOption, SankeySeriesOption, ScatterSeriesOption, TooltipComponentOption,
} from 'echarts';
import type { makeChart } from './charts.ts';

export type ChartConfig = {
  id: keyof typeof makeChart;
  title: string;
  subtitle: string;
  minimum?: number;
  note?: string;
};

export type ChartStyle = CSSProperties & { [property: `--${string}`]: string };
export type TooltipLine = readonly [label: string, value: string];
export type TooltipContent = { title: string; lines: readonly TooltipLine[] };
export type Matrix = {
  headers: readonly string[];
  label: string;
  rows: {
    name: string;
    cells: {
      value: string;
      selectable: boolean;
      tooltip: TooltipContent;
      style?: ChartStyle;
      className?: string;
      bubble?: ChartStyle;
    }[];
  }[];
};
export type ChartTable = { headers: string[]; rows: string[][] };
export type LegendItem = readonly [label: string, color: string, id: string];
export type ColorScale = { low: string; middle?: string; high: string; colors?: readonly string[]; start?: string; end: string };
export type HighlightChoice = { value: string; label: string; group?: string };
export type MarkSelector = (value: string, additive?: boolean) => void;

export type MarkValue = number | null | (number | null)[];
export type MarkDatum = {
  id?: string;
  name?: string;
  value: MarkValue;
  markId?: string;
  itemStyle?: NonNullable<BarSeriesOption['itemStyle']>;
  label?: { opacity?: number };
};

type MarkSeries<Series extends { type?: string }> = Omit<Series, 'data' | 'symbolSize' | 'type'> & {
  type: NonNullable<Series['type']>;
  data: (MarkValue | MarkDatum)[];
  symbolSize?: number | ((value: (number | null)[]) => number);
  selectionGroup?: string;
};
type RenderItem = (
  ...args: [...Parameters<CustomSeriesRenderItem>, opacity?: number]
) => ReturnType<CustomSeriesRenderItem>;
export type SelectableSeries =
  | MarkSeries<BarSeriesOption>
  | MarkSeries<LineSeriesOption>
  | MarkSeries<PieSeriesOption>
  | MarkSeries<ScatterSeriesOption>
  | (Omit<MarkSeries<CustomSeriesOption>, 'renderItem'> & {
    renderItem: RenderItem;
    emphasis?: NonNullable<CustomSeriesOption['emphasis']> & { disabled?: boolean };
  });
export type ChartSeries = SelectableSeries | (SankeySeriesOption & { type: 'sankey' });
export type ChartTooltip = Omit<TooltipComponentOption, 'triggerOn'> & {
  triggerOn?: TooltipComponentOption['triggerOn'] | 'mousemove|click';
};
export type ChartOption = Omit<EChartsOption, 'series' | 'tooltip'> & {
  series: ChartSeries[];
  tooltip?: ChartTooltip;
};

type ChartDetails = {
  n?: number;
  nLabel?: string;
  empty?: boolean;
  sample?: string;
  table: ChartTable;
  legend?: readonly LegendItem[];
  scale?: ColorScale;
  highlightChoices?: HighlightChoice[];
  highlightSeries?: (selection: readonly string[]) => ChartSeries[];
};
export type ChartView = ChartDetails & (
  | { matrix: Matrix; option?: never }
  | { matrix?: never; option: ChartOption }
);
