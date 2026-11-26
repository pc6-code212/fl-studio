import test from 'node:test';
import assert from 'node:assert/strict';
import type { PanelId, PanelStates } from '../models/studio.model.ts';
import {
  PANEL_IDS,
  hasOtherMaximized,
  maximizedPanelStack,
  movePanelToBack,
  movePanelToFront,
  panelLayerZIndex,
  setPanelMaximized,
  togglePanelMaximizedState
} from './panel-stack.ts';

function state(overrides: Partial<PanelStates[PanelId]> = {}) {
  return {
    open: false,
    collapsed: false,
    maximized: false,
    floating: false,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...overrides
  };
}

function states(): PanelStates {
  return {
    channelRack: state(),
    pianoRoll: state(),
    playlist: state(),
    mixer: state()
  };
}

test('movePanelToFront puts the panel last without duplicating it', () => {
  const order = movePanelToFront([...PANEL_IDS], 'channelRack');
  assert.equal(order[order.length - 1], 'channelRack');
  assert.equal(order.filter(id => id === 'channelRack').length, 1);
  assert.deepEqual(new Set(order), new Set(PANEL_IDS));
});

test('movePanelToFront is a no-op when the panel is already front', () => {
  const order = movePanelToFront([...PANEL_IDS], 'mixer');
  assert.deepEqual(order, [...PANEL_IDS]);
});

test('movePanelToBack drops the panel to the start of the stack', () => {
  const order = movePanelToBack([...PANEL_IDS], 'mixer');
  assert.equal(order[0], 'mixer');
  assert.equal(order.filter(id => id === 'mixer').length, 1);
});

test('maximizing a second panel keeps the first one maximized', () => {
  let panels = states();
  panels.channelRack.open = true;
  panels = setPanelMaximized(panels, 'channelRack', true);
  panels = setPanelMaximized(panels, 'pianoRoll', true);

  assert.equal(panels.channelRack.maximized, true);
  assert.equal(panels.pianoRoll.maximized, true);
  assert.equal(panels.pianoRoll.open, true);
});

test('restoring one panel leaves the other maximized panels alone', () => {
  let panels = states();
  panels = setPanelMaximized(panels, 'channelRack', true);
  panels = setPanelMaximized(panels, 'playlist', true);
  panels = setPanelMaximized(panels, 'playlist', false);

  assert.equal(panels.channelRack.maximized, true);
  assert.equal(panels.playlist.maximized, false);
});

test('pressing maximize on an already maximized panel pops it out', () => {
  let panels = states();
  panels.channelRack.open = true;
  panels = togglePanelMaximizedState(panels, 'channelRack');
  assert.equal(panels.channelRack.maximized, true);

  panels = togglePanelMaximizedState(panels, 'channelRack');
  assert.equal(panels.channelRack.maximized, false);
  assert.equal(panels.channelRack.floating, true);
  assert.equal(panels.channelRack.open, true);
});

test('pressing maximize on a popped-out panel maximizes it again', () => {
  let panels = states();
  panels.channelRack.open = true;
  panels.channelRack.floating = true;
  panels = togglePanelMaximizedState(panels, 'channelRack');

  assert.equal(panels.channelRack.maximized, true);
  assert.equal(panels.channelRack.floating, false);
});

test('popping one panel out does not disturb another maximized panel', () => {
  let panels = states();
  panels = togglePanelMaximizedState(panels, 'channelRack');
  panels = togglePanelMaximizedState(panels, 'pianoRoll');
  panels = togglePanelMaximizedState(panels, 'pianoRoll');

  assert.equal(panels.channelRack.maximized, true);
  assert.equal(panels.pianoRoll.maximized, false);
  assert.equal(panels.pianoRoll.floating, true);
});

test('maximizedPanelStack follows the stacking order and skips hidden panels', () => {
  let panels = states();
  panels.channelRack.open = true;
  panels.pianoRoll.open = true;
  panels.mixer.open = true;
  panels = setPanelMaximized(panels, 'channelRack', true);
  panels = setPanelMaximized(panels, 'pianoRoll', true);
  panels = setPanelMaximized(panels, 'mixer', true);

  const order: PanelId[] = ['mixer', 'channelRack', 'pianoRoll', 'playlist'];
  assert.deepEqual(maximizedPanelStack(panels, order), [
    'mixer',
    'channelRack',
    'pianoRoll'
  ]);

  panels.pianoRoll.collapsed = true;
  assert.deepEqual(maximizedPanelStack(panels, order), ['mixer', 'channelRack']);
});

test('the last focused maximized panel receives the highest z-index', () => {
  const order = movePanelToFront([...PANEL_IDS], 'pianoRoll');
  const z = PANEL_IDS.map(id => panelLayerZIndex(order, id));
  const top = panelLayerZIndex(order, 'pianoRoll');
  assert.equal(Math.max(...z), top);
  assert.ok(top > panelLayerZIndex(order, 'channelRack'));
});

test('panelLayerZIndex falls back to the base for unknown ids', () => {
  assert.equal(panelLayerZIndex([], 'mixer', 1000), 1000);
});

test('hasOtherMaximized ignores the panel itself and hidden panels', () => {
  let panels = states();
  panels.channelRack.open = true;
  panels = setPanelMaximized(panels, 'channelRack', true);

  assert.equal(hasOtherMaximized(panels, 'pianoRoll'), true);
  assert.equal(hasOtherMaximized(panels, 'channelRack'), false);

  panels.channelRack.collapsed = true;
  assert.equal(hasOtherMaximized(panels, 'pianoRoll'), false);
});
