# @smplcty/release

Shared, laptop-driven release tooling for the simplicity / productionnow apps.
It keeps the version contract — *the CHANGELOG section headings decide the SemVer
bump* — in one tested place, instead of drifting across hand-synced shell scripts.

What it does:

- **Derives the bump from `CHANGELOG.md`.** `### Removed` or `**BREAKING**` → major;
  `### Added` → minor; otherwise patch.
- **Cuts prereleases correctly.** `--alpha`/`--beta`/`--rc`/`--preRelease=<id>`
  advance the `-alpha.N` line (`prerelease`) or start one (`pre<bump>`) — never
  jumping a minor or dropping the tag. A malformed `--preRelease` errors instead
  of silently shipping a final release.
- **Guards against a stale branch.** Fails fast (and fails closed) if local is
  behind its remote, before anything is built or tagged.

## Install

```sh
pnpm add -D @smplcty/release release-it @release-it/keep-a-changelog
```

`release-it` and `@release-it/keep-a-changelog` are peer dependencies.

## Usage

`package.json`:

```jsonc
"scripts": {
  "local-release": "smplcty-release",
  "local-ci": "./scripts/ci.sh"
}
```

`.release-it.local.json` (extend the shared preset, add your repo-specific bits):

```jsonc
{
  "extends": "@smplcty/release/configs/release-it.base.json",
  "git": { "requireBranch": "main" },
  "hooks": {
    "before:init": ["smplcty-release-preflight main", "pnpm local-ci"],
    "after:release": ["./scripts/release.sh"]
  }
}
```

> release-it's `extends` deep-merges but **replaces arrays**, so `before:init` /
> `after:release` won't concat with the preset — that's why the generic
> preflight is a single command (`smplcty-release-preflight`) you list yourself.

Then:

```sh
pnpm local-release                 # final release; increment from the changelog
pnpm local-release --alpha         # staging prerelease (also --beta / --rc)
pnpm local-release --alpha --release-version   # print the next version and exit
```

## CLIs

| Command | Purpose |
| --- | --- |
| `smplcty-release` | Run release-it with the changelog-derived / prerelease increment and the repo's local config. |
| `smplcty-release-preflight [branch]` | `before:init` gate: clean tree + branch current + `[Unreleased]` has entries. |
| `smplcty-changelog-bump [path]` | Print `major`/`minor`/`patch` for the `[Unreleased]` section (exits non-zero if empty). |

## Library

```ts
import { computeBump, parseReleaseFlags, computeReleaseArgs, assertBranchCurrent } from '@smplcty/release';
```

All functions are pure (git access is injectable) and unit-tested — the tests are
the executable spec for the version contract.
