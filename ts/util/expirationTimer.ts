// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as moment from 'moment';
import humanizeDuration from 'humanize-duration';
import { LocalizerType } from '../types/Util';

const SECONDS_PER_WEEK = 604800;
export const DEFAULT_DURATIONS_IN_SECONDS = [
  0,
  5,
  10,
  30,
  moment.duration(1, 'minute').asSeconds(),
  moment.duration(5, 'minutes').asSeconds(),
  moment.duration(30, 'minutes').asSeconds(),
  moment.duration(1, 'hour').asSeconds(),
  moment.duration(6, 'hours').asSeconds(),
  moment.duration(12, 'hours').asSeconds(),
  moment.duration(1, 'day').asSeconds(),
  moment.duration(1, 'week').asSeconds(),
];

export function format(i18n: LocalizerType, dirtySeconds?: number): string {
  let seconds = Math.abs(dirtySeconds || 0);
  if (!seconds) {
    return i18n('disappearingMessages__off');
  }
  seconds = Math.max(Math.floor(seconds), 1);

  const locale: string = i18n.getLocale();
  const localeWithoutRegion: string = locale.split('_', 1)[0];
  const fallbacks: Array<string> = [];
  if (localeWithoutRegion !== locale) {
    fallbacks.push(localeWithoutRegion);
  }
  if (localeWithoutRegion === 'nb' || localeWithoutRegion === 'nn') {
    fallbacks.push('no');
  }
  if (localeWithoutRegion !== 'en') {
    fallbacks.push('en');
  }

  return humanizeDuration(seconds * 1000, {
    units: seconds % SECONDS_PER_WEEK === 0 ? ['w'] : ['d', 'h', 'm', 's'],
    language: locale,
    ...(fallbacks.length ? { fallbacks } : {}),
  });
}
