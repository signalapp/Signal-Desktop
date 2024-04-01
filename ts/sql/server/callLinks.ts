// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';
import { CallLinkRootKey } from '@signalapp/ringrtc';
import type { CallLinkRestrictions, CallLinkType } from '../../types/CallLink';
import {
  callLinkRestrictionsSchema,
  callLinkRecordSchema,
} from '../../types/CallLink';
import { callLinkToRecord, callLinkFromRecord } from '../../util/callLinks';
import { getReadonlyInstance, getWritableInstance, prepare } from '../Server';
import { sql } from '../util';
import { strictAssert } from '../../util/assert';

export async function callLinkExists(roomId: string): Promise<boolean> {
  const db = getReadonlyInstance();
  const [query, params] = sql`
    SELECT 1
    FROM callLinks
    WHERE roomId = ${roomId};
  `;
  return db.prepare(query).pluck(true).get(params) === 1;
}

export async function getAllCallLinks(): Promise<ReadonlyArray<CallLinkType>> {
  const db = getReadonlyInstance();
  const [query] = sql`
    SELECT * FROM callLinks;
  `;
  return db
    .prepare(query)
    .all()
    .map(item => callLinkFromRecord(callLinkRecordSchema.parse(item)));
}

function _insertCallLink(db: Database, callLink: CallLinkType): void {
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

export async function insertCallLink(callLink: CallLinkType): Promise<void> {
  const db = await getWritableInstance();
  _insertCallLink(db, callLink);
}

export async function updateCallLinkState(
  roomId: string,
  name: string,
  restrictions: CallLinkRestrictions,
  expiration: number,
  revoked: boolean
): Promise<void> {
  const db = await getWritableInstance();
  const restrictionsValue = callLinkRestrictionsSchema.parse(restrictions);
  const [query, params] = sql`
    UPDATE callLinks
    SET
      name = ${name},
      restrictions = ${restrictionsValue},
      expiration = ${expiration},
      revoked = ${revoked ? 1 : 0}
    WHERE roomId = ${roomId};
  `;
  db.prepare(query).run(params);
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
