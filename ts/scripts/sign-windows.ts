// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'child_process';

import { realpath } from 'fs-extra';

import type { CustomWindowsSignTaskConfiguration } from 'electron-builder';

export async function sign(
  configuration: CustomWindowsSignTaskConfiguration
): Promise<void> {
  // In CI, we remove certificate information from package.json to disable signing
  if (!configuration.options.certificateSha1) {
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
    throw new Error(`sign-windows: Script returned code ${returnCode}`);
  }
}
