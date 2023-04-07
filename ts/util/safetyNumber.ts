// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PublicKey, Fingerprint } from '@signalapp/libsignal-client';
import type { ConversationType } from '../state/ducks/conversations';
import { UUID } from '../types/UUID';

import { assertDev } from './assert';
import { missingCaseError } from './missingCaseError';
import * as log from '../logging/log';

function generateSecurityNumber(
  ourId: string,
  ourKey: Uint8Array,
  theirId: string,
  theirKey: Uint8Array
): string {
  const ourNumberBuf = Buffer.from(ourId);
  const ourKeyObj = PublicKey.deserialize(Buffer.from(ourKey));
  const theirNumberBuf = Buffer.from(theirId);
  const theirKeyObj = PublicKey.deserialize(Buffer.from(theirKey));

  const fingerprint = Fingerprint.new(
    5200,
    2,
    ourNumberBuf,
    ourKeyObj,
    theirNumberBuf,
    theirKeyObj
  );

  return fingerprint.displayableFingerprint().toString();
}

export enum SecurityNumberIdentifierType {
  UUIDIdentifier = 'UUIDIdentifier',
  E164Identifier = 'E164Identifier',
}

export async function generateSecurityNumberBlock(
  contact: ConversationType,
  identifierType: SecurityNumberIdentifierType
): Promise<Array<string>> {
  const logId = `generateSecurityNumberBlock(${contact.id}, ${identifierType})`;
  log.info(`${logId}: starting`);

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

  let securityNumber: string;
  if (identifierType === SecurityNumberIdentifierType.E164Identifier) {
    if (!contact.e164) {
      log.error(
        `${logId}: Attempted to generate security number for contact with no e164`
      );
      return [];
    }

    assertDev(ourNumber, 'Should have our number');
    securityNumber = generateSecurityNumber(
      ourNumber,
      ourKey,
      contact.e164,
      theirKey
    );
  } else if (identifierType === SecurityNumberIdentifierType.UUIDIdentifier) {
    assertDev(theirUuid, 'Should have their uuid');
    securityNumber = generateSecurityNumber(
      ourUuid.toString(),
      ourKey,
      theirUuid.toString(),
      theirKey
    );
  } else {
    throw missingCaseError(identifierType);
  }

  const chunks = [];
  for (let i = 0; i < securityNumber.length; i += 5) {
    chunks.push(securityNumber.substring(i, i + 5));
  }

  return chunks;
}
