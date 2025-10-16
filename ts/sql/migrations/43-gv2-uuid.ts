// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import type { LoggerType } from '../../types/Logging.std.js';
import type { AciString, ServiceIdString } from '../../types/ServiceId.std.js';
import { normalizeAci } from '../../util/normalizeAci.std.js';
import { isNotNil } from '../../util/isNotNil.std.js';
import { assertDev } from '../../util/assert.std.js';
import {
  TableIterator,
  getCountFromTable,
  jsonToObject,
  objectToJSON,
} from '../util.std.js';
import type { WritableDB } from '../Interface.std.js';

const { omit } = lodash;

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
  db: WritableDB,
  logger: LoggerType
): void {
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

  const getConversationUuid = db.prepare(
    `
  SELECT uuid
  FROM
    conversations
  WHERE
    id = $conversationId
  `,
    {
      pluck: true,
    }
  );

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
          const uuid = getConversationUuid.get<ServiceIdString>({
            conversationId: member.conversationId,
          });
          if (!uuid) {
            logger.warn(
              `${logId}.${key} UUID not found for ${member.conversationId}`
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
          `migrated ${oldValue.length} ${key} ` +
            `entries to ${newValue.length} for ${logId}`
        );
      }

      if (addedByCount > 0) {
        logger.info(
          `migrated ${addedByCount} addedByUserId in ${key} for ${logId}`
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

            const newValue = getConversationUuid.get<ServiceIdString>({
              conversationId: oldValue,
            });
            if (key === 'inviter' && !newValue) {
              continue;
            }
            if (!newValue) {
              logger.warn(
                `${id}.groupV2Change.details.${key} ` +
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
      const newValue = getConversationUuid.get<ServiceIdString>({
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
          const uuid = getConversationUuid.get<ServiceIdString>({
            conversationId,
          });
          const oldMember =
            result.invitedGV2Members && result.invitedGV2Members[i];
          assertDev(oldMember !== undefined, 'Pacify typescript');

          if (!uuid) {
            logger.warn(
              `${id}.invitedGV2Members UUID ` +
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

          const newAddedBy = getConversationUuid.get<ServiceIdString>({
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

  const allConversations = db
    .prepare(
      `
    SELECT json
    FROM conversations
    ORDER BY id ASC;
    `,
      { pluck: true }
    )
    .all<string>()
    .map(json => jsonToObject<ConversationType>(json));

  logger.info(
    `About to iterate through ${allConversations.length} conversations`
  );

  for (const convo of allConversations) {
    upgradeConversation(convo);
  }

  const messageCount = getCountFromTable(db, 'messages');
  logger.info(`About to iterate through ${messageCount} messages`);

  let updatedCount = 0;
  for (const message of new TableIterator<MessageType>(db, 'messages')) {
    if (upgradeMessage(message)) {
      updatedCount += 1;
    }
  }

  logger.info(`Updated ${updatedCount} messages`);
}
