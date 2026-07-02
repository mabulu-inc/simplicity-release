// Guard against releasing from a branch that is behind its remote. If local
// commits sit unpushed while the remote moves, release-it only discovers the
// divergence at the final push (rejected, then a slow rollback after the full
// build). This turns that into a one-second preflight failure. Fails closed:
// if the fetch itself fails, the release is blocked, not silently allowed.

import { execFileSync } from 'node:child_process';

// Injectable command runner so the guard logic is unit-testable without a real
// repo or network. Returns stdout; throws on a non-zero exit.
export type GitRunner = (args: string[]) => string;

const defaultRunner: GitRunner = (args) =>
  execFileSync('git', args, { encoding: 'utf8' });

export function branchBehindCount(branch: string, run: GitRunner = defaultRunner): number {
  try {
    run(['fetch', 'origin', branch, '-q']);
  } catch {
    throw new Error(`release blocked: could not fetch origin/${branch}`);
  }
  const out = run(['rev-list', '--count', `HEAD..origin/${branch}`]).trim();
  return Number.parseInt(out, 10) || 0;
}

export function assertBranchCurrent(branch: string, run: GitRunner = defaultRunner): void {
  const behind = branchBehindCount(branch, run);
  if (behind > 0) {
    throw new Error(
      `release blocked: local ${branch} is behind origin/${branch} by ${behind} commit(s) — run: git pull --rebase origin ${branch}`,
    );
  }
}

export function isWorkingTreeClean(run: GitRunner = defaultRunner): boolean {
  return run(['status', '--porcelain']).trim() === '';
}
