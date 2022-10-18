// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';
import { parseIntWithFallback } from './parseIntWithFallback';

export function getMaxNickname(): number {
  return parseIntWithFallback(
    RemoteConfig.getValue('global.nicknames.max'),
    32
  );
}
export function getMinNickname(): number {
  return parseIntWithFallback(RemoteConfig.getValue('global.nicknames.min'), 3);
}

export function isValidNickname(nickname: string): boolean {
  if (!/^[a-z_][0-9a-z_]*$/.test(nickname)) {
    return false;
  }

  if (nickname.length < getMinNickname()) {
    return false;
  }

  if (nickname.length > getMaxNickname()) {
    return false;
  }

  return true;
}

export function isValidUsername(username: string): boolean {
  const match = username.match(/^([a-z_][0-9a-z_]*)(\.\d+)?$/);
  if (!match) {
    return false;
  }

  const [, nickname] = match;
  return isValidNickname(nickname);
}

export function getUsernameFromSearch(searchTerm: string): string | undefined {
  // Search term contains username if it:
  // - Is a valid username with or without a discriminator
  // - Starts with @
  // - Ends with @
  const match = searchTerm.match(
    /^(?:(?<valid>[a-z_][0-9a-z_]*(?:\.\d*)?)|@(?<start>.*?)@?|@?(?<end>.*?)?@)$/
  );
  if (!match) {
    return undefined;
  }

  const { groups } = match;
  if (!groups) {
    return undefined;
  }

  return (groups.valid || groups.start || groups.end) ?? undefined;
}

export function getNickname(username: string): string | undefined {
  const match = username.match(/^(.*?)(?:\.|$)/);
  if (!match) {
    return undefined;
  }

  return match[1];
}

export function getDiscriminator(username: string): string {
  const match = username.match(/(\..*)$/);
  if (!match) {
    return '';
  }

  return match[1];
}
