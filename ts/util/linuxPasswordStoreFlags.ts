// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Mapping of safeStorage backends to flags used to activate them.
// See https://www.electronjs.org/docs/latest/api/safe-storage
export const LINUX_PASSWORD_STORE_FLAGS: Record<string, string> = {
  basic_text: 'basic',
  gnome_libsecret: 'gnome-libsecret',
  kwallet: 'kwallet',
  kwallet5: 'kwallet5',
  kwallet6: 'kwallet6',
};
