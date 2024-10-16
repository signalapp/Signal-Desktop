// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';
import { isBeta, isProduction } from './version';

export function isAdhocCallingEnabled(): boolean {
  const version = window.getVersion();

  if (isProduction(version)) {
    return Boolean(RemoteConfig.isEnabled('desktop.calling.adhoc'));
  }

  if (isBeta(version)) {
    return Boolean(RemoteConfig.isEnabled('desktop.calling.adhoc.beta'));
  }

  return true;
}
