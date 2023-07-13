// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum SafetyNumberMode {
  E164 = 'E164',
  ACIAndE164 = 'ACIAndE164',
  ACI = 'ACI',
}

export enum SafetyNumberIdentifierType {
  ACIIdentifier = 'ACIIdentifier',
  E164Identifier = 'E164Identifier',
}

export type SafetyNumberType = Readonly<{
  identifierType: SafetyNumberIdentifierType;
  numberBlocks: ReadonlyArray<string>;
  qrData: Uint8Array;
}>;
