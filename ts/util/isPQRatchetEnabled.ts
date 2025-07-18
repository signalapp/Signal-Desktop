// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { UsePQRatchet } from '@signalapp/libsignal-client';
import * as RemoteConfig from '../RemoteConfig';

export const isPQRatchetEnabled = (): UsePQRatchet => {
  return RemoteConfig.isEnabled('desktop.usePqRatchet')
    ? UsePQRatchet.Yes
    : UsePQRatchet.No;
};
