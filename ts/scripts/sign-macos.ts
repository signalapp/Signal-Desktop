// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'child_process';

import { realpath } from 'fs-extra';

// eslint-disable-next-line max-len
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export async function sign(configuration: any): Promise<void> {
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
