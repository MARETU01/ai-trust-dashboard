import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { countryLabel, type Language, type Translate } from '../i18n.ts';
import { count, type SurveyFilters, type SurveySummary } from '../survey.ts';
import type { SurveyLoadState } from '../hooks/useSurvey.ts';
import { emptyFilters, filterDefinitions } from './filters.ts';

type FilterPanelProps = {
  options: SurveySummary['filters'];
  filters: SurveyFilters;
  applyFilters: (filters: SurveyFilters) => void;
  state: SurveyLoadState;
  total: number;
  language: Language;
  t: Translate;
};

export default function FilterPanel({ options, filters, applyFilters, state, total, language, t }: FilterPanelProps) {
  const panel = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const element = panel.current;
    if (!element) return;
    const update = () => root.style.setProperty('--filter-bar-height', `${element.offsetHeight}px`);
    const observer = new ResizeObserver(update);
    update();
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--filter-bar-height');
    };
  }, []);

  const localizedFilters = useMemo(() => filterDefinitions(options).map(({ name, label, all, options, ...field }) => ({
    ...field, name, label: t(label), all: t(all),
    options: options.map(([value, nameLabel]) => [value, name === 'country' && value !== '__missing__' ? countryLabel(nameLabel, language) : t(nameLabel)] as const),
  })), [options, language, t]);
  const active = localizedFilters.flatMap(({ name, label, options }) => filters[name]
    ? [{ name, label, value: options.find(([value]) => value === filters[name])?.[1] }]
    : []);
  let message = total ? t('{total} respondents match these filters.', { total: count(total) }) : t('No respondents match this combination of filters.');
  if (state === 'loading') message = t('Updating charts…');
  if (state === 'error') message = t('The charts still show the last results. The selected filters could not be loaded.');
  return (
    <section ref={panel} className="filters" aria-labelledby="filter-title">
      <div className="filter-heading">
        <div>
          <h2 id="filter-title">{t('Filters')}</h2>
          <p id="load-status" className="load-status" data-state={state} role="status">{message}</p>
        </div>
        <div className="filter-actions">
          {state === 'error' && <button type="button" className="button" id="retry-load" onClick={() => applyFilters(filters)}>{t('Retry')}</button>}
          <button type="button" className="button filter-toggle" aria-controls="filter-controls" aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}>{t(expanded ? 'Done' : 'Edit filters')}</button>
          <button type="button" className="button" id="reset-filters" disabled={!active.length} onClick={() => applyFilters(emptyFilters)}>{t('Reset filters')}</button>
        </div>
      </div>
      <div className="filter-grid" id="filter-controls" data-expanded={expanded}>
        {localizedFilters.map(({ name, id, label, all, options }) => (
          <label key={name}>
            {label}
            <select className="control-select" id={id} value={filters[name]} title={active.find((filter) => filter.name === name)?.value}
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (!value || options.some(([option]) => option === value)) applyFilters({ ...filters, [name]: value });
              }}>
              <option value="">{all}</option>
              {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        ))}
      </div>
      {active.length > 0 && (
        <ul className="active-filters" aria-label={t('Current filters')}>
          {active.map(({ name, label, value }) => (
            <li key={name} aria-label={`${label} · ${value}`}>{filters[name] === '__missing__' ? `${label} · ${value}` : value}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
