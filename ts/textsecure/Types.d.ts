// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export {
  IdentityKeyType,
  PreKeyType,
  SenderKeyType,
  SessionType,
  SignedPreKeyType,
  UnprocessedType,
  UnprocessedUpdateType,
} from '../sql/Interface';

// How the legacy APIs generate these types

export type CompatSignedPreKeyType = {
  keyId: number;
  keyPair: KeyPairType;
  signature: ArrayBuffer;
};

export type CompatPreKeyType = {
  keyId: number;
  keyPair: KeyPairType;
};

// How we work with these types thereafter

export type KeyPairType = {
  privKey: ArrayBuffer;
  pubKey: ArrayBuffer;
};

export type OuterSignedPrekeyType = {
  confirmed: boolean;
  // eslint-disable-next-line camelcase
  created_at: number;
  keyId: number;
  privKey: ArrayBuffer;
  pubKey: ArrayBuffer;
};
