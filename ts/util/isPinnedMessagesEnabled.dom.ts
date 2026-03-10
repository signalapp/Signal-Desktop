// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isFeaturedEnabledNoRedux } from './isFeatureEnabled.dom.js';

export function isPinnedMessagesReceiveEnabled(): boolean {
  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.pinnedMessages.receive.beta',
    prodKey: 'desktop.pinnedMessages.receive.prod',
  });
}

export function isPinnedMessagesSendEnabled(): boolean {
  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.pinnedMessages.send.beta',
    prodKey: 'desktop.pinnedMessages.send.prod',
  });
}
