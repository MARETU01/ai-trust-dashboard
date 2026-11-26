import type { ChartConfig } from '../chart-types.ts';

type Section = {
  id: string;
  label: string;
  shortLabel: string;
  row: 'two' | 'mixed';
  description: string;
  charts: ChartConfig[];
};

export const sections: Section[] = [
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
      { id: 'models', title: 'AI models used and wanted', subtitle: 'Model groups used in the past year and wanted in the next year.', minimum: 480, note: 'Link width shows the number of respondents selecting both groups. A respondent can contribute to several links.' },
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
      { id: 'taskUsage', title: 'Where is current AI use highest?', subtitle: 'Current AI use by task among professional developers who use AI tools.', minimum: 580, note: 'Includes daily, weekly and infrequent AI users. Current use combines partial and mostly AI use, divided by each task’s valid responses. Sector area represents current-use share.' },
    ],
  },
];

export const navigation = [...sections, { id: 'methodology', shortLabel: 'Methods' }];
