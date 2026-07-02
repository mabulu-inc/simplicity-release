import { describe, it, expect } from 'vitest';
import { branchBehindCount, assertBranchCurrent, isWorkingTreeClean, type GitRunner } from '../src/git.js';

// A stub git runner driven by a map of "argv joined by space" -> stdout, with an
// optional set of argv-prefixes that should throw (to simulate a failed command).
const stubRunner =
  (responses: Record<string, string>, failures: string[] = []): GitRunner =>
  (args) => {
    const key = args.join(' ');
    if (failures.some((f) => key.startsWith(f))) throw new Error(`git ${key} failed`);
    return responses[key] ?? '';
  };

describe('branchBehindCount', () => {
  it('returns the rev-list count', () => {
    const run = stubRunner({ 'rev-list --count HEAD..origin/main': '3\n' });
    expect(branchBehindCount('main', run)).toBe(3);
  });
  it('returns 0 when up to date', () => {
    const run = stubRunner({ 'rev-list --count HEAD..origin/main': '0\n' });
    expect(branchBehindCount('main', run)).toBe(0);
  });
  it('throws (fails closed) when the fetch fails', () => {
    const run = stubRunner({}, ['fetch']);
    expect(() => branchBehindCount('main', run)).toThrow(/could not fetch/);
  });
});

describe('assertBranchCurrent', () => {
  it('passes when up to date', () => {
    const run = stubRunner({ 'rev-list --count HEAD..origin/main': '0\n' });
    expect(() => assertBranchCurrent('main', run)).not.toThrow();
  });
  it('blocks with an actionable pull hint when behind', () => {
    const run = stubRunner({ 'rev-list --count HEAD..origin/main': '2\n' });
    expect(() => assertBranchCurrent('main', run)).toThrow(/git pull --rebase origin main/);
  });
  it('blocks (fails closed) when the fetch fails', () => {
    const run = stubRunner({}, ['fetch']);
    expect(() => assertBranchCurrent('main', run)).toThrow(/could not fetch/);
  });
});

describe('isWorkingTreeClean', () => {
  it('true when porcelain status is empty', () => {
    expect(isWorkingTreeClean(stubRunner({ 'status --porcelain': '' }))).toBe(true);
  });
  it('false when there are changes', () => {
    expect(isWorkingTreeClean(stubRunner({ 'status --porcelain': ' M src/x.ts\n' }))).toBe(false);
  });
});
