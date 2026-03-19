// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isFeaturedEnabledNoRedux } from './isFeatureEnabled.dom.js';

export function isLocalBackupsEnabled(): boolean {
  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.localBackups.beta',
    prodKey: 'desktop.localBackups.prod',
  });
}
