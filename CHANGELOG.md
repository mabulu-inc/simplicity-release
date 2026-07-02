# Changelog

All notable changes to `@smplcty/release` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
