// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { formatCommand, parseCommands } from './commands.mjs';
import {
  createGitHubIssueCommentReaction,
  getGitHubCollaboratorPermission,
} from './github.mjs';
import {
  BRANCH,
  PnpmCommandError,
  REMOTE_BRANCH,
  REPO_ROOT,
  WORKSPACES,
  appendGitHubOutputs,
  assert,
  getAutofixPullRequest,
  getIgnoredGhsas,
  getOverrides,
  git,
  hasCommitsFromOtherPeople,
  hasRemoteBranch,
  isEntryForModule,
  restoreWorkspace,
  runAudit,
  runAuditWithoutIgnores,
  runPnpm,
  setIgnoredGhsas,
  setProjectConfig,
} from './utils.mjs';

/** @import { Command } from './commands.mjs' */
/** @import { Advisory, Workspace } from './utils.mjs' */

const { values: args } = parseArgs({
  options: {
    // Still commits locally and reads from GitHub, but doesn't react to the comment
    'dry-run': { type: 'boolean', default: false },
  },
});

const dryRun = args['dry-run'];

const {
  GITHUB_EVENT_NAME,
  GITHUB_EVENT_PATH,
  GITHUB_OUTPUT,
  GITHUB_REPOSITORY,
  GITHUB_REPOSITORY_OWNER,
} = process.env;
assert(GITHUB_REPOSITORY != null, 'Missing GITHUB_REPOSITORY');
assert(GITHUB_REPOSITORY_OWNER != null, 'Missing GITHUB_REPOSITORY_OWNER');
const repo = GITHUB_REPOSITORY;

/**
 * @typedef {Readonly<{
 *   id: number;
 *   login: string;
 *   issueNumber: number;
 *   commands: ReadonlyArray<Command>;
 *   errors: ReadonlyArray<string>;
 * }>} CommandComment
 */

/** @typedef {Command & Readonly<{ workspace: Workspace }>} WorkspaceCommand */

/**
 * @typedef {Readonly<{
 *   status: 'applied' | 'unchanged' | 'failed';
 *   text: string;
 *   message: string;
 * }>} CommandResult
 */

class CommandError extends Error {}

const VERSION_RANGE = /^[\w\s.^~<>=|*+-]+$/;

/**
 * @returns {Promise<CommandComment | null>}
 */
async function readCommandComment() {
  if (GITHUB_EVENT_NAME !== 'issue_comment' || GITHUB_EVENT_PATH == null) {
    return null;
  }

  const event = JSON.parse(await readFile(GITHUB_EVENT_PATH, 'utf8'));
  const { comment, issue } = event;
  const { commands, errors } = parseCommands(comment.body);
  if (commands.length === 0 && errors.length === 0) {
    return null;
  }

  if (!dryRun) {
    await createGitHubIssueCommentReaction(repo, comment.id, 'eyes');
  }

  const base = {
    id: comment.id,
    login: comment.user.login,
    issueNumber: issue.number,
  };

  const { permission } = await getGitHubCollaboratorPermission(
    repo,
    comment.user.login
  );
  if (permission !== 'admin' && permission !== 'write') {
    return {
      ...base,
      commands: [],
      errors: [`${comment.user.login} needs write access to run commands`],
    };
  }

  return { ...base, commands, errors };
}

/** @type {Map<Workspace, ReadonlyArray<Advisory>>} */
const advisoryCache = new Map();

/**
 * @param {Workspace} workspace
 * @returns {Promise<ReadonlyArray<Advisory>>}
 */
async function getAllAdvisories(workspace) {
  const cached = advisoryCache.get(workspace);
  if (cached != null) {
    return cached;
  }
  const advisories = await runAuditWithoutIgnores(workspace);
  advisoryCache.set(workspace, advisories);
  return advisories;
}

/**
 * @param {Workspace} workspace
 * @param {string} ghsaId
 * @returns {Promise<Advisory>}
 */
async function findAdvisory(workspace, ghsaId) {
  const advisories = await getAllAdvisories(workspace);
  const advisory = advisories.find(candidate => candidate.ghsaId === ghsaId);
  if (advisory == null) {
    throw new CommandError(`it isn't reported in \`${workspace.label}\``);
  }
  return advisory;
}

/**
 * @param {Command} command
 * @param {Workspace} workspace
 * @returns {Promise<boolean>}
 */
async function isCommandForWorkspace(command, workspace) {
  if (command.name === 'unignore') {
    const ignored = await getIgnoredGhsas(workspace);
    return ignored.includes(command.ghsaId);
  }
  const advisories = await getAllAdvisories(workspace);
  return advisories.some(advisory => advisory.ghsaId === command.ghsaId);
}

/**
 * @param {Command} command
 * @returns {Promise<ReadonlyArray<Workspace>>}
 */
async function getCommandWorkspaces(command) {
  if (command.workspace != null) {
    return [command.workspace];
  }
  /** @type {Array<Workspace>} */
  const workspaces = [];
  for (const workspace of WORKSPACES) {
    // oxlint-disable-next-line no-await-in-loop
    if (await isCommandForWorkspace(command, workspace)) {
      workspaces.push(workspace);
    }
  }
  return workspaces;
}

/**
 * @param {Workspace} workspace
 * @param {string} ghsaId
 * @param {string} comment
 * @returns {Promise<void>}
 */
async function addIgnoreComment(workspace, ghsaId, comment) {
  const path = join(workspace.dir, 'pnpm-workspace.yaml');
  const text = await readFile(path, 'utf8');
  const entry = new RegExp(`^(\\s*- )'?${ghsaId}'?[ \\t]*$`, 'm');
  // Comments can't span lines
  const singleLine = comment.replaceAll(/\s+/g, ' ');
  await writeFile(
    path,
    text.replace(entry, (_match, prefix) => {
      return `${prefix}${ghsaId} # ${singleLine}`;
    })
  );
}

/**
 * @typedef {Readonly<{
 *   text: string;
 *   ignored: ReadonlyArray<string>;
 *   overrides: Readonly<Record<string, string>>;
 * }>} ConfigSnapshot
 */

/**
 * @param {Workspace} workspace
 * @param {string} ref
 * @returns {Promise<ConfigSnapshot>}
 */
async function readConfigAt(workspace, ref) {
  const path = relative(REPO_ROOT, join(workspace.dir, 'pnpm-workspace.yaml'));
  const { stdout: text } = await git(['show', `${ref}:${path}`]);
  const dir = await mkdtemp(join(tmpdir(), 'audit-deps-'));
  try {
    await writeFile(join(dir, 'pnpm-workspace.yaml'), text);
    const snapshot = { ...workspace, dir };
    const ignored = await getIgnoredGhsas(snapshot);
    const overrides = await getOverrides(snapshot);
    return { text, ignored, overrides };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Re-applies the ignores and overrides the open PR changed, onto `main`.
 * Overrides are only kept while `main` still has an advisory for the package.
 *
 * @param {Workspace} workspace
 * @param {string} base the commit the PR was built on
 * @returns {Promise<boolean>} whether anything changed
 */
async function carryDecisions(workspace, base) {
  const before = await readConfigAt(workspace, base);
  const after = await readConfigAt(workspace, REMOTE_BRANCH);

  const ignored = await getIgnoredGhsas(workspace);
  const added = after.ignored.filter(id => {
    return !before.ignored.includes(id) && !ignored.includes(id);
  });
  const removed = before.ignored.filter(id => !after.ignored.includes(id));
  const nextIgnored = [
    ...ignored.filter(id => !removed.includes(id)),
    ...added,
  ];
  let changed = false;
  if (added.length > 0 || nextIgnored.length !== ignored.length) {
    await setIgnoredGhsas(workspace, nextIgnored);
    for (const ghsaId of added) {
      const entry = new RegExp(`^\\s*- '?${ghsaId}'?\\s*#\\s*(.+)$`, 'm');
      const comment = after.text.match(entry)?.[1] ?? null;
      if (comment != null) {
        // oxlint-disable-next-line no-await-in-loop
        await addIgnoreComment(workspace, ghsaId, comment);
      }
    }
    changed = true;
  }

  const advisories = await getAllAdvisories(workspace);
  const overrides = await getOverrides(workspace);
  /** @type {Record<string, string>} */
  const nextOverrides = { ...overrides };
  let overridesChanged = false;
  for (const [key, value] of Object.entries(after.overrides)) {
    const isFromPr = before.overrides[key] !== value;
    // Not git, URL, `file:` or `npm:` sources, which install would fetch
    const isVersionRange = VERSION_RANGE.test(value);
    const isNeeded = advisories.some(advisory => {
      return isEntryForModule(key, advisory.moduleName);
    });
    if (isFromPr && isVersionRange && isNeeded && overrides[key] !== value) {
      nextOverrides[key] = value;
      overridesChanged = true;
    }
  }
  if (overridesChanged) {
    await setProjectConfig(workspace, 'overrides', nextOverrides);
    await runPnpmForCommand(workspace, ['install', '--no-frozen-lockfile']);
    advisoryCache.delete(workspace);
    changed = true;
  }
  return changed;
}

/**
 * @param {WorkspaceCommand} command
 * @returns {Promise<string | null>} the commit subject, `null` when nothing changed
 */
async function applyIgnore(command) {
  const { workspace, ghsaId, reason } = command;
  const advisory = await findAdvisory(workspace, ghsaId);
  const ignored = await getIgnoredGhsas(workspace);
  if (ignored.includes(ghsaId)) {
    return null;
  }
  await setIgnoredGhsas(workspace, [...ignored, ghsaId]);
  const comment =
    reason != null
      ? `${advisory.moduleName} (${reason})`
      : advisory.moduleName;
  await addIgnoreComment(workspace, ghsaId, comment);
  return `Ignore ${advisory.moduleName} advisory in ${workspace.label}`;
}

/**
 * @param {WorkspaceCommand} command
 * @returns {Promise<string | null>}
 */
async function applyUnignore(command) {
  const { workspace, ghsaId } = command;
  const ignored = await getIgnoredGhsas(workspace);
  if (!ignored.includes(ghsaId)) {
    return null;
  }
  await setIgnoredGhsas(
    workspace,
    ignored.filter(id => id !== ghsaId)
  );
  return `Stop ignoring ${ghsaId} in ${workspace.label}`;
}

/**
 * @param {Workspace} workspace
 * @param {ReadonlyArray<string>} pnpmArgs
 * @returns {Promise<void>}
 */
async function runPnpmForCommand(workspace, pnpmArgs) {
  try {
    await runPnpm(workspace, pnpmArgs);
  } catch (error) {
    if (!(error instanceof PnpmCommandError)) {
      throw error;
    }
    const hint = error.isPatchFailure
      ? ', its patch needs to be recreated by hand'
      : '';
    throw new CommandError(`${error.message}${hint}`);
  }
}

/**
 * @param {WorkspaceCommand} command
 * @returns {Promise<string | null>}
 */
async function applyOverride(command) {
  const { workspace, ghsaId } = command;
  const advisory = await findAdvisory(workspace, ghsaId);
  if ((await getIgnoredGhsas(workspace)).includes(ghsaId)) {
    throw new CommandError('it is ignored, `!unignore` it first');
  }
  if (advisory.patchedVersions == null) {
    throw new CommandError('it has no fixed version');
  }

  const before = await getOverrides(workspace);
  // Writes overrides for every fixable advisory, only this one's are kept
  await runPnpmForCommand(workspace, ['audit', '--fix=override']);
  const after = await getOverrides(workspace);

  /** @type {Record<string, string>} */
  const overrides = { ...before };
  let added = false;
  for (const [key, value] of Object.entries(after)) {
    if (!Object.hasOwn(before, key) && isEntryForModule(key, advisory.moduleName)) {
      overrides[key] = value;
      added = true;
    }
  }
  if (!added) {
    throw new CommandError("`pnpm audit --fix=override` didn't add an override for it");
  }
  await setProjectConfig(workspace, 'overrides', overrides);
  // Frozen by default in CI
  await runPnpmForCommand(workspace, ['install', '--no-frozen-lockfile']);
  advisoryCache.delete(workspace);

  const remaining = await runAudit(workspace);
  if (remaining.some(candidate => candidate.ghsaId === ghsaId)) {
    throw new CommandError('it is still reported after the override');
  }
  return `Override ${advisory.moduleName} in ${workspace.label}`;
}

/**
 * @param {WorkspaceCommand} command
 * @returns {Promise<CommandResult>}
 */
async function applyWorkspaceCommand(command) {
  const text = formatCommand(command);

  /** @type {string | null} */
  let subject;
  try {
    if (command.name === 'ignore') {
      subject = await applyIgnore(command);
    } else if (command.name === 'unignore') {
      subject = await applyUnignore(command);
    } else {
      subject = await applyOverride(command);
    }
  } catch (error) {
    // Undo a half-applied command, earlier ones are committed
    await discardWorkspaceChanges(command.workspace);
    if (!(error instanceof CommandError)) {
      throw error;
    }
    return { status: 'failed', text, message: error.message };
  }

  const { code } = await git(['diff', '--quiet', 'HEAD'], {
    allowFailure: true,
  });
  if (subject == null || code === 0) {
    return { status: 'unchanged', text, message: 'already done' };
  }

  await commit(subject);
  return { status: 'applied', text, message: subject };
}

/**
 * @param {Workspace} workspace
 * @returns {Promise<void>}
 */
async function discardWorkspaceChanges(workspace) {
  await restoreWorkspace(workspace);
  advisoryCache.delete(workspace);
}

/**
 * Local commits, so a failed fix can be undone with `git checkout HEAD`.
 * `publish.mjs` squashes them into one.
 *
 * @param {string} message
 * @returns {Promise<void>}
 */
async function commit(message) {
  await git(['add', '--update']);
  await git(['commit', '-m', message]);
}

/**
 * @param {Readonly<Record<string, string>>} outputs
 * @returns {Promise<void>}
 */
async function writeOutputs(outputs) {
  if (GITHUB_OUTPUT != null) {
    await appendGitHubOutputs(GITHUB_OUTPUT, outputs);
    return;
  }
  for (const [key, value] of Object.entries(outputs)) {
    console.log(`--- ${key} ---\n${value}`);
  }
}

const STATUS_ICONS = { applied: '✅', unchanged: '➖', failed: '❌' };

/**
 * @param {CommandResult} result
 * @returns {string}
 */
function renderResult(result) {
  return `- ${STATUS_ICONS[result.status]} \`${result.text}\`: ${result.message}\n`;
}

const commandComment = await readCommandComment();

const pr = await getAutofixPullRequest(repo, GITHUB_REPOSITORY_OWNER);
const hasOpenPr = pr != null && (await hasRemoteBranch());
const blocked = hasOpenPr && (await hasCommitsFromOtherPeople());

if (hasOpenPr && !blocked) {
  const { stdout } = await git(['merge-base', 'HEAD', REMOTE_BRANCH]);
  const base = stdout.trim();
  for (const workspace of WORKSPACES) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      if (await carryDecisions(workspace, base)) {
        // oxlint-disable-next-line no-await-in-loop
        await commit(`Keep decisions from the pull request in ${workspace.label}`);
      }
    } catch (error) {
      if (!(error instanceof CommandError)) {
        throw error;
      }
      console.log(
        `::warning title=Pull request decisions::Dropped them in ${workspace.label}: ${error.message}`
      );
      // oxlint-disable-next-line no-await-in-loop
      await discardWorkspaceChanges(workspace);
    }
  }
}

/** @type {Array<WorkspaceCommand>} */
const commentCommands = [];
/** @type {Array<string>} */
const commentErrors = [...(commandComment?.errors ?? [])];
if (commandComment != null && blocked) {
  commentErrors.push(
    `\`${BRANCH}\` has commits from other people, so it isn't updated anymore. Merge or close its pull request first.`
  );
} else if (commandComment != null) {
  for (const command of commandComment.commands) {
    // oxlint-disable-next-line no-await-in-loop
    const workspaces = await getCommandWorkspaces(command);
    if (workspaces.length === 0) {
      const state = command.name === 'unignore' ? 'ignored' : 'reported';
      commentErrors.push(
        `\`${formatCommand(command)}\`: ${command.ghsaId} isn't ${state} in any workspace`
      );
    }
    for (const workspace of workspaces) {
      commentCommands.push({ ...command, workspace });
    }
  }
}

/** @type {Array<CommandResult>} */
const commentResults = [];
for (const command of commentCommands) {
  // oxlint-disable-next-line no-await-in-loop
  const result = await applyWorkspaceCommand(command);
  console.log(`${result.status}: ${result.text} (${result.message})`);
  commentResults.push(result);
}

let reply = '';
if (commandComment != null) {
  for (const result of commentResults) {
    reply += renderResult(result);
  }
  for (const error of commentErrors) {
    reply += `- ❌ ${error}\n`;
  }
}

const replyFailed =
  commentErrors.length > 0 ||
  commentResults.some(result => result.status === 'failed');

await writeOutputs({
  reply,
  'reply-failed': `${replyFailed}`,
  'reply-to': commandComment != null ? `${commandComment.issueNumber}` : '',
  'reply-comment-id': commandComment != null ? `${commandComment.id}` : '',
});
