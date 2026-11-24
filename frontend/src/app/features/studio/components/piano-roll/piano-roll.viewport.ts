export interface WindowRange {
  start: number;
  end: number;
}

export interface ColumnWindowInput {
  scrollLeft: number;
  viewportWidth: number;
  keyWidth: number;
  stepWidth: number;
  total: number;
  overscan: number;
  chunk: number;
}

export interface RowWindowInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  headerHeight: number;
  total: number;
  overscan: number;
  chunk: number;
}

/**
 * Visible slice of step columns, rounded outwards to stable chunk boundaries so
 * small scroll deltas do not constantly re-render the note cells.
 */
export function computeColumnWindow(input: ColumnWindowInput): WindowRange {
  const viewLeft = Math.max(0, input.scrollLeft - input.keyWidth);
  const viewRight = Math.max(0, input.scrollLeft + input.viewportWidth - input.keyWidth);
  const rawStart = Math.max(0, Math.floor(viewLeft / input.stepWidth) - input.overscan);
  const rawEnd = Math.min(
    input.total,
    Math.ceil(viewRight / input.stepWidth) + input.overscan
  );
  return chunkRange(rawStart, rawEnd, input.total, input.chunk);
}

/**
 * Visible slice of piano rows (pitches). The sticky ruler is excluded from the
 * scroll offset so the first rendered row lines up with the visible area.
 */
export function computeRowWindow(input: RowWindowInput): WindowRange {
  const viewTop = Math.max(0, input.scrollTop - input.headerHeight);
  const viewBottom = viewTop + input.viewportHeight;
  const rawStart = Math.max(0, Math.floor(viewTop / input.rowHeight) - input.overscan);
  const rawEnd = Math.min(
    input.total,
    Math.ceil(viewBottom / input.rowHeight) + input.overscan
  );
  return chunkRange(rawStart, rawEnd, input.total, input.chunk);
}

export interface GridCell {
  start: number;
  length: number;
}

/**
 * Grid cells for the currently visible range. The cell size follows the magnet
 * division, so 1/4 shows four cells per bar instead of sixteen step cells.
 */
export function computeGridCells(
  visibleStart: number,
  visibleEnd: number,
  total: number,
  snapStep: number
): GridCell[] {
  const span = Math.max(1, Math.round(snapStep));
  const start = Math.max(0, Math.min(visibleStart, total));
  const end = Math.max(start, Math.min(visibleEnd, total));
  const first = Math.floor(start / span) * span;
  const cells: GridCell[] = [];
  if (total <= 0) {
    return cells;
  }
  for (let step = first; step < end; step += span) {
    if (step < 0) {
      continue;
    }
    cells.push({ start: step, length: Math.min(span, total - step) });
  }
  return cells;
}

function chunkRange(
  rawStart: number,
  rawEnd: number,
  total: number,
  chunk: number
): WindowRange {
  const size = Math.max(1, Math.floor(chunk));
  const start = Math.min(total, Math.max(0, Math.floor(rawStart / size) * size));
  const chunkedEnd = Math.ceil(rawEnd / size) * size + size;
  const end = Math.min(total, Math.max(start, chunkedEnd));
  return { start, end };
}
