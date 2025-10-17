// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isMockServer(
  serverUrl = window.SignalContext.config.serverUrl
): boolean {
  try {
    const url = new URL(serverUrl);

    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]' // IPv6 loopback address
    );
  } catch (e) {
    return false;
  }
}
