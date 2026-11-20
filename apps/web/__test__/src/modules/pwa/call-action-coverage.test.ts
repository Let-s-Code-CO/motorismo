// @vitest-environment node
/**
 * Every call from a component to a Server Action goes through callAction (spec 006, CA-10).
 *
 * If the network drops while sending, callAction turns the app offline and keeps the form as it
 * was; a call without it lets the error unmount the form and lose what was typed. This test reads
 * every component that imports a Server Action and fails if one calls it outside callAction, so a
 * new form cannot forget it (the rule is in CLAUDE.md too).
 *
 * The check works on the source text, statement by statement: an action may be named only inside
 * a statement that calls callAction, or a local helper that itself calls callAction (such as
 * `run` in the users screen). Comments and strings (translation keys) are ignored.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '../../../../src');

const IMPORT_OF_ACTIONS =
  /import\s*\{([^}]+)\}\s*from\s*'@web\/modules\/[\w-]+\/actions\/[\w.-]+\.actions';/g;

const stripComments = (source: string) =>
  source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

/** Local helpers whose body calls callAction: `const run = (action) => { … callAction(action) … }`. */
const guardedHelpers = (source: string) =>
  [...source.matchAll(/const (\w+) = \(/g)]
    .filter((match) => source.slice(match.index, match.index + 400).includes('callAction('))
    .map((match) => match[1]);

/** The Server Actions a component names outside a statement guarded by callAction. */
export const unguardedActionCalls = (rawSource: string) => {
  const source = stripComments(rawSource);
  const actions = [...source.matchAll(IMPORT_OF_ACTIONS)].flatMap(([, names = '']) =>
    names
      .split(',')
      .map((name) =>
        name
          .trim()
          .split(/\s+as\s+/)
          .pop()!
      )
      .filter(Boolean)
  );
  // Without imports and string literals: an action's name may also be a translation key.
  const body = source.replace(IMPORT_OF_ACTIONS, '').replace(/'[^'\n]*'|"[^"\n]*"/g, "''");
  const guards = ['callAction(', ...guardedHelpers(body).map((name) => `${name}(`)];

  return actions.filter((action) =>
    [...body.matchAll(new RegExp(`\\b${action}\\b`, 'g'))].some((use) => {
      const before = body.slice(0, use.index);
      const statementStart = Math.max(before.lastIndexOf(';'), before.lastIndexOf('{\n'));
      return !guards.some((guard) => before.lastIndexOf(guard) > statementStart);
    })
  );
};

const componentFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return componentFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });

describe('unguardedActionCalls (the rule itself)', () => {
  const file = (body: string) =>
    `import { saveThing } from '@web/modules/things/actions/things.actions';\n${body}`;

  it('accepts a call wrapped in callAction, even across lines', () => {
    expect(
      unguardedActionCalls(file('const r = await callAction(() =>\n  saveThing({ id: 1 })\n);'))
    ).toEqual([]);
  });

  it('accepts a call through a local helper that uses callAction', () => {
    const source = file(
      'const run = (action) => { startTransition(async () => { await callAction(action); }); };\n' +
        'const save = () => run(() => saveThing({ id: 1 }));'
    );
    expect(unguardedActionCalls(source)).toEqual([]);
  });

  it('ignores the name inside a string, such as a translation key', () => {
    expect(unguardedActionCalls(file("const title = t('saveThing.title');"))).toEqual([]);
  });

  it('flags a direct call, and ignores the name in comments', () => {
    expect(
      unguardedActionCalls(file('// callAction(saveThing)\nconst r = await saveThing({ id: 1 });'))
    ).toEqual(['saveThing']);
  });
});

describe('every component calls its Server Actions through callAction (spec 006, CA-10)', () => {
  const files = componentFiles(join(SRC, 'modules')).filter((path) =>
    /from '@web\/modules\/[\w-]+\/actions\//.test(readFileSync(path, 'utf8'))
  );

  it('finds the components that call Server Actions (15 today)', () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  it.each(files.map((path) => [relative(SRC, path), path]))('%s', (_, path) => {
    expect(unguardedActionCalls(readFileSync(path, 'utf8'))).toEqual([]);
  });
});
