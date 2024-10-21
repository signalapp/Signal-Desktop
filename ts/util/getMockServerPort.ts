// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function getMockServerPort(
  serverUrl = window.SignalContext.config.serverUrl
): string {
  const url = new URL(serverUrl);
  return url.port;
}
