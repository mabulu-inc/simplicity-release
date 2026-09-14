import { describe, it, expect } from 'vitest';
import { computeBump, hasUnreleasedEntries, extractUnreleased, collate } from '../src/changelog.js';

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

describe('collate — changelog.d entries fold into [Unreleased]', () => {
  const entry = (name: string, content: string) => ({ name, content });

  it('no entries → changelog untouched', () => {
    const text = changelog('\n### Fixed\n- x\n');
    expect(collate(text, [])).toBe(text);
  });
  it('groups by section: two ### Fixed files → one heading', () => {
    const out = collate(changelog('\n'), [
      entry('a.md', '### Fixed\n\n- one\n'),
      entry('b.md', '### Fixed\n- two\n'),
    ]);
    expect(extractUnreleased(out)).toBe('\n### Fixed\n\n- one\n- two\n');
  });
  it('merges with existing [Unreleased] sections, in Keep a Changelog order', () => {
    const out = collate(changelog('\n### Fixed\n- old\n'), [
      entry('a.md', '### Fixed\n- also\n'),
      entry('b.md', '### Added\n- new\n'),
    ]);
    expect(extractUnreleased(out)).toBe('\n### Added\n\n- new\n\n### Fixed\n\n- old\n- also\n');
    expect(out).toContain('## [1.0.0] - 2020-01-01\n### Added\n- seed\n');
  });
  it('pending entries and [Unreleased] bump as one set', () => {
    const text = changelog('\n### Fixed\n- x\n');
    expect(computeBump(collate(text, [entry('a.md', '### Added\n- y\n')]))).toBe('minor');
    expect(computeBump(collate(text, [entry('a.md', '### Removed\n- y\n')]))).toBe('major');
    expect(
      computeBump(collate(text, [entry('a.md', '### Changed\n- **BREAKING** y\n')])),
    ).toBe('major');
  });
  it('entries alone count when [Unreleased] is empty', () => {
    expect(hasUnreleasedEntries(collate(changelog('\n'), [entry('a.md', '### Fixed\n- x\n')]))).toBe(
      true,
    );
  });
  it('content before the first heading fails the fold, naming the file', () => {
    expect(() =>
      collate(changelog('\n'), [entry('bad.md', 'a stray note\n\n### Fixed\n- x\n')]),
    ).toThrow(/changelog\.d\/bad\.md: content before the first ### section heading/);
  });
  it('a heading that is not a Keep a Changelog section fails the fold', () => {
    expect(() => collate(changelog('\n'), [entry('bad.md', '### Notes\n- x\n')])).toThrow(
      /"### Notes" is not a Keep a Changelog section/,
    );
    expect(() => collate(changelog('\n'), [entry('bad.md', '## Fixed\n- x\n')])).toThrow(
      /not a Keep a Changelog section/,
    );
  });
  it('a changelog with no [Unreleased] heading fails the fold', () => {
    expect(() => collate('# Changelog\n', [entry('a.md', '### Fixed\n- x\n')])).toThrow(
      /no ## \[Unreleased\] heading/,
    );
  });
});
