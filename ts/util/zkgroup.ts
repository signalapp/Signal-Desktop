export * from 'zkgroup';

import {
  ClientZkProfileOperations,
  FFICompatArray,
  FFICompatArrayType,
  ProfileKey,
  ProfileKeyCredentialRequestContext,
  ProfileKeyCredentialResponse,
  ServerPublicParams,
} from 'zkgroup';
import {
  arrayBufferToBase64,
  arrayBufferToHex,
  base64ToArrayBuffer,
  typedArrayToArrayBuffer,
} from '../Crypto';

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

export function deriveProfileKeyVersion(
  profileKeyBase64: string,
  uuid: string
) {
  const profileKeyArray = base64ToCompatArray(profileKeyBase64);
  const profileKey = new ProfileKey(profileKeyArray);

  const profileKeyVersion = profileKey.getProfileKeyVersion(uuid);

  return profileKeyVersion.toString();
}

export function getClientZkProfileOperations(
  serverPublicParamsBase64: string
): ClientZkProfileOperations {
  const serverPublicParamsArray = base64ToCompatArray(serverPublicParamsBase64);
  const serverPublicParams = new ServerPublicParams(serverPublicParamsArray);

  return new ClientZkProfileOperations(serverPublicParams);
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

export function handleProfileKeyCredential(
  clientZkProfileCipher: ClientZkProfileOperations,
  context: ProfileKeyCredentialRequestContext,
  responseBase64: string
): string {
  const responseArray = base64ToCompatArray(responseBase64);
  const response = new ProfileKeyCredentialResponse(responseArray);
  const profileKeyCredential = clientZkProfileCipher.receiveProfileKeyCredential(
    context,
    response
  );

  const credentialArray = profileKeyCredential.serialize();

  return compatArrayToBase64(credentialArray);
}
