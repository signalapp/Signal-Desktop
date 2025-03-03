// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { usernames } from '@signalapp/libsignal-client';

import * as RemoteConfig from '../RemoteConfig';
import { getNickname } from '../types/Username';
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

export function getUsernameFromSearch(searchTerm: string): string | undefined {
  const nickname = getNickname(searchTerm);
  if (nickname == null || nickname.length < getMinNickname()) {
    return undefined;
  }

  let modifiedTerm = searchTerm;

  if (modifiedTerm.startsWith('@')) {
    modifiedTerm = modifiedTerm.slice(1);
  }
  if (modifiedTerm.endsWith('.')) {
    // Allow nicknames without full discriminator
    modifiedTerm = `${modifiedTerm}01`;
  } else if (!/\.\d*$/.test(modifiedTerm)) {
    // Allow nicknames without discriminator
    modifiedTerm = `${modifiedTerm}.01`;
  }

  try {
    usernames.hash(modifiedTerm);
    return modifiedTerm;
  } catch {
    return undefined;
  }
}
