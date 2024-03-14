// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Net } from '@signalapp/libsignal-client';
import type { AciString, PniString } from '../../types/ServiceId';

export type CDSAuthType = Net.ServiceAuth;
export type CDSResponseEntryType = Net.CDSResponseEntryType<
  AciString,
  PniString
>;
export type CDSResponseType = Net.CDSResponseType<AciString, PniString>;

export type CDSRequestOptionsType = Readonly<{
  e164s: ReadonlyArray<string>;
  acisAndAccessKeys: ReadonlyArray<{ aci: AciString; accessKey: string }>;
  returnAcisWithoutUaks?: boolean;
  timeout?: number;
  useLibsignal?: boolean;
}>;
