// Turn CLI flags + the changelog-derived bump + the current version into the
// positional increment release-it should run. Prereleases advance the line
// correctly instead of jumping a minor or dropping the tag:
//   - on that prerelease line, and the line can carry the bump -> `prerelease`  (2.6.0-alpha.0 -> 2.6.0-alpha.1)
//   - otherwise (final release, a different id, or a bump the line cannot carry) -> `pre<bump>`
//     (2.5.0 -> 2.6.0-alpha.0 for a minor; 2.6.0-alpha.3 -> 3.0.0-alpha.0 for a major)
// An explicit --release-as=<version> goes to release-it as-is, but never below what
// the changelog requires.

import semver from 'semver';
import type { Bump } from './changelog.js';

export interface ReleaseFlags {
  preId?: string;
  releaseAs?: string;
  passthru: string[];
}

const PRE_ID_ERROR =
  'release: --preRelease needs an id — use --preRelease=<id>, or --alpha/--beta/--rc';
const RELEASE_AS_ERROR = 'release: --release-as needs a version — use --release-as=<version>';

// Separate a prerelease request (--alpha/--beta/--rc/--preRelease=<id>) and an explicit
// --release-as=<version> from any other args, which pass straight through to release-it
// (--dry-run, --release-version, …). A malformed --preRelease or --release-as (bare or
// empty) throws rather than silently falling through to a derived release.
export function parseReleaseFlags(argv: readonly string[]): ReleaseFlags {
  let preId: string | undefined;
  let releaseAs: string | undefined;
  const passthru: string[] = [];
  for (const arg of argv) {
    if (arg === '--alpha') preId = 'alpha';
    else if (arg === '--beta') preId = 'beta';
    else if (arg === '--rc') preId = 'rc';
    else if (arg === '--preRelease') throw new Error(PRE_ID_ERROR);
    else if (arg.startsWith('--preRelease=')) {
      const id = arg.slice('--preRelease='.length);
      if (!id) throw new Error(PRE_ID_ERROR);
      preId = id;
    } else if (arg === '--release-as') throw new Error(RELEASE_AS_ERROR);
    else if (arg.startsWith('--release-as=')) {
      releaseAs = arg.slice('--release-as='.length);
      if (!releaseAs) throw new Error(RELEASE_AS_ERROR);
    } else if (arg === '--') {
      // tolerate a stray separator (`pnpm local-release -- --alpha`)
    } else {
      passthru.push(arg);
    }
  }
  return { preId, releaseAs, passthru };
}

export interface ReleaseArgsInput {
  bump: Bump;
  currentVersion: string;
  preId?: string;
  releaseAs?: string;
  passthru?: readonly string[];
}

// x.y.z of a version, without any prerelease tag.
const releaseOf = (version: string): string =>
  `${semver.major(version)}.${semver.minor(version)}.${semver.patch(version)}`;

// A prerelease line x.y.z-<id>.N can carry `bump` only if that bump still finalizes to
// x.y.z. The line's shape records the rank it was opened with: 2.6.0-rc.3 is a minor
// line, so semver.inc('2.6.0-rc.3', 'major') is 3.0.0, not 2.6.0 — a major landed on
// it, and continuing with `prerelease` would ship that major as 2.6.0.
function continuesLine(currentVersion: string, preId: string, bump: Bump): boolean {
  return (
    semver.prerelease(currentVersion)?.[0] === preId &&
    semver.inc(currentVersion, bump) === releaseOf(currentVersion)
  );
}

function assertReleaseAs(releaseAs: string, currentVersion: string, bump: Bump): void {
  // semver.valid tolerates a leading `v`; release-it would then write `v3.0.0` as the
  // version itself (and tag `vv3.0.0`), so only the exact normalized form is accepted.
  if (semver.valid(releaseAs) !== releaseAs) {
    throw new Error(`release: --release-as=${releaseAs} is not a valid semver version`);
  }
  if (!semver.gt(releaseAs, currentVersion)) {
    throw new Error(
      `release: --release-as=${releaseAs} is not above the current version ${currentVersion}`,
    );
  }
  // A prerelease is measured by the release it leads to: 3.0.0-rc.0 satisfies a 3.0.0 floor.
  const floor = semver.inc(currentVersion, bump);
  if (floor && semver.lt(releaseOf(releaseAs), floor)) {
    throw new Error(
      `release: --release-as=${releaseAs} is below ${floor}, the ${bump} release the changelog requires`,
    );
  }
}

// The release-it argv WITHOUT the repo-specific `--config`, which the caller appends.
export function computeReleaseArgs({
  bump,
  currentVersion,
  preId,
  releaseAs,
  passthru = [],
}: ReleaseArgsInput): string[] {
  if (releaseAs !== undefined) {
    if (preId) {
      throw new Error(
        'release: --release-as cannot be combined with --alpha/--beta/--rc/--preRelease — write the prerelease into the version (e.g. --release-as=3.0.0-rc.0)',
      );
    }
    assertReleaseAs(releaseAs, currentVersion, bump);
    return [releaseAs, ...passthru];
  }
  if (!preId) return [bump, ...passthru];
  return [
    continuesLine(currentVersion, preId, bump) ? 'prerelease' : `pre${bump}`,
    `--preRelease=${preId}`,
    ...passthru,
  ];
}
