// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  GroupSendCombinedEndorsementRecord,
  GroupSendEndorsementsData,
  GroupSendMemberEndorsementRecord,
} from '../../types/GroupSendEndorsements.std.js';
import {
  groupSendEndorsementExpirationSchema,
  groupSendMemberEndorsementSchema,
  groupSendEndorsementsDataSchema,
} from '../../types/GroupSendEndorsements.std.js';
import type { ReadableDB, WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';
import type { AciString } from '../../types/ServiceId.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { parseLoose, parseUnknown } from '../../util/schemas.std.js';

/**
 * We don't need to store more than one endorsement per group or per member.
 */
export function replaceAllEndorsementsForGroup(
  db: WritableDB,
  data: GroupSendEndorsementsData
): void {
  db.transaction(() => {
    const { combinedEndorsement, memberEndorsements } = data;
    const { groupId } = combinedEndorsement;
    _deleteAllEndorsementsForGroup(db, groupId);
    _replaceCombinedEndorsement(db, combinedEndorsement);
    _replaceMemberEndorsements(db, memberEndorsements);
  })();
}

function _deleteAllEndorsementsForGroup(db: WritableDB, groupId: string): void {
  const [deleteCombined, deleteCombinedParams] = sql`
    DELETE FROM groupSendCombinedEndorsement
    WHERE groupId = ${groupId};
  `;
  const [deleteMembers, deleteMembersParams] = sql`
    DELETE FROM groupSendMemberEndorsement
    WHERE groupId IS ${groupId};
  `;
  db.prepare(deleteCombined).run(deleteCombinedParams);
  db.prepare(deleteMembers).run(deleteMembersParams);
}

function _replaceCombinedEndorsement(
  db: WritableDB,
  combinedEndorsement: GroupSendCombinedEndorsementRecord
): void {
  const { groupId, expiration, endorsement } = combinedEndorsement;
  const [insertCombined, insertCombinedParams] = sql`
    INSERT OR REPLACE INTO groupSendCombinedEndorsement
    (groupId, expiration, endorsement)
    VALUES (${groupId}, ${expiration}, ${endorsement});
  `;
  const result = db.prepare(insertCombined).run(insertCombinedParams);
  strictAssert(
    result.changes === 1,
    'Must update groupSendCombinedEndorsement'
  );
}

function _replaceMemberEndorsements(
  db: WritableDB,
  memberEndorsements: ReadonlyArray<GroupSendMemberEndorsementRecord>
) {
  for (const memberEndorsement of memberEndorsements) {
    const { groupId, memberAci, expiration, endorsement } = memberEndorsement;
    const [replaceMember, replaceMemberParams] = sql`
      INSERT OR REPLACE INTO groupSendMemberEndorsement
      (groupId, memberAci, expiration, endorsement)
      VALUES (${groupId}, ${memberAci}, ${expiration}, ${endorsement});
    `;
    const result = db.prepare(replaceMember).run(replaceMemberParams);
    strictAssert(
      result.changes === 1,
      'Must update groupSendMemberEndorsement'
    );
  }
}

export function deleteAllEndorsementsForGroup(
  db: WritableDB,
  groupId: string
): void {
  db.transaction(() => {
    _deleteAllEndorsementsForGroup(db, groupId);
  })();
}

export function getGroupSendCombinedEndorsementExpiration(
  db: ReadableDB,
  groupId: string
): number | null {
  const [selectGroup, selectGroupParams] = sql`
    SELECT expiration FROM groupSendCombinedEndorsement
    WHERE groupId IS ${groupId};
  `;
  const value = db
    .prepare(selectGroup, {
      pluck: true,
    })
    .get(selectGroupParams);
  if (value == null) {
    return null;
  }
  return parseUnknown(groupSendEndorsementExpirationSchema, value as unknown);
}

export function getGroupSendEndorsementsData(
  db: ReadableDB,
  groupId: string
): GroupSendEndorsementsData | null {
  return db.transaction(() => {
    const [selectCombinedEndorsement, selectCombinedEndorsementParams] = sql`
      SELECT * FROM groupSendCombinedEndorsement
      WHERE groupId IS ${groupId}
    `;

    const [selectMemberEndorsements, selectMemberEndorsementsParams] = sql`
      SELECT * FROM groupSendMemberEndorsement
      WHERE groupId IS ${groupId}
    `;

    const combinedEndorsement: unknown = db
      .prepare(selectCombinedEndorsement)
      .get(selectCombinedEndorsementParams);

    if (combinedEndorsement == null) {
      return null;
    }

    const memberEndorsements: Array<unknown> = db
      .prepare(selectMemberEndorsements)
      .all(selectMemberEndorsementsParams);

    return parseLoose(groupSendEndorsementsDataSchema, {
      combinedEndorsement,
      memberEndorsements,
    });
  })();
}

export function getGroupSendMemberEndorsement(
  db: ReadableDB,
  groupId: string,
  memberAci: AciString
): GroupSendMemberEndorsementRecord | null {
  const [selectMemberEndorsements, selectMemberEndorsementsParams] = sql`
    SELECT * FROM groupSendMemberEndorsement
    WHERE groupId IS ${groupId}
    AND memberAci IS ${memberAci}
  `;
  const row = db
    .prepare(selectMemberEndorsements)
    .get(selectMemberEndorsementsParams);
  if (row == null) {
    return null;
  }
  return parseUnknown(groupSendMemberEndorsementSchema, row as unknown);
}
