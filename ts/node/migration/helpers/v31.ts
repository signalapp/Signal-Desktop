/* eslint-disable no-unused-expressions */
import * as BetterSqlite3 from '@signalapp/better-sqlite3';
import {
  ContactInfoSet,
  ContactsConfigWrapperNode,
  ConvoInfoVolatileWrapperNode,
  LegacyGroupInfo,
  LegacyGroupMemberInfo,
  UserGroupsWrapperNode,
} from 'libsession_util_nodejs';
import { isEmpty, isEqual, isFinite, isNumber } from 'lodash';
import { from_hex } from 'libsodium-wrappers-sumo';
import { MESSAGES_TABLE, toSqliteBoolean } from '../../database_utility';
import {
  CONVERSATION_PRIORITIES,
  ConversationAttributes,
} from '../../../models/conversationAttributes';
import { maybeArrayJSONtoArray } from '../../../types/sqlSharedTypes';
import { checkTargetMigration, hasDebugEnvVariable } from '../utils';
import { sqlNode } from '../../sql';
import { HexKeyPair } from '../../../receiver/keypairs';
import { fromHexToArray } from '../../../session/utils/String';

const targetVersion = 31;

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
  db: BetterSqlite3.Database,
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

/**
 * This function returns a CommunityInfo for the wrapper to understand from the DB values.
 * It is created in this file so we can reuse it during the migration (node side), and from the renderer side
 */
function getCommunityInfoFromDBValues({
  priority,
  fullUrl,
}: {
  priority: number;
  fullUrl: string;
}) {
  const community = {
    fullUrl,
    priority: priority || 0,
  };

  return community;
}

function insertCommunityIntoWrapper(
  community: { id: string; priority: number },
  userGroupConfigWrapper: UserGroupsWrapperNode,
  volatileConfigWrapper: ConvoInfoVolatileWrapperNode,
  db: BetterSqlite3.Database,
  version: number
) {
  checkTargetMigration(version, targetVersion);

  const priority = community.priority;
  const convoId = community.id; // the id of a conversation has the prefix, the serverUrl and the roomToken already present, but not the pubkey

  const roomDetails = sqlNode.getV2OpenGroupRoom(convoId, db);
  // hasDebugEnvVariable && console.info('insertCommunityIntoWrapper: ', community);

  if (
    !roomDetails ||
    isEmpty(roomDetails) ||
    isEmpty(roomDetails.serverUrl) ||
    isEmpty(roomDetails.roomId) ||
    isEmpty(roomDetails.serverPublicKey)
  ) {
    console.info(
      'insertCommunityIntoWrapper did not find corresponding room details',
      convoId,
      roomDetails
    );
    return;
  }
  hasDebugEnvVariable ??
    console.info(
      `building fullUrl from serverUrl:"${roomDetails.serverUrl}" roomId:"${roomDetails.roomId}" pubkey:"${roomDetails.serverPublicKey}"`
    );

  const fullUrl = userGroupConfigWrapper.buildFullUrlFromDetails(
    roomDetails.serverUrl,
    roomDetails.roomId,
    roomDetails.serverPublicKey
  );
  const wrapperComm = getCommunityInfoFromDBValues({
    fullUrl,
    priority,
  });

  try {
    hasDebugEnvVariable && console.info('Inserting community into group wrapper: ', wrapperComm);
    userGroupConfigWrapper.setCommunityByFullUrl(wrapperComm.fullUrl, wrapperComm.priority);
    const rows = db
      .prepare(
        `
      SELECT MAX(COALESCE(serverTimestamp, 0)) AS max_sent_at
      FROM ${MESSAGES_TABLE} WHERE
        conversationId = $conversationId AND
        unread = $unread;
    `
      )
      .get({
        conversationId: convoId,
        unread: toSqliteBoolean(false), // we want to find the message read with the higher serverTimestamp timestamp
      });

    const maxRead = rows?.max_sent_at;
    const lastRead = isNumber(maxRead) && isFinite(maxRead) ? maxRead : 0;
    hasDebugEnvVariable &&
      console.info(
        `Inserting community into volatile wrapper: ${wrapperComm.fullUrl} :${lastRead}`
      );
    volatileConfigWrapper.setCommunityByFullUrl(wrapperComm.fullUrl, lastRead, false);
  } catch (e) {
    console.error(
      `userGroupConfigWrapper.set during migration failed with ${e.message} for fullUrl: "${wrapperComm.fullUrl}". Skipping community entirely`
    );
  }
}

function getLegacyGroupInfoFromDBValues({
  id,
  priority,
  members: maybeMembers,
  displayNameInProfile,
  encPubkeyHex,
  encSeckeyHex,
  groupAdmins: maybeAdmins,
  lastJoinedTimestamp,
}: Pick<
  ConversationAttributes,
  'id' | 'priority' | 'displayNameInProfile' | 'lastJoinedTimestamp'
> & {
  encPubkeyHex: string;
  encSeckeyHex: string;
  members: string | Array<string>;
  groupAdmins: string | Array<string>;
}) {
  const admins: Array<string> = maybeArrayJSONtoArray(maybeAdmins);
  const members: Array<string> = maybeArrayJSONtoArray(maybeMembers);

  const wrappedMembers: Array<LegacyGroupMemberInfo> = (members || []).map(m => {
    return {
      isAdmin: admins.includes(m),
      pubkeyHex: m,
    };
  });
  const legacyGroup: LegacyGroupInfo = {
    pubkeyHex: id,
    name: displayNameInProfile || '',
    priority: priority || 0,
    members: wrappedMembers,
    encPubkey: !isEmpty(encPubkeyHex) ? from_hex(encPubkeyHex) : new Uint8Array(),
    encSeckey: !isEmpty(encSeckeyHex) ? from_hex(encSeckeyHex) : new Uint8Array(),
    joinedAtSeconds: Math.floor(lastJoinedTimestamp / 1000),
  };

  return legacyGroup;
}

function insertLegacyGroupIntoWrapper(
  legacyGroup: Pick<
    ConversationAttributes,
    'id' | 'priority' | 'displayNameInProfile' | 'lastJoinedTimestamp'
  > & { members: string; groupAdmins: string }, // members and groupAdmins are still stringified here
  userGroupConfigWrapper: UserGroupsWrapperNode,
  volatileInfoConfigWrapper: ConvoInfoVolatileWrapperNode,
  db: BetterSqlite3.Database,
  version: number
) {
  checkTargetMigration(version, targetVersion);

  const { priority, id, groupAdmins, members, displayNameInProfile, lastJoinedTimestamp } =
    legacyGroup;

  const latestEncryptionKeyPairHex = sqlNode.getLatestClosedGroupEncryptionKeyPair(
    legacyGroup.id,
    db
  ) as HexKeyPair | undefined;

  const wrapperLegacyGroup = getLegacyGroupInfoFromDBValues({
    id,
    priority,
    groupAdmins,
    members,
    displayNameInProfile,
    encPubkeyHex: latestEncryptionKeyPairHex?.publicHex || '',
    encSeckeyHex: latestEncryptionKeyPairHex?.privateHex || '',
    lastJoinedTimestamp,
  });

  try {
    hasDebugEnvVariable &&
      console.info('Inserting legacy group into wrapper: ', wrapperLegacyGroup);
    userGroupConfigWrapper.setLegacyGroup(wrapperLegacyGroup);

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
        conversationId: id,
        unread: toSqliteBoolean(false), // we want to find the message read with the higher sentAt timestamp
      });

    const maxRead = rows?.max_sent_at;
    const lastRead = isNumber(maxRead) && isFinite(maxRead) ? maxRead : 0;
    hasDebugEnvVariable &&
      console.info(`Inserting legacy group into volatile wrapper maxread: ${id} :${lastRead}`);
    volatileInfoConfigWrapper.setLegacyGroup(id, lastRead, false);
  } catch (e) {
    console.error(
      `userGroupConfigWrapper.set during migration failed with ${e.message} for legacyGroup.id: "${legacyGroup.id}". Skipping that legacy group entirely`
    );
  }
}

export const V31 = {
  insertContactIntoContactWrapper,
  insertCommunityIntoWrapper,
  insertLegacyGroupIntoWrapper,
};
