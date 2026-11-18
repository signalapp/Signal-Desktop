// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { renderCommandHelp } from './commands.mjs';
import {
  CI_GRACE_BUSINESS_DAYS,
  PNPM_ENV,
  PnpmCommandError,
  REPO_ROOT,
  WORKSPACES,
  appendGitHubOutputs,
  assert,
  compareAdvisories,
  fetchAdvisoryPublishDates,
  getAdvisoryUrl,
  getBusinessDaysBetween,
  getIgnoredGhsas,
  getOverrides,
  getProjectConfig,
  getWorkspacePath,
  git,
  isCheckedByCi,
  isEntryForModule,
  isMajorUpgrade,
  restoreWorkspace,
  runAudit,
  runAuditWithoutIgnores,
  runCommand,
  runPnpm,
  setProjectConfig,
} from './utils.mjs';

/** @import { Command } from './commands.mjs' */
/** @import { Advisory, Workspace } from './utils.mjs' */

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
  },
});

const dryRun = args['dry-run'];

// In CI, `origin/main`: `apply-commands.mjs` commits before this runs
const BASE_REF = process.env.BASE_REF ?? 'HEAD';

/** @typedef {'update' | 'override' | 'dedupe'} FixMethod */

/**
 * @typedef {Readonly<{
 *   remainingAdvisories: ReadonlyArray<Advisory>;
 *   initialOverrides: Readonly<Record<string, string>>;
 *   patchedDependencies: Readonly<Record<string, string>>;
 * }>} FixContext
 */

/**
 * @type {ReadonlyArray<Readonly<{
 *   method: FixMethod;
 *   skip: (workspace: Workspace, context: FixContext) => Promise<boolean>;
 *   run: (workspace: Workspace, context: FixContext) => Promise<void>;
 * }>>}
 */
const FIX_STEPS = [
  {
    method: 'update',
    skip: async (_workspace, context) => context.remainingAdvisories.length === 0,
    run: workspace => runPnpmStep(workspace, ['audit', '--fix=update']),
  },
  {
    method: 'override',
    skip: async (_workspace, context) => context.remainingAdvisories.length === 0,
    async run(workspace, context) {
      // `--fix=override` only writes the overrides, it doesn't install them
      await runPnpmStep(workspace, ['audit', '--fix=override']);
      await removeRiskyOverrides(workspace, context);
      // Frozen by default in CI
      await runPnpmStep(workspace, ['install', '--no-frozen-lockfile']);
    },
  },
  {
    // Counts as `update`: it can also fix advisories
    method: 'update',
    skip: async () => false,
    run: upgradeDeprecatedPackages,
  },
  {
    method: 'dedupe',
    // Nothing to dedupe when nothing changed
    skip: async workspace => !(await hasWorkspaceChanges(workspace)),
    // Installing can undo dedupes when there are cyclical peer deps
    run: workspace => runPnpmStep(workspace, ['dedupe']),
  },
];

/** @typedef {'✅' | '⚠️' | '❌' | '☢️'} Status */

/** @type {ReadonlyArray<Status>} */
const STATUS_ORDER = ['☢️', '❌', '⚠️', '✅'];

/**
 * @typedef {Readonly<{
 *   status: Status;
 *   advisory: Advisory;
 *   fixMethod: FixMethod | null;
 *   notes: ReadonlyArray<string>;
 * }>} AdvisoryRow
 */

/**
 * @typedef {Readonly<{
 *   name: string;
 *   version: string;
 *   message: string | null;
 * }>} DeprecatedPackage
 */

/**
 * @typedef {Readonly<{
 *   workspace: Workspace;
 *   rows: ReadonlyArray<AdvisoryRow>;
 *   failure: PnpmCommandError | null;
 *   removedReleaseAgeExcludes: ReadonlyArray<string>;
 *   deprecated: ReadonlyArray<DeprecatedPackage>;
 *   upgradedDeprecated: ReadonlyArray<DeprecatedPackage>;
 *   staleIgnores: ReadonlyArray<StaleIgnore>;
 * }>} WorkspaceResult
 */

/**
 * An `auditConfig.ignoreGhsas` entry to revisit.
 *
 * @typedef {Readonly<{
 *   ghsaId: string;
 *   advisory: Advisory | null;
 *   notes: ReadonlyArray<string>;
 * }>} StaleIgnore
 */

/**
 * @param {Workspace} workspace
 * @param {ReadonlyArray<string>} pnpmArgs
 * @returns {Promise<void>}
 */
async function runPnpmStep(workspace, pnpmArgs) {
  if (dryRun) {
    console.log(`[dry-run] ${workspace.label}: pnpm ${pnpmArgs.join(' ')}`);
    return;
  }
  try {
    await runPnpm(workspace, pnpmArgs);
  } catch (error) {
    // `audit --fix=update` also exits 1 when it couldn't fix everything,
    // which the next audit reports
    const isUnfixed =
      error instanceof PnpmCommandError &&
      error.errorCode == null &&
      pnpmArgs.includes('--fix=update');
    if (!isUnfixed) {
      throw error;
    }
  }
}

/**
 * @typedef {Readonly<{
 *   code: number;
 *   deprecated: ReadonlyArray<DeprecatedPackage>;
 *   errors: ReadonlyArray<Readonly<{ code: string | null; message: string }>>;
 * }>} PnpmEvents
 */

/**
 * Runs pnpm with its ndjson reporter, which has an event for each deprecated
 * package that isn't in `allowedDeprecatedVersions`. The output isn't echoed,
 * it's huge.
 *
 * @param {Workspace} workspace
 * @param {ReadonlyArray<string>} pnpmArgs
 * @returns {Promise<PnpmEvents>}
 */
async function runPnpmForEvents(workspace, pnpmArgs) {
  console.log(`=== ${workspace.label}: pnpm ${pnpmArgs.join(' ')} ===`);
  const { code, stdout } = await runCommand(
    'pnpm',
    ['--reporter=ndjson', ...pnpmArgs],
    { cwd: workspace.dir, env: PNPM_ENV, allowFailure: true }
  );

  /** @type {Map<string, DeprecatedPackage>} */
  const deprecated = new Map();
  /** @type {Array<{ code: string | null; message: string }>} */
  const errors = [];
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) {
      continue;
    }
    /** @type {Record<string, unknown>} */
    const event = JSON.parse(line);
    if (event.name === 'pnpm:deprecation') {
      const name = /** @type {string} */ (event.pkgName);
      const version = /** @type {string} */ (event.pkgVersion);
      const message = /** @type {string | null} */ (event.deprecated ?? null);
      deprecated.set(`${name}@${version}`, { name, version, message });
    }
    if (event.level === 'error' && event.name === 'pnpm') {
      errors.push({
        code: /** @type {string | null} */ (event.code ?? null),
        message: /** @type {string} */ (event.message ?? ''),
      });
    }
  }
  return { code, deprecated: Array.from(deprecated.values()), errors };
}

/**
 * @param {Workspace} workspace
 * @param {string} command
 * @param {PnpmEvents} events
 * @returns {PnpmCommandError}
 */
function getEventsError(workspace, command, events) {
  const output = events.errors
    .map(error => `${error.code ?? 'Error'}: ${error.message}`)
    .join('\n');
  return new PnpmCommandError(command, workspace, output);
}

/**
 * Resolves without changing anything.
 *
 * @param {Workspace} workspace
 * @returns {Promise<ReadonlyArray<DeprecatedPackage>>}
 */
async function getDeprecatedPackages(workspace) {
  if (dryRun) {
    return [];
  }

  const events = await runPnpmForEvents(workspace, ['dedupe', '--check']);

  // It also exits 1 when there's something to dedupe, which isn't an error here
  const isOnlyDedupeCheckIssues =
    events.errors.length > 0 &&
    events.errors.every(error => {
      return error.code === 'ERR_PNPM_DEDUPE_CHECK_ISSUES';
    });
  if (events.code !== 0 && !isOnlyDedupeCheckIssues) {
    throw getEventsError(workspace, 'pnpm dedupe --check', events);
  }
  return events.deprecated;
}

/**
 * Whether a newer version that isn't deprecated exists. It might still be out
 * of range for what depends on the package.
 *
 * @param {Workspace} workspace
 * @param {DeprecatedPackage} pkg
 * @returns {Promise<boolean>}
 */
async function hasNewerVersion(workspace, pkg) {
  // The newest version that's newer than this one
  const { stdout } = await runCommand(
    'pnpm',
    ['view', `${pkg.name}@>${pkg.version}`, 'version', 'deprecated', '--json'],
    { cwd: workspace.dir, allowFailure: true }
  );

  /** @type {{ deprecated?: string; error?: { code: string; message: string } }} */
  const result = JSON.parse(stdout);
  if (result.error != null) {
    if (result.error.code === 'ERR_PNPM_PACKAGE_NOT_FOUND') {
      return false;
    }
    throw new Error(
      `pnpm view ${pkg.name} failed: ${result.error.code} ${result.error.message}`
    );
  }
  return result.deprecated == null;
}

/**
 * @param {Workspace} workspace
 * @returns {Promise<boolean>}
 */
async function hasWorkspaceChanges(workspace) {
  if (dryRun) {
    return false;
  }
  // The root contains the other workspaces
  /** @type {Array<string>} */
  const excludes = [];
  for (const other of WORKSPACES) {
    if (other !== workspace && other.dir.startsWith(`${workspace.dir}/`)) {
      excludes.push(`:(exclude)${getWorkspacePath(other)}`);
    }
  }
  const { code } = await git(
    ['diff', '--quiet', BASE_REF, '--', getWorkspacePath(workspace), ...excludes],
    { allowFailure: true }
  );
  return code !== 0;
}

/**
 * Best effort. Each package is updated by itself, and the change is undone
 * unless it gets rid of a deprecated version, so one that can't be upgraded
 * doesn't get in the way of the others or change anything else.
 *
 * @param {Workspace} workspace
 * @returns {Promise<void>}
 */
async function upgradeDeprecatedPackages(workspace) {
  const deprecated = await getDeprecatedPackages(workspace);
  const names = Array.from(new Set(deprecated.map(pkg => pkg.name)));

  for (const name of names) {
    const versions = deprecated.filter(pkg => pkg.name === name);
    // oxlint-disable-next-line no-await-in-loop
    const hasNewer = await Promise.all(
      versions.map(pkg => hasNewerVersion(workspace, pkg))
    );
    if (!hasNewer.includes(true)) {
      console.log(`${name} has no newer version that isn't deprecated`);
      continue;
    }

    // A commit with the current changes, or nothing when there are none
    // oxlint-disable-next-line no-await-in-loop
    const { stdout } = await git(['stash', 'create']);
    const snapshot = stdout.trim() === '' ? 'HEAD' : stdout.trim();

    const command = `pnpm update --depth Infinity ${name}`;
    // oxlint-disable-next-line no-await-in-loop
    const events = await runPnpmForEvents(workspace, [
      'update',
      '--depth',
      'Infinity',
      name,
    ]);

    /** @type {string | null} */
    let undoReason = null;
    if (events.code !== 0) {
      undoReason = getEventsError(workspace, command, events).message;
    } else {
      const fixed = versions.some(before => {
        return !events.deprecated.some(after => {
          return after.name === name && after.version === before.version;
        });
      });
      if (!fixed) {
        undoReason = 'it is still deprecated';
      }
    }

    if (undoReason != null) {
      console.warn(`Didn't upgrade ${name}, ${undoReason}`);
      // oxlint-disable-next-line no-await-in-loop
      await git(['checkout', snapshot, '--', getWorkspacePath(workspace)]);
    }
  }
}

/**
 * @param {Advisory} advisory
 * @param {Readonly<Record<string, string>>} patchedDependencies
 * @returns {string | null}
 */
function getRiskyOverrideReason(advisory, patchedDependencies) {
  if (isMajorUpgrade(advisory.versions, advisory.patchedVersions)) {
    return 'major version bump';
  }
  const isPatched = Object.keys(patchedDependencies).some(spec => {
    return isEntryForModule(spec, advisory.moduleName);
  });
  if (isPatched) {
    return 'patched dependency';
  }
  return null;
}

/**
 * Removes the overrides just added for risky advisories.
 *
 * @param {Workspace} workspace
 * @param {FixContext} context
 * @returns {Promise<void>}
 */
async function removeRiskyOverrides(workspace, context) {
  if (dryRun) {
    return;
  }
  const { remainingAdvisories, initialOverrides, patchedDependencies } =
    context;

  const riskyModules = new Set(
    remainingAdvisories
      .filter(advisory => {
        return getRiskyOverrideReason(advisory, patchedDependencies) != null;
      })
      .map(advisory => advisory.moduleName)
  );

  const overrides = await getOverrides(workspace);

  /** @type {Array<string>} */
  const removed = [];
  const kept = Object.fromEntries(
    Object.entries(overrides).filter(([key]) => {
      const isNew = !Object.hasOwn(initialOverrides, key);
      const isRisky = Array.from(riskyModules).some(moduleName => {
        return isEntryForModule(key, moduleName);
      });
      if (isNew && isRisky) {
        removed.push(key);
        return false;
      }
      return true;
    })
  );

  if (removed.length > 0) {
    console.log(`Skipping risky overrides: ${removed.join(', ')}`);
    await setProjectConfig(workspace, 'overrides', kept);
  }
}

/**
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * @param {Workspace} workspace
 * @param {string} ghsaId
 * @returns {Promise<Date | null>} `null` when it isn't committed
 */
async function getIgnoreAddedAt(workspace, ghsaId) {
  const path = join(getWorkspacePath(workspace), 'pnpm-workspace.yaml');
  const { stdout } = await git([
    'log',
    '-1',
    '--format=%cI',
    '-S',
    ghsaId,
    '--',
    path,
  ]);
  return stdout.trim() === '' ? null : new Date(stdout.trim());
}

/**
 * @param {Workspace} workspace
 * @param {string} name
 * @returns {Promise<Readonly<Record<string, string>>>} version to ISO date
 */
async function getVersionPublishTimes(workspace, name) {
  const { code, stdout } = await runCommand(
    'pnpm',
    ['view', name, 'time', '--json'],
    { cwd: workspace.dir, allowFailure: true }
  );
  if (code !== 0) {
    console.warn(`Couldn't get publish times for ${name}`);
    return {};
  }
  return JSON.parse(stdout);
}

/**
 * Ignores that no longer match anything installed, or that have a fixed
 * version published after they were added.
 *
 * @param {Workspace} workspace
 * @returns {Promise<ReadonlyArray<StaleIgnore>>}
 */
async function getStaleIgnores(workspace) {
  const ignored = await getIgnoredGhsas(workspace);
  if (dryRun || ignored.length === 0) {
    return [];
  }
  const advisories = await runAuditWithoutIgnores(workspace);
  const minimumReleaseAge =
    /** @type {number | null} */ (
      await getProjectConfig(workspace, 'minimumReleaseAge')
    ) ?? 0;
  const now = new Date();

  /** @type {Array<StaleIgnore>} */
  const staleIgnores = [];
  for (const ghsaId of ignored) {
    const advisory =
      advisories.find(candidate => candidate.ghsaId === ghsaId) ?? null;
    if (advisory == null) {
      staleIgnores.push({
        ghsaId,
        advisory,
        notes: ['Nothing installed is affected anymore'],
      });
      continue;
    }
    if (advisory.patchedVersions == null) {
      continue;
    }

    // oxlint-disable-next-line no-await-in-loop
    const addedAt = await getIgnoreAddedAt(workspace, ghsaId);
    if (addedAt == null) {
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop
    const publishTimes = await getVersionPublishTimes(
      workspace,
      advisory.moduleName
    );
    // e.g. `>=2.3.3 <3.0.0 || >=4.0.8`
    const fixedVersions =
      advisory.patchedVersions.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g) ?? [];

    for (const version of fixedVersions) {
      const time = publishTimes[version];
      if (time == null || new Date(time) <= addedAt) {
        continue;
      }
      const publishedAt = new Date(time);
      const installableAt = new Date(
        publishedAt.getTime() + minimumReleaseAge * 60 * 1000
      );
      const notes = [
        `${version} was published on ${formatDate(publishedAt)}, after it was ignored on ${formatDate(addedAt)}`,
      ];
      if (installableAt > now) {
        notes.push(
          `Installable on ${formatDate(installableAt)} (<code>minimumReleaseAge</code>)`
        );
      }
      if (isMajorUpgrade(advisory.versions, advisory.patchedVersions)) {
        notes.push('Major version bump');
      }
      staleIgnores.push({ ghsaId, advisory, notes });
      break;
    }
  }
  return staleIgnores;
}

/**
 * @param {Readonly<{
 *   advisory: Advisory;
 *   fixed: boolean;
 *   fixMethod: FixMethod | null;
 *   overrideRisk: string | null;
 *   introduced: boolean;
 *   patchFiles: ReadonlyArray<string>;
 *   addedExcludes: ReadonlyArray<string>;
 *   publishedAt: Date | null;
 * }>} facts
 * @returns {AdvisoryRow}
 */
function getAdvisoryRow(facts) {
  const { advisory, fixed, fixMethod } = facts;

  /** @type {Array<string>} */
  const notes = [];
  let needsReview = false;
  let failingCi = false;

  if (facts.introduced) {
    notes.push('Introduced by these changes');
  }
  if (!fixed && advisory.patchedVersions == null) {
    notes.push('No fix published');
  }
  if (!fixed && isCheckedByCi(advisory)) {
    if (facts.publishedAt == null) {
      notes.push("Couldn't get its publish date from GitHub");
    } else {
      const age = getBusinessDaysBetween(facts.publishedAt, new Date());
      failingCi = age >= CI_GRACE_BUSINESS_DAYS;
      notes.push(
        failingCi
          ? 'Failing CI on <code>main</code>'
          : `Fails CI on <code>main</code> in ${CI_GRACE_BUSINESS_DAYS - age} business days`
      );
    }
  }

  if (!fixed && facts.overrideRisk != null && advisory.patchedVersions != null) {
    notes.push(`Override skipped (${facts.overrideRisk})`);
  }
  if (fixMethod === 'override') {
    notes.push('Fixed with an override');
    needsReview = true;
  }
  if (isMajorUpgrade(advisory.versions, advisory.patchedVersions)) {
    notes.push('Major version bump');
    needsReview = true;
  }
  for (const file of facts.patchFiles) {
    notes.push(`Patched by <code>${file}</code>`);
    needsReview = true;
  }
  if (facts.addedExcludes.length > 0) {
    notes.push(
      `Added <code>${facts.addedExcludes.join(', ')}</code> to <code>minimumReleaseAgeExclude</code>`
    );
    needsReview = true;
  }

  /** @type {Status} */
  let status;
  if (failingCi) {
    status = '☢️';
  } else if (!fixed) {
    status = '❌';
  } else if (needsReview) {
    status = '⚠️';
  } else {
    status = '✅';
  }

  return { status, advisory, fixMethod, notes };
}

/**
 * @param {AdvisoryRow} a
 * @param {AdvisoryRow} b
 * @returns {number}
 */
function compareRows(a, b) {
  return (
    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
    compareAdvisories(a.advisory, b.advisory)
  );
}

/**
 * @param {Workspace} workspace
 * @returns {Promise<WorkspaceResult>}
 */
async function fixWorkspace(workspace) {
  const initialAdvisories = await runAudit(workspace);

  // `null` when unset
  const initialExcludes =
    /** @type {ReadonlyArray<string> | null} */ (
      await getProjectConfig(workspace, 'minimumReleaseAgeExclude')
    ) ?? [];
  const patchedDependencies =
    /** @type {Readonly<Record<string, string>> | null} */ (
      await getProjectConfig(workspace, 'patchedDependencies')
    ) ?? {};

  const initialOverrides = await getOverrides(workspace);

  /** @type {Map<number, FixMethod>} */
  const fixMethods = new Map();
  let remainingAdvisories = initialAdvisories;
  /** @type {PnpmCommandError | null} */
  let failure = null;
  /** @type {ReadonlyArray<DeprecatedPackage>} */
  let initialDeprecated = [];

  try {
    initialDeprecated = await getDeprecatedPackages(workspace);

    for (const step of FIX_STEPS) {
      const context = {
        remainingAdvisories,
        initialOverrides,
        patchedDependencies,
      };
      // oxlint-disable-next-line no-await-in-loop
      if (await step.skip(workspace, context)) {
        continue;
      }
      // oxlint-disable-next-line no-await-in-loop
      await step.run(workspace, context);
      // oxlint-disable-next-line no-await-in-loop
      const nextAdvisories = await runAudit(workspace);
      const nextIds = new Set(nextAdvisories.map(advisory => advisory.id));
      for (const advisory of remainingAdvisories) {
        if (!nextIds.has(advisory.id)) {
          fixMethods.set(advisory.id, step.method);
        }
      }
      remainingAdvisories = nextAdvisories;
    }
  } catch (error) {
    if (!(error instanceof PnpmCommandError)) {
      throw error;
    }
    // Don't commit a half-applied fix
    console.error(error.message);
    failure = error;
    await restoreWorkspace(workspace);
    fixMethods.clear();
    remainingAdvisories = initialAdvisories;
  }

  const deprecated =
    failure != null ? initialDeprecated : await getDeprecatedPackages(workspace);
  const upgradedDeprecated = initialDeprecated.filter(initial => {
    return !deprecated.some(pkg => {
      return pkg.name === initial.name && pkg.version === initial.version;
    });
  });

  const finalExcludes =
    /** @type {ReadonlyArray<string> | null} */ (
      await getProjectConfig(workspace, 'minimumReleaseAgeExclude')
    ) ?? [];
  const addedExcludes = finalExcludes.filter(entry => {
    return !initialExcludes.includes(entry);
  });

  // pnpm adds excludes for patched versions it doesn't end up installing
  const lockfile = await readFile(
    join(workspace.dir, 'pnpm-lock.yaml'),
    'utf8'
  );
  const unusedExcludes = dryRun
    ? []
    : addedExcludes.filter(entry => !lockfile.includes(entry));

  if (unusedExcludes.length > 0) {
    await setProjectConfig(
      workspace,
      'minimumReleaseAgeExclude',
      finalExcludes.filter(entry => !unusedExcludes.includes(entry))
    );
  }

  const initialIds = new Set(initialAdvisories.map(advisory => advisory.id));
  const remainingIds = new Set(
    remainingAdvisories.map(advisory => advisory.id)
  );
  const introducedAdvisories = remainingAdvisories.filter(advisory => {
    return !initialIds.has(advisory.id);
  });

  const { publishDates } = await fetchAdvisoryPublishDates(
    remainingAdvisories.map(advisory => advisory.ghsaId)
  );

  const rows = [...initialAdvisories, ...introducedAdvisories]
    .map(advisory => {
      const patchFiles = Object.entries(patchedDependencies)
        .filter(([spec]) => isEntryForModule(spec, advisory.moduleName))
        .map(([, file]) => relative(REPO_ROOT, resolve(workspace.dir, file)));
      const advisoryExcludes = addedExcludes.filter(entry => {
        return (
          isEntryForModule(entry, advisory.moduleName) &&
          !unusedExcludes.includes(entry)
        );
      });

      return getAdvisoryRow({
        advisory,
        fixed: !remainingIds.has(advisory.id),
        fixMethod: fixMethods.get(advisory.id) ?? null,
        overrideRisk: getRiskyOverrideReason(advisory, patchedDependencies),
        introduced: !initialIds.has(advisory.id),
        patchFiles,
        addedExcludes: advisoryExcludes,
        publishedAt: publishDates.get(advisory.ghsaId) ?? null,
      });
    })
    .sort(compareRows);

  return {
    workspace,
    rows,
    failure,
    removedReleaseAgeExcludes: unusedExcludes,
    deprecated,
    upgradedDeprecated,
    staleIgnores: await getStaleIgnores(workspace),
  };
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * @param {WorkspaceResult} result
 * @returns {string}
 */
function renderFailure(result) {
  const { failure } = result;
  if (failure == null) {
    return '';
  }

  let text = '';
  text += '> [!CAUTION]\n';
  text += `> ${failure.message}, so none of the advisories in \`${result.workspace.label}\` were fixed.${failure.isPatchFailure ? ' A patch needs to be recreated by hand.' : ''}\n`;
  text += '\n';
  text += '<details><summary>Output</summary>\n';
  text += '\n';
  text += '```\n';
  text += failure.output.trim().split('\n').slice(-30).join('\n') + '\n';
  text += '```\n';
  text += '\n';
  text += '</details>\n';
  text += '\n';
  return text;
}

/**
 * @param {ReadonlyArray<AdvisoryRow>} rows
 * @returns {string}
 */
function renderAdvisoryTable(rows) {
  if (rows.length === 0) {
    return '';
  }

  let text = '';
  text += '<table>\n';
  text +=
    '<tr><th></th><th>Package</th><th>Advisory</th><th>Version</th><th>Fix</th><th>Notes</th></tr>\n';

  for (const row of rows) {
    const { advisory } = row;

    const packageCell = [
      `<code>${advisory.moduleName}</code>`,
      `<sub>${advisory.dependencyType} in ${advisory.locations.join(', ')}</sub>`,
    ].join('<br>');

    const advisoryCell = [
      `<a href="${getAdvisoryUrl(advisory.ghsaId)}">${advisory.ghsaId}</a> <sub>${advisory.severity}</sub>`,
      escapeHtml(advisory.title),
    ].join('<br>');

    const fromVersion = advisory.versions.join(', ');
    const toVersion = escapeHtml(advisory.patchedVersions ?? 'none');
    const versionCell = `${fromVersion} → ${toVersion}`;

    const fixCell =
      row.fixMethod != null ? `<code>${row.fixMethod}</code>` : '—';

    text += '<tr>\n';
    text += `<td>${row.status}</td>\n`;
    text += `<td>${packageCell}</td>\n`;
    text += `<td>${advisoryCell}</td>\n`;
    text += `<td>${versionCell}</td>\n`;
    text += `<td>${fixCell}</td>\n`;
    text += `<td>${row.notes.join('<br>')}</td>\n`;
    text += '</tr>\n';
  }

  text += '</table>\n';
  text += '\n';
  return text;
}

/**
 * @param {ReadonlyArray<DeprecatedPackage>} upgraded
 * @param {ReadonlyArray<DeprecatedPackage>} remaining
 * @returns {string}
 */
function renderDeprecatedTable(upgraded, remaining) {
  if (upgraded.length === 0 && remaining.length === 0) {
    return '';
  }

  /** @type {ReadonlyArray<readonly [Status, DeprecatedPackage]>} */
  const rows = [
    ...remaining.map(pkg => /** @type {const} */ (['❌', pkg])),
    ...upgraded.map(pkg => /** @type {const} */ (['✅', pkg])),
  ];

  let text = '';
  text += '<table>\n';
  text +=
    '<tr><th></th><th>Deprecated package</th><th>Version</th><th>Message</th></tr>\n';
  for (const [status, pkg] of rows) {
    text += '<tr>\n';
    text += `<td>${status}</td>\n`;
    text += `<td><code>${pkg.name}</code></td>\n`;
    text += `<td>${pkg.version}</td>\n`;
    text += `<td>${escapeHtml(pkg.message ?? '')}</td>\n`;
    text += '</tr>\n';
  }
  text += '</table>\n';
  text += '\n';
  return text;
}

/**
 * @param {ReadonlyArray<StaleIgnore>} staleIgnores
 * @returns {string}
 */
function renderStaleIgnoreSection(staleIgnores) {
  if (staleIgnores.length === 0) {
    return '';
  }

  let text = '';
  text += '#### Ignored advisories to revisit\n';
  text += '\n';
  text += '<table>\n';
  text += '<tr><th>Ignored advisory</th><th>Package</th><th>Notes</th></tr>\n';
  for (const { ghsaId, advisory, notes } of staleIgnores) {
    const packageCell =
      advisory != null
        ? `<code>${advisory.moduleName}</code><br><sub>${advisory.versions.join(', ')} → ${escapeHtml(advisory.patchedVersions ?? 'none')}</sub>`
        : '—';
    text += '<tr>\n';
    text += `<td><a href="${getAdvisoryUrl(ghsaId)}">${ghsaId}</a></td>\n`;
    text += `<td>${packageCell}</td>\n`;
    text += `<td>${notes.join('<br>')}</td>\n`;
    text += '</tr>\n';
  }
  text += '</table>\n';
  text += '\n';
  return text;
}

/**
 * @param {WorkspaceResult} result
 * @returns {ReadonlyArray<AdvisoryRow>}
 */
function getUnfixedRows(result) {
  return result.rows.filter(row => {
    return row.status === '☢️' || row.status === '❌';
  });
}

/**
 * One command per advisory left on the issue, for people to copy.
 *
 * @param {ReadonlyArray<WorkspaceResult>} results
 * @returns {ReadonlyArray<Command>}
 */
function getSuggestedCommands(results) {
  /** @type {Array<Command>} */
  const suggestions = [];
  for (const result of results) {
    const { workspace } = result;
    for (const { advisory } of getUnfixedRows(result)) {
      if (advisory.patchedVersions == null) {
        suggestions.push({
          name: 'ignore',
          workspace,
          ghsaId: advisory.ghsaId,
          reason: 'no fixed version',
        });
      } else {
        suggestions.push({
          name: 'override',
          workspace,
          ghsaId: advisory.ghsaId,
          reason: null,
        });
      }
    }
    for (const { ghsaId } of result.staleIgnores) {
      suggestions.push({ name: 'unignore', workspace, ghsaId, reason: null });
    }
  }
  return suggestions;
}

/**
 * @param {ReadonlyArray<WorkspaceResult>} results
 * @returns {string}
 */
function renderPrBody(results) {
  const allRows = results.flatMap(result => result.rows);
  const counts = STATUS_ORDER.map(status => {
    const count = allRows.filter(row => row.status === status).length;
    return `${status} ${count}`;
  }).join(' · ');

  let text = '';

  text += 'Generated by `.github/scripts/audit-deps/fix.mjs`\n';
  text += '\n';
  text += `**${allRows.length} advisories:** ${counts}\n`;
  text += '\n';

  const failingCiCount = allRows.filter(row => row.status === '☢️').length;
  if (failingCiCount > 0) {
    text += '> [!CAUTION]\n';
    text += `> ${failingCiCount} advisories couldn't be fixed automatically and are failing CI on PRs into \`main\`.\n`;
    text += '\n';
  }

  for (const result of results) {
    const advisoryTable = renderAdvisoryTable(result.rows);
    const deprecatedTable = renderDeprecatedTable(
      result.upgradedDeprecated,
      result.deprecated
    );
    const staleIgnoreSection = renderStaleIgnoreSection(result.staleIgnores);
    if (
      result.failure == null &&
      advisoryTable === '' &&
      deprecatedTable === '' &&
      staleIgnoreSection === ''
    ) {
      continue;
    }

    text += `### \`${result.workspace.label}\`\n`;
    text += '\n';
    text += renderFailure(result);
    text += advisoryTable;

    if (deprecatedTable !== '') {
      text += '#### Deprecated packages\n';
      text += '\n';
      text += deprecatedTable;
    }

    text += staleIgnoreSection;

    if (result.removedReleaseAgeExcludes.length > 0) {
      const entries = result.removedReleaseAgeExcludes
        .map(entry => `\`${entry}\``)
        .join(', ');

      text += `Removed unused \`minimumReleaseAgeExclude\` entries added by pnpm: ${entries}\n`;
      text += '\n';
    }
  }

  text += renderCommandHelp(getSuggestedCommands(results));

  text += '<details><summary>Legend</summary>\n';
  text += '\n';
  text += '- ✅ Fixed\n';
  text +=
    '- ⚠️ Fixed, but double check it (override, major bump, patched dependency, or `minimumReleaseAgeExclude` added)\n';
  text += '- ❌ Not fixed\n';
  text += `- ☢️ Not fixed, and failing CI on PRs into \`main\` (${CI_GRACE_BUSINESS_DAYS} business days after it was published)\n`;
  text += '\n';
  text += '</details>\n';
  text += '\n';
  text += '## Internal\n';
  text += '\n';
  text += '!no-backport internal\n';
  text += '\n';

  return text;
}

/**
 * What the workflow couldn't fix. Empty when there's nothing left, which
 * closes the issue.
 *
 * @param {ReadonlyArray<WorkspaceResult>} results
 * @returns {string}
 */
function renderIssueBody(results) {
  let sections = '';
  for (const result of results) {
    const advisoryTable = renderAdvisoryTable(getUnfixedRows(result));
    const deprecatedTable = renderDeprecatedTable([], result.deprecated);
    const staleIgnoreSection = renderStaleIgnoreSection(result.staleIgnores);
    if (
      result.failure == null &&
      advisoryTable === '' &&
      deprecatedTable === '' &&
      staleIgnoreSection === ''
    ) {
      continue;
    }

    sections += `### \`${result.workspace.label}\`\n`;
    sections += '\n';
    sections += renderFailure(result);
    sections += advisoryTable;
    if (deprecatedTable !== '') {
      sections += '#### Deprecated packages\n';
      sections += '\n';
      sections += deprecatedTable;
      sections += 'Upgrade or replace them, or add them to `allowedDeprecatedVersions` in `pnpm-workspace.yaml`.\n';
      sections += '\n';
    }
    sections += staleIgnoreSection;
  }

  if (sections === '') {
    return '';
  }

  let text = '';
  text += "Dependencies that `.github/scripts/audit-deps/fix.mjs` couldn't fix automatically. This issue is updated by the workflow and closed when nothing is left.\n";
  text += '\n';
  text += sections;
  text += renderCommandHelp(getSuggestedCommands(results));
  return text;
}

if (!dryRun) {
  const { stdout } = await git(['status', '--porcelain', '--untracked-files=no']);
  assert(
    stdout.trim() === '',
    'Commit or stash your changes first, failed fixes are undone with `git checkout`'
  );
}

/** @type {Array<WorkspaceResult>} */
const results = [];
for (const workspace of WORKSPACES) {
  // Workspaces are fixed one at a time to keep pnpm's output readable
  // oxlint-disable-next-line no-await-in-loop
  results.push(await fixWorkspace(workspace));
}

// Runs `postinstall` (without `electron-builder install-app-deps`),
// which `ignore-scripts` skipped previously. Without changes nothing was
// installed, so `node_modules` is missing.
const rootResult = results.find(result => result.workspace.dir === REPO_ROOT);
if (
  !dryRun &&
  rootResult != null &&
  rootResult.failure == null &&
  (await hasWorkspaceChanges(rootResult.workspace))
) {
  await runCommand('node', ['scripts/generate-acknowledgments.mjs'], {
    cwd: REPO_ROOT,
    echoOutput: true,
  });
}

const prBody = renderPrBody(results);
const issueBody = renderIssueBody(results);
const failed = results.some(result => result.failure != null);

const { GITHUB_OUTPUT } = process.env;
if (GITHUB_OUTPUT != null) {
  await appendGitHubOutputs(GITHUB_OUTPUT, {
    failed: `${failed}`,
    'pr-body': prBody,
    'issue-body': issueBody,
  });
} else {
  console.log(prBody);
  console.log(issueBody === '' ? '(No issue needed)' : issueBody);
  if (failed) {
    process.exitCode = 1;
  }
}
