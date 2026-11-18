// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isFeaturedEnabledNoRedux } from './isFeatureEnabled.dom.ts';

export function isPrivateReplySendEnabled(): boolean {
  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.privateReply.send.beta',
    prodKey: 'desktop.privateReply.send.prod',
  });
}
