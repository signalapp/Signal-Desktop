// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  GroupSendCombinedEndorsementRecord,
  GroupSendEndorsementsData,
  GroupSendMemberEndorsementRecord,
} from '../../types/GroupSendEndorsements';
import { groupSendEndorsementExpirationSchema } from '../../types/GroupSendEndorsements';
import { prepare } from '../Server';
import type { ReadableDB, WritableDB } from '../Interface';
import { sql } from '../util';

/**
 * We don't need to store more than one endorsement per group or per member.
 */
export function replaceAllEndorsementsForGroup(
  db: WritableDB,
  data: GroupSendEndorsementsData
): void {
  db.transaction(() => {
    const { combinedEndorsement, memberEndorsements } = data;
    _replaceCombinedEndorsement(db, combinedEndorsement);
    _replaceMemberEndorsements(db, memberEndorsements);
  })();
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
  prepare<Array<unknown>>(db, insertCombined).run(insertCombinedParams);
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
    prepare<Array<unknown>>(db, replaceMember).run(replaceMemberParams);
  }
}

export function deleteAllEndorsementsForGroup(
  db: WritableDB,
  groupId: string
): void {
  db.transaction(() => {
    const [deleteCombined, deleteCombinedParams] = sql`
      DELETE FROM groupSendCombinedEndorsement
      WHERE groupId = ${groupId};
    `;
    const [deleteMembers, deleteMembersParams] = sql`
      DELETE FROM groupSendMemberEndorsement
      WHERE groupId = ${groupId};
    `;
    prepare<Array<unknown>>(db, deleteCombined).run(deleteCombinedParams);
    prepare<Array<unknown>>(db, deleteMembers).run(deleteMembersParams);
  })();
}

export function getGroupSendCombinedEndorsementExpiration(
  db: ReadableDB,
  groupId: string
): number | null {
  const [selectGroup, selectGroupParams] = sql`
    SELECT expiration FROM groupSendCombinedEndorsement
    WHERE groupId = ${groupId};
  `;
  const value = prepare<Array<unknown>>(db, selectGroup)
    .pluck()
    .get(selectGroupParams);
  if (value == null) {
    return null;
  }
  return groupSendEndorsementExpirationSchema.parse(value);
}
