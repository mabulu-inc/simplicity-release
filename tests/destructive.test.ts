import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type GitRunner, gitRunner } from '../src/git.js';
import { allowDestructiveArgs, allowsDestructive } from '../src/destructive.js';

let dir: string;
let git: GitRunner;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'smplcty-destructive-'));
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

describe('allowsDestructive', () => {
  it('reads the trailer from the commit a tag names', () => {
    commit('release: v1.0.0\n\nRelease-Allows-Destructive: true');
    git(['tag', '-a', '-m', 'Release v1.0.0', 'v1.0.0']);
    commit('later work');
    expect(allowsDestructive('v1.0.0', git)).toBe(true);
    expect(allowsDestructive('HEAD', git)).toBe(false);
  });

  it.each([
    ['no trailer', 'release: v1.0.0'],
    ['another value', 'release: v1.0.0\n\nRelease-Allows-Destructive: yes'],
    [
      'conflicting values',
      'release: v1.0.0\n\nRelease-Allows-Destructive: true\nRelease-Allows-Destructive: false',
    ],
    ['the words outside a trailer', 'release: v1.0.0 Release-Allows-Destructive: true'],
  ])('fails closed on %s', (_name, message) => {
    commit(message);
    expect(allowsDestructive('HEAD', git)).toBe(false);
  });

  it('fails closed on a ref it cannot read', () => {
    commit('release: v1.0.0\n\nRelease-Allows-Destructive: true');
    expect(allowsDestructive('v9.9.9', git)).toBe(false);
    expect(allowsDestructive('--all', git)).toBe(false);
  });
});

describe('allowDestructiveArgs', () => {
  const config = () => join(dir, '.release-it.local.json');
  const TRAILER = '--git.commitArgs=--trailer=Release-Allows-Destructive:true';

  it('adds the trailer when the config sets no commitArgs', () => {
    writeFileSync(config(), JSON.stringify({ extends: 'x' }));
    expect(allowDestructiveArgs(config())).toEqual([TRAILER]);
    expect(allowDestructiveArgs(join(dir, 'missing.json'))).toEqual([TRAILER]);
  });

  it('passes the config\'s own commitArgs again, array or string', () => {
    writeFileSync(config(), JSON.stringify({ git: { commitArgs: ['-S', '--signoff'] } }));
    expect(allowDestructiveArgs(config())).toEqual([
      '--git.commitArgs=-S',
      '--git.commitArgs=--signoff',
      TRAILER,
    ]);
    writeFileSync(config(), JSON.stringify({ git: { commitArgs: '-S --signoff' } }));
    expect(allowDestructiveArgs(config())).toEqual([
      '--git.commitArgs=-S',
      '--git.commitArgs=--signoff',
      TRAILER,
    ]);
  });

  it('refuses a config it cannot read as JSON', () => {
    writeFileSync(config(), 'module.exports = {}');
    expect(() => allowDestructiveArgs(config())).toThrow(/needs a JSON release-it config/);
  });
});
