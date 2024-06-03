// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import path from 'path';
import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses';
import type { AfterPackContext } from 'electron-builder';

export async function afterPack({
  appOutDir,
  packager,
  electronPlatformName,
}: AfterPackContext): Promise<void> {
  const { productFilename } = packager.appInfo;

  let target;
  if (electronPlatformName === 'darwin') {
    target = `${productFilename}.app`;
  } else if (electronPlatformName === 'win32') {
    target = `${productFilename}.exe`;
  } else if (electronPlatformName === 'linux') {
    // Sadly, `LinuxPackager` type is not exported by electron-builder so we
    // have to improvise
    target = (packager as unknown as { executableName: string }).executableName;
  } else {
    throw new Error(`Unsupported platform: ${electronPlatformName}`);
  }

  const electron = path.join(appOutDir, target);

  const enableInspectArguments = Boolean(process.env.DISABLE_INSPECT_FUSE);

  console.log(
    `Fusing electron at ${electron} ` +
      `inspect-arguments=${enableInspectArguments}`
  );
  await flipFuses(electron, {
    version: FuseVersion.V1,
    // Disables ELECTRON_RUN_AS_NODE
    [FuseV1Options.RunAsNode]: false,
    // Enables cookie encryption
    [FuseV1Options.EnableCookieEncryption]: true,
    // Disables the NODE_OPTIONS environment variable
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    // Disables the --inspect and --inspect-brk family of CLI options
    [FuseV1Options.EnableNodeCliInspectArguments]: enableInspectArguments,
    // Enables validation of the app.asar archive on macOS/Windows
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]:
      electronPlatformName === 'darwin' || electronPlatformName === 'win32',
    // Enforces that Electron will only load your app from "app.asar" instead of
    // its normal search paths
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
}
