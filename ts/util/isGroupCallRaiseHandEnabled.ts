// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';
import { isProduction } from './version';

export function isGroupCallRaiseHandEnabled(): boolean {
  if (!isProduction(window.getVersion())) {
    return true;
  }

  // In production, use the config
  return Boolean(RemoteConfig.isEnabled('desktop.calling.raiseHand'));
}
