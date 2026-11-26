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
const pageTs = readFileSync(
  new URL('../../pages/studio.page.ts', import.meta.url),
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

test('floating panes expose top, right, bottom and left resize handles', () => {
  const edges: [string, string][] = [
    ['n', 'top'],
    ['e', 'right'],
    ['s', 'bottom'],
    ['w', 'left']
  ];
  for (const id of ['channelRack', 'pianoRoll', 'playlist']) {
    for (const [edge, side] of edges) {
      assert.match(
        html,
        new RegExp(`class="resize-edge ${side}"[^>]*edge: '${edge}'`)
      );
    }
  }
  for (const [edge] of edges) {
    assert.match(
      page,
      new RegExp(`onPanelResizeStart\\('mixer', \\$event, '${edge}'\\)`)
    );
  }
});

test('resizing is edge aware from the page down to the store', () => {
  assert.match(store, /resizePanelFrom\(/);
  assert.match(store, /resizePanelRect\(start, edge, dx, dy/);
  assert.match(pageTs, /store\.resizePanelFrom\(/);
  assert.doesNotMatch(pageTs, /setPanelSize\(/);
});

test('toggling one panel no longer clears every other maximized panel', () => {
  assert.match(store, /togglePanelMaximizedState\(states, id\)/);
  assert.doesNotMatch(store, /maximized: key === id \? maximized : false/);
});
