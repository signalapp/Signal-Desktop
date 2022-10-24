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
