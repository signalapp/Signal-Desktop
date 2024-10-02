// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  GroupSendCombinedEndorsementRecord,
  GroupSendEndorsementsData,
  GroupSendMemberEndorsementRecord,
} from '../../types/GroupSendEndorsements';
import {
  groupSendEndorsementExpirationSchema,
  groupSendMemberEndorsementSchema,
  groupSendEndorsementsDataSchema,
} from '../../types/GroupSendEndorsements';
import { prepare } from '../Server';
import type { ReadableDB, WritableDB } from '../Interface';
import { sql } from '../util';
import type { AciString } from '../../types/ServiceId';
import { strictAssert } from '../../util/assert';
import { parseLoose, parseUnknown } from '../../util/schemas';

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
  prepare<Array<unknown>>(db, deleteCombined).run(deleteCombinedParams);
  prepare<Array<unknown>>(db, deleteMembers).run(deleteMembersParams);
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
  const result = prepare<Array<unknown>>(db, insertCombined).run(
    insertCombinedParams
  );
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
    const result = prepare<Array<unknown>>(db, replaceMember).run(
      replaceMemberParams
    );
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
  const value = prepare<Array<unknown>>(db, selectGroup)
    .pluck()
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

    const combinedEndorsement: unknown = prepare<Array<unknown>>(
      db,
      selectCombinedEndorsement
    ).get(selectCombinedEndorsementParams);

    if (combinedEndorsement == null) {
      return null;
    }

    const memberEndorsements: Array<unknown> = prepare<Array<unknown>>(
      db,
      selectMemberEndorsements
    ).all(selectMemberEndorsementsParams);

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
  const row = prepare<Array<unknown>>(db, selectMemberEndorsements).get(
    selectMemberEndorsementsParams
  );
  if (row == null) {
    return null;
  }
  return parseUnknown(groupSendMemberEndorsementSchema, row as unknown);
}
