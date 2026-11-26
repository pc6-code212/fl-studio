import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(
  new URL('./max-section.component.html', import.meta.url),
  'utf8'
);
const store = readFileSync(
  new URL('../../services/studio.store.ts', import.meta.url),
  'utf8'
);
const page = readFileSync(
  new URL('../../pages/studio.page.html', import.meta.url),
  'utf8'
);

test('max section renders every maximized panel, not just the first', () => {
  assert.match(html, /@for \(id of store\.maximizedPanels\(\); track id\)/);
  assert.doesNotMatch(html, /maximizedPanel\(\)/);
});

test('each maximized layer gets its z-index from the panel stacking order', () => {
  assert.match(html, /\[style\.z-index\]="store\.panelZIndex\(id\)"/);
  assert.match(html, /\(pointerdown\)="store\.bringPanelToFront\(id\)"/);
});

test('store exposes the ordered list of maximized panels', () => {
  assert.match(store, /readonly maximizedPanels = computed\(/);
  assert.match(store, /panelZIndex\(id: PanelId\): number/);
  assert.match(store, /return panelLayerZIndex\(this\.panelOrder\(\), id\);/);
});

test('popped-out panes use the always-on-top z-index', () => {
  for (const id of ['channelRack', 'pianoRoll', 'playlist']) {
    assert.match(html, new RegExp(`store\\.floatingPanelZIndex\\('${id}'\\)`));
  }
  assert.match(page, /store\.floatingPanelZIndex\('mixer'\)/);
});

test('toggling one panel no longer clears every other maximized panel', () => {
  assert.match(store, /togglePanelMaximizedState\(states, id\)/);
  assert.doesNotMatch(store, /maximized: key === id \? maximized : false/);
});
