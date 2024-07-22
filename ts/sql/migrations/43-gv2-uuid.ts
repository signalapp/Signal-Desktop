// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';

import type { LoggerType } from '../../types/Logging';
import type { AciString, ServiceIdString } from '../../types/ServiceId';
import { normalizeAci } from '../../util/normalizeAci';
import { isNotNil } from '../../util/isNotNil';
import { assertDev } from '../../util/assert';
import {
  TableIterator,
  getCountFromTable,
  jsonToObject,
  objectToJSON,
} from '../util';
import type { EmptyQuery, Query } from '../util';
import type { WritableDB } from '../Interface';

type MessageType = Readonly<{
  id: string;
  sourceUuid: string;
  groupV2Change?: {
    from?: string;
    details: Array<{ type: string }>;
  };
  invitedGV2Members?: Array<{ uuid: string }>;
}>;

type ConversationType = Readonly<{
  id: string;
  members: Array<string>;
  membersV2: Array<{ uuid: string }>;
}>;

export default function updateToSchemaVersion43(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 43) {
    return;
  }

  type LegacyPendingMemberType = {
    addedByUserId?: string;
    conversationId: string;
  };

  type LegacyAdminApprovalType = {
    conversationId: string;
  };

  type LegacyConversationType = {
    id: string;
    groupId: string;
    membersV2?: Array<{
      conversationId: string;
    }>;
    pendingMembersV2?: Array<LegacyPendingMemberType>;
    pendingAdminApprovalV2?: Array<LegacyAdminApprovalType>;
  };

  const getConversationUuid = db
    .prepare<Query>(
      `
      SELECT uuid
      FROM
        conversations
      WHERE
        id = $conversationId
      `
    )
    .pluck();

  const updateConversationStmt = db.prepare(
    `
    UPDATE conversations SET
      json = $json,
      members = $members
    WHERE id = $id;
    `
  );

  const updateMessageStmt = db.prepare(
    `
    UPDATE messages SET
      json = $json,
      sourceUuid = $sourceUuid
    WHERE id = $id;
    `
  );

  const upgradeConversation = (convo: ConversationType) => {
    const legacy = convo as unknown as LegacyConversationType;
    let result = convo;

    const logId = `(${legacy.id}) groupv2(${legacy.groupId})`;

    const memberKeys: Array<keyof LegacyConversationType> = [
      'membersV2',
      'pendingMembersV2',
      'pendingAdminApprovalV2',
    ];
    for (const key of memberKeys) {
      const oldValue = legacy[key];
      if (!Array.isArray(oldValue)) {
        continue;
      }

      let addedByCount = 0;

      const newValue = oldValue
        .map(member => {
          const uuid: ServiceIdString = getConversationUuid.get({
            conversationId: member.conversationId,
          });
          if (!uuid) {
            logger.warn(
              `updateToSchemaVersion43: ${logId}.${key} UUID not found ` +
                `for ${member.conversationId}`
            );
            return undefined;
          }

          const updated = {
            ...omit(member, 'conversationId'),
            uuid,
          };

          // We previously stored our conversation
          if (!('addedByUserId' in member) || !member.addedByUserId) {
            return updated;
          }

          const addedByUserId: ServiceIdString | undefined =
            getConversationUuid.get({
              conversationId: member.addedByUserId,
            });

          if (!addedByUserId) {
            return updated;
          }

          addedByCount += 1;

          return {
            ...updated,
            addedByUserId,
          };
        })
        .filter(isNotNil);

      result = {
        ...result,
        [key]: newValue,
      };

      if (oldValue.length !== 0) {
        logger.info(
          `updateToSchemaVersion43: migrated ${oldValue.length} ${key} ` +
            `entries to ${newValue.length} for ${logId}`
        );
      }

      if (addedByCount > 0) {
        logger.info(
          `updateToSchemaVersion43: migrated ${addedByCount} addedByUserId ` +
            `in ${key} for ${logId}`
        );
      }
    }

    if (result === convo) {
      return;
    }

    let dbMembers: string | null;
    if (result.membersV2) {
      dbMembers = result.membersV2.map(item => item.uuid).join(' ');
    } else if (result.members) {
      dbMembers = result.members.join(' ');
    } else {
      dbMembers = null;
    }

    updateConversationStmt.run({
      id: result.id,
      json: objectToJSON(result),
      members: dbMembers,
    });
  };

  type LegacyMessageType = {
    id: string;
    groupV2Change?: {
      from: string;
      details: Array<
        (
          | {
              type:
                | 'member-add'
                | 'member-add-from-invite'
                | 'member-add-from-link'
                | 'member-add-from-admin-approval'
                | 'member-privilege'
                | 'member-remove'
                | 'pending-add-one'
                | 'pending-remove-one'
                | 'admin-approval-add-one'
                | 'admin-approval-remove-one';
              conversationId: string;
            }
          | {
              type: unknown;
              conversationId?: undefined;
            }
        ) &
          (
            | {
                type:
                  | 'member-add-from-invite'
                  | 'pending-remove-one'
                  | 'pending-remove-many'
                  | 'admin-approval-remove-one';
                inviter: string;
              }
            | {
                inviter?: undefined;
              }
          )
      >;
    };
    sourceUuid: string;
    invitedGV2Members?: Array<LegacyPendingMemberType>;
  };

  const upgradeMessage = (message: MessageType): boolean => {
    const { id, groupV2Change, sourceUuid, invitedGV2Members } =
      message as unknown as LegacyMessageType;
    let result = message;

    if (groupV2Change) {
      assertDev(result.groupV2Change, 'Pacify typescript');

      const from: AciString | undefined = getConversationUuid.get({
        conversationId: groupV2Change.from,
      });

      if (from) {
        result = {
          ...result,
          groupV2Change: {
            ...result.groupV2Change,
            from,
          },
        };
      } else {
        result = {
          ...result,
          groupV2Change: omit(result.groupV2Change, ['from']),
        };
      }

      let changedDetails = false;
      const details = groupV2Change.details
        .map((legacyDetail, i) => {
          const oldDetail = result.groupV2Change?.details[i];
          assertDev(oldDetail, 'Pacify typescript');
          let newDetail = oldDetail;

          for (const key of ['conversationId' as const, 'inviter' as const]) {
            const oldValue = legacyDetail[key];
            const newKey = key === 'conversationId' ? 'uuid' : key;

            if (oldValue === undefined) {
              continue;
            }
            changedDetails = true;

            const newValue: ServiceIdString | null = getConversationUuid.get({
              conversationId: oldValue,
            });
            if (key === 'inviter' && !newValue) {
              continue;
            }
            if (!newValue) {
              logger.warn(
                `updateToSchemaVersion43: ${id}.groupV2Change.details.${key} ` +
                  `UUID not found for ${oldValue}`
              );
              return undefined;
            }

            assertDev(
              newDetail.type === legacyDetail.type,
              'Pacify typescript'
            );
            newDetail = {
              ...omit(newDetail, key),
              [newKey]: newValue,
            };
          }

          return newDetail;
        })
        .filter(isNotNil);

      if (changedDetails) {
        result = {
          ...result,
          groupV2Change: {
            ...result.groupV2Change,
            details,
          },
        };
      }
    }

    if (sourceUuid) {
      const newValue: ServiceIdString | null = getConversationUuid.get({
        conversationId: sourceUuid,
      });

      if (newValue) {
        result = {
          ...result,
          sourceUuid: newValue,
        };
      }
    }

    if (invitedGV2Members) {
      const newMembers = invitedGV2Members
        .map(({ addedByUserId, conversationId }, i) => {
          const uuid: ServiceIdString | null = getConversationUuid.get({
            conversationId,
          });
          const oldMember =
            result.invitedGV2Members && result.invitedGV2Members[i];
          assertDev(oldMember !== undefined, 'Pacify typescript');

          if (!uuid) {
            logger.warn(
              `updateToSchemaVersion43: ${id}.invitedGV2Members UUID ` +
                `not found for ${conversationId}`
            );
            return undefined;
          }

          const newMember = {
            ...omit(oldMember, ['conversationId']),
            uuid,
          };

          if (!addedByUserId) {
            return newMember;
          }

          const newAddedBy: ServiceIdString | null = getConversationUuid.get({
            conversationId: addedByUserId,
          });
          if (!newAddedBy) {
            return newMember;
          }

          return {
            ...newMember,
            addedByUserId: normalizeAci(newAddedBy, 'migration-43'),
          };
        })
        .filter(isNotNil);

      result = {
        ...result,
        invitedGV2Members: newMembers,
      };
    }

    if (result === message) {
      return false;
    }

    updateMessageStmt.run({
      id: result.id,
      json: JSON.stringify(result),
      sourceUuid: result.sourceUuid ?? null,
    });

    return true;
  };

  db.transaction(() => {
    const allConversations = db
      .prepare<EmptyQuery>(
        `
      SELECT json, profileLastFetchedAt
      FROM conversations
      ORDER BY id ASC;
      `
      )
      .all()
      .map(({ json }) => jsonToObject<ConversationType>(json));

    logger.info(
      'updateToSchemaVersion43: About to iterate through ' +
        `${allConversations.length} conversations`
    );

    for (const convo of allConversations) {
      upgradeConversation(convo);
    }

    const messageCount = getCountFromTable(db, 'messages');
    logger.info(
      'updateToSchemaVersion43: About to iterate through ' +
        `${messageCount} messages`
    );

    let updatedCount = 0;
    for (const message of new TableIterator<MessageType>(db, 'messages')) {
      if (upgradeMessage(message)) {
        updatedCount += 1;
      }
    }

    logger.info(`updateToSchemaVersion43: Updated ${updatedCount} messages`);

    db.pragma('user_version = 43');
  })();
  logger.info('updateToSchemaVersion43: success!');
}
