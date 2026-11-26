import { MODELS, count, type SurveyStats } from '../survey.ts';
import type { Translate } from '../i18n.ts';
import type { ChartSeries, ChartView } from '../chart-types.ts';
import { chartFont, palette } from '../chart-theme.ts';
import { tip, chart } from './shared.ts';

export const modelHighlightGroups = ['Used in the past year', 'Wanted in the next year'];
export const modelLinksGroup = 'Model links';

const modelNames: Readonly<Record<string, string>> = {
  'OpenAI GPT': 'OpenAI GPT (chatbot models)',
  'OpenAI Image': 'OpenAI Image models',
  'OpenAI Reasoning': 'OpenAI Reasoning models',
  'Other models': 'Other Models',
};

export function modelSankey({ modelPairs, modelN }: SurveyStats, t: Translate): ChartView {
  const labels = MODELS.map(([, name]) => t(modelNames[name] ?? name));
  const links = modelPairs.flatMap((counts, source) => counts.flatMap((value, target) => value ? [{
    id: `link-${source}-${target}`, source: `used${source}`, target: `wanted${target}`,
    value, sourceIndex: source, targetIndex: target,
  }] : []));
  const data = ['used', 'wanted'].flatMap((prefix, depth) => labels.flatMap((name, i) => {
    const values = depth === 0 ? modelPairs[i] : modelPairs.map((row) => row[i]);
    const value = values.reduce((sum, count) => sum + count, 0);
    return value ? [{
      name: `${prefix}${i}`, labelText: name, depth, value, itemStyle: { color: palette.models[i] },
      label: { color: i < 2 ? palette.ink : palette.paper },
    }] : [];
  }));
  const highlightChoices = [
    ...data.map(({ name, labelText, depth }) => ({ value: name, label: labelText, group: modelHighlightGroups[depth] })),
    ...links.map(({ id, sourceIndex, targetIndex }) => ({
      value: id, label: `${labels[sourceIndex]} → ${labels[targetIndex]}`, group: modelLinksGroup,
    })),
  ];
  const fadedLabelOpacity = 0.1;
  function highlightSeries(selection: readonly string[]): ChartSeries[] {
    const selected = new Set(selection);
    const outlined = new Set(selection);
    const connected = new Set(selection);
    const styledLinks = links.map((link) => {
      const selectedLink = selected.has(link.id);
      const active = selectedLink || selected.has(link.source) || selected.has(link.target);
      if (selectedLink) {
        outlined.add(link.source);
        outlined.add(link.target);
      }
      if (active) {
        connected.add(link.source);
        connected.add(link.target);
      }
      return { ...link, lineStyle: { opacity: selected.size ? (active ? 0.68 : 0.08) : 0.5 } };
    });
    return [{
      type: 'sankey', left: 2, right: 2, top: 5, bottom: 7, draggable: false,
      nodeAlign: 'justify', nodeGap: 0, nodeWidth: 132, layoutIterations: 0,
      data: data.map((node) => {
        const muted = selected.size > 0 && !connected.has(node.name);
        return {
          ...node,
          itemStyle: {
            ...node.itemStyle, opacity: muted ? 0.24 : 1,
            borderColor: palette.ink, borderWidth: outlined.has(node.name) ? 2 : 0,
          },
          label: { ...node.label, opacity: muted ? fadedLabelOpacity : 1 },
        };
      }),
      links: styledLinks,
      emphasis: { focus: 'adjacency', disabled: selected.size > 0 },
      lineStyle: { color: 'source', curveness: 0.48 },
      blur: { itemStyle: { opacity: 0.36 }, lineStyle: { opacity: 0.12 }, label: { opacity: fadedLabelOpacity } },
      label: { position: 'inside', formatter: ({ data }) => typeof data === 'object' && data && 'labelText' in data
        ? String(data.labelText) : '', color: palette.ink, fontFamily: chartFont, fontSize: 14, fontWeight: 400,
        lineHeight: 18, width: 120, align: 'center', verticalAlign: 'middle', overflow: 'break' },
    }];
  }
  return {
    n: modelN, nLabel: 'answered both model questions',
    highlightChoices, highlightSeries,
    table: { headers: [t('Used / wanted'), ...labels], rows: labels.map((name, i) => [name, ...modelPairs[i].map(count)]) },
    option: chart({
      tooltip: { formatter: (params) => {
        if (Array.isArray(params)) return '';
        const { data, dataType, value } = params;
        if (typeof data !== 'object' || !data || typeof value !== 'number') return '';
        if (dataType === 'edge' && 'sourceIndex' in data && typeof data.sourceIndex === 'number'
          && 'targetIndex' in data && typeof data.targetIndex === 'number') {
          return tip(t, 'Model co-selection', [
            [modelHighlightGroups[0], labels[data.sourceIndex]], [modelHighlightGroups[1], labels[data.targetIndex]],
            ['Respondents selecting both', count(value)],
          ]);
        }
        if ('labelText' in data && typeof data.labelText === 'string' && 'depth' in data && typeof data.depth === 'number') {
          return tip(t, data.labelText, [
            ['Model group', t(modelHighlightGroups[data.depth])],
            ['Pair selections across links', count(value)],
          ]);
        }
        return '';
      } },
      series: highlightSeries([]),
      media: [
        { query: { minWidth: 800 }, option: { series: [{ type: 'sankey', nodeWidth: 340, label: { fontSize: 20, lineHeight: 26, width: 324 } }] } },
        { option: { series: [{ type: 'sankey', nodeWidth: 132, label: { fontSize: 14, lineHeight: 18, width: 120 } }] } },
      ],
    }),
  };
}
