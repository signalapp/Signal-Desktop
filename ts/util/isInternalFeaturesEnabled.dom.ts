// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import {
  Environment,
  getEnvironment,
  isMockEnvironment,
} from '../environment.std.js';
import * as RemoteConfig from '../RemoteConfig.dom.js';

/**
 * This should be reserved for internal-only features that are focused on
 * debugging and development, and will never be enabled in production.
 */
export function isInternalFeaturesEnabled(): boolean {
  const env = getEnvironment();

  if (
    env === Environment.Development ||
    env === Environment.Test ||
    isMockEnvironment()
  ) {
    return true;
  }

  return RemoteConfig.isEnabled('desktop.internalUser');
}
