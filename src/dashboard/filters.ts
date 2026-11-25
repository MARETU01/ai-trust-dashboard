import { AGE_GROUPS, AI_USE_GROUPS, CODE_LEARNING_GROUPS, type SurveyFilters, type SurveySummary } from '../survey.ts';

export const emptyFilters: SurveyFilters = { country: '', age: '', codeLearning: '', aiUse: '', role: '' };
type FilterName = keyof SurveyFilters;
type FilterDefinition = { [Name in FilterName]: {
  name: Name;
  id: string;
  label: string;
  all: string;
  options: readonly (readonly [SurveyFilters[Name], string])[];
} }[FilterName];

export function filterDefinitions(options: SurveySummary['filters']): FilterDefinition[] {
  return [
    { name: 'country', id: 'filter-country', label: 'Country or region', all: 'All countries', options: [
      ...options.countries.map((name) => [name, name] as const), ['__missing__', 'Not reported'],
    ] },
    { name: 'age', id: 'filter-age', label: 'Age group', all: 'All ages', options: [...AGE_GROUPS, ['Prefer not to say', 'Prefer not to say']] },
    { name: 'codeLearning', id: 'filter-learning', label: 'Coding learning status', all: 'All learning groups', options: [
      ...CODE_LEARNING_GROUPS, ['__missing__', 'Not reported'],
    ] },
    { name: 'role', id: 'filter-role', label: 'Developer role', all: 'All roles', options: options.roles.map((name) => [name, name]) },
    { name: 'aiUse', id: 'filter-ai', label: 'AI use frequency', all: 'All AI use groups', options: AI_USE_GROUPS },
  ];
}
