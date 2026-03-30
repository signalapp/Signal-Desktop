// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import { signal } from '../protobuf/compiled.std.js';
import * as Bytes from '../Bytes.std.ts';
import { deriveSecrets } from '../Crypto.node.ts';

const { get, isFinite, isInteger, isString } = lodash;

type KeyPairType = {
  privKey?: string;
  pubKey?: string;
};

type OldRatchetType = {
  added?: number;
  ephemeralKey?: string;
};

type SessionType = {
  registrationId?: number;
  currentRatchet?: {
    rootKey?: string;
    lastRemoteEphemeralKey?: string;
    previousCounter?: number;
    ephemeralKeyPair?: KeyPairType;
  };
  indexInfo?: {
    remoteIdentityKey?: string;
    closed?: number;
    baseKey?: string;
    baseKeyType?: number;
  };
  pendingPreKey?: {
    baseKey?: string;
    signedPreKeyId?: number;
    // The first two are required; this one is optional
    preKeyId?: number;
  };
  oldRatchetList?: Array<OldRatchetType>;

  // Note: ChainTypes are stored here, keyed by their baseKey. Typescript
  ///  doesn't allow that kind of combination definition (known keys and
  //   indexer), so we force session to `any` below whenever we access it like
  //   `session[baseKey]`.
};

type MessageKeyGroup = {
  [key: string]: string;
};

type ChainType = {
  messageKeys?: MessageKeyGroup;
  chainKey?: {
    counter?: number;
    key?: string;
  };
  chainType: number;
};

type SessionListType = {
  [key: string]: SessionType;
};

type SessionRecordType = {
  sessions?: SessionListType;
  version?: 'v1';
};

export type LocalUserDataType = {
  identityKeyPublic: Uint8Array<ArrayBuffer>;
  registrationId: number;
};

export function sessionStructureToBytes(
  recordStructure: signal.proto.storage.RecordStructure.Params
): Uint8Array<ArrayBuffer> {
  return signal.proto.storage.RecordStructure.encode(recordStructure);
}

export function sessionRecordToProtobuf(
  record: SessionRecordType,
  ourData: LocalUserDataType
): signal.proto.storage.RecordStructure.Params {
  const sessionGroup = record.sessions || {};
  const sessions = Object.values(sessionGroup);

  const first = sessions.find(session => {
    return session?.indexInfo?.closed === -1;
  });

  let currentSession: signal.proto.storage.SessionStructure.Params | null;
  if (first) {
    currentSession = toProtobufSession(first, ourData);
  } else {
    currentSession = null;
  }

  sessions.sort((left, right) => {
    // Descending - we want recently-closed sessions to be first
    return (right?.indexInfo?.closed || 0) - (left?.indexInfo?.closed || 0);
  });
  const onlyClosed = sessions.filter(
    session => session?.indexInfo?.closed !== -1
  );

  if (onlyClosed.length < sessions.length - 1) {
    throw new Error('toProtobuf: More than one open session!');
  }

  const previousSessions =
    new Array<signal.proto.storage.SessionStructure.Params>();
  onlyClosed.forEach(session => {
    previousSessions.push(toProtobufSession(session, ourData));
  });

  if (!currentSession && previousSessions.length === 0) {
    throw new Error('toProtobuf: Record had no sessions!');
  }

  return {
    currentSession,
    previousSessions,
  };
}

function toProtobufSession(
  session: SessionType,
  ourData: LocalUserDataType
): signal.proto.storage.SessionStructure.Params {
  const senderBaseKey = session.currentRatchet?.ephemeralKeyPair?.pubKey;
  if (!senderBaseKey) {
    throw new Error('toProtobufSession: No sender base key!');
  }
  // oxlint-disable-next-line typescript/no-explicit-any
  const senderChain = (session as any)[senderBaseKey] as ChainType | undefined;
  if (!senderChain) {
    throw new Error(
      'toProtobufSession: No matching chain found with senderBaseKey!'
    );
  }

  if (senderChain.chainType !== 1) {
    throw new Error(
      `toProtobufSession: Expected sender chain type for senderChain, got ${senderChain.chainType}`
    );
  }

  const protoSenderChain = toProtobufChain(senderChain);

  protoSenderChain.senderRatchetKey = binaryToUint8Array(
    session,
    'currentRatchet.ephemeralKeyPair.pubKey',
    33
  );
  protoSenderChain.senderRatchetKeyPrivate = binaryToUint8Array(
    session,
    'currentRatchet.ephemeralKeyPair.privKey',
    32
  );

  // First Receiver Chain

  const firstReceiverChainBaseKey =
    session.currentRatchet?.lastRemoteEphemeralKey;
  if (!firstReceiverChainBaseKey) {
    throw new Error('toProtobufSession: No receiver base key!');
  }

  // oxlint-disable-next-line typescript/no-explicit-any
  const firstReceiverChain = (session as any)[firstReceiverChainBaseKey] as
    | ChainType
    | undefined;

  const receiverChains =
    new Array<signal.proto.storage.SessionStructure.Chain.Params>();

  // If the session was just initialized, then there will be no receiver chain
  if (firstReceiverChain) {
    const protoFirstReceiverChain = toProtobufChain(firstReceiverChain);

    if (firstReceiverChain.chainType !== 2) {
      throw new Error(
        `toProtobufSession: Expected receiver chain type for firstReceiverChain, got ${firstReceiverChain.chainType}`
      );
    }

    protoFirstReceiverChain.senderRatchetKey = binaryToUint8Array(
      session,
      'currentRatchet.lastRemoteEphemeralKey',
      33
    );

    receiverChains.push(protoFirstReceiverChain);
  }

  // Old Receiver Chains

  const oldChains = (session.oldRatchetList || [])
    .slice(0)
    .sort((left, right) => (right.added || 0) - (left.added || 0));
  oldChains.forEach(oldRatchet => {
    const baseKey = oldRatchet.ephemeralKey;
    if (!baseKey) {
      throw new Error('toProtobufSession: No base key for old receiver chain!');
    }

    // oxlint-disable-next-line typescript/no-explicit-any
    const chain = (session as any)[baseKey] as ChainType | undefined;
    if (!chain) {
      throw new Error(
        'toProtobufSession: No chain for old receiver chain base key!'
      );
    }

    if (chain.chainType !== 2) {
      throw new Error(
        `toProtobufSession: Expected receiver chain type, got ${chain.chainType}`
      );
    }

    const protoChain = toProtobufChain(chain);

    protoChain.senderRatchetKey = binaryToUint8Array(
      oldRatchet,
      'ephemeralKey',
      33
    );

    receiverChains.push(protoChain);
  });

  return {
    // Core Fields
    aliceBaseKey: binaryToUint8Array(session, 'indexInfo.baseKey', 33),
    localIdentityPublic: ourData.identityKeyPublic,
    localRegistrationId: ourData.registrationId,

    previousCounter: getInteger(session, 'currentRatchet.previousCounter') + 1,
    remoteIdentityPublic: binaryToUint8Array(
      session,
      'indexInfo.remoteIdentityKey',
      33
    ),
    remoteRegistrationId: getInteger(session, 'registrationId'),
    rootKey: binaryToUint8Array(session, 'currentRatchet.rootKey', 32),
    sessionVersion: 3,

    // Note: currently unused
    needsRefresh: null,

    // Pending PreKey
    pendingPreKey: session.pendingPreKey
      ? {
          baseKey: binaryToUint8Array(session, 'pendingPreKey.baseKey', 33),
          signedPreKeyId: getInteger(session, 'pendingPreKey.signedKeyId'),
          preKeyId:
            session.pendingPreKey.preKeyId !== undefined
              ? getInteger(session, 'pendingPreKey.preKeyId')
              : null,
        }
      : null,

    // Sender Chain

    senderChain: protoSenderChain,

    receiverChains,
  };
}

function toProtobufChain(
  chain: ChainType
): signal.proto.storage.SessionStructure.Chain.Params {
  const messageKeys = Object.entries(chain.messageKeys || {});

  return {
    chainKey: {
      index: getInteger(chain, 'chainKey.counter') + 1,
      key:
        chain.chainKey?.key !== undefined
          ? binaryToUint8Array(chain, 'chainKey.key', 32)
          : null,
    },
    messageKeys: messageKeys.map(
      (
        entry
      ): signal.proto.storage.SessionStructure.Chain.MessageKey.Params => {
        const key = binaryToUint8Array(entry, '1', 32);

        const { cipherKey, macKey, iv } = translateMessageKey(key);
        return {
          index: getInteger(entry, '0') + 1,
          cipherKey,
          macKey,
          iv,
        };
      }
    ),
    senderRatchetKey: null,
    senderRatchetKeyPrivate: null,
  };
}

// Utility functions

const WHISPER_MESSAGE_KEYS = 'WhisperMessageKeys';

function translateMessageKey(key: Uint8Array<ArrayBuffer>) {
  const input = key;
  const salt = new Uint8Array(32);
  const info = Bytes.fromString(WHISPER_MESSAGE_KEYS);

  const [cipherKey, macKey, ivContainer] = deriveSecrets(input, salt, info);

  return {
    cipherKey,
    macKey,
    iv: ivContainer.subarray(0, 16),
  };
}

function binaryToUint8Array(
  // oxlint-disable-next-line typescript/no-explicit-any
  object: any,
  path: string,
  length: number
): Uint8Array<ArrayBuffer> {
  const target = get(object, path);
  if (target == null) {
    throw new Error(`binaryToUint8Array: Falsey path ${path}`);
  }

  if (!isString(target)) {
    throw new Error(`binaryToUint8Array: String not found at path ${path}`);
  }

  const buffer = Bytes.fromBinary(target);
  if (length && buffer.byteLength !== length) {
    throw new Error(
      `binaryToUint8Array: Got unexpected length ${buffer.byteLength} instead of ${length} at path ${path}`
    );
  }

  return buffer;
}

// oxlint-disable-next-line typescript/no-explicit-any
function getInteger(object: any, path: string): number {
  const target = get(object, path);
  if (target == null) {
    throw new Error(`getInteger: Falsey path ${path}`);
  }

  if (isString(target)) {
    const result = parseInt(target, 10);
    if (!isFinite(result)) {
      throw new Error(
        `getInteger: Value could not be parsed as number at ${path}: {target}`
      );
    }

    if (!isInteger(result)) {
      throw new Error(
        `getInteger: Parsed value not an integer at ${path}: {target}`
      );
    }

    return result;
  }

  if (!isInteger(target)) {
    throw new Error(`getInteger: Value not an integer at ${path}: {target}`);
  }

  return target;
}
