// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function getUserAgent(appVersion: string): string {
  return `Signal-Desktop/${appVersion}`;
}
