// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { appendFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
  addGitHubIssueLabels,
  createGitHubIssue,
  createGitHubIssueComment,
  createGitHubPullRequest,
  getGitHubIssue,
  getGitHubIssueComments,
  getGitHubOpenIssues,
  getGitHubOpenPullRequests,
  updateGitHubIssue,
  updateGitHubIssueComment,
  updateGitHubPullRequest,
} from './github.mjs';
import { REPO_ROOT, assert, runCommand } from './utils.mjs';

/** @typedef {import('./github.mjs').GitHubPullRequest} PullRequest */
/** @typedef {import('./github.mjs').GitHubIssue} Issue */

const { values: args } = parseArgs({
  options: {
    // Still commits locally and reads from GitHub, but doesn't push or change
    // anything on GitHub
    'dry-run': { type: 'boolean', default: false },
  },
});

const dryRun = args['dry-run'];

const BRANCH = 'automation/pnpm-audit-advisories';
const TITLE = 'Update dependencies with security advisories';
const ISSUE_TITLE = 'Dependencies need manual fixes';
// On the PR and the issue, which is found by it. Must exist in the repo.
const LABEL = 'pnpm-audit-autofix';
// GitHub's limit is 65,536 characters
const MAX_ISSUE_BODY_LENGTH = 60_000;
const AUTHOR_NAME = 'automated-signal';
const AUTHOR_EMAIL = '37887102+automated-signal@users.noreply.github.com';
const REMOTE_BRANCH = `origin/${BRANCH}`;

const {
  GITHUB_REPOSITORY,
  GITHUB_REPOSITORY_OWNER,
  GITHUB_TOKEN,
  PR_BODY,
  ISSUE_BODY,
  FIX_FAILED,
} = process.env;
assert(GITHUB_TOKEN != null, 'Missing GITHUB_TOKEN');
assert(PR_BODY != null, 'Missing PR_BODY');
// Empty when there's nothing left to fix by hand
assert(ISSUE_BODY != null, 'Missing ISSUE_BODY');
assert(GITHUB_REPOSITORY != null, 'Missing GITHUB_REPOSITORY');
assert(GITHUB_REPOSITORY_OWNER != null, 'Missing GITHUB_REPOSITORY_OWNER');
const prBody = PR_BODY;
const issueBody = ISSUE_BODY.slice(0, MAX_ISSUE_BODY_LENGTH);
// `owner/repo`
const repo = GITHUB_REPOSITORY;

/**
 * @param {ReadonlyArray<string>} gitArgs
 * @param {Readonly<{ allowFailure?: boolean }>} [options]
 */
async function git(gitArgs, options = {}) {
  return runCommand(
    'git',
    [
      '-c',
      `user.name=${AUTHOR_NAME}`,
      '-c',
      `user.email=${AUTHOR_EMAIL}`,
      ...gitArgs,
    ],
    { cwd: REPO_ROOT, allowFailure: options.allowFailure ?? false }
  );
}

/**
 * @param {ReadonlyArray<string>} pushArgs
 * @returns {Promise<void>}
 */
async function gitPush(pushArgs) {
  if (dryRun) {
    console.log(`[dry-run] git push origin ${pushArgs.join(' ')}`);
    return;
  }
  // The same header `actions/checkout` sets, passed through the environment
  // so the token isn't in the command line
  const auth = Buffer.from(`x-access-token:${GITHUB_TOKEN}`).toString('base64');
  await runCommand('git', ['push', 'origin', ...pushArgs], {
    cwd: REPO_ROOT,
    env: {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${auth}`,
    },
    echoOutput: true,
  });
}

/**
 * @param {string} description
 * @param {() => Promise<unknown>} change
 * @returns {Promise<void>}
 */
async function changeOnGitHub(description, change) {
  if (dryRun) {
    console.log(`[dry-run] ${description}`);
    return;
  }
  console.log(description);
  await change();
}

/**
 * Edits the last comment from the PR's author instead of adding a new one
 * every run. The PR was opened with the same token, so that's this workflow.
 *
 * @param {PullRequest} pr
 * @param {string} body
 * @returns {Promise<void>}
 */
async function updateStatusComment(pr, body) {
  // Comments are listed oldest first, so the newest are on the last page
  const issue = await getGitHubIssue(repo, pr.number);
  const comments = await getGitHubIssueComments(
    repo,
    pr.number,
    Math.max(1, Math.ceil(issue.comments / 100))
  );

  const author = pr.user?.login ?? null;
  const lastComment =
    comments.findLast(comment => {
      return author != null && comment.user?.login === author;
    }) ?? null;

  if (lastComment != null) {
    await changeOnGitHub(`Updating ${lastComment.html_url}`, () => {
      return updateGitHubIssueComment(repo, lastComment.id, body);
    });
  } else {
    await changeOnGitHub(`Commenting on ${pr.html_url}`, () => {
      return createGitHubIssueComment(repo, pr.number, body);
    });
  }
}

/**
 * @returns {Promise<boolean>}
 */
async function hasCommitsFromOtherPeople() {
  const { stdout } = await git([
    'log',
    '--no-merges',
    '--format=%ae',
    `origin/main..${REMOTE_BRANCH}`,
  ]);
  return stdout.split('\n').some(email => {
    return email !== '' && email !== AUTHOR_EMAIL;
  });
}

/**
 * @param {PullRequest | null} pr
 * @param {boolean} otherPeopleCommitted
 * @returns {Promise<void>}
 */
async function closePullRequest(pr, otherPeopleCommitted) {
  if (pr == null) {
    return;
  }

  if (otherPeopleCommitted) {
    // Don't delete other people's work
    await updateStatusComment(
      pr,
      "`main` no longer has advisories that can be fixed automatically, but this branch has commits from other people, so it was left open."
    );
    return;
  }

  await updateStatusComment(
    pr,
    'No longer needed, `main` has no advisories that can be fixed automatically.'
  );
  await changeOnGitHub(`Closing ${pr.html_url}`, () => {
    return updateGitHubPullRequest(repo, pr.number, { state: 'closed' });
  });
  await gitPush(['--delete', BRANCH]);
}

/**
 * @param {PullRequest | null} pr
 * @param {boolean} remoteBranchExists
 * @param {boolean} otherPeopleCommitted
 * @returns {Promise<void>}
 */
async function publishFixes(pr, remoteBranchExists, otherPeopleCommitted) {
  if (pr != null && !pr.labels.some(label => label.name === LABEL)) {
    await changeOnGitHub(`Labeling ${pr.html_url}`, () => {
      return addGitHubIssueLabels(repo, pr.number, [LABEL]);
    });
  }

  if (otherPeopleCommitted) {
    // Don't overwrite other people's work
    console.log(
      `::warning title=pnpm audit autofix::${BRANCH} has commits from other people, didn't update it`
    );
    if (pr != null) {
      let comment = '';
      comment += "This branch has commits from other people, so it wasn't updated with the latest fixes. Merge or close this PR to get new fixes.\n";
      comment += '\n';
      comment += '<details><summary>Latest report</summary>\n';
      comment += '\n';
      comment += `${prBody}\n`;
      comment += '\n';
      comment += '</details>\n';
      await updateStatusComment(pr, comment);
    }
    return;
  }

  await git(['checkout', '-B', BRANCH]);
  // Only tracked files: lockfiles, workspace config, package.json files
  await git(['add', '--update']);
  await git(['commit', '-m', TITLE]);

  const pushArgs = [`HEAD:${BRANCH}`];
  if (remoteBranchExists) {
    // Avoid re-running the PR's CI when nothing changed since the last run
    const { code } = await git(['diff', '--quiet', REMOTE_BRANCH, 'HEAD'], {
      allowFailure: true,
    });
    if (code === 0) {
      console.log(`${BRANCH} is already up to date`);
      return;
    }

    // Fail the push if someone pushes while this runs
    const { stdout } = await git(['rev-parse', REMOTE_BRANCH]);
    pushArgs.push(`--force-with-lease=${BRANCH}:${stdout.trim()}`);
  }
  await gitPush(pushArgs);

  if (pr == null) {
    await changeOnGitHub(`Opening a PR from ${BRANCH}`, async () => {
      const created = await createGitHubPullRequest(repo, {
        title: TITLE,
        head: BRANCH,
        base: 'main',
        body: prBody,
      });
      await addGitHubIssueLabels(repo, created.number, [LABEL]);
    });
    return;
  }

  await changeOnGitHub(`Updating ${pr.html_url}`, () => {
    return updateGitHubPullRequest(repo, pr.number, {
      title: TITLE,
      body: prBody,
    });
  });
}

/**
 * Keeps one issue for what can't be fixed automatically: edited in place
 * while there is something left, closed when there isn't.
 *
 * @returns {Promise<void>}
 */
async function syncIssue() {
  const issues = await getGitHubOpenIssues(repo, LABEL);
  const issue = issues.find(candidate => candidate.pull_request == null) ?? null;

  if (issueBody === '') {
    if (issue != null) {
      await changeOnGitHub(`Closing ${issue.html_url}`, async () => {
        await createGitHubIssueComment(
          repo,
          issue.number,
          'No longer needed, `main` has no dependencies that need manual fixes.'
        );
        await updateGitHubIssue(repo, issue.number, { state: 'closed' });
      });
    }
    return;
  }

  if (issue == null) {
    await changeOnGitHub('Opening an issue for the remaining fixes', () => {
      return createGitHubIssue(repo, {
        title: ISSUE_TITLE,
        body: issueBody,
        labels: [LABEL],
      });
    });
    return;
  }

  if (issue.body === issueBody) {
    console.log(`${issue.html_url} is already up to date`);
    return;
  }
  await changeOnGitHub(`Updating ${issue.html_url}`, () => {
    return updateGitHubIssue(repo, issue.number, { body: issueBody });
  });
}

const pulls = await getGitHubOpenPullRequests(
  repo,
  `${GITHUB_REPOSITORY_OWNER}:${BRANCH}`
);
const pr = pulls[0] ?? null;

const { code: remoteBranchCode } = await git(
  ['rev-parse', '--verify', '--quiet', REMOTE_BRANCH],
  { allowFailure: true }
);
const remoteBranchExists = remoteBranchCode === 0;
const otherPeopleCommitted = remoteBranchExists
  ? await hasCommitsFromOtherPeople()
  : false;

const { code: diffCode } = await git(['diff', '--quiet', 'HEAD'], {
  allowFailure: true,
});
const changed = diffCode !== 0;
const fixFailed = FIX_FAILED === 'true';

if (changed) {
  await publishFixes(pr, remoteBranchExists, otherPeopleCommitted);
} else if (!fixFailed) {
  // Nothing to fix anymore. When a fix failed, the PR is kept for next time.
  await closePullRequest(pr, otherPeopleCommitted);
}

await syncIssue();

if (fixFailed) {
  const { GITHUB_STEP_SUMMARY } = process.env;
  if (GITHUB_STEP_SUMMARY != null) {
    await appendFile(GITHUB_STEP_SUMMARY, prBody);
  }
  console.log(
    '::error title=pnpm audit autofix::Some fixes failed, see the run summary'
  );
  process.exitCode = 1;
}
