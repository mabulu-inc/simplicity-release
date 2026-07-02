import { describe, it, expect } from 'vitest';
import { computeBump, hasUnreleasedEntries, extractUnreleased } from '../src/changelog.js';

// Build a CHANGELOG fixture with the given [Unreleased] body.
const changelog = (body: string): string =>
  `# Changelog\n\n## [Unreleased]\n${body}\n## [1.0.0] - 2020-01-01\n### Added\n- seed\n`;

describe('computeBump — keep-a-changelog section → SemVer', () => {
  it('fixed-only → patch', () => {
    expect(computeBump(changelog('\n### Fixed\n- squashed a bug\n'))).toBe('patch');
  });
  it('changed-only → patch', () => {
    expect(computeBump(changelog('\n### Changed\n- tweaked copy\n'))).toBe('patch');
  });
  it('deprecated + fixed → patch', () => {
    expect(computeBump(changelog('\n### Deprecated\n- old way\n\n### Fixed\n- y\n'))).toBe('patch');
  });
  it('added → minor', () => {
    expect(computeBump(changelog('\n### Added\n- a new feature\n'))).toBe('minor');
  });
  it('removed → major', () => {
    expect(computeBump(changelog('\n### Removed\n- the old endpoint\n'))).toBe('major');
  });
  it('changed + **BREAKING** → major', () => {
    expect(computeBump(changelog('\n### Changed\n- **BREAKING** reworked the auth API\n'))).toBe(
      'major',
    );
  });
  it('added + **BREAKING** → major (major wins over minor)', () => {
    expect(computeBump(changelog('\n### Added\n- thing\n\n### Changed\n- **BREAKING** x\n'))).toBe(
      'major',
    );
  });
  it('added + removed → major (major wins over minor)', () => {
    expect(computeBump(changelog('\n### Added\n- thing\n\n### Removed\n- old endpoint\n'))).toBe(
      'major',
    );
  });
  it('empty [Unreleased] → throws (nothing to ship)', () => {
    expect(() => computeBump(changelog('\n'))).toThrow(/no entries/);
  });
});

describe('hasUnreleasedEntries', () => {
  it('true when there is a list entry', () => {
    expect(hasUnreleasedEntries(changelog('\n### Fixed\n- x\n'))).toBe(true);
  });
  it('false for an empty section', () => {
    expect(hasUnreleasedEntries(changelog('\n'))).toBe(false);
  });
  it('stops at the next version heading', () => {
    // The seed entry under [1.0.0] must not count toward [Unreleased].
    expect(extractUnreleased(changelog('\n')).includes('seed')).toBe(false);
  });
});
