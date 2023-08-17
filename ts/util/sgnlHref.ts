// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../types/Logging';
import { maybeParseUrl } from './url';
import { isValidE164 } from './isValidE164';
import { fromWebSafeBase64, toWebSafeBase64 } from './webSafeBase64';

const SIGNAL_HOSTS = new Set(['signal.group', 'signal.art', 'signal.me']);
const SIGNAL_DOT_ME_E164_PREFIX = 'p/';

function parseUrl(value: string | URL, logger: LoggerType): undefined | URL {
  if (value instanceof URL) {
    return value;
  }

  if (typeof value === 'string') {
    return maybeParseUrl(value);
  }

  logger.warn('Tried to parse a sgnl:// URL but got an unexpected type');
  return undefined;
}

export function isSgnlHref(value: string | URL, logger: LoggerType): boolean {
  const url = parseUrl(value, logger);
  return Boolean(url?.protocol === 'sgnl:');
}

export function isCaptchaHref(
  value: string | URL,
  logger: LoggerType
): boolean {
  const url = parseUrl(value, logger);
  return Boolean(url?.protocol === 'signalcaptcha:');
}

// A link to a signal 'action' domain with private data in path/hash/query. We could
//   open a browser, but it will just link back to us. We will parse it locally instead.
export function isSignalHttpsLink(
  value: string | URL,
  logger: LoggerType
): boolean {
  const url = parseUrl(value, logger);
  return Boolean(
    url &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.protocol === 'https:' &&
      SIGNAL_HOSTS.has(url.host) &&
      (url.hash || url.pathname !== '/' || url.search)
  );
}

type ParsedSgnlHref =
  | { command: null; args: Map<never, never>; hash: undefined }
  | { command: string; args: Map<string, string>; hash: string | undefined };
export function parseSgnlHref(
  href: string,
  logger: LoggerType
): ParsedSgnlHref {
  const url = parseUrl(href, logger);
  if (!url || !isSgnlHref(url, logger)) {
    return { command: null, args: new Map<never, never>(), hash: undefined };
  }

  const args = new Map<string, string>();
  url.searchParams.forEach((value, key) => {
    if (!args.has(key)) {
      args.set(key, value);
    }
  });

  return {
    command: url.host,
    args,
    hash: url.hash ? url.hash.slice(1) : undefined,
  };
}

type ParsedCaptchaHref = {
  readonly captcha: string;
};
export function parseCaptchaHref(
  href: URL | string,
  logger: LoggerType
): ParsedCaptchaHref {
  const url = parseUrl(href, logger);
  if (!url || !isCaptchaHref(url, logger)) {
    throw new Error('Not a captcha href');
  }

  return {
    captcha: url.host,
  };
}

export function parseSignalHttpsLink(
  href: string,
  logger: LoggerType
): ParsedSgnlHref {
  const url = parseUrl(href, logger);
  if (!url || !isSignalHttpsLink(url, logger)) {
    return { command: null, args: new Map<never, never>(), hash: undefined };
  }

  if (url.host === 'signal.art') {
    const hash = url.hash.slice(1);
    const hashParams = new URLSearchParams(hash);

    const args = new Map<string, string>();
    hashParams.forEach((value, key) => {
      if (!args.has(key)) {
        args.set(key, value);
      }
    });

    if (!args.get('pack_id') || !args.get('pack_key')) {
      return { command: null, args: new Map<never, never>(), hash: undefined };
    }

    return {
      command: url.pathname.replace(/\//g, ''),
      args,
      hash: url.hash ? url.hash.slice(1) : undefined,
    };
  }

  if (url.host === 'signal.group' || url.host === 'signal.me') {
    return {
      command: url.host,
      args: new Map<string, string>(),
      hash: url.hash ? url.hash.slice(1) : undefined,
    };
  }

  return { command: null, args: new Map<never, never>(), hash: undefined };
}

export function parseE164FromSignalDotMeHash(hash: string): undefined | string {
  if (!hash.startsWith(SIGNAL_DOT_ME_E164_PREFIX)) {
    return;
  }

  const maybeE164 = hash.slice(SIGNAL_DOT_ME_E164_PREFIX.length);
  return isValidE164(maybeE164, true) ? maybeE164 : undefined;
}

export function parseUsernameBase64FromSignalDotMeHash(
  hash: string
): undefined | string {
  const match = hash.match(/^eu\/([a-zA-Z0-9_-]{64})$/);
  if (!match) {
    return;
  }

  return fromWebSafeBase64(match[1]);
}

/**
 * Converts `http://signal.group/#abc` to `https://signal.group/#abc`. Does the same for
 * other Signal hosts, like signal.me. Does nothing to other URLs. Expects a valid href.
 */
export function rewriteSignalHrefsIfNecessary(href: string): string {
  const resultUrl = new URL(href);

  const isHttp = resultUrl.protocol === 'http:';
  const isHttpOrHttps = isHttp || resultUrl.protocol === 'https:';

  if (SIGNAL_HOSTS.has(resultUrl.host) && isHttpOrHttps) {
    if (isHttp) {
      resultUrl.protocol = 'https:';
    }
    resultUrl.username = '';
    resultUrl.password = '';
    return resultUrl.href;
  }

  return href;
}

export type GenerateUsernameLinkOptionsType = Readonly<{
  short?: boolean;
}>;

export function generateUsernameLink(
  base64: string,
  { short = false }: GenerateUsernameLinkOptionsType = {}
): string {
  const shortVersion = `signal.me/#eu/${toWebSafeBase64(base64)}`;
  if (short) {
    return shortVersion;
  }
  return `https://${shortVersion}`;
}
