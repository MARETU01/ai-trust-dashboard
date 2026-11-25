import type { SurveyFilters, SurveyStats } from './survey.ts';

export type SurveyRequest = { request: number; url: string; filters: SurveyFilters };
export type SurveyReply =
  | { request: number; stats: SurveyStats }
  | { request: number; error: string };
