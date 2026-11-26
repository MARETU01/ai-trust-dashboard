import { useEffect, useRef, useState } from 'react';
import { createSurveyWorker, datasetUrl } from './survey-runtime.ts';
import generatedSummary from '../generated/summary.json';
import type { SurveyFilters, SurveySummary } from '../survey.ts';
import type { SurveyReply, SurveyRequest } from '../survey-messages.ts';
import { emptyFilters } from '../dashboard/filters.ts';

const initialSurvey: SurveySummary = generatedSummary;

export type SurveyLoadState = 'ready' | 'loading' | 'error';

export default function useSurvey() {
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
      const instance = createSurveyWorker();
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

  return { stats, filters, state, applyFilters, options: initialSurvey.filters };
}
