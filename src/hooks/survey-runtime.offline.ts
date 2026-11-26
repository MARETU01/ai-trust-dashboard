import InlineSurveyWorker from '../data-worker.ts?worker&inline';
import datasetUrl from '../generated/survey.csv.gz?url&inline';

export { datasetUrl };
export const createSurveyWorker = () => new InlineSurveyWorker();
