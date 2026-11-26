import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = readFileSync(new URL('./studio.store.ts', import.meta.url), 'utf8');

const panelsBlock =
  /readonly panels = signal<PanelStates>\(\{([\s\S]*?)\n  \}\);/.exec(store)?.[1] ??
  '';

function panelBlock(id: string): string {
  return new RegExp(`${id}:\\s*\\{([\\s\\S]*?)\\n    \\}`).exec(panelsBlock)?.[1] ?? '';
}

test('playlist is the only panel maximized by default', () => {
  const playlist = panelBlock('playlist');
  assert.match(playlist, /open:\s*true/);
  assert.match(playlist, /maximized:\s*true/);

  for (const id of ['channelRack', 'pianoRoll', 'mixer']) {
    const block = panelBlock(id);
    assert.match(block, /open:\s*false/, `${id} should start closed`);
    assert.match(block, /maximized:\s*false/, `${id} should not start maximized`);
  }
});

test('playlist starts in front of the other panels', () => {
  assert.match(
    store,
    /readonly panelOrder = signal<PanelId\[\]>\(\[\s*'channelRack',\s*'pianoRoll',\s*'mixer',\s*'playlist'\s*\]\)/
  );
});

test('showing another panel while one is maximized pops it out', () => {
  const openPanel =
    /private openPanel\(id: PanelId\): void \{([\s\S]*?)\n  \}/.exec(store)?.[1] ??
    '';

  assert.match(openPanel, /hasOtherMaximized\(panels, id\)/);
  assert.match(openPanel, /floating/);
  assert.match(openPanel, /maximized: false/);
  assert.doesNotMatch(openPanel, /maximized: hasOtherMaximized/);
});

test('focusing a hidden docked panel pops it out instead of maximizing it', () => {
  const focusPanel =
    /private focusPanel\(id: PanelId\): void \{([\s\S]*?)\n  \}/.exec(store)?.[1] ??
    '';

  assert.match(focusPanel, /popPanelOut\(states, id\)/);
  assert.doesNotMatch(focusPanel, /togglePanelMaximized\(id\)/);
});
