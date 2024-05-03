import { SharedConfigMessage } from '../../messages/outgoing/controlMessage/SharedConfigMessage';
import { SnodeNamespaces } from './namespaces';

export type SwarmForSubRequest = { method: 'get_swarm'; params: { pubkey: string } };

type RetrieveMaxCountSize = { max_count?: number; max_size?: number };
type RetrieveAlwaysNeeded = {
  pubkey: string;
  namespace: number;
  last_hash: string;
  timestamp?: number;
};

export type RetrievePubkeySubRequestType = {
  method: 'retrieve';
  params: {
    signature: string;
    pubkey_ed25519: string;
    namespace: number;
  } & RetrieveAlwaysNeeded &
    RetrieveMaxCountSize;
};

/** Those namespaces do not require to be authenticated for storing messages.
 *  -> 0 is used for our swarm, and anyone needs to be able to send message to us.
 *  -> -10 is used for legacy closed group and we do not have authentication for them yet (but we will with the new closed groups)
 *  -> others are currently unused
 *
 */
// type UnauthenticatedStoreNamespaces = -30 | -20 | -10 | 0 | 10 | 20 | 30;

export type RetrieveLegacyClosedGroupSubRequestType = {
  method: 'retrieve';
  params: {
    namespace: SnodeNamespaces.ClosedGroupMessage; // legacy closed groups retrieve are not authenticated because the clients do not have a shared key
  } & RetrieveAlwaysNeeded &
    RetrieveMaxCountSize;
};

export type RetrieveSubKeySubRequestType = {
  method: 'retrieve';
  params: {
    subkey: string; // 32-byte hex encoded string
    signature: string;
    namespace: number;
  } & RetrieveAlwaysNeeded &
    RetrieveMaxCountSize;
};

export type RetrieveSubRequestType =
  | RetrieveLegacyClosedGroupSubRequestType
  | RetrievePubkeySubRequestType
  | RetrieveSubKeySubRequestType
  | UpdateExpiryOnNodeSubRequest;

/**
 * OXEND_REQUESTS
 */
export type OnsResolveSubRequest = {
  method: 'oxend_request';
  params: {
    endpoint: 'ons_resolve';
    params: {
      type: 0;
      name_hash: string; // base64EncodedNameHash
    };
  };
};

/**
 * If you are thinking of adding the `limit` field here: don't.
 * We fetch the full list because we will remove from every cached swarms the snodes not found in that fresh list.
 * If a `limit` was set, we would remove a lot of valid snodes from those cached swarms.
 */
type FetchSnodeListParams = {
  active_only: true;
  fields: {
    public_ip: true;
    storage_port: true;
    pubkey_x25519: true;
    pubkey_ed25519: true;
  };
};

export type GetServicesNodesFromSeedRequest = {
  method: 'get_n_service_nodes';
  jsonrpc: '2.0';
  /**
   * If you are thinking of adding the `limit` field here: don't.
   * We fetch the full list because we will remove from every cached swarms the snodes not found in that fresh list.
   * If the limit was set, we would remove a lot of valid snodes from the swarms we've already fetched.
   */
  params: FetchSnodeListParams;
};

export type GetServiceNodesSubRequest = {
  method: 'oxend_request';
  params: {
    endpoint: 'get_service_nodes';
    /**
     * If you are thinking of adding the `limit` field here: don't.
     * We fetch the full list because we will remove from every cached swarms the snodes not found in that fresh list.
     * If the limit was set, we would remove a lot of valid snodes from the swarms we've already fetched.
     */
    params: FetchSnodeListParams;
  };
};

export type StoreOnNodeParams = {
  pubkey: string;
  ttl: number;
  timestamp: number;
  data: string;
  namespace: number;
  // sig_timestamp?: number;
  signature?: string;
  pubkey_ed25519?: string;
};

export type StoreOnNodeParamsNoSig = Pick<
  StoreOnNodeParams,
  'pubkey' | 'ttl' | 'timestamp' | 'ttl' | 'namespace'
> & { data64: string };

export type DeleteFromNodeWithTimestampParams = {
  timestamp: string | number;
  namespace: number | null | 'all';
} & DeleteSigParameters;
export type DeleteByHashesFromNodeParams = { messages: Array<string> } & DeleteSigParameters;

export type StoreOnNodeMessage = {
  pubkey: string;
  timestamp: number;
  namespace: number;
  message: SharedConfigMessage;
};

export type StoreOnNodeSubRequest = { method: 'store'; params: StoreOnNodeParams };
export type NetworkTimeSubRequest = { method: 'info'; params: object };

type DeleteSigParameters = {
  pubkey: string;
  pubkey_ed25519: string;
  signature: string;
};

export type DeleteAllFromNodeSubRequest = {
  method: 'delete_all';
  params: DeleteFromNodeWithTimestampParams;
};

export type DeleteFromNodeSubRequest = {
  method: 'delete';
  params: DeleteByHashesFromNodeParams;
};

export type UpdateExpireNodeParams = {
  pubkey: string;
  pubkey_ed25519: string;
  messages: Array<string>; // Must have at least 2 arguments until the next storage server release (check fakeHash)
  expiry: number;
  signature: string;
  extend?: boolean;
  shorten?: boolean;
};

export type UpdateExpiryOnNodeSubRequest = {
  method: 'expire';
  params: UpdateExpireNodeParams;
};

export type GetExpiriesNodeParams = {
  pubkey: string;
  pubkey_ed25519: string;
  messages: Array<string>;
  timestamp: number;
  signature: string;
};

export type GetExpiriesFromNodeSubRequest = {
  method: 'get_expiries';
  params: GetExpiriesNodeParams;
};

// Until the next storage server release is released, we need to have at least 2 hashes in the list for the `get_expiries` AND for the `update_expiries`
export const fakeHash = '///////////////////////////////////////////';

export type OxendSubRequest = OnsResolveSubRequest | GetServiceNodesSubRequest;

export type SnodeApiSubRequests =
  | RetrieveSubRequestType
  | SwarmForSubRequest
  | OxendSubRequest
  | StoreOnNodeSubRequest
  | NetworkTimeSubRequest
  | DeleteFromNodeSubRequest
  | DeleteAllFromNodeSubRequest
  | UpdateExpiryOnNodeSubRequest
  | GetExpiriesFromNodeSubRequest;

// eslint-disable-next-line @typescript-eslint/array-type
export type NonEmptyArray<T> = [T, ...T[]];

export type NotEmptyArrayOfBatchResults = NonEmptyArray<{
  code: number;
  body: Record<string, any>;
}>;

export type WithShortenOrExtend = { shortenOrExtend: 'shorten' | 'extend' | '' };

export const MAX_SUBREQUESTS_COUNT = 20;
