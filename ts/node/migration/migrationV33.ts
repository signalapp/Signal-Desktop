/* eslint-disable no-unused-expressions */
import * as BetterSqlite3 from '@signalapp/better-sqlite3';
import {
  ContactInfoSet,
  ContactsConfigWrapperNode,
  ConvoInfoVolatileWrapperNode,
  DisappearingMessageConversationType,
  UserConfigWrapperNode,
} from 'libsession_util_nodejs';
import { isArray, isEmpty, isEqual, isFinite, isNumber } from 'lodash';
import { CONVERSATION_PRIORITIES } from '../../models/conversationAttributes';
import { CONFIG_DUMP_TABLE, ConfigDumpRow } from '../../types/sqlSharedTypes';
import { CONVERSATIONS_TABLE, MESSAGES_TABLE, toSqliteBoolean } from '../database_utility';
import { writeSessionSchemaVersion } from './sessionMigrations';
import { DisappearingMessageMode } from '../../util/expiringMessages';
import { fromHexToArray } from '../../session/utils/String';
import { getIdentityKeys } from '../sql';
import { getBlockedNumbersDuringMigration, hasDebugEnvVariable } from './utils';

/**
 * Returns the logged in user conversation attributes and the keys.
 * If the keys exists but a conversation for that pubkey does not exist yet, the keys are still returned
 */
function getLoggedInUserConvoDuringMigration(db: BetterSqlite3.Database) {
  const ourKeys = getIdentityKeys(db);

  if (!ourKeys || !ourKeys.publicKeyHex || !ourKeys.privateEd25519) {
    return null;
  }

  const ourConversation = db.prepare(`SELECT * FROM ${CONVERSATIONS_TABLE} WHERE id = $id;`).get({
    id: ourKeys.publicKeyHex,
  }) as Record<string, any> | null;

  return { ourKeys, ourConversation: ourConversation || null };
}

function getContactInfoFromDBValues({
  id,
  dbApproved,
  dbApprovedMe,
  dbBlocked,
  dbName,
  dbNickname,
  priority,
  dbProfileUrl,
  dbProfileKey,
  dbCreatedAtSeconds,
  expirationType,
  expireTimer,
}: {
  id: string;
  dbApproved: boolean;
  dbApprovedMe: boolean;
  dbBlocked: boolean;
  dbNickname: string | undefined;
  dbName: string | undefined;
  priority: number;
  dbProfileUrl: string | undefined;
  dbProfileKey: string | undefined;
  dbCreatedAtSeconds: number;
  expirationType: string | undefined;
  expireTimer: number | undefined;
}): ContactInfoSet {
  const wrapperContact: ContactInfoSet = {
    id,
    approved: !!dbApproved,
    approvedMe: !!dbApprovedMe,
    blocked: !!dbBlocked,
    priority,
    nickname: dbNickname,
    name: dbName,
    createdAtSeconds: dbCreatedAtSeconds,
    expirationMode:
      // string must be a valid mode
      expirationType && DisappearingMessageMode.includes(expirationType)
        ? (expirationType as DisappearingMessageConversationType)
        : 'off',
    expirationTimerSeconds:
      !!expireTimer && isFinite(expireTimer) && expireTimer > 0 ? expireTimer * 1000 : 0,
  };

  if (
    wrapperContact.profilePicture?.url !== dbProfileUrl ||
    !isEqual(wrapperContact.profilePicture?.key, dbProfileKey)
  ) {
    wrapperContact.profilePicture = {
      url: dbProfileUrl || null,
      key: dbProfileKey && !isEmpty(dbProfileKey) ? fromHexToArray(dbProfileKey) : null,
    };
  }

  return wrapperContact;
}

function insertContactIntoContactWrapper(
  contact: any,
  blockedNumbers: Array<string>,
  contactsConfigWrapper: ContactsConfigWrapperNode | null, // set this to null to only insert into the convo volatile wrapper (i.e. for ourConvo case)
  volatileConfigWrapper: ConvoInfoVolatileWrapperNode,
  db: BetterSqlite3.Database
) {
  if (contactsConfigWrapper !== null) {
    const dbApproved = !!contact.isApproved || false;
    const dbApprovedMe = !!contact.didApproveMe || false;
    const dbBlocked = blockedNumbers.includes(contact.id);
    const priority = contact.priority || CONVERSATION_PRIORITIES.default;

    const wrapperContact = getContactInfoFromDBValues({
      id: contact.id,
      dbApproved,
      dbApprovedMe,
      dbBlocked,
      dbName: contact.displayNameInProfile || undefined,
      dbNickname: contact.nickname || undefined,
      dbProfileKey: contact.profileKey || undefined,
      dbProfileUrl: contact.avatarPointer || undefined,
      priority,
      dbCreatedAtSeconds: Math.floor((contact.active_at || Date.now()) / 1000),
      expirationType: contact.expirationType || 'off',
      expireTimer: contact.expirationTimer || 0,
    });

    try {
      hasDebugEnvVariable && console.info('Inserting contact into wrapper: ', wrapperContact);
      contactsConfigWrapper.set(wrapperContact);
    } catch (e) {
      console.error(
        `contactsConfigWrapper.set during migration failed with ${e.message} for id: ${contact.id}`
      );
      // the wrapper did not like something. Try again with just the boolean fields as it's most likely the issue is with one of the strings (which could be recovered)
      try {
        hasDebugEnvVariable && console.info('Inserting edited contact into wrapper: ', contact.id);

        contactsConfigWrapper.set(
          getContactInfoFromDBValues({
            id: contact.id,
            dbApproved,
            dbApprovedMe,
            dbBlocked,
            dbName: undefined,
            dbNickname: undefined,
            dbProfileKey: undefined,
            dbProfileUrl: undefined,
            priority: CONVERSATION_PRIORITIES.default,
            dbCreatedAtSeconds: Math.floor(Date.now() / 1000),
            expirationType: 'off',
            expireTimer: 0,
          })
        );
      } catch (err2) {
        // there is nothing else we can do here
        console.error(
          `contactsConfigWrapper.set during migration failed with ${err2.message} for id: ${contact.id}. Skipping contact entirely`
        );
      }
    }
  }

  try {
    const rows = db
      .prepare(
        `
      SELECT MAX(COALESCE(sent_at, 0)) AS max_sent_at
      FROM ${MESSAGES_TABLE} WHERE
        conversationId = $conversationId AND
        unread = $unread;
    `
      )
      .get({
        conversationId: contact.id,
        unread: toSqliteBoolean(false), // we want to find the message read with the higher sentAt timestamp
      });

    const maxRead = rows?.max_sent_at;
    const lastRead = isNumber(maxRead) && isFinite(maxRead) ? maxRead : 0;
    hasDebugEnvVariable &&
      console.info(`Inserting contact into volatile wrapper maxread: ${contact.id} :${lastRead}`);
    volatileConfigWrapper.set1o1(contact.id, lastRead, false);
  } catch (e) {
    console.error(
      `volatileConfigWrapper.set1o1 during migration failed with ${e.message} for id: ${contact.id}. skipping`
    );
  }
}

export function updateToSessionSchemaVersion34(currentVersion: number, db: BetterSqlite3.Database) {
  const targetVersion = 34;
  if (currentVersion >= targetVersion) {
    return;
  }

  // TODO we actually want to update the config wrappers that relate to disappearing messages with the type and seconds

  console.log(`updateToSessionSchemaVersion${targetVersion}: starting...`);
  db.transaction(() => {
    try {
      const loggedInUser = getLoggedInUserConvoDuringMigration(db);

      if (!loggedInUser || !loggedInUser.ourKeys) {
        throw new Error('privateEd25519 was empty. Considering no users are logged in');
      }

      const { privateEd25519, publicKeyHex } = loggedInUser.ourKeys;

      // Conversation changes
      // TODO can this be moved into libsession completely
      db.prepare(
        `ALTER TABLE ${CONVERSATIONS_TABLE} ADD COLUMN expirationType TEXT DEFAULT "off";`
      ).run();

      db.prepare(
        `ALTER TABLE ${CONVERSATIONS_TABLE} ADD COLUMN lastDisappearingMessageChangeTimestamp INTEGER DEFAULT 0;`
      ).run();

      db.prepare(`ALTER TABLE ${CONVERSATIONS_TABLE} ADD COLUMN hasOutdatedClient TEXT;`).run();

      // region Disappearing Messages Note to Self
      const noteToSelfInfo = db
        .prepare(
          `UPDATE ${CONVERSATIONS_TABLE} SET
      expirationType = $expirationType
      WHERE id = $id AND type = 'private' AND expireTimer > 0;`
        )
        .run({ expirationType: 'deleteAfterSend', id: publicKeyHex });

      if (noteToSelfInfo.changes) {
        const ourConversation = db
          .prepare(`SELECT * FROM ${CONVERSATIONS_TABLE} WHERE id = $id`)
          .get({ id: publicKeyHex });

        const expirySeconds = ourConversation.expireTimer || 0;

        // TODO update with Audric's snippet
        // Get existing config wrapper dump and update it
        const userConfigWrapperDump = db
          .prepare(`SELECT * FROM ${CONFIG_DUMP_TABLE} WHERE variant = 'UserConfig';`)
          .get() as ConfigDumpRow | undefined;

        if (userConfigWrapperDump) {
          const userConfigData = userConfigWrapperDump.data;
          const userProfileWrapper = new UserConfigWrapperNode(privateEd25519, userConfigData);

          userProfileWrapper.setNoteToSelfExpiry(expirySeconds);

          // dump the user wrapper content and save it to the DB
          const userDump = userProfileWrapper.dump();

          const configDumpInfo = db
            .prepare(
              `INSERT OR REPLACE INTO ${CONFIG_DUMP_TABLE} (
              publicKey,
              variant,
              data
          ) values (
            $publicKey,
            $variant,
            $data
          );`
            )
            .run({
              publicKey: publicKeyHex,
              variant: 'UserConfig',
              data: userDump,
            });

          // TODO Cleanup logging
          console.log(
            '===================== userConfigWrapperDump configDumpInfo',
            configDumpInfo,
            '======================='
          );
        } else {
          console.log(
            '===================== userConfigWrapperDump not found ======================='
          );
        }
      }
      // endregion

      // region Disappearing Messages Private Conversations
      const privateConversationsInfo = db
        .prepare(
          `UPDATE ${CONVERSATIONS_TABLE} SET
      expirationType = $expirationType
      WHERE type = 'private' AND expirationType = 'off' AND expireTimer > 0;`
        )
        .run({ expirationType: 'deleteAfterRead' });

      if (privateConversationsInfo.changes) {
        // this filter is based on the `isContactToStoreInWrapper` function. Note, it has been expanded to check if disappearing messages is on
        const contactsToUpdateInWrapper = db
          .prepare(
            `SELECT * FROM ${CONVERSATIONS_TABLE} WHERE type = 'private' AND active_at > 0 AND priority <> ${CONVERSATION_PRIORITIES.hidden} AND (didApproveMe OR isApproved) AND id <> '$us' AND id NOT LIKE '15%' AND id NOT LIKE '25%' AND expirationType = 'deleteAfterRead' AND expireTimer > 0;`
          )
          .all({
            us: publicKeyHex,
          });

        if (isArray(contactsToUpdateInWrapper) && contactsToUpdateInWrapper.length) {
          const blockedNumbers = getBlockedNumbersDuringMigration(db);
          const contactsWrapperDump = db
            .prepare(`SELECT * FROM ${CONFIG_DUMP_TABLE} WHERE variant = 'ContactConfig';`)
            .get() as ConfigDumpRow | undefined;
          const volatileInfoConfigWrapperDump = db
            .prepare(
              `SELECT * FROM ${CONFIG_DUMP_TABLE} WHERE variant = 'ConvoInfoVolatileConfig';`
            )
            .get() as ConfigDumpRow | undefined;

          if (contactsWrapperDump && volatileInfoConfigWrapperDump) {
            const contactsData = contactsWrapperDump.data;
            const contactsConfigWrapper = new ContactsConfigWrapperNode(
              privateEd25519,
              contactsData
            );
            const volatileInfoData = volatileInfoConfigWrapperDump.data;
            const volatileInfoConfigWrapper = new ConvoInfoVolatileWrapperNode(
              privateEd25519,
              volatileInfoData
            );

            console.info(
              `===================== Starting contact update into wrapper ${contactsToUpdateInWrapper?.length} =======================`
            );

            contactsToUpdateInWrapper.forEach(contact => {
              insertContactIntoContactWrapper(
                contact,
                blockedNumbers,
                contactsConfigWrapper,
                volatileInfoConfigWrapper,
                db
              );
            });

            console.info(
              '===================== Done with contact updating ======================='
            );

            // dump the user wrapper content and save it to the DB
            const contactsDump = contactsConfigWrapper.dump();
            const contactsDumpInfo = db
              .prepare(
                `INSERT OR REPLACE INTO ${CONFIG_DUMP_TABLE} (
              publicKey,
              variant,
              data
          ) values (
            $publicKey,
            $variant,
            $data
          );`
              )
              .run({
                publicKey: publicKeyHex,
                variant: 'ContactConfig',
                data: contactsDump,
              });

            // TODO Cleanup logging
            console.log(
              '===================== contactsConfigWrapper contactsDumpInfo',
              contactsDumpInfo,
              '======================='
            );

            const volatileInfoConfigDump = volatileInfoConfigWrapper.dump();
            const volatileInfoConfigDumpInfo = db
              .prepare(
                `INSERT OR REPLACE INTO ${CONFIG_DUMP_TABLE} (
              publicKey,
              variant,
              data
          ) values (
            $publicKey,
            $variant,
            $data
          );`
              )
              .run({
                publicKey: publicKeyHex,
                variant: 'ConvoInfoVolatileConfig',
                data: volatileInfoConfigDump,
              });

            // TODO Cleanup logging
            console.log(
              '===================== volatileInfoConfigWrapper volatileInfoConfigDumpInfo',
              volatileInfoConfigDumpInfo,
              '======================='
            );
          } else {
            console.log(
              '===================== contactsWrapperDump or volatileInfoConfigWrapperDump was not found ======================='
            );
          }
        }
      }

      // endregion

      // region Disappearing Messages Groups
      db.prepare(
        `UPDATE ${CONVERSATIONS_TABLE} SET
      expirationType = $expirationType
      WHERE type = 'group' AND id LIKE '05%' AND expireTimer > 0;`
      ).run({ expirationType: 'deleteAfterSend' });
      // endregion

      // Message changes
      db.prepare(`ALTER TABLE ${MESSAGES_TABLE} ADD COLUMN expirationType TEXT;`).run();
    } catch (e) {
      console.error(
        `Failed to migrate to disappearing messages v2. Might just not have a logged in user yet? `,
        e.message,
        e.stack,
        e
      );
      // if we get an exception here, most likely no users are logged in yet. We can just continue the transaction and the wrappers will be created when a user creates a new account.
    }

    writeSessionSchemaVersion(targetVersion, db);
  })();

  console.log(`updateToSessionSchemaVersion${targetVersion}: success!`);
}
