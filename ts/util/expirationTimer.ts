// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as moment from 'moment';
import humanizeDuration from 'humanize-duration';
import type { Unit } from 'humanize-duration';
import { isNumber } from 'lodash';
import type { LocalizerType } from '../types/Util';
import { SECOND } from './durations';

const SECONDS_PER_WEEK = 604800;
export const DEFAULT_DURATIONS_IN_SECONDS: ReadonlyArray<number> = [
  0,
  moment.duration(4, 'weeks').asSeconds(),
  moment.duration(1, 'week').asSeconds(),
  moment.duration(1, 'day').asSeconds(),
  moment.duration(8, 'hours').asSeconds(),
  moment.duration(1, 'hour').asSeconds(),
  moment.duration(5, 'minutes').asSeconds(),
  moment.duration(30, 'seconds').asSeconds(),
];

export const DEFAULT_DURATIONS_SET: ReadonlySet<number> = new Set<number>(
  DEFAULT_DURATIONS_IN_SECONDS
);

export type FormatOptions = {
  capitalizeOff?: boolean;
  largest?: number; // how many units to show (the largest n)
};

export function format(
  i18n: LocalizerType,
  dirtySeconds?: number,
  { capitalizeOff = false, largest }: FormatOptions = {}
): string {
  let seconds = Math.abs(dirtySeconds || 0);
  if (!seconds) {
    return i18n(capitalizeOff ? 'off' : 'disappearingMessages__off');
  }
  seconds = Math.max(Math.floor(seconds), 1);

  // locale strings coming from electron use a dash as separator
  // but humanizeDuration uses an underscore
  const locale: string = i18n.getLocale().replace(/-/g, '_');

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

  // humanizeDuration only supports zh_CN and zh_TW
  if (locale === 'zh_HK') {
    fallbacks.push('zh_TW');
  }

  const allUnits: Array<Unit> = ['y', 'mo', 'w', 'd', 'h', 'm', 's'];

  const defaultUnits: Array<Unit> =
    seconds % SECONDS_PER_WEEK === 0 ? ['w'] : ['d', 'h', 'm', 's'];

  return humanizeDuration(seconds * 1000, {
    // if we have an explict `largest` specified,
    // allow it to pick from all the units
    units: largest ? allUnits : defaultUnits,
    largest,
    language: locale,
    ...(fallbacks.length ? { fallbacks } : {}),
  });
}

// normally we would not have undefineds all over,
// but most use-cases start out with undefineds
export function calculateExpirationTimestamp({
  expireTimer,
  expirationStartTimestamp,
}: {
  expireTimer: number | undefined;
  expirationStartTimestamp: number | undefined | null;
}): number | undefined {
  return isNumber(expirationStartTimestamp) && isNumber(expireTimer)
    ? expirationStartTimestamp + expireTimer * SECOND
    : undefined;
}
