// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallLinkRootKey } from '@signalapp/ringrtc';
import type { CallLinkStateType, CallLinkType } from '../../types/CallLink';
import {
  callLinkRestrictionsSchema,
  callLinkRecordSchema,
} from '../../types/CallLink';
import { toAdminKeyBytes } from '../../util/callLinks';
import {
  callLinkToRecord,
  callLinkFromRecord,
} from '../../util/callLinksRingrtc';
import type { ReadableDB, WritableDB } from '../Interface';
import { prepare } from '../Server';
import { sql } from '../util';
import { strictAssert } from '../../util/assert';
import { CallStatusValue } from '../../types/CallDisposition';

export function callLinkExists(db: ReadableDB, roomId: string): boolean {
  const [query, params] = sql`
    SELECT 1
    FROM callLinks
    WHERE roomId = ${roomId};
  `;
  return db.prepare(query).pluck(true).get(params) === 1;
}

export function getCallLinkByRoomId(
  db: ReadableDB,
  roomId: string
): CallLinkType | undefined {
  const row = prepare(db, 'SELECT * FROM callLinks WHERE roomId = $roomId').get(
    {
      roomId,
    }
  );

  if (!row) {
    return undefined;
  }

  return callLinkFromRecord(callLinkRecordSchema.parse(row));
}

export function getAllCallLinks(db: ReadableDB): ReadonlyArray<CallLinkType> {
  const [query] = sql`
    SELECT * FROM callLinks;
  `;
  return db
    .prepare(query)
    .all()
    .map(item => callLinkFromRecord(callLinkRecordSchema.parse(item)));
}

function _insertCallLink(db: WritableDB, callLink: CallLinkType): void {
  const { roomId, rootKey } = callLink;
  assertRoomIdMatchesRootKey(roomId, rootKey);

  const data = callLinkToRecord(callLink);
  prepare(
    db,
    `
    INSERT INTO callLinks (
      roomId,
      rootKey,
      adminKey,
      name,
      restrictions,
      revoked,
      expiration
    ) VALUES (
      $roomId,
      $rootKey,
      $adminKey,
      $name,
      $restrictions,
      $revoked,
      $expiration
    )
    `
  ).run(data);
}

export function insertCallLink(db: WritableDB, callLink: CallLinkType): void {
  _insertCallLink(db, callLink);
}

export function updateCallLinkState(
  db: WritableDB,
  roomId: string,
  callLinkState: CallLinkStateType
): CallLinkType {
  const { name, restrictions, expiration, revoked } = callLinkState;
  const restrictionsValue = callLinkRestrictionsSchema.parse(restrictions);
  const [query, params] = sql`
    UPDATE callLinks
    SET
      name = ${name},
      restrictions = ${restrictionsValue},
      expiration = ${expiration},
      revoked = ${revoked ? 1 : 0}
    WHERE roomId = ${roomId}
    RETURNING *;
  `;
  const row = db.prepare(query).get(params);
  strictAssert(row, 'Expected row to be returned');
  return callLinkFromRecord(callLinkRecordSchema.parse(row));
}

export function updateCallLinkAdminKeyByRoomId(
  db: WritableDB,
  roomId: string,
  adminKey: string
): void {
  const adminKeyBytes = toAdminKeyBytes(adminKey);
  prepare(
    db,
    `
    UPDATE callLinks
    SET adminKey = $adminKeyBytes
    WHERE roomId = $roomId;
    `
  ).run({ roomId, adminKeyBytes });
}

function assertRoomIdMatchesRootKey(roomId: string, rootKey: string): void {
  const derivedRoomId = CallLinkRootKey.parse(rootKey)
    .deriveRoomId()
    .toString('hex');
  strictAssert(
    roomId === derivedRoomId,
    'passed roomId must match roomId derived from root key'
  );
}

function deleteCallHistoryByRoomId(db: WritableDB, roomId: string) {
  const [
    markCallHistoryDeleteByPeerIdQuery,
    markCallHistoryDeleteByPeerIdParams,
  ] = sql`
    UPDATE callsHistory
    SET
      status = ${CallStatusValue.Deleted},
      timestamp = ${Date.now()}
    WHERE peerId = ${roomId}
  `;

  db.prepare(markCallHistoryDeleteByPeerIdQuery).run(
    markCallHistoryDeleteByPeerIdParams
  );
}

// This should only be called from a sync message to avoid accidentally deleting
// on the client but not the server
export function deleteCallLinkFromSync(db: WritableDB, roomId: string): void {
  db.transaction(() => {
    const [query, params] = sql`
      DELETE FROM callLinks
      WHERE roomId = ${roomId};
    `;

    db.prepare(query).run(params);

    deleteCallHistoryByRoomId(db, roomId);
  })();
}

export function beginDeleteCallLink(db: WritableDB, roomId: string): void {
  db.transaction(() => {
    // If adminKey is null, then we should delete the call link
    const [deleteNonAdminCallLinksQuery, deleteNonAdminCallLinksParams] = sql`
      DELETE FROM callLinks
      WHERE adminKey IS NULL
      AND roomId = ${roomId};
    `;

    const result = db
      .prepare(deleteNonAdminCallLinksQuery)
      .run(deleteNonAdminCallLinksParams);

    // Skip this query if the call is already deleted
    if (result.changes === 0) {
      // If the admin key is not null, we should mark it for deletion
      const [markAdminCallLinksDeletedQuery, markAdminCallLinksDeletedParams] =
        sql`
          UPDATE callLinks
          SET deleted = 1
          WHERE adminKey IS NOT NULL
          AND roomId = ${roomId};
        `;

      db.prepare(markAdminCallLinksDeletedQuery).run(
        markAdminCallLinksDeletedParams
      );
    }

    deleteCallHistoryByRoomId(db, roomId);
  })();
}

export function beginDeleteAllCallLinks(db: WritableDB): void {
  db.transaction(() => {
    const [markAdminCallLinksDeletedQuery] = sql`
      UPDATE callLinks
      SET deleted = 1
      WHERE adminKey IS NOT NULL;
    `;

    db.prepare(markAdminCallLinksDeletedQuery).run();

    const [deleteNonAdminCallLinksQuery] = sql`
      DELETE FROM callLinks
      WHERE adminKey IS NULL;
    `;

    db.prepare(deleteNonAdminCallLinksQuery).run();
  })();
}

export function getAllMarkedDeletedCallLinks(
  db: ReadableDB
): ReadonlyArray<CallLinkType> {
  const [query] = sql`
    SELECT * FROM callLinks WHERE deleted = 1;
  `;
  return db
    .prepare(query)
    .all()
    .map(item => callLinkFromRecord(callLinkRecordSchema.parse(item)));
}

export function finalizeDeleteCallLink(db: WritableDB, roomId: string): void {
  const [query, params] = sql`
    DELETE FROM callLinks WHERE roomId = ${roomId} AND deleted = 1;
  `;
  db.prepare(query).run(params);
}

export function _removeAllCallLinks(db: WritableDB): void {
  const [query, params] = sql`
    DELETE FROM callLinks;
  `;
  db.prepare(query).run(params);
}
