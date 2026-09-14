#!/usr/bin/env node

// Generic release preflight, run from a release-it `before:init` hook BEFORE
// anything is built, committed, or tagged. Bundles the three checks that are the
// same across apps, so a consumer's before:init is just:
//   ["smplcty-release-preflight main", "pnpm local-ci"]
//
//   smplcty-release-preflight [branch]   (branch defaults to main)

import { preflight } from '../release.js';

function main(): void {
  try {
    preflight(process.argv[2] ?? 'main');
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

main();
