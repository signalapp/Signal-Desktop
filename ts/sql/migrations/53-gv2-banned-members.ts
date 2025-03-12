// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';
import { jsonToObject } from '../util';

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
    bannedMembersV2?: Array<string>;
  };

  type ConversationType = {
    id: string;
    groupId: string;
    bannedMembersV2?: Array<{ uuid: string; timestamp: number }>;
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
      .prepare(
        `
          SELECT json
          FROM conversations
          WHERE type = 'group'
          ORDER BY id ASC;
        `,
        { pluck: true }
      )
      .all<string>()
      .map(json => jsonToObject<ConversationType>(json));

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
