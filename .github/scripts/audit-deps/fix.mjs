// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { randomUUID } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  CI_GRACE_BUSINESS_DAYS,
  REPO_ROOT,
  WORKSPACES,
  assert,
  compareAdvisories,
  fetchAdvisoryPublishDates,
  getAdvisoryUrl,
  getBusinessDaysBetween,
  getProjectConfig,
  isCheckedByCi,
  isMajorUpgrade,
  runAudit,
  runCommand,
  setProjectConfig,
} from './utils.mjs';

/** @import { Advisory, Workspace } from './utils.mjs' */

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
  },
});

const dryRun = args['dry-run'];

// Not needed to update lockfiles, patches are still applied
process.env.pnpm_config_ignore_scripts = 'true';

/** @typedef {'update' | 'override' | 'dedupe'} FixMethod */

/**
 * @type {ReadonlyArray<Readonly<{
 *   method: FixMethod;
 *   commands: ReadonlyArray<ReadonlyArray<string>>;
 * }>>}
 */
const FIX_STEPS = [
  { method: 'update', commands: [['audit', '--fix=update']] },
  // `--fix=override` only writes the overrides, it doesn't install them
  { method: 'override', commands: [['audit', '--fix=override'], ['install']] },
  // Installing can undo dedupes when there are cyclical peer deps
  { method: 'dedupe', commands: [['dedupe']] },
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

class PnpmCommandError extends Error {
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
}

/**
 * @typedef {Readonly<{
 *   workspace: Workspace;
 *   rows: ReadonlyArray<AdvisoryRow>;
 *   failure: PnpmCommandError | null;
 *   removedReleaseAgeExcludes: ReadonlyArray<string>;
 * }>} WorkspaceResult
 */

/**
 * @param {string} entry `name` or `name@version`
 * @param {string} moduleName
 * @returns {boolean}
 */
function isEntryForModule(entry, moduleName) {
  return entry === moduleName || entry.startsWith(`${moduleName}@`);
}

/**
 * @param {Workspace} workspace
 * @param {ReadonlyArray<string>} pnpmArgs
 * @returns {Promise<void>}
 */
async function runPnpm(workspace, pnpmArgs) {
  const command = `pnpm ${pnpmArgs.join(' ')}`;
  if (dryRun) {
    console.log(`[dry-run] ${workspace.label}: ${command}`);
    return;
  }

  console.log(`=== ${workspace.label}: ${command} ===`);
  const { code, stdout, stderr } = await runCommand('pnpm', pnpmArgs, {
    cwd: workspace.dir,
    echoOutput: true,
    allowFailure: true,
  });
  const output = `${stdout}\n${stderr}`;
  if (code === 0) {
    return;
  }
  // `audit --fix=update` also exits 1 when it couldn't fix everything,
  // which the next audit reports
  if (pnpmArgs.includes('--fix=update') && !output.includes('ERR_PNPM_')) {
    return;
  }
  throw new PnpmCommandError(command, workspace, output);
}

/**
 * Workspaces are fixed in order, so restoring the root can't undo changes to
 * `danger/` because it hasn't been fixed yet.
 *
 * @param {Workspace} workspace
 * @returns {Promise<void>}
 */
async function restoreWorkspace(workspace) {
  const path =
    workspace.dir === REPO_ROOT ? '.' : relative(REPO_ROOT, workspace.dir);
  await runCommand('git', ['checkout', 'HEAD', '--', path], {
    cwd: REPO_ROOT,
  });
}

/**
 * @param {Readonly<{
 *   advisory: Advisory;
 *   fixed: boolean;
 *   fixMethod: FixMethod | null;
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
 * @returns {Promise<WorkspaceResult | null>}
 */
async function fixWorkspace(workspace) {
  const initialAdvisories = await runAudit(workspace);
  if (initialAdvisories.length === 0) {
    console.log(`=== ${workspace.label}: no advisories ===`);
    return null;
  }

  // `null` when unset
  const initialExcludes =
    /** @type {ReadonlyArray<string> | null} */ (
      await getProjectConfig(workspace, 'minimumReleaseAgeExclude')
    ) ?? [];
  const patchedDependencies =
    /** @type {Readonly<Record<string, string>> | null} */ (
      await getProjectConfig(workspace, 'patchedDependencies')
    ) ?? {};

  /** @type {Map<number, FixMethod>} */
  const fixMethods = new Map();
  let remainingAdvisories = initialAdvisories;
  /** @type {PnpmCommandError | null} */
  let failure = null;

  try {
    for (const step of FIX_STEPS) {
      if (remainingAdvisories.length === 0 && step.method !== 'dedupe') {
        continue;
      }
      for (const pnpmArgs of step.commands) {
        // oxlint-disable-next-line no-await-in-loop
        await runPnpm(workspace, pnpmArgs);
      }
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
    text += `### \`${result.workspace.label}\`\n`;
    text += '\n';

    const { failure } = result;
    if (failure != null) {
      const isPatchError =
        failure.errorCode === 'ERR_PNPM_PATCH_FAILED' ||
        failure.errorCode === 'ERR_PNPM_UNUSED_PATCH';

      text += '> [!CAUTION]\n';
      text += `> ${failure.message}, so none of the advisories in \`${result.workspace.label}\` were fixed.${isPatchError ? ' A patch needs to be recreated by hand.' : ''}\n`;
      text += '\n';
      text += '<details><summary>Output</summary>\n';
      text += '\n';
      text += '```\n';
      text += failure.output.trim().split('\n').slice(-30).join('\n') + '\n';
      text += '```\n';
      text += '\n';
      text += '</details>\n';
      text += '\n';
    }

    text += '<table>\n';
    text +=
      '<tr><th></th><th>Package</th><th>Advisory</th><th>Version</th><th>Fix</th><th>Notes</th></tr>\n';

    for (const row of result.rows) {
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

    if (result.removedReleaseAgeExcludes.length > 0) {
      const entries = result.removedReleaseAgeExcludes
        .map(entry => `\`${entry}\``)
        .join(', ');

      text += `Removed unused \`minimumReleaseAgeExclude\` entries added by pnpm: ${entries}\n`;
      text += '\n';
    }
  }

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

if (!dryRun) {
  const { stdout } = await runCommand(
    'git',
    ['status', '--porcelain', '--untracked-files=no'],
    { cwd: REPO_ROOT }
  );
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
  const result = await fixWorkspace(workspace);
  if (result != null) {
    results.push(result);
  }
}

// Runs `postinstall` (without `electron-builder install-app-desp`),
// which `ignore-scripts` skipped previously
const rootResult = results.find(result => result.workspace.dir === REPO_ROOT);
if (!dryRun && rootResult != null && rootResult.failure == null) {
  await runCommand('node', ['scripts/generate-acknowledgments.mjs'], {
    cwd: REPO_ROOT,
    echoOutput: true,
  });
}

const prBody = renderPrBody(results);
const failed = results.some(result => result.failure != null);

const { GITHUB_OUTPUT } = process.env;
if (GITHUB_OUTPUT != null) {
  // A random delimiter can't appear in the body
  const delimiter = `EOF_${randomUUID()}`;
  let output = '';
  output += `failed=${failed}\n`;
  output += `pr-body<<${delimiter}\n${prBody}\n${delimiter}\n`;
  await appendFile(GITHUB_OUTPUT, output);
} else {
  console.log(prBody);
  if (failed) {
    process.exitCode = 1;
  }
}
