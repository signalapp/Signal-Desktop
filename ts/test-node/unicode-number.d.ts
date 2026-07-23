// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'unicode-number' {
  export function unicodeNumber(character: string): number | undefined;
  export function unicodeNumberString(character: string): string | undefined;
  export function listUnicodeNumberCharacters(): Array<string>;
}
