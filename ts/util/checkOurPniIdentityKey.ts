// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.js';
import { constantTimeEqual } from '../Crypto.js';
import { signalProtocolStore } from '../SignalProtocolStore.js';
import { strictAssert } from './assert.js';

const log = createLogger('checkOurPniIdentityKey');

export async function checkOurPniIdentityKey(): Promise<void> {
  const { server } = window.textsecure;
  strictAssert(server, 'WebAPI not ready');

  const ourPni = window.storage.user.getCheckedPni();
  const { pni: remotePni } = await server.whoami();
  if (remotePni !== ourPni) {
    log.warn(`remote pni mismatch, ${remotePni} != ${ourPni}`);
    window.Whisper.events.emit('unlinkAndDisconnect');
    return;
  }

  const localKeyPair = await signalProtocolStore.getIdentityKeyPair(ourPni);
  if (!localKeyPair) {
    log.warn(`no local key pair for ${ourPni}, unlinking`);
    window.Whisper.events.emit('unlinkAndDisconnect');
    return;
  }

  const { identityKey: remoteKey } = await server.getKeysForServiceId(ourPni);
  if (!constantTimeEqual(localKeyPair.publicKey.serialize(), remoteKey)) {
    log.warn(`local/remote key mismatch for ${ourPni}, unlinking`);
    window.Whisper.events.emit('unlinkAndDisconnect');
  }
}
