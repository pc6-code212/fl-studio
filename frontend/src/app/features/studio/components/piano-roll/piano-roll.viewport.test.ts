import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeColumnWindow,
  computeGridCells,
  computeRowWindow,
  type ColumnWindowInput,
  type RowWindowInput
} from './piano-roll.viewport.ts';

const baseColumns: ColumnWindowInput = {
  scrollLeft: 0,
  viewportWidth: 400,
  keyWidth: 45,
  stepWidth: 21,
  total: 64,
  overscan: 8,
  chunk: 8
};

const baseRows: RowWindowInput = {
  scrollTop: 0,
  viewportHeight: 300,
  rowHeight: 22,
  headerHeight: 24,
  total: 128,
  overscan: 6,
  chunk: 12
};

test('columns at origin render only the leading window, not every step', () => {
  const window = computeColumnWindow(baseColumns);
  assert.deepEqual(window, { start: 0, end: 40 });
  assert.ok(window.end < baseColumns.total, 'should not render all 64 columns');
});

test('columns follow horizontal scrolling and round to chunk boundaries', () => {
  const window = computeColumnWindow({ ...baseColumns, scrollLeft: 900 });
  assert.deepEqual(window, { start: 32, end: 64 });
});

test('column window clamps to the total when scrolled past the end', () => {
  const window = computeColumnWindow({ ...baseColumns, scrollLeft: 5000 });
  assert.deepEqual(window, { start: 64, end: 64 });
});

test('rows at origin render only a viewport-sized slice', () => {
  const window = computeRowWindow(baseRows);
  assert.deepEqual(window, { start: 0, end: 36 });
  assert.ok(window.end < baseRows.total, 'should not render all 128 rows');
});

test('rows follow vertical scrolling and round to chunk boundaries', () => {
  const window = computeRowWindow({ ...baseRows, scrollTop: 1000 });
  assert.deepEqual(window, { start: 36, end: 84 });
});

test('row window clamps to the total when scrolled to the bottom', () => {
  const window = computeRowWindow({ ...baseRows, scrollTop: 100000 });
  assert.deepEqual(window, { start: 128, end: 128 });
});

test('grid cells follow the magnet division: 1/4 shows four cells per bar', () => {
  const cells = computeGridCells(0, 64, 64, 4);
  assert.equal(cells.length, 16, '4 bars x 4 quarter cells');
  assert.deepEqual(cells[0], { start: 0, length: 4 });
  assert.deepEqual(cells[1], { start: 4, length: 4 });
  assert.equal(cells.length / 4, 4, 'four cells per bar');
});

test('grid cells are per step at 1/16', () => {
  const cells = computeGridCells(0, 64, 64, 1);
  assert.equal(cells.length, 64);
  assert.deepEqual(cells[5], { start: 5, length: 1 });
  assert.equal(cells.length / 4, 16, 'sixteen cells per bar');
});

test('grid cells align to whole groups when the visible window starts mid-group', () => {
  const cells = computeGridCells(5, 20, 64, 4);
  assert.deepEqual(
    cells.map(cell => cell.start),
    [4, 8, 12, 16]
  );
});

test('grid cells clamp the final partial group', () => {
  assert.deepEqual(computeGridCells(0, 10, 10, 4), [
    { start: 0, length: 4 },
    { start: 4, length: 4 },
    { start: 8, length: 2 }
  ]);
});

test('empty content yields no grid cells', () => {
  assert.deepEqual(computeGridCells(0, 0, 0, 4), []);
});

test('empty content yields an empty window', () => {
  assert.deepEqual(computeColumnWindow({ ...baseColumns, total: 0 }), { start: 0, end: 0 });
  assert.deepEqual(computeRowWindow({ ...baseRows, total: 0 }), { start: 0, end: 0 });
});

test('scrolling above the sticky header never produces a negative start', () => {
  const window = computeRowWindow({ ...baseRows, scrollTop: 10 });
  assert.deepEqual(window, { start: 0, end: 36 });
});

test('window is always bounded by the total for arbitrary scroll offsets', () => {
  let seed = 123456789;
  const random = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 500; i++) {
    const columns = computeColumnWindow({
      ...baseColumns,
      scrollLeft: random() * 20000,
      viewportWidth: random() * 2000,
      total: Math.floor(random() * 300)
    });
    assert.ok(columns.start >= 0 && columns.end >= columns.start, 'columns ordered');
    assert.ok(columns.end <= 300, 'columns bounded by total');

    const rows = computeRowWindow({
      ...baseRows,
      scrollTop: random() * 20000,
      viewportHeight: random() * 2000,
      total: Math.floor(random() * 300)
    });
    assert.ok(rows.start >= 0 && rows.end >= rows.start, 'rows ordered');
    assert.ok(rows.end <= 300, 'rows bounded by total');
  }
});
