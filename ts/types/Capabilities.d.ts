// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// When updating this make sure to update `observedCapabilities` type in
// ts/types/Storage.d.ts
export type CapabilitiesType = {
  attachmentBackfill: boolean;
};
export type CapabilitiesUploadType = {
  attachmentBackfill: true;
  spqr: true;
};
