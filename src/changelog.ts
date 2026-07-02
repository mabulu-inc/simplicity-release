// Derive the SemVer bump from the `## [Unreleased]` section of a keep-a-changelog
// CHANGELOG. The section headings ARE the version contract — this is the single,
// tested source of truth shared across the apps.
//
// Mapping (keep-a-changelog heading -> SemVer):
//   major  — a `### Removed` section, or any `**BREAKING**` / `BREAKING CHANGE` entry
//   minor  — a `### Added` section (and not major)
//   patch  — anything else (### Changed / Fixed / Security / Deprecated only)

export type Bump = 'major' | 'minor' | 'patch';

// The lines between the `## [Unreleased]` heading and the next `## [` version heading.
export function extractUnreleased(changelog: string): string {
  const lines = changelog.split('\n');
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^## \[Unreleased\]/.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^## \[/.test(line)) break;
    if (inSection) out.push(line);
  }
  return out.join('\n');
}

// True when the [Unreleased] section has at least one list entry (something to ship).
export function hasUnreleasedEntries(changelog: string): boolean {
  return /^[ \t]*-[ \t]/m.test(extractUnreleased(changelog));
}

export function computeBump(changelog: string): Bump {
  const block = extractUnreleased(changelog);
  if (!/^[ \t]*-[ \t]/m.test(block)) {
    throw new Error('changelog: [Unreleased] has no entries — nothing to release');
  }
  if (/^### Removed/m.test(block) || /\*\*BREAKING\*\*/.test(block) || /BREAKING CHANGE/.test(block)) {
    return 'major';
  }
  if (/^### Added/m.test(block)) {
    return 'minor';
  }
  return 'patch';
}
