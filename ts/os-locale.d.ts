// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// We need this until we upgrade os-locale. Newer versions include type definitions.

// We can't upgrade it yet because we patch it to disable its findup/exec behavior.

declare module 'os-locale' {
  export function sync(): string;
}
