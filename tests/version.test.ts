import { describe, it, expect } from 'vitest';
import { parseReleaseFlags, computeReleaseArgs } from '../src/version.js';

describe('parseReleaseFlags', () => {
  it('no flags → no preId, no passthru', () => {
    expect(parseReleaseFlags([])).toEqual({ preId: undefined, passthru: [] });
  });
  it('--alpha / --beta / --rc set the id', () => {
    expect(parseReleaseFlags(['--alpha']).preId).toBe('alpha');
    expect(parseReleaseFlags(['--beta']).preId).toBe('beta');
    expect(parseReleaseFlags(['--rc']).preId).toBe('rc');
  });
  it('--preRelease=<id> long form', () => {
    expect(parseReleaseFlags(['--preRelease=rc']).preId).toBe('rc');
  });
  it('unknown args pass through', () => {
    expect(parseReleaseFlags(['--dry-run', '--release-version'])).toEqual({
      preId: undefined,
      passthru: ['--dry-run', '--release-version'],
    });
  });
  it('tolerates a stray -- separator', () => {
    expect(parseReleaseFlags(['--', '--alpha']).preId).toBe('alpha');
  });
  it('repeated pre-flags: last wins', () => {
    expect(parseReleaseFlags(['--alpha', '--beta']).preId).toBe('beta');
  });
  it('bare --preRelease throws (would silently mis-release otherwise)', () => {
    expect(() => parseReleaseFlags(['--preRelease'])).toThrow(/needs an id/);
  });
  it('empty --preRelease= throws', () => {
    expect(() => parseReleaseFlags(['--preRelease='])).toThrow(/needs an id/);
  });
});

describe('computeReleaseArgs', () => {
  it('final release uses the changelog bump', () => {
    expect(computeReleaseArgs({ bump: 'minor', currentVersion: '2.5.0' })).toEqual(['minor']);
  });
  it('final release forwards passthru', () => {
    expect(
      computeReleaseArgs({ bump: 'patch', currentVersion: '2.5.0', passthru: ['--dry-run'] }),
    ).toEqual(['patch', '--dry-run']);
  });
  it('prerelease from a final version → pre<bump>', () => {
    expect(computeReleaseArgs({ bump: 'minor', currentVersion: '2.5.0', preId: 'alpha' })).toEqual([
      'preminor',
      '--preRelease=alpha',
    ]);
  });
  it('major bump prerelease → premajor', () => {
    expect(computeReleaseArgs({ bump: 'major', currentVersion: '2.5.0', preId: 'alpha' })).toEqual([
      'premajor',
      '--preRelease=alpha',
    ]);
  });
  it('continues the same prerelease line → prerelease', () => {
    expect(
      computeReleaseArgs({ bump: 'minor', currentVersion: '2.6.0-alpha.0', preId: 'alpha' }),
    ).toEqual(['prerelease', '--preRelease=alpha']);
  });
  it('switching prerelease id → pre<bump>', () => {
    expect(
      computeReleaseArgs({ bump: 'minor', currentVersion: '2.6.0-beta.1', preId: 'alpha' }),
    ).toEqual(['preminor', '--preRelease=alpha']);
  });
  it('prerelease forwards passthru after the increment', () => {
    expect(
      computeReleaseArgs({
        bump: 'minor',
        currentVersion: '2.5.0',
        preId: 'alpha',
        passthru: ['--release-version'],
      }),
    ).toEqual(['preminor', '--preRelease=alpha', '--release-version']);
  });
});
