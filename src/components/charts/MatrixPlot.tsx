import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { matrixMarkId } from '../../chart-selection.ts';
import type { MarkSelector, Matrix, TooltipContent } from '../../chart-types.ts';
import type { Translate } from '../../i18n.ts';
import { viewportTooltipPosition } from '../../tooltip.ts';

const matrixDirections = new Map<string, readonly [number, number]>([
  ['ArrowLeft', [0, -1]], ['ArrowRight', [0, 1]], ['ArrowUp', [-1, 0]], ['ArrowDown', [1, 0]],
]);

type TooltipPosition = { x: number; y: number };
type MatrixTooltipProps = TooltipContent & TooltipPosition & { id: string; container: HTMLElement | null };

function MatrixTooltip({ id, x, y, title, lines, container }: MatrixTooltipProps) {
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const tip = element.current;
    if (!tip) return;
    const [left, top] = viewportTooltipPosition(x, y, tip.offsetWidth, tip.offsetHeight, container);
    tip.style.transform = `translate(${left}px, ${top}px)`;
  }, [x, y, title, lines, container]);

  return createPortal(
    <div ref={element} className="tooltip-content matrix-tooltip" id={id} role="tooltip">
      <strong className="tip-title">{title}</strong>
      {lines.map(([label, value]) => (
        <div className="tip-line" key={label}><span>{label}</span><b>{value}</b></div>
      ))}
    </div>,
    container ?? document.body,
  );
}

type MatrixPlotProps = {
  matrix: Matrix;
  selectedIds: readonly string[];
  onSelect: MarkSelector;
  onClear: () => void;
  tooltipContainer: HTMLElement | null;
  t: Translate;
};

export default function MatrixPlot({ matrix, selectedIds, onSelect, onClear, tooltipContainer, t }: MatrixPlotProps) {
  const table = useRef<HTMLTableElement>(null);
  const tooltipId = useId();
  const [tabStop, setTabStop] = useState<[number, number]>([0, 0]);
  const [hovered, setHovered] = useState<(TooltipPosition & { row: number; column: number }) | null>(null);
  const tooltip = hovered && matrix.rows[hovered.row]?.cells[hovered.column]?.tooltip;

  useEffect(() => {
    if (!hovered) return;
    const hide = () => setHovered(null);
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [hovered]);

  function revealCell(event: SyntheticEvent<HTMLTableCellElement>, row: number, column: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    setHovered({ row, column, x: rect.right, y: rect.top + rect.height / 2 });
  }

  function revealPointer(event: PointerEvent<HTMLTableCellElement>, row: number, column: number) {
    if (event.pointerType !== 'touch' && (hovered?.row !== row || hovered.column !== column)) {
      setHovered({ row, column, x: event.clientX, y: event.clientY });
    }
  }

  function moveFocus(event: KeyboardEvent<HTMLTableCellElement>, row: number, column: number) {
    if (event.key === 'Escape') {
      setHovered(null);
      return;
    }
    const direction = matrixDirections.get(event.key);
    if (!direction) return;
    event.preventDefault();
    const [dy, dx] = direction;
    const nextRow = Math.max(0, Math.min(row + dy, matrix.rows.length - 1));
    const nextColumn = Math.max(0, Math.min(column + dx, matrix.headers.length - 1));
    table.current?.tBodies[0]?.rows[nextRow]?.cells[nextColumn + 1]?.focus();
  }

  return (
    <>
      <table ref={table} className="plot-matrix" aria-label={matrix.label} onPointerLeave={() => setHovered(null)}
        onClick={(event) => {
          if (event.target instanceof Element && !event.target.closest('td') && !event.ctrlKey && !event.metaKey) onClear();
        }}>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">{t('Group')}</span></th>
            {matrix.headers.map((name) => <th key={name} scope="col">{name}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map(({ name, cells }, row) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              {cells.map(({ value, showValue, style, className, bubble, selectable }, column) => {
                const active = hovered?.row === row && hovered.column === column;
                const markId = matrixMarkId(row, column);
                const selected = selectedIds.includes(markId);
                return (
                  <td key={matrix.headers[column]} className={className} style={style}
                    tabIndex={tabStop[0] === row && tabStop[1] === column ? 0 : -1}
                    data-hovered={active}
                    data-selectable={selectable}
                    data-selected={selected}
                    data-dimmed={selectedIds.length > 0 && !selected}
                    aria-describedby={active ? tooltipId : undefined}
                    onPointerEnter={(event) => revealPointer(event, row, column)}
                    onPointerMove={(event) => revealPointer(event, row, column)}
                    onFocus={(event) => {
                      setTabStop([row, column]);
                      revealCell(event, row, column);
                    }}
                    onBlur={() => setHovered(null)}
                    onClick={(event) => {
                      if (selectable) onSelect(markId, event.ctrlKey || event.metaKey);
                      revealCell(event, row, column);
                    }}
                    onKeyDown={(event) => {
                      if (selectable && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        if (!event.repeat) onSelect(markId, event.ctrlKey || event.metaKey);
                        return;
                      }
                      moveFocus(event, row, column);
                    }}>
                    {bubble && <span className="bubble" style={bubble} />}
                    {showValue === false ? <span className="sr-only">{value}</span> : value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {hovered && tooltip && <MatrixTooltip id={tooltipId} x={hovered.x} y={hovered.y} container={tooltipContainer} {...tooltip} />}
    </>
  );
}
