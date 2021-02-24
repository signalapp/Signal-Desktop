// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PublicKey, Fingerprint } from 'libsignal-client';
import { ConversationType } from '../state/ducks/conversations';

export async function generateSecurityNumber(
  ourNumber: string,
  ourKey: ArrayBuffer,
  theirNumber: string,
  theirKey: ArrayBuffer
): Promise<string> {
  const ourNumberBuf = Buffer.from(ourNumber);
  const ourKeyObj = PublicKey.deserialize(Buffer.from(ourKey));
  const theirNumberBuf = Buffer.from(theirNumber);
  const theirKeyObj = PublicKey.deserialize(Buffer.from(theirKey));

  const fingerprint = Fingerprint.new(
    5200,
    2,
    ourNumberBuf,
    ourKeyObj,
    theirNumberBuf,
    theirKeyObj
  );

  const fingerprintString = fingerprint.displayableFingerprint().toString();
  return Promise.resolve(fingerprintString);
}

export async function generateSecurityNumberBlock(
  contact: ConversationType
): Promise<Array<string>> {
  const ourNumber = window.textsecure.storage.user.getNumber();
  const ourUuid = window.textsecure.storage.user.getUuid();

  const us = window.textsecure.storage.protocol.getIdentityRecord(
    ourUuid || ourNumber
  );
  const ourKey = us ? us.publicKey : null;

  const them = window.textsecure.storage.protocol.getIdentityRecord(contact.id);
  const theirKey = them ? them.publicKey : null;

  if (!ourKey) {
    throw new Error('Could not load our key');
  }

  if (!theirKey) {
    throw new Error('Could not load their key');
  }

  if (!contact.e164) {
    window.log.error(
      'generateSecurityNumberBlock: Attempted to generate security number for contact with no e164'
    );
    return [];
  }

  const securityNumber = await generateSecurityNumber(
    ourNumber,
    ourKey,
    contact.e164,
    theirKey
  );

  const chunks = [];
  for (let i = 0; i < securityNumber.length; i += 5) {
    chunks.push(securityNumber.substring(i, i + 5));
  }

  return chunks;
}
