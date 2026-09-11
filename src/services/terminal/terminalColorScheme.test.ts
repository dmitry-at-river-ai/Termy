import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyColorScheme,
  encodeColorSchemeReport,
  COLOR_SCHEME_REQUEST_PARAM,
  COLOR_SCHEME_UPDATE_MODE,
} from './terminalColorScheme.ts';

test('color-scheme protocol uses the DEC 2031 / DSR 996 parameters', () => {
  assert.equal(COLOR_SCHEME_UPDATE_MODE, 2031);
  assert.equal(COLOR_SCHEME_REQUEST_PARAM, 996);
});

test('encodeColorSchemeReport emits the CSI ? 997 report TUIs parse', () => {
  assert.equal(encodeColorSchemeReport('dark'), '\x1b[?997;1n');
  assert.equal(encodeColorSchemeReport('light'), '\x1b[?997;2n');
});

test('classifyColorScheme reads the Obsidian hex background shapes', () => {
  assert.equal(classifyColorScheme('#1e1e1e'), 'dark');
  assert.equal(classifyColorScheme('#ffffff'), 'light');
  assert.equal(classifyColorScheme('#FFF'), 'light');
  assert.equal(classifyColorScheme('#000'), 'dark');
  assert.equal(classifyColorScheme('#1e1e1eff'), 'dark');
});

test('classifyColorScheme reads functional rgb notation', () => {
  assert.equal(classifyColorScheme('rgb(30, 30, 30)'), 'dark');
  assert.equal(classifyColorScheme('rgba(255, 255, 255, 0.5)'), 'light');
  assert.equal(classifyColorScheme('rgb(100% 100% 100%)'), 'light');
});

test('classifyColorScheme reports nothing for values it cannot read', () => {
  assert.equal(classifyColorScheme(undefined), undefined);
  assert.equal(classifyColorScheme(''), undefined);
  assert.equal(classifyColorScheme('transparent'), undefined);
  assert.equal(classifyColorScheme('var(--background-primary)'), undefined);
  assert.equal(classifyColorScheme('#12345'), undefined);
});

test('classifyColorScheme puts the light/dark boundary on perceived luma', () => {
  // Pi's light palette paints tool and code blocks with this pale green; it must
  // classify as light so a terminal showing it never reports "dark".
  assert.equal(classifyColorScheme('#e8f0e8'), 'light');
  // Pi's dark palette equivalent.
  assert.equal(classifyColorScheme('#283228'), 'dark');
});
