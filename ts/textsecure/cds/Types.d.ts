// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UUIDStringType } from '../../types/UUID';

export type CDSAuthType = Readonly<{
  username: string;
  password: string;
}>;

export type CDSResponseEntryType = Readonly<{
  aci: UUIDStringType | undefined;
  pni: UUIDStringType | undefined;
}>;

export type CDSResponseType = ReadonlyMap<string, CDSResponseEntryType>;

export type CDSRequestOptionsType = Readonly<{
  e164s: ReadonlyArray<string>;
  acis: ReadonlyArray<UUIDStringType>;
  accessKeys: ReadonlyArray<string>;
  returnAcisWithoutUaks?: boolean;
  timeout?: number;
}>;
