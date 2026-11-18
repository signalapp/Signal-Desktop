// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  getGitHubAdvisory,
  getGitHubOpenPullRequests,
} from './github.mjs';

/** @import { GitHubPullRequest } from './github.mjs' */

export const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

export const BRANCH = 'automation/pnpm-audit-advisories';
export const REMOTE_BRANCH = `origin/${BRANCH}`;
/** On the PR and the issue, which is found by it. Must exist in the repo. */
export const LABEL = 'pnpm-audit-autofix';
export const AUTHOR_NAME = 'automated-signal';
export const AUTHOR_EMAIL =
  '37887102+automated-signal@users.noreply.github.com';

/** Added to the environment of every pnpm command that resolves */
export const PNPM_ENV = {
  // Not needed to update lockfiles, patches are still applied
  pnpm_config_ignore_scripts: 'true',
  // `.pnpmfile.mjs` fails on deprecated packages, which would block every fix.
  // They're reported instead, see `getDeprecatedPackages()` in `fix.mjs`.
  SKIP_DEPRECATED_CHECK: 'true',
};

/**
 * @param {boolean} condition
 * @param {string} message
 * @returns {asserts condition}
 */
export function assert(condition, message) {
  if (!condition) {
    throw new TypeError(message);
  }
}

/**
 * @typedef {Readonly<{
 *   label: string;
 *   dir: string;
 * }>} Workspace
 */

/** @type {ReadonlyArray<Workspace>} */
export const WORKSPACES = [
  { label: 'root', dir: REPO_ROOT },
  { label: 'danger', dir: join(REPO_ROOT, 'danger') },
  {
    label: 'min-os-version',
    dir: join(REPO_ROOT, '.github', 'scripts', 'min-os-version'),
  },
];

/** @typedef {'info' | 'low' | 'moderate' | 'high' | 'critical'} Severity */

/** @type {ReadonlyArray<Severity>} */
const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical'];

/**
 * @param {Severity} severity
 * @returns {number}
 */
export function getSeverityRank(severity) {
  return SEVERITIES.indexOf(severity);
}

// CI fails on main for advisories at this level or above, once they were
// published (and reviewed) this many business days ago
export const CI_AUDIT_LEVEL = 'high';
export const CI_GRACE_BUSINESS_DAYS = 3;

/**
 * @param {string} entry `name` or `name@version`
 * @param {string} moduleName
 * @returns {boolean}
 */
export function isEntryForModule(entry, moduleName) {
  return entry === moduleName || entry.startsWith(`${moduleName}@`);
}

/**
 * @param {Advisory} advisory
 * @returns {boolean}
 */
export function isCheckedByCi(advisory) {
  return getSeverityRank(advisory.severity) >= getSeverityRank(CI_AUDIT_LEVEL);
}

/**
 * @typedef {Readonly<{
 *   version: string;
 *   paths: ReadonlyArray<string>;
 *   dev: boolean;
 * }>} RawAdvisoryFinding
 */

/**
 * @typedef {Readonly<{
 *   id: number;
 *   title: string;
 *   module_name: string;
 *   vulnerable_versions: string;
 *   patched_versions: string | null;
 *   severity: Severity;
 *   github_advisory_id: string;
 *   findings: ReadonlyArray<RawAdvisoryFinding>;
 * }>} RawAdvisory
 */

/**
 * @typedef {Readonly<{
 *   advisories: Readonly<Record<string, RawAdvisory>>;
 * }>} RawAuditReport
 */

/**
 * @typedef {Readonly<{
 *   error: Readonly<{ code: string; message: string }>;
 * }>} RawAuditError
 */

/** @typedef {'dependency' | 'devDependency' | 'both'} DependencyType */

/**
 * @typedef {Readonly<{
 *   id: number;
 *   workspace: Workspace;
 *   moduleName: string;
 *   title: string;
 *   severity: Severity;
 *   ghsaId: string;
 *   patchedVersions: string | null;
 *   dependencyType: DependencyType;
 *   versions: ReadonlyArray<string>;
 *   locations: ReadonlyArray<string>;
 * }>} Advisory
 */

/**
 * @param {ReadonlyArray<RawAdvisoryFinding>} findings
 * @returns {DependencyType}
 */
function getDependencyType(findings) {
  if (findings.every(finding => finding.dev)) {
    return 'devDependency';
  }
  if (findings.every(finding => !finding.dev)) {
    return 'dependency';
  }
  return 'both';
}

/**
 * Audit paths look like `.>foo>bar` or `packages__mock-server>foo>bar`, where
 * the first segment is the workspace project the dependency is used from.
 *
 * @param {Workspace} workspace
 * @param {string} path
 * @returns {string}
 */
function getAuditPathLocation(workspace, path) {
  const [project] = path.split('>', 1);
  if (project == null || project === '.' || project === '') {
    return workspace.label;
  }
  return project.replaceAll('__', '/');
}

/**
 * @param {Iterable<string>} values
 * @returns {ReadonlyArray<string>}
 */
function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

/**
 * @param {Advisory} a
 * @param {Advisory} b
 * @returns {number}
 */
export function compareAdvisories(a, b) {
  return (
    getSeverityRank(b.severity) - getSeverityRank(a.severity) ||
    a.moduleName.localeCompare(b.moduleName)
  );
}

/**
 * @param {Workspace} workspace
 * @param {RawAdvisory} advisory
 * @returns {Advisory}
 */
function normalizeAdvisory(workspace, advisory) {
  const versions = uniqueSorted(
    advisory.findings.map(finding => finding.version)
  );
  const locations = uniqueSorted(
    advisory.findings.flatMap(finding => {
      return finding.paths.map(path => getAuditPathLocation(workspace, path));
    })
  );

  return {
    id: advisory.id,
    workspace,
    moduleName: advisory.module_name,
    title: advisory.title,
    severity: advisory.severity,
    ghsaId: advisory.github_advisory_id,
    patchedVersions: advisory.patched_versions,
    dependencyType: getDependencyType(advisory.findings),
    versions,
    locations,
  };
}

/**
 * @typedef {Readonly<{
 *   cwd: string;
 *   env?: Readonly<Record<string, string>>;
 *   echoOutput?: boolean;
 *   allowFailure?: boolean;
 * }>} RunCommandOptions
 */

/**
 * @typedef {Readonly<{
 *   code: number;
 *   stdout: string;
 *   stderr: string;
 * }>} CommandResult
 */

/**
 * @param {string} command
 * @param {ReadonlyArray<string>} args
 * @param {RunCommandOptions} options
 * @returns {Promise<CommandResult>}
 */
export async function runCommand(command, args, options) {
  const { cwd, env = {}, echoOutput = false, allowFailure = false } = options;
  const commandText = [command, ...args].join(' ');

  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  // Decodes characters split across chunks correctly
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (/** @type {string} */ chunk) => {
    stdout += chunk;
    if (echoOutput) {
      process.stdout.write(chunk);
    }
  });

  child.stderr.on('data', (/** @type {string} */ chunk) => {
    stderr += chunk;
    if (echoOutput) {
      process.stderr.write(chunk);
    }
  });

  /** @type {number} */
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', exitCode => resolve(exitCode ?? 1));
  });

  if (code !== 0 && !allowFailure) {
    const details = `${stdout}\n${stderr}`.trim();
    throw new Error(
      `\`${commandText}\` failed with exit code ${code}\n${details}`.trim()
    );
  }

  return { code, stdout, stderr };
}

/**
 * @param {Workspace} workspace
 * @param {string} key
 * @returns {Promise<unknown>}
 */
export async function getProjectConfig(workspace, key) {
  const { stdout } = await runCommand(
    'pnpm',
    ['config', 'get', '--location=project', '--json', key],
    { cwd: workspace.dir }
  );
  const trimmed = stdout.trim();
  return trimmed === '' ? null : JSON.parse(trimmed);
}

/**
 * @param {Workspace} workspace
 * @param {string} key
 * @param {unknown} value
 * @returns {Promise<void>}
 */
export async function setProjectConfig(workspace, key, value) {
  await runCommand(
    'pnpm',
    [
      'config',
      'set',
      '--location=project',
      '--json',
      key,
      JSON.stringify(value),
    ],
    { cwd: workspace.dir }
  );
}

/**
 * Step outputs, which may be multiline.
 *
 * @param {string} path `GITHUB_OUTPUT`
 * @param {Readonly<Record<string, string>>} outputs
 * @returns {Promise<void>}
 */
export async function appendGitHubOutputs(path, outputs) {
  const delimiter = `EOF_${randomUUID()}`;
  let output = '';
  for (const [key, value] of Object.entries(outputs)) {
    output += `${key}<<${delimiter}\n${value}\n${delimiter}\n`;
  }
  await appendFile(path, output);
}

/**
 * @param {Workspace} workspace
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function deleteProjectConfig(workspace, key) {
  await runCommand('pnpm', ['config', 'delete', '--location=project', key], {
    cwd: workspace.dir,
  });
}

/**
 * @param {ReadonlyArray<string>} gitArgs
 * @param {Readonly<{ allowFailure?: boolean }>} [options]
 * @returns {Promise<CommandResult>}
 */
export async function git(gitArgs, options = {}) {
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
 * @returns {Promise<boolean>}
 */
export async function hasRemoteBranch() {
  const { code } = await git(['rev-parse', '--verify', '--quiet', REMOTE_BRANCH], {
    allowFailure: true,
  });
  return code === 0;
}

/**
 * @returns {Promise<boolean>}
 */
export async function hasCommitsFromOtherPeople() {
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
 * @param {string} repo `owner/repo`
 * @param {string} owner
 * @returns {Promise<GitHubPullRequest | null>}
 */
export async function getAutofixPullRequest(repo, owner) {
  const pulls = await getGitHubOpenPullRequests(repo, `${owner}:${BRANCH}`);
  return pulls[0] ?? null;
}

/**
 * @param {Workspace} workspace
 * @returns {string} relative to `REPO_ROOT`
 */
export function getWorkspacePath(workspace) {
  return workspace.dir === REPO_ROOT ? '.' : relative(REPO_ROOT, workspace.dir);
}

/**
 * Restoring the root also restores the workspaces inside it.
 *
 * @param {Workspace} workspace
 * @returns {Promise<void>}
 */
export async function restoreWorkspace(workspace) {
  await git(['checkout', 'HEAD', '--', getWorkspacePath(workspace)]);
}

export class PnpmCommandError extends Error {
  /**
   * @param {string} command
   * @param {Workspace} workspace
   * @param {string} output
   */
  constructor(command, workspace, output) {
    const errorCode = output.match(/ERR_PNPM_[A-Z0-9_]+/)?.[0] ?? null;
    const withCode = errorCode != null ? ` with \`${errorCode}\`` : '';
    super(`\`${command}\` in \`${workspace.label}\` failed${withCode}`);
    this.errorCode = errorCode;
    this.output = output;
  }

  /** A patch in `patchedDependencies` doesn't apply to the new version */
  get isPatchFailure() {
    return (
      this.errorCode === 'ERR_PNPM_PATCH_FAILED' ||
      this.errorCode === 'ERR_PNPM_UNUSED_PATCH'
    );
  }
}

/**
 * @param {Workspace} workspace
 * @param {ReadonlyArray<string>} pnpmArgs
 * @returns {Promise<void>}
 * @throws {PnpmCommandError}
 */
export async function runPnpm(workspace, pnpmArgs) {
  const command = `pnpm ${pnpmArgs.join(' ')}`;
  console.log(`=== ${workspace.label}: ${command} ===`);
  const { code, stdout, stderr } = await runCommand('pnpm', pnpmArgs, {
    cwd: workspace.dir,
    env: PNPM_ENV,
    echoOutput: true,
    allowFailure: true,
  });
  if (code !== 0) {
    throw new PnpmCommandError(command, workspace, `${stdout}\n${stderr}`);
  }
}

/**
 * @param {Workspace} workspace
 * @returns {Promise<Readonly<Record<string, string>>>}
 */
export async function getOverrides(workspace) {
  const overrides = /** @type {Readonly<Record<string, string>> | null} */ (
    await getProjectConfig(workspace, 'overrides')
  );
  return overrides ?? {};
}

/**
 * @param {Workspace} workspace
 * @returns {Promise<ReadonlyArray<string>>}
 */
export async function getIgnoredGhsas(workspace) {
  // pnpm 11 reads `auditConfig.ignoreGhsas` as `audit.ignore`
  const ignored = /** @type {ReadonlyArray<string> | null} */ (
    await getProjectConfig(workspace, 'audit.ignore')
  );
  return ignored ?? [];
}

/**
 * Keeps end-of-line comments with their entries, but drops any other
 * `auditConfig` keys (pnpm can't set nested keys).
 *
 * @param {Workspace} workspace
 * @param {ReadonlyArray<string>} ghsaIds
 * @returns {Promise<void>}
 */
export async function setIgnoredGhsas(workspace, ghsaIds) {
  await setProjectConfig(workspace, 'auditConfig', { ignoreGhsas: ghsaIds });
}

/**
 * Includes advisories in `auditConfig.ignoreGhsas`.
 *
 * @param {Workspace} workspace
 * @returns {Promise<ReadonlyArray<Advisory>>}
 */
export async function runAuditWithoutIgnores(workspace) {
  const path = join(workspace.dir, 'pnpm-workspace.yaml');
  const original = await readFile(path, 'utf8');
  try {
    await deleteProjectConfig(workspace, 'auditConfig');
    return await runAudit(workspace);
  } finally {
    await writeFile(path, original);
  }
}

/**
 * @param {Workspace} workspace
 * @param {Readonly<{ auditLevel?: Severity | null }>} [options]
 * @returns {Promise<ReadonlyArray<Advisory>>}
 */
export async function runAudit(workspace, options = {}) {
  const args = ['audit', '--json'];
  if (options.auditLevel != null) {
    args.push('--audit-level', options.auditLevel);
  }

  // Exits non-zero when it finds advisories. pnpm retries network errors itself.
  const { stdout, stderr } = await runCommand('pnpm', args, {
    cwd: workspace.dir,
    allowFailure: true,
  });

  /** @type {RawAuditReport | RawAuditError} */
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new Error(
      `pnpm audit in ${workspace.label} printed invalid JSON:\n${stdout}\n${stderr}`
    );
  }

  if ('error' in report) {
    const { code, message } = report.error;
    throw new Error(
      `pnpm audit in ${workspace.label} failed: ${code} ${message}`
    );
  }

  return Object.values(report.advisories)
    .map(advisory => normalizeAdvisory(workspace, advisory))
    .sort(compareAdvisories);
}

/**
 * Number of weekday midnights (UTC) between `start` and `end`.
 *
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
export function getBusinessDaysBetween(start, end) {
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  let count = 0;
  while (cursor <= end) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/**
 * @param {string} ghsaId
 * @returns {string}
 */
export function getAdvisoryUrl(ghsaId) {
  return `https://github.com/advisories/${encodeURIComponent(ghsaId)}`;
}

/**
 * When the advisory reached `pnpm audit`, which only reports reviewed
 * advisories. Ones imported from NVD can be reviewed weeks after publishing.
 *
 * @param {string} ghsaId
 * @returns {Promise<Date>}
 */
async function fetchAdvisoryPublishedAt(ghsaId) {
  const advisory = await getGitHubAdvisory(ghsaId);
  if (advisory.published_at == null) {
    throw new Error('Advisory has no publish date');
  }
  const publishedAt = new Date(advisory.published_at);
  if (advisory.github_reviewed_at == null) {
    return publishedAt;
  }
  const reviewedAt = new Date(advisory.github_reviewed_at);
  return reviewedAt > publishedAt ? reviewedAt : publishedAt;
}

/**
 * @typedef {Readonly<{
 *   publishDates: ReadonlyMap<string, Date>;
 *   errors: ReadonlyArray<string>;
 * }>} AdvisoryPublishDates
 */

/**
 * @param {ReadonlyArray<string>} ghsaIds
 * @returns {Promise<AdvisoryPublishDates>}
 */
export async function fetchAdvisoryPublishDates(ghsaIds) {
  /** @type {Map<string, Date>} */
  const publishDates = new Map();
  /** @type {Array<string>} */
  const errors = [];

  await Promise.all(
    Array.from(new Set(ghsaIds), async ghsaId => {
      try {
        publishDates.set(ghsaId, await fetchAdvisoryPublishedAt(ghsaId));
      } catch (error) {
        errors.push(`${ghsaId}: ${error}`);
      }
    })
  );

  if (errors.length > 0) {
    // Shows up as an annotation on the workflow run
    console.log(
      `::warning title=GitHub advisory API::Couldn't get publish dates for ${errors.length} advisories`
    );
    console.warn(errors.join('\n'));
  }

  return { publishDates, errors };
}

/**
 * @param {string} version
 * @returns {number | null}
 */
function getMajorVersion(version) {
  const match = version.match(/(\d+)\.\d+\.\d+/);
  return match?.[1] != null ? Number.parseInt(match[1], 10) : null;
}

/**
 * @param {ReadonlyArray<string>} fromVersions
 * @param {string | null} toRange e.g. `>=1.2.3`
 * @returns {boolean}
 */
export function isMajorUpgrade(fromVersions, toRange) {
  const toMajor = toRange != null ? getMajorVersion(toRange) : null;
  if (toMajor == null) {
    return false;
  }
  return fromVersions.some(version => {
    const fromMajor = getMajorVersion(version);
    return fromMajor != null && toMajor > fromMajor;
  });
}
