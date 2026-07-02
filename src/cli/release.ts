#!/usr/bin/env node

// Laptop-driven release. Derives the increment from CHANGELOG.md, chooses the
// right prerelease increment, and runs release-it with the repo's local config.
//
//   smplcty-release                 # final release; increment = changelog bump (major|minor|patch)
//   smplcty-release --alpha         # staging prerelease (also --beta / --rc, or --preRelease=<id>)
//   smplcty-release --alpha --release-version   # print the next version and exit (args pass through)
//
// Config path defaults to .release-it.local.json; override with SMPLCTY_RELEASE_CONFIG.

import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { computeBump } from '../changelog.js';
import { parseReleaseFlags, computeReleaseArgs } from '../version.js';

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function main(): void {
  let flags;
  try {
    flags = parseReleaseFlags(process.argv.slice(2));
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  let bump;
  try {
    bump = computeBump(changelog);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const currentVersion = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
  const config = process.env.SMPLCTY_RELEASE_CONFIG ?? '.release-it.local.json';

  const args = [
    ...computeReleaseArgs({ bump, currentVersion, preId: flags.preId, passthru: flags.passthru }),
    '--config',
    config,
  ];

  const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  const result = spawnSync('pnpm', ['exec', 'release-it', ...args], {
    stdio: 'inherit',
    env: { ...process.env, GITHUB_TOKEN: token },
  });
  process.exit(result.status ?? 1);
}

main();
