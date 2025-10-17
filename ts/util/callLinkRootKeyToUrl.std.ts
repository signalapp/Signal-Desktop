// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function callLinkRootKeyToUrl(rootKey: string): string | undefined {
  if (!rootKey) {
    return;
  }

  return `https://signal.link/call/#key=${rootKey}`;
}
