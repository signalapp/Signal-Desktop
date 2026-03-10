// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { LoggerType } from '../../types/Logging.std.js';
import { isAciString } from '../../util/isAciString.std.js';
import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

type Pin = Readonly<{
  pinMessageId: string;
  targetAuthorAci: string | null;
  targetSentTimestamp: number | null;
}>;

function getAllPins(db: WritableDB): ReadonlyArray<Pin> {
  const [query, params] = sql`
    SELECT
      pin.id AS pinMessageId,
      target.sourceServiceId AS targetAuthorAci,
      target.sent_at AS targetSentTimestamp
    FROM messages AS pin
    LEFT JOIN messages AS target
      ON pin.json ->> '$.pinnedMessageId' = target.id
    WHERE pin.type IS 'pinned-message-notification'
  `;
  return db.prepare(query).all<Pin>(params);
}

function getReasonCannotUpdate(pin: Pin): string | null {
  if (pin.targetSentTimestamp == null) {
    return 'target message not found';
  }
  if (pin.targetAuthorAci == null) {
    return 'target message missing sourceServiceId';
  }
  if (!isAciString(pin.targetAuthorAci)) {
    return 'target message sourceServiceId is not aci';
  }
  return null;
}

function updatePin(db: WritableDB, pin: Pin): void {
  const [query, params] = sql`
    UPDATE messages
    SET json = json_patch(json, ${JSON.stringify({
      pinnedMessageId: null,
      pinMessage: {
        targetAuthorAci: pin.targetAuthorAci,
        targetSentTimestamp: pin.targetSentTimestamp,
      },
    })})
    WHERE id = ${pin.pinMessageId};
  `;
  db.prepare(query).run(params);
}

function deletePin(db: WritableDB, pin: Pin) {
  const [query, params] = sql`
    DELETE FROM messages
    WHERE id = ${pin.pinMessageId};
  `;
  db.prepare(query).run(params);
}

export default function updateToSchemaVersion1630(
  db: WritableDB,
  logger: LoggerType
): void {
  for (const pin of getAllPins(db)) {
    const reason = getReasonCannotUpdate(pin);
    if (reason == null) {
      updatePin(db, pin);
    } else {
      deletePin(db, pin);
      logger.warn(
        `Dropped pin message ${pin.pinMessageId} (reason: ${reason})`
      );
    }
  }
}
