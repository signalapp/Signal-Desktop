// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isTestOrMockEnvironment } from '../environment.std.js';
import { isStagingServer } from './isStagingServer.dom.js';
import { isFeaturedEnabledNoRedux } from './isFeatureEnabled.dom.js';

export function isProtoBinaryEncodingEnabled(): boolean {
  if (isTestOrMockEnvironment()) {
    return true;
  }

  if (isStagingServer()) {
    return true;
  }

  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.binaryServiceId.beta',
    prodKey: 'desktop.binaryServiceId.prod',
  });
}
