// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function unencodeNumber(number: string): [string, ...Array<string>] {
  return number.split('.');
}
