// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { WORKSPACES } from './utils.mjs';

/** @import { Workspace } from './utils.mjs' */

/** @typedef {'ignore' | 'unignore' | 'override'} CommandName */

/**
 * @typedef {Readonly<{
 *   name: CommandName;
 *   workspace: Workspace | null;
 *   ghsaId: string;
 *   reason: string | null;
 * }>} Command
 */

/**
 * @typedef {Readonly<{
 *   commands: ReadonlyArray<Command>;
 *   errors: ReadonlyArray<string>;
 * }>} ParsedCommands
 */

const COMMAND_LINE = /^!(ignore|unignore|override)(?:\s+(.*))?$/;
const GHSA_ID = /^GHSA(?:-[0-9a-z]{4}){3}$/i;

/**
 * Commands are lines starting with `!`, so quoted (`> !ignore`) and inline
 * ones are skipped.
 *
 * @param {string} text
 * @returns {ParsedCommands}
 */
export function parseCommands(text) {
  /** @type {Array<Command>} */
  const commands = [];
  /** @type {Array<string>} */
  const errors = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(COMMAND_LINE);
    if (match == null) {
      continue;
    }
    const name = /** @type {CommandName} */ (match[1]);
    const args = (match[2] ?? '').split(/\s+/).filter(arg => arg !== '');

    const workspace =
      WORKSPACES.find(candidate => candidate.label === args[0]) ?? null;
    if (workspace != null) {
      args.shift();
    }

    const ghsaId = args.shift() ?? null;
    if (ghsaId == null || !GHSA_ID.test(ghsaId)) {
      errors.push(`\`${line}\`: expected a GHSA id, like \`GHSA-xxxx-xxxx-xxxx\``);
      continue;
    }

    const reason = args.length > 0 ? args.join(' ') : null;
    if (reason != null && name !== 'ignore') {
      errors.push(`\`${line}\`: only \`!ignore\` takes a reason`);
      continue;
    }

    // Same as pnpm: `GHSA-` then lowercase
    const normalizedGhsaId = `GHSA${ghsaId.slice(4).toLowerCase()}`;
    commands.push({ name, workspace, ghsaId: normalizedGhsaId, reason });
  }

  return { commands, errors };
}

/**
 * @param {Command} command
 * @returns {string}
 */
export function formatCommand(command) {
  const parts = [`!${command.name}`];
  if (command.workspace != null) {
    parts.push(command.workspace.label);
  }
  parts.push(command.ghsaId);
  if (command.reason != null) {
    parts.push(command.reason);
  }
  return parts.join(' ');
}

/**
 * @param {ReadonlyArray<Command>} suggestions
 * @returns {string}
 */
export function renderCommandHelp(suggestions) {
  const labels = WORKSPACES.map(workspace => `\`${workspace.label}\``).join(', ');

  let text = '';
  text += '### Commands\n';
  text += '\n';
  text += 'Comment on this issue or the pull request with one command per line. ';
  text += 'They are added to the pull request (opened if needed), and the workflow replies with the result.\n';
  text += '\n';
  text +=
    '- `!ignore [workspace] <GHSA> [reason]`: add it to `auditConfig.ignoreGhsas`, with the reason in a comment\n';
  text +=
    '- `!override [workspace] <GHSA>`: override the vulnerable versions with the fix, even if it is a major version bump or a patched dependency\n';
  text +=
    '- `!unignore [workspace] <GHSA>`: remove it from `auditConfig.ignoreGhsas`, so it gets fixed automatically\n';
  text += '\n';
  text += `Without a workspace (${labels}) it applies to every workspace with the advisory.`;

  if (suggestions.length === 0) {
    text += '\n\n';
    return text;
  }

  text += ' To decide on everything above, copy these, remove the ones you want to leave, and edit the reasons:\n';
  text += '\n';
  text += '```text\n';
  for (const suggestion of suggestions) {
    text += `${formatCommand(suggestion)}\n`;
  }
  text += '```\n';
  text += '\n';
  return text;
}
