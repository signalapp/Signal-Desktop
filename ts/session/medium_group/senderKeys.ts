import { PubKey } from '../types';
import { StringUtils } from '../utils';
import * as Data from '../../../js/modules/data';
import { MediumGroupResponseKeysMessage } from '../messages/outgoing';
import { getMessageQueue } from '..';

const toHex = (buffer: ArrayBuffer) => StringUtils.decode(buffer, 'hex');
const fromHex = (hex: string) => StringUtils.encode(hex, 'hex');

export interface RatchetState {
  chainKey: Uint8Array;
  keyIdx: number;
  pubKey: Uint8Array;
}

// TODO: make this private when no longer needed by JS
export async function saveSenderKeysInner(
  groupId: string,
  senderIdentity: PubKey,
  chainKeyHex: string,
  keyIdx: number,
  messageKeys: any
) {
  const { log } = window;

  const ratchet = {
    chainKeyHex,
    messageKeys,
    idx: keyIdx,
  };

  log.debug(
    'saving ratchet keys for group ',
    groupId,
    'sender',
    senderIdentity.key
  );

  await Data.createOrUpdateSenderKeys({
    groupId,
    senderIdentity: senderIdentity.key,
    ratchet,
  });

  log.debug(
    `Saving sender keys for groupId ${groupId}, sender ${senderIdentity.key}`
  );
}

export async function createSenderKeyForGroup(
  groupId: string,
  senderIdentity: PubKey
): Promise<RatchetState> {
  // Generate Chain Key (32 random bytes)
  const rootChainKey = await window.libsignal.crypto.getRandomBytes(32);
  const rootChainKeyHex = toHex(rootChainKey);

  const keyIdx = 0;
  const messageKeys = {};

  await saveSenderKeysInner(
    groupId,
    senderIdentity,
    rootChainKeyHex,
    keyIdx,
    messageKeys
  );

  const pubKey = new Uint8Array(fromHex(senderIdentity.key));
  const chainKey = new Uint8Array(rootChainKey);

  return { pubKey, chainKey, keyIdx: 0 };
}

// Save somebody else's key
export async function saveSenderKeys(
  groupId: string,
  senderIdentity: PubKey,
  chainKeyHex: string,
  keyIdx: number
) {
  const messageKeys = {};
  await saveSenderKeysInner(
    groupId,
    senderIdentity,
    chainKeyHex,
    keyIdx,
    messageKeys
  );
}

export async function shareSenderKeys(
  groupId: string,
  recipientsPrimary: Array<string>,
  senderKey: RatchetState
) {
  const message = new MediumGroupResponseKeysMessage({
    timestamp: Date.now(),
    groupId,
    senderKey,
  });

  const recipients = recipientsPrimary.map(pk => PubKey.cast(pk));
  await Promise.all(
    recipients.map(pk => getMessageQueue().sendUsingMultiDevice(pk, message))
  );
}
