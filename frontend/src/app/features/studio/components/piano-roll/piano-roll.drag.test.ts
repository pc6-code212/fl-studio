import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyNoteMove,
  MIN_NOTE_LENGTH,
  movedRow,
  movedStep,
  resizedLeftStart,
  resizedRightLength,
  type NoteGridRow
} from './piano-roll.drag.ts';

test('movedStep snaps to the magnet division', () => {
  assert.equal(movedStep(10, 1, 4, 64), 12);
  assert.equal(movedStep(10, -1, 4, 64), 8);
  assert.equal(movedStep(3, 0.6, 1, 64), 4);
});

test('movedStep falls back to whole steps when the magnet is off', () => {
  assert.equal(movedStep(3, 0.6, 0, 64), 4);
});

test('movedStep clamps to the timeline', () => {
  assert.equal(movedStep(1, -5, 1, 64), 0);
  assert.equal(movedStep(62, 10, 1, 64), 63);
});

test('movedRow rounds and clamps pitch rows', () => {
  assert.equal(movedRow(10, 2.4, 128), 12);
  assert.equal(movedRow(10, -20, 128), 0);
  assert.equal(movedRow(120, 20, 128), 127);
  assert.equal(movedRow(5, 1, 0), 0);
});

test('resizedRightLength snaps and respects bounds', () => {
  assert.equal(resizedRightLength(4, 2, 2, 4, 64), 4);
  assert.equal(resizedRightLength(4, 2, -10, 1, 64), MIN_NOTE_LENGTH);
  assert.equal(resizedRightLength(60, 2, 10, 1, 64), 4);
});

test('resizedRightLength keeps fractional lengths when the magnet is off', () => {
  assert.equal(resizedRightLength(0, 1, 0.5, 0, 64), 1.5);
});

test('resize never shrinks a note below one full step', () => {
  assert.equal(MIN_NOTE_LENGTH, 1);
  assert.equal(resizedRightLength(4, 2, -10, 1, 64), 1);
});

test('resizedLeftStart snaps the left edge and never crosses the right edge', () => {
  assert.equal(resizedLeftStart(8, 4, -3, 4), 4);
  assert.equal(resizedLeftStart(8, 4, 10, 4), 11);
  assert.equal(resizedLeftStart(0, 2, -5, 1), 0);
});

function grid(...lengthsPerRow: number[]): NoteGridRow[] {
  return lengthsPerRow.map(count => ({
    notes: new Array(count).fill(false),
    lengths: new Array(count).fill(1)
  }));
}

test('applyNoteMove clears the source and preserves length at the target', () => {
  const rows = grid(2, 2);
  rows[0].notes[0] = true;
  rows[0].lengths[0] = 3;
  const moved = applyNoteMove(rows, 0, 0, 1, 1);
  assert.ok(moved);
  assert.equal(moved[0].notes[0], false);
  assert.equal(moved[0].lengths[0], 1);
  assert.equal(moved[1].notes[1], true);
  assert.equal(moved[1].lengths[1], 3);
  assert.notEqual(moved, rows, 'returns a new rows array');
});

test('applyNoteMove ignores no-ops and missing notes', () => {
  const rows = grid(2);
  rows[0].notes[0] = true;
  assert.equal(applyNoteMove(rows, 0, 0, 0, 0), null);
  assert.equal(applyNoteMove(rows, 0, 1, 0, 0), null);
  assert.equal(applyNoteMove(rows, 5, 0, 0, 0), null);
});

test('successive moves from the last position leave no trail', () => {
  let rows = grid(4);
  rows[0].notes[0] = true;
  rows = applyNoteMove(rows, 0, 0, 0, 1) ?? rows;
  rows = applyNoteMove(rows, 0, 1, 0, 3) ?? rows;
  assert.deepEqual(rows[0].notes, [false, false, false, true]);
});
