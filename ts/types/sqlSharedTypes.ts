import { isEmpty, isEqual } from 'lodash';
import { ContactInfo } from 'session_util_wrapper';
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
  // we might need to add a `seqno` field here.
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

/**
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
  hidden,
  isPinned,
  dbProfileUrl,
  dbProfileKey,
}: {
  id: string;
  dbApproved: boolean;
  dbApprovedMe: boolean;
  dbBlocked: boolean;
  hidden: boolean;
  dbNickname: string | undefined;
  dbName: string | undefined;
  isPinned: boolean;
  dbProfileUrl: string | undefined;
  dbProfileKey: string | undefined;
}): ContactInfo {
  const wrapperContact: ContactInfo = {
    id,
    approved: !!dbApproved,
    approvedMe: !!dbApprovedMe,
    blocked: !!dbBlocked,
    hidden: !!hidden,
    priority: !!isPinned ? 1 : 0, // TODO the priority handling is not that simple
    nickname: dbNickname,
    name: dbName,
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

/**
 * This function returns a CommunityInfo for the wrapper to understand from the DB values.
 * It is created in this file so we can reuse it during the migration (node side), and from the renderer side
 */
export function getCommunityInfoFromDBValues({
  isPinned,
  fullUrl,
}: {
  isPinned: boolean;
  fullUrl: string;
}) {
  const community = {
    fullUrl,
    priority: !!isPinned ? 1 : 0, // TODO the priority handling is not that simple
  };

  return community;
}
