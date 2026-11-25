export function viewportTooltipPosition(x: number, y: number, width: number, height: number, container?: HTMLElement | null) {
  const { clientWidth, clientHeight } = document.documentElement;
  const bounds = container?.getBoundingClientRect();
  const gap = 12;
  const edge = 8;
  const maxX = Math.min(clientWidth, bounds?.right ?? clientWidth) - edge;
  const maxY = Math.min(clientHeight, bounds?.bottom ?? clientHeight) - edge;
  const left = x + gap + width <= maxX ? x + gap : x - gap - width;
  const top = y + gap + height <= maxY ? y + gap : y - gap - height;
  return [
    Math.max(Math.max(0, bounds?.left ?? 0) + edge, Math.min(left, maxX - width)),
    Math.max(Math.max(0, bounds?.top ?? 0) + edge, Math.min(top, maxY - height)),
  ];
}
