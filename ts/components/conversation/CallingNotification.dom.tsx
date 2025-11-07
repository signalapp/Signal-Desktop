// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: CallingNotification removed - stub only

import type { LocalizerType } from '../../types/Util.std.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PropsActionsType = Record<string, any>;

export type CallingNotificationPropsType = {
  i18n: LocalizerType;
} & PropsActionsType;

export function CallingNotification(_props: CallingNotificationPropsType): null {
  return null;
}
