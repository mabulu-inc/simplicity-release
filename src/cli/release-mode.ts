#!/usr/bin/env node

// Print the mode a release was cut in: `all-at-once` if the release commit `ref` names
// carries the declaration `smplcty-release --all-at-once` writes, otherwise `additive`.
// Always exits 0, so a release workflow can branch on the output:
//
//   smplcty-release-mode [ref]   (ref defaults to HEAD, the tag a tag-push run checks out)

import { releaseMode } from '../mode.js';

process.stdout.write(`${releaseMode(process.argv[2])}\n`);
