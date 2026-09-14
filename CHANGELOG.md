# Changelog

All notable changes to `@smplcty/release` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-09-14

### Added

- `changelog.d/`: write one file per change instead of appending to
  `[Unreleased]`, so open branches no longer conflict in `CHANGELOG.md`.
  `smplcty-release` folds pending files into `[Unreleased]` (one heading per
  section), commits the fold, and removes the files before release-it runs. The
  bump, the preflight, and `smplcty-changelog-bump` all count pending files. A file
  with text outside a Keep a Changelog section fails the release instead of
  silently dropping out of the notes.
- `--release-as=<version>` releases an explicit version, such as `3.0.0` from a
  `0.5.0-alpha` line. It is refused if the version is below what the changelog
  requires, not valid semver, not above the current version, or combined with a
  prerelease flag, and every refusal happens before the repo is touched.

### Fixed

- A prerelease line no longer keeps a number too small for its changes: a
  removal or breaking change landing on a `2.6.0-rc.N` line now re-opens it as
  `3.0.0-rc.0` instead of continuing to `2.6.0-rc.N+1` and shipping a major as a
  minor.
- When there is nothing to release and the current version is a prerelease, the
  error now explains that the changes are already filed under the prerelease
  headings and how to cut the final.

## [0.1.0] - 2026-07-02

### Added

- Initial release. Shared laptop-driven release tooling extracted from the
  productionnow and salez1-next apps, so the version contract lives in one tested
  place instead of drifting between hand-synced shell scripts.
- `computeBump` derives the SemVer increment from a keep-a-changelog
  `[Unreleased]` section (the section headings are the version contract).
- `parseReleaseFlags` / `computeReleaseArgs` cut prereleases correctly:
  `--alpha`/`--beta`/`--rc`/`--preRelease=<id>` advance the `-alpha.N` line
  instead of jumping a minor or dropping the tag, and a malformed `--preRelease`
  errors instead of silently shipping a final release.
- `assertBranchCurrent` guards against releasing from a branch that is behind its
  remote, failing fast (and failing closed on a fetch error).
- `smplcty-release`, `smplcty-release-preflight`, and `smplcty-changelog-bump`
  CLIs, plus a `configs/release-it.base.json` preset consumers extend.
