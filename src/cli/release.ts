#!/usr/bin/env node

// Laptop-driven release. Derives the increment from CHANGELOG.md plus pending
// changelog.d/ entries, folds those entries into [Unreleased], and runs release-it
// with the repo's local config.
//
//   smplcty-release                         # final release; increment = changelog bump (major|minor|patch)
//   smplcty-release --alpha                 # staging prerelease (also --beta / --rc, or --preRelease=<id>)
//   smplcty-release --release-as=3.0.0      # explicit version; refused below the changelog bump
//   smplcty-release --alpha --release-version   # print the next version and exit (args pass through)
//
// Config path defaults to .release-it.local.json; override with SMPLCTY_RELEASE_CONFIG.

import { execFileSync, spawnSync } from 'node:child_process';
import { release } from '../release.js';

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function runReleaseIt(args: string[]): number {
  const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  const result = spawnSync('pnpm', ['exec', 'release-it', ...args], {
    stdio: 'inherit',
    env: { ...process.env, GITHUB_TOKEN: token },
  });
  return result.status ?? 1;
}

function main(): void {
  let status;
  try {
    status = release(process.argv.slice(2), {
      config: process.env.SMPLCTY_RELEASE_CONFIG,
      runReleaseIt,
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  process.exit(status);
}

main();
