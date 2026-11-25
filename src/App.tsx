import { useEffect, useState } from 'react';
import ChartCard from './ChartCard.tsx';
import { translations, type Language, type Translate } from './i18n.ts';
import { count, percent, share, type SurveyStats } from './survey.ts';
import { sections, navigation } from './dashboard/sections.ts';
import FilterPanel from './dashboard/FilterPanel.tsx';
import useSurvey from './hooks/useSurvey.ts';

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
        <FilterPanel options={survey.options} filters={survey.filters} applyFilters={survey.applyFilters} state={survey.state} total={stats.kpis.total} language={language} t={t} />
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
