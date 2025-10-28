// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import { constantTimeEqual } from '../Crypto.node.js';
import { signalProtocolStore } from '../SignalProtocolStore.preload.js';
import { whoami, getKeysForServiceId } from '../textsecure/WebAPI.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('checkOurPniIdentityKey');

export async function checkOurPniIdentityKey(): Promise<void> {
  const ourPni = itemStorage.user.getCheckedPni();
  const { pni: remotePni } = await whoami();
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

  const { identityKey: remoteKey } = await getKeysForServiceId(ourPni);
  if (!constantTimeEqual(localKeyPair.publicKey.serialize(), remoteKey)) {
    log.warn(`local/remote key mismatch for ${ourPni}, unlinking`);
    window.Whisper.events.emit('unlinkAndDisconnect');
  }
}
