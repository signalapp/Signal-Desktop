// tslint:disable: cyclomatic-complexity

import { OnionPaths } from '.';
import {
  FinalRelayOptions,
  RequestError,
  sendOnionRequestLsrpcDest,
  snodeHttpsAgent,
  SnodeResponse,
} from '../snode_api/onions';
import { Snode } from '../snode_api/snodePool';
import _ from 'lodash';
import { default as insecureNodeFetch } from 'node-fetch';

// FIXME: replace with something on urlPubkeyMap...
const FILESERVER_HOSTS = [
  'file-dev.lokinet.org',
  'file.lokinet.org',
  'file-dev.getsession.org',
  'file.getsession.org',
];

const MAX_SEND_ONION_RETRIES = 3;

type OnionFetchOptions = {
  method: string;
  body?: string;
  headers?: Record<string, string>;
};

type OnionFetchBasicOptions = {
  retry?: number;
  requestNumber?: number;
  // tslint:disable-next-line: max-func-body-length
  noJson?: boolean;
  counter?: number;
};

export const sendViaOnion = async (
  srvPubKey: string,
  url: URL,
  fetchOptions: OnionFetchOptions,
  options: OnionFetchBasicOptions = {}
): Promise<any> => {
  if (!srvPubKey) {
    window.log.error('sendViaOnion - called without a server public key');
    return {};
  }

  if (options.retry === undefined) {
    // set retry count
    options.retry = 0;
  }
  if (options.requestNumber === undefined) {
    options.requestNumber = OnionPaths.getInstance().assignOnionRequestNumber();
  }

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
    tempHeaders = { ...tempHeaders, fHeaders };
    // update headers for boundary
    // update body with base64 chunk
    payloadObj.body = {
      fileUpload: fData.toString('base64'),
    };
  }

  let pathNodes: Array<Snode> = [];
  try {
    pathNodes = await OnionPaths.getInstance().getOnionPath();
  } catch (e) {
    window.log.error(
      `sendViaOnion #${options.requestNumber} - getOnionPath Error ${e.code} ${e.message}`
    );
  }
  if (!pathNodes || !pathNodes.length) {
    window.log.warn(
      `sendViaOnion #${options.requestNumber} - failing, no path available`
    );
    // should we retry?
    return {};
  }

  // do the request
  let result: SnodeResponse | RequestError;
  try {
    const finalRelayOptions: FinalRelayOptions = {
      host: url.host,
      // FIXME http open groups v2 are not working
      // protocol: url.protocol,
      // port: url.port,
    };
    payloadObj.headers = tempHeaders;
    console.warn('sendViaOnion payloadObj ==> ', payloadObj);

    result = await sendOnionRequestLsrpcDest(
      0,
      pathNodes,
      srvPubKey,
      finalRelayOptions,
      payloadObj,
      options.requestNumber
    );
  } catch (e) {
    window.log.error('sendViaOnion - lokiRpcUtils error', e.code, e.message);
    return {};
  }

  // RequestError return type is seen as number (as it is an enum)
  if (typeof result === 'number') {
    window.log.error(
      'sendOnionRequestLsrpcDest() returned a number indicating an error: ',
      result === RequestError.BAD_PATH ? 'BAD_PATH' : 'OTHER'
    );
    // handle error/retries, this is a RequestError
    window.log.error(
      `sendViaOnion #${options.requestNumber} - Retry #${options.retry} Couldnt handle onion request, retrying`,
      payloadObj
    );
    if (options.retry && options.retry >= MAX_SEND_ONION_RETRIES) {
      window.log.error(
        `sendViaOnion too many retries: ${options.retry}. Stopping retries.`
      );
      return {};
    }
    return sendViaOnion(srvPubKey, url, fetchOptions, {
      ...options,
      retry: options.retry + 1,
      counter: options.requestNumber,
    });
  }

  // If we expect something which is not json, just return the body we got.
  if (options.noJson) {
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
      window.log.error(
        `sendViaOnion #${options.requestNumber} - Can't decode JSON body`,
        typeof result.body,
        result.body
      );
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
  requestNumber?: number;
  noJson?: boolean;
  counter?: number;
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
    window.log.error(
      'loki_app_dot_net:::serverRequest - set up error:',
      e.code,
      e.message
    );
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
    if (
      window.lokiFeatureFlags.useFileOnionRequests &&
      FILESERVER_HOSTS.includes(host)
    ) {
      mode = 'sendViaOnion';
      if (!srvPubKey) {
        throw new Error(
          'useFileOnionRequests=true but we do not have a server pubkey set.'
        );
      }
      ({ response, txtResponse, result } = await sendViaOnion(
        srvPubKey,
        url,
        fetchOptions,
        options
      ));
    } else if (window.lokiFeatureFlags.useFileOnionRequests) {
      if (!srvPubKey) {
        throw new Error(
          'useFileOnionRequests=true but we do not have a server pubkey set.'
        );
      }
      mode = 'sendViaOnionOG';
      ({ response, txtResponse, result } = await sendViaOnion(
        srvPubKey,
        url,
        fetchOptions,
        options
      ));
    } else {
      // we end up here only if window.lokiFeatureFlags.useFileOnionRequests is false
      window.log.info(`insecureNodeFetch => plaintext for ${url}`);
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
      window.log.error(
        `loki_app_dot_net:::serverRequest - ${mode} error`,
        e.code,
        e.message,
        `json: ${txtResponse}`,
        'attempting connection to',
        url.toString()
      );
    } else {
      window.log.error(
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
