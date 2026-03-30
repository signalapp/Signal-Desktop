// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'node:child_process';

import fsExtra from 'fs-extra';

const { realpath } = fsExtra;

// oxlint-disable-next-line typescript/explicit-module-boundary-types, typescript/no-explicit-any
export async function sign(configuration: any): Promise<void> {
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
