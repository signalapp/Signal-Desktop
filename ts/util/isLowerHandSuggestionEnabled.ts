// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';
import { isProduction } from './version';

export function isLowerHandSuggestionEnabled(): boolean {
  if (
    isProduction(window.getVersion()) ||
    !RemoteConfig.isEnabled('desktop.internalUser')
  ) {
    return false;
  }

  return true;
}
