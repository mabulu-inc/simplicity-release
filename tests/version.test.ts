import { describe, it, expect } from 'vitest';
import semver from 'semver';
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
  it('--release-as=<version> is taken, not passed through', () => {
    expect(parseReleaseFlags(['--release-as=3.0.0', '--dry-run'])).toEqual({
      releaseAs: '3.0.0',
      passthru: ['--dry-run'],
    });
  });
  it('bare or empty --release-as throws', () => {
    expect(() => parseReleaseFlags(['--release-as'])).toThrow(/needs a version/);
    expect(() => parseReleaseFlags(['--release-as='])).toThrow(/needs a version/);
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

describe('computeReleaseArgs — a prerelease line never outranks its own number', () => {
  // What release-it will compute from the increment we hand it.
  const next = (currentVersion: string, [increment]: string[]) =>
    semver.inc(currentVersion, increment as semver.ReleaseType, 'rc');

  it('minor line + a major entry → re-opens as premajor', () => {
    const args = computeReleaseArgs({ bump: 'major', currentVersion: '2.6.0-rc.3', preId: 'rc' });
    expect(args).toEqual(['premajor', '--preRelease=rc']);
    expect(next('2.6.0-rc.3', args)).toBe('3.0.0-rc.0');
  });
  it('patch line + a minor entry → re-opens as preminor', () => {
    const args = computeReleaseArgs({ bump: 'minor', currentVersion: '2.6.1-rc.0', preId: 'rc' });
    expect(args).toEqual(['preminor', '--preRelease=rc']);
    expect(next('2.6.1-rc.0', args)).toBe('2.7.0-rc.0');
  });
  it('major line + a minor entry → continues (the line already carries it)', () => {
    const args = computeReleaseArgs({ bump: 'minor', currentVersion: '3.0.0-rc.1', preId: 'rc' });
    expect(args).toEqual(['prerelease', '--preRelease=rc']);
    expect(next('3.0.0-rc.1', args)).toBe('3.0.0-rc.2');
  });
  it('minor line + a patch entry → continues', () => {
    expect(computeReleaseArgs({ bump: 'patch', currentVersion: '2.6.0-rc.1', preId: 'rc' })).toEqual(
      ['prerelease', '--preRelease=rc'],
    );
  });
});

describe('computeReleaseArgs — --release-as', () => {
  it('asks release-it for exactly that version', () => {
    expect(
      computeReleaseArgs({ bump: 'minor', currentVersion: '0.5.0-alpha.86', releaseAs: '3.0.0' }),
    ).toEqual(['3.0.0']);
  });
  it('forwards passthru after the version', () => {
    expect(
      computeReleaseArgs({
        bump: 'patch',
        currentVersion: '2.5.0',
        releaseAs: '3.0.0',
        passthru: ['--release-version'],
      }),
    ).toEqual(['3.0.0', '--release-version']);
  });
  it('accepts a prerelease written into the version, measured by the release it leads to', () => {
    expect(
      computeReleaseArgs({ bump: 'major', currentVersion: '2.5.0', releaseAs: '3.0.0-rc.0' }),
    ).toEqual(['3.0.0-rc.0']);
  });
  it('refuses a version below the changelog bump (a BREAKING entry cannot ship as a patch)', () => {
    expect(() =>
      computeReleaseArgs({ bump: 'major', currentVersion: '2.5.0', releaseAs: '2.5.1' }),
    ).toThrow(/below 3\.0\.0, the major release the changelog requires/);
    expect(() =>
      computeReleaseArgs({ bump: 'major', currentVersion: '2.5.0', releaseAs: '2.9.0-rc.0' }),
    ).toThrow(/below 3\.0\.0/);
  });
  it('refuses a version that is not valid semver', () => {
    expect(() =>
      computeReleaseArgs({ bump: 'patch', currentVersion: '2.5.0', releaseAs: 'v3.0.0' }),
    ).toThrow(/not a valid semver version/);
    expect(() =>
      computeReleaseArgs({ bump: 'patch', currentVersion: '2.5.0', releaseAs: '3.0' }),
    ).toThrow(/not a valid semver version/);
  });
  it('refuses a version that is not above the current version', () => {
    expect(() =>
      computeReleaseArgs({ bump: 'patch', currentVersion: '2.5.0', releaseAs: '2.5.0' }),
    ).toThrow(/not above the current version 2\.5\.0/);
    expect(() =>
      computeReleaseArgs({ bump: 'patch', currentVersion: '2.5.0', releaseAs: '2.4.0' }),
    ).toThrow(/not above/);
  });
  it('refuses to combine with a prerelease flag', () => {
    expect(() =>
      computeReleaseArgs({
        bump: 'patch',
        currentVersion: '2.5.0',
        preId: 'rc',
        releaseAs: '3.0.0',
      }),
    ).toThrow(/cannot be combined/);
  });
});
