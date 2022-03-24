// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PublicKey, Fingerprint } from '@signalapp/libsignal-client';
import type { ConversationType } from '../state/ducks/conversations';
import { UUID } from '../types/UUID';

import { assert } from './assert';
import * as log from '../logging/log';

export async function generateSecurityNumber(
  ourNumber: string,
  ourKey: Uint8Array,
  theirNumber: string,
  theirKey: Uint8Array
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
  const { storage } = window.textsecure;
  const ourNumber = storage.user.getNumber();
  const ourUuid = storage.user.getCheckedUuid();

  const us = storage.protocol.getIdentityRecord(ourUuid);
  const ourKey = us ? us.publicKey : null;

  const theirUuid = UUID.lookup(contact.id);
  const them = theirUuid
    ? await storage.protocol.getOrMigrateIdentityRecord(theirUuid)
    : undefined;
  const theirKey = them?.publicKey;

  if (!ourKey) {
    throw new Error('Could not load our key');
  }

  if (!theirKey) {
    throw new Error('Could not load their key');
  }

  if (!contact.e164) {
    log.error(
      'generateSecurityNumberBlock: Attempted to generate security number for contact with no e164'
    );
    return [];
  }

  assert(ourNumber, 'Should have our number');
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
