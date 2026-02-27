// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isFeaturedEnabledNoRedux } from './isFeatureEnabled.dom.js';

export function isAdminDeleteReceiveEnabled(): boolean {
  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.adminDelete.receive.beta',
    prodKey: 'desktop.adminDelete.receive.prod',
  });
}

export function isAdminDeleteSendEnabled(): boolean {
  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.adminDelete.send.beta',
    prodKey: 'desktop.adminDelete.send.prod',
  });
}
