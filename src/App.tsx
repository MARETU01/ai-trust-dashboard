import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import datasetUrl from './generated/survey.csv.gz?url';
import generatedSummary from './generated/summary.json';
import ChartCard from './ChartCard.tsx';
import { countryLabel, translations, type Language, type Translate } from './i18n.ts';
import { AGE_GROUPS, AI_USE_GROUPS, CODE_LEARNING_GROUPS, count, percent, share, type SurveyFilters, type SurveyStats, type SurveySummary } from './survey.ts';
import type { SurveyReply, SurveyRequest } from './survey-messages.ts';
import type { ChartConfig } from './chart-types.ts';

type Section = {
  id: string;
  label: string;
  shortLabel: string;
  row: 'two' | 'mixed';
  description: string;
  charts: ChartConfig[];
};

const initialSurvey: SurveySummary = generatedSummary;
const sections: Section[] = [
  {
    id: 'overview', label: 'Who uses AI?', shortLabel: 'AI use', row: 'two',
    description: 'Respondent age, AI use and trust across age groups, and AI learning by work experience.',
    charts: [
      { id: 'ages', title: 'Who took the survey?', subtitle: 'Age distribution of the selected sample.' },
      { id: 'adoption', title: 'The AI adoption spectrum', subtitle: 'AI use and intent within each age group.', minimum: 350 },
      { id: 'trust', title: 'Trust across generations', subtitle: 'How confidence in AI accuracy varies by age.', minimum: 350, note: 'Neutral responses are split at the center for visual comparison.' },
      { id: 'learning', title: 'AI learning across experience levels', subtitle: 'Share who learned to use AI-enabled tools, by years of work experience.', minimum: 340, note: 'Bubble size indicates the number of valid responses in each group.' },
    ],
  },
  {
    id: 'workflows', label: 'How does AI fit into work?', shortLabel: 'Workflows', row: 'mixed',
    description: 'The technologies, communities, AI models, and tasks that shape developer workflows.',
    charts: [
      { id: 'languages', title: 'Which programming languages do developers use?', subtitle: 'Top 10 languages in the full survey sample.', minimum: 350 },
      { id: 'databases', title: 'Which databases do developers use?', subtitle: 'Top 10 databases in the full survey sample.', minimum: 350 },
      { id: 'community', title: 'Community platform use by AI use and intent', subtitle: 'The overall top 10 platforms, compared across AI use and intent groups.', minimum: 365, note: 'Each column uses that group’s valid community-platform responses as its denominator.' },
      { id: 'models', title: 'AI models used and wanted', subtitle: 'Model groups used in the past year and wanted in the next year.', minimum: 285, note: 'Link width shows the number of respondents selecting both groups. A respondent can contribute to several links.' },
      { id: 'taskStatus', title: 'How is AI used across development tasks?', subtitle: 'Current use and plans for the next 3–5 years.', minimum: 565, note: 'Shares are calculated separately for each task from its valid responses.' },
    ],
  },
  {
    id: 'trust', label: 'How do developers feel about AI?', shortLabel: 'Trust & impact', row: 'two',
    description: 'Perceptions of AI accuracy, complex work, and job security.',
    charts: [
      { id: 'complex', title: 'How well does AI handle complex tasks?', subtitle: 'Ratings within each group of current AI users.', minimum: 320 },
      { id: 'sentiment', title: 'Does a favorable view of AI mean trust?', subtitle: 'Trust and distrust of AI accuracy within each attitude group.', minimum: 350 },
      { id: 'threat', title: 'Who sees AI as a job threat?', subtitle: 'Job-threat perceptions by age group.', minimum: 350, note: 'Bubble size represents the number of respondents in each category.' },
      { id: 'taskUsage', title: 'Where is current AI use highest?', subtitle: 'Share of respondents already using AI for each development task.', minimum: 365, note: 'Current use combines partial and mostly AI use. The outer ring represents 100%.' },
    ],
  },
];

const navigation = [...sections, { id: 'methodology', shortLabel: 'Methods' }];
const emptyFilters: SurveyFilters = { country: '', age: '', codeLearning: '', aiUse: '', role: '' };
type FilterName = keyof SurveyFilters;
type FilterDefinition = { [Name in FilterName]: {
  name: Name;
  id: string;
  label: string;
  all: string;
  options: readonly (readonly [SurveyFilters[Name], string])[];
} }[FilterName];

const filterOptions: FilterDefinition[] = [
  { name: 'country', id: 'filter-country', label: 'Country or region', all: 'All countries', options: [
    ...initialSurvey.filters.countries.map((name) => [name, name] as const), ['__missing__', 'Not reported'],
  ] },
  { name: 'age', id: 'filter-age', label: 'Age group', all: 'All ages', options: [...AGE_GROUPS, ['Prefer not to say', 'Prefer not to say']] },
  { name: 'codeLearning', id: 'filter-learning', label: 'Coding learning status', all: 'All learning groups', options: [
    ...CODE_LEARNING_GROUPS, ['__missing__', 'Not reported'],
  ] },
  { name: 'role', id: 'filter-role', label: 'Developer role', all: 'All roles', options: initialSurvey.filters.roles.map((name) => [name, name]) },
  { name: 'aiUse', id: 'filter-ai', label: 'AI use frequency', all: 'All AI use groups', options: AI_USE_GROUPS },
];

type SurveyLoadState = 'ready' | 'loading' | 'error';

function useSurvey() {
  const [stats, setStats] = useState(initialSurvey.stats);
  const [filters, setFilters] = useState(emptyFilters);
  const [state, setState] = useState<SurveyLoadState>('ready');
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);

  useEffect(() => () => {
    worker.current?.terminate();
    worker.current = null;
  }, []);

  function applyFilters(next: SurveyFilters) {
    const id = ++request.current;
    setFilters(next);
    if (!Object.values(next).some(Boolean)) {
      setStats(initialSurvey.stats);
      setState('ready');
      return;
    }
    setState('loading');
    if (!worker.current) {
      const instance = new Worker(new URL('./data-worker.ts', import.meta.url), { type: 'module' });
      instance.addEventListener('message', ({ data }: MessageEvent<SurveyReply>) => {
        if (data.request !== request.current) return;
        if ('error' in data) {
          setState('error');
          return;
        }
        setStats(data.stats);
        setState('ready');
      });
      instance.addEventListener('error', () => {
        instance.terminate();
        worker.current = null;
        setState((current) => current === 'loading' ? 'error' : current);
      });
      worker.current = instance;
    }
    const message: SurveyRequest = { url: new URL(datasetUrl, window.location.href).href, filters: next, request: id };
    worker.current.postMessage(message);
  }

  return { stats, filters, state, applyFilters };
}

type FilterPanelProps = {
  filters: SurveyFilters;
  applyFilters: (filters: SurveyFilters) => void;
  state: SurveyLoadState;
  total: number;
  language: Language;
  t: Translate;
};

function FilterPanel({ filters, applyFilters, state, total, language, t }: FilterPanelProps) {
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

  const localizedFilters = useMemo(() => filterOptions.map(({ name, label, all, options, ...field }) => ({
    ...field, name, label: t(label), all: t(all),
    options: options.map(([value, nameLabel]) => [value, name === 'country' && value !== '__missing__' ? countryLabel(nameLabel, language) : t(nameLabel)] as const),
  })), [language, t]);
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

function SampleSummary({ kpis, t }: { kpis: SurveyStats['kpis']; t: Translate }) {
  const { total, countries, users, aiN, trusting, trustN } = kpis;
  return (
    <section className="kpi-grid" aria-label={t('Selected sample summary')}>
      <article className="kpi"><p>{t('Respondents')}</p><strong id="kpi-respondents">{count(total)}</strong><span>{t('In the selected sample')}</span></article>
      <article className="kpi"><p>{t('Countries or regions')}</p><strong id="kpi-countries">{count(countries)}</strong><span>{t('With a reported location')}</span></article>
      <article className="kpi"><p>{t('Currently use AI tools')}</p><strong id="kpi-adoption">{percent(share(users, aiN))}</strong><span id="kpi-adoption-note">{t('Of {total} valid AI use responses', { total: count(aiN) })}</span></article>
      <article className="kpi"><p>{t('Trust AI accuracy')}</p><strong id="kpi-trust">{percent(share(trusting, trustN))}</strong><span id="kpi-trust-note">{t('Somewhat or highly · n = {total}', { total: count(trustN) })}</span></article>
    </section>
  );
}

function Methodology({ t }: { t: Translate }) {
  return (
    <section className="methodology" id="methodology" aria-labelledby="methodology-title">
      <div><p className="eyebrow">{t('DATA & METHODS')}</p><h2 id="methodology-title">{t('How to read this dashboard')}</h2></div>
      <dl>
        <div><dt>{t('Survey sample')}</dt><dd>{t('The dataset contains one record per respondent and includes missing answers.')} <a href="https://survey.stackoverflow.co/2025/">{t('Stack Overflow Developer Survey 2025')}</a></dd></div>
        <div><dt>{t('Selecting chart marks')}</dt><dd id="mark-selection-guide">{t('Click a mark to select it. Hold Ctrl (Command on Mac) to add or remove marks. Press Esc or use Clear highlight to clear the selection.')}</dd></div>
        <div><dt>{t('Denominators')}</dt><dd>{t('Each chart uses valid answers for the questions and groups shown. Missing answers can reduce the sample size.')}</dd></div>
        <div><dt>{t('Multiple selections')}</dt><dd>{t('Tool and platform shares use the number of respondents selecting each option. Multiple selections can make shares sum to more than 100%.')}</dd></div>
        <div><dt>{t('AI task status')}</dt><dd>{t('Current use combines partial and mostly AI use. Rates use each task’s valid responses. Future plans cover the next 3–5 years.')}</dd></div>
      </dl>
    </section>
  );
}

const languagePreference = 'ai-trust-dashboard-language';

function getSavedLanguage(): Language {
  try {
    return localStorage.getItem(languagePreference) === 'zh-CN' ? 'zh-CN' : 'en';
  } catch {
    return 'en';
  }
}

export default function App() {
  const survey = useSurvey();
  const { stats } = survey;
  const [language, setLanguage] = useState(getSavedLanguage);
  const t = translations[language];
  const nextLanguage = language === 'en' ? 'zh-CN' : 'en';
  const nextLanguageLabel = nextLanguage === 'en' ? 'English' : '简体中文';
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('AI Trust Observatory');
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = t('Explore how developers use and trust AI in the 2025 Stack Overflow Developer Survey.');
    try { localStorage.setItem(languagePreference, language); } catch { /* The language can still change in this tab. */ }
  }, [language, t]);
  useEffect(() => {
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">{t('Skip to dashboard')}</a>
      <main className="dashboard" id="main-content" tabIndex={-1}>
        <header className="dashboard-header" aria-labelledby="page-title">
          <div className="header-intro">
            <div>
              <p className="eyebrow survey-source">{t('2025 Stack Overflow Developer Survey')}</p>
              <h1 id="page-title">{t('How developers use and trust AI')}</h1>
            </div>
            <button type="button" className="button language-switch"
              aria-label={t('Switch language to {language}', { language: nextLanguageLabel })}
              onClick={() => setLanguage(nextLanguage)}>
              <span lang={nextLanguage}>{nextLanguageLabel}</span>
            </button>
          </div>
          <nav className="section-nav" aria-label={t('Dashboard sections')}>
            {navigation.map(({ id, shortLabel }) => <a key={id} href={`#${id}`}>{t(shortLabel)}</a>)}
          </nav>
          <SampleSummary kpis={stats.kpis} t={t} />
        </header>
        <FilterPanel filters={survey.filters} applyFilters={survey.applyFilters} state={survey.state} total={stats.kpis.total} language={language} t={t} />
        <div id="chart-sections">
          {sections.map(({ id, label, description, row, charts }) => (
            <section className="chart-section" id={id} key={id} aria-labelledby={`section-${id}`}>
              <header className="section-heading"><h2 id={`section-${id}`}>{t(label)}</h2><p>{t(description)}</p></header>
              <div className={`chart-grid chart-grid--${row}`}>
                {charts.map((config) => <ChartCard config={config} stats={stats} t={t} key={config.id} />)}
              </div>
            </section>
          ))}
        </div>
        <div className="dashboard-notes">
          <Methodology t={t} />
        </div>
        <footer>{t('AI Trust Observatory')}<span>{t('2025 Stack Overflow Developer Survey')}</span></footer>
      </main>
    </>
  );
}
