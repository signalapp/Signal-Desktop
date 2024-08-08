// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';
import { Environment, getEnvironment } from '../environment';
import { isStaging } from './version';

export function isBackupEnabled(): boolean {
  if (getEnvironment() === Environment.Staging) {
    return true;
  }
  if (isStaging(window.getVersion())) {
    return true;
  }
  return Boolean(RemoteConfig.isEnabled('desktop.backup.credentialFetch'));
}
