export const chartFont = '"Times New Roman", "Noto Serif CJK SC", "Songti SC", "Microsoft YaHei", serif';

// Category colors sampled from the approved new_fig references.
export const palette = {
  ink: '#333333', muted: '#635c70', grid: '#f1f1f1', paper: '#ffffff',
  purple: '#7f6ca3', green: '#7fdfbb', languages: '#846fa0', databases: '#89e7c5',
  guide: '#d8d1e4', connector: '#929a9e', centerLine: '#7491a9', hover: '#846fa014', missing: '#f1f1f1',
  ages: ['#96eacc', '#b6ffef', '#b5e3ff', '#bcaed4', '#f4d9f2', '#8e7dad'],
  trust: ['#8b78ae', '#b3a6cf', '#f6e5ad', '#ace1cc', '#70b39f'],
  models: ['#bce4d8', '#59adbf', '#7567a2', '#9768a5', '#b669a1', '#d16c98'],
  tasks: ['#a8e6d0', '#76c6ac', '#eceef1', '#cdd1d8', '#cec6de'],
  complex: ['#7fdfbb', '#dbcdba', '#7f6ca3', '#bea5ad'],
  threat: ['#ac9fc3', '#e8ded2', '#acead3'],
  taskUsage: {
    task_searching_for_answers: '#9582b5',
    task_writing_code: '#b6a0d9',
    task_learning_new_concepts: '#c3bedc',
    task_debugging_code: '#afc7ef',
    task_generating_content_or_data: '#a0dfed',
    task_documenting_code: '#a5e5d4',
    task_learning_a_codebase: '#73e6c3',
    task_maintaining_documentation: '#c7e5ac',
    task_testing_code: '#fad98e',
    task_committing_and_reviewing_code: '#fac4a9',
    task_project_planning: '#f8b3bf',
    task_predictive_analytics: '#ebafd5',
    task_deployment_and_monitoring: '#f7676f',
  },
};

// Keep the reference domains fixed so filtering does not change a color's meaning.
export const adoptionColors = {
  min: 2.71, max: 51.12,
  steps: ['#ebe3f6', '#d5cae7', '#bfb0d7', '#a997c8', '#927db8'],
};
export const learningColors = { min: 50.97, max: 89.84, low: '#f1f1f1', high: '#89e7c5' };
export const communityColors = { low: '#8874ad', middle: '#d9d9d9', high: '#89e7c5' };

export function contrastText(background: string) {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(background.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : palette.paper;
}
