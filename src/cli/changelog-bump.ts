#!/usr/bin/env node

// Print the SemVer increment (major | minor | patch) implied by CHANGELOG.md's
// [Unreleased] section together with the pending changelog.d/ entries beside it.
// Exits non-zero if there are no entries. Useful on its own (CI assertions,
// scripts); `smplcty-release` computes the bump internally.
//
//   smplcty-changelog-bump [changelog-path]   (defaults to ./CHANGELOG.md)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { collate, computeBump } from '../changelog.js';
import { ENTRIES_DIR, readPendingEntries } from '../release.js';

function main(): void {
  const path = process.argv[2] ?? 'CHANGELOG.md';
  try {
    const entries = readPendingEntries(join(dirname(path), ENTRIES_DIR));
    process.stdout.write(`${computeBump(collate(readFileSync(path, 'utf8'), entries))}\n`);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

main();
