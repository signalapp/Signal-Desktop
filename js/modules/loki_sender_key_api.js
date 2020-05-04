/* global
  Signal,
  libsignal,
  StringView,
  dcodeIO,
  libloki,
  log,
  crypto
*/

/* eslint-disable more/no-then */

const toHex = buffer => StringView.arrayBufferToHex(buffer);

const fromHex = hex => dcodeIO.ByteBuffer.wrap(hex, 'hex').toArrayBuffer();

async function saveSenderKeysInner(
  groupId,
  senderIdentity,
  chainKey,
  keyIdx,
  messageKeys
) {
  const ratchet = {
    chainKey,
    messageKeys,
    idx: keyIdx,
  };

  await Signal.Data.createOrUpdateSenderKeys({
    groupId,
    senderIdentity,
    ratchet,
  });

  log.debug(
    `Saving sender keys for groupId ${groupId}, sender ${senderIdentity}`
  );
}

// Save somebody else's key
async function saveSenderKeys(groupId, senderIdentity, chainKey) {
  // New key, so index 0
  const keyIdx = 0;
  const messageKeys = {};
  await saveSenderKeysInner(
    groupId,
    senderIdentity,
    chainKey,
    keyIdx,
    messageKeys
  );
}

async function createSenderKeyForGroup(groupId, senderIdentity) {
  // Generate Chain Key (32 random bytes)
  const rootChainKey = await libsignal.crypto.getRandomBytes(32);
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

  return rootChainKeyHex;
}

async function hmacSHA256(keybuf, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    keybuf,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );

  return crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' }, key, data);
}

async function stepRatchet(ratchet) {
  const { chainKey, keyIdx, messageKeys } = ratchet;

  const byteArray = new Uint8Array(1);
  byteArray[0] = 1;
  const messageKey = await hmacSHA256(chainKey, byteArray.buffer);

  byteArray[0] = 2;
  const nextChainKey = await hmacSHA256(chainKey, byteArray.buffer);

  const nextKeyIdx = keyIdx + 1;

  return { nextChainKey, messageKey, nextKeyIdx, messageKeys };
}

async function stepRatchetOnce(groupId, senderIdentity) {
  const ratchet = await loadChainKey(groupId, senderIdentity);

  if (!ratchet) {
    log.error(
      `Could not find ratchet for groupId ${groupId} sender: ${senderIdentity}`
    );
    return null;
  }

  const { nextChainKey, messageKey, nextKeyIdx } = await stepRatchet(ratchet);

  // Don't need to remember message keys for a sending ratchet
  const messageKeys = {};
  const nextChainKeyHex = toHex(nextChainKey);

  await saveSenderKeysInner(
    groupId,
    senderIdentity,
    nextChainKeyHex,
    nextKeyIdx,
    messageKeys
  );

  return { messageKey, keyIdx: nextKeyIdx };
}

// Advance the ratchet until idx
async function advanceRatchet(groupId, senderIdentity, idx) {
  const ratchet = await loadChainKey(groupId, senderIdentity);

  if (!ratchet) {
    log.error(
      `Could not find ratchet for groupId ${groupId} sender: ${senderIdentity}`
    );
    return null;
  }

  // Normally keyIdx will be 1 behind, in which case we stepRatchet one time only

  if (idx < ratchet.keyIdx) {
    // If the request is for some old index, retrieve the key generated earlier and
    // remove it from the database (there is no need to advance the ratchet)
    const messageKey = ratchet.messageKeys[idx];
    if (messageKey) {
      delete ratchet.messageKeys[idx];
      // TODO: just pass in the ratchet?
      const chainKeyHex = toHex(ratchet.chainKey);
      await saveSenderKeysInner(
        groupId,
        senderIdentity,
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

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { nextKeyIdx, nextChainKey, messageKey } = await stepRatchet(ratchet);

    ratchet.chainKey = nextChainKey;
    ratchet.keyIdx = nextKeyIdx;

    if (nextKeyIdx === idx) {
      curMessageKey = messageKey;
      break;
    } else if (nextKeyIdx > idx) {
      log.error('Developer error: nextKeyIdx > idx');
    } else {
      // Store keys for skipped nextKeyIdx, we might need them to decrypt
      // messages that arrive out-of-order
      messageKeys[nextKeyIdx] = toHex(messageKey);
    }
  }

  const chainKeyHex = toHex(ratchet.chainKey);

  await saveSenderKeysInner(
    groupId,
    senderIdentity,
    chainKeyHex,
    idx,
    messageKeys
  );

  return curMessageKey;
}

async function loadChainKey(groupId, senderIdentity) {
  const senderKeyEntry = await Signal.Data.getSenderKeys(
    groupId,
    senderIdentity
  );

  if (!senderKeyEntry) {
    // TODO: we should try to request the key from the sender in this case
    log.error(
      `Sender key not found for group ${groupId} sender ${senderIdentity}`
    );
    // TODO: throw instead?
    return null;
  }

  const {
    chainKey: chainKeyHex,
    idx: keyIdx,
    messageKeys,
  } = senderKeyEntry.ratchet;

  if (!chainKeyHex) {
    log.error('Chain key not found');
    return null;
  }

  // TODO: This could fail if the data is not hex, handle
  // this case
  const chainKey = fromHex(chainKeyHex);

  return { chainKey, keyIdx, messageKeys };
}

const jobQueue = {};

function queueJobForNumber(number, runJob) {
  const runPrevious = jobQueue[number] || Promise.resolve();
  const runCurrent = runPrevious.then(runJob, runJob);
  jobQueue[number] = runCurrent;
  runCurrent.then(() => {
    if (jobQueue[number] === runCurrent) {
      delete jobQueue[number];
    }
  });
  return runCurrent;
}

async function decryptWithSenderKey(
  ciphertext,
  curKeyIdx,
  groupId,
  senderIdentity
) {
  // We only want to serialize jobs with the same pair (groupId, senderIdentity)
  const id = groupId + senderIdentity;
  return queueJobForNumber(id, () =>
    decryptWithSenderKeyInner(ciphertext, curKeyIdx, groupId, senderIdentity)
  );
}

async function decryptWithSenderKeyInner(
  ciphertext,
  curKeyIdx,
  groupId,
  senderIdentity
) {
  const messageKey = await advanceRatchet(groupId, senderIdentity, curKeyIdx);

  // TODO: this might fail, handle this
  const plaintext = await libloki.crypto.DecryptGCM(
    messageKey,
    ciphertext.toArrayBuffer()
  );

  return plaintext;
}

async function encryptWithSenderKey(plaintext, groupId, ourIdentity) {
  // We only want to serialize jobs with the same pair (groupId, ourIdentity)
  const id = groupId + ourIdentity;
  return queueJobForNumber(id, () =>
    encryptWithSenderKeyInner(plaintext, groupId, ourIdentity)
  );
}

async function encryptWithSenderKeyInner(plaintext, groupId, ourIdentity) {
  const { messageKey, keyIdx } = await stepRatchetOnce(groupId, ourIdentity);

  const ciphertext = await libloki.crypto.EncryptGCM(messageKey, plaintext);

  return { ciphertext, keyIdx };
}

module.exports = {
  createSenderKeyForGroup,
  encryptWithSenderKey,
  decryptWithSenderKey,
  saveSenderKeys,
};
