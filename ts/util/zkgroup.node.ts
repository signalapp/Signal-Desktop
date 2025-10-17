// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ProfileKeyCredentialRequestContext } from '@signalapp/libsignal-client/zkgroup.js';
import {
  AuthCredentialWithPni,
  ClientZkAuthOperations,
  ClientZkGroupCipher,
  ClientZkProfileOperations,
  GroupMasterKey,
  GroupSecretParams,
  ProfileKey,
  ProfileKeyCiphertext,
  ExpiringProfileKeyCredential,
  ProfileKeyCredentialPresentation,
  ExpiringProfileKeyCredentialResponse,
  ServerPublicParams,
  UuidCiphertext,
  NotarySignature,
} from '@signalapp/libsignal-client/zkgroup.js';
import { Aci, Pni, type ServiceId } from '@signalapp/libsignal-client';
import type {
  ServiceIdString,
  AciString,
  PniString,
} from '../types/ServiceId.std.js';
import {
  fromServiceIdObject,
  fromAciObject,
  fromPniObject,
} from '../types/ServiceId.std.js';
import * as Bytes from '../Bytes.std.js';
import { toServiceIdObject } from './ServiceId.node.js';
import { strictAssert } from './assert.std.js';

export * from '@signalapp/libsignal-client/zkgroup.js';

// Scenarios

export function decryptGroupBlob(
  clientZkGroupCipher: ClientZkGroupCipher,
  ciphertext: Uint8Array
): Uint8Array {
  return clientZkGroupCipher.decryptBlob(ciphertext);
}

export function decodeProfileKeyCredentialPresentation(
  presentationBuffer: Uint8Array
): { profileKey: Uint8Array; userId: Uint8Array } {
  const presentation = new ProfileKeyCredentialPresentation(presentationBuffer);

  const userId = presentation.getUuidCiphertext().serialize();
  const profileKey = presentation.getProfileKeyCiphertext().serialize();

  return {
    profileKey,
    userId,
  };
}

export function decryptProfileKey(
  clientZkGroupCipher: ClientZkGroupCipher,
  profileKeyCiphertextBuffer: Uint8Array,
  serviceId: ServiceIdString
): Uint8Array {
  const profileKeyCiphertext = new ProfileKeyCiphertext(
    profileKeyCiphertextBuffer
  );

  const profileKey = clientZkGroupCipher.decryptProfileKey(
    profileKeyCiphertext,
    toServiceIdObject(serviceId)
  );

  return profileKey.serialize();
}

function decryptServiceIdObj(
  clientZkGroupCipher: ClientZkGroupCipher,
  uuidCiphertextBuffer: Uint8Array
): ServiceId {
  const uuidCiphertext = new UuidCiphertext(uuidCiphertextBuffer);

  return clientZkGroupCipher.decryptServiceId(uuidCiphertext);
}

export function decryptServiceId(
  clientZkGroupCipher: ClientZkGroupCipher,
  uuidCiphertextBuffer: Uint8Array
): ServiceIdString {
  return fromServiceIdObject(
    decryptServiceIdObj(clientZkGroupCipher, uuidCiphertextBuffer)
  );
}

export function decryptAci(
  clientZkGroupCipher: ClientZkGroupCipher,
  uuidCiphertextBuffer: Uint8Array
): AciString {
  const obj = decryptServiceIdObj(clientZkGroupCipher, uuidCiphertextBuffer);
  strictAssert(obj instanceof Aci, 'userId is not ACI');
  return fromAciObject(obj);
}

export function decryptPni(
  clientZkGroupCipher: ClientZkGroupCipher,
  uuidCiphertextBuffer: Uint8Array
): PniString {
  const obj = decryptServiceIdObj(clientZkGroupCipher, uuidCiphertextBuffer);
  strictAssert(obj instanceof Pni, 'userId is not PNI');
  return fromPniObject(obj);
}

export function deriveProfileKeyVersion(
  profileKeyBase64: string,
  serviceId: ServiceIdString
): string {
  const profileKeyArray = Bytes.fromBase64(profileKeyBase64);
  const profileKey = new ProfileKey(profileKeyArray);

  const profileKeyVersion = profileKey.getProfileKeyVersion(
    toServiceIdObject(serviceId)
  );

  return profileKeyVersion.toString();
}

export function deriveAccessKeyFromProfileKey(
  profileKeyBytes: Uint8Array
): Uint8Array {
  const profileKey = new ProfileKey(profileKeyBytes);
  return profileKey.deriveAccessKey();
}

export function deriveGroupPublicParams(
  groupSecretParamsBuffer: Uint8Array
): Uint8Array {
  const groupSecretParams = new GroupSecretParams(groupSecretParamsBuffer);

  return groupSecretParams.getPublicParams().serialize();
}

export function deriveGroupID(groupSecretParamsBuffer: Uint8Array): Uint8Array {
  const groupSecretParams = new GroupSecretParams(groupSecretParamsBuffer);

  return groupSecretParams.getPublicParams().getGroupIdentifier().serialize();
}

export function deriveGroupSecretParams(
  masterKeyBuffer: Uint8Array
): Uint8Array {
  const masterKey = new GroupMasterKey(masterKeyBuffer);
  const groupSecretParams = GroupSecretParams.deriveFromMasterKey(masterKey);

  return groupSecretParams.serialize();
}

export function encryptGroupBlob(
  clientZkGroupCipher: ClientZkGroupCipher,
  plaintext: Uint8Array
): Uint8Array {
  return clientZkGroupCipher.encryptBlob(plaintext);
}

export function encryptServiceId(
  clientZkGroupCipher: ClientZkGroupCipher,
  serviceIdPlaintext: ServiceIdString
): Uint8Array {
  const uuidCiphertext = clientZkGroupCipher.encryptServiceId(
    toServiceIdObject(serviceIdPlaintext)
  );

  return uuidCiphertext.serialize();
}

export function generateProfileKeyCredentialRequest(
  clientZkProfileCipher: ClientZkProfileOperations,
  serviceId: ServiceIdString,
  profileKeyBase64: string
): { context: ProfileKeyCredentialRequestContext; requestHex: string } {
  const profileKeyArray = Bytes.fromBase64(profileKeyBase64);
  const profileKey = new ProfileKey(profileKeyArray);

  const context =
    clientZkProfileCipher.createProfileKeyCredentialRequestContext(
      toServiceIdObject(serviceId),
      profileKey
    );
  const request = context.getRequest();
  const requestArray = request.serialize();

  return {
    context,
    requestHex: Bytes.toHex(requestArray),
  };
}

export function getAuthCredentialPresentation(
  clientZkAuthOperations: ClientZkAuthOperations,
  authCredentialBase64: string,
  groupSecretParamsBase64: string
): Uint8Array {
  const authCredential = new AuthCredentialWithPni(
    Bytes.fromBase64(authCredentialBase64)
  );
  const secretParams = new GroupSecretParams(
    Bytes.fromBase64(groupSecretParamsBase64)
  );

  const presentation =
    clientZkAuthOperations.createAuthCredentialWithPniPresentation(
      secretParams,
      authCredential
    );
  return presentation.serialize();
}

export function createProfileKeyCredentialPresentation(
  clientZkProfileCipher: ClientZkProfileOperations,
  profileKeyCredentialBase64: string,
  groupSecretParamsBase64: string
): Uint8Array {
  const profileKeyCredentialArray = Bytes.fromBase64(
    profileKeyCredentialBase64
  );
  const profileKeyCredential = new ExpiringProfileKeyCredential(
    profileKeyCredentialArray
  );
  const secretParams = new GroupSecretParams(
    Bytes.fromBase64(groupSecretParamsBase64)
  );

  const presentation =
    clientZkProfileCipher.createExpiringProfileKeyCredentialPresentation(
      secretParams,
      profileKeyCredential
    );

  return presentation.serialize();
}

export function getClientZkAuthOperations(
  serverPublicParamsBase64: string
): ClientZkAuthOperations {
  const serverPublicParams = new ServerPublicParams(
    Bytes.fromBase64(serverPublicParamsBase64)
  );

  return new ClientZkAuthOperations(serverPublicParams);
}

export function getClientZkGroupCipher(
  groupSecretParamsBase64: string
): ClientZkGroupCipher {
  const serverPublicParams = new GroupSecretParams(
    Bytes.fromBase64(groupSecretParamsBase64)
  );

  return new ClientZkGroupCipher(serverPublicParams);
}

export function getClientZkProfileOperations(
  serverPublicParamsBase64: string
): ClientZkProfileOperations {
  const serverPublicParams = new ServerPublicParams(
    Bytes.fromBase64(serverPublicParamsBase64)
  );

  return new ClientZkProfileOperations(serverPublicParams);
}

export function handleProfileKeyCredential(
  clientZkProfileCipher: ClientZkProfileOperations,
  context: ProfileKeyCredentialRequestContext,
  responseBase64: string
): { credential: string; expiration: number } {
  const response = new ExpiringProfileKeyCredentialResponse(
    Bytes.fromBase64(responseBase64)
  );
  const profileKeyCredential =
    clientZkProfileCipher.receiveExpiringProfileKeyCredential(
      context,
      response
    );

  const credentialArray = profileKeyCredential.serialize();

  return {
    credential: Bytes.toBase64(credentialArray),
    expiration: profileKeyCredential.getExpirationTime().getTime(),
  };
}

export function deriveProfileKeyCommitment(
  profileKeyBase64: string,
  serviceId: ServiceIdString
): string {
  const profileKeyArray = Bytes.fromBase64(profileKeyBase64);
  const profileKey = new ProfileKey(profileKeyArray);

  const commitment = profileKey.getCommitment(
    toServiceIdObject(serviceId)
  ).contents;

  return Bytes.toBase64(commitment);
}

export function verifyNotarySignature(
  serverPublicParamsBase64: string,
  message: Uint8Array,
  signature: Uint8Array
): void {
  const serverPublicParams = new ServerPublicParams(
    Bytes.fromBase64(serverPublicParamsBase64)
  );

  const notarySignature = new NotarySignature(signature);

  serverPublicParams.verifySignature(message, notarySignature);
}
