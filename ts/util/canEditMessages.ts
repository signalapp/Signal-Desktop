// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEnabled } from '../RemoteConfig';

export function canEditMessages(): boolean {
  return (
    isEnabled('desktop.internalUser') || isEnabled('desktop.editMessageSend')
  );
}
