// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';
import { isBeta } from './version';

export function isGroupCallOutboundRingEnabled(): boolean {
  return Boolean(
    RemoteConfig.isEnabled('desktop.internalUser') ||
      RemoteConfig.isEnabled('desktop.groupCallOutboundRing2') ||
      (isBeta(window.getVersion()) &&
        RemoteConfig.isEnabled('desktop.groupCallOutboundRing2.beta'))
  );
}
