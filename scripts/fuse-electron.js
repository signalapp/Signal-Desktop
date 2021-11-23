// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-console */

const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

const IS_RELEASE_BUILD = process.argv.some(argv => argv === '--release');

flipFuses(require('electron'), {
  version: FuseVersion.V1,
  // Disables ELECTRON_RUN_AS_NODE
  [FuseV1Options.RunAsNode]: false,
  // Enables cookie encryption
  [FuseV1Options.EnableCookieEncryption]: true,
  // Disables the NODE_OPTIONS environment variable
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: !IS_RELEASE_BUILD,
  // Disables the --inspect and --inspect-brk family of CLI options
  [FuseV1Options.EnableNodeCliInspectArguments]: !IS_RELEASE_BUILD,
  // Enables validation of the app.asar archive on macOS
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  // Enforces that Electron will only load your app from "app.asar" instead of
  // it's normall search paths
  [FuseV1Options.OnlyLoadAppFromAsar]: IS_RELEASE_BUILD,
}).catch(error => {
  console.error(error.stack);
  process.exit(1);
});
