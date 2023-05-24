// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { usernames } from '@signalapp/libsignal-client';

export type UsernameReservationType = Readonly<{
  username: string;
  previousUsername: string | undefined;
  hash: Uint8Array;
}>;

export enum ReserveUsernameError {
  Unprocessable = 'Unprocessable',
  Conflict = 'Conflict',

  // Maps to UsernameReservationError in state/ducks/usernameEnums.ts
  NotEnoughCharacters = 'NotEnoughCharacters',
  TooManyCharacters = 'TooManyCharacters',
  CheckStartingCharacter = 'CheckStartingCharacter',
  CheckCharacters = 'CheckCharacters',
}

export enum ConfirmUsernameResult {
  Ok = 'Ok',
  ConflictOrGone = 'ConflictOrGone',
}

export function getUsernameFromSearch(searchTerm: string): string | undefined {
  try {
    usernames.hash(searchTerm);
    return searchTerm;
  } catch {
    return undefined;
  }
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
