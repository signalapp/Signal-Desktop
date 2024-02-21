// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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
  NotEnoughDiscriminator = 'NotEnoughDiscriminator',
  AllZeroDiscriminator = 'AllZeroDiscriminator',
  LeadingZeroDiscriminator = 'LeadingZeroDiscriminator',
  TooManyAttempts = 'TooManyAttempts',
}

export enum ConfirmUsernameResult {
  Ok = 'Ok',
  OkRecovered = 'OkRecovered',
  ConflictOrGone = 'ConflictOrGone',
}

export function getNickname(username: string): string | undefined {
  const match = username.match(/^(.*?)(?:\.|$)/);
  if (!match) {
    return undefined;
  }

  return match[1];
}

export function getDiscriminator(username: string): string | undefined {
  const match = username.match(/\.([0-9]*)$/);
  if (!match) {
    return undefined;
  }

  return match[1];
}

export function isCaseChange({
  previousUsername,
  username,
}: UsernameReservationType): boolean {
  return previousUsername?.toLowerCase() === username.toLowerCase();
}
