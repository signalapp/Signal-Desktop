// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString, PniString } from '../../types/ServiceId';

export type CDSAuthType = Readonly<{
  username: string;
  password: string;
}>;

export type CDSResponseEntryType = Readonly<{
  aci: AciString | undefined;
  pni: PniString | undefined;
}>;

export type CDSResponseType = ReadonlyMap<string, CDSResponseEntryType>;

export type CDSRequestOptionsType = Readonly<{
  e164s: ReadonlyArray<string>;
  acis: ReadonlyArray<AciString>;
  accessKeys: ReadonlyArray<string>;
  returnAcisWithoutUaks?: boolean;
  timeout?: number;
}>;
