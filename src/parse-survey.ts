import Papa from 'papaparse';
import { createSurvey, surveyFields, type SurveyCsvRow } from './survey.ts';

export function parseSurvey(csv: string) {
  const parsed = Papa.parse<SurveyCsvRow>(csv, { header: true, delimiter: ',', skipEmptyLines: true });
  const headers = new Set(parsed.meta.fields);
  if (parsed.errors.length || !parsed.data.length || !surveyFields.every((field) => headers.has(field))) {
    throw new Error('The survey CSV is missing data or could not be parsed.');
  }
  return createSurvey(parsed.data);
}
