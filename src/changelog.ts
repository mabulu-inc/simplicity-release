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

// Keep a Changelog's sections, in the order a folded [Unreleased] lists them.
export const SECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'] as const;

// One pending `changelog.d/` file.
export interface ChangelogEntry {
  name: string;
  content: string;
}

// Split a markdown body into [section, text] chunks, one per `### <Section>` heading.
// Anything the fold could not place — prose before the first heading, or a heading
// that is not a Keep a Changelog section — throws instead of vanishing from the notes.
function parseSections(body: string, source: string): Array<[string, string]> {
  const chunks: Array<[string, string[]]> = [];
  for (const line of body.split('\n')) {
    const last = chunks.at(-1);
    if (/^#{1,6}(\s|$)/.test(line)) {
      const section = /^### (.+?)\s*$/.exec(line)?.[1];
      if (!section || !(SECTIONS as readonly string[]).includes(section)) {
        throw new Error(
          `changelog: ${source}: "${line.trim()}" is not a Keep a Changelog section (### ${SECTIONS.join(', ### ')})`,
        );
      }
      chunks.push([section, []]);
    } else if (last) {
      last[1].push(line);
    } else if (line.trim()) {
      throw new Error(
        `changelog: ${source}: content before the first ### section heading would be dropped from the release notes`,
      );
    }
  }
  return chunks.map(([section, lines]) => [
    section,
    lines.join('\n').replace(/^(?:[ \t]*\n)+/, '').trimEnd(),
  ]);
}

// Fold pending changelog.d/ entries into [Unreleased], one heading per section: two
// `### Fixed` files (or a file and an existing `### Fixed`) produce one `### Fixed`.
// Existing [Unreleased] text comes first, then entries in the order given. With no
// entries the changelog is returned untouched, so the bump over the collated text is
// the bump over pending entries and [Unreleased] as one set.
export function collate(changelog: string, entries: readonly ChangelogEntry[]): string {
  if (entries.length === 0) return changelog;
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => /^## \[Unreleased\]/.test(line));
  if (start === -1) {
    throw new Error('changelog: no ## [Unreleased] heading to fold changelog.d entries into');
  }
  const next = lines.findIndex((line, i) => i > start && /^## \[/.test(line));
  const end = next === -1 ? lines.length : next;
  const chunks = [
    ...parseSections(lines.slice(start + 1, end).join('\n'), '[Unreleased]'),
    ...entries.flatMap((entry) => parseSections(entry.content, `changelog.d/${entry.name}`)),
  ];
  const body = SECTIONS.flatMap((section) => {
    const texts = chunks.filter(([s, text]) => s === section && text).map(([, text]) => text);
    return texts.length > 0 ? [`### ${section}`, '', ...texts, ''] : [];
  });
  return [...lines.slice(0, start + 1), '', ...body, ...lines.slice(end)].join('\n');
}
