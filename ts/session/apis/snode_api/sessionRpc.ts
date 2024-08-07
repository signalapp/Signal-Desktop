import https from 'https';
import { clone } from 'lodash';
// eslint-disable-next-line import/no-named-default
import { default as insecureNodeFetch } from 'node-fetch';
import pRetry from 'p-retry';

import { Snode } from '../../../data/types';
import { HTTPError, NotFoundError } from '../../utils/errors';

import { APPLICATION_JSON } from '../../../types/MIME';
import { ERROR_421_HANDLED_RETRY_REQUEST, Onions, snodeHttpsAgent, SnodeResponse } from './onions';

export interface LokiFetchOptions {
  method: 'GET' | 'POST';
  body: string | null;
  agent: https.Agent | null;
  headers: Record<string, string>;
}

/**
 * A small wrapper around node-fetch which deserializes response
 * returns insecureNodeFetch response or false
 */
async function doRequest({
  options,
  url,
  associatedWith,
  targetNode,
  timeout,
}: {
  url: string;
  options: LokiFetchOptions;
  targetNode?: Snode;
  associatedWith: string | null;
  timeout: number;
}): Promise<undefined | SnodeResponse> {
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
      window.sessionFeatureFlags?.useOnionRequests === undefined
        ? true
        : window.sessionFeatureFlags?.useOnionRequests;
    if (useOnionRequests && targetNode) {
      const fetchResult = await Onions.lokiOnionFetch({
        targetNode,
        body: fetchOptions.body,
        headers: fetchOptions.headers,
        associatedWith: associatedWith || undefined,
      });
      if (!fetchResult) {
        return undefined;
      }
      return fetchResult;
    }

    if (url.match(/https:\/\//)) {
      // import that this does not get set in doRequest fetchOptions
      fetchOptions.agent = snodeHttpsAgent;
    }

    fetchOptions.headers = {
      'User-Agent': 'WhatsApp',
      'Accept-Language': 'en-us',
      'Content-Type': APPLICATION_JSON,
    };

    window?.log?.warn(`insecureNodeFetch => doRequest of ${url}`);

    const response = await insecureNodeFetch(url, {
      ...fetchOptions,
      body: fetchOptions.body || undefined,
      agent: fetchOptions.agent || undefined,
    });
    if (!response.ok) {
      throw new HTTPError('Loki_rpc error', response);
    }
    const result = await response.text();

    return {
      body: result,
      status: response.status,
      bodyBinary: null,
    };
  } catch (e) {
    if (e.code === 'ENOTFOUND') {
      throw new NotFoundError('Failed to resolve address', e);
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
    timeout = 10000,
  }: {
    method: string;
    params: Record<string, any> | Array<Record<string, any>>;
    targetNode: Snode;
    associatedWith: string | null;
    timeout?: number;
  } // the user pubkey this call is for. if the onion request fails, this is used to handle the error for this user swarm for instance
): Promise<undefined | SnodeResponse> {
  const url = `https://${targetNode.ip}:${targetNode.port}/storage_rpc/v1`;

  const body = {
    jsonrpc: '2.0',
    method,
    params: clone(params),
  };

  const fetchOptions: LokiFetchOptions = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': APPLICATION_JSON },
    agent: null,
  };

  return doRequest({
    url,
    options: fetchOptions,
    targetNode,
    associatedWith,
    timeout,
  });
}
