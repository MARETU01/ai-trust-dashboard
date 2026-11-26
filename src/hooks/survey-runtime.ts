import datasetUrl from '../generated/survey.csv.gz?url';

export { datasetUrl };
export const createSurveyWorker = () => new Worker(new URL('../data-worker.ts', import.meta.url), { type: 'module' });
