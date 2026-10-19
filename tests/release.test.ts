import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { computeBump } from '../src/changelog.js';
import { type GitRunner, gitRunner } from '../src/git.js';
import { allowsDestructive } from '../src/destructive.js';
import { preflight, readPendingEntries, release } from '../src/release.js';

// These run against a real throwaway git repo: the contracts are about what lands on
// disk and in history, which a stub cannot show.

const CHANGELOG = '# Changelog\n\n## [Unreleased]\n\n## [2.5.0] - 2020-01-01\n\n### Added\n\n- seed\n';

let dir: string;
let git: GitRunner;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'smplcty-release-'));
  git = gitRunner(dir);
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'test']);
  git(['config', 'commit.gpgsign', 'false']);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Commit a repo at `version` with the given [Unreleased] body and changelog.d/ files.
function seed({
  version = '2.5.0',
  unreleased = '',
  entries = {},
}: { version?: string; unreleased?: string; entries?: Record<string, string> }): void {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version }));
  writeFileSync(
    join(dir, 'CHANGELOG.md'),
    CHANGELOG.replace('## [Unreleased]\n', `## [Unreleased]\n${unreleased}`),
  );
  mkdirSync(join(dir, 'changelog.d'));
  for (const [name, content] of Object.entries(entries)) {
    writeFileSync(join(dir, 'changelog.d', name), content);
  }
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'seed']);
}

const snapshot = () => ({
  head: git(['rev-parse', 'HEAD']),
  status: git(['status', '--porcelain', '--untracked-files=all']),
  changelog: readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'),
  entries: readPendingEntries(join(dir, 'changelog.d')),
});

// Run a release, recording the argv release-it got and the tree state it saw.
function run(argv: string[]) {
  const calls: Array<{ args: string[]; status: string }> = [];
  const code = release(argv, {
    cwd: dir,
    runReleaseIt: (args) => {
      calls.push({ args, status: git(['status', '--porcelain', '--untracked-files=all']) });
      return 0;
    },
  });
  return { code, calls };
}

const mustNotRun = () => {
  throw new Error('release-it must not run');
};

// Give the seeded repo a remote and a local config extending the shared preset, then
// return a runner for the real release-it against it.
function realReleaseIt(overrides: object): (args: string[]) => number {
  const remote = join(dir, '.origin.git');
  git(['init', '-q', '--bare', remote]);
  git(['remote', 'add', 'origin', remote]);
  writeFileSync(join(dir, '.git', 'info', 'exclude'), '.origin.git/\n');
  writeFileSync(
    join(dir, '.release-it.local.json'),
    JSON.stringify({
      extends: resolve('configs/release-it.base.json'),
      github: { release: false },
      ...overrides,
    }),
  );
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'config']);
  git(['push', '-q', '-u', 'origin', 'main']);
  const bin = resolve('node_modules/release-it/bin/release-it.js');
  return (args) =>
    spawnSync(process.execPath, [bin, ...args, '--ci'], { cwd: dir, stdio: 'ignore' }).status ?? 1;
}

describe('release — changelog.d fold', () => {
  it('folds entries by section, commits, and removes the files before release-it runs', () => {
    seed({
      entries: {
        'a.md': '### Fixed\n\n- one\n',
        'b.md': '### Fixed\n- two\n',
        'README.md': '# changelog.d\n\nOne file per change.\n',
      },
    });
    const { calls } = run([]);

    expect(calls).toEqual([{ args: ['patch', '--config', '.release-it.local.json'], status: '' }]);
    const changelog = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
    expect(changelog.match(/### Fixed/g)).toHaveLength(1);
    expect(changelog).toContain('## [Unreleased]\n\n### Fixed\n\n- one\n- two\n\n## [2.5.0]');
    expect(readPendingEntries(join(dir, 'changelog.d'))).toEqual([]);
    expect(existsSync(join(dir, 'changelog.d', 'README.md'))).toBe(true);
    expect(git(['log', '-1', '--format=%s']).trim()).toBe(
      'changelog: fold changelog.d entries into [Unreleased]',
    );
  });

  it('derives the same version before and after the fold', () => {
    seed({ unreleased: '\n### Fixed\n- y\n', entries: { 'a.md': '### Added\n- x\n' } });
    const before = run(['--release-version']).calls[0]?.args[0];
    const after = run([]).calls[0]?.args[0];

    expect(before).toBe('minor');
    expect(after).toBe('minor');
    expect(computeBump(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'))).toBe('minor');
  });

  it('with nothing pending, makes no commit', () => {
    seed({ unreleased: '\n### Fixed\n- y\n' });
    const before = snapshot();
    expect(run([]).calls[0]?.args[0]).toBe('patch');
    expect(snapshot()).toEqual(before);
  });

  it.each([['--dry-run'], ['-d'], ['--release-version'], ['--changelog']])(
    'read-only %s never mutates the repo',
    (flag) => {
      seed({ entries: { 'a.md': '### Added\n- x\n' } });
      const before = snapshot();
      const { calls } = run([flag]);
      expect(calls[0]?.args).toEqual(['minor', flag, '--config', '.release-it.local.json']);
      expect(snapshot()).toEqual(before);
    },
  );
});

describe('release — refusals leave the working tree untouched', () => {
  it.each([
    ['version below the changelog bump', ['--release-as=2.5.1'], {}, /below 2\.6\.0/],
    ['invalid semver', ['--release-as=next'], {}, /not a valid semver/],
    ['version not above current', ['--release-as=2.5.0'], {}, /not above/],
    ['--release-as with --rc', ['--release-as=3.0.0', '--rc'], {}, /cannot be combined/],
    ['bare --release-as', ['--release-as'], {}, /needs a version/],
    [
      'entry with content before its first heading',
      [],
      { 'bad.md': 'a stray note\n### Fixed\n- x\n' },
      /bad\.md: content before the first/,
    ],
    [
      'entry under a non-Keep a Changelog heading',
      [],
      { 'bad.md': '### Notes\n- x\n' },
      /not a Keep a Changelog section/,
    ],
  ])('%s', (_name, argv, extra, error) => {
    seed({ entries: { 'a.md': '### Added\n- x\n', ...extra } });
    const before = snapshot();
    expect(() => release(argv, { cwd: dir, runReleaseIt: mustNotRun })).toThrow(error);
    expect(snapshot()).toEqual(before);
  });

  it('a dirty tree is refused before the fold', () => {
    seed({ entries: { 'a.md': '### Added\n- x\n' } });
    writeFileSync(join(dir, 'scratch.txt'), 'wip\n');
    const before = snapshot();
    expect(() => release([], { cwd: dir, runReleaseIt: mustNotRun })).toThrow(/uncommitted/);
    expect(snapshot()).toEqual(before);
  });

  it('nothing to release on a prerelease names how to cut the final', () => {
    seed({ version: '3.11.0-rc.7' });
    expect(() => release([], { cwd: dir, runReleaseIt: mustNotRun })).toThrow(
      /3\.11\.0-rc\.7 is a prerelease.*add a changelog\.d\/ entry summarizing what the release ships/,
    );
  });

  it('nothing to release on a final version says only that', () => {
    seed({});
    expect(() => release([], { cwd: dir, runReleaseIt: mustNotRun })).toThrow(
      /^release: nothing to release — \[Unreleased\] and changelog\.d\/ have no entries$/,
    );
  });
});

describe('release — a failed release-it run undoes the fold', () => {
  it('a non-zero exit before the release commit restores the repo', () => {
    seed({ entries: { 'a.md': '### Fixed\n- x\n' } });
    const before = snapshot();
    expect(release([], { cwd: dir, runReleaseIt: () => 1 })).toBe(1);
    expect(snapshot()).toEqual(before);
  });

  it('a throw (say, gh auth token failing) restores the repo and rethrows', () => {
    seed({ entries: { 'a.md': '### Fixed\n- x\n' } });
    const before = snapshot();
    expect(() => release([], { cwd: dir, runReleaseIt: mustNotRun })).toThrow(/must not run/);
    expect(snapshot()).toEqual(before);
  });

  it('a failure after the release commit leaves history alone', () => {
    seed({ entries: { 'a.md': '### Fixed\n- x\n' } });
    const code = release([], {
      cwd: dir,
      runReleaseIt: () => {
        git(['commit', '-q', '--allow-empty', '-m', 'release: v2.5.1']);
        return 1;
      },
    });
    expect(code).toBe(1);
    expect(git(['log', '--format=%s', '-2']).trim().split('\n')).toEqual([
      'release: v2.5.1',
      'changelog: fold changelog.d entries into [Unreleased]',
    ]);
  });

  it('a refusing before:init hook in real release-it leaves the repo as found', () => {
    seed({ entries: { 'a.md': '### Fixed\n- x\n' } });
    const runReleaseIt = realReleaseIt({ hooks: { 'before:init': 'exit 1' } });
    const before = snapshot();

    expect(release([], { cwd: dir, runReleaseIt })).not.toBe(0);
    expect(snapshot()).toEqual(before);
    expect(git(['tag'])).toBe('');
  }, 30_000);
});

describe('release — --allow-destructive', () => {
  it('declares it on the release commit the tag names, keeping the config\'s commitArgs', () => {
    seed({ entries: { 'a.md': '### Fixed\n- x\n' } });
    const runReleaseIt = realReleaseIt({ git: { commitArgs: ['--signoff'] } });

    expect(release(['--allow-destructive', '--alpha'], { cwd: dir, runReleaseIt })).toBe(0);
    expect(allowsDestructive('v2.5.1-alpha.0', git)).toBe(true);
    expect(git(['log', '-1', '--format=%(trailers:key=Signed-off-by,valueonly)']).trim()).toBe(
      'test <test@example.com>',
    );

    writeFileSync(join(dir, 'changelog.d', 'b.md'), '### Fixed\n- y\n');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'more']);
    git(['push', '-q']);
    expect(release(['--alpha'], { cwd: dir, runReleaseIt })).toBe(0);
    expect(allowsDestructive('v2.5.1-alpha.1', git)).toBe(false);
  }, 30_000);

  it('a config it cannot read is refused before the fold', () => {
    seed({ entries: { 'a.md': '### Fixed\n- x\n' } });
    writeFileSync(join(dir, '.release-it.local.json'), 'not json');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'config']);
    const before = snapshot();
    expect(() => release(['--allow-destructive'], { cwd: dir, runReleaseIt: mustNotRun })).toThrow(
      /needs a JSON release-it config/,
    );
    expect(snapshot()).toEqual(before);
  });
});

describe('release — prerelease line', () => {
  it('a ### Removed entry on a minor line re-opens it as premajor', () => {
    seed({ version: '2.6.0-rc.3', entries: { 'a.md': '### Removed\n- old endpoint\n' } });
    expect(run(['--rc', '--release-version']).calls[0]?.args.slice(0, 2)).toEqual([
      'premajor',
      '--preRelease=rc',
    ]);
  });
});

describe('preflight', () => {
  // Real git for status; no remote, so fetch and rev-list report "current".
  const offline = (): GitRunner => (args) =>
    args[0] === 'fetch' ? '' : args[0] === 'rev-list' ? '0\n' : git(args);

  it('counts pending changelog.d files as entries', () => {
    seed({ entries: { 'a.md': '### Fixed\n- x\n' } });
    expect(() => preflight('main', { cwd: dir, git: offline() })).not.toThrow();
  });
  it('a README alone is nothing to release', () => {
    seed({ entries: { 'README.md': '# changelog.d\n' } });
    expect(() => preflight('main', { cwd: dir, git: offline() })).toThrow(/nothing to release/);
  });
});
