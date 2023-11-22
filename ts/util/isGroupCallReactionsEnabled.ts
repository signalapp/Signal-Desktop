// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';

export function isGroupCallReactionsEnabled(): boolean {
  return Boolean(RemoteConfig.isEnabled('desktop.internalUser'));
}
