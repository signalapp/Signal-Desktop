// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig.dom.js';
import { parseIntWithFallback } from './parseIntWithFallback.std.js';

export function getMaxNickname(): number {
  return parseIntWithFallback(
    RemoteConfig.getValue('global.nicknames.max'),
    32
  );
}
export function getMinNickname(): number {
  return parseIntWithFallback(RemoteConfig.getValue('global.nicknames.min'), 3);
}

// Usernames have a minimum length of 3 and maximum of 32
const USERNAME_CHARS = /^@?[a-zA-Z_][a-zA-Z0-9_]{2,31}(.\d+)?$/;
const ALL_DIGITS = /^\d+$/;

export function getUsernameFromSearch(searchTerm: string): string | undefined {
  let modifiedTerm = searchTerm.trim();

  if (ALL_DIGITS.test(modifiedTerm)) {
    return undefined;
  }

  if (modifiedTerm.startsWith('@')) {
    modifiedTerm = modifiedTerm.slice(1);
  }
  if (modifiedTerm.endsWith('.')) {
    // Allow nicknames without full discriminator
    modifiedTerm = `${modifiedTerm}01`;
  } else if (/\.\d$/.test(modifiedTerm)) {
    // Add one more digit if they only have one
    modifiedTerm = `${modifiedTerm}1`;
  } else if (!/\.\d*$/.test(modifiedTerm)) {
    // Allow nicknames without discriminator
    modifiedTerm = `${modifiedTerm}.01`;
  }

  if (!USERNAME_CHARS.test(modifiedTerm)) {
    return undefined;
  }

  try {
    return modifiedTerm;
  } catch {
    return undefined;
  }
}

export function isProbablyAUsername(text: string): boolean {
  const searchTerm = text.trim();

  if (searchTerm.startsWith('@')) {
    return true;
  }

  if (!USERNAME_CHARS.test(searchTerm)) {
    return false;
  }
  if (ALL_DIGITS.test(searchTerm)) {
    return false;
  }

  if (/.+\.\d\d\d?$/.test(searchTerm)) {
    return true;
  }

  return false;
}
