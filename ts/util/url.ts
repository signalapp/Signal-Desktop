// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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

export function urlPathFromComponents(
  components: ReadonlyArray<string>
): string {
  return `/${components.filter(Boolean).map(encodeURIComponent).join('/')}`;
}
