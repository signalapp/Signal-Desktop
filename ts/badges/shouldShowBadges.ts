// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEnabled } from '../RemoteConfig';
import { getEnvironment, Environment } from '../environment';
import { isBeta } from '../util/version';

export function shouldShowBadges(): boolean {
  if (
    isEnabled('desktop.showUserBadges2') ||
    isEnabled('desktop.internalUser') ||
    getEnvironment() === Environment.Staging ||
    getEnvironment() === Environment.Development ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Boolean((window as any).STORYBOOK_ENV)
  ) {
    return true;
  }

  if (isEnabled('desktop.showUserBadges.beta') && isBeta(window.getVersion())) {
    return true;
  }

  return false;
}
