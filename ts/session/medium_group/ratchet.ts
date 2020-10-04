import { PubKey } from '../types';
import * as Data from '../../../js/modules/data';
import { saveSenderKeysInner } from './index';
import { StringUtils } from '../utils';

const toHex = (buffer: ArrayBuffer) => StringUtils.decode(buffer, 'hex');
const fromHex = (hex: string) => StringUtils.encode(hex, 'hex');

const jobQueue: { [key: string]: Promise<any> } = {};

async function queueJobForNumber(number: string, runJob: any) {
  // tslint:disable-next-line no-promise-as-boolean
  const runPrevious = jobQueue[number] || Promise.resolve();
  const runCurrent = runPrevious.then(runJob, runJob);
  jobQueue[number] = runCurrent;
  // tslint:disable-next-line no-floating-promises
  runCurrent
    .then(() => {
      if (jobQueue[number] === runCurrent) {
        // tslint:disable-next-line no-dynamic-delete
        delete jobQueue[number];
      }
    })
    .catch((e: any) => {
      window.log.error('queueJobForNumber() Caught error', e);
    });
  return runCurrent;
}

// This is different from the other ratchet type!
interface Ratchet {
  chainKey: any;
  keyIdx: number;
  messageKeys: any;
}

// TODO: change the signature to return "NO KEY" instead of throwing
async function loadChainKey(
  groupId: string,
  senderIdentity: string
): Promise<Ratchet | null> {
  const senderKeyEntry = await Data.getSenderKeys(groupId, senderIdentity);

  if (!senderKeyEntry) {
    // TODO: we should try to request the key from the sender in this case
    return null;
  }

  const { chainKeyHex, idx: keyIdx, messageKeys } = senderKeyEntry.ratchet;

  if (!chainKeyHex) {
    throw Error('Chain key not found');
  }

  // TODO: This could fail if the data is not hex, handle
  // this case
  const chainKey = fromHex(chainKeyHex);

  return { chainKey, keyIdx, messageKeys };
}

export async function getChainKey(
  groupId: string,
  senderIdentity: string
): Promise<{ chainKey: Uint8Array; keyIdx: number } | null> {
  const maybeKey = await loadChainKey(groupId, senderIdentity);

  if (!maybeKey) {
    return null;
  } else {
    const { chainKey, keyIdx } = maybeKey;
    return { chainKey, keyIdx };
  }
}

export async function encryptWithSenderKey(
  plaintext: Uint8Array,
  groupId: string,
  ourIdentity: string
) {
  // We only want to serialize jobs with the same pair (groupId, ourIdentity)
  const id = groupId + ourIdentity;
  return queueJobForNumber(id, () =>
    encryptWithSenderKeyInner(plaintext, groupId, ourIdentity)
  );
}

async function encryptWithSenderKeyInner(
  plaintext: Uint8Array,
  groupId: string,
  ourIdentity: string
) {
  const { messageKey, keyIdx } = await stepRatchetOnce(groupId, ourIdentity);

  const ciphertext = await window.libloki.crypto.EncryptGCM(
    messageKey,
    plaintext
  );

  return { ciphertext, keyIdx };
}

async function hmacSHA256(keybuf: any, data: any) {
  // NOTE: importKey returns a 'PromiseLike'
  // tslint:disable-next-line await-promise
  const key = await crypto.subtle.importKey(
    'raw',
    keybuf,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );

  return crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' }, key, data);
}

async function stepRatchet(ratchet: Ratchet) {
  const { chainKey, keyIdx, messageKeys } = ratchet;

  const byteArray = new Uint8Array(1);
  byteArray[0] = 1;
  const messageKey = await hmacSHA256(chainKey, byteArray.buffer);

  byteArray[0] = 2;
  const nextChainKey = await hmacSHA256(chainKey, byteArray.buffer);

  const nextKeyIdx = keyIdx + 1;

  return { nextChainKey, messageKey, nextKeyIdx, messageKeys };
}

async function stepRatchetOnce(
  groupId: string,
  senderIdentity: string
): Promise<{ messageKey: any; keyIdx: any }> {
  const ratchet = await loadChainKey(groupId, senderIdentity);

  if (!ratchet) {
    window.log.error(
      `Could not find ratchet for groupId ${groupId} sender: ${senderIdentity}`
    );
    throw {};
  }

  const { nextChainKey, messageKey, nextKeyIdx } = await stepRatchet(ratchet);

  // Don't need to remember message keys for a sending ratchet
  const messageKeys = {};
  const nextChainKeyHex = toHex(nextChainKey);

  await saveSenderKeysInner(
    groupId,
    PubKey.cast(senderIdentity),
    nextChainKeyHex,
    nextKeyIdx,
    messageKeys
  );

  return { messageKey, keyIdx: nextKeyIdx };
}

// Advance the ratchet until idx
async function advanceRatchet(
  groupId: string,
  senderIdentity: string,
  idx: number
) {
  const { log } = window;

  const ratchet = await loadChainKey(groupId, senderIdentity);

  if (!ratchet) {
    log.error(
      `Could not find ratchet for groupId ${groupId} sender: ${senderIdentity}`
    );
    throw new window.textsecure.SenderKeyMissing(senderIdentity);
  }

  // Normally keyIdx will be 1 behind, in which case we stepRatchet one time only

  if (idx < ratchet.keyIdx) {
    // If the request is for some old index, retrieve the key generated earlier and
    // remove it from the database (there is no need to advance the ratchet)
    const messageKey = ratchet.messageKeys[idx];
    if (messageKey) {
      // tslint:disable-next-line no-dynamic-delete
      delete ratchet.messageKeys[idx];
      // TODO: just pass in the ratchet?
      // tslint:disable-next-line no-shadowed-variable
      const chainKeyHex = toHex(ratchet.chainKey);
      await saveSenderKeysInner(
        groupId,
        PubKey.cast(senderIdentity),
        chainKeyHex,
        ratchet.keyIdx,
        ratchet.messageKeys
      );

      return fromHex(messageKey);
    }

    log.error('[idx] not found key for idx: ', idx);
    // I probably want a better error handling than this
    return null;
  }

  const { messageKeys } = ratchet;

  let curMessageKey;

  // tslint:disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { nextKeyIdx, nextChainKey, messageKey } = await stepRatchet(ratchet);

    ratchet.chainKey = nextChainKey;
    ratchet.keyIdx = nextKeyIdx;

    if (nextKeyIdx === idx) {
      curMessageKey = messageKey;
      break;
    } else if (nextKeyIdx > idx) {
      log.error(
        `Could not decrypt for an older ratchet step: (${nextKeyIdx})nextKeyIdx > (${idx})idx`
      );
      throw new Error(`Cannot revert ratchet for group ${groupId}!`);
    } else {
      // Store keys for skipped nextKeyIdx, we might need them to decrypt
      // messages that arrive out-of-order
      messageKeys[nextKeyIdx] = toHex(messageKey);
    }
  }

  const chainKeyHex = toHex(ratchet.chainKey);

  await saveSenderKeysInner(
    groupId,
    PubKey.cast(senderIdentity),
    chainKeyHex,
    idx,
    messageKeys
  );

  return curMessageKey;
}

export async function decryptWithSenderKey(
  ciphertext: Uint8Array,
  curKeyIdx: number,
  groupId: string,
  senderIdentity: string
) {
  // We only want to serialize jobs with the same pair (groupId, senderIdentity)
  const id = groupId + senderIdentity;
  return queueJobForNumber(id, () =>
    decryptWithSenderKeyInner(ciphertext, curKeyIdx, groupId, senderIdentity)
  );
}

async function decryptWithSenderKeyInner(
  ciphertext: Uint8Array,
  curKeyIdx: number,
  groupId: string,
  senderIdentity: string
) {
  const messageKey = await advanceRatchet(groupId, senderIdentity, curKeyIdx);

  if (!messageKey) {
    return null;
  }

  // TODO: this might fail, handle this
  const plaintext = await window.libloki.crypto.DecryptGCM(
    messageKey,
    ciphertext
  );

  return plaintext;
}
