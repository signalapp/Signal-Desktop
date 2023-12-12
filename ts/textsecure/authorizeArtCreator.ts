// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { promisify } from 'util';

import { SignalService as Proto } from '../protobuf';
import { calculateAgreement, generateKeyPair } from '../Curve';
import { encryptAttachment, deriveSecrets } from '../Crypto';
import * as Bytes from '../Bytes';

const PROVISIONING_INFO = 'Art Service Provisioning Message';

export type AuthorizeArtCreatorOptionsType = Readonly<{
  token: string;
  pubKeyBase64: string;
}>;

export async function authorizeArtCreator({
  token,
  pubKeyBase64: theirPubKeyBase64,
}: AuthorizeArtCreatorOptionsType): Promise<void> {
  const { server } = window.textsecure;
  if (!server) {
    throw new Error('Server not ready');
  }

  const auth = await server.getArtAuth();

  const ourKeys = generateKeyPair();
  const theirPubKey = Bytes.fromBase64(theirPubKeyBase64);

  const secret = calculateAgreement(theirPubKey, ourKeys.privKey);
  const [aesKey, macKey] = deriveSecrets(
    secret,
    new Uint8Array(64),
    Bytes.fromString(PROVISIONING_INFO)
  );
  const keys = Bytes.concatenate([aesKey, macKey]);

  const { ciphertext } = encryptAttachment({
    plaintext: Proto.ArtProvisioningMessage.encode({
      ...auth,
    }).finish(),
    keys,
  });

  const envelope = Proto.ArtProvisioningEnvelope.encode({
    publicKey: ourKeys.pubKey,
    ciphertext,
  }).finish();

  const socket = await server.getArtProvisioningSocket(token);

  try {
    await promisify(socket.sendBytes).call(socket, Buffer.from(envelope));
  } finally {
    socket.close(1000, 'goodbye');
  }
}
