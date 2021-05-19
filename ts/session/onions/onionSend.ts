// tslint:disable: cyclomatic-complexity

import { OnionPaths } from '.';
import {
  FinalRelayOptions,
  sendOnionRequestLsrpcDest,
  snodeHttpsAgent,
  SnodeResponse,
} from '../snode_api/onions';
import { Snode } from '../snode_api/snodePool';
import _, { toNumber } from 'lodash';
import { default as insecureNodeFetch } from 'node-fetch';
import { PROTOCOLS } from '../constants';
import { toHex } from '../utils/String';
import pRetry from 'p-retry';

// FIXME: replace with something on urlPubkeyMap...
const FILESERVER_HOSTS = [
  'file-dev.lokinet.org',
  'file.lokinet.org',
  'file-dev.getsession.org',
  'file.getsession.org',
];

type OnionFetchOptions = {
  method: string;
  body?: string;
  headers?: Record<string, string>;
};

type OnionFetchBasicOptions = {
  retry?: number;
  noJson?: boolean;
};

type OnionPayloadObj = {
  method: string;
  endpoint: string;
  body: any;
  headers: Record<string, any>;
};

const buildSendViaOnionPayload = (url: URL, fetchOptions: OnionFetchOptions): OnionPayloadObj => {
  let tempHeaders = fetchOptions.headers || {};
  const payloadObj = {
    method: fetchOptions.method || 'GET',
    body: fetchOptions.body || ('' as any),
    // safety issue with file server, just safer to have this
    // no initial /
    endpoint: url.pathname.replace(/^\//, ''),
    headers: {},
  };
  if (url.search) {
    payloadObj.endpoint += url.search;
  }

  // from https://github.com/sindresorhus/is-stream/blob/master/index.js
  if (
    payloadObj.body &&
    typeof payloadObj.body === 'object' &&
    typeof payloadObj.body.pipe === 'function'
  ) {
    const fData = payloadObj.body.getBuffer();
    const fHeaders = payloadObj.body.getHeaders();
    tempHeaders = { ...tempHeaders, ...fHeaders };
    // update headers for boundary
    // update body with base64 chunk
    payloadObj.body = {
      fileUpload: fData.toString('base64'),
    };
  }
  payloadObj.headers = tempHeaders;
  return payloadObj;
};

export const getOnionPathForSending = async () => {
  let pathNodes: Array<Snode> = [];
  try {
    pathNodes = await OnionPaths.getOnionPath();
  } catch (e) {
    window?.log?.error(`sendViaOnion - getOnionPath Error ${e.code} ${e.message}`);
  }
  if (!pathNodes?.length) {
    window?.log?.warn('sendViaOnion - failing, no path available');
    // should we retry?
    return null;
  }
  return pathNodes;
};

const initOptionsWithDefaults = (options: OnionFetchBasicOptions) => {
  const defaultFetchBasicOptions = {
    retry: 0,
    noJson: false,
  };
  return _.defaults(options, defaultFetchBasicOptions);
};

const sendViaOnionRetryable = async ({
  castedDestinationX25519Key,
  finalRelayOptions,
  payloadObj,
  abortSignal,
}: {
  castedDestinationX25519Key: string;
  finalRelayOptions: FinalRelayOptions;
  payloadObj: OnionPayloadObj;
  abortSignal?: AbortSignal;
}) => {
  const pathNodes = await getOnionPathForSending();

  if (!pathNodes) {
    throw new Error('getOnionPathForSending is emtpy');
  }

  // this call throws a normal error (which will trigger a retry) if a retryable is got (bad path or whatever)
  // it throws an AbortError in case the retry should not be retried again (aborted, or )
  const result = await sendOnionRequestLsrpcDest(
    pathNodes,
    castedDestinationX25519Key,
    finalRelayOptions,
    payloadObj,
    abortSignal
  );

  return result;
};

/**
 * FIXME the type for this is not correct for open group api v2 returned values
 * result is status_code and whatever the body should be
 */
export const sendViaOnion = async (
  destinationX25519Key: string,
  url: URL,
  fetchOptions: OnionFetchOptions,
  options: OnionFetchBasicOptions = {},
  abortSignal?: AbortSignal
): Promise<{
  result: SnodeResponse;
  txtResponse: string;
  response: string;
} | null> => {
  const castedDestinationX25519Key =
    typeof destinationX25519Key !== 'string' ? toHex(destinationX25519Key) : destinationX25519Key;
  // FIXME audric looks like this might happen for opengroupv1
  if (!destinationX25519Key || typeof destinationX25519Key !== 'string') {
    window?.log?.error('sendViaOnion - called without a server public key or not a string key');
  }

  const defaultedOptions = initOptionsWithDefaults(options);

  const payloadObj = buildSendViaOnionPayload(url, fetchOptions);
  // if protocol is forced to 'http:' => just use http (without the ':').
  // otherwise use https as protocol (this is the default)
  const forcedHttp = url.protocol === PROTOCOLS.HTTP;
  const finalRelayOptions: FinalRelayOptions = {
    host: url.hostname,
  };

  if (forcedHttp) {
    finalRelayOptions.protocol = 'http';
  }
  if (forcedHttp) {
    finalRelayOptions.port = url.port ? toNumber(url.port) : 80;
  }

  let result: SnodeResponse;
  try {
    result = await pRetry(
      async () => {
        return sendViaOnionRetryable({
          castedDestinationX25519Key,
          finalRelayOptions,
          payloadObj,
          abortSignal,
        });
      },
      {
        retries: 10, // each path can fail 3 times before being dropped, we have 3 paths at most
        factor: 2,
        minTimeout: 200,
        maxTimeout: 4000,
        onFailedAttempt: e => {
          window?.log?.warn(
            `sendViaOnionRetryable attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
          );
        },
      }
    );
  } catch (e) {
    window?.log?.warn('sendViaOnionRetryable failed ', e);
    console.warn('error to show to user', e);
    return null;
  }

  // If we expect something which is not json, just return the body we got.
  if (defaultedOptions.noJson) {
    return {
      result,
      txtResponse: result.body,
      response: result.body,
    };
  }

  // get the return variables we need
  let txtResponse = '';

  let { body } = result;
  if (typeof body === 'string') {
    // adn does uses this path
    // log.info(`sendViaOnion - got text response ${url.toString()}`);
    txtResponse = result.body;
    try {
      body = JSON.parse(result.body);
    } catch (e) {
      window?.log?.error("sendViaOnion Can't decode JSON body", typeof result.body, result.body);
    }
  }
  // result.status has the http response code
  if (!txtResponse) {
    txtResponse = JSON.stringify(body);
  }
  return { result, txtResponse, response: body };
};

// FIXME this is really dirty
type ServerRequestOptionsType = {
  params?: Record<string, string>;
  method?: string;
  rawBody?: any;
  objBody?: any;
  token?: string;
  srvPubKey?: string;
  forceFreshToken?: boolean;

  retry?: number;
  noJson?: boolean;
};

// tslint:disable-next-line: max-func-body-length
export const serverRequest = async (
  endpoint: string,
  options: ServerRequestOptionsType = {}
): Promise<any> => {
  const {
    params = {},
    method,
    rawBody,
    objBody,
    token,
    srvPubKey,
    forceFreshToken = false,
  } = options;

  const url = new URL(endpoint);
  if (!_.isEmpty(params)) {
    const builtParams = new URLSearchParams(params).toString();
    url.search = `?${builtParams}`;
  }
  const fetchOptions: any = {};
  const headers: any = {};
  try {
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (method) {
      fetchOptions.method = method;
    }
    if (objBody) {
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(objBody);
    } else if (rawBody) {
      fetchOptions.body = rawBody;
    }
    fetchOptions.headers = headers;

    // domain ends in .loki
    if (url.host.match(/\.loki$/i)) {
      fetchOptions.agent = snodeHttpsAgent;
    }
  } catch (e) {
    window?.log?.error('loki_app_dot_net:::serverRequest - set up error:', e.code, e.message);
    return {
      err: e,
      ok: false,
    };
  }

  let response;
  let result;
  let txtResponse;
  let mode = 'insecureNodeFetch';
  try {
    const host = url.host.toLowerCase();
    // log.info('host', host, FILESERVER_HOSTS);
    if (window.lokiFeatureFlags.useFileOnionRequests && FILESERVER_HOSTS.includes(host)) {
      mode = 'sendViaOnion';
      if (!srvPubKey) {
        throw new Error('useFileOnionRequests=true but we do not have a server pubkey set.');
      }
      const onionResponse = await sendViaOnion(srvPubKey, url, fetchOptions, options);
      if (onionResponse) {
        ({ response, txtResponse, result } = onionResponse);
      }
    } else if (window.lokiFeatureFlags.useFileOnionRequests) {
      if (!srvPubKey) {
        throw new Error('useFileOnionRequests=true but we do not have a server pubkey set.');
      }
      mode = 'sendViaOnionOG';
      const onionResponse = await sendViaOnion(srvPubKey, url, fetchOptions, options);
      if (onionResponse) {
        ({ response, txtResponse, result } = onionResponse);
      }
    } else {
      // we end up here only if window.lokiFeatureFlags.useFileOnionRequests is false
      window?.log?.info(`insecureNodeFetch => plaintext for ${url}`);
      result = await insecureNodeFetch(url, fetchOptions);

      txtResponse = await result.text();
      // cloudflare timeouts (504s) will be html...
      response = options.noJson ? txtResponse : JSON.parse(txtResponse);

      // result.status will always be 200
      // emulate the correct http code if available
      if (response && response.meta && response.meta.code) {
        result.status = response.meta.code;
      }
    }
  } catch (e) {
    if (txtResponse) {
      window?.log?.error(
        `loki_app_dot_net:::serverRequest - ${mode} error`,
        e.code,
        e.message,
        `json: ${txtResponse}`,
        'attempting connection to',
        url.toString()
      );
    } else {
      window?.log?.error(
        `loki_app_dot_net:::serverRequest - ${mode} error`,
        e.code,
        e.message,
        'attempting connection to',
        url.toString()
      );
    }

    return {
      err: e,
      ok: false,
    };
  }

  if (!result) {
    return {
      err: 'noResult',
      response,
      ok: false,
    };
  }

  // if it's a response style with a meta
  if (result.status !== 200) {
    if (!forceFreshToken && (!response.meta || response.meta.code === 401)) {
      // retry with forcing a fresh token
      return serverRequest(endpoint, {
        ...options,
        forceFreshToken: true,
      });
    }
    return {
      err: 'statusCode',
      statusCode: result.status,
      response,
      ok: false,
    };
  }
  return {
    statusCode: result.status,
    response,
    ok: result.status >= 200 && result.status <= 299,
  };
};
