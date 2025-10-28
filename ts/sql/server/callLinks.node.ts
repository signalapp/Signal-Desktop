// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallLinkRootKey } from '@signalapp/ringrtc';
import * as Bytes from '../../Bytes.std.js';
import type {
  CallLinkRecord,
  CallLinkStateType,
  CallLinkType,
  DefunctCallLinkType,
} from '../../types/CallLink.std.js';
import {
  callLinkRestrictionsSchema,
  callLinkRecordSchema,
  defunctCallLinkRecordSchema,
} from '../../types/CallLink.std.js';
import { toAdminKeyBytes } from '../../util/callLinks.std.js';
import {
  callLinkToRecord,
  callLinkFromRecord,
  defunctCallLinkToRecord,
  defunctCallLinkFromRecord,
  toEpochBytes,
} from '../../util/callLinksRingrtc.node.js';
import type { ReadableDB, WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';
import { strictAssert } from '../../util/assert.std.js';
import {
  CallStatusValue,
  DirectCallStatus,
} from '../../types/CallDisposition.std.js';
import { parseStrict, parseUnknown } from '../../util/schemas.std.js';

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
      epoch,
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
      $epoch,
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
  const { roomId, epoch, adminKey } = callLink;
  return db.transaction(() => {
    const existingCallLink = getCallLinkByRoomId(db, roomId);
    if (existingCallLink) {
      if (
        (adminKey && adminKey !== existingCallLink.adminKey) ||
        epoch !== existingCallLink.epoch
      ) {
        updateCallLinkEpochAndAdminKeyByRoomId(db, roomId, epoch, adminKey);
        return {
          callLink: { ...existingCallLink, adminKey, epoch },
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
      epoch = $epoch,
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

export function updateCallLinkStateAndEpoch(
  db: WritableDB,
  roomId: string,
  callLinkState: CallLinkStateType,
  epoch: string | null
): CallLinkType {
  const { name, restrictions, expiration, revoked } = callLinkState;
  const restrictionsValue = parseStrict(
    callLinkRestrictionsSchema,
    restrictions
  );
  const epochBytes = epoch ? toEpochBytes(epoch) : null;
  const [query, params] = sql`
    UPDATE callLinks
    SET
      name = ${name},
      epoch = ${epochBytes},
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

export function updateCallLinkEpochAndAdminKeyByRoomId(
  db: WritableDB,
  roomId: string,
  epoch: string | null,
  adminKey: string | null
): void {
  const epochBytes = epoch ? toEpochBytes(epoch) : null;
  if (adminKey) {
    const adminKeyBytes = toAdminKeyBytes(adminKey);
    db.prepare(
      `
      UPDATE callLinks
      SET adminKey = $adminKeyBytes, epoch = $epochBytes
      WHERE roomId = $roomId;
      `
    ).run({ roomId, epochBytes, adminKeyBytes });
  } else {
    db.prepare(
      `
      UPDATE callLinks
      SET epoch = $epochBytes
      WHERE roomId = $roomId;
      `
    ).run({ roomId, epochBytes });
  }
}

function assertRoomIdMatchesRootKey(roomId: string, rootKey: string): void {
  const derivedRoomId = Bytes.toHex(
    CallLinkRootKey.parse(rootKey).deriveRoomId()
  );
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

/**
 * Deletes a non-admin call link from the local database, or if it's an admin call link,
 * then marks it for deletion and storage sync.
 *
 *  @returns boolean: True if storage sync is needed; False if not
 */
export function beginDeleteCallLink(db: WritableDB, roomId: string): boolean {
  return db.transaction(() => {
    // If adminKey is null, then we should delete the call link
    const [deleteNonAdminCallLinksQuery, deleteNonAdminCallLinksParams] = sql`
      DELETE FROM callLinks
      WHERE adminKey IS NULL
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

    const deletedAt = new Date().getTime();

    // If the admin key is not null, we should mark it for deletion
    const [markAdminCallLinksDeletedQuery, markAdminCallLinksDeletedParams] =
      sql`
        UPDATE callLinks
        SET
          deleted = 1,
          deletedAt = ${deletedAt},
          storageNeedsSync = 1
        WHERE adminKey IS NOT NULL
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
export function beginDeleteAllCallLinks(db: WritableDB): boolean {
  const deletedAt = new Date().getTime();
  return db.transaction(() => {
    const [markAdminCallLinksDeletedQuery, markAdminCallLinksDeletedParams] =
      sql`
      UPDATE callLinks
      SET
        deleted = 1,
        deletedAt = ${deletedAt},
        storageNeedsSync = 1
      WHERE adminKey IS NOT NULL
      AND deleted IS NOT 1;
    `;

    const markAdminCallLinksDeletedResult = db
      .prepare(markAdminCallLinksDeletedQuery)
      .run(markAdminCallLinksDeletedParams);

    const [deleteNonAdminCallLinksQuery] = sql`
      DELETE FROM callLinks
      WHERE adminKey IS NULL;
    `;

    db.prepare(deleteNonAdminCallLinksQuery).run();

    // If admin call links were marked deleted, then storage will need sync
    return markAdminCallLinksDeletedResult.changes > 0;
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

export function getAllAdminCallLinks(
  db: ReadableDB
): ReadonlyArray<CallLinkType> {
  return getAllCallLinkRecordsWithAdminKey(db).map((record: CallLinkRecord) =>
    callLinkFromRecord(record)
  );
}

export function getAllMarkedDeletedCallLinkRoomIds(
  db: ReadableDB
): ReadonlyArray<string> {
  const [query] = sql`
    SELECT roomId FROM callLinks WHERE deleted = 1;
  `;
  return db
    .prepare(query, {
      pluck: true,
    })
    .all();
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

export function defunctCallLinkExists(db: ReadableDB, roomId: string): boolean {
  const [query, params] = sql`
    SELECT 1
    FROM defunctCallLinks
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

export function getAllDefunctCallLinksWithAdminKey(
  db: ReadableDB
): ReadonlyArray<DefunctCallLinkType> {
  const [query] = sql`
    SELECT *
    FROM defunctCallLinks
    WHERE adminKey IS NOT NULL;
  `;
  return db
    .prepare(query)
    .all()
    .map((item: unknown) =>
      defunctCallLinkFromRecord(parseUnknown(defunctCallLinkRecordSchema, item))
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
      epoch,
      adminKey,
      storageID,
      storageVersion,
      storageUnknownFields,
      storageNeedsSync
    ) VALUES (
      $roomId,
      $rootKey,
      $epoch,
      $adminKey,
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
    UPDATE callLinks
    SET
      storageID = $storageID,
      storageVersion = $storageVersion,
      storageUnknownFields = $storageUnknownFields,
      storageNeedsSync = $storageNeedsSync
    WHERE roomId = $roomId
    `
  ).run(data);
}
