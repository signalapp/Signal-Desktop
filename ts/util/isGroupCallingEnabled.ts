// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isBeta } from './version';
import * as RemoteConfig from '../RemoteConfig';

// We can remove this function once group calling has been turned on for everyone.
export function isGroupCallingEnabled(): boolean {
  return (
    RemoteConfig.isEnabled('desktop.groupCalling') ||
    isBeta(window.getVersion())
  );
}
