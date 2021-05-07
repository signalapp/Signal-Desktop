// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-console */

const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

flipFuses(require('electron'), {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false, // Disables ELECTRON_RUN_AS_NODE
}).catch(error => {
  console.error(error.stack);
  process.exit(1);
});
