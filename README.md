# @smplcty/release

Shared, laptop-driven release tooling for the simplicity / productionnow apps.
It keeps the version contract — *the CHANGELOG section headings decide the SemVer
bump* — in one tested place, instead of drifting across hand-synced shell scripts.
The version is derived, never picked at a prompt.

What it does:

- **Derives the bump from the changelog.** `### Removed` or a breaking entry → major;
  `### Added` → minor; otherwise patch. `[Unreleased]` and pending `changelog.d/`
  entries count as one set. See [How the bump is derived](#how-the-bump-is-derived).
- **Takes one file per change.** Entries in `changelog.d/` never conflict between
  open branches; the release folds them into `[Unreleased]`.
- **Cuts prereleases correctly.** `--alpha`/`--beta`/`--rc`/`--preRelease=<id>`
  advance the `-alpha.N` line (`prerelease`) or start one (`pre<bump>`) — never
  jumping a minor or dropping the tag. If a change lands that the line's number
  cannot carry (a `### Removed` on a `2.6.0-rc.N` line), the line re-opens at the
  right rank (`3.0.0-rc.0`) instead of shipping a major as a minor. A malformed
  `--preRelease` errors instead of silently shipping a final release.
- **Allows an explicit version, never a smaller one.** `--release-as=<version>`
  for versions that are a business decision; the changelog bump is still the floor.
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
pnpm local-release                         # final release; increment from the changelog
pnpm local-release --alpha                 # staging prerelease (also --beta / --rc)
pnpm local-release --release-as=3.0.0      # explicit version (see below)
pnpm local-release --alpha --release-version   # print the next version and exit
```

## How the bump is derived

| The changelog has… | Bump |
| --- | --- |
| a `### Removed` section, or a breaking marker | major |
| an `### Added` section | minor |
| anything else (`### Changed`, `### Fixed`, `### Deprecated`, `### Security`) | patch |

**A breaking marker** is either:

- a line that, after its indentation and an optional `- ` bullet, **starts with**
  `**BREAKING` or `BREAKING CHANGE`, or
- a heading that contains `BREAKING CHANGE`.

All of these count:

```md
- **BREAKING** The compare endpoints now require both dates.
- **BREAKING:** Node 18 is no longer supported.
- **BREAKING (schema): identity columns are now `bigint`.**
- **The date range is remembered rather than carried in the address bar.**
  **BREAKING** A saved link containing `?from=` no longer sets the window.
- BREAKING CHANGE: the `timeout` option is now in seconds.
### ⚠ BREAKING CHANGES
```

A mention anywhere else is prose, and does not make a release major:

```md
- Entries marked **BREAKING** now derive a major.        ← mid-sentence
- A `**BREAKING**` entry is now read correctly.           ← inline code
```

If a breaking change should ship as a major, put the marker at the start of a line.
`smplcty-changelog-bump` prints the bump the tool will use, so check it before you
release.

## `changelog.d/` — one file per change

When every change appends to `## [Unreleased]`, any two open branches conflict
there, in the one file whose headings decide the version. Instead, add a file per
change:

```md
<!-- changelog.d/fix-login-redirect.md -->
### Fixed

- Signing in from a deep link returns you to that page instead of the dashboard.
```

- The filename is yours to choose; it only needs to end in `.md`. `changelog.d/README.md`
  is for documenting the directory and is never read as an entry.
- Each file holds one or more Keep a Changelog sections (`### Added`, `### Changed`,
  `### Deprecated`, `### Removed`, `### Fixed`, `### Security`). Text before the first
  heading, or a heading that is not one of those, **fails the release** rather than
  silently dropping out of the notes.
- `smplcty-release` folds pending files into `[Unreleased]` — grouped by section, so
  two `### Fixed` files become one heading — commits that as
  `changelog: fold changelog.d entries into [Unreleased]`, and removes the files, all
  before release-it runs. The tree must be clean first.
- `--dry-run`, `--release-version` and `--changelog` never fold or commit anything.
  The version they report already includes pending files; a dry run's notes do not.
- If release-it fails after the fold, the fold commit stays. It derives the same
  version as the files did, so just re-run.

Appending directly to `[Unreleased]` still works, and both can be mixed.

## `--release-as=<version>` — an explicit version

Sometimes the version is a decision the changelog cannot express, such as a first
final release shipped as `3.0.0` from `0.5.0-alpha.86` whose sections derive `0.5.0`.

```sh
pnpm local-release --release-as=3.0.0
pnpm local-release --release-as=3.0.0-rc.0   # a prerelease is written into the version
```

It is refused — before anything in the repo is touched — when the version:

- is below what the changelog requires (`semver.inc(current, bump)`), so a
  `**BREAKING**` entry can never ship as a patch; a prerelease is measured by the
  release it leads to, so `3.0.0-rc.0` satisfies a `3.0.0` floor;
- is not valid semver (`v3.0.0` and `3.0` are not);
- is not above the current version;
- is combined with `--alpha` / `--beta` / `--rc` / `--preRelease`.

It is not `--version`: release-it reads that as "print release-it's own version".

## Finishing a prerelease line

Cutting a prerelease moves `[Unreleased]` under that prerelease's heading, so after
`v3.11.0-rc.7` there is nothing pending. To cut `v3.11.0`, add a `changelog.d/` entry
summarizing what the release ships and run `smplcty-release`; the prerelease sections
stay beneath as the per-candidate record.

## CLIs

| Command | Purpose |
| --- | --- |
| `smplcty-release` | Fold `changelog.d/`, then run release-it with the derived / prerelease / `--release-as` increment and the repo's local config. |
| `smplcty-release-preflight [branch]` | `before:init` gate: clean tree + branch current + `[Unreleased]` or `changelog.d/` has entries. |
| `smplcty-changelog-bump [path]` | Print `major`/`minor`/`patch` for `[Unreleased]` plus the `changelog.d/` beside it (exits non-zero if empty). |

## Library

```ts
import {
  computeBump,
  collate,
  parseReleaseFlags,
  computeReleaseArgs,
  assertBranchCurrent,
  release,
  preflight,
} from '@smplcty/release';
```

The version logic is pure, git access is injectable, and it is all unit-tested — the
tests are the executable spec for the version contract.
