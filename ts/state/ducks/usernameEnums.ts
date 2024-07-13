// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

//
// ProfileEditor
//

export enum UsernameEditState {
  Editing = 'Editing',
  ConfirmingDelete = 'ConfirmingDelete',
  Deleting = 'Deleting',
}

//
// UsernameLinkModalBody
//

export enum UsernameLinkState {
  Ready = 'Ready',
  Updating = 'Updating',
  Error = 'Error',
}

//
// EditUsernameModalBody
//

export enum UsernameReservationState {
  Open = 'Open',
  Reserving = 'Reserving',
  Confirming = 'Confirming',
  Closed = 'Closed',
}

export enum UsernameReservationError {
  NotEnoughCharacters = 'NotEnoughCharacters',
  TooManyCharacters = 'TooManyCharacters',
  CheckStartingCharacter = 'CheckStartingCharacter',
  CheckCharacters = 'CheckCharacters',
  UsernameNotAvailable = 'UsernameNotAvailable',
  General = 'General',
  ConflictOrGone = 'ConflictOrGone',
  NotEnoughDiscriminator = 'NotEnoughDiscriminator',
  AllZeroDiscriminator = 'AllZeroDiscriminator',
  LeadingZeroDiscriminator = 'LeadingZeroDiscriminator',
  TooManyAttempts = 'TooManyAttempts',
}
