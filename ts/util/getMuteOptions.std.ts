// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from './durations/index.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { getMutedUntilText } from './getMutedUntilText.std.ts';
import { isConversationMuted } from './isConversationMuted.std.ts';

export type MuteOption = {
  name: string;
  disabled?: boolean;
  value: number | 'custom';
};

export type MuteDurationOption = MuteOption & { value: number };

export function isMuteDurationOption(
  option: MuteOption
): option is MuteDurationOption {
  return typeof option.value === 'number';
}

export function getMuteValuesOptions(
  i18n: LocalizerType,
  options: {
    canOnlyBeMutedAlways?: boolean;
    isCurrentlyMutedAlways?: boolean;
  } = {}
): ReadonlyArray<MuteOption> {
  const muteAlwaysOption: MuteOption = {
    name: i18n('icu:MuteMenu__always'),
    disabled: options.isCurrentlyMutedAlways === true,
    value: Number.MAX_SAFE_INTEGER,
  };

  if (options.canOnlyBeMutedAlways) {
    return [muteAlwaysOption];
  }

  return [
    {
      name: i18n('icu:MuteMenu__hour'),
      value: durations.HOUR,
    },
    {
      name: i18n('icu:MuteMenu__eightHours'),
      value: 8 * durations.HOUR,
    },
    {
      name: i18n('icu:MuteMenu__day'),
      value: durations.DAY,
    },
    {
      name: i18n('icu:MuteMenu__week'),
      value: durations.WEEK,
    },
    {
      name: i18n('icu:MuteMenu__until'),
      value: 'custom' as const,
    },
    muteAlwaysOption,
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

export type MuteMenu = Readonly<{
  label: string;
  options: ReadonlyArray<MuteOption>;
}>;

export function getConversationMuteMenu(
  muteExpiresAt: null | undefined | number,
  i18n: LocalizerType,
  options: {
    canOnlyBeMutedAlways?: boolean;
  } = {}
): MuteMenu {
  if (muteExpiresAt != null && isConversationMuted({ muteExpiresAt })) {
    return {
      label: getMutedUntilText(muteExpiresAt, i18n),
      options: [
        {
          name: i18n('icu:unmute'),
          value: 0,
        },
      ],
    };
  }

  return {
    label: i18n('icu:MuteMenu__label'),
    options: getMuteValuesOptions(i18n, {
      canOnlyBeMutedAlways: options.canOnlyBeMutedAlways,
    }),
  };
}
