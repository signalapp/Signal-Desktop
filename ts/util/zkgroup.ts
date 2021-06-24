// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  AuthCredential,
  ClientZkAuthOperations,
  ClientZkGroupCipher,
  ClientZkProfileOperations,
  FFICompatArray,
  FFICompatArrayType,
  GroupMasterKey,
  GroupSecretParams,
  ProfileKey,
  ProfileKeyCiphertext,
  ProfileKeyCredential,
  ProfileKeyCredentialPresentation,
  ProfileKeyCredentialRequestContext,
  ProfileKeyCredentialResponse,
  ServerPublicParams,
  UuidCiphertext,
} from 'zkgroup';
import * as Bytes from '../Bytes';

export * from 'zkgroup';

export function uint8ArrayToCompatArray(
  buffer: Uint8Array
): FFICompatArrayType {
  return new FFICompatArray(Buffer.from(buffer));
}

export function compatArrayToUint8Array(
  compatArray: FFICompatArrayType
): Uint8Array {
  return compatArray.buffer;
}

export function base64ToCompatArray(base64: string): FFICompatArrayType {
  return uint8ArrayToCompatArray(Bytes.fromBase64(base64));
}

export function compatArrayToBase64(compatArray: FFICompatArrayType): string {
  return Bytes.toBase64(compatArrayToUint8Array(compatArray));
}

export function compatArrayToHex(compatArray: FFICompatArrayType): string {
  return Bytes.toHex(compatArrayToUint8Array(compatArray));
}

// Scenarios

export function decryptGroupBlob(
  clientZkGroupCipher: ClientZkGroupCipher,
  ciphertext: Uint8Array
): Uint8Array {
  return compatArrayToUint8Array(
    clientZkGroupCipher.decryptBlob(uint8ArrayToCompatArray(ciphertext))
  );
}

export function decryptProfileKeyCredentialPresentation(
  clientZkGroupCipher: ClientZkGroupCipher,
  presentationBuffer: Uint8Array
): { profileKey: Uint8Array; uuid: string } {
  const presentation = new ProfileKeyCredentialPresentation(
    uint8ArrayToCompatArray(presentationBuffer)
  );

  const uuidCiphertext = presentation.getUuidCiphertext();
  const uuid = clientZkGroupCipher.decryptUuid(uuidCiphertext);

  const profileKeyCiphertext = presentation.getProfileKeyCiphertext();
  const profileKey = clientZkGroupCipher.decryptProfileKey(
    profileKeyCiphertext,
    uuid
  );

  return {
    profileKey: compatArrayToUint8Array(profileKey.serialize()),
    uuid,
  };
}

export function decryptProfileKey(
  clientZkGroupCipher: ClientZkGroupCipher,
  profileKeyCiphertextBuffer: Uint8Array,
  uuid: string
): Uint8Array {
  const profileKeyCiphertext = new ProfileKeyCiphertext(
    uint8ArrayToCompatArray(profileKeyCiphertextBuffer)
  );

  const profileKey = clientZkGroupCipher.decryptProfileKey(
    profileKeyCiphertext,
    uuid
  );

  return compatArrayToUint8Array(profileKey.serialize());
}

export function decryptUuid(
  clientZkGroupCipher: ClientZkGroupCipher,
  uuidCiphertextBuffer: Uint8Array
): string {
  const uuidCiphertext = new UuidCiphertext(
    uint8ArrayToCompatArray(uuidCiphertextBuffer)
  );

  return clientZkGroupCipher.decryptUuid(uuidCiphertext);
}

export function deriveProfileKeyVersion(
  profileKeyBase64: string,
  uuid: string
): string {
  const profileKeyArray = base64ToCompatArray(profileKeyBase64);
  const profileKey = new ProfileKey(profileKeyArray);

  const profileKeyVersion = profileKey.getProfileKeyVersion(uuid);

  return profileKeyVersion.toString();
}

export function deriveGroupPublicParams(
  groupSecretParamsBuffer: Uint8Array
): Uint8Array {
  const groupSecretParams = new GroupSecretParams(
    uint8ArrayToCompatArray(groupSecretParamsBuffer)
  );

  return compatArrayToUint8Array(
    groupSecretParams.getPublicParams().serialize()
  );
}

export function deriveGroupID(groupSecretParamsBuffer: Uint8Array): Uint8Array {
  const groupSecretParams = new GroupSecretParams(
    uint8ArrayToCompatArray(groupSecretParamsBuffer)
  );

  return compatArrayToUint8Array(
    groupSecretParams.getPublicParams().getGroupIdentifier().serialize()
  );
}

export function deriveGroupSecretParams(
  masterKeyBuffer: Uint8Array
): Uint8Array {
  const masterKey = new GroupMasterKey(
    uint8ArrayToCompatArray(masterKeyBuffer)
  );
  const groupSecretParams = GroupSecretParams.deriveFromMasterKey(masterKey);

  return compatArrayToUint8Array(groupSecretParams.serialize());
}

export function encryptGroupBlob(
  clientZkGroupCipher: ClientZkGroupCipher,
  plaintext: Uint8Array
): Uint8Array {
  return compatArrayToUint8Array(
    clientZkGroupCipher.encryptBlob(uint8ArrayToCompatArray(plaintext))
  );
}

export function encryptUuid(
  clientZkGroupCipher: ClientZkGroupCipher,
  uuidPlaintext: string
): Uint8Array {
  const uuidCiphertext = clientZkGroupCipher.encryptUuid(uuidPlaintext);

  return compatArrayToUint8Array(uuidCiphertext.serialize());
}

export function generateProfileKeyCredentialRequest(
  clientZkProfileCipher: ClientZkProfileOperations,
  uuid: string,
  profileKeyBase64: string
): { context: ProfileKeyCredentialRequestContext; requestHex: string } {
  const profileKeyArray = base64ToCompatArray(profileKeyBase64);
  const profileKey = new ProfileKey(profileKeyArray);

  const context = clientZkProfileCipher.createProfileKeyCredentialRequestContext(
    uuid,
    profileKey
  );
  const request = context.getRequest();
  const requestArray = request.serialize();

  return {
    context,
    requestHex: compatArrayToHex(requestArray),
  };
}

export function getAuthCredentialPresentation(
  clientZkAuthOperations: ClientZkAuthOperations,
  authCredentialBase64: string,
  groupSecretParamsBase64: string
): Uint8Array {
  const authCredential = new AuthCredential(
    base64ToCompatArray(authCredentialBase64)
  );
  const secretParams = new GroupSecretParams(
    base64ToCompatArray(groupSecretParamsBase64)
  );

  const presentation = clientZkAuthOperations.createAuthCredentialPresentation(
    secretParams,
    authCredential
  );
  return compatArrayToUint8Array(presentation.serialize());
}

export function createProfileKeyCredentialPresentation(
  clientZkProfileCipher: ClientZkProfileOperations,
  profileKeyCredentialBase64: string,
  groupSecretParamsBase64: string
): Uint8Array {
  const profileKeyCredentialArray = base64ToCompatArray(
    profileKeyCredentialBase64
  );
  const profileKeyCredential = new ProfileKeyCredential(
    profileKeyCredentialArray
  );
  const secretParams = new GroupSecretParams(
    base64ToCompatArray(groupSecretParamsBase64)
  );

  const presentation = clientZkProfileCipher.createProfileKeyCredentialPresentation(
    secretParams,
    profileKeyCredential
  );

  return compatArrayToUint8Array(presentation.serialize());
}

export function getClientZkAuthOperations(
  serverPublicParamsBase64: string
): ClientZkAuthOperations {
  const serverPublicParams = new ServerPublicParams(
    base64ToCompatArray(serverPublicParamsBase64)
  );

  return new ClientZkAuthOperations(serverPublicParams);
}

export function getClientZkGroupCipher(
  groupSecretParamsBase64: string
): ClientZkGroupCipher {
  const serverPublicParams = new GroupSecretParams(
    base64ToCompatArray(groupSecretParamsBase64)
  );

  return new ClientZkGroupCipher(serverPublicParams);
}

export function getClientZkProfileOperations(
  serverPublicParamsBase64: string
): ClientZkProfileOperations {
  const serverPublicParams = new ServerPublicParams(
    base64ToCompatArray(serverPublicParamsBase64)
  );

  return new ClientZkProfileOperations(serverPublicParams);
}

export function handleProfileKeyCredential(
  clientZkProfileCipher: ClientZkProfileOperations,
  context: ProfileKeyCredentialRequestContext,
  responseBase64: string
): string {
  const response = new ProfileKeyCredentialResponse(
    base64ToCompatArray(responseBase64)
  );
  const profileKeyCredential = clientZkProfileCipher.receiveProfileKeyCredential(
    context,
    response
  );

  const credentialArray = profileKeyCredential.serialize();

  return compatArrayToBase64(credentialArray);
}
