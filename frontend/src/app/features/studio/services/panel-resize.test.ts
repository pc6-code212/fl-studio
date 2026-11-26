import test from 'node:test';
import assert from 'node:assert/strict';
import { resizePanelRect, type PanelRect, type ResizeLimits } from './panel-resize.ts';

const rect: PanelRect = { x: 100, y: 100, width: 200, height: 200 };
const min: ResizeLimits = { width: 50, height: 50 };

test('right edge grows the width and keeps the left edge fixed', () => {
  const next = resizePanelRect(rect, 'e', 40, 0, min);
  assert.equal(next.x, 100);
  assert.equal(next.width, 240);
  assert.equal(next.height, 200);
});

test('left edge moves x and grows the width from the fixed right edge', () => {
  const next = resizePanelRect(rect, 'w', -40, 0, min);
  assert.equal(next.x, 60);
  assert.equal(next.width, 240);
  assert.equal(next.x + next.width, rect.x + rect.width);
});

test('bottom edge grows the height and keeps the top edge fixed', () => {
  const next = resizePanelRect(rect, 's', 0, 40, min);
  assert.equal(next.y, 100);
  assert.equal(next.height, 240);
});

test('top edge moves y and grows the height from the fixed bottom edge', () => {
  const next = resizePanelRect(rect, 'n', 0, -40, min);
  assert.equal(next.y, 60);
  assert.equal(next.height, 240);
  assert.equal(next.y + next.height, rect.y + rect.height);
});

test('shrinking a west edge never crosses the fixed right edge', () => {
  const next = resizePanelRect(rect, 'w', 500, 0, min);
  assert.equal(next.width, min.width);
  assert.equal(next.x + next.width, rect.x + rect.width);
});

test('shrinking an east edge stops at the minimum width', () => {
  const next = resizePanelRect(rect, 'e', -500, 0, min);
  assert.equal(next.x, 100);
  assert.equal(next.width, min.width);
});

test('shrinking a north edge stops at the minimum height', () => {
  const next = resizePanelRect(rect, 'n', 0, 500, min);
  assert.equal(next.height, min.height);
  assert.equal(next.y + next.height, rect.y + rect.height);
});

test('corners resize both axes at once', () => {
  const se = resizePanelRect(rect, 'se', 10, 20, min);
  assert.equal(se.width, 210);
  assert.equal(se.height, 220);

  const nw = resizePanelRect(rect, 'nw', 10, 10, min);
  assert.equal(nw.x, 110);
  assert.equal(nw.y, 110);
  assert.equal(nw.width, 190);
  assert.equal(nw.height, 190);
});
