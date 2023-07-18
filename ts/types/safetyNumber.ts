// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum SafetyNumberMode {
  JustE164 = 'JustE164',
  DefaultE164AndThenACI = 'DefaultE164AndThenACI',
  DefaultACIAndMaybeE164 = 'DefaultACIAndMaybeE164',
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
