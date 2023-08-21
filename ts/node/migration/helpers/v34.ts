/* eslint-disable no-unused-expressions */
import * as BetterSqlite3 from '@signalapp/better-sqlite3';
import {
  ContactInfoSet,
  ContactsConfigWrapperNode,
  DisappearingMessageConversationType,
} from 'libsession_util_nodejs';
import { isEmpty, isEqual } from 'lodash';
import { CONVERSATION_PRIORITIES } from '../../../models/conversationAttributes';
import { fromHexToArray } from '../../../session/utils/String';
import { checkTargetMigration, hasDebugEnvVariable } from '../utils';
import { ConfigDumpRow, CONFIG_DUMP_TABLE } from '../../../types/sqlSharedTypes';

const targetVersion = 34;

function fetchConfigDumps(
  db: BetterSqlite3.Database,
  version: number,
  userPubkeyhex: string,
  variant: 'UserConfig' | 'ContactsConfig' | 'UserGroupsConfig' | 'ConvoInfoVolatileConfig'
): ConfigDumpRow | null {
  checkTargetMigration(version, targetVersion);

  const configWrapperDumps = db
    .prepare(
      `SELECT * FROM ${CONFIG_DUMP_TABLE} WHERE variant = $variant AND publicKey = $publicKey;`
    )
    .all({ variant, publicKey: userPubkeyhex }) as Array<ConfigDumpRow>;

  if (!configWrapperDumps || !configWrapperDumps.length) {
    return null;
  }

  // we can only have one dump with the current variants and our pubkey
  return configWrapperDumps[0];
}

function writeConfigDumps(
  db: BetterSqlite3.Database,
  version: number,
  userPubkeyhex: string,
  variant: 'UserConfig' | 'ContactsConfig' | 'UserGroupsConfig' | 'ConvoInfoVolatileConfig',
  dump: Uint8Array
) {
  checkTargetMigration(version, targetVersion);

  db.prepare(
    `INSERT OR REPLACE INTO ${CONFIG_DUMP_TABLE} (
            publicKey,
            variant,
            data
        ) values (
          $publicKey,
          $variant,
          $data
        );`
  ).run({
    publicKey: userPubkeyhex,
    variant,
    data: dump,
  });
}

/**
 * This function returns a contactInfo for the wrapper to understand from the DB values.
 * Created in this file so we can reuse it during the migration (node side), and from the renderer side
 */
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
    expirationMode: expirationType
      ? (expirationType as DisappearingMessageConversationType)
      : undefined,
    expirationTimerSeconds: !!expireTimer && expireTimer > 0 ? expireTimer : 0,
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

function updateContactInContactWrapper(
  contact: any,
  blockedNumbers: Array<string>,
  contactsConfigWrapper: ContactsConfigWrapperNode,
  version: number
) {
  checkTargetMigration(version, targetVersion);

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
      // TODO rename expireTimer to expirationTimer
      expireTimer: contact.expireTimer || 0,
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
}

export const V34 = {
  fetchConfigDumps,
  writeConfigDumps,
  updateContactInContactWrapper,
};
