// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { LoggerType } from '../types/Logging';

function parseUrl(value: unknown, logger: LoggerType): null | URL {
  if (value instanceof URL) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return new URL(value);
    } catch (err) {
      return null;
    }
  }
  logger.warn('Tried to parse a sgnl:// URL but got an unexpected type');
  return null;
}

export function isSgnlHref(value: string | URL, logger: LoggerType): boolean {
  const url = parseUrl(value, logger);
  return url !== null && url.protocol === 'sgnl:';
}

type ParsedSgnlHref =
  | { command: null; args: Map<never, never> }
  | { command: string; args: Map<string, string> };
export function parseSgnlHref(
  href: string,
  logger: LoggerType
): ParsedSgnlHref {
  const url = parseUrl(href, logger);
  if (!url || !isSgnlHref(url, logger)) {
    return { command: null, args: new Map<never, never>() };
  }

  const args = new Map<string, string>();
  url.searchParams.forEach((value, key) => {
    if (!args.has(key)) {
      args.set(key, value);
    }
  });

  return { command: url.host, args };
}
