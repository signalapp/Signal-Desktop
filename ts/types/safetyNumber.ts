// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type SafetyNumberType = Readonly<{
  numberBlocks: ReadonlyArray<string>;
  qrData: Uint8Array;
}>;
