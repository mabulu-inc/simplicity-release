// Turn CLI flags + the changelog-derived bump + the current version into the
// positional increment release-it should run. Prereleases advance the line
// correctly instead of jumping a minor or dropping the tag:
//   - already on that prerelease line (…-alpha.N) -> `prerelease`  (2.6.0-alpha.0 -> 2.6.0-alpha.1)
//   - otherwise (final release, or a different id) -> `pre<bump>`  (2.5.0 -> 2.6.0-alpha.0 for a minor)

import type { Bump } from './changelog.js';

export interface ReleaseFlags {
  preId?: string;
  passthru: string[];
}

const PRE_ID_ERROR =
  'release: --preRelease needs an id — use --preRelease=<id>, or --alpha/--beta/--rc';

// Separate a prerelease request (--alpha/--beta/--rc/--preRelease=<id>) from any
// other args, which pass straight through to release-it (--dry-run, --release-version, …).
// A malformed --preRelease (bare or empty id) throws rather than silently
// falling through to a plain final release.
export function parseReleaseFlags(argv: readonly string[]): ReleaseFlags {
  let preId: string | undefined;
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
    } else if (arg === '--') {
      // tolerate a stray separator (`pnpm local-release -- --alpha`)
    } else {
      passthru.push(arg);
    }
  }
  return { preId, passthru };
}

export interface ReleaseArgsInput {
  bump: Bump;
  currentVersion: string;
  preId?: string;
  passthru?: readonly string[];
}

// The release-it argv WITHOUT the repo-specific `--config`, which the caller appends.
export function computeReleaseArgs({
  bump,
  currentVersion,
  preId,
  passthru = [],
}: ReleaseArgsInput): string[] {
  const args: string[] = [];
  if (preId) {
    args.push(currentVersion.includes(`-${preId}.`) ? 'prerelease' : `pre${bump}`);
    args.push(`--preRelease=${preId}`);
  } else {
    args.push(bump);
  }
  args.push(...passthru);
  return args;
}
