// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from './assert';

export function maybeParseUrl(value: string): undefined | URL {
  if (typeof value === 'string') {
    try {
      return new URL(value);
    } catch {
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
  result.search = '';
  for (const [key, value] of Object.entries(searchParams)) {
    if (value == null) {
      continue;
    }
    result.searchParams.append(key, String(value));
  }
  return result;
}

function cloneUrl(url: Readonly<URL>): URL {
  return new URL(url.href);
}

class UrlPath {
  #urlPath: string;

  constructor(escapedUrlPath: string) {
    this.#urlPath = escapedUrlPath;
  }

  toString(): string {
    return this.#urlPath;
  }
}

export type { UrlPath };

export type UrlPathInput = boolean | number | string | UrlPath;

export function isUrlPath(value: unknown): value is UrlPath {
  return value instanceof UrlPath;
}

function escapeValueForUrlPath(value: UrlPathInput): string {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    return encodeURIComponent(value);
  }
  if (isUrlPath(value)) {
    return value.toString();
  }
  throw new TypeError('Unexpected url path component');
}

export function urlPath(
  strings: TemplateStringsArray,
  ...components: ReadonlyArray<UrlPathInput>
): UrlPath {
  let result = '';
  for (let index = 0; index < strings.length; index += 1) {
    result += strings[index];
    if (index < components.length) {
      result += escapeValueForUrlPath(components[index]);
    }
  }
  return new UrlPath(result);
}

export function urlPathJoin(
  values: ReadonlyArray<UrlPathInput>,
  separator: string
): UrlPath {
  strictAssert(isUrlPath(separator), 'Separator must be an EscapedUrlPath');
  let result = '';
  for (let index = 0; index < values.length; index += 1) {
    result += escapeValueForUrlPath(values[index]);
    if (index < values.length - 1) {
      result += separator;
    }
  }
  return new UrlPath(result);
}
