// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { execSync } from 'node:child_process';
import { realpath } from 'node:fs/promises';

/**
 * @param {string} installerPath
 * @returns {Promise<void>}
 */
export async function signInstaller(installerPath) {
  if (process.env.SKIP_SIGNING_SCRIPT === '1') {
    console.log(
      'SKIP_SIGNING_SCRIPT=1, skipping custom mas installer signing script'
    );
    return;
  }

  const scriptPath = process.env.SIGN_MAS_INSTALLER_SCRIPT;
  if (!scriptPath) {
    throw new Error(
      'path to macos sign script must be provided in environment variable SIGN_MAS_INSTALLER_SCRIPT'
    );
  }

  const target = await realpath(installerPath);

  // The script will update the file in-place
  const returnCode = execSync(`bash "${scriptPath}" "${target}"`, {
    stdio: [null, process.stdout, process.stderr],
  });

  if (returnCode) {
    // oxlint-disable-next-line typescript/restrict-template-expressions
    throw new Error(`sign-macos: Script returned code ${returnCode}`);
  }
}
