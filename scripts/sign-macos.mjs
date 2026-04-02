// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { execSync } from 'node:child_process';
import { realpath } from 'node:fs/promises';

/** @import { MacConfiguration } from 'electron-builder' */

/**
 * Types not exported by electron-builder
 * @typedef {Extract<MacConfiguration['sign'], Function>} CustomMacSign
 * @typedef {Parameters<CustomMacSign>[0]} CustomMacSignOptions
 */

/**
 * @param {CustomMacSignOptions} configuration
 * @returns {Promise<void>}
 */
export async function sign(configuration) {
  if (process.env.SKIP_SIGNING_SCRIPT === '1') {
    console.log('SKIP_SIGNING_SCRIPT=1, skipping custom macOS signing script');
    return;
  }

  const scriptPath = process.env.SIGN_MACOS_SCRIPT;
  if (!scriptPath) {
    throw new Error(
      'path to macos sign script must be provided in environment variable SIGN_MACOS_SCRIPT'
    );
  }

  const target = await realpath(configuration.app);

  // The script will update the file in-place
  const returnCode = execSync(`bash "${scriptPath}" "${target}"`, {
    stdio: [null, process.stdout, process.stderr],
  });

  if (returnCode) {
    throw new Error(`sign-macos: Script returned code ${returnCode}`);
  }
}
