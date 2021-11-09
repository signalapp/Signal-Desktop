// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEnabled } from '../RemoteConfig';
import { getEnvironment, Environment } from '../environment';

export function shouldShowBadges(): boolean {
  return (
    isEnabled('desktop.showUserBadges') ||
    isEnabled('desktop.internalUser') ||
    getEnvironment() === Environment.Staging ||
    getEnvironment() === Environment.Development ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Boolean((window as any).STORYBOOK_ENV)
  );
}
