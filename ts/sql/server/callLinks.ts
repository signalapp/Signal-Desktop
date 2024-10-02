// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallLinkRootKey } from '@signalapp/ringrtc';
import type {
  CallLinkRecord,
  CallLinkStateType,
  CallLinkType,
} from '../../types/CallLink';
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
import { parseStrict, parseUnknown } from '../../util/schemas';

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
  const callLinkRecord = getCallLinkRecordByRoomId(db, roomId);
  if (!callLinkRecord) {
    return undefined;
  }

  return callLinkFromRecord(callLinkRecord);
}

// When you need to access all the fields (such as deleted and storage fields)
export function getCallLinkRecordByRoomId(
  db: ReadableDB,
  roomId: string
): CallLinkRecord | undefined {
  const row = prepare(db, 'SELECT * FROM callLinks WHERE roomId = $roomId').get(
    {
      roomId,
    }
  );

  if (!row) {
    return undefined;
  }

  return parseUnknown(callLinkRecordSchema, row as unknown);
}

export function getAllCallLinks(db: ReadableDB): ReadonlyArray<CallLinkType> {
  const [query] = sql`
    SELECT * FROM callLinks;
  `;
  return db
    .prepare(query)
    .all()
    .map((item: unknown) =>
      callLinkFromRecord(parseUnknown(callLinkRecordSchema, item))
    );
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
      expiration,
      storageID,
      storageVersion,
      storageUnknownFields,
      storageNeedsSync
    ) VALUES (
      $roomId,
      $rootKey,
      $adminKey,
      $name,
      $restrictions,
      $revoked,
      $expiration,
      $storageID,
      $storageVersion,
      $storageUnknownFields,
      $storageNeedsSync
    )
    `
  ).run(data);
}

export function insertCallLink(db: WritableDB, callLink: CallLinkType): void {
  _insertCallLink(db, callLink);
}

export function updateCallLink(db: WritableDB, callLink: CallLinkType): void {
  const { roomId, rootKey } = callLink;
  assertRoomIdMatchesRootKey(roomId, rootKey);

  const data = callLinkToRecord(callLink);
  // Do not write roomId or rootKey since they should never change
  db.prepare(
    `
    UPDATE callLinks
    SET
      adminKey = $adminKey,
      name = $name,
      restrictions = $restrictions,
      revoked = $revoked,
      expiration = $expiration,
      storageID = $storageID,
      storageVersion = $storageVersion,
      storageUnknownFields = $storageUnknownFields,
      storageNeedsSync = $storageNeedsSync
    WHERE roomId = $roomId
    `
  ).run(data);
}

export function updateCallLinkState(
  db: WritableDB,
  roomId: string,
  callLinkState: CallLinkStateType
): CallLinkType {
  const { name, restrictions, expiration, revoked } = callLinkState;
  const restrictionsValue = parseStrict(
    callLinkRestrictionsSchema,
    restrictions
  );
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
  const row: unknown = db.prepare(query).get(params);
  strictAssert(row, 'Expected row to be returned');
  return callLinkFromRecord(parseUnknown(callLinkRecordSchema, row));
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

export type DeleteCallLinkOptions = {
  storageNeedsSync: boolean;
  deletedAt?: number;
};

export function beginDeleteCallLink(
  db: WritableDB,
  roomId: string,
  options: DeleteCallLinkOptions
): void {
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
      const { storageNeedsSync } = options;
      const deletedAt = options.deletedAt ?? new Date().getTime();

      // If the admin key is not null, we should mark it for deletion
      const [markAdminCallLinksDeletedQuery, markAdminCallLinksDeletedParams] =
        sql`
          UPDATE callLinks
          SET
            deleted = 1,
            deletedAt = ${deletedAt},
            storageNeedsSync = ${storageNeedsSync ? 1 : 0}
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
  const deletedAt = new Date().getTime();
  db.transaction(() => {
    const [markAdminCallLinksDeletedQuery, markAdminCallLinksDeletedParams] =
      sql`
      UPDATE callLinks
      SET
        deleted = 1,
        deletedAt = ${deletedAt},
        storageNeedsSync = 1
      WHERE adminKey IS NOT NULL;
    `;

    db.prepare(markAdminCallLinksDeletedQuery).run(
      markAdminCallLinksDeletedParams
    );

    const [deleteNonAdminCallLinksQuery] = sql`
      DELETE FROM callLinks
      WHERE adminKey IS NULL;
    `;

    db.prepare(deleteNonAdminCallLinksQuery).run();
  })();
}

// When you need to access the deleted field
export function getAllCallLinkRecordsWithAdminKey(
  db: ReadableDB
): ReadonlyArray<CallLinkRecord> {
  const [query] = sql`
    SELECT * FROM callLinks
      WHERE adminKey IS NOT NULL
      AND rootKey IS NOT NULL;
  `;
  return db
    .prepare(query)
    .all()
    .map((item: unknown) => parseUnknown(callLinkRecordSchema, item));
}

export function getAllMarkedDeletedCallLinkRoomIds(
  db: ReadableDB
): ReadonlyArray<string> {
  const [query] = sql`
    SELECT roomId FROM callLinks WHERE deleted = 1;
  `;
  return db.prepare(query).pluck().all();
}

// TODO: Run this after uploading storage records, maybe periodically on startup
export function finalizeDeleteCallLink(db: WritableDB, roomId: string): void {
  const [query, params] = sql`
    DELETE FROM callLinks
      WHERE roomId = ${roomId}
      AND deleted = 1
      AND storageNeedsSync = 0;
  `;
  db.prepare(query).run(params);
}

export function _removeAllCallLinks(db: WritableDB): void {
  const [query, params] = sql`
    DELETE FROM callLinks;
  `;
  db.prepare(query).run(params);
}
