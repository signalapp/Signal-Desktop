// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PublicKey, Fingerprint } from '@signalapp/libsignal-client';
import type { ConversationType } from '../state/ducks/conversations';

import { assertDev } from './assert';
import { uuidToBytes } from './uuidToBytes';
import * as log from '../logging/log';
import type { SafetyNumberType } from '../types/safetyNumber';
import { isAciString } from './isAciString';

const ITERATION_COUNT = 5200;
const SERVICE_ID_VERSION = 2;

// Number of digits in a safety number block
const BLOCK_SIZE = 5;

export async function generateSafetyNumber(
  contact: ConversationType
): Promise<SafetyNumberType> {
  const logId = `generateSafetyNumbers(${contact.id})`;
  log.info(`${logId}: starting`);

  const { storage } = window.textsecure;
  const ourAci = storage.user.getCheckedAci();

  const us = storage.protocol.getIdentityRecord(ourAci);
  const ourKeyBuffer = us ? us.publicKey : null;

  const theirAci = isAciString(contact.serviceId)
    ? contact.serviceId
    : undefined;
  const them = theirAci
    ? await storage.protocol.getOrMigrateIdentityRecord(theirAci)
    : undefined;
  const theirKeyBuffer = them?.publicKey;

  if (!ourKeyBuffer) {
    throw new Error('Could not load our key');
  }

  if (!theirKeyBuffer) {
    throw new Error('Could not load their key');
  }

  const ourKey = PublicKey.deserialize(Buffer.from(ourKeyBuffer));
  const theirKey = PublicKey.deserialize(Buffer.from(theirKeyBuffer));

  assertDev(theirAci, 'Should have their serviceId');
  const fingerprint = Fingerprint.new(
    ITERATION_COUNT,
    SERVICE_ID_VERSION,
    Buffer.from(uuidToBytes(ourAci)),
    ourKey,
    Buffer.from(uuidToBytes(theirAci)),
    theirKey
  );

  const securityNumber = fingerprint.displayableFingerprint().toString();

  const numberBlocks = [];
  for (let i = 0; i < securityNumber.length; i += BLOCK_SIZE) {
    numberBlocks.push(securityNumber.substring(i, i + BLOCK_SIZE));
  }

  const qrData = fingerprint.scannableFingerprint().toBuffer();

  return { numberBlocks, qrData };
}
