// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';
import { isStagingServer } from './isStagingServer';

export function isBackupEnabled(): boolean {
  if (isStagingServer()) {
    return true;
  }
  return Boolean(RemoteConfig.isEnabled('desktop.backup.credentialFetch'));
}
