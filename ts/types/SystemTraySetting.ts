// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { makeEnumParser } from '../util/enum';

// Be careful when changing these values, as they are persisted.
export enum SystemTraySetting {
  DoNotUseSystemTray = 'DoNotUseSystemTray',
  MinimizeToSystemTray = 'MinimizeToSystemTray',
  MinimizeToAndStartInSystemTray = 'MinimizeToAndStartInSystemTray',
}

export const shouldMinimizeToSystemTray = (
  setting: SystemTraySetting
): boolean =>
  setting === SystemTraySetting.MinimizeToSystemTray ||
  setting === SystemTraySetting.MinimizeToAndStartInSystemTray;

export const parseSystemTraySetting = makeEnumParser(
  SystemTraySetting,
  SystemTraySetting.DoNotUseSystemTray
);
