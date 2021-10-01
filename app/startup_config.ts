// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { app } from 'electron';

import packageJson from '../package.json';
import * as GlobalErrors from './global_errors';

GlobalErrors.addHandler();

// Set umask early on in the process lifecycle to ensure file permissions are
// set such that only we have read access to our files
process.umask(0o077);

const appUserModelId = `org.whispersystems.${packageJson.name}`;
console.log('Set Windows Application User Model ID (AUMID)', {
  appUserModelId,
});
app.setAppUserModelId(appUserModelId);

// We don't navigate, but this is the way of the future
//   https://github.com/electron/electron/issues/18397
// TODO: Make ringrtc-node context-aware and change this to true.
app.allowRendererProcessReuse = false;
