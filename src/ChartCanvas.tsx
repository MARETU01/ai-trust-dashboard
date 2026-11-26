import { useEffect, useLayoutEffect, useRef } from 'react';
import { init, use, type ECElementEvent, type EChartsType, type ElementEvent } from 'echarts/core';
import { BarChart, CustomChart, LineChart, PieChart, SankeyChart, ScatterChart } from 'echarts/charts';
import { GraphicComponent, GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { viewportTooltipPosition } from './tooltip.ts';
import type { ChartOption, ChartSeries, ChartTooltip } from './chart-types.ts';

use([
  BarChart, CustomChart, LineChart, PieChart, SankeyChart, ScatterChart,
  GraphicComponent, GridComponent, MarkLineComponent, TooltipComponent, CanvasRenderer,
]);

type ChartCanvasProps = {
  option: ChartOption;
  highlightedSeries?: ChartSeries[];
  titleId: string;
  onMarkClick?: (event: ECElementEvent) => void;
  onBlankClick?: () => void;
};

export default function ChartCanvas({ option, highlightedSeries, titleId, onMarkClick, onBlankClick }: ChartCanvasProps) {
  const element = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);
  const previousOption = useRef<ChartOption | null>(null);

  useLayoutEffect(() => {
    const container = element.current;
    if (!container) return;
    const instance = init(container, undefined, { useCoarsePointer: true, pointerSize: 16 });
    chart.current = instance;
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(container);
    const hideTip = () => instance.dispatchAction({ type: 'hideTip' });
    window.addEventListener('scroll', hideTip, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', hideTip, true);
      resize.disconnect();
      instance.dispose();
      chart.current = null;
      previousOption.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = chart.current;
    const container = element.current;
    if (!instance || !container) return;
    const series = highlightedSeries ?? option.series;
    if (previousOption.current === option) {
      instance.setOption({ series });
      return;
    }
    previousOption.current = option;
    const dialog = container.closest('dialog');
    const tooltip: ChartTooltip = {
      ...option.tooltip,
      appendTo: dialog ?? 'body',
      position([x, y], _params, _tip, _mark, { contentSize: [width, height] }) {
        const bounds = container.getBoundingClientRect();
        const [left, top] = viewportTooltipPosition(bounds.left + x, bounds.top + y, width, height, dialog);
        return [left - bounds.left, top - bounds.top];
      },
    };
    instance.setOption({
      ...option,
      series,
      tooltip,
    }, { notMerge: true });
  }, [option, highlightedSeries]);

  useEffect(() => {
    if (!onMarkClick && !onBlankClick) return;
    const instance = chart.current;
    if (!instance) return;
    const renderer = instance.getZr();
    const handleBlankClick = ({ target, event }: ElementEvent) => {
      if (!target && !event?.ctrlKey && !event?.metaKey) onBlankClick?.();
    };
    if (onMarkClick) instance.on('click', onMarkClick);
    if (onBlankClick) renderer.on('click', handleBlankClick);
    return () => {
      if (instance.isDisposed()) return;
      if (onMarkClick) instance.off('click', onMarkClick);
      if (onBlankClick) renderer.off('click', handleBlankClick);
    };
  }, [onMarkClick, onBlankClick]);

  return <div ref={element} className="canvas-chart" role="img" aria-labelledby={titleId} />;
}
