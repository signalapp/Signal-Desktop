import { AbortSignal } from 'abort-controller';
import { toNumber } from 'lodash';
import pRetry from 'p-retry';

import { OnionPaths } from '.';
import { Snode } from '../../data/types';
import { fileServerPubKey, fileServerURL } from '../apis/file_server_api/FileServerApi';
import { OpenGroupPollingUtils } from '../apis/open_group_api/opengroupV2/OpenGroupPollingUtils';
import { invalidAuthRequiresBlinding } from '../apis/open_group_api/opengroupV2/OpenGroupServerPoller';
import {
  addBinaryContentTypeToHeaders,
  addJsonContentTypeToHeaders,
} from '../apis/open_group_api/sogsv3/sogsV3SendMessage';
import { pnServerPubkeyHex, pnServerUrl } from '../apis/push_notification_api/PnServer';
import {
  FinalDestNonSnodeOptions,
  FinalRelayOptions,
  Onions,
  STATUS_NO_STATUS,
  SnodeResponse,
  buildErrorMessageWithFailedCode,
} from '../apis/snode_api/onions';
import { PROTOCOLS } from '../constants';
import { OnionV4 } from './onionv4';

export type OnionFetchOptions = {
  method: string;
  body: string | Uint8Array | null;
  headers: Record<string, string | number>;
  useV4: boolean;
};

// NOTE some endpoints require decoded strings
const endpointExceptions = ['/reaction'];
const endpointRequiresDecoding = (url: string): string => {
  for (let i = 0; i < endpointExceptions.length; i++) {
    if (url.includes(endpointExceptions[i])) {
      return decodeURIComponent(url);
    }
  }
  return url;
};

const buildSendViaOnionPayload = (
  url: URL,
  fetchOptions: OnionFetchOptions
): FinalDestNonSnodeOptions => {
  const endpoint = OnionSending.endpointRequiresDecoding(
    url.search ? `${url.pathname}${url.search}` : url.pathname
  );

  const payloadObj: FinalDestNonSnodeOptions = {
    method: fetchOptions.method || 'GET',
    body: fetchOptions.body,
    endpoint,
    headers: fetchOptions.headers || {},
  };

  // the usev4 field is skipped here, as the snode doing the request won't care about it
  return payloadObj;
};

const getOnionPathForSending = async () => {
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

export type OnionSnodeResponse = {
  result: SnodeResponse;
  txtResponse: string;
  response: string;
};

export type OnionV4SnodeResponse = {
  body: string | object | null; // if the content can be decoded as string
  bodyBinary: Uint8Array | null; // otherwise we return the raw content (could be an image data or file from sogs/fileserver)
  status_code: number;
};

export type OnionV4JSONSnodeResponse = {
  body: Record<string, any> | null;
  status_code: number;
};

export type OnionV4BinarySnodeResponse = {
  bodyBinary: Uint8Array | null;
  status_code: number;
};

/**
 * Build & send an onion v4 request to a non snode, and handle retries.
 * We actually can only send v4 request to non snode, as the snodes themselves do not support v4 request as destination.
 */

const sendViaOnionV4ToNonSnodeWithRetries = async (
  destinationX25519Key: string,
  url: URL,
  fetchOptions: OnionFetchOptions,
  throwErrors: boolean,
  abortSignal?: AbortSignal
): Promise<OnionV4SnodeResponse | null> => {
  if (!fetchOptions.useV4) {
    throw new Error('sendViaOnionV4ToNonSnodeWithRetries is only to be used for onion v4 calls');
  }

  if (typeof destinationX25519Key !== 'string') {
    throw new Error(`destinationX25519Key is not a string ${typeof destinationX25519Key})a`);
  }

  const payloadObj = buildSendViaOnionPayload(url, fetchOptions);

  if (window.sessionFeatureFlags?.debug.debugNonSnodeRequests) {
    window.log.info(
      'sendViaOnionV4ToNonSnodeWithRetries: buildSendViaOnionPayload returned ',
      JSON.stringify(payloadObj)
    );
  }
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

  let result: OnionV4SnodeResponse | null;
  try {
    result = await pRetry(
      async () => {
        const pathNodes = await OnionSending.getOnionPathForSending();
        if (window.sessionFeatureFlags?.debug.debugNonSnodeRequests) {
          window.log.info(
            'sendViaOnionV4ToNonSnodeWithRetries: getOnionPathForSending returned',
            JSON.stringify(pathNodes)
          );
        }
        if (!pathNodes) {
          throw new Error('getOnionPathForSending is emtpy');
        }

        /**
         * This call handles ejecting a snode or a path if needed. If that happens, it throws a retryable error and the pRetry
         * call above will call us again with the same params but a different path.
         * If the error is not recoverable, it throws a pRetry.AbortError.
         */
        const onionV4Response = await Onions.sendOnionRequestHandlingSnodeEject({
          nodePath: pathNodes,
          destSnodeX25519: destinationX25519Key,
          finalDestOptions: payloadObj,
          finalRelayOptions,
          abortSignal,
          useV4: true,
          throwErrors,
        });

        if (window.sessionFeatureFlags?.debug.debugNonSnodeRequests) {
          window.log.info(
            'sendViaOnionV4ToNonSnodeWithRetries: sendOnionRequestHandlingSnodeEject returned: ',
            JSON.stringify(onionV4Response)
          );
        }

        if (abortSignal?.aborted) {
          // if the request was aborted, we just want to stop retries.
          window?.log?.warn('sendViaOnionV4ToNonSnodeRetryable request aborted.');

          throw new pRetry.AbortError('Request Aborted');
        }

        if (!onionV4Response) {
          // v4 failed responses result is undefined
          window?.log?.warn('sendViaOnionV4ToNonSnodeRetryable failed during V4 request (in)');
          throw new Error(
            'sendViaOnionV4ToNonSnodeRetryable failed during V4 request. Retrying...'
          );
        }

        // This only decodes single entries for now.
        // We decode it here, because if the result status code is not valid, we want to trigger a retry (by throwing an error)
        const decodedV4 = OnionV4.decodeV4Response(onionV4Response);

        // the pn server replies with the decodedV4?.metadata as any)?.code syntax too since onion v4
        const foundStatusCode = decodedV4?.metadata?.code || STATUS_NO_STATUS;
        if (foundStatusCode < 200 || foundStatusCode > 299) {
          // this is temporary (as of 27/06/2022) as we want to not support unblinded sogs after some time

          if (
            foundStatusCode === 400 &&
            (decodedV4?.body as any).plainText === invalidAuthRequiresBlinding
          ) {
            return {
              status_code: foundStatusCode,
              body: decodedV4?.body || null,
              bodyBinary: decodedV4?.bodyBinary || null,
            };
          }
          if (foundStatusCode === 404) {
            window.log.warn(
              `Got 404 while sendViaOnionV4ToNonSnodeWithRetries with url:${url}. Stopping retries`
            );
            // most likely, a 404 won't fix itself. So just stop right here retries by throwing a non retryable error
            throw new pRetry.AbortError(
              buildErrorMessageWithFailedCode(
                'sendViaOnionV4ToNonSnodeWithRetries',
                404,
                `with url:${url}. Stopping retries`
              )
            );
          }
          // we consider those cases as an error, and trigger a retry (if possible), by throwing a non-abortable error
          throw new Error(
            `sendViaOnionV4ToNonSnodeWithRetries failed with status code: ${foundStatusCode}. Retrying...`
          );
        }
        return {
          status_code: foundStatusCode,
          body: decodedV4?.body || null,
          bodyBinary: decodedV4?.bodyBinary || null,
        };
      },
      {
        retries: 2, // retry 3 (2+1) times at most
        minTimeout: 100,
        onFailedAttempt: e => {
          window?.log?.warn(
            `sendViaOnionV4ToNonSnodeWithRetries attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...: ${e.message}`
          );
        },
      }
    );
  } catch (e) {
    window?.log?.warn('sendViaOnionV4ToNonSnodeWithRetries failed ', e.message, throwErrors);
    if (throwErrors) {
      throw e;
    }
    return null;
  }

  if (abortSignal?.aborted) {
    window?.log?.warn('sendViaOnionV4ToNonSnodeRetryable request aborted.');

    return null;
  }

  if (!result) {
    // v4 failed responses result is undefined
    window?.log?.warn('sendViaOnionV4ToNonSnodeRetryable failed during V4 request (out)');
    return null;
  }

  return result;
};

async function sendJsonViaOnionV4ToSogs(sendOptions: {
  serverUrl: string;
  endpoint: string;
  serverPubkey: string;
  blinded: boolean;
  method: string;
  stringifiedBody: string | null;
  abortSignal: AbortSignal;
  headers: Record<string, any> | null;
  throwErrors: boolean;
}): Promise<OnionV4JSONSnodeResponse | null> {
  const {
    serverUrl,
    endpoint,
    serverPubkey,
    method,
    blinded,
    stringifiedBody,
    abortSignal,
    headers: includedHeaders,
    throwErrors,
  } = sendOptions;
  if (!endpoint.startsWith('/')) {
    throw new Error('endpoint needs a leading /');
  }
  const builtUrl = new URL(`${serverUrl}${endpoint}`);
  let headersWithSogsHeadersIfNeeded = await OpenGroupPollingUtils.getOurOpenGroupHeaders(
    serverPubkey,
    endpoint,
    method,
    blinded,
    stringifiedBody
  );

  if (!headersWithSogsHeadersIfNeeded) {
    return null;
  }
  headersWithSogsHeadersIfNeeded = { ...includedHeaders, ...headersWithSogsHeadersIfNeeded };

  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    serverPubkey,
    builtUrl,
    {
      method,
      headers: addJsonContentTypeToHeaders(headersWithSogsHeadersIfNeeded as any),
      body: stringifiedBody,
      useV4: true,
    },
    throwErrors,
    abortSignal
  );

  return res as OnionV4JSONSnodeResponse;
}

/**
 * Send some json to the PushNotification server.
 * Desktop only send `/notify` requests.
 *
 * You should probably not use this function directly but instead rely on the PnServer.notifyPnServer() function
 */
async function sendJsonViaOnionV4ToPnServer(sendOptions: {
  endpoint: string;
  method: string;
  stringifiedBody: string | null;
  abortSignal: AbortSignal;
}): Promise<OnionV4JSONSnodeResponse | null> {
  const { endpoint, method, stringifiedBody, abortSignal } = sendOptions;
  if (!endpoint.startsWith('/')) {
    throw new Error('endpoint needs a leading /');
  }
  const builtUrl = new URL(`${pnServerUrl}${endpoint}`);

  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    pnServerPubkeyHex,
    builtUrl,
    {
      method,
      headers: {},
      body: stringifiedBody,
      useV4: true,
    },
    false,
    abortSignal
  );
  return res as OnionV4JSONSnodeResponse;
}

async function sendBinaryViaOnionV4ToSogs(sendOptions: {
  serverUrl: string;
  endpoint: string;
  serverPubkey: string;
  blinded: boolean;
  method: string;
  bodyBinary: Uint8Array;
  abortSignal: AbortSignal;
  headers: Record<string, any> | null;
}): Promise<OnionV4JSONSnodeResponse | null> {
  const {
    serverUrl,
    endpoint,
    serverPubkey,
    method,
    blinded,
    bodyBinary,
    abortSignal,
    headers: includedHeaders,
  } = sendOptions;

  if (!bodyBinary) {
    return null;
  }
  if (!endpoint.startsWith('/')) {
    throw new Error('endpoint needs a leading /');
  }
  const builtUrl = new window.URL(`${serverUrl}${endpoint}`);
  let headersWithSogsHeadersIfNeeded = await OpenGroupPollingUtils.getOurOpenGroupHeaders(
    serverPubkey,
    endpoint,
    method,
    blinded,
    bodyBinary
  );

  if (!headersWithSogsHeadersIfNeeded) {
    return null;
  }
  headersWithSogsHeadersIfNeeded = { ...includedHeaders, ...headersWithSogsHeadersIfNeeded };
  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    serverPubkey,
    builtUrl,
    {
      method,
      headers: addBinaryContentTypeToHeaders(headersWithSogsHeadersIfNeeded as any),
      body: bodyBinary || undefined,
      useV4: true,
    },
    false,
    abortSignal
  );

  return res as OnionV4JSONSnodeResponse;
}

/**
 *
 * FILE SERVER REQUESTS
 *
 */

/**
 * Upload binary to the file server.
 * You should probably not use this function directly, but instead rely on the FileServerAPI.uploadFileToFsWithOnionV4()
 */
async function sendBinaryViaOnionV4ToFileServer(sendOptions: {
  endpoint: string;
  method: string;
  bodyBinary: Uint8Array;
  abortSignal: AbortSignal;
}): Promise<OnionV4JSONSnodeResponse | null> {
  const { endpoint, method, bodyBinary, abortSignal } = sendOptions;
  if (!endpoint.startsWith('/')) {
    throw new Error('endpoint needs a leading /');
  }
  const builtUrl = new URL(`${fileServerURL}${endpoint}`);

  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    fileServerPubKey,
    builtUrl,
    {
      method,
      headers: {},
      body: bodyBinary,
      useV4: true,
    },
    false,
    abortSignal
  );

  return res as OnionV4JSONSnodeResponse;
}

/**
 * Download binary from the file server.
 * You should probably not use this function directly, but instead rely on the FileServerAPI.downloadFileFromFileServer()
 */
async function getBinaryViaOnionV4FromFileServer(sendOptions: {
  endpoint: string;
  method: string;
  abortSignal: AbortSignal;
  throwError: boolean;
}): Promise<OnionV4BinarySnodeResponse | null> {
  const { endpoint, method, abortSignal, throwError } = sendOptions;
  if (!endpoint.startsWith('/')) {
    throw new Error('endpoint needs a leading /');
  }
  const builtUrl = new URL(`${fileServerURL}${endpoint}`);

  if (window.sessionFeatureFlags?.debug.debugFileServerRequests) {
    window.log.info(`getBinaryViaOnionV4FromFileServer fsv2: "${builtUrl} `);
  }

  // this throws for a bunch of reasons.
  // One of them, is if we get a 404 (i.e. the file server was reached but reported no such attachments exists)
  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    fileServerPubKey,
    builtUrl,
    {
      method,
      headers: {},
      body: null,
      useV4: true,
    },
    throwError,
    abortSignal
  );

  if (window.sessionFeatureFlags?.debug.debugFileServerRequests) {
    window.log.info(
      `getBinaryViaOnionV4FromFileServer fsv2: "${builtUrl}; got:`,
      JSON.stringify(res)
    );
  }
  return res as OnionV4BinarySnodeResponse;
}

/**
 * Send some generic json to the fileserver.
 * This function should probably not used directly as we only need it for the FileServerApi.getLatestReleaseFromFileServer() function
 */
async function sendJsonViaOnionV4ToFileServer(sendOptions: {
  endpoint: string;
  method: string;
  stringifiedBody: string | null;
  abortSignal: AbortSignal;
}): Promise<OnionV4JSONSnodeResponse | null> {
  const { endpoint, method, stringifiedBody, abortSignal } = sendOptions;
  if (!endpoint.startsWith('/')) {
    throw new Error('endpoint needs a leading /');
  }
  const builtUrl = new URL(`${fileServerURL}${endpoint}`);

  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    fileServerPubKey,
    builtUrl,
    {
      method,
      headers: {},
      body: stringifiedBody,
      useV4: true,
    },
    false,
    abortSignal
  );

  return res as OnionV4JSONSnodeResponse;
}

// we export these methods for stubbing during testing
export const OnionSending = {
  endpointRequiresDecoding,
  sendViaOnionV4ToNonSnodeWithRetries,
  getOnionPathForSending,
  sendJsonViaOnionV4ToSogs,
  sendJsonViaOnionV4ToPnServer,
  sendBinaryViaOnionV4ToFileServer,
  sendBinaryViaOnionV4ToSogs,
  getBinaryViaOnionV4FromFileServer,
  sendJsonViaOnionV4ToFileServer,
};
