// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallLinkRootKey } from '@signalapp/ringrtc';
import * as Bytes from '../../Bytes.std.ts';
import type {
  CallLinkRecord,
  CallLinkStateType,
  CallLinkType,
  DefunctCallLinkType,
} from '../../types/CallLink.std.ts';
import {
  callLinkRestrictionsSchema,
  callLinkRecordSchema,
  defunctCallLinkRecordSchema,
} from '../../types/CallLink.std.ts';
import { toAdminKeyBytes } from '../../util/callLinks.std.ts';
import {
  callLinkToRecord,
  callLinkFromRecord,
  defunctCallLinkToRecord,
  defunctCallLinkFromRecord,
} from '../../util/callLinksRingrtc.node.ts';
import type { ReadableDB, WritableDB } from '../Interface.std.ts';
import { sql } from '../util.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import {
  CallStatusValue,
  DirectCallStatus,
} from '../../types/CallDisposition.std.ts';
import { parseStrict, parseUnknown } from '../../util/schemas.std.ts';

export function callLinkExists(db: ReadableDB, roomId: string): boolean {
  const [query, params] = sql`
    SELECT 1
    FROM callLinks
    WHERE roomId = ${roomId};
  `;
  return (
    db
      .prepare(query, {
        pluck: true,
      })
      .get(params) === 1
  );
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
  const row = db.prepare('SELECT * FROM callLinks WHERE roomId = $roomId').get({
    roomId,
  });
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
  db.prepare(
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

export type InsertOrUpdateCallLinkFromSyncResult = Readonly<{
  callLink: CallLinkType;
  inserted: boolean;
  updated: boolean;
}>;

export function insertOrUpdateCallLinkFromSync(
  db: WritableDB,
  callLink: CallLinkType
): InsertOrUpdateCallLinkFromSyncResult {
  const { roomId, adminKey } = callLink;
  return db.transaction(() => {
    const existingCallLink = getCallLinkByRoomId(db, roomId);
    if (existingCallLink) {
      if (adminKey && adminKey !== existingCallLink.adminKey) {
        updateCallLinkAdminKeyByRoomId(db, roomId, adminKey);
        return {
          callLink: { ...existingCallLink, adminKey },
          inserted: false,
          updated: true,
        };
      }

      return {
        callLink: existingCallLink,
        inserted: false,
        updated: false,
      };
    }

    insertCallLink(db, callLink);
    return { callLink, inserted: true, updated: false };
  })();
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

function updateCallLinkAdminKeyByRoomId(
  db: WritableDB,
  roomId: string,
  adminKey: string
): void {
  const adminKeyBytes = toAdminKeyBytes(adminKey);
  db.prepare(
    `
     UPDATE callLinks
     SET adminKey = $adminKeyBytes
     WHERE roomId = $roomId;
     `
  ).run({ roomId, adminKeyBytes });
}

function assertRoomIdMatchesRootKey(roomId: string, rootKey: string): void {
  const parsedRoomId = CallLinkRootKey.parse(rootKey).deriveRoomId();
  const derivedRoomIdBytes: Uint8Array<ArrayBuffer> = parsedRoomId;
  const derivedRoomId = Bytes.toHex(derivedRoomIdBytes);
  strictAssert(
    roomId === derivedRoomId,
    'passed roomId must match roomId derived from root key'
  );
}

export function deleteCallHistoryByRoomId(
  db: WritableDB,
  roomId: string
): void {
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

/**
 * Deletes a non-admin call link from the local database, or if it's an admin call link,
 * then marks it for deletion and storage sync.
 *
 *  @returns boolean: True if storage sync is needed; False if not
 */
export function markCallLinkDeleted(
  db: WritableDB,
  roomId: string,
  deletedAt: number
): boolean {
  return db.transaction(() => {
    // If adminKey is null, then we should delete the call link
    const [deleteNonAdminCallLinksQuery, deleteNonAdminCallLinksParams] = sql`
      DELETE FROM callLinks
      WHERE (adminKey IS NULL AND storageID IS NULL)
      AND roomId = ${roomId};
    `;

    const result = db
      .prepare(deleteNonAdminCallLinksQuery)
      .run(deleteNonAdminCallLinksParams);

    // If we successfully deleted the call link, then it was a non-admin call link
    // and we're done
    if (result.changes !== 0) {
      return false;
    }

    // If the admin key is not null, we should mark it for deletion
    const [markAdminCallLinksDeletedQuery, markAdminCallLinksDeletedParams] =
      sql`
        UPDATE callLinks
        SET
          deleted = 1,
          deletedAt = ${deletedAt},
          storageNeedsSync = 1
        WHERE (adminKey IS NOT NULL OR storageID IS NOT NULL)
        AND deleted IS NOT 1
        AND roomId = ${roomId};
      `;

    const deleteAdminLinkResult = db
      .prepare(markAdminCallLinksDeletedQuery)
      .run(markAdminCallLinksDeletedParams);
    return deleteAdminLinkResult.changes > 0;
  })();
}

export function deleteCallLinkAndHistory(db: WritableDB, roomId: string): void {
  db.transaction(() => {
    const [deleteCallLinkQuery, deleteCallLinkParams] = sql`
      DELETE FROM callLinks
        WHERE roomId = ${roomId};
    `;
    db.prepare(deleteCallLinkQuery).run(deleteCallLinkParams);

    const [deleteCallHistoryQuery, clearCallHistoryParams] = sql`
      UPDATE callsHistory
      SET
        status = ${DirectCallStatus.Deleted},
        timestamp = ${Date.now()}
      WHERE peerId = ${roomId};
    `;
    db.prepare(deleteCallHistoryQuery).run(clearCallHistoryParams);
  })();
}

/**
 * Deletes all non-admin call link from the local database, and marks all admin call links
 * for deletion and storage sync.
 *
 *  @returns boolean: True if storage sync is needed; False if not
 */
export function markAllCallLinksDeleted(db: WritableDB): boolean {
  const deletedAt = new Date().getTime();
  return db.transaction(() => {
    const [markAdminCallLinksDeletedQuery, markAdminCallLinksDeletedParams] =
      sql`
        UPDATE callLinks
        SET
          deleted = 1,
          deletedAt = ${deletedAt},
          storageNeedsSync = 1
        WHERE (adminKey IS NOT NULL OR storageID IS NOT NULL)
        AND deleted IS NOT 1;
      `;

    const markAdminCallLinksDeletedResult = db
      .prepare(markAdminCallLinksDeletedQuery)
      .run(markAdminCallLinksDeletedParams);

    // We can delete these immediately because they were never synced to Storage Service
    const [deleteNonAdminCallLinksQuery] = sql`
      DELETE FROM callLinks
      WHERE (adminKey IS NULL AND storageID IS NULL);
    `;

    db.prepare(deleteNonAdminCallLinksQuery).run();

    // If admin call links were marked deleted, then storage will need sync
    return markAdminCallLinksDeletedResult.changes > 0;
  })();
}

// When you need to access the deleted field
export function getAllCallLinkRecordsForStorageService(
  db: ReadableDB
): ReadonlyArray<CallLinkRecord> {
  const [query] = sql`
    SELECT * FROM callLinks
    WHERE
      (adminKey IS NOT NULL OR storageID IS NOT NULL)
      AND rootKey IS NOT NULL;
  `;
  return db
    .prepare(query)
    .all()
    .map((item: unknown) => parseUnknown(callLinkRecordSchema, item));
}

export function getAllAdminCallLinks(
  db: ReadableDB
): ReadonlyArray<CallLinkType> {
  return getAllCallLinkRecordsForStorageService(db).map(
    (record: CallLinkRecord) => callLinkFromRecord(record)
  );
}

export function _removeAllCallLinks(db: WritableDB): void {
  const [query, params] = sql`
    DELETE FROM callLinks;
  `;
  db.prepare(query).run(params);
}

export function getAllDefunctCallLinksForStorageService(
  db: ReadableDB
): ReadonlyArray<DefunctCallLinkType> {
  const [query] = sql`
    SELECT *
    FROM defunctCallLinks
    WHERE (adminKey IS NOT NULL OR storageID IS NOT NULL);
  `;
  return db
    .prepare(query)
    .all()
    .map((item: unknown) =>
      defunctCallLinkFromRecord(parseUnknown(defunctCallLinkRecordSchema, item))
    );
}

export function getDefunctCallLinkByRoomId(
  db: ReadableDB,
  roomId: string
): DefunctCallLinkType | undefined {
  const [query, params] = sql`
    SELECT *
    FROM defunctCallLinks
    WHERE roomId = ${roomId}
  `;

  const item = db.prepare(query).get(params);
  if (!item) {
    return undefined;
  }

  return defunctCallLinkFromRecord(
    parseUnknown(defunctCallLinkRecordSchema, item as unknown)
  );
}

export function insertDefunctCallLink(
  db: WritableDB,
  defunctCallLink: DefunctCallLinkType
): void {
  const { roomId, rootKey } = defunctCallLink;
  assertRoomIdMatchesRootKey(roomId, rootKey);

  const data = defunctCallLinkToRecord(defunctCallLink);
  db.prepare(
    `
    INSERT INTO defunctCallLinks (
      roomId,
      rootKey,
      adminKey,
      addedAt,
      storageID,
      storageVersion,
      storageUnknownFields,
      storageNeedsSync
    ) VALUES (
      $roomId,
      $rootKey,
      $adminKey,
      $addedAt,
      $storageID,
      $storageVersion,
      $storageUnknownFields,
      $storageNeedsSync
    )
    ON CONFLICT (roomId) DO NOTHING;
    `
  ).run(data);
}

export function updateDefunctCallLink(
  db: WritableDB,
  defunctCallLink: DefunctCallLinkType
): void {
  const { roomId, rootKey } = defunctCallLink;
  assertRoomIdMatchesRootKey(roomId, rootKey);

  const data = defunctCallLinkToRecord(defunctCallLink);
  // Do not write roomId or rootKey since they should never change
  db.prepare(
    `
    UPDATE defunctCallLinks
    SET
      addedAt = $addedAt,
      storageID = $storageID,
      storageVersion = $storageVersion,
      storageUnknownFields = $storageUnknownFields,
      storageNeedsSync = $storageNeedsSync
    WHERE roomId = $roomId
    `
  ).run(data);
}

export function getTimestampOfOldestDefunctCallLink(
  db: ReadableDB
): { roomId: string; addedAt: number } | undefined {
  const [query, params] = sql`
    SELECT roomId, addedAt FROM defunctCallLinks
    ORDER BY addedAt ASC
    LIMIT 1
  `;
  return db.prepare(query).get(params);
}

// Note: this should only be used in unusual situations; defunct call links will expire
// normally based on addedAt
export function deleteDefunctCallLink(db: WritableDB, roomId: string): boolean {
  const [query, params] = sql`
    DELETE FROM defunctCallLinks
    WHERE roomId = ${roomId}
  `;
  const result = db.prepare(query).run(params);

  return result.changes > 0;
}

export function deleteExpiredDefunctCallLinks(
  db: WritableDB,
  messageQueueTime: number
): ReadonlyArray<string> {
  const before = Date.now() - messageQueueTime;
  const [query, params] = sql`
    DELETE FROM defunctCallLinks
    WHERE addedAt < ${before}
    RETURNING roomId
  `;
  return db.prepare(query, { pluck: true }).all<string>(params);
}

export function getTimestampOfOldestDeletedCallLink(
  db: ReadableDB
): { roomId: string; deletedAt: number } | undefined {
  const [query, params] = sql`
    SELECT roomId, deletedAt FROM callLinks
    WHERE deletedAt > 0
    ORDER BY deletedAt ASC
    LIMIT 1
  `;
  return db.prepare(query).get(params);
}

// Note: this should only be used in unusual situations; usually we want to mark deleted.
export function deleteCallLink(db: WritableDB, roomId: string): boolean {
  const [query, params] = sql`
    DELETE FROM callLinks
    WHERE roomId = ${roomId}
  `;
  const result = db.prepare(query).run(params);

  return result.changes > 0;
}

export function deleteExpiredCallLinks(
  db: WritableDB,
  messageQueueTime: number
): ReadonlyArray<string> {
  const before = Date.now() - messageQueueTime;
  const [query, params] = sql`
    DELETE FROM callLinks
    WHERE deletedAt > 0
      AND deletedAt < ${before}
    RETURNING roomId
  `;
  return db.prepare(query, { pluck: true }).all<string>(params);
}
