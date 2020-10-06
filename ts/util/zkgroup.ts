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
import {
  arrayBufferToBase64,
  arrayBufferToHex,
  base64ToArrayBuffer,
  typedArrayToArrayBuffer,
} from '../Crypto';

export * from 'zkgroup';

export function arrayBufferToCompatArray(
  arrayBuffer: ArrayBuffer
): FFICompatArrayType {
  const buffer = Buffer.from(arrayBuffer);

  return new FFICompatArray(buffer);
}

export function compatArrayToArrayBuffer(
  compatArray: FFICompatArrayType
): ArrayBuffer {
  return typedArrayToArrayBuffer(compatArray.buffer);
}

export function base64ToCompatArray(base64: string): FFICompatArrayType {
  return arrayBufferToCompatArray(base64ToArrayBuffer(base64));
}

export function compatArrayToBase64(compatArray: FFICompatArrayType): string {
  return arrayBufferToBase64(compatArrayToArrayBuffer(compatArray));
}

export function compatArrayToHex(compatArray: FFICompatArrayType): string {
  return arrayBufferToHex(compatArrayToArrayBuffer(compatArray));
}

// Scenarios

export function decryptGroupBlob(
  clientZkGroupCipher: ClientZkGroupCipher,
  ciphertext: ArrayBuffer
): ArrayBuffer {
  return compatArrayToArrayBuffer(
    clientZkGroupCipher.decryptBlob(arrayBufferToCompatArray(ciphertext))
  );
}

export function decryptProfileKeyCredentialPresentation(
  clientZkGroupCipher: ClientZkGroupCipher,
  presentationBuffer: ArrayBuffer
): { profileKey: ArrayBuffer; uuid: string } {
  const presentation = new ProfileKeyCredentialPresentation(
    arrayBufferToCompatArray(presentationBuffer)
  );

  const uuidCiphertext = presentation.getUuidCiphertext();
  const uuid = clientZkGroupCipher.decryptUuid(uuidCiphertext);

  const profileKeyCiphertext = presentation.getProfileKeyCiphertext();
  const profileKey = clientZkGroupCipher.decryptProfileKey(
    profileKeyCiphertext,
    uuid
  );

  return {
    profileKey: compatArrayToArrayBuffer(profileKey.serialize()),
    uuid,
  };
}

export function decryptProfileKey(
  clientZkGroupCipher: ClientZkGroupCipher,
  profileKeyCiphertextBuffer: ArrayBuffer,
  uuid: string
): ArrayBuffer {
  const profileKeyCiphertext = new ProfileKeyCiphertext(
    arrayBufferToCompatArray(profileKeyCiphertextBuffer)
  );

  const profileKey = clientZkGroupCipher.decryptProfileKey(
    profileKeyCiphertext,
    uuid
  );

  return compatArrayToArrayBuffer(profileKey.serialize());
}

export function decryptUuid(
  clientZkGroupCipher: ClientZkGroupCipher,
  uuidCiphertextBuffer: ArrayBuffer
): string {
  const uuidCiphertext = new UuidCiphertext(
    arrayBufferToCompatArray(uuidCiphertextBuffer)
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
  groupSecretParamsBuffer: ArrayBuffer
): ArrayBuffer {
  const groupSecretParams = new GroupSecretParams(
    arrayBufferToCompatArray(groupSecretParamsBuffer)
  );

  return compatArrayToArrayBuffer(
    groupSecretParams.getPublicParams().serialize()
  );
}

export function deriveGroupID(
  groupSecretParamsBuffer: ArrayBuffer
): ArrayBuffer {
  const groupSecretParams = new GroupSecretParams(
    arrayBufferToCompatArray(groupSecretParamsBuffer)
  );

  return compatArrayToArrayBuffer(
    groupSecretParams
      .getPublicParams()
      .getGroupIdentifier()
      .serialize()
  );
}

export function deriveGroupSecretParams(
  masterKeyBuffer: ArrayBuffer
): ArrayBuffer {
  const masterKey = new GroupMasterKey(
    arrayBufferToCompatArray(masterKeyBuffer)
  );
  const groupSecretParams = GroupSecretParams.deriveFromMasterKey(masterKey);

  return compatArrayToArrayBuffer(groupSecretParams.serialize());
}

export function encryptGroupBlob(
  clientZkGroupCipher: ClientZkGroupCipher,
  plaintext: ArrayBuffer
): ArrayBuffer {
  return compatArrayToArrayBuffer(
    clientZkGroupCipher.encryptBlob(arrayBufferToCompatArray(plaintext))
  );
}

export function encryptUuid(
  clientZkGroupCipher: ClientZkGroupCipher,
  uuidPlaintext: string
): ArrayBuffer {
  const uuidCiphertext = clientZkGroupCipher.encryptUuid(uuidPlaintext);

  return compatArrayToArrayBuffer(uuidCiphertext.serialize());
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
): ArrayBuffer {
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
  return compatArrayToArrayBuffer(presentation.serialize());
}

export function createProfileKeyCredentialPresentation(
  clientZkProfileCipher: ClientZkProfileOperations,
  profileKeyCredentialBase64: string,
  groupSecretParamsBase64: string
): ArrayBuffer {
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

  return compatArrayToArrayBuffer(presentation.serialize());
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
