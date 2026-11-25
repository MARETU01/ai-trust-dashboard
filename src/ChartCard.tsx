import { lazy, memo, Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ECElementEvent } from 'echarts/core';
import { makeChart, modelHighlightGroups, modelLinksGroup } from './charts.ts';
import { lineMarkId, matrixMarkId, withMarkSelection } from './chart-selection.ts';
import { count, type SurveyStats } from './survey.ts';
import type { Translate } from './i18n.ts';
import type { ChartConfig, ChartStyle, ChartTable, ColorScale, HighlightChoice, LegendItem, MarkSelector, Matrix, TooltipContent } from './chart-types.ts';
import { viewportTooltipPosition } from './tooltip.ts';

const ChartCanvas = lazy(() => import('./ChartCanvas.tsx'));
const sankeySelectionGroups = [...modelHighlightGroups, modelLinksGroup];

const matrixDirections = new Map<string, readonly [number, number]>([
  ['ArrowLeft', [0, -1]], ['ArrowRight', [0, 1]], ['ArrowUp', [-1, 0]], ['ArrowDown', [1, 0]],
]);

type TooltipPosition = { x: number; y: number };
type MatrixTooltipProps = TooltipContent & TooltipPosition & { id: string; container: HTMLElement | null };

function MatrixTooltip({ id, x, y, title, lines, container }: MatrixTooltipProps) {
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const tip = element.current;
    if (!tip) return;
    const [left, top] = viewportTooltipPosition(x, y, tip.offsetWidth, tip.offsetHeight, container);
    tip.style.transform = `translate(${left}px, ${top}px)`;
  }, [x, y, title, lines, container]);

  return createPortal(
    <div ref={element} className="tooltip-content matrix-tooltip" id={id} role="tooltip">
      <strong className="tip-title">{title}</strong>
      {lines.map(([label, value]) => (
        <div className="tip-line" key={label}><span>{label}</span><b>{value}</b></div>
      ))}
    </div>,
    container ?? document.body,
  );
}

type MatrixPlotProps = {
  matrix: Matrix;
  selectedIds: readonly string[];
  onSelect: MarkSelector;
  onClear: () => void;
  tooltipContainer: HTMLElement | null;
  t: Translate;
};

function MatrixPlot({ matrix, selectedIds, onSelect, onClear, tooltipContainer, t }: MatrixPlotProps) {
  const table = useRef<HTMLTableElement>(null);
  const tooltipId = useId();
  const [tabStop, setTabStop] = useState<[number, number]>([0, 0]);
  const [hovered, setHovered] = useState<(TooltipPosition & { row: number; column: number }) | null>(null);
  const tooltip = hovered && matrix.rows[hovered.row]?.cells[hovered.column]?.tooltip;

  useEffect(() => {
    if (!hovered) return;
    const hide = () => setHovered(null);
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [hovered]);

  function revealCell(event: SyntheticEvent<HTMLTableCellElement>, row: number, column: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    setHovered({ row, column, x: rect.right, y: rect.top + rect.height / 2 });
  }

  function revealPointer(event: PointerEvent<HTMLTableCellElement>, row: number, column: number) {
    if (event.pointerType !== 'touch' && (hovered?.row !== row || hovered.column !== column)) {
      setHovered({ row, column, x: event.clientX, y: event.clientY });
    }
  }

  function moveFocus(event: KeyboardEvent<HTMLTableCellElement>, row: number, column: number) {
    if (event.key === 'Escape') {
      setHovered(null);
      return;
    }
    const direction = matrixDirections.get(event.key);
    if (!direction) return;
    event.preventDefault();
    const [dy, dx] = direction;
    const nextRow = Math.max(0, Math.min(row + dy, matrix.rows.length - 1));
    const nextColumn = Math.max(0, Math.min(column + dx, matrix.headers.length - 1));
    table.current?.tBodies[0]?.rows[nextRow]?.cells[nextColumn + 1]?.focus();
  }

  return (
    <>
      <table ref={table} className="plot-matrix" aria-label={matrix.label} onPointerLeave={() => setHovered(null)}
        onClick={(event) => {
          if (event.target instanceof Element && !event.target.closest('td') && !event.ctrlKey && !event.metaKey) onClear();
        }}>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">{t('Group')}</span></th>
            {matrix.headers.map((name) => <th key={name} scope="col">{name}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map(({ name, cells }, row) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              {cells.map(({ value, style, className, bubble, selectable }, column) => {
                const active = hovered?.row === row && hovered.column === column;
                const markId = matrixMarkId(row, column);
                const selected = selectedIds.includes(markId);
                return (
                  <td key={matrix.headers[column]} className={className} style={style}
                    tabIndex={tabStop[0] === row && tabStop[1] === column ? 0 : -1}
                    data-hovered={active}
                    data-selectable={selectable}
                    data-selected={selected}
                    data-dimmed={selectedIds.length > 0 && !selected}
                    aria-describedby={active ? tooltipId : undefined}
                    onPointerEnter={(event) => revealPointer(event, row, column)}
                    onPointerMove={(event) => revealPointer(event, row, column)}
                    onFocus={(event) => {
                      setTabStop([row, column]);
                      revealCell(event, row, column);
                    }}
                    onBlur={() => setHovered(null)}
                    onClick={(event) => {
                      if (selectable) onSelect(markId, event.ctrlKey || event.metaKey);
                      revealCell(event, row, column);
                    }}
                    onKeyDown={(event) => {
                      if (selectable && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        if (!event.repeat) onSelect(markId, event.ctrlKey || event.metaKey);
                        return;
                      }
                      moveFocus(event, row, column);
                    }}>
                    {bubble && <span className="bubble" style={bubble} />}
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {hovered && tooltip && <MatrixTooltip id={tooltipId} x={hovered.x} y={hovered.y} container={tooltipContainer} {...tooltip} />}
    </>
  );
}

function DataTable({ title, table, t }: { title: string; table: ChartTable; t: Translate }) {
  return (
    <div className="data-table" tabIndex={0} aria-label={t('{title} data table', { title })}>
      <table>
        <thead><tr>{table.headers.map((name) => <th key={name} scope="col">{name}</th>)}</tr></thead>
        <tbody>
          {table.rows.map(([name, ...values]) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              {values.map((value, i) => <td key={table.headers[i + 1]}>{value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type LegendProps = {
  legend?: readonly LegendItem[];
  scale?: ColorScale;
  highlightChoices?: readonly HighlightChoice[];
  selected: readonly string[];
  onSelect?: MarkSelector;
};

function Legend({ legend, scale, highlightChoices, selected, onSelect }: LegendProps) {
  if (legend) {
    return (
      <div className="chart-legend">
        {legend.map(([label, color, id]) => {
          const style: ChartStyle = { '--legend-color': color };
          const swatch = <span className="legend-swatch" aria-hidden="true" style={style} />;
          return onSelect ? (
            <button type="button" className="button legend-item legend-toggle" key={id}
              aria-pressed={selected.includes(id)} disabled={!highlightChoices?.some(({ value }) => value === id)}
              onClick={(event) => onSelect(id, event.ctrlKey || event.metaKey)}>{swatch}{label}</button>
          ) : <span className="legend-item" key={id}>{swatch}{label}</span>;
        })}
      </div>
    );
  }
  if (!scale) return null;
  const colors = [scale.low, scale.middle, scale.high].filter(Boolean);
  const style: ChartStyle = { '--legend-stops': colors.join(', ') };
  return (
    <div className="chart-legend">
      0%<span className="legend-gradient" aria-hidden="true" style={style} />{scale.end}
    </div>
  );
}

function ChartPlaceholder({ t }: { t: Translate }) {
  return <div className="chart-placeholder">{t('Loading chart…')}</div>;
}

export default memo(function ChartCard({ config, stats, t }: { config: ChartConfig; stats: SurveyStats; t: Translate }) {
  const { id, title, subtitle, minimum, note } = config;
  const headingId = `title-${id}`;
  const element = useRef<HTMLElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [nearViewport, setNearViewport] = useState(false);
  const [showData, setShowData] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [expandedHeight, setExpandedHeight] = useState<number | null>(null);
  const expanded = expandedHeight !== null;
  const isSankey = id === 'models';
  const isTaskStatus = id === 'taskStatus';

  const toggleHighlight = useCallback<MarkSelector>((value, additive = false) => setSelection((previous) => {
    const alreadySelected = previous.includes(value);
    if (additive) return alreadySelected ? previous.filter((item) => item !== value) : [...previous, value];
    return alreadySelected && previous.length === 1 ? [] : [value];
  }), []);
  const clearHighlight = useCallback(() => setSelection((previous) => previous.length ? [] : previous), []);
  const clickMark = useCallback(({ componentType, componentSubType, seriesType, seriesIndex, dataType, data, event }: ECElementEvent) => {
    if (componentType !== 'series') return;
    const key = seriesType === 'sankey' ? (dataType === 'edge' ? 'id' : 'name') : 'markId';
    const value = data && typeof data === 'object' && key in data
      ? (data as Partial<Record<typeof key, unknown>>)[key]
      : !data && componentSubType === 'line' && seriesIndex !== undefined ? lineMarkId(seriesIndex) : null;
    if (typeof value !== 'string' || !value) return;
    const pointer = event?.event;
    toggleHighlight(value, pointer?.ctrlKey || pointer?.metaKey);
    plot.current?.focus({ preventScroll: true });
  }, [toggleHighlight]);

  useEffect(() => {
    if (!element.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setNearViewport(true);
      observer.disconnect();
    }, { rootMargin: '200px 0px' });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (expanded) {
      closeButton.current?.focus({ preventScroll: true });
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      expandButton.current?.focus({ preventScroll: true });
    }
  }, [expanded]);

  function expandChart() {
    if (!element.current || !dialog.current) return;
    const height = element.current.getBoundingClientRect().height;
    dialog.current.showModal();
    restoreFocus.current = true;
    setExpandedHeight(height);
    setNearViewport(true);
  }

  function closeChart() {
    dialog.current?.close();
    setExpandedHeight(null);
  }

  const chart = useMemo(() => nearViewport ? withMarkSelection(makeChart[id](stats, t)) : null, [id, nearViewport, stats, t]);
  const empty = chart?.empty || chart?.n === 0;
  const sample = chart?.sample ?? (chart?.n == null ? '' : `n = ${count(chart.n)} · ${t(chart.nLabel ?? 'valid responses')}`);
  const selectedIds = useMemo(() => chart && selection.length
    ? selection.filter((id) => chart.selectableIds.has(id))
    : selection, [chart, selection]);
  if (selectedIds.length < selection.length) setSelection(selectedIds);
  const selected = chart?.highlightChoices?.find(({ value }) => value === selectedIds[0]);
  const highlightedSeries = useMemo(() => selectedIds.length ? chart?.highlightSeries?.(selectedIds) : undefined, [chart, selectedIds]);
  const canHighlight = !empty && (chart?.selectableIds.size ?? 0) > 0;
  const showHighlightControls = isSankey || isTaskStatus;
  const multipleSelected = selectedIds.length > 1;
  const selectionSummary = selectedIds.length === 1 ? t('1 item selected') : t('{total} items selected', { total: selectedIds.length });
  const chartStyle: ChartStyle | undefined = minimum ? { '--chart-min': `${minimum}px` } : undefined;

  const content = (
    <>
      <header className="chart-header">
        <div className="chart-title-row">
          <h3 id={headingId}>{t(title)}</h3>
          {expanded ? (
            <button ref={closeButton} type="button" className="button chart-view-button"
              onClick={closeChart}>{t('Close')}</button>
          ) : (
            <button ref={expandButton} type="button" className="button chart-view-button" aria-haspopup="dialog"
              aria-label={t('Expand chart · {title}', { title: t(title) })} onClick={expandChart}>{t('Expand')}</button>
          )}
        </div>
        <p>{t(subtitle)}</p>
      </header>
      {!empty && <Legend legend={chart?.legend} scale={chart?.scale} highlightChoices={chart?.highlightChoices}
        selected={selectedIds} onSelect={isTaskStatus && canHighlight ? toggleHighlight : undefined} />}
      {canHighlight && showHighlightControls && (
        <div className="chart-highlight">
          {isSankey ? (
            <label>{t('Highlight model or link')}
              <select className="control-select" value={multipleSelected ? 'multiple' : selected?.value ?? ''}
                onChange={(event) => setSelection(event.target.value ? [event.target.value] : [])}>
                <option value="">{t('No highlight')}</option>
                {multipleSelected && <option value="multiple" disabled>{selectionSummary}</option>}
                {sankeySelectionGroups.map((group) => {
                  const choices = chart?.highlightChoices?.filter((choice) => choice.group === group) ?? [];
                  return choices.length > 0 && (
                    <optgroup key={group} label={t(group)}>
                      {choices.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </label>
          ) : <span role="status">{selectedIds.length ? selectionSummary : t('Select a bar segment or a status in the legend.')}</span>}
          <button type="button" className="button button--text" disabled={!selectedIds.length} onClick={clearHighlight}>{t('Clear highlight')}</button>
          {isSankey && <p className="chart-highlight-hint" id="sankey-highlight-hint">{t('Ctrl + click (⌘ + click on Mac) to select multiple nodes and links.')}</p>}
        </div>
      )}
      {isSankey && !empty && (
        <div className="sankey-labels">{modelHighlightGroups.map((group) => <span key={group}>{t(group)}</span>)}</div>
      )}
      {empty ? <p className="chart-empty">{t('No valid responses for this selection.')}</p> : (
        <div ref={plot} className="chart-clip" aria-describedby={canHighlight ? 'mark-selection-guide' : undefined}
          {...((minimum || canHighlight) ? { tabIndex: 0, 'aria-label': t(minimum ? 'Scrollable chart area' : 'Chart area') } : {})}>
          <div className={`chart-body chart-body--${id}`} style={chartStyle}>
            {chart?.matrix ? <MatrixPlot matrix={chart.matrix} selectedIds={selectedIds} onSelect={toggleHighlight}
              onClear={clearHighlight} tooltipContainer={expanded ? dialog.current : null} t={t} /> : chart?.option ? (
              <Suspense fallback={<ChartPlaceholder t={t} />}>
                <ChartCanvas option={chart.option} highlightedSeries={highlightedSeries} titleId={headingId}
                  onMarkClick={canHighlight ? clickMark : undefined} onBlankClick={canHighlight ? clearHighlight : undefined} />
              </Suspense>
            ) : <ChartPlaceholder t={t} />}
          </div>
        </div>
      )}
      {note && <p className="chart-note">{t(note)}</p>}
      <div className="chart-meta">
        <span className="chart-sample">{chart && sample}</span>
        {!showHighlightControls && selectedIds.length > 0 && (
          <div className="chart-selection">
            <span role="status">{selectionSummary}</span>
            <button type="button" className="button button--text" onClick={clearHighlight}>{t('Clear highlight')}</button>
          </div>
        )}
        <details open={showData} hidden={!chart || empty} onToggle={(event) => setShowData(event.currentTarget.open)}>
          <summary>{t(showData ? 'Hide data' : 'View data')}</summary>
        </details>
      </div>
      {chart && !empty && showData && <DataTable title={t(title)} table={chart.table} t={t} />}
    </>
  );

  return (
    <article ref={element} className="chart-card" id={`chart-${id}`} aria-labelledby={expanded ? undefined : headingId}
      style={expanded ? { minHeight: expandedHeight } : undefined}
      onKeyDown={canHighlight && !expanded ? (event) => {
        if (event.key === 'Escape') clearHighlight();
      } : undefined}>
      {!expanded && content}
      <dialog ref={dialog} className="chart-dialog" aria-labelledby={headingId} onCancel={(event) => {
        event.preventDefault();
        closeChart();
      }}>
        {expanded && content}
      </dialog>
    </article>
  );
});
