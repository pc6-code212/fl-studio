export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeLimits {
  width: number;
  height: number;
}

/**
 * Resize a rect from any edge or corner. The opposite edge stays put, and the
 * dragged edge never crosses it: hitting the minimum size anchors the fixed
 * edge instead of flipping the rect.
 */
export function resizePanelRect(
  rect: PanelRect,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  min: ResizeLimits
): PanelRect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;

  if (edge.includes('w')) {
    left = rect.x + dx;
  }
  if (edge.includes('e')) {
    right = rect.x + rect.width + dx;
  }
  if (edge.includes('n')) {
    top = rect.y + dy;
  }
  if (edge.includes('s')) {
    bottom = rect.y + rect.height + dy;
  }

  if (right - left < min.width) {
    if (edge.includes('w')) {
      left = right - min.width;
    } else {
      right = left + min.width;
    }
  }
  if (bottom - top < min.height) {
    if (edge.includes('n')) {
      top = bottom - min.height;
    } else {
      bottom = top + min.height;
    }
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}
