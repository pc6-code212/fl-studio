import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panels = ['channel-rack', 'mixer-panel', 'piano-roll', 'playlist'] as const;

function read(name: string, ext: 'html' | 'ts'): string {
  return readFileSync(
    new URL(`./${name}/${name}.component.${ext}`, import.meta.url),
    'utf8'
  );
}

for (const name of panels) {
  test(`${name}: pop-out button toggles floating like the header double-click`, () => {
    const html = read(name, 'html');
    const button = html
      .split('\n')
      .find(line => line.includes('class="win-btn"') && line.includes('floatToggle.emit()'));

    assert.ok(button, 'expected a win-btn wired to floatToggle.emit()');
    assert.match(button!, /\[title\]="floating\(\) \? 'Dock' : 'Pop out'"/);
    assert.match(button!, /floating\(\) \? '❐' : '□'/);
    assert.doesNotMatch(button!, /maximizeToggle\.emit\(\)/);
  });

  test(`${name}: component exposes the floating state used by the button`, () => {
    const ts = read(name, 'ts');
    assert.match(ts, /readonly floating = input<boolean>\(false\);/);
  });

  test(`${name}: header double-click still pops out and docks`, () => {
    const html = read(name, 'html');
    const ts = read(name, 'ts');
    assert.match(html, /\(dblclick\)="onHeaderDoubleClick\(\$event\)"/);
    const method = /onHeaderDoubleClick\([\s\S]*?\n  \}/.exec(ts)?.[0] ?? '';
    assert.match(method, /this\.floatToggle\.emit\(\);/);
  });
}
