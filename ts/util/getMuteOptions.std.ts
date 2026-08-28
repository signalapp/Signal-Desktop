// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DurationMs, MuteExpiration } from '@signalapp/types';
import type { LocalizerType } from '../types/Util.std.ts';
import { getMutedUntilText } from './getMutedUntilText.std.ts';
import { isConversationMuted } from './isConversationMuted.std.ts';
import { missingCaseError } from './missingCaseError.std.ts';

export type MuteOptionValue =
  | { type: 'unmute' }
  | { type: 'duration'; durationMs: DurationMs }
  | { type: 'always' }
  | { type: 'custom' };

export type MuteOption = {
  name: string;
  disabled?: boolean;
  value: MuteOptionValue;
};

export type MuteExpirationOption = MuteOption & {
  value: Exclude<MuteOptionValue, { type: 'custom' }>;
};

export function getMuteExpiration(
  value: MuteExpirationOption['value']
): MuteExpiration {
  switch (value.type) {
    case 'unmute':
      return MuteExpiration.UNMUTED;
    case 'always':
      return MuteExpiration.ALWAYS;
    case 'duration':
      return MuteExpiration.fromDuration(value.durationMs);
    default:
      throw missingCaseError(value);
  }
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
    value: { type: 'always' },
  };

  if (options.canOnlyBeMutedAlways) {
    return [muteAlwaysOption];
  }

  return [
    {
      name: i18n('icu:MuteMenu__hour'),
      value: { type: 'duration', durationMs: DurationMs.HOUR },
    },
    {
      name: i18n('icu:MuteMenu__eightHours'),
      value: { type: 'duration', durationMs: DurationMs.fromHours(8) },
    },
    {
      name: i18n('icu:MuteMenu__day'),
      value: { type: 'duration', durationMs: DurationMs.DAY },
    },
    {
      name: i18n('icu:MuteMenu__week'),
      value: { type: 'duration', durationMs: DurationMs.fromDays(7) },
    },
    {
      name: i18n('icu:MuteMenu__until'),
      value: { type: 'custom' },
    },
    muteAlwaysOption,
  ];
}

export type MuteMenu = Readonly<{
  label: string;
  options: ReadonlyArray<MuteOption>;
}>;

export function getConversationMuteMenu(
  muteExpiresAt: null | undefined | MuteExpiration,
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
          value: { type: 'unmute' },
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
