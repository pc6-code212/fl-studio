import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(
  new URL('./piano-roll.component.css', import.meta.url),
  'utf8'
);

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(match, `expected a "${selector}" rule in piano-roll.component.css`);
  return match[1];
}

function zIndex(body: string): number {
  const match = /z-index\s*:\s*(-?\d+)/.exec(body);
  return match ? Number(match[1]) : 0;
}

test('piano keys stay pinned to the left edge', () => {
  const key = rule('.key');
  assert.match(key, /position\s*:\s*sticky/);
  assert.match(key, /left\s*:\s*0/);
});

test('piano keys are opaque so horizontally-scrolled notes hide behind them', () => {
  assert.match(rule('.key'), /background\s*:/);
});

test('note blocks receive pointer events so they can be dragged', () => {
  assert.match(rule('.note-block'), /pointer-events\s*:\s*auto/);
});

test('note resize handles have a grabbable hit area', () => {
  const handle = rule('.note-handle');
  const width = Number(/width\s*:\s*(\d+)px/.exec(handle)?.[1] ?? 0);
  assert.ok(width >= 7, `handle width ${width}px is too small to grab`);
});

test('note blocks keep a minimum width so handles never collapse', () => {
  assert.match(rule('.note-block'), /min-width\s*:\s*\d+px/);
});

test('black keys are narrower dark caps over the white key bed', () => {
  const cap = rule('.key.black::before');
  const width = Number(/width\s*:\s*([\d.]+)%/.exec(cap)?.[1] ?? 100);
  assert.ok(width < 100, `black key cap ${width}% must be narrower than the white key`);
  assert.match(cap, /background\s*:/);
});

test('beat lines exist and are lighter than the bar lines', () => {
  const alpha = (body: string): number => {
    const match = /rgba\(([^)]+)\)/.exec(body);
    if (!match) {
      return 1;
    }
    const parts = match[1].split(',');
    return Number(parts[parts.length - 1]);
  };
  const bar = rule('.note-cell.bar-edge');
  const beat = rule('.note-cell.beat-edge');
  assert.match(beat, /border-left\s*:/);
  assert.ok(
    alpha(beat) < alpha(bar),
    `beat line alpha ${alpha(beat)} must be lighter than bar alpha ${alpha(bar)}`
  );
});

test('piano keys paint above note blocks so notes never cover them', () => {
  const keyZ = zIndex(rule('.key'));
  const noteBlockZ = zIndex(rule('.note-block'));
  assert.ok(
    keyZ > noteBlockZ,
    `key z-index ${keyZ} must exceed note-block z-index ${noteBlockZ}`
  );
});
