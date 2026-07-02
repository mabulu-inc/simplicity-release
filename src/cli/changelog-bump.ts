#!/usr/bin/env node

// Print the SemVer increment (major | minor | patch) implied by CHANGELOG.md's
// [Unreleased] section. Exits non-zero if there are no entries. Useful on its
// own (CI assertions, scripts); `smplcty-release` computes the bump internally.
//
//   smplcty-changelog-bump [changelog-path]   (defaults to ./CHANGELOG.md)

import { readFileSync } from 'node:fs';
import { computeBump } from '../changelog.js';

function main(): void {
  const path = process.argv[2] ?? 'CHANGELOG.md';
  try {
    process.stdout.write(`${computeBump(readFileSync(path, 'utf8'))}\n`);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

main();
