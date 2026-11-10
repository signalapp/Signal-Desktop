// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { appendFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
  CI_AUDIT_LEVEL,
  CI_GRACE_BUSINESS_DAYS,
  WORKSPACES,
  fetchAdvisoryPublishDates,
  getAdvisoryUrl,
  getBusinessDaysBetween,
  runAudit,
} from './utils.mjs';

/** @import { Advisory } from './utils.mjs' */

const { values: args } = parseArgs({
  options: {
    'report-only': { type: 'boolean', default: false },
  },
});

const reportOnly = args['report-only'];

/**
 * @typedef {Readonly<{
 *   advisory: Advisory;
 *   businessDays: number | null;
 * }>} AgedAdvisory
 */

const advisories = (
  await Promise.all(
    WORKSPACES.map(workspace => {
      return runAudit(workspace, { auditLevel: CI_AUDIT_LEVEL });
    })
  )
).flat();

const { publishDates, errors } = await fetchAdvisoryPublishDates(
  advisories.map(advisory => advisory.ghsaId)
);

const now = new Date();

/** @type {ReadonlyArray<AgedAdvisory>} */
const agedAdvisories = advisories.map(advisory => {
  const publishedAt = publishDates.get(advisory.ghsaId) ?? null;
  const businessDays =
    publishedAt != null ? getBusinessDaysBetween(publishedAt, now) : null;
  return { advisory, businessDays };
});

const staleAdvisories = agedAdvisories.filter(item => {
  return (
    item.businessDays != null && item.businessDays >= CI_GRACE_BUSINESS_DAYS
  );
});

console.log(
  `Found ${advisories.length} advisories (level: ${CI_AUDIT_LEVEL}), ` +
    `${staleAdvisories.length} older than ${CI_GRACE_BUSINESS_DAYS} business days`
);

let summary = '';

if (staleAdvisories.length === 0) {
  summary += '### ✅ pnpm audit\n';
  summary += '\n';
  summary += `${advisories.length} advisories, none older than ${CI_GRACE_BUSINESS_DAYS} business days.\n`;
} else {
  let table = '';
  table += '| Workspace | Package | Advisory | Severity | Age | Title |\n';
  table += '| --- | --- | --- | --- | --- | --- |\n';
  for (const { advisory, businessDays } of staleAdvisories) {
    const age = businessDays != null ? `${businessDays}d` : 'unknown';
    const link = `[${advisory.ghsaId}](${getAdvisoryUrl(advisory.ghsaId)})`;
    const title = advisory.title.replaceAll('|', '\\|');
    table += `| ${advisory.workspace.label} | \`${advisory.moduleName}\` | ${link} | ${advisory.severity} | ${age} | ${title} |\n`;
  }

  console.error(table);

  summary += `### ${reportOnly ? '⚠️' : '❌'} pnpm audit\n`;
  summary += '\n';
  summary += `Advisories older than ${CI_GRACE_BUSINESS_DAYS} business days:\n`;
  summary += '\n';
  summary += table;

  if (!reportOnly) {
    process.exitCode = 1;
  }
}

if (errors.length > 0) {
  summary += '\n';
  summary += '> [!WARNING]\n';
  summary += `> Couldn't get publish dates from the GitHub API for ${errors.length} advisories, so they were treated as new:\n`;
  for (const error of errors) {
    summary += `> - ${error}\n`;
  }
}

const { GITHUB_STEP_SUMMARY } = process.env;
if (GITHUB_STEP_SUMMARY != null) {
  await appendFile(GITHUB_STEP_SUMMARY, summary);
}
