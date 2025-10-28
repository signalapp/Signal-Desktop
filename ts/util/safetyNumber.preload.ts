// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PublicKey, Fingerprint } from '@signalapp/libsignal-client';
import type { ConversationType } from '../state/ducks/conversations.preload.js';

import { assertDev } from './assert.std.js';
import { uuidToBytes } from './uuidToBytes.std.js';
import { createLogger } from '../logging/log.std.js';
import type { SafetyNumberType } from '../types/safetyNumber.std.js';
import { signalProtocolStore } from '../SignalProtocolStore.preload.js';
import { isAciString } from './isAciString.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('safetyNumber');

const ITERATION_COUNT = 5200;
const SERVICE_ID_VERSION = 2;

// Number of digits in a safety number block
const BLOCK_SIZE = 5;

export async function generateSafetyNumber(
  contact: ConversationType
): Promise<SafetyNumberType> {
  const logId = `generateSafetyNumbers(${contact.id})`;
  log.info(`${logId}: starting`);

  const ourAci = itemStorage.user.getCheckedAci();

  const us = signalProtocolStore.getIdentityRecord(ourAci);
  const ourKeyBuffer = us ? us.publicKey : null;

  const theirAci = isAciString(contact.serviceId)
    ? contact.serviceId
    : undefined;
  const them = theirAci
    ? await signalProtocolStore.getOrMigrateIdentityRecord(theirAci)
    : undefined;
  const theirKeyBuffer = them?.publicKey;

  if (!ourKeyBuffer) {
    throw new Error('Could not load our key');
  }

  if (!theirKeyBuffer) {
    throw new Error('Could not load their key');
  }

  const ourKey = PublicKey.deserialize(ourKeyBuffer);
  const theirKey = PublicKey.deserialize(theirKeyBuffer);

  assertDev(theirAci, 'Should have their serviceId');
  const fingerprint = Fingerprint.new(
    ITERATION_COUNT,
    SERVICE_ID_VERSION,
    uuidToBytes(ourAci),
    ourKey,
    uuidToBytes(theirAci),
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
