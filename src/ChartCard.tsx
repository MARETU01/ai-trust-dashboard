import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ECElementEvent } from 'echarts/core';
import { makeChart, modelHighlightGroups, modelLinksGroup } from './charts.ts';
import { lineMarkId, withMarkSelection } from './chart-selection.ts';
import { count, type SurveyStats } from './survey.ts';
import type { Translate } from './i18n.ts';
import type { ChartConfig, ChartStyle, MarkSelector } from './chart-types.ts';
import MatrixPlot from './components/charts/MatrixPlot.tsx';
import DataTable from './components/charts/DataTable.tsx';
import Legend from './components/charts/ChartLegend.tsx';

const ChartCanvas = lazy(() => import('./ChartCanvas.tsx'));
const sankeySelectionGroups = [...modelHighlightGroups, modelLinksGroup];

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
