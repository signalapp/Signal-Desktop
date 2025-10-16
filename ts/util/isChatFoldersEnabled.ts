// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as RemoteConfig from '../RemoteConfig.dom.js';
import {
  Environment,
  getEnvironment,
  isMockEnvironment,
} from '../environment.std.js';
import { isAlpha, isBeta, isProduction } from './version.std.js';

export function isChatFoldersEnabled(version: string): boolean {
  const env = getEnvironment();

  if (
    env === Environment.Development ||
    env === Environment.Test ||
    isMockEnvironment()
  ) {
    return true;
  }

  if (isProduction(version)) {
    return RemoteConfig.isEnabled('desktop.chatFolders.prod');
  }
  if (isBeta(version)) {
    return RemoteConfig.isEnabled('desktop.chatFolders.beta');
  }
  if (isAlpha(version)) {
    return RemoteConfig.isEnabled('desktop.chatFolders.alpha');
  }

  return false;
}
