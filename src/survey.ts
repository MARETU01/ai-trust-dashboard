export const AGE_GROUPS = [
  ['18-24 years old', '18–24'],
  ['25-34 years old', '25–34'],
  ['35-44 years old', '35–44'],
  ['45-54 years old', '45–54'],
  ['55-64 years old', '55–64'],
  ['65 years or older', '65+'],
] as const;

export const AI_USE_GROUPS = [
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['monthly_or_infrequent', 'Infrequent'],
  ['plan_to_use', 'Plans to use'],
  ['no_plans_to_use', 'No plans to use'],
] as const;

export const CODE_LEARNING_GROUPS = [
  ['beginner_or_student', 'Beginner or student'],
  ['experienced_and_learning', 'Experienced and learning'],
  ['experienced_not_learning', 'Experienced and not learning'],
] as const;

export const TRUST_LEVELS = [
  'Highly distrust', 'Somewhat distrust', 'Neither trust nor distrust',
  'Somewhat trust', 'Highly trust',
] as const;
export const SENTIMENTS = ['Very favorable', 'Favorable', 'Indifferent', 'Unsure', 'Unfavorable', 'Very unfavorable'] as const;
export const THREAT_LEVELS = ['Yes', "I'm not sure", 'No'] as const;
export const COMPLEX_RATINGS = ['Positive', 'Neutral', 'Negative', 'Don’t use / Don’t know'] as const;
export const EXPERIENCE_GROUPS = ['1–5 years', '6–10 years', '11+ years'];

export const MODELS = [
  ['Anthropic: Claude Sonnet', 'Claude Sonnet'],
  ['Gemini (Flash general purpose models)', 'Gemini Flash'],
  ['openAI GPT (chatbot models)', 'OpenAI GPT'],
  ['openAI Image generating models', 'OpenAI Image'],
  ['openAI Reasoning models', 'OpenAI Reasoning'],
  ['Other Models', 'Other models'],
];

export const TASK_STATES = ['Use partially', 'Use mostly', 'Plan partial use', 'Plan mostly', 'No plans'];
export const TASKS = [
  ['task_writing_code', 'Writing code', 'Write code'],
  ['task_searching_for_answers', 'Searching for answers', 'Find answers'],
  ['task_learning_new_concepts', 'Learning new concepts', 'Learn concepts'],
  ['task_learning_a_codebase', 'Learning about a codebase', 'Learn codebase'],
  ['task_project_planning', 'Project planning', 'Project plan'],
  ['task_documenting_code', 'Documenting code', 'Document code'],
  ['task_debugging_code', 'Debugging or fixing code', 'Debug code'],
  ['task_testing_code', 'Testing code', 'Test code'],
  ['task_committing_and_reviewing_code', 'Committing and reviewing code', 'Commit / review'],
  ['task_deployment_and_monitoring', 'Deployment and monitoring', 'Deploy'],
  ['task_predictive_analytics', 'Predictive analytics', 'Prediction'],
  ['task_generating_content_or_data', 'Generating content or data', 'Content / data'],
  ['task_maintaining_documentation', 'Maintaining documentation', 'Maintain docs'],
] as const;

const SUBSTITUTIONS = new Map([
  ['Bash/Shell (all shells)', 'Bash/Shell'],
  ['GitHub (public projects, not private repos)', 'GitHub (public)'],
  ['Dynamodb', 'DynamoDB'],
]);
const ratingGroups: Readonly<Partial<Record<string, typeof COMPLEX_RATINGS[number]>>> = {
  very_good: 'Positive', good: 'Positive', neutral: 'Neutral',
  bad: 'Negative', very_poor: 'Negative', unused_or_unknown: 'Don’t use / Don’t know',
};

export type SurveyFilters = {
  country: string;
  age: '' | typeof AGE_GROUPS[number][0] | 'Prefer not to say';
  codeLearning: '' | typeof CODE_LEARNING_GROUPS[number][0] | '__missing__';
  aiUse: '' | typeof AI_USE_GROUPS[number][0];
  role: string;
};

export type Survey = ReturnType<typeof createSurvey>;
export type SurveyStats = ReturnType<typeof summarize>;
export type SurveySummary = { filters: Survey['filters']; stats: SurveyStats };

export const surveyFields = [
  'country', 'age_group', 'developer_status', 'code_learning_status', 'ai_use_group', 'developer_roles',
  'work_experience_years', 'ai_learning', 'ai_trust', 'ai_sentiment', 'ai_complex_task_rating',
  'ai_job_threat', 'languages_used', 'databases_used', 'community_platforms_used',
  'ai_models_used', 'ai_models_wanted', ...TASKS.map(([field]) => field),
] as const;
export type SurveyCsvRow = Record<typeof surveyFields[number], string>;

export const optionLabel = (value: string) => SUBSTITUTIONS.get(value) ?? value;
export const count = (value: number) => value.toLocaleString('en-US');
export const share = (value: number, total: number) => total ? 100 * value / total : null;
export const percent = (value: number | null) => value == null ? '—' : `${value.toFixed(2)}%`;

function selections(value: string) {
  return [...new Set(value.split(';').map((part) => part.trim()).filter(Boolean))];
}

function modelGroups(value: string) {
  const names = selections(value);
  const selected = new Set(names.map((name) => {
    const index = MODELS.findIndex(([model]) => name === model);
    return index === -1 ? MODELS.length - 1 : index;
  }));
  return [...selected];
}

function tally<Row>(rows: readonly Row[], getOptions: (row: Row) => readonly string[]) {
  const result = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    const options = getOptions(row);
    if (options.length) total += 1;
    for (const option of options) result.set(option, (result.get(option) ?? 0) + 1);
  }
  return { result, total };
}

function topTen<Row>(rows: readonly Row[], getOptions: (row: Row) => readonly string[]) {
  return [...tally(rows, getOptions).result]
    .sort(([a, totalA], [b, totalB]) => totalB - totalA || a.localeCompare(b))
    .slice(0, 10).map(([option]) => option);
}

export function createSurvey(rawRows: readonly SurveyCsvRow[]) {
  const rows = rawRows.map((row) => ({
    country: row.country,
    age: row.age_group,
    developerStatus: row.developer_status,
    codeLearning: row.code_learning_status,
    aiUse: row.ai_use_group,
    roles: selections(row.developer_roles),
    experience: Number(row.work_experience_years),
    learning: row.ai_learning,
    trust: row.ai_trust,
    sentiment: row.ai_sentiment,
    complexity: ratingGroups[row.ai_complex_task_rating],
    threat: row.ai_job_threat,
    languages: selections(row.languages_used),
    databases: selections(row.databases_used),
    platforms: selections(row.community_platforms_used),
    used: modelGroups(row.ai_models_used),
    wanted: modelGroups(row.ai_models_wanted),
    tasks: TASKS.map(([field]) => Number(row[field])),
  }));
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'));
  return {
    rows,
    filters: {
      countries: unique(rows.map((row) => row.country)),
      roles: unique(rows.flatMap((row) => row.roles)),
    },
    rankings: {
      languages: topTen(rows, (row) => row.languages),
      databases: topTen(rows, (row) => row.databases),
      platforms: topTen(rows, (row) => row.platforms),
    },
  };
}

type SurveyRow = Survey['rows'][number];
type CategoryCount<Category extends string> = { n: number; counts: Record<Category, number> };

function countsBy<Category extends string>(
  rows: readonly SurveyRow[],
  domains: readonly string[],
  categories: readonly Category[],
  groupOf: (row: SurveyRow) => string,
  valueOf: (row: SurveyRow) => string | undefined,
) {
  const results = domains.map(() => ({
    n: 0,
    counts: Object.fromEntries(categories.map((value) => [value, 0])) as Record<Category, number>,
  }));
  const groups = new Map<string, CategoryCount<Category>>(domains.map((key, index) => [key, results[index]]));
  const validCategories = new Set<string>(categories);
  const containsCategory = (key: string): key is Category => validCategories.has(key);
  for (const row of rows) {
    const group = groups.get(groupOf(row));
    const key = valueOf(row);
    if (group && key !== undefined && containsCategory(key)) {
      group.n += 1;
      group.counts[key] += 1;
    }
  }
  return results;
}

function itemsFor(rows: readonly SurveyRow[], field: keyof Survey['rankings'], ranking: readonly string[]) {
  const { result, total } = tally(rows, (row) => row[field]);
  return {
    n: total,
    items: ranking.map((name) => ({
      name: optionLabel(name),
      count: result.get(name) ?? 0,
    })),
  };
}

const accepts = (selected: string | undefined, value: string) => !selected || (selected === '__missing__' ? !value : selected === value);
const zeros = (length: number) => new Array<number>(length).fill(0);
const matrix = (rows: number, columns: number) => Array.from({ length: rows }, () => zeros(columns));

export function summarize(survey: Survey, filters: Partial<SurveyFilters> = {}) {
  const role = filters.role;
  const rows = survey.rows.filter((row) =>
    accepts(filters.country, row.country) &&
    accepts(filters.age, row.age) &&
    accepts(filters.codeLearning, row.codeLearning) &&
    accepts(filters.aiUse, row.aiUse) &&
    (!role || row.roles.includes(role)),
  );
  const ages = AGE_GROUPS.map(([value]) => value);
  const usage = AI_USE_GROUPS.map(([value]) => value);
  const currentUsers = new Set<string>(usage.slice(0, 3));
  const demographics = countsBy(rows, ['age'], ages, () => 'age', (row) => row.age)[0];
  const adoption = countsBy(rows, ages, usage, (row) => row.age, (row) => row.aiUse);
  const ageTrust = countsBy(rows, ages, TRUST_LEVELS, (row) => row.age, (row) => row.trust);
  const learning = matrix(3, 3).map((cells) => cells.map(() => ({ n: 0, yes: 0 })));
  const complexity = countsBy(rows, usage.slice(0, 3), COMPLEX_RATINGS, (row) => row.aiUse, (row) => row.complexity);
  const sentimentTrust = countsBy(rows, SENTIMENTS, TRUST_LEVELS, (row) => row.sentiment, (row) => row.trust);
  const jobThreat = countsBy(rows, ages, THREAT_LEVELS, (row) => row.age, (row) => row.threat);
  const community = usage.map((key) => itemsFor(rows.filter((row) => row.aiUse === key), 'platforms', survey.rankings.platforms));
  const modelPairs = matrix(MODELS.length, MODELS.length);
  const tasks = TASKS.map(() => ({ n: 0, counts: zeros(TASK_STATES.length) }));
  const taskUsage = TASKS.map(() => ({ n: 0, counts: zeros(TASK_STATES.length) }));
  let modelN = 0;
  let aiN = 0;
  let users = 0;
  let trustN = 0;
  let trusting = 0;
  const countries = new Set<string>();

  for (const row of rows) {
    if (row.country) countries.add(row.country);
    if (row.aiUse) {
      aiN += 1;
      if (currentUsers.has(row.aiUse)) users += 1;
    }
    if (TRUST_LEVELS.some((level) => level === row.trust)) {
      trustN += 1;
      if (row.trust === 'Somewhat trust' || row.trust === 'Highly trust') trusting += 1;
    }
    if (row.used.length && row.wanted.length) {
      modelN += 1;
      for (const source of row.used) {
        for (const target of row.wanted) modelPairs[source][target] += 1;
      }
    }
    if (row.learning && row.experience > 0 && currentUsers.has(row.aiUse)) {
      const band = row.experience <= 5 ? 0 : row.experience <= 10 ? 1 : 2;
      const group = learning[usage.findIndex((key) => key === row.aiUse)][band];
      group.n += 1;
      if (row.learning.startsWith('yes_')) group.yes += 1;
    }
    // Figure 12 uses professional developers who currently use AI tools.
    const eligibleForTaskUsage = row.developerStatus === 'professional_developer' && currentUsers.has(row.aiUse);
    row.tasks.forEach((state, taskIndex) => {
      if (state >= 1 && state <= TASK_STATES.length) {
        tasks[taskIndex].n += 1;
        tasks[taskIndex].counts[state - 1] += 1;
        if (eligibleForTaskUsage) {
          taskUsage[taskIndex].n += 1;
          taskUsage[taskIndex].counts[state - 1] += 1;
        }
      }
    });
  }

  return {
    kpis: { total: rows.length, countries: countries.size, aiN, users, trustN, trusting },
    demographics, adoption, ageTrust, learning, complexity, sentimentTrust, jobThreat, community,
    languages: itemsFor(rows, 'languages', survey.rankings.languages),
    databases: itemsFor(rows, 'databases', survey.rankings.databases),
    modelPairs, modelN, tasks, taskUsage,
  };
}
