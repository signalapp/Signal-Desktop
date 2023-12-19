// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { HourCyclePreference } from '../types/I18N';
import { assertDev } from './assert';

function getOptionsWithPreferences(
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormatOptions {
  const hourCyclePreference = window.SignalContext.getHourCyclePreference();
  if (options.hour12 != null) {
    return options;
  }
  if (hourCyclePreference === HourCyclePreference.Prefer12) {
    return { ...options, hour12: true };
  }
  if (hourCyclePreference === HourCyclePreference.Prefer24) {
    return { ...options, hour12: false };
  }
  return options;
}

/**
 * Chrome doesn't implement hour12 correctly
 */
function fixBuggyOptions(
  locales: Array<string>,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormatOptions {
  const resolvedOptions = new Intl.DateTimeFormat(
    locales,
    options
  ).resolvedOptions();
  const resolvedLocale = new Intl.Locale(resolvedOptions.locale);
  let { hourCycle } = resolvedOptions;
  // Most languages should use either h24 or h12
  if (hourCycle === 'h24') {
    hourCycle = 'h23';
  }
  if (hourCycle === 'h11') {
    hourCycle = 'h12';
  }
  // Only Japanese should use h11 when using hour12 time
  if (hourCycle === 'h12' && resolvedLocale.language === 'ja') {
    hourCycle = 'h11';
  }
  return {
    ...options,
    hour12: undefined,
    hourCycle,
  };
}

function getCacheKey(
  locales: Array<string>,
  options: Intl.DateTimeFormatOptions
) {
  return `${locales.join(',')}:${Object.keys(options)
    .sort()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map(key => `${key}=${(options as any)[key]}`)
    .join(',')}`;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function getDateTimeFormatter(
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const preferredSystemLocales =
    window.SignalContext.getPreferredSystemLocales();
  const localeOverride = window.SignalContext.getLocaleOverride();
  const locales =
    localeOverride != null ? [localeOverride] : preferredSystemLocales;
  const optionsWithPreferences = getOptionsWithPreferences(options);
  const cacheKey = getCacheKey(locales, optionsWithPreferences);
  const cachedFormatter = formatterCache.get(cacheKey);
  if (cachedFormatter) {
    return cachedFormatter;
  }
  const fixedOptions = fixBuggyOptions(locales, optionsWithPreferences);
  const formatter = new Intl.DateTimeFormat(locales, fixedOptions);
  formatterCache.set(cacheKey, formatter);
  return formatter;
}

export function formatTimestamp(
  timestamp: number,
  options: Intl.DateTimeFormatOptions
): string {
  const formatter = getDateTimeFormatter(options);
  try {
    return formatter.format(timestamp);
  } catch (err) {
    assertDev(false, 'invalid timestamp');
    return '';
  }
}
