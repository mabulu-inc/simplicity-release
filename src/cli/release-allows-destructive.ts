#!/usr/bin/env node

// Exit 0 if the release commit `ref` names was cut with `smplcty-release
// --allow-destructive`, otherwise exit 1, so a release workflow can branch on it:
//
//   if smplcty-release-allows-destructive; then migrate --allow-destructive; else migrate; fi
//
//   smplcty-release-allows-destructive [ref]   (ref defaults to HEAD, the tag a tag-push run checks out)
//
// Fails closed: a ref it cannot read exits 1, the same as a release that did not allow it.

import { allowsDestructive } from '../destructive.js';

const ref = process.argv[2] ?? 'HEAD';
const allowed = allowsDestructive(ref);
process.stderr.write(`${ref} ${allowed ? 'allows' : 'does not allow'} destructive changes\n`);
process.exit(allowed ? 0 : 1);
