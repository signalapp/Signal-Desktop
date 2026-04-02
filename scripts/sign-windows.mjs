// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { execSync } from 'node:child_process';
import { realpath } from 'node:fs/promises';

/** @import { CustomWindowsSignTaskConfiguration } from 'electron-builder' */

/**
 * @param {CustomWindowsSignTaskConfiguration} configuration
 * @returns {Promise<void>}
 */
export async function sign(configuration) {
  // In CI, we remove certificate information from package.json to disable signing
  if (
    !configuration.options.signtoolOptions ||
    !configuration.options.signtoolOptions.certificateSha1
  ) {
    return;
  }

  const scriptPath = process.env.SIGN_WINDOWS_SCRIPT;
  if (!scriptPath) {
    throw new Error(
      'path to windows sign script must be provided in environment variable SIGN_WINDOWS_SCRIPT'
    );
  }

  const target = await realpath(configuration.path);

  // The script will update the file in-place
  const returnCode = execSync(`bash "${scriptPath}" "${target}"`, {
    stdio: [null, process.stdout, process.stderr],
  });

  if (returnCode) {
    // oxlint-disable-next-line typescript/restrict-template-expressions
    throw new Error(`sign-windows: Script returned code ${returnCode}`);
  }
}
