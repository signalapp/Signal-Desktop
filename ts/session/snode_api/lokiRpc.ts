import { default as insecureNodeFetch } from 'node-fetch';
import pRetry from 'p-retry';
import { Snode } from '../../data/data';
import { getStoragePubKey } from '../types';

import {
  ERROR_421_HANDLED_RETRY_REQUEST,
  lokiOnionFetch,
  snodeHttpsAgent,
  SnodeResponse,
} from './onions';

interface FetchOptions {
  method: string;
  body?: string;
  agent?: any;
}

/**
 * A small wrapper around node-fetch which deserializes response
 * returns insecureNodeFetch response or false
 */
async function lokiFetch({
  options,
  url,
  associatedWith,
  targetNode,
}: {
  url: string;
  options: FetchOptions;
  targetNode?: Snode;
  associatedWith?: string;
}): Promise<undefined | SnodeResponse> {
  const timeout = 10000;
  const method = options.method || 'GET';

  const fetchOptions = {
    ...options,
    timeout,
    method,
  };

  try {
    // Absence of targetNode indicates that we want a direct connection
    // (e.g. to connect to a seed node for the first time)
    const useOnionRequests =
      window.lokiFeatureFlags?.useOnionRequests === undefined
        ? true
        : window.lokiFeatureFlags?.useOnionRequests;
    if (useOnionRequests && targetNode) {
      const fetchResult = await lokiOnionFetch({
        targetNode,
        body: fetchOptions.body,
        associatedWith,
      });
      if (!fetchResult) {
        return undefined;
      }
      return fetchResult;
    }

    if (url.match(/https:\/\//)) {
      // import that this does not get set in lokiFetch fetchOptions
      fetchOptions.agent = snodeHttpsAgent;
    }

    (fetchOptions as any).headers = {
      'User-Agent': 'WhatsApp',
      'Accept-Language': 'en-us',
    };

    window?.log?.warn(`insecureNodeFetch => lokiFetch of ${url}`);

    const response = await insecureNodeFetch(url, fetchOptions);

    if (!response.ok) {
      throw new window.textsecure.HTTPError('Loki_rpc error', response);
    }
    const result = await response.text();

    return {
      body: result,
      status: response.status,
    };
  } catch (e) {
    if (e.code === 'ENOTFOUND') {
      throw new window.textsecure.NotFoundError('Failed to resolve address', e);
    }
    if (e.message === ERROR_421_HANDLED_RETRY_REQUEST) {
      throw new pRetry.AbortError(ERROR_421_HANDLED_RETRY_REQUEST);
    }
    throw e;
  }
}

/**
 * This function will throw for a few reasons.
 * The loki-important ones are
 *  -> if we try to make a request to a path which fails too many times => user will need to retry himself
 *  -> if the targetNode gets too many errors => we will need to try to do this request again with another target node
 * The
 */
export async function snodeRpc(
  {
    method,
    params,
    targetNode,
    associatedWith,
  }: {
    method: string;
    params: any;
    targetNode: Snode;
    associatedWith?: string;
  } //the user pubkey this call is for. if the onion request fails, this is used to handle the error for this user swarm for instance
): Promise<undefined | SnodeResponse> {
  const url = `https://${targetNode.ip}:${targetNode.port}/storage_rpc/v1`;

  // TODO: The jsonrpc and body field will be ignored on storage server
  if (params.pubKey) {
    // Ensure we always take a copy
    // tslint:disable-next-line no-parameter-reassignment
    params = {
      ...params,
      pubKey: getStoragePubKey(params.pubKey),
    };
  }
  const body = {
    jsonrpc: '2.0',
    id: '0',
    method,
    params,
  };

  const fetchOptions = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  };

  return lokiFetch({
    url,
    options: fetchOptions,
    targetNode,
    associatedWith,
  });
}
