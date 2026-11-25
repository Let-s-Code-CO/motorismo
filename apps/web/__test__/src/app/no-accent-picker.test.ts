// @vitest-environment node
/**
 * Spec 019, RF-02: the accent is fixed. The colour picker used to try accents while exploring the
 * look must never reach the app: no file of `src` names it or its saved preference.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '../../../src');
const PICKER = /accent-picker|AccentPicker|motorismo-explore-accent/;

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
  });

describe('the accent is fixed (spec 019, RF-02)', () => {
  it('has no colour picker anywhere in the app', () => {
    const offenders = files(SRC)
      .filter((path) => PICKER.test(readFileSync(path, 'utf8')) || PICKER.test(path))
      .map((path) => relative(SRC, path));

    expect(offenders).toEqual([]);
  });
});
