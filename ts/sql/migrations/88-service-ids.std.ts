// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';
import lodash from 'lodash';

import type { LoggerType } from '../../types/Logging.std.js';
import type {
  ServiceIdString,
  AciString,
  PniString,
} from '../../types/ServiceId.std.js';
import { normalizeServiceId, normalizePni } from '../../types/ServiceId.std.js';
import { normalizeAci } from '../../util/normalizeAci.std.js';
import type { JSONWithUnknownFields } from '../../types/Util.std.js';
import { isNotNil } from '../../util/isNotNil.std.js';

const { omit } = lodash;

//
// Main migration function that does the following:
//
// 1. Drop indexes/triggers/generated columns
// 2. Alter tables to change column names
// 3. Re-create indexes/triggers/generated columns
// 4. Call other functions to migrate column and json values in each
//    affected table.
//

export default function updateToSchemaVersion88(
  db: Database,
  logger: LoggerType
): void {
  // See updateToSchemaVersion84
  const selectMentionsFromMessages = `
    SELECT messages.id, bodyRanges.value ->> 'mentionAci' as mentionAci,
      bodyRanges.value ->> 'start' as start,
      bodyRanges.value ->> 'length' as length
    FROM messages, json_each(messages.json ->> 'bodyRanges') as bodyRanges
    WHERE bodyRanges.value ->> 'mentionAci' IS NOT NULL
  `;

  // Rename all columns and re-create all indexes first.
  db.exec(`
    --
    -- conversations
    --

    DROP INDEX conversations_uuid;

    ALTER TABLE conversations
      RENAME COLUMN uuid TO serviceId;

    -- See: updateToSchemaVersion20
    CREATE INDEX conversations_serviceId ON conversations(serviceId);

    --
    -- sessions
    --

    ALTER TABLE sessions
      RENAME COLUMN ourUuid TO ourServiceId;
    ALTER TABLE sessions
      RENAME COLUMN uuid TO serviceId;

    --
    -- messages
    --

    DROP INDEX messages_sourceUuid;
    DROP INDEX messages_preview;
    DROP INDEX messages_preview_without_story;
    DROP INDEX messages_activity;

    ALTER TABLE messages
      DROP COLUMN isGroupLeaveEventFromOther;
    ALTER TABLE messages
      DROP COLUMN isGroupLeaveEvent;

    ALTER TABLE messages
      RENAME COLUMN sourceUuid TO sourceServiceId;

    -- See: updateToSchemaVersion47
    ALTER TABLE messages
      ADD COLUMN isGroupLeaveEvent INTEGER
      GENERATED ALWAYS AS (
        type IS 'group-v2-change' AND
        json_array_length(json_extract(json, '$.groupV2Change.details')) IS 1 AND
        json_extract(json, '$.groupV2Change.details[0].type') IS 'member-remove' AND
        json_extract(json, '$.groupV2Change.from') IS NOT NULL AND
        json_extract(json, '$.groupV2Change.from') IS json_extract(json, '$.groupV2Change.details[0].aci')
      );

    ALTER TABLE messages
      ADD COLUMN isGroupLeaveEventFromOther INTEGER
      GENERATED ALWAYS AS (
        isGroupLeaveEvent IS 1
        AND
        isChangeCreatedByUs IS 0
      );

    -- See: updateToSchemaVersion25
    CREATE INDEX messages_sourceServiceId on messages(sourceServiceId);

    -- See: updateToSchemaVersion81
    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at);
    CREATE INDEX messages_preview_without_story ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at) WHERE storyId IS NULL;
    CREATE INDEX messages_activity ON messages
      (conversationId, shouldAffectActivity, isTimerChangeFromSync,
       isGroupLeaveEventFromOther, received_at, sent_at);

    --
    -- reactions
    --

    DROP INDEX reaction_identifier;

    ALTER TABLE reactions
      RENAME COLUMN targetAuthorUuid TO targetAuthorAci;

    -- See: updateToSchemaVersion29
    CREATE INDEX reaction_identifier ON reactions (
      emoji,
      targetAuthorAci,
      targetTimestamp
    );

    --
    -- unprocessed
    --

    ALTER TABLE unprocessed
      RENAME COLUMN sourceUuid TO sourceServiceId;

    --
    -- sendLogRecipients
    --

    DROP INDEX sendLogRecipientsByRecipient;

    ALTER TABLE sendLogRecipients
      RENAME COLUMN recipientUuid TO recipientServiceId;

    -- See: updateToSchemaVersion37
    CREATE INDEX sendLogRecipientsByRecipient
      ON sendLogRecipients (recipientServiceId, deviceId);

    --
    -- storyDistributionMembers
    --

    ALTER TABLE storyDistributionMembers
      RENAME COLUMN uuid TO serviceId;

    --
    -- mentions
    --

    DROP TRIGGER messages_on_update;
    DROP TRIGGER messages_on_insert_insert_mentions;
    DROP TRIGGER messages_on_update_update_mentions;
    DROP INDEX mentions_uuid;

    ALTER TABLE mentions
      RENAME COLUMN mentionUuid TO mentionAci;

    -- See: updateToSchemaVersion84
    CREATE INDEX mentions_aci ON mentions (mentionAci);

    --
    -- preKeys
    --

    DROP INDEX preKeys_ourUuid;
    DROP INDEX signedPreKeys_ourUuid;
    DROP INDEX kyberPreKeys_ourUuid;

    ALTER TABLE preKeys
      RENAME COLUMN ourUuid TO ourServiceId;
    ALTER TABLE signedPreKeys
      RENAME COLUMN ourUuid TO ourServiceId;
    ALTER TABLE kyberPreKeys
      RENAME COLUMN ourUuid TO ourServiceId;

    -- See: updateToSchemaVersion64
    CREATE INDEX preKeys_ourServiceId ON preKeys (ourServiceId);
    CREATE INDEX signedPreKeys_ourServiceId ON signedPreKeys (ourServiceId);
    CREATE INDEX kyberPreKeys_ourServiceId ON kyberPreKeys (ourServiceId);
  `);

  // Migrate JSON fields
  const { identifierToServiceId } = migrateConversations(db, logger);
  const ourServiceIds = migrateItems(db, logger);
  migrateSessions(db, ourServiceIds, logger);
  migrateMessages(db, logger);
  migratePreKeys(db, 'preKeys', ourServiceIds, logger);
  migratePreKeys(db, 'signedPreKeys', ourServiceIds, logger);
  migratePreKeys(db, 'kyberPreKeys', ourServiceIds, logger);
  migrateJobs(db, identifierToServiceId, logger);

  // Re-create triggers after updating messages
  db.exec(`
    -- See: updateToSchemaVersion45
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN
      (new.body IS NULL OR old.body IS NOT new.body) AND
       new.isViewOnce IS NOT 1 AND new.storyId IS NULL
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      INSERT INTO messages_fts
        (rowid, body)
      VALUES
        (new.rowid, new.body);
    END;

    -- See: updateToSchemaVersion84
    CREATE TRIGGER messages_on_insert_insert_mentions AFTER INSERT ON messages
    BEGIN
      INSERT INTO mentions (messageId, mentionAci, start, length)
      ${selectMentionsFromMessages}
      AND messages.id = new.id;
    END;

    CREATE TRIGGER messages_on_update_update_mentions AFTER UPDATE ON messages
    BEGIN
      DELETE FROM mentions WHERE messageId = new.id;
      INSERT INTO mentions (messageId, mentionAci, start, length)
      ${selectMentionsFromMessages}
      AND messages.id = new.id;
    END;
  `);
}

//
// migrateConversation does the following:
//
// 1. Rename `uuid` to `serviceId`
// 2. Prefix the value of `pni` with `PNI:` if needed
// 3. Renames various `uuid` fields to either `serviceId` or `aci`.
//
// The result is a conversationId to serviceId map to be consumed in
// other functions.
//

type LegacyBodyRanges = JSONWithUnknownFields<
  Array<{
    mentionUuid?: string;
  }>
>;

type UpdatedBodyRanges = JSONWithUnknownFields<
  Array<{
    mentionAci: AciString | undefined;
  }>
>;

type MigrateConversationsResultType = Readonly<{
  identifierToServiceId: Map<string, ServiceIdString>;
}>;

type LegacyConversationData = JSONWithUnknownFields<{
  uuid?: string | null;
  pni?: string | null;
  bannedMembersV2?: Array<{
    uuid: string;
  }>;
  lastMessageBodyRanges?: LegacyBodyRanges;
  membersV2?: Array<{
    uuid: string;
  }>;
  pendingAdminApprovalV2?: Array<{
    uuid: string;
  }>;
  pendingMembersV2?: Array<{
    uuid: string;
  }>;
  senderKeyInfo?: {
    memberDevices: Array<{ identifier: string }>;
  };
}>;

type UpdatedConversationData = JSONWithUnknownFields<{
  serviceId: ServiceIdString | undefined;
  pni: PniString | undefined;
  bannedMembersV2:
    | Array<{
        serviceId: ServiceIdString;
      }>
    | undefined;
  lastMessageBodyRanges: UpdatedBodyRanges | undefined;
  membersV2:
    | Array<{
        aci: AciString;
      }>
    | undefined;
  pendingAdminApprovalV2:
    | Array<{
        aci: AciString;
      }>
    | undefined;
  pendingMembersV2:
    | Array<{
        serviceId: ServiceIdString;
      }>
    | undefined;
  senderKeyInfo:
    | {
        memberDevices: Array<{ serviceId: ServiceIdString }>;
      }
    | undefined;
}>;

function migrateConversations(
  db: Database,
  logger: LoggerType
): MigrateConversationsResultType {
  const convos: Array<{
    id: string;
    e164?: string;
    serviceId?: string;
    json: string;
  }> = db.prepare('SELECT id, e164, serviceId, json FROM conversations').all();

  const updateStmt = db.prepare(
    'UPDATE conversations SET json = $json WHERE id IS $id'
  );

  logger.info(`updating ${convos.length} conversations`);

  // Build lookup map for senderKeyInfo
  const identifierToServiceId = new Map<string, ServiceIdString>();
  for (const { id, e164, serviceId: rawServiceId } of convos) {
    if (!rawServiceId) {
      continue;
    }

    const serviceId = normalizeServiceId(
      rawServiceId,
      'legacyConvo.serviceId',
      logger
    );
    identifierToServiceId.set(id, serviceId);
    if (e164) {
      identifierToServiceId.set(e164, serviceId);
    }
    identifierToServiceId.set(serviceId, serviceId);
  }

  for (const { id, json } of convos) {
    try {
      const legacy: LegacyConversationData = JSON.parse(json);

      const {
        uuid: serviceId,
        pni,
        bannedMembersV2,
        membersV2,
        pendingAdminApprovalV2,
        pendingMembersV2,
        lastMessageBodyRanges,
        senderKeyInfo,
        ...restOfConvo
      } = legacy;

      const modern: UpdatedConversationData = {
        ...restOfConvo,
        serviceId: normalizeServiceId(
          serviceId,
          'legacyConvo.serviceId',
          logger
        ),
        pni: prefixPni(pni, 'legacyConvo.pni', logger),
        bannedMembersV2: bannedMembersV2?.map(
          ({ uuid: memberServiceId, ...rest }) => {
            return {
              ...rest,
              serviceId: normalizeServiceId(
                memberServiceId,
                'legacyConvo.bannedMembersV2',
                logger
              ),
            };
          }
        ),
        membersV2: membersV2?.map(({ uuid: aci, ...rest }) => {
          return {
            ...rest,
            aci: normalizeAci(aci, 'legacyConvo.membersV2', logger),
          };
        }),
        pendingAdminApprovalV2: pendingAdminApprovalV2?.map(
          ({ uuid: aci, ...rest }) => {
            return {
              ...rest,
              aci: normalizeAci(
                aci,
                'legacyConvo.pendingAdminApprovalV2',
                logger
              ),
            };
          }
        ),
        pendingMembersV2: pendingMembersV2?.map(
          ({ uuid: memberServiceId, ...rest }) => {
            return {
              ...rest,
              serviceId: normalizeServiceId(
                memberServiceId,
                'legacyConvo.pendingMembersV2',
                logger
              ),
            };
          }
        ),
        lastMessageBodyRanges: migrateBodyRanges(
          lastMessageBodyRanges,
          'lastMessageBodyRanges',
          logger
        ),
        senderKeyInfo: senderKeyInfo
          ? {
              ...senderKeyInfo,
              memberDevices: senderKeyInfo.memberDevices
                .map(({ identifier, ...rest }) => {
                  const deviceServiceId = identifierToServiceId.get(identifier);
                  if (!deviceServiceId) {
                    logger.warn(`failed to resolve identifier ${identifier}`);
                    return undefined;
                  }

                  return { ...rest, serviceId: deviceServiceId };
                })
                .filter(isNotNil),
            }
          : undefined,
      };

      updateStmt.run({ id, json: JSON.stringify(modern) });
    } catch (error) {
      logger.warn(`failed to parse convo ${id} json`, error);
      continue;
    }
  }

  return { identifierToServiceId };
}

//
// migrateItems does:
//
// 1. Migrate `pni` storage item to a prefixed value
// 2. Return `aci` and `pni` (and their legacy values) to be used in other
//    migrations.

type OurServiceIds = Readonly<{
  legacyAci?: string;
  legacyPni?: string;
  aci?: AciString;
  pni?: PniString;
}>;

function migrateItems(db: Database, logger: LoggerType): OurServiceIds {
  // Get our ACI and PNI
  const uuidIdJson = db
    .prepare(
      `
    SELECT json
    FROM items
    WHERE id IS 'uuid_id'
  `,
      {
        pluck: true,
      }
    )
    .get<string>();
  const pniJson = db
    .prepare(
      `
    SELECT json
    FROM items
    WHERE id IS 'pni'
  `,
      {
        pluck: true,
      }
    )
    .get<string>();

  let legacyAci: string | undefined;
  try {
    [legacyAci] = JSON.parse(uuidIdJson ?? '').value.split('.', 2);
  } catch (error) {
    if (uuidIdJson) {
      logger.warn('failed to parse uuid_id item', error);
    } else {
      logger.info('Our UUID not found');
    }
  }

  let legacyPni: string | undefined;
  try {
    legacyPni = JSON.parse(pniJson ?? '').value;
  } catch (error) {
    if (pniJson) {
      logger.warn('failed to parse pni item', error);
    } else {
      logger.info('Our PNI not found');
    }
  }

  const aci = normalizeAci(legacyAci, 'uuid_id', logger);
  const pni = prefixPni(legacyPni, 'pni', logger);

  const maps: Array<{ id: string; json: string }> = db
    .prepare(
      `
      SELECT id, json
      FROM items
      WHERE id IN ('identityKeyMap', 'registrationIdMap');
    `
    )
    .all();

  const updateStmt = db.prepare(
    'UPDATE items SET json = $json WHERE id IS $id'
  );

  if (pni) {
    updateStmt.run({
      id: 'pni',
      json: JSON.stringify({ id: 'pni', value: pni }),
    });
  }

  for (const { id, json } of maps) {
    try {
      const data: { id: string; value: Record<string, unknown> } =
        JSON.parse(json);

      const aciValue = legacyAci && data.value[legacyAci];
      if (legacyAci && aci && aciValue) {
        delete data.value[legacyAci];
        data.value[aci] = aciValue;
      }
      const pniValue = legacyPni && data.value[legacyPni];
      if (legacyPni && pni && pniValue) {
        delete data.value[legacyPni];
        data.value[pni] = pniValue;
      }

      updateStmt.run({ id, json: JSON.stringify(data) });
    } catch (error) {
      logger.warn(`failed to parse ${id} item`, error);
    }
  }
  return { aci, pni, legacyAci, legacyPni };
}

//
// migrateSessions does:
//
// 1. Update `ourServiceId` to a normalized ACI or (prefixed) PNI in both
//    json and column
// 2. Update the `session.id` to use new `ourServiceId`
//    (the schema is `${ourServiceId}:${theirServiceId}.${theirDevice}`
//

function migrateSessions(
  db: Database,
  ourServiceIds: OurServiceIds,
  logger: LoggerType
): void {
  const sessions: Array<{
    id: string;
    serviceId: string;
    ourServiceId: string;
    json: string;
  }> = db
    .prepare('SELECT id, serviceId, ourServiceId, json FROM sessions')
    .all();

  const updateStmt = db.prepare(
    `
      UPDATE sessions
      SET id = $newId, serviceId = $newServiceId,
        ourServiceId = $newOurServiceId, json = $newJson
      WHERE id IS $id
    `
  );

  logger.info(`updating ${sessions.length} sessions`);
  for (const { id, serviceId, ourServiceId, json } of sessions) {
    const match = id.match(/^(.*):(.*)\.(.*)$/);
    if (!match) {
      logger.warn(`invalid session id ${id}`);
      continue;
    }
    let legacyData: JSONWithUnknownFields<Record<string, unknown>>;
    try {
      legacyData = JSON.parse(json);
    } catch (error) {
      logger.warn(`failed to parse session ${id}`, error);
      continue;
    }

    const [, from, to, device] = match;

    const newId =
      `${migrateServiceId(from, ourServiceIds, logger)}:` +
      `${migrateServiceId(to, ourServiceIds, logger)}.${device}`;
    const newServiceId = migrateServiceId(serviceId, ourServiceIds, logger);
    const newOurServiceId = migrateServiceId(
      ourServiceId,
      ourServiceIds,
      logger
    );
    if (!newServiceId || !newOurServiceId) {
      logger.warn(
        'failed to normalize session service ids',
        serviceId,
        ourServiceId
      );
      continue;
    }

    const newData: JSONWithUnknownFields<{
      id: string;
      serviceId: ServiceIdString;
      ourServiceId: ServiceIdString;
    }> = {
      ...omit(legacyData, 'uuid', 'ourUuid'),
      id: newId,
      serviceId: newServiceId,
      ourServiceId: newOurServiceId,
    };

    updateStmt.run({
      id,
      newId,
      newServiceId,
      newOurServiceId,
      newJson: JSON.stringify(newData),
    });
  }
}

//
// Migrate messages processes messages in page by page and does:
//
// 1. Update all json fields from `*uuid` to `*serviceId`/`*aci` depending
//    on context.

type LegacyBodyRangesAndQuote = JSONWithUnknownFields<{
  bodyRanges?: LegacyBodyRanges;
  quote?: {
    authorUuid?: string;
    bodyRanges?: LegacyBodyRanges;
  };
}>;

type UpdatedBodyRangesAndQuote = JSONWithUnknownFields<{
  bodyRanges: UpdatedBodyRanges | undefined;
  quote:
    | {
        authorAci: AciString | undefined;
        bodyRanges: UpdatedBodyRanges | undefined;
      }
    | undefined;
}>;

type LegacyMessage = JSONWithUnknownFields<
  LegacyBodyRangesAndQuote & {
    id: string;
    sourceUuid?: string;
    expirationTimerUpdate?: {
      sourceUuid?: string;
    };
    reactions?: Array<LegacyReaction>;
    storyReaction?: LegacyReaction;
    storyReplyContext?: {
      authorUuid?: string;
    };
    editHistory?: Array<LegacyBodyRangesAndQuote>;
    groupV2Change?: {
      details?: Array<LegacyGroupChange>;
    };
  }
>;

type UpdatedMessage = JSONWithUnknownFields<
  UpdatedBodyRangesAndQuote & {
    id: string;
    sourceServiceId: ServiceIdString | undefined;
    expirationTimerUpdate:
      | {
          sourceServiceId: ServiceIdString | undefined;
        }
      | undefined;
    reactions: Array<UpdatedReaction> | undefined;
    storyReaction: UpdatedReaction | undefined;
    storyReplyContext:
      | {
          authorAci: AciString | undefined;
        }
      | undefined;
    editHistory: Array<UpdatedBodyRangesAndQuote> | undefined;
    groupV2Change:
      | {
          details: Array<UpdatedGroupChange> | undefined;
        }
      | undefined;
  }
>;

function migrateMessages(db: Database, logger: LoggerType): void {
  const PAGE_SIZE = 10000;
  const getPage = db.prepare(`
    SELECT rowid, id, json
    FROM messages
    LIMIT $limit
    OFFSET $offset
  `);

  const updateStmt = db.prepare(`
    UPDATE messages
    SET json = $json
    WHERE rowid = $rowid
  `);

  logger.info('updating messages');

  let totalMessages = 0;
  // eslint-disable-next-line no-constant-condition
  for (let offset = 0; true; offset += PAGE_SIZE) {
    const messages: Array<{ id: string; rowid: number; json: string }> =
      getPage.all({
        limit: PAGE_SIZE,
        offset,
      });
    if (messages.length === 0) {
      break;
    }

    totalMessages += messages.length;

    for (const { rowid, id, json } of messages) {
      try {
        const legacy: LegacyMessage = JSON.parse(json);

        const {
          sourceUuid,
          expirationTimerUpdate,
          reactions,
          storyReaction,
          storyReplyContext,
          editHistory,
          groupV2Change,
          ...restOfMessage
        } = legacy;

        const updatedMessage: UpdatedMessage = {
          ...restOfMessage,
          ...omit(
            migrateBodyRangesAndQuote(legacy, 'message', logger),
            'sourceUuid'
          ),
          sourceServiceId: normalizeServiceId(sourceUuid, 'sourceUuid'),
          expirationTimerUpdate: expirationTimerUpdate
            ? {
                ...omit(expirationTimerUpdate, 'sourceUuid'),
                sourceServiceId: normalizeServiceId(
                  expirationTimerUpdate.sourceUuid,
                  'expirationTimerUpdate.sourceUuid'
                ),
              }
            : undefined,
          reactions: reactions?.map(r => migrateReaction(r)),
          storyReaction: storyReaction
            ? migrateReaction(storyReaction)
            : undefined,
          storyReplyContext: storyReplyContext
            ? {
                ...omit(storyReplyContext, 'authorUuid'),
                authorAci: normalizeAci(
                  storyReplyContext.authorUuid,
                  'storyReplyContext.authorUuid',
                  logger
                ),
              }
            : undefined,
          editHistory: editHistory?.map(h =>
            migrateBodyRangesAndQuote(h, 'editHistory', logger)
          ),
          groupV2Change: groupV2Change
            ? {
                ...groupV2Change,
                details: groupV2Change.details?.map(d =>
                  migrateGroupChange(d, logger)
                ),
              }
            : undefined,
        };

        updateStmt.run({
          rowid,
          json: JSON.stringify(updatedMessage),
        });
      } catch (error) {
        logger.warn(`failed to parse message ${id} json`, error);
      }
    }
  }

  logger.info(`updated ${totalMessages} messages`);
}

// migratePreKeys works similarly to migrateSessions and does:
//
// 1. Update `ourServiceId` to ACI or (prefixed) PNI
// 2. Update `id` to use new `ourServiceId` value
//    (the schema is `${ourServiceId}:${keyId}`)
//

function migratePreKeys(
  db: Database,
  table: string,
  ourServiceIds: OurServiceIds,
  logger: LoggerType
): void {
  const preKeys = db.prepare(`SELECT id, json FROM ${table}`).all<{
    id: string;
    json: string;
  }>();

  const updateStmt = db.prepare(`
    UPDATE ${table}
    SET id = $newId, json = $newJson
    WHERE id = $id
  `);

  logger.info(`updating ${preKeys.length} ${table}`);
  for (const { id, json } of preKeys) {
    const match = id.match(/^(.*):(.*)$/);
    if (!match) {
      logger.warn(`invalid ${table} id ${id}`);
      continue;
    }

    let legacyData: JSONWithUnknownFields<Record<string, unknown>>;
    try {
      legacyData = JSON.parse(json);
    } catch (error) {
      logger.warn(`failed to parse ${table} ${id}`, error);
      continue;
    }

    const [, ourUuid, keyId] = match;

    const ourServiceId = migrateServiceId(ourUuid, ourServiceIds, logger);
    const newId = `${ourServiceId}:${keyId}`;

    const newData: JSONWithUnknownFields<{
      id: string;
      ourServiceId: ServiceIdString;
    }> = {
      ...omit(legacyData, 'ourUuid'),
      id: newId,
      ourServiceId,
    };

    updateStmt.run({
      id,
      newId,
      newJson: JSON.stringify(newData),
    });
  }
}

//
// migrateJobs does:
//
// 1. Update conversation jobs to use `serviceId` instead of `uuid`
//   1.1. `DeleteStoryForEveryone`
//   1.2. `ResendRequest`
//   1.3. `Receipts`
// 2. Update `read sync`/`view sync`/`view once open sync` to use service ids
// 3. Update `single proto` job queue to use `serviceId`

type LegacyConversationJob = JSONWithUnknownFields<
  | {
      type: 'DeleteStoryForEveryone';
      updatedStoryRecipients: Array<{
        destinationUuid?: string;
        legacyDestinationUuid?: string;
        destinationAci?: string;
        destinationPni?: string;
      }>;
    }
  | {
      type: 'ResendRequest';
      senderUuid: string;
    }
  | {
      type: 'Receipts';
      receipts: Array<{
        senderUuid?: string;
      }>;
    }
>;

type UpdatedConversationJob = JSONWithUnknownFields<
  | {
      type: 'DeleteStoryForEveryone';
      updatedStoryRecipients: Array<{
        destinationServiceId: ServiceIdString | undefined;
      }>;
    }
  | {
      type: 'ResendRequest';
      senderAci: AciString;
    }
  | {
      type: 'Receipts';
      receipts: Array<{
        senderAci: AciString | undefined;
      }>;
    }
>;

type LegacyReadSyncJob = JSONWithUnknownFields<{
  readSyncs: Array<{
    senderUuid: string;
  }>;
}>;

type UpdatedReadSyncJob = JSONWithUnknownFields<{
  readSyncs: Array<{
    senderAci: AciString;
  }>;
}>;

type LegacyViewSyncJob = JSONWithUnknownFields<{
  viewSyncs: Array<{
    senderUuid: string;
  }>;
}>;

type UpdatedViewSyncJob = JSONWithUnknownFields<{
  viewSyncs: Array<{
    senderAci: AciString;
  }>;
}>;

type LegacyViewOnceSyncJob = JSONWithUnknownFields<{
  viewOnceOpens: Array<{
    senderUuid: string;
  }>;
}>;

type UpdatedViewOnceSyncJob = JSONWithUnknownFields<{
  viewOnceOpens: Array<{
    senderAci: AciString;
  }>;
}>;

type LegacySingleProtoJob = JSONWithUnknownFields<{
  identifier: string;
}>;

type UpdatedSingleProtoJob = JSONWithUnknownFields<{
  serviceId: ServiceIdString;
}>;

function migrateJobs(
  db: Database,
  identifierToServiceId: Map<string, ServiceIdString>,
  logger: LoggerType
): void {
  const jobs = db.prepare('SELECT id, queueType, data FROM jobs').all<{
    id: string;
    queueType: string;
    data: string;
  }>();
  const updateStmt = db.prepare('UPDATE jobs SET data = $data WHERE id IS $id');

  let updatedCount = 0;
  for (const { id, queueType, data } of jobs) {
    try {
      const parsedData: unknown = JSON.parse(data);

      let updatedData: unknown | undefined;
      if (queueType === 'conversation') {
        const convoJob = parsedData as LegacyConversationJob;
        let updatedJob: UpdatedConversationJob | undefined;

        if (convoJob.type === 'DeleteStoryForEveryone') {
          updatedJob = {
            ...convoJob,
            updatedStoryRecipients: convoJob.updatedStoryRecipients.map(
              ({
                destinationUuid,
                legacyDestinationUuid,
                destinationAci,
                destinationPni,
                ...rest
              }) => {
                return {
                  ...rest,
                  destinationServiceId: normalizeServiceId(
                    destinationUuid ||
                      destinationAci ||
                      destinationPni ||
                      legacyDestinationUuid,
                    'DeleteStoryForEveryone',
                    logger
                  ),
                };
              }
            ),
          };
        } else if (convoJob.type === 'ResendRequest') {
          updatedJob = {
            ...omit(convoJob, 'senderUuid'),
            senderAci: normalizeAci(
              convoJob.senderUuid,
              'ResendRequest',
              logger
            ),
          };
        } else if (convoJob.type === 'Receipts') {
          updatedJob = {
            ...convoJob,
            receipts: convoJob.receipts.map(({ senderUuid, ...rest }) => {
              return {
                ...rest,
                senderAci: normalizeAci(senderUuid, 'Receipts', logger),
              };
            }),
          };
        }

        updatedData = updatedJob;
      } else if (queueType === 'read sync') {
        const syncJob = parsedData as LegacyReadSyncJob;
        const updatedJob: UpdatedReadSyncJob = {
          ...syncJob,
          readSyncs: syncJob.readSyncs.map(({ senderUuid, ...rest }) => {
            return {
              ...rest,
              senderAci: normalizeAci(senderUuid, 'read sync'),
            };
          }),
        };

        updatedData = updatedJob;
      } else if (queueType === 'view sync') {
        const syncJob = parsedData as LegacyViewSyncJob;
        const updatedJob: UpdatedViewSyncJob = {
          ...syncJob,
          viewSyncs: syncJob.viewSyncs.map(({ senderUuid, ...rest }) => {
            return {
              ...rest,
              senderAci: normalizeAci(senderUuid, 'read sync'),
            };
          }),
        };

        updatedData = updatedJob;
      } else if (queueType === 'view once open sync') {
        const syncJob = parsedData as LegacyViewOnceSyncJob;
        const updatedJob: UpdatedViewOnceSyncJob = {
          ...syncJob,
          viewOnceOpens: syncJob.viewOnceOpens.map(
            ({ senderUuid, ...rest }) => {
              return {
                ...rest,
                senderAci: normalizeAci(senderUuid, 'read sync'),
              };
            }
          ),
        };

        updatedData = updatedJob;
      } else if (queueType === 'single proto') {
        const { identifier, ...syncJob } = parsedData as LegacySingleProtoJob;
        const serviceId = identifierToServiceId.get(identifier);
        if (!serviceId) {
          logger.warn(
            `failed to resolve identifier ${identifier} ` +
              `for job ${id}/${queueType}`
          );
          continue;
        }

        const updatedJob: UpdatedSingleProtoJob = {
          ...syncJob,
          serviceId,
        };

        updatedData = updatedJob;
      }

      if (updatedData !== undefined) {
        updatedCount += 1;
        updateStmt.run({ id, data: JSON.stringify(updatedData) });
      }
    } catch (error) {
      logger.warn(`failed to migrate job ${id}/${queueType} json`, error);
    }
  }

  logger.info(`updated ${updatedCount} jobs`);
}

//
// Various utility methods below.
//

function migrateBodyRangesAndQuote(
  { bodyRanges, quote, ...rest }: LegacyBodyRangesAndQuote,
  context: string,
  logger: LoggerType
): UpdatedBodyRangesAndQuote {
  return {
    ...rest,
    bodyRanges: bodyRanges
      ? migrateBodyRanges(bodyRanges, `${context}.bodyRanges`, logger)
      : undefined,
    quote: quote
      ? {
          ...quote,
          authorAci: normalizeAci(
            quote.authorUuid,
            `${context}.quote.authorUuid`,
            logger
          ),
          bodyRanges: quote.bodyRanges
            ? migrateBodyRanges(
                quote.bodyRanges,
                `${context}.quote.bodyRanges`,
                logger
              )
            : undefined,
        }
      : undefined,
  };
}

function migrateServiceId(
  legacyId: string,
  ourServiceIds: OurServiceIds,
  logger: LoggerType
): ServiceIdString;

function migrateServiceId(
  legacyId: string | null | undefined,
  { legacyAci, legacyPni, aci, pni }: OurServiceIds,
  logger: LoggerType
): ServiceIdString | undefined {
  if (legacyId == null) {
    return undefined;
  }
  if (legacyId === legacyAci) {
    return aci;
  }
  if (legacyId === legacyPni) {
    return pni;
  }
  return normalizeServiceId(legacyId, `migrateServiceId(${legacyId})`, logger);
}

function prefixPni(
  legacyPni: string | null | undefined,
  context: string,
  logger: LoggerType
): PniString | undefined {
  if (legacyPni == null) {
    return undefined;
  }

  if (legacyPni.toLowerCase().startsWith('pni:')) {
    return normalizePni(legacyPni, context, logger);
  }

  return normalizePni(`PNI:${legacyPni}`, context, logger);
}

function migrateBodyRanges(
  legacy: LegacyBodyRanges | undefined | null,
  context: string,
  logger: LoggerType
): UpdatedBodyRanges | undefined {
  if (legacy == null) {
    return undefined;
  }
  return legacy?.map(({ mentionUuid: mentionAci, ...rest }) => {
    return {
      ...rest,
      mentionAci: normalizeAci(mentionAci, context, logger),
    };
  });
}

type LegacyReaction = JSONWithUnknownFields<{
  targetAuthorUuid?: string;
}>;

type UpdatedReaction = JSONWithUnknownFields<Record<string, unknown>>;

function migrateReaction(legacy: LegacyReaction): UpdatedReaction {
  return omit(legacy, 'targetAuthorUuid');
}

type LegacyGroupChange = JSONWithUnknownFields<{
  type: string;
  uuid?: string;
}>;

type UpdatedGroupChange = JSONWithUnknownFields<{
  type: string;
  serviceId: ServiceIdString | undefined;
  aci: AciString | undefined;
}>;

const GROUP_CHANGES_WITH_SERVICE_ID = new Set([
  'pending-add-one',
  'pending-remove-one',
]);

function migrateGroupChange(
  { type, uuid, ...rest }: LegacyGroupChange,
  logger: LoggerType
): UpdatedGroupChange {
  let aci: AciString | undefined;
  let serviceId: ServiceIdString | undefined;
  if (GROUP_CHANGES_WITH_SERVICE_ID.has(type)) {
    serviceId = normalizeServiceId(uuid, `migrateGroupChange(${type})`, logger);
  } else {
    aci = normalizeAci(uuid, `migrateGroupChange(${type})`, logger);
  }

  return {
    ...rest,
    type,
    aci,
    serviceId,
  };
}
