// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ProfileKeyCredentialRequestContext,
  PniCredentialRequestContext,
} from '@signalapp/libsignal-client/zkgroup';
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
  PniCredential,
  PniCredentialResponse,
  PniCredentialPresentation,
  ServerPublicParams,
  UuidCiphertext,
  NotarySignature,
} from '@signalapp/libsignal-client/zkgroup';
import { UUID } from '../types/UUID';
import type { UUIDStringType } from '../types/UUID';

export * from '@signalapp/libsignal-client/zkgroup';

// Scenarios

export function decryptGroupBlob(
  clientZkGroupCipher: ClientZkGroupCipher,
  ciphertext: Uint8Array
): Uint8Array {
  return clientZkGroupCipher.decryptBlob(Buffer.from(ciphertext));
}

export function decodeProfileKeyCredentialPresentation(
  presentationBuffer: Uint8Array
): { profileKey: Uint8Array; userId: Uint8Array } {
  const presentation = new ProfileKeyCredentialPresentation(
    Buffer.from(presentationBuffer)
  );

  const userId = presentation.getUuidCiphertext().serialize();
  const profileKey = presentation.getProfileKeyCiphertext().serialize();

  return {
    profileKey,
    userId,
  };
}

export function decryptPniCredentialPresentation(
  clientZkGroupCipher: ClientZkGroupCipher,
  presentationBuffer: Uint8Array
): { profileKey: Uint8Array; pni: UUIDStringType; aci: UUIDStringType } {
  const presentation = new PniCredentialPresentation(
    Buffer.from(presentationBuffer)
  );

  const pniCiphertext = presentation.getPniCiphertext();
  const aciCiphertext = presentation.getAciCiphertext();
  const aci = clientZkGroupCipher.decryptUuid(aciCiphertext);
  const pni = clientZkGroupCipher.decryptUuid(pniCiphertext);

  const profileKeyCiphertext = presentation.getProfileKeyCiphertext();
  const profileKey = clientZkGroupCipher.decryptProfileKey(
    profileKeyCiphertext,
    aci
  );

  return {
    profileKey: profileKey.serialize(),
    aci: UUID.cast(aci),
    pni: UUID.cast(pni),
  };
}

export function decryptProfileKey(
  clientZkGroupCipher: ClientZkGroupCipher,
  profileKeyCiphertextBuffer: Uint8Array,
  uuid: UUIDStringType
): Uint8Array {
  const profileKeyCiphertext = new ProfileKeyCiphertext(
    Buffer.from(profileKeyCiphertextBuffer)
  );

  const profileKey = clientZkGroupCipher.decryptProfileKey(
    profileKeyCiphertext,
    uuid
  );

  return profileKey.serialize();
}

export function decryptUuid(
  clientZkGroupCipher: ClientZkGroupCipher,
  uuidCiphertextBuffer: Uint8Array
): string {
  const uuidCiphertext = new UuidCiphertext(Buffer.from(uuidCiphertextBuffer));

  return clientZkGroupCipher.decryptUuid(uuidCiphertext);
}

export function deriveProfileKeyVersion(
  profileKeyBase64: string,
  uuid: UUIDStringType
): string {
  const profileKeyArray = Buffer.from(profileKeyBase64, 'base64');
  const profileKey = new ProfileKey(profileKeyArray);

  const profileKeyVersion = profileKey.getProfileKeyVersion(uuid);

  return profileKeyVersion.toString();
}

export function deriveGroupPublicParams(
  groupSecretParamsBuffer: Uint8Array
): Uint8Array {
  const groupSecretParams = new GroupSecretParams(
    Buffer.from(groupSecretParamsBuffer)
  );

  return groupSecretParams.getPublicParams().serialize();
}

export function deriveGroupID(groupSecretParamsBuffer: Uint8Array): Uint8Array {
  const groupSecretParams = new GroupSecretParams(
    Buffer.from(groupSecretParamsBuffer)
  );

  return groupSecretParams.getPublicParams().getGroupIdentifier().serialize();
}

export function deriveGroupSecretParams(
  masterKeyBuffer: Uint8Array
): Uint8Array {
  const masterKey = new GroupMasterKey(Buffer.from(masterKeyBuffer));
  const groupSecretParams = GroupSecretParams.deriveFromMasterKey(masterKey);

  return groupSecretParams.serialize();
}

export function encryptGroupBlob(
  clientZkGroupCipher: ClientZkGroupCipher,
  plaintext: Uint8Array
): Uint8Array {
  return clientZkGroupCipher.encryptBlob(Buffer.from(plaintext));
}

export function encryptUuid(
  clientZkGroupCipher: ClientZkGroupCipher,
  uuidPlaintext: UUID
): Uint8Array {
  const uuidCiphertext = clientZkGroupCipher.encryptUuid(
    uuidPlaintext.toString()
  );

  return uuidCiphertext.serialize();
}

export function generateProfileKeyCredentialRequest(
  clientZkProfileCipher: ClientZkProfileOperations,
  uuid: UUIDStringType,
  profileKeyBase64: string
): { context: ProfileKeyCredentialRequestContext; requestHex: string } {
  const profileKeyArray = Buffer.from(profileKeyBase64, 'base64');
  const profileKey = new ProfileKey(profileKeyArray);

  const context =
    clientZkProfileCipher.createProfileKeyCredentialRequestContext(
      uuid,
      profileKey
    );
  const request = context.getRequest();
  const requestArray = request.serialize();

  return {
    context,
    requestHex: requestArray.toString('hex'),
  };
}

export function generatePNICredentialRequest(
  clientZkProfileCipher: ClientZkProfileOperations,
  aci: UUIDStringType,
  pni: UUIDStringType,
  profileKeyBase64: string
): { context: PniCredentialRequestContext; requestHex: string } {
  const profileKeyArray = Buffer.from(profileKeyBase64, 'base64');
  const profileKey = new ProfileKey(profileKeyArray);

  const context = clientZkProfileCipher.createPniCredentialRequestContext(
    aci,
    pni,
    profileKey
  );
  const request = context.getRequest();
  const requestArray = request.serialize();

  return {
    context,
    requestHex: requestArray.toString('hex'),
  };
}

export function getAuthCredentialPresentation(
  clientZkAuthOperations: ClientZkAuthOperations,
  authCredentialBase64: string,
  groupSecretParamsBase64: string
): Uint8Array {
  const authCredential = new AuthCredentialWithPni(
    Buffer.from(authCredentialBase64, 'base64')
  );
  const secretParams = new GroupSecretParams(
    Buffer.from(groupSecretParamsBase64, 'base64')
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
  const profileKeyCredentialArray = Buffer.from(
    profileKeyCredentialBase64,
    'base64'
  );
  const profileKeyCredential = new ExpiringProfileKeyCredential(
    profileKeyCredentialArray
  );
  const secretParams = new GroupSecretParams(
    Buffer.from(groupSecretParamsBase64, 'base64')
  );

  const presentation =
    clientZkProfileCipher.createExpiringProfileKeyCredentialPresentation(
      secretParams,
      profileKeyCredential
    );

  return presentation.serialize();
}

export function createPNICredentialPresentation(
  clientZkProfileCipher: ClientZkProfileOperations,
  pniCredentialBase64: string,
  groupSecretParamsBase64: string
): Uint8Array {
  const pniCredentialArray = Buffer.from(pniCredentialBase64, 'base64');
  const pniCredential = new PniCredential(pniCredentialArray);
  const secretParams = new GroupSecretParams(
    Buffer.from(groupSecretParamsBase64, 'base64')
  );

  const presentation = clientZkProfileCipher.createPniCredentialPresentation(
    secretParams,
    pniCredential
  );

  return presentation.serialize();
}

export function getClientZkAuthOperations(
  serverPublicParamsBase64: string
): ClientZkAuthOperations {
  const serverPublicParams = new ServerPublicParams(
    Buffer.from(serverPublicParamsBase64, 'base64')
  );

  return new ClientZkAuthOperations(serverPublicParams);
}

export function getClientZkGroupCipher(
  groupSecretParamsBase64: string
): ClientZkGroupCipher {
  const serverPublicParams = new GroupSecretParams(
    Buffer.from(groupSecretParamsBase64, 'base64')
  );

  return new ClientZkGroupCipher(serverPublicParams);
}

export function getClientZkProfileOperations(
  serverPublicParamsBase64: string
): ClientZkProfileOperations {
  const serverPublicParams = new ServerPublicParams(
    Buffer.from(serverPublicParamsBase64, 'base64')
  );

  return new ClientZkProfileOperations(serverPublicParams);
}

export function handleProfileKeyCredential(
  clientZkProfileCipher: ClientZkProfileOperations,
  context: ProfileKeyCredentialRequestContext,
  responseBase64: string
): { credential: string; expiration: number } {
  const response = new ExpiringProfileKeyCredentialResponse(
    Buffer.from(responseBase64, 'base64')
  );
  const profileKeyCredential =
    clientZkProfileCipher.receiveExpiringProfileKeyCredential(
      context,
      response
    );

  const credentialArray = profileKeyCredential.serialize();

  return {
    credential: credentialArray.toString('base64'),
    expiration: profileKeyCredential.getExpirationTime().getTime(),
  };
}

export function handleProfileKeyPNICredential(
  clientZkProfileCipher: ClientZkProfileOperations,
  context: PniCredentialRequestContext,
  responseBase64: string
): string {
  const response = new PniCredentialResponse(
    Buffer.from(responseBase64, 'base64')
  );
  const pniCredential = clientZkProfileCipher.receivePniCredential(
    context,
    response
  );

  const credentialArray = pniCredential.serialize();

  return credentialArray.toString('base64');
}

export function deriveProfileKeyCommitment(
  profileKeyBase64: string,
  uuid: UUIDStringType
): string {
  const profileKeyArray = Buffer.from(profileKeyBase64, 'base64');
  const profileKey = new ProfileKey(profileKeyArray);

  return profileKey.getCommitment(uuid).contents.toString('base64');
}

export function verifyNotarySignature(
  serverPublicParamsBase64: string,
  message: Uint8Array,
  signature: Uint8Array
): void {
  const serverPublicParams = new ServerPublicParams(
    Buffer.from(serverPublicParamsBase64, 'base64')
  );

  const notarySignature = new NotarySignature(Buffer.from(signature));

  serverPublicParams.verifySignature(Buffer.from(message), notarySignature);
}
