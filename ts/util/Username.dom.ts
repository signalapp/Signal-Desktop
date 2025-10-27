// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig.dom.js';
import { getDiscriminator, getNickname } from '../types/Username.std.js';
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
const USERNAME_LIKE = /^@?[a-zA-Z_][a-zA-Z0-9_]{2,31}(.\d*?)?$/;
const NICKNAME_CHARS = /^[a-zA-Z_][a-zA-Z0-9_]+$/;
const ALL_DIGITS = /^\d+$/;

export function isUsernameValid(username: string): boolean {
  const nickname = getNickname(username);
  const discriminator = getDiscriminator(username);

  if (!nickname) {
    return false;
  }

  if (
    nickname.length < getMinNickname() ||
    nickname.length > getMaxNickname()
  ) {
    return false;
  }

  if (!NICKNAME_CHARS.test(nickname)) {
    return false;
  }

  if (!discriminator || discriminator.length === 0) {
    return false;
  }
  if (discriminator[0] === '0' && discriminator[1] === '0') {
    return false;
  }
  if (discriminator[0] === '0' && discriminator.length !== 2) {
    return false;
  }

  return true;
}

export function getUsernameFromSearch(searchTerm: string): string | undefined {
  let modifiedTerm = searchTerm.trim();

  if (ALL_DIGITS.test(modifiedTerm)) {
    return undefined;
  }

  if (modifiedTerm.startsWith('@')) {
    modifiedTerm = modifiedTerm.slice(1);
  }

  if (!USERNAME_LIKE.test(modifiedTerm)) {
    return undefined;
  }

  return modifiedTerm;
}

export function isProbablyAUsername(text: string): boolean {
  const searchTerm = text.trim();

  if (searchTerm.startsWith('@')) {
    return true;
  }

  if (!USERNAME_LIKE.test(searchTerm)) {
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
