// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { v7 as getGuid } from 'uuid';

import type { LoggerType } from '../../types/Logging.std.js';
import {
  normalizePni,
  normalizeServiceId,
  toTaggedPni,
  isUntaggedPniString,
} from '../../types/ServiceId.std.js';
import { Migrations as Proto } from '../../protobuf/index.std.js';
import { sql } from '../util.std.js';
import type { WritableDB } from '../Interface.std.js';
import { getOurUuid } from './41-uuid-keys.std.js';

export default function updateToSchemaVersion1280(
  db: WritableDB,
  logger: LoggerType
): void {
  const ourAci = getOurUuid(db);

  let rows = db.prepare('SELECT * FROM unprocessed').all();

  const [query] = sql`
    DROP TABLE unprocessed;

    CREATE TABLE unprocessed(
      id TEXT NOT NULL PRIMARY KEY ASC,
      type INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      attempts INTEGER NOT NULL,
      receivedAtCounter INTEGER NOT NULL,
      urgent INTEGER NOT NULL,
      story INTEGER NOT NULL,
      serverGuid TEXT NOT NULL,
      serverTimestamp INTEGER NOT NULL,
      isEncrypted INTEGER NOT NULL,
      content BLOB NOT NULL,
      messageAgeSec INTEGER NOT NULL,
      destinationServiceId TEXT NOT NULL,

      -- Not present for 1:1 messages and not sealed messages
      groupId TEXT,

      -- Not present for sealed envelopes
      reportingToken BLOB,
      source TEXT,
      sourceServiceId TEXT,
      sourceDevice TEXT,

      -- Present only for PNP change number
      updatedPni TEXT
    ) STRICT;

    CREATE INDEX unprocessed_timestamp ON unprocessed
      (timestamp);

    CREATE INDEX unprocessed_byReceivedAtCounter ON unprocessed
      (receivedAtCounter);
  `;
  db.exec(query);

  const insertStmt = db.prepare(`
    INSERT INTO unprocessed
      (id, type, timestamp, attempts, receivedAtCounter, urgent, story,
       serverGuid, serverTimestamp, isEncrypted, content, source,
       messageAgeSec, sourceServiceId, sourceDevice,
       destinationServiceId, reportingToken)
    VALUES
      ($id, $type, $timestamp, $attempts, $receivedAtCounter, $urgent, $story,
       $serverGuid, $serverTimestamp, $isEncrypted, $content, $source,
       $messageAgeSec, $sourceServiceId, $sourceDevice,
       $destinationServiceId, $reportingToken);
  `);

  let oldEnvelopes = 0;

  if (!ourAci) {
    if (rows.length) {
      logger.warn(`no aci, dropping ${rows.length} envelopes`);
      rows = [];
    }
  }

  for (const row of rows) {
    const {
      id,
      envelope,
      decrypted,
      timestamp,
      attempts,
      version: envelopeVersion,
      receivedAtCounter,
      urgent,
      story,
      serverGuid,
      serverTimestamp,
      ...rest
    } = row;

    // Skip old and/or invalid rows
    if (envelopeVersion !== 2 || !envelope) {
      oldEnvelopes += 1;
      continue;
    }

    try {
      const decoded = Proto.Envelope.decode(
        Buffer.from(String(envelope), 'base64')
      );
      if (!decoded.content) {
        throw new Error('Missing envelope content');
      }

      const content = decrypted
        ? Buffer.from(String(decrypted), 'base64')
        : decoded.content;

      insertStmt.run({
        ...rest,
        id,
        type: decoded.type ?? Proto.Envelope.Type.UNKNOWN,
        content: content ?? null,
        isEncrypted: decrypted ? 0 : 1,
        timestamp: timestamp || Date.now(),
        attempts: attempts || 0,
        receivedAtCounter: receivedAtCounter || 0,
        urgent: urgent ? 1 : 0,
        story: story ? 1 : 0,
        serverGuid: serverGuid || getGuid(),
        serverTimestamp: serverTimestamp || 0,
        destinationServiceId:
          normalizeServiceId(
            decoded.destinationServiceId || ourAci,
            'Envelope.destinationServiceId'
          ) ?? null,
        updatedPni: isUntaggedPniString(decoded.updatedPni)
          ? normalizePni(toTaggedPni(decoded.updatedPni), 'Envelope.updatedPni')
          : null,
        // Sadly not captured previously
        messageAgeSec: 0,
        reportingToken: decoded.reportSpamToken?.length
          ? decoded.reportSpamToken
          : null,
      });
    } catch (error) {
      logger.warn('failed to migrate unprocessed', id, error);
    }
  }

  if (oldEnvelopes !== 0) {
    logger.warn(`dropped ${oldEnvelopes} envelopes`);
  }
}
