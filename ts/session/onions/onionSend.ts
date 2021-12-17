// tslint:disable: cyclomatic-complexity

import { OnionPaths } from '.';
import {
  FinalRelayOptions,
  sendOnionRequestHandlingSnodeEject,
  SnodeResponse,
} from '../apis/snode_api/onions';
import _, { toNumber } from 'lodash';
import { PROTOCOLS } from '../constants';
import { toHex } from '../utils/String';
import pRetry from 'p-retry';
import { Snode } from '../../data/data';

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

export type FinalDestinationOptions = {
  destination_ed25519_hex?: string;
  headers?: Record<string, string>;
  body?: string;
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
    pathNodes = await OnionPaths.getOnionPath({});
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

/**
 *
 * This function can be used to make a request via onion to a non snode server.
 *
 * A non Snode server is for instance the Push Notification server or an OpengroupV2 server.
 *
 * FIXME the type for this is not correct for open group api v2 returned values
 * result is status_code and whatever the body should be
 */
export const sendViaOnionToNonSnode = async (
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
        const pathNodes = await getOnionPathForSending();

        if (!pathNodes) {
          throw new Error('getOnionPathForSending is emtpy');
        }

        /**
         * This call handles ejecting a snode or a path if needed. If that happens, it throws a retryable error and the pRetry
         * call above will call us again with the same params but a different path.
         * If the error is not recoverable, it throws a pRetry.AbortError.
         */
        return sendOnionRequestHandlingSnodeEject({
          nodePath: pathNodes,
          destX25519Any: castedDestinationX25519Key,
          finalDestOptions: payloadObj,
          finalRelayOptions,
          abortSignal,
        });
      },
      {
        retries: 2, // retry 3 (2+1) times at most
        minTimeout: 500,
        onFailedAttempt: e => {
          window?.log?.warn(
            `sendViaOnionToNonSnodeRetryable attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
          );
        },
      }
    );
  } catch (e) {
    window?.log?.warn('sendViaOnionToNonSnodeRetryable failed ', e.message);
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
