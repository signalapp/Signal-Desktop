// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';
import type {
  GroupSendCombinedEndorsementRecord,
  GroupSendEndorsementsData,
  GroupSendMemberEndorsementRecord,
} from '../../types/GroupSendEndorsements';
import { groupSendEndorsementExpirationSchema } from '../../types/GroupSendEndorsements';
import { getReadonlyInstance, getWritableInstance, prepare } from '../Server';
import { sql } from '../util';

/**
 * We don't need to store more than one endorsement per group or per member.
 */
export async function replaceAllEndorsementsForGroup(
  data: GroupSendEndorsementsData
): Promise<void> {
  const db = await getWritableInstance();
  db.transaction(() => {
    const { combinedEndorsement, memberEndorsements } = data;
    _replaceCombinedEndorsement(db, combinedEndorsement);
    _replaceMemberEndorsements(db, memberEndorsements);
  })();
}

function _replaceCombinedEndorsement(
  db: Database,
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
  db: Database,
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

export async function deleteAllEndorsementsForGroup(
  groupId: string
): Promise<void> {
  const db = await getWritableInstance();
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

export async function getGroupSendCombinedEndorsementExpiration(
  groupId: string
): Promise<number | null> {
  const db = getReadonlyInstance();
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
