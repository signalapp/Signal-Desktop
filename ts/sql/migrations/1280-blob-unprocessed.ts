// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { v7 as getGuid } from 'uuid';

import type { LoggerType } from '../../types/Logging';
import {
  normalizePni,
  normalizeServiceId,
  toTaggedPni,
  isUntaggedPniString,
} from '../../types/ServiceId';
import { SignalService as Proto } from '../../protobuf';
import { sql } from '../util';
import type { WritableDB } from '../Interface';
import { getOurUuid } from './41-uuid-keys';

export const version = 1280;

export function updateToSchemaVersion1280(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1280) {
    return;
  }

  db.transaction(() => {
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
        logger.warn(
          `updateToSchemaVersion1280: no aci, dropping ${rows.length} envelopes`
        );
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
        const decoded = Proto.Envelope.decode(Buffer.from(envelope, 'base64'));
        if (!decoded.content) {
          throw new Error('Missing envelope content');
        }

        const content = decrypted
          ? Buffer.from(decrypted, 'base64')
          : decoded.content;

        insertStmt.run({
          ...rest,
          id,
          type: decoded.type ?? Proto.Envelope.Type.UNKNOWN,
          content,
          isEncrypted: decrypted ? 0 : 1,
          timestamp: timestamp || Date.now(),
          attempts: attempts || 0,
          receivedAtCounter: receivedAtCounter || 0,
          urgent: urgent ? 1 : 0,
          story: story ? 1 : 0,
          serverGuid: serverGuid || getGuid(),
          serverTimestamp: serverTimestamp || 0,
          destinationServiceId: normalizeServiceId(
            decoded.destinationServiceId || ourAci,
            'Envelope.destinationServiceId'
          ),
          updatedPni: isUntaggedPniString(decoded.updatedPni)
            ? normalizePni(
                toTaggedPni(decoded.updatedPni),
                'Envelope.updatedPni'
              )
            : undefined,
          // Sadly not captured previously
          messageAgeSec: 0,
          reportingToken: decoded.reportSpamToken?.length
            ? decoded.reportSpamToken
            : null,
        });
      } catch (error) {
        logger.warn(
          'updateToSchemaVersion1280: failed to migrate unprocessed',
          id,
          error
        );
      }
    }

    if (oldEnvelopes !== 0) {
      logger.warn(
        `updateToSchemaVersion1280: dropped ${oldEnvelopes} envelopes`
      );
    }

    db.pragma('user_version = 1280');
  })();

  logger.info('updateToSchemaVersion1280: success!');
}
