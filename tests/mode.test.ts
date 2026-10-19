import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type GitRunner, gitRunner } from '../src/git.js';
import { allAtOnceArgs, releaseMode } from '../src/mode.js';

let dir: string;
let git: GitRunner;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'smplcty-mode-'));
  git = gitRunner(dir);
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'test']);
  git(['config', 'commit.gpgsign', 'false']);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const commit = (message: string) => git(['commit', '-q', '--allow-empty', '-m', message]);

describe('releaseMode', () => {
  it('reads the trailer from the commit a tag names', () => {
    commit('release: v1.0.0\n\nRelease-Mode: all-at-once');
    git(['tag', '-a', '-m', 'Release v1.0.0', 'v1.0.0']);
    commit('later work');
    expect(releaseMode('v1.0.0', git)).toBe('all-at-once');
    expect(releaseMode('HEAD', git)).toBe('additive');
  });

  it.each([
    ['no trailer', 'release: v1.0.0'],
    ['another value', 'release: v1.0.0\n\nRelease-Mode: destructive'],
    ['conflicting values', 'release: v1.0.0\n\nRelease-Mode: all-at-once\nRelease-Mode: additive'],
    ['the words outside a trailer', 'release: v1.0.0 Release-Mode: all-at-once'],
  ])('fails closed on %s', (_name, message) => {
    commit(message);
    expect(releaseMode('HEAD', git)).toBe('additive');
  });

  it('fails closed on a ref it cannot read', () => {
    commit('release: v1.0.0\n\nRelease-Mode: all-at-once');
    expect(releaseMode('v9.9.9', git)).toBe('additive');
    expect(releaseMode('--all', git)).toBe('additive');
  });
});

describe('allAtOnceArgs', () => {
  const config = () => join(dir, '.release-it.local.json');
  const TRAILER = '--git.commitArgs=--trailer=Release-Mode:all-at-once';

  it('adds the trailer when the config sets no commitArgs', () => {
    writeFileSync(config(), JSON.stringify({ extends: 'x' }));
    expect(allAtOnceArgs(config())).toEqual([TRAILER]);
    expect(allAtOnceArgs(join(dir, 'missing.json'))).toEqual([TRAILER]);
  });

  it('passes the config\'s own commitArgs again, array or string', () => {
    writeFileSync(config(), JSON.stringify({ git: { commitArgs: ['-S', '--signoff'] } }));
    expect(allAtOnceArgs(config())).toEqual([
      '--git.commitArgs=-S',
      '--git.commitArgs=--signoff',
      TRAILER,
    ]);
    writeFileSync(config(), JSON.stringify({ git: { commitArgs: '-S --signoff' } }));
    expect(allAtOnceArgs(config())).toEqual([
      '--git.commitArgs=-S',
      '--git.commitArgs=--signoff',
      TRAILER,
    ]);
  });

  it('refuses a config it cannot read as JSON', () => {
    writeFileSync(config(), 'module.exports = {}');
    expect(() => allAtOnceArgs(config())).toThrow(/needs a JSON release-it config/);
  });
});
