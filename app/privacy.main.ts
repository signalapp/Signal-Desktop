// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { redactAll, addSensitivePath } from '../ts/util/privacy.node.js';
import { getAppRootDir } from '../ts/util/appRootDir.main.js';

addSensitivePath(getAppRootDir());

export { redactAll, addSensitivePath };
