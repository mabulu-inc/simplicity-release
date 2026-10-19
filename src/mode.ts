// A release's mode: additive (the default), or all-at-once, which lets the tag's
// deploy apply destructive schema changes in the same release. What counts as
// destructive belongs to the consumer's migration tool; this carries the yes or no.
//
// The declaration is a `Release-Mode: all-at-once` trailer on the release commit the
// tag names. Any checkout of the tag has that commit, which is not true of an
// annotated tag's message, and the commit's author and date record who chose it and
// when. Reading fails closed: no trailer, an unreadable ref, or any other value is
// additive.

import { existsSync, readFileSync } from 'node:fs';
import { type GitRunner, gitRunner } from './git.js';

export type ReleaseMode = 'additive' | 'all-at-once';

export const MODE_TRAILER = 'Release-Mode';

export function releaseMode(ref = 'HEAD', git: GitRunner = gitRunner()): ReleaseMode {
  let out: string;
  try {
    out = git(['log', '-1', `--format=%(trailers:key=${MODE_TRAILER},valueonly)`, '--end-of-options', ref]);
  } catch {
    return 'additive';
  }
  const values = out
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 && values.every((value) => value === 'all-at-once')
    ? 'all-at-once'
    : 'additive';
}

// The release-it args that put the trailer on the release commit. A `git.commitArgs`
// on the command line replaces the config's rather than adding to it, so the local
// config's own commitArgs are passed again ahead of the trailer. Only the local config
// file is read, not presets it extends; one that is not JSON is refused rather than
// risk dropping its args.
export function allAtOnceArgs(configPath: string): string[] {
  let commitArgs: unknown;
  if (existsSync(configPath)) {
    let config: { git?: { commitArgs?: unknown } };
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8')) as typeof config;
    } catch {
      throw new Error(
        `release: --all-at-once needs a JSON release-it config to keep its git.commitArgs, and ${configPath} is not one`,
      );
    }
    commitArgs = config.git?.commitArgs;
  }
  // release-it splits a string on spaces, so the same is done here.
  const own = typeof commitArgs === 'string' ? commitArgs.split(' ') : Array.isArray(commitArgs) ? commitArgs : [];
  return [...own.map(String), `--trailer=${MODE_TRAILER}:all-at-once`].map(
    (arg) => `--git.commitArgs=${arg}`,
  );
}
