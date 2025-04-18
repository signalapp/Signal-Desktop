// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { constantTimeEqual } from '../Crypto';
import { strictAssert } from './assert';

export async function checkOurPniIdentityKey(): Promise<void> {
  const { server } = window.textsecure;
  strictAssert(server, 'WebAPI not ready');

  const ourPni = window.storage.user.getCheckedPni();
  const localKeyPair = await window.storage.protocol.getIdentityKeyPair(ourPni);
  if (!localKeyPair) {
    log.warn(
      `checkOurPniIdentityKey: no local key pair for ${ourPni}, unlinking`
    );
    window.Whisper.events.trigger('unlinkAndDisconnect');
    return;
  }

  const { identityKey: remoteKey } = await server.getKeysForServiceId(ourPni);

  if (!constantTimeEqual(localKeyPair.publicKey.serialize(), remoteKey)) {
    log.warn(
      `checkOurPniIdentityKey: local/remote key mismatch for ${ourPni}, unlinking`
    );
    window.Whisper.events.trigger('unlinkAndDisconnect');
  }
}
