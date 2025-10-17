// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig.dom.js';
import { isTestOrMockEnvironment } from '../environment.std.js';
import { isStagingServer } from './isStagingServer.dom.js';
import { isNightly } from './version.std.js';

export function isLocalBackupsEnabled(
  reduxConfig?: RemoteConfig.ConfigMapType
): boolean {
  if (isStagingServer() || isTestOrMockEnvironment()) {
    return true;
  }

  if (RemoteConfig.isEnabled('desktop.internalUser', reduxConfig)) {
    return true;
  }

  const version = window.getVersion?.();
  if (version != null) {
    return isNightly(version);
  }

  return false;
}
