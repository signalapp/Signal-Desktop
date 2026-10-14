// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CapabilitiesUploadType } from '../types/Capabilities.d.ts';

export function getCapabilities({
  optionalPhoneNumber,
}: {
  optionalPhoneNumber: boolean;
}): CapabilitiesUploadType {
  return {
    attachmentBackfill: true,
    spqr: true,
    usernameChangeSyncMessage: true,
    optionalPhoneNumber,
  };
}
