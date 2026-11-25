import type { SurveyStats } from './survey.ts';
import type { Translate } from './i18n.ts';
import type { ChartView } from './chart-types.ts';
import { ageDistribution, adoption, trustAcrossAge, experienceLearning } from './charts/demographics.ts';
import { technologyRankings, communityUse } from './charts/technology.ts';
import { modelSankey } from './charts/models.ts';
import { tasksStack, usageRose } from './charts/tasks.ts';
import { complexTasks, sentimentDumbbell, ageThreat } from './charts/perceptions.ts';

export { modelHighlightGroups, modelLinksGroup } from './charts/models.ts';

export const makeChart = {
  ages: ageDistribution, adoption, trust: trustAcrossAge, learning: experienceLearning,
  languages: (stats, t) => technologyRankings(stats.languages, t),
  databases: (stats, t) => technologyRankings(stats.databases, t, true),
  community: communityUse, models: modelSankey, taskStatus: tasksStack,
  complex: complexTasks, sentiment: sentimentDumbbell, threat: ageThreat, taskUsage: usageRose,
} satisfies Record<string, (stats: SurveyStats, t: Translate) => ChartView>;
