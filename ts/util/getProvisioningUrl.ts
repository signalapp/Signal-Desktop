// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Bytes from '../Bytes';

export function getProvisioningUrl(
  uuid: string,
  publicKey: Uint8Array
): string {
  const url = new URL('sgnl://linkdevice');
  url.searchParams.set('uuid', uuid);
  url.searchParams.set('pub_key', Bytes.toBase64(publicKey));
  return url.toString();
}
