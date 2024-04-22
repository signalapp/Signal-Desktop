// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';

export function isBackupEnabled(): boolean {
  return Boolean(RemoteConfig.isEnabled('desktop.backup.credentialFetch'));
}
