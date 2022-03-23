// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';
import type { UUIDStringType } from '../../types/UUID';
import { jsonToObject } from '../util';
import type { EmptyQuery } from '../util';
import type { ConversationType } from '../Interface';

export default function updateToSchemaVersion53(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 53) {
    return;
  }

  type LegacyConversationType = {
    id: string;
    groupId: string;
    bannedMembersV2?: Array<UUIDStringType>;
  };

  const updateConversationStmt = db.prepare(
    `
      UPDATE conversations SET
        json = json_patch(json, $jsonPatch)
      WHERE id = $id;
    `
  );

  const upgradeConversation = (convo: ConversationType): boolean => {
    const legacy = convo as unknown as LegacyConversationType;

    const logId = `(${legacy.id}) groupv2(${legacy.groupId})`;

    if (!legacy.bannedMembersV2?.length) {
      return false;
    }

    const jsonPatch: Pick<ConversationType, 'bannedMembersV2'> = {
      bannedMembersV2: legacy.bannedMembersV2.map(uuid => ({
        uuid,
        timestamp: 0,
      })),
    };

    logger.info(
      `updateToSchemaVersion53: Updating ${logId} with ` +
        `${legacy.bannedMembersV2.length} banned members`
    );

    updateConversationStmt.run({
      id: legacy.id,
      jsonPatch: JSON.stringify(jsonPatch),
    });

    return true;
  };

  db.transaction(() => {
    const allConversations = db
      .prepare<EmptyQuery>(
        `
          SELECT json, profileLastFetchedAt
          FROM conversations
          WHERE type = 'group'
          ORDER BY id ASC;
        `
      )
      .all()
      .map(({ json }) => jsonToObject<ConversationType>(json));

    logger.info(
      'updateToSchemaVersion53: About to iterate through ' +
        `${allConversations.length} conversations`
    );

    let updated = 0;
    for (const convo of allConversations) {
      updated += upgradeConversation(convo) ? 1 : 0;
    }

    logger.info(`updateToSchemaVersion53: Updated ${updated} conversations`);

    db.pragma('user_version = 53');
  })();
  logger.info('updateToSchemaVersion53: success!');
}
