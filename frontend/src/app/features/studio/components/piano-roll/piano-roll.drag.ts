// A note must stay at least one grid step long, otherwise its resize handles
// collapse together and become impossible to grab.
export const MIN_NOTE_LENGTH = 1;

function snapValue(value: number, snapStep: number, allowFraction: boolean): number {
  const step = Math.max(0, Math.round(snapStep));
  if (step > 0) {
    return Math.round(value / step) * step;
  }
  return allowFraction ? Math.round(value * 100) / 100 : Math.round(value);
}

/** New start step for a note dragged along the timeline. */
export function movedStep(
  originStep: number,
  deltaSteps: number,
  snapStep: number,
  totalSteps: number
): number {
  const snapped = snapValue(originStep + deltaSteps, snapStep, false);
  return Math.min(Math.max(0, snapped), Math.max(0, totalSteps - 1));
}

/** New pitch row for a note dragged vertically (row 0 is the highest pitch). */
export function movedRow(
  originRow: number,
  deltaRows: number,
  totalRows: number
): number {
  const row = Math.round(originRow + deltaRows);
  return Math.min(Math.max(0, row), Math.max(0, totalRows - 1));
}

/** New length when dragging the right edge of a note. */
export function resizedRightLength(
  originStart: number,
  originLength: number,
  deltaSteps: number,
  snapStep: number,
  totalSteps: number
): number {
  const rawEnd = originStart + originLength + deltaSteps;
  const end = snapValue(rawEnd, snapStep, true);
  const maxLength = Math.max(MIN_NOTE_LENGTH, totalSteps - originStart);
  return Math.min(Math.max(MIN_NOTE_LENGTH, end - originStart), maxLength);
}

/** New start when dragging the left edge of a note (its right edge stays put). */
export function resizedLeftStart(
  originStart: number,
  originLength: number,
  deltaSteps: number,
  snapStep: number
): number {
  const end = originStart + originLength;
  const snapped = snapValue(originStart + deltaSteps, snapStep, false);
  const latestStart = Math.max(0, Math.floor(end - MIN_NOTE_LENGTH));
  return Math.min(Math.max(0, snapped), latestStart);
}

export interface NoteGridRow {
  notes: boolean[];
  lengths: number[];
}

/**
 * Moves a note from one grid position to another, preserving its length.
 * Returns null when the move is a no-op or the source note is missing.
 */
export function applyNoteMove<T extends NoteGridRow>(
  rows: T[],
  fromRow: number,
  fromStep: number,
  toRow: number,
  toStep: number
): T[] | null {
  const source = rows[fromRow];
  if (!source || !source.notes[fromStep]) {
    return null;
  }
  if (fromRow === toRow && fromStep === toStep) {
    return null;
  }
  const length = source.lengths[fromStep] ?? 1;
  return rows.map((row, index) => {
    if (index !== fromRow && index !== toRow) {
      return row;
    }
    const notes = row.notes.slice();
    const lengths = row.lengths.slice();
    if (index === fromRow) {
      notes[fromStep] = false;
      lengths[fromStep] = 1;
    }
    if (index === toRow) {
      notes[toStep] = true;
      lengths[toStep] = length;
    }
    return { ...row, notes, lengths };
  });
}
