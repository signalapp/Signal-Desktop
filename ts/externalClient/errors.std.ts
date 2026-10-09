// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Thrown by FrameDecoder when the byte stream violates the framing rules. The
// connection cannot be resynchronized afterwards and must be closed.
export class FrameError extends Error {
  override name = 'FrameError';
}
