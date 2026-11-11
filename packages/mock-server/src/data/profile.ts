// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ProfileKeyCommitment } from '@signalapp/libsignal-client/zkgroup';

export type VersionedProfile = Readonly<{
  version: string;
  commitment: ProfileKeyCommitment;
  name: Buffer<ArrayBuffer>;
  about: Buffer<ArrayBuffer> | undefined;
  aboutEmoji: Buffer<ArrayBuffer> | undefined;
  paymentAddress: Buffer<ArrayBuffer> | undefined;
  phoneNumberSharing: Buffer<ArrayBuffer> | undefined;
}>;
