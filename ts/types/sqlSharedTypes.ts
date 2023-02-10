import { OpenGroupRequestCommonType } from '../session/apis/open_group_api/opengroupV2/ApiUtil';
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
  combinedMessageHashes: Array<string>; // set of lastHashes to keep track of
  // we might need to add a `seqno` field here.
};

export type ConfigDumpRowWithoutData = Pick<
  ConfigDumpRow,
  'publicKey' | 'combinedMessageHashes' | 'variant'
>;

// ========== configdump

export type ConfigDumpDataNode = {
  getByVariantAndPubkey: (
    variant: ConfigWrapperObjectTypes,
    publicKey: string
  ) => Array<ConfigDumpRow>;
  getMessageHashesByVariantAndPubkey: (
    variant: ConfigWrapperObjectTypes,
    publicKey: string
  ) => Array<string>;
  saveConfigDump: (dump: ConfigDumpRow) => void;
  saveCombinedMessageHashesForMatching: (row: ConfigDumpRowWithoutData) => void;

  getAllDumpsWithData: () => Array<ConfigDumpRow>;
  getAllDumpsWithoutData: () => Array<ConfigDumpRowWithoutData>;
  getCombinedHashesByVariantAndPubkey: (
    variant: ConfigWrapperObjectTypes,
    pubkey: string
  ) => Array<string>;
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
