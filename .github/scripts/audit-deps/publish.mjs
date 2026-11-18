// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { appendFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
  addGitHubIssueLabels,
  createGitHubIssue,
  createGitHubIssueComment,
  createGitHubIssueCommentReaction,
  createGitHubPullRequest,
  getGitHubIssue,
  getGitHubIssueComments,
  getGitHubOpenIssues,
  updateGitHubIssue,
  updateGitHubIssueComment,
  updateGitHubPullRequest,
} from './github.mjs';
import {
  BRANCH,
  LABEL,
  REMOTE_BRANCH,
  REPO_ROOT,
  assert,
  getAutofixPullRequest,
  git,
  hasCommitsFromOtherPeople,
  hasRemoteBranch,
  runCommand,
} from './utils.mjs';

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

const TITLE = 'Update dependencies with security advisories';
const ISSUE_TITLE = 'Dependencies need manual fixes';
// GitHub's limit is 65,536 characters
const MAX_ISSUE_BODY_LENGTH = 60_000;

const {
  GITHUB_REPOSITORY,
  GITHUB_REPOSITORY_OWNER,
  GITHUB_TOKEN,
  PR_BODY,
  ISSUE_BODY,
  FIX_FAILED,
  REPLY,
  REPLY_FAILED,
  REPLY_TO,
  REPLY_COMMENT_ID,
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
 * @returns {Promise<string | null>} the PR's URL
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
    return pr?.html_url ?? null;
  }

  await git(['checkout', '-B', BRANCH]);
  // One commit, including the ones from `apply-commands.mjs`
  await git(['reset', '--soft', 'origin/main']);
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
      return pr?.html_url ?? null;
    }

    // Fail the push if someone pushes while this runs
    const { stdout } = await git(['rev-parse', REMOTE_BRANCH]);
    pushArgs.push(`--force-with-lease=${BRANCH}:${stdout.trim()}`);
  }
  await gitPush(pushArgs);

  if (pr == null) {
    /** @type {string | null} */
    let url = null;
    await changeOnGitHub(`Opening a PR from ${BRANCH}`, async () => {
      const created = await createGitHubPullRequest(repo, {
        title: TITLE,
        head: BRANCH,
        base: 'main',
        body: prBody,
      });
      await addGitHubIssueLabels(repo, created.number, [LABEL]);
      url = created.html_url;
    });
    return url;
  }

  await changeOnGitHub(`Updating ${pr.html_url}`, () => {
    return updateGitHubPullRequest(repo, pr.number, {
      title: TITLE,
      body: prBody,
    });
  });
  return pr.html_url;
}

/**
 * Keeps one issue for what can't be fixed automatically: edited in place
 * while there is something left, closed when there isn't.
 *
 * @param {string | null} prUrl
 * @returns {Promise<void>}
 */
async function syncIssue(prUrl) {
  const issues = await getGitHubOpenIssues(repo, LABEL);
  const issue = issues.find(candidate => candidate.pull_request == null) ?? null;

  if (issueBody === '') {
    if (issue != null) {
      await changeOnGitHub(`Closing ${issue.html_url}`, async () => {
        await createGitHubIssueComment(
          repo,
          issue.number,
          prUrl != null
            ? `Nothing left that needs a manual fix once ${prUrl} is merged.`
            : 'No longer needed, `main` has no dependencies that need manual fixes.'
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

const pr = await getAutofixPullRequest(repo, GITHUB_REPOSITORY_OWNER);

const remoteBranchExists = await hasRemoteBranch();
const otherPeopleCommitted = remoteBranchExists
  ? await hasCommitsFromOtherPeople()
  : false;

// Includes commits from `apply-commands.mjs`
const { code: diffCode } = await git(['diff', '--quiet', 'origin/main'], {
  allowFailure: true,
});
const changed = diffCode !== 0;
const fixFailed = FIX_FAILED === 'true';

/** @type {string | null} */
let prUrl = null;
if (changed) {
  prUrl = await publishFixes(pr, remoteBranchExists, otherPeopleCommitted);
} else if (!fixFailed) {
  // Nothing to fix anymore. When a fix failed, the PR is kept for next time.
  await closePullRequest(pr, otherPeopleCommitted);
}

await syncIssue(prUrl);

if (REPLY_TO != null && REPLY_TO !== '' && REPLY != null) {
  let reply = REPLY;
  if (prUrl != null) {
    reply += `\nPull request: ${prUrl}\n`;
  }
  await changeOnGitHub(`Replying on #${REPLY_TO}`, () => {
    return createGitHubIssueComment(repo, Number(REPLY_TO), reply);
  });
  if (REPLY_COMMENT_ID != null && REPLY_COMMENT_ID !== '') {
    await changeOnGitHub('Reacting to the command', () => {
      return createGitHubIssueCommentReaction(
        repo,
        Number(REPLY_COMMENT_ID),
        REPLY_FAILED === 'true' ? '-1' : '+1'
      );
    });
  }
}

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
