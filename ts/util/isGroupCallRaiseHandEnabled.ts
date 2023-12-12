// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';

export function isGroupCallRaiseHandEnabled(): boolean {
  return Boolean(RemoteConfig.isEnabled('desktop.internalUser'));
}
