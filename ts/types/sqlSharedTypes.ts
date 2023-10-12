/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
// eslint-disable-next-line camelcase
import {
  ContactInfoSet,
  DisappearingMessageConversationModeType,
  LegacyGroupInfo,
  LegacyGroupMemberInfo,
} from 'libsession_util_nodejs';
import { from_hex } from 'libsodium-wrappers-sumo';
import { isArray, isEmpty, isEqual } from 'lodash';
import { OpenGroupV2Room } from '../data/opengroups';
import { OpenGroupRequestCommonType } from '../session/apis/open_group_api/opengroupV2/ApiUtil';
import { fromHexToArray } from '../session/utils/String';
import { ConfigWrapperObjectTypes } from '../webworker/workers/browser/libsession_worker_functions';

/**
 * This wrapper can be used to make a function type not async, asynced.
 * We use it in the typing of the database communication, because the data calls (renderer side) have essentially the same signature of the sql calls (node side), with an added `await`
 */
export type AsyncWrapper<T extends (...args: any) => any> = (
  ...args: Parameters<T>
) => Promise<ReturnType<T>>;

/**
 * This type is used to build from an objectType filled with functions, a new object type where all the functions their async equivalent
 */
export type AsyncObjectWrapper<Type extends Record<string, (...args: any) => any>> = {
  [Property in keyof Type]: AsyncWrapper<Type[Property]>;
};

export type MsgDuplicateSearchOpenGroup = Array<{
  sender: string;
  serverTimestamp: number;
  // senderBlinded?: string; // for a message we sent, we need a blinded id and an unblinded one
}>;

export type UpdateLastHashType = {
  convoId: string;
  snode: string;
  hash: string;
  expiresAt: number;
  namespace: number;
};

export type ConfigDumpRow = {
  variant: ConfigWrapperObjectTypes; // the variant this entry is about. (user pr, contacts, ...)
  publicKey: string; // either our pubkey if a dump for our own swarm or the closed group pubkey
  data: Uint8Array; // the blob returned by libsession.dump() call
};

export type ConfigDumpRowWithoutData = Pick<ConfigDumpRow, 'publicKey' | 'variant'>;

export const CONFIG_DUMP_TABLE = 'configDump';

// ========== configdump

export type ConfigDumpDataNode = {
  getByVariantAndPubkey: (
    variant: ConfigWrapperObjectTypes,
    publicKey: string
  ) => Array<ConfigDumpRow>;
  saveConfigDump: (dump: ConfigDumpRow) => void;

  getAllDumpsWithData: () => Array<ConfigDumpRow>;
  getAllDumpsWithoutData: () => Array<ConfigDumpRowWithoutData>;
};

// ========== unprocessed

export type UnprocessedParameter = {
  id: string;
  version: number;
  envelope: string;
  timestamp: number;
  // serverTimestamp: number;
  attempts: number;
  messageHash: string;
  senderIdentity?: string;
  decrypted?: string; // added once the envelopes's content is decrypted with updateCacheWithDecryptedContent
  source?: string; // added once the envelopes's content is decrypted with updateCacheWithDecryptedContent
};

export type UnprocessedDataNode = {
  saveUnprocessed: (data: UnprocessedParameter) => void;
  updateUnprocessedAttempts: (id: string, attempts: number) => void;
  updateUnprocessedWithData: (id: string, data: UnprocessedParameter) => void;
  getUnprocessedById: (id: string) => UnprocessedParameter | undefined;
  getUnprocessedCount: () => number;
  getAllUnprocessed: () => Array<UnprocessedParameter>;
  removeUnprocessed: (id: string) => void;
  removeAllUnprocessed: () => void;
};

// ======== attachment downloads

export type AttachmentDownloadMessageDetails = {
  messageId: string;
  type: 'preview' | 'quote' | 'attachment';
  index: number;
  isOpenGroupV2: boolean;
  openGroupV2Details: OpenGroupRequestCommonType | undefined;
};

export type SaveConversationReturn = {
  unreadCount: number;
  mentionedUs: boolean;
  lastReadTimestampMessage: number | null;
} | null;

/**
 * NOTE This code should always match the last known version of the same function used in a libsession migration (V34)
 *
 * This function returns a contactInfo for the wrapper to understand from the DB values.
 * Created in this file so we can reuse it during the migration (node side), and from the renderer side
 */
export function getContactInfoFromDBValues({
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
  expirationMode,
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
  expirationMode: DisappearingMessageConversationModeType | undefined;
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
    expirationMode,
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

export type CommunityInfoFromDBValues = {
  priority: number;
  fullUrl: string;
};

/**
 * NOTE This code should always match the last known version of the same function used in a libsession migration (V31)
 *
 * This function returns a CommunityInfo for the wrapper to understand from the DB values.
 * It is created in this file so we can reuse it during the migration (node side), and from the renderer side
 */
export function getCommunityInfoFromDBValues({
  priority,
  fullUrl,
}: {
  priority: number;
  fullUrl: string;
}): CommunityInfoFromDBValues {
  const community = {
    fullUrl,
    priority: priority || 0,
  };

  return community;
}

export function maybeArrayJSONtoArray(arr: string | Array<string>): Array<string> {
  try {
    if (isArray(arr)) {
      return arr;
    }

    const parsed = JSON.parse(arr);
    if (isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (e) {
    return [];
  }
}

/**
 * NOTE This code should always match the last known version of the same function used in a libsession migration (V34)
 */
export function getLegacyGroupInfoFromDBValues({
  id,
  priority,
  members: maybeMembers,
  displayNameInProfile,
  expirationMode,
  expireTimer,
  encPubkeyHex,
  encSeckeyHex,
  groupAdmins: maybeAdmins,
  lastJoinedTimestamp,
}: {
  id: string;
  priority: number;
  displayNameInProfile: string | undefined;
  expirationMode: DisappearingMessageConversationModeType | undefined;
  expireTimer: number | undefined;
  encPubkeyHex: string;
  encSeckeyHex: string;
  members: string | Array<string>;
  groupAdmins: string | Array<string>;
  lastJoinedTimestamp: number;
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
    disappearingTimerSeconds:
      expirationMode && expirationMode !== 'off' && !!expireTimer && expireTimer > 0
        ? expireTimer
        : 0,
    encPubkey: !isEmpty(encPubkeyHex) ? from_hex(encPubkeyHex) : new Uint8Array(),
    encSeckey: !isEmpty(encSeckeyHex) ? from_hex(encSeckeyHex) : new Uint8Array(),
    joinedAtSeconds: Math.floor(lastJoinedTimestamp / 1000),
  };

  return legacyGroup;
}

/**
 * This function can be used to make sure all the possible values as input of a switch as taken care off, without having a default case.
 *
 */
export function assertUnreachable(_x: never, message: string): never {
  const msg = `assertUnreachable: Didn't expect to get here with "${message}"`;
  // eslint:disable: no-console
  // eslint-disable-next-line no-console
  console.info(msg);
  throw new Error(msg);
}

export function roomHasBlindEnabled(openGroup?: OpenGroupV2Room) {
  return capabilitiesListHasBlindEnabled(openGroup?.capabilities);
}

export function capabilitiesListHasBlindEnabled(caps?: Array<string> | null) {
  return Boolean(caps?.includes('blind'));
}

export function roomHasReactionsEnabled(openGroup?: OpenGroupV2Room) {
  return Boolean(openGroup?.capabilities?.includes('reactions'));
}
