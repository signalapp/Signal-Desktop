// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type UsernameReservationType = Readonly<{
  username: string;
  previousUsername: string | undefined;
  reservationToken: string;
}>;

export enum ReserveUsernameError {
  Unprocessable = 'Unprocessable',
  Conflict = 'Conflict',
}
