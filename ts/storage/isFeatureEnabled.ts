// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEnabled } from '../RemoteConfig';

function isStorageFeatureEnabled(): boolean {
  return isEnabled('desktop.storage');
}

export function isStorageWriteFeatureEnabled(): boolean {
  return isStorageFeatureEnabled() && isEnabled('desktop.storageWrite3');
}
