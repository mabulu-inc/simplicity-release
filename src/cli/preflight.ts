#!/usr/bin/env node

// Generic release preflight, run from a release-it `before:init` hook BEFORE
// anything is built, committed, or tagged. Bundles the three checks that are the
// same across apps, so a consumer's before:init is just:
//   ["smplcty-release-preflight main", "pnpm local-ci"]
//
//   smplcty-release-preflight [branch]   (branch defaults to main)

import { readFileSync } from 'node:fs';
import { assertBranchCurrent, isWorkingTreeClean } from '../git.js';
import { hasUnreleasedEntries } from '../changelog.js';

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function main(): void {
  const branch = process.argv[2] ?? 'main';

  if (!isWorkingTreeClean()) {
    fail('release blocked: working tree has uncommitted changes');
  }

  try {
    assertBranchCurrent(branch);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  if (!hasUnreleasedEntries(changelog)) {
    fail('release blocked: CHANGELOG.md [Unreleased] has no entries — nothing to release');
  }
}

main();
