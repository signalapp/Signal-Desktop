// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { mapValues } from 'lodash';

export function maybeParseUrl(value: string): undefined | URL {
  if (typeof value === 'string') {
    try {
      return new URL(value);
    } catch (err) {
      /* Errors are ignored. */
    }
  }

  return undefined;
}

export function setUrlSearchParams(
  url: Readonly<URL>,
  searchParams: Readonly<Record<string, unknown>>
): URL {
  const result = cloneUrl(url);
  result.search = new URLSearchParams(
    mapValues(searchParams, stringifySearchParamValue)
  ).toString();
  return result;
}

function cloneUrl(url: Readonly<URL>): URL {
  return new URL(url.href);
}

function stringifySearchParamValue(value: unknown): string {
  return value == null ? '' : String(value);
}
