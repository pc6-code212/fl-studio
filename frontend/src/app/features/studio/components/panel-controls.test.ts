import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panels = ['channel-rack', 'mixer-panel', 'piano-roll', 'playlist'] as const;

function read(name: string, ext: 'html' | 'ts' | 'css'): string {
  return readFileSync(
    new URL(`./${name}/${name}.component.${ext}`, import.meta.url),
    'utf8'
  );
}

for (const name of panels) {
  test(`${name}: hiding collapses the whole host, header included`, () => {
    const ts = read(name, 'ts');
    const css = read(name, 'css');
    const rule = /:host\(\.collapsed\)\s*\{([^}]*)\}/.exec(css);

    assert.match(ts, /host:\s*\{\s*'\[class\.collapsed\]':\s*'collapsed\(\)'\s*\}/);
    assert.ok(rule, 'expected a :host(.collapsed) rule');
    assert.match(rule![1], /display\s*:\s*none/);
  });

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

  test(`${name}: header exposes a maximize button wired to maximizeToggle`, () => {
    const html = read(name, 'html');
    const button = html
      .split('\n')
      .find(line => line.includes('maximizeToggle.emit()'));

    assert.ok(button, 'expected a win-btn wired to maximizeToggle.emit()');
    assert.match(button!, /\[title\]="maximized\(\) \? 'Pop out' : 'Maximize'"/);
    assert.doesNotMatch(button!, /floatToggle\.emit\(\)/);
  });

  test(`${name}: header double-click still pops out and docks`, () => {
    const html = read(name, 'html');
    const ts = read(name, 'ts');
    assert.match(html, /\(dblclick\)="onHeaderDoubleClick\(\$event\)"/);
    const method = /onHeaderDoubleClick\([\s\S]*?\n  \}/.exec(ts)?.[0] ?? '';
    assert.match(method, /this\.floatToggle\.emit\(\);/);
  });
}
