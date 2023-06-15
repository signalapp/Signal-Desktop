// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEnabled } from '../RemoteConfig';
import { isBeta } from './version';

export function canEditMessages(): boolean {
  return (
    isBeta(window.getVersion()) ||
    isEnabled('desktop.internalUser') ||
    isEnabled('desktop.editMessageSend')
  );
}
