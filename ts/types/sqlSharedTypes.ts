import { ConfigWrapperObjectTypes } from '../webworker/workers/browser/libsession_worker_functions';

/**
 * This wrapper can be used to make a function type not async, asynced.
 * We use it in the typing of the database communication, because the data calls (renderer side) have essentially the same signature of the sql calls (node side), with an added `await`
 */
export type AsyncWrapper<T extends (...args: any) => any> = (
  ...args: Parameters<T>
) => Promise<ReturnType<T>>;

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
  pubkey: string; // either our pubkey if a dump for our own swarm or the closed group pubkey
  data: Uint8Array; // the blob returned by libsession.dump() call
  combinedMessageHashes?: string; // array of lastHashes to keep track of, stringified
  // we might need to add a `seqno` field here.
};

export type GetByVariantAndPubkeyConfigDump = (
  variant: ConfigWrapperObjectTypes,
  pubkey: string
) => Array<ConfigDumpRow>;
export type GetByPubkeyConfigDump = (pubkey: string) => Array<ConfigDumpRow>;
export type SaveConfigDump = (dump: ConfigDumpRow) => void;
export type GetAllDumps = () => Array<ConfigDumpRow>;

export type ConfigDumpDataNode = {
  getConfigDumpByVariantAndPubkey: GetByVariantAndPubkeyConfigDump;
  getConfigDumpsByPubkey: GetByPubkeyConfigDump;
  saveConfigDump: SaveConfigDump;
  getAllDumpsWithData: GetAllDumps;
  getAllDumpsWithoutData: GetAllDumps;
};
