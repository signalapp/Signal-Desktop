// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import { signal } from '../protobuf/compiled.std.js';
import * as Bytes from '../Bytes.std.js';
import { deriveSecrets } from '../Crypto.node.js';

const { get, isFinite, isInteger, isString } = lodash;

const { RecordStructure, SessionStructure } = signal.proto.storage;
const { Chain } = SessionStructure;

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
  identityKeyPublic: Uint8Array;
  registrationId: number;
};

export function sessionStructureToBytes(
  recordStructure: signal.proto.storage.RecordStructure
): Uint8Array {
  return signal.proto.storage.RecordStructure.encode(recordStructure).finish();
}

export function sessionRecordToProtobuf(
  record: SessionRecordType,
  ourData: LocalUserDataType
): signal.proto.storage.RecordStructure {
  const proto = new RecordStructure();

  proto.previousSessions = [];

  const sessionGroup = record.sessions || {};
  const sessions = Object.values(sessionGroup);

  const first = sessions.find(session => {
    return session?.indexInfo?.closed === -1;
  });

  if (first) {
    proto.currentSession = toProtobufSession(first, ourData);
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

  proto.previousSessions = [];
  onlyClosed.forEach(session => {
    proto.previousSessions.push(toProtobufSession(session, ourData));
  });

  if (!proto.currentSession && proto.previousSessions.length === 0) {
    throw new Error('toProtobuf: Record had no sessions!');
  }

  return proto;
}

function toProtobufSession(
  session: SessionType,
  ourData: LocalUserDataType
): signal.proto.storage.SessionStructure {
  const proto = new SessionStructure();

  // Core Fields

  proto.aliceBaseKey = binaryToUint8Array(session, 'indexInfo.baseKey', 33);
  proto.localIdentityPublic = ourData.identityKeyPublic;
  proto.localRegistrationId = ourData.registrationId;

  proto.previousCounter =
    getInteger(session, 'currentRatchet.previousCounter') + 1;
  proto.remoteIdentityPublic = binaryToUint8Array(
    session,
    'indexInfo.remoteIdentityKey',
    33
  );
  proto.remoteRegistrationId = getInteger(session, 'registrationId');
  proto.rootKey = binaryToUint8Array(session, 'currentRatchet.rootKey', 32);
  proto.sessionVersion = 3;

  // Note: currently unused
  // proto.needsRefresh = null;

  // Pending PreKey

  if (session.pendingPreKey) {
    proto.pendingPreKey =
      new signal.proto.storage.SessionStructure.PendingPreKey();
    proto.pendingPreKey.baseKey = binaryToUint8Array(
      session,
      'pendingPreKey.baseKey',
      33
    );
    proto.pendingPreKey.signedPreKeyId = getInteger(
      session,
      'pendingPreKey.signedKeyId'
    );

    if (session.pendingPreKey.preKeyId !== undefined) {
      proto.pendingPreKey.preKeyId = getInteger(
        session,
        'pendingPreKey.preKeyId'
      );
    }
  }

  // Sender Chain

  const senderBaseKey = session.currentRatchet?.ephemeralKeyPair?.pubKey;
  if (!senderBaseKey) {
    throw new Error('toProtobufSession: No sender base key!');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  proto.senderChain = protoSenderChain;

  // First Receiver Chain

  proto.receiverChains = [];

  const firstReceiverChainBaseKey =
    session.currentRatchet?.lastRemoteEphemeralKey;
  if (!firstReceiverChainBaseKey) {
    throw new Error('toProtobufSession: No receiver base key!');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstReceiverChain = (session as any)[firstReceiverChainBaseKey] as
    | ChainType
    | undefined;

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

    proto.receiverChains.push(protoFirstReceiverChain);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    proto.receiverChains.push(protoChain);
  });

  return proto;
}

function toProtobufChain(
  chain: ChainType
): signal.proto.storage.SessionStructure.Chain {
  const proto = new Chain();

  const protoChainKey = new Chain.ChainKey();
  protoChainKey.index = getInteger(chain, 'chainKey.counter') + 1;
  if (chain.chainKey?.key !== undefined) {
    protoChainKey.key = binaryToUint8Array(chain, 'chainKey.key', 32);
  }
  proto.chainKey = protoChainKey;

  const messageKeys = Object.entries(chain.messageKeys || {});
  proto.messageKeys = messageKeys.map(entry => {
    const protoMessageKey = new SessionStructure.Chain.MessageKey();
    protoMessageKey.index = getInteger(entry, '0') + 1;
    const key = binaryToUint8Array(entry, '1', 32);

    const { cipherKey, macKey, iv } = translateMessageKey(key);

    protoMessageKey.cipherKey = cipherKey;
    protoMessageKey.macKey = macKey;
    protoMessageKey.iv = iv;

    return protoMessageKey;
  });

  return proto;
}

// Utility functions

const WHISPER_MESSAGE_KEYS = 'WhisperMessageKeys';

function translateMessageKey(key: Uint8Array) {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  object: any,
  path: string,
  length: number
): Uint8Array {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
