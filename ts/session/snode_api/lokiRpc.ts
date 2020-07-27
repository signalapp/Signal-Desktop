import fetch from 'node-fetch';
import https from 'https';

import { Snode } from './snodePool';

import { lokiOnionFetch, SnodeResponse } from './onions';
import { sendToProxy } from './proxy';

const snodeHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

async function lokiPlainFetch(
  url: string,
  fetchOptions: any
): Promise<boolean | SnodeResponse> {
  const { log } = window;

  if (url.match(/https:\/\//)) {
    // import that this does not get set in sendToProxy fetchOptions
    fetchOptions.agent = snodeHttpsAgent;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  } else {
    log.debug('lokirpc:::lokiFetch - http communication', url);
  }
  const response = await fetch(url, fetchOptions);
  // restore TLS checking
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

  if (!response.ok) {
    throw new window.textsecure.HTTPError('Loki_rpc error', response);
  }
  const result = await response.text();

  return {
    body: result,
    status: response.status,
  };
}

interface FetchOptions {
  method: string;
}

// A small wrapper around node-fetch which deserializes response
// returns nodeFetch response or false
async function lokiFetch(
  url: string,
  options: FetchOptions,
  targetNode?: Snode
): Promise<boolean | SnodeResponse> {
  const timeout = 10000;
  const method = options.method || 'GET';

  const fetchOptions: any = {
    ...options,
    timeout,
    method,
  };

  try {
    // Absence of targetNode indicates that we want a direct connection
    // (e.g. to connect to a seed node for the first time)
    if (window.lokiFeatureFlags.useOnionRequests && targetNode) {
      return await lokiOnionFetch(fetchOptions.body, targetNode);
    }

    if (window.lokiFeatureFlags.useSnodeProxy && targetNode) {
      return await sendToProxy(fetchOptions, targetNode);
    }

    return await lokiPlainFetch(url, fetchOptions);
  } catch (e) {
    if (e.code === 'ENOTFOUND') {
      throw new window.textsecure.NotFoundError('Failed to resolve address', e);
    }
    throw e;
  }
}

// Wrapper for a JSON RPC request
// Annoyngly, this is used for Lokid requests too
export async function snodeRpc(
  method: string,
  params: any,
  targetNode: Snode
): Promise<boolean | SnodeResponse> {
  const url = `https://${targetNode.ip}${targetNode.port}/storage_rpc/v1`;

  // TODO: The jsonrpc and body field will be ignored on storage server
  if (params.pubKey) {
    // Ensure we always take a copy
    // tslint:disable-next-line no-parameter-reassignment
    params = {
      ...params,
      pubKey: window.getStoragePubKey(params.pubKey),
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

  return lokiFetch(url, fetchOptions, targetNode);
}
