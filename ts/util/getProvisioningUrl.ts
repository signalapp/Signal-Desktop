// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { arrayBufferToBase64 } from '../Crypto';

export function getProvisioningUrl(
  uuid: string,
  publicKey: ArrayBuffer
): string {
  const params = new URLSearchParams({
    uuid,
    pub_key: arrayBufferToBase64(publicKey),
  });
  return `tsdevice:/?${params.toString()}`;
}
