// The repo-touching half of a release: read CHANGELOG.md, changelog.d/ and
// package.json, refuse anything the version contract forbids, fold pending entries
// into [Unreleased], then hand release-it its argv. Every refusal is raised before
// the first write, so a refused release leaves the repo exactly as it found it.

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';
import { type ChangelogEntry, collate, computeBump, hasUnreleasedEntries } from './changelog.js';
import { type GitRunner, assertBranchCurrent, gitRunner, isWorkingTreeClean } from './git.js';
import { computeReleaseArgs, parseReleaseFlags } from './version.js';

export const ENTRIES_DIR = 'changelog.d';

// release-it flags that only report and exit; the fold must not run for them.
const READ_ONLY_FLAGS = new Set(['--dry-run', '-d', '--release-version', '--changelog']);

// Pending entries in `dir`, sorted by filename. README.md documents the directory and
// is not an entry.
export function readPendingEntries(dir: string): ChangelogEntry[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => ({ name, content: readFileSync(join(dir, name), 'utf8') }));
}

export interface RepoOptions {
  cwd?: string;
  git?: GitRunner;
}

export interface ReleaseOptions extends RepoOptions {
  config?: string;
  runReleaseIt: (args: string[]) => number;
}

// A prerelease line's entries are already filed under its own version headings, so on
// a prerelease "nothing to release" has to say how to cut the final.
function nothingToRelease(currentVersion: string): string {
  const message = 'release: nothing to release — [Unreleased] and changelog.d/ have no entries';
  if (!semver.prerelease(currentVersion)) return message;
  return `${message}. ${currentVersion} is a prerelease, so its changes are already filed under its prerelease headings — to cut the final, add a changelog.d/ entry summarizing what the release ships, then run smplcty-release again`;
}

export function release(
  argv: readonly string[],
  { cwd = process.cwd(), git = gitRunner(cwd), config = '.release-it.local.json', runReleaseIt }: ReleaseOptions,
): number {
  const flags = parseReleaseFlags(argv);
  const changelogPath = join(cwd, 'CHANGELOG.md');
  const entries = readPendingEntries(join(cwd, ENTRIES_DIR));
  const changelog = collate(readFileSync(changelogPath, 'utf8'), entries);
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as { version: string };

  if (!hasUnreleasedEntries(changelog)) throw new Error(nothingToRelease(pkg.version));
  const args = [
    ...computeReleaseArgs({
      bump: computeBump(changelog),
      currentVersion: pkg.version,
      preId: flags.preId,
      releaseAs: flags.releaseAs,
      passthru: flags.passthru,
    }),
    '--config',
    config,
  ];

  if (entries.length > 0 && !flags.passthru.some((arg) => READ_ONLY_FLAGS.has(arg))) {
    // The fold is committed because release-it requires a clean tree; a dirty tree
    // would be refused by release-it anyway, and staged changes would ride along here.
    if (!isWorkingTreeClean(git)) {
      throw new Error('release blocked: working tree has uncommitted changes');
    }
    writeFileSync(changelogPath, changelog);
    for (const entry of entries) rmSync(join(cwd, ENTRIES_DIR, entry.name));
    git(['add', '-A', '--', 'CHANGELOG.md', ENTRIES_DIR]);
    git(['commit', '-q', '-m', 'changelog: fold changelog.d entries into [Unreleased]']);
  }

  return runReleaseIt(args);
}

// The `before:init` gate: clean tree, branch current with its remote, something to release.
export function preflight(
  branch: string,
  { cwd = process.cwd(), git = gitRunner(cwd) }: RepoOptions = {},
): void {
  if (!isWorkingTreeClean(git)) {
    throw new Error('release blocked: working tree has uncommitted changes');
  }
  assertBranchCurrent(branch, git);
  const entries = readPendingEntries(join(cwd, ENTRIES_DIR));
  if (!hasUnreleasedEntries(collate(readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8'), entries))) {
    throw new Error(
      'release blocked: CHANGELOG.md [Unreleased] and changelog.d/ have no entries — nothing to release',
    );
  }
}
