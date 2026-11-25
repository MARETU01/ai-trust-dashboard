import type { ChartStyle, ColorScale, HighlightChoice, LegendItem, MarkSelector } from '../../chart-types.ts';

type LegendProps = {
  legend?: readonly LegendItem[];
  scale?: ColorScale;
  highlightChoices?: readonly HighlightChoice[];
  selected: readonly string[];
  onSelect?: MarkSelector;
};

export default function Legend({ legend, scale, highlightChoices, selected, onSelect }: LegendProps) {
  if (legend) {
    return (
      <div className="chart-legend">
        {legend.map(([label, color, id]) => {
          const style: ChartStyle = { '--legend-color': color };
          const swatch = <span className="legend-swatch" aria-hidden="true" style={style} />;
          return onSelect ? (
            <button type="button" className="button legend-item legend-toggle" key={id}
              aria-pressed={selected.includes(id)} disabled={!highlightChoices?.some(({ value }) => value === id)}
              onClick={(event) => onSelect(id, event.ctrlKey || event.metaKey)}>{swatch}{label}</button>
          ) : <span className="legend-item" key={id}>{swatch}{label}</span>;
        })}
      </div>
    );
  }
  if (!scale) return null;
  const colors = [scale.low, scale.middle, scale.high].filter(Boolean);
  const style: ChartStyle = { '--legend-stops': colors.join(', ') };
  return (
    <div className="chart-legend">
      0%<span className="legend-gradient" aria-hidden="true" style={style} />{scale.end}
    </div>
  );
}
