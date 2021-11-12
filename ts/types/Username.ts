// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isValidUsername(searchTerm: string): boolean {
  return /^[a-z][0-9a-z_]{2,24}$/.test(searchTerm);
}

export function getUsernameFromSearch(searchTerm: string): string | undefined {
  if (/^[+0-9]+$/.test(searchTerm)) {
    return undefined;
  }

  const match = /^@?(.*?)@?$/.exec(searchTerm);

  if (match && match[1]) {
    return match[1];
  }

  return undefined;
}
