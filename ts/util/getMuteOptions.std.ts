// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from './durations/index.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { getMutedUntilText } from './getMutedUntilText.std.ts';
import { isConversationMuted } from './isConversationMuted.std.ts';

export type MuteOption = {
  name: string;
  disabled?: boolean;
  value: number;
};

export function getMuteValuesOptions(
  i18n: LocalizerType,
  options: {
    canOnlyBeMutedAlways?: boolean;
    isCurrentlyMutedAlways?: boolean;
  } = {}
): ReadonlyArray<MuteOption> {
  const muteAlwaysOption: MuteOption = {
    name: i18n('icu:muteAlways'),
    value: Number.MAX_SAFE_INTEGER,
  };

  if (options.canOnlyBeMutedAlways && options.isCurrentlyMutedAlways) {
    return [];
  }

  if (options.canOnlyBeMutedAlways) {
    return [muteAlwaysOption];
  }

  return [
    {
      name: i18n('icu:muteHour'),
      value: durations.HOUR,
    },
    {
      name: i18n('icu:muteEightHours'),
      value: 8 * durations.HOUR,
    },
    {
      name: i18n('icu:muteDay'),
      value: durations.DAY,
    },
    {
      name: i18n('icu:muteWeek'),
      value: durations.WEEK,
    },
    ...(options.isCurrentlyMutedAlways ? [] : [muteAlwaysOption]),
  ];
}

export function getMuteOptions(
  muteExpiresAt: null | undefined | number,
  i18n: LocalizerType,
  options: {
    canOnlyBeMutedAlways?: boolean;
  } = {}
): Array<MuteOption> {
  return [
    ...(muteExpiresAt && isConversationMuted({ muteExpiresAt })
      ? [
          {
            name: getMutedUntilText(muteExpiresAt, i18n),
            disabled: true,
            value: -1,
          },
          {
            name: i18n('icu:unmute'),
            value: 0,
          },
        ]
      : []),
    ...getMuteValuesOptions(i18n, {
      canOnlyBeMutedAlways: options.canOnlyBeMutedAlways,
      isCurrentlyMutedAlways: (muteExpiresAt ?? 0) >= Number.MAX_SAFE_INTEGER,
    }),
  ];
}
