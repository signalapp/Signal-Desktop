// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: CallingNotification removed - stub only

import type { LocalizerType } from '../../types/Util.std.js';

export type PropsActionsType = Record<string, never>;

export type CallingNotificationPropsType = {
  i18n: LocalizerType;
} & PropsActionsType;

export function CallingNotification(): null {
  return null;
}
