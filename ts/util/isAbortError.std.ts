// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && 'type' in error && error.type === 'aborted') ||
    (error instanceof DOMException && error.name === 'AbortError')
  );
}
