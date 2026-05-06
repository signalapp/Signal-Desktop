// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import os from 'node:os';

import { redactAll, addSensitivePath } from '../ts/util/privacy.node.ts';
import { getAppRootDir } from '../ts/util/appRootDir.main.ts';

const homedir = os.homedir();
if (homedir && homedir !== '/' && homedir !== '\\') {
  addSensitivePath(homedir);
}
addSensitivePath(getAppRootDir());

export { redactAll, addSensitivePath };
