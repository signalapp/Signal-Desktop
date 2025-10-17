// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-param-reassign */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { RequestInit, Response } from 'node-fetch';
import fetch from 'node-fetch';
import type { Agent } from 'node:https';
import lodash from 'lodash';
import PQueue from 'p-queue';
import { v4 as getGuid } from 'uuid';
import { z } from 'zod';
import type { Readable } from 'node:stream';
import qs from 'node:querystring';
import type {
  KEMPublicKey,
  PublicKey,
  Aci,
  Pni,
} from '@signalapp/libsignal-client';
import { AccountAttributes } from '@signalapp/libsignal-client/dist/net.js';

import { assertDev, strictAssert } from '../util/assert.std.js';
import * as durations from '../util/durations/index.std.js';
import type { ExplodePromiseResultType } from '../util/explodePromise.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import { getUserAgent } from '../util/getUserAgent.node.js';
import { getTimeoutStream } from '../util/getStreamWithTimeout.node.js';
import {
  toWebSafeBase64,
  fromWebSafeBase64,
} from '../util/webSafeBase64.std.js';
import { getBasicAuth } from '../util/getBasicAuth.std.js';
import { createHTTPSAgent } from '../util/createHTTPSAgent.node.js';
import { createProxyAgent } from '../util/createProxyAgent.node.js';
import type { ProxyAgent } from '../util/createProxyAgent.node.js';
import type { FetchFunctionType } from '../util/uploads/tusProtocol.node.js';
import { VerificationTransport } from '../types/VerificationTransport.std.js';
import type {
  CapabilitiesType,
  CapabilitiesUploadType,
} from '../types/Capabilities.d.ts';
import type { HeaderListType } from '../types/WebAPI.d.ts';
import { ZERO_ACCESS_KEY } from '../types/SealedSender.std.js';
import { toLogFormat } from '../types/errors.std.js';
import { isPackIdValid, redactPackId } from '../util/Stickers.std.js';
import type {
  ServiceIdString,
  AciString,
  UntaggedPniString,
} from '../types/ServiceId.std.js';
import {
  ServiceIdKind,
  serviceIdSchema,
  aciSchema,
  untaggedPniSchema,
} from '../types/ServiceId.std.js';
import type { BackupPresentationHeadersType } from '../types/backups.node.js';
import { HTTPError } from '../types/HTTPError.std.js';
import * as Bytes from '../Bytes.std.js';
import { getRandomBytes, randomInt } from '../Crypto.node.js';
import * as linkPreviewFetch from '../linkPreviews/linkPreviewFetch.preload.js';
import { isBadgeImageFileUrlValid } from '../badges/isBadgeImageFileUrlValid.std.js';

import {
  SocketManager,
  type SocketStatuses,
  type SocketExpirationReason,
} from './SocketManager.preload.js';
import type { CDSAuthType, CDSResponseType } from './cds/Types.d.ts';
import { CDSI } from './cds/CDSI.node.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { isEnabled as isRemoteConfigEnabled } from '../RemoteConfig.dom.js';

import type {
  WebAPICredentials,
  IRequestHandler,
  StorageServiceCallOptionsType,
  StorageServiceCredentials,
} from './Types.d.ts';
import { handleStatusCode, translateError } from './Utils.dom.js';
import { createLogger } from '../logging/log.std.js';
import { maybeParseUrl, urlPathFromComponents } from '../util/url.std.js';
import { HOUR, MINUTE, SECOND } from '../util/durations/index.std.js';
import { safeParseNumber } from '../util/numbers.std.js';
import type { IWebSocketResource } from './WebsocketResources.preload.js';
import { getLibsignalNet } from './preconnect.preload.js';
import type { GroupSendToken } from '../types/GroupSendEndorsements.std.js';
import {
  parseUnknown,
  safeParseUnknown,
  type Schema,
} from '../util/schemas.std.js';
import type {
  ProfileFetchAuthRequestOptions,
  ProfileFetchUnauthRequestOptions,
} from '../services/profiles.preload.js';
import { ToastType } from '../types/Toast.dom.js';
import { isProduction } from '../util/version.std.js';
import type { ServerAlert } from '../types/ServerAlert.std.js';
import { isAbortError } from '../util/isAbortError.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { drop } from '../util/drop.std.js';
import { subscriptionConfigurationCurrencyZod } from '../types/Donations.std.js';
import type {
  StripeDonationAmount,
  CardDetail,
} from '../types/Donations.std.js';
import { badgeFromServerSchema } from '../badges/parseBadgesFromServer.std.js';
import { ZERO_DECIMAL_CURRENCIES } from '../util/currency.dom.js';
import type { JobCancelReason } from '../jobs/types.std.js';

const { escapeRegExp, isNumber, throttle } = lodash;

const log = createLogger('WebAPI');

// Note: this will break some code that expects to be able to use err.response when a
//   web request fails, because it will force it to text. But it is very useful for
//   debugging failed requests.
const DEBUG = false;
const DEFAULT_TIMEOUT = 30 * SECOND;

const CONTENT_TYPE_FORM_ENCODING = 'application/x-www-form-urlencoded';

function _createRedactor(
  ...toReplace: ReadonlyArray<string | undefined | null>
): RedactUrl {
  // NOTE: It would be nice to remove this cast, but TypeScript doesn't support
  //   it. However, there is [an issue][0] that discusses this in more detail.
  // [0]: https://github.com/Microsoft/TypeScript/issues/16069
  const stringsToReplace = toReplace.filter(Boolean) as Array<string>;
  return href =>
    stringsToReplace.reduce((result: string, stringToReplace: string) => {
      const pattern = RegExp(escapeRegExp(stringToReplace), 'g');
      const replacement = `[REDACTED]${stringToReplace.slice(-3)}`;
      return result.replace(pattern, replacement);
    }, href);
}

function _validateResponse(response: any, schema: any) {
  try {
    for (const i in schema) {
      switch (schema[i]) {
        case 'object':
        case 'string':
        case 'number':
          // eslint-disable-next-line valid-typeof
          if (typeof response[i] !== schema[i]) {
            return false;
          }
          break;
        default:
      }
    }
  } catch (ex) {
    return false;
  }

  return true;
}

const FIVE_MINUTES = 5 * MINUTE;
const GET_ATTACHMENT_CHUNK_TIMEOUT = 10 * SECOND;

type AgentCacheType = {
  [name: string]: {
    timestamp: number;
    agent: ProxyAgent | Agent;
  };
};
const agents: AgentCacheType = {};

function getContentType(response: Response) {
  if (response.headers && response.headers.get) {
    return response.headers.get('content-type');
  }

  return null;
}

type FetchHeaderListType = { [name: string]: string };
type HTTPCodeType = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

type RedactUrl = (url: string) => string;

type ResponseType =
  | 'json'
  | 'jsonwithdetails'
  | 'bytes'
  | 'byteswithdetails'
  | 'raw'
  | 'stream'
  | 'streamwithdetails';

type PromiseAjaxOptionsType<Type extends ResponseType, OutputShape> = {
  socketManager?: SocketManager;
  basicAuth?: string;
  certificateAuthority?: string;
  chatServiceUrl?: string;
  contentType?: string;
  data?: Uint8Array | (() => Readable) | string;
  disableRetries?: boolean;
  disableSessionResumption?: boolean;
  headers?: HeaderListType;
  host?: string;
  password?: string;
  path?: string;
  proxyUrl?: string;
  redactUrl?: RedactUrl;
  redirect?: 'error' | 'follow' | 'manual';
  responseType: Type;
  stack?: string;
  storageUrl?: string;
  timeout?: number;
  type: HTTPCodeType;
  user?: string;
  validateResponse?: any;
  version: string;
  abortSignal?: AbortSignal;
} & (
  | {
      unauthenticated?: false;
      accessKey?: string;
      groupSendToken?: GroupSendToken;
    }
  | {
      unauthenticated: true;
      accessKey: undefined | string;
      groupSendToken: undefined | GroupSendToken;
    }
) &
  (Type extends 'json' | 'jsonwithdetails'
    ? {
        zodSchema: Schema<unknown, OutputShape>;
      }
    : {
        zodSchema?: never;
      });

type JSONWithDetailsType<Data = unknown> = {
  data: Data;
  contentType: string | null;
  response: Response;
};
type BytesWithDetailsType = {
  data: Uint8Array;
  contentType: string | null;
  response: Response;
};
type StreamWithDetailsType = {
  stream: Readable;
  contentType: string | null;
  response: Response;
};

type GetAttachmentArgsType = {
  cdnPath: string;
  cdnNumber: number;
  headers?: Record<string, string>;
  redactor: RedactUrl;
  options?: {
    disableRetries?: boolean;
    timeout?: number;
    downloadOffset?: number;
    onProgress?: (currentBytes: number, totalBytes: number) => void;
    abortSignal?: AbortSignal;
  };
};

type GetAttachmentFromBackupTierArgsType = {
  mediaId: string;
  backupDir: string;
  mediaDir: string;
  cdnNumber: number;
  headers: Record<string, string>;
  options?: {
    disableRetries?: boolean;
    timeout?: number;
    downloadOffset?: number;
  };
};

export const multiRecipient200ResponseSchema = z.object({
  uuids404: z.array(serviceIdSchema).optional(),
  needsSync: z.boolean().optional(),
});
export type MultiRecipient200ResponseType = z.infer<
  typeof multiRecipient200ResponseSchema
>;

export const multiRecipient409ResponseSchema = z.array(
  z.object({
    uuid: serviceIdSchema,
    devices: z.object({
      missingDevices: z.array(z.number()).optional(),
      extraDevices: z.array(z.number()).optional(),
    }),
  })
);
export type MultiRecipient409ResponseType = z.infer<
  typeof multiRecipient409ResponseSchema
>;

export const multiRecipient410ResponseSchema = z.array(
  z.object({
    uuid: serviceIdSchema,
    devices: z.object({
      staleDevices: z.array(z.number()).optional(),
    }),
  })
);
export type MultiRecipient410ResponseType = z.infer<
  typeof multiRecipient410ResponseSchema
>;

function isSuccess(status: number): boolean {
  return status >= 0 && status < 400;
}

function getHostname(url: string): string {
  const urlObject = new URL(url);
  return urlObject.hostname;
}

type FetchOptionsType = Omit<RequestInit, 'headers'> & {
  headers: Record<string, string>;
  // This is patch-packaged
  ca?: string;
};

async function getFetchOptions<Type extends ResponseType, OutputShape>(
  options: Omit<PromiseAjaxOptionsType<Type, OutputShape>, 'responseType'>
): Promise<FetchOptionsType> {
  const { proxyUrl } = options;

  const timeout =
    typeof options.timeout === 'number' ? options.timeout : DEFAULT_TIMEOUT;

  const agentType = options.unauthenticated ? 'unauth' : 'auth';
  const cacheKey = `${proxyUrl}-${agentType}`;

  const { timestamp } = agents[cacheKey] || { timestamp: null };
  if (!timestamp || timestamp + FIVE_MINUTES < Date.now()) {
    if (timestamp) {
      log.info(`Cycling agent for type ${cacheKey}`);
    }
    agents[cacheKey] = {
      agent: proxyUrl
        ? await createProxyAgent(proxyUrl)
        : createHTTPSAgent({
            keepAlive: !options.disableSessionResumption,
            maxCachedSessions: options.disableSessionResumption ? 0 : undefined,
          }),
      timestamp: Date.now(),
    };
  }
  const agentEntry = agents[cacheKey];
  const agent = agentEntry?.agent ?? null;

  const fetchOptions: FetchOptionsType = {
    method: options.type,
    body: typeof options.data === 'function' ? options.data() : options.data,
    headers: {
      'User-Agent': getUserAgent(options.version),
      'X-Signal-Agent': 'OWD',
      ...options.headers,
    } as FetchHeaderListType,
    redirect: options.redirect,
    agent,
    ca: options.certificateAuthority,
    timeout,
    signal: options.abortSignal,
  };

  if (options.contentType) {
    fetchOptions.headers['Content-Type'] = options.contentType;
  }

  return fetchOptions;
}

async function _promiseAjax<Type extends ResponseType, OutputShape>(
  providedUrl: string | null,
  options: PromiseAjaxOptionsType<Type, OutputShape>
): Promise<unknown> {
  const fetchOptions = await getFetchOptions(options);
  const { socketManager } = options;

  const url = providedUrl || `${options.host}/${options.path}`;
  const logType = socketManager ? '(WS)' : '(REST)';
  const redactedURL = options.redactUrl ? options.redactUrl(url) : url;

  const { accessKey, basicAuth, groupSendToken, unauthenticated } = options;

  let unauthLabel = '';
  if (options.unauthenticated) {
    if (groupSendToken != null) {
      unauthLabel = ' (unauth+gse)';
    } else if (accessKey === ZERO_ACCESS_KEY) {
      unauthLabel = ' (unauth+zero-key)';
    } else if (accessKey != null) {
      unauthLabel = ' (unauth+key)';
    } else {
      unauthLabel = ' (unauth)';
    }
  }
  const logId = `${options.type} ${logType} ${redactedURL}${unauthLabel}`;
  log.info(logId);

  if (fetchOptions.body instanceof Uint8Array) {
    // node-fetch doesn't support Uint8Array, only node Buffer
    const contentLength = fetchOptions.body.byteLength;
    fetchOptions.body = Buffer.from(fetchOptions.body);

    // node-fetch doesn't set content-length like S3 requires
    fetchOptions.headers['Content-Length'] = contentLength.toString();
  }

  if (basicAuth) {
    fetchOptions.headers.Authorization = `Basic ${basicAuth}`;
  } else if (unauthenticated) {
    if (groupSendToken != null) {
      fetchOptions.headers['Group-Send-Token'] = Bytes.toBase64(groupSendToken);
    } else if (accessKey != null) {
      // Access key is already a Base64 string
      fetchOptions.headers['Unidentified-Access-Key'] = accessKey;
    }
  } else if (options.user && options.password) {
    fetchOptions.headers.Authorization = getBasicAuth({
      username: options.user,
      password: options.password,
    });
  }

  let response: Response;

  try {
    response = socketManager
      ? await socketManager.fetch(url, fetchOptions)
      : await fetch(url, fetchOptions);
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    log.warn(logId, 0, 'Error');
    const stack = `${e.stack}\nInitial stack:\n${options.stack}`;
    throw makeHTTPError('promiseAjax catch', 0, {}, e.toString(), stack);
  }

  const urlHostname = getHostname(url);

  if (options.storageUrl && url.startsWith(options.storageUrl)) {
    // The cloud infrastructure that sits in front of the Storage Service / Groups server
    // has in the past terminated requests with a 403 before they make it to a Signal
    // server. That's a problem, since we might take destructive action locally in
    // response to a 403. Responses from a Signal server should always contain the
    // `x-signal-timestamp` headers.
    if (response.headers.get('x-signal-timestamp') == null) {
      log.error(
        logId,
        response.status,
        'Invalid header: missing required x-signal-timestamp header'
      );

      onIncorrectHeadersFromStorageService();

      // TODO: DESKTOP-8300
      if (response.status === 403) {
        throw new Error(
          `${logId} ${response.status}: Dropping response, missing required x-signal-timestamp header`
        );
      }
    }
  }

  if (
    options.chatServiceUrl &&
    getHostname(options.chatServiceUrl) === urlHostname
  ) {
    await handleStatusCode(response.status);

    if (!unauthenticated && response.status === 401) {
      log.warn('Got 401 from Signal Server. We might be unlinked.');
      window.Whisper.events.emit('mightBeUnlinked');
    }
  }

  let result: string | Uint8Array | Readable | unknown;
  try {
    if (DEBUG && !isSuccess(response.status)) {
      result = await response.text();
      // eslint-disable-next-line no-console
      console.error(result);
    } else if (
      (options.responseType === 'json' ||
        options.responseType === 'jsonwithdetails') &&
      /^application\/json(;.*)?$/.test(
        response.headers.get('Content-Type') || ''
      )
    ) {
      result = await response.json();
    } else if (
      options.responseType === 'bytes' ||
      options.responseType === 'byteswithdetails'
    ) {
      result = await response.buffer();
    } else if (
      options.responseType === 'stream' ||
      options.responseType === 'streamwithdetails'
    ) {
      result = response.body;
    } else if (options.responseType === 'raw') {
      result = response;
    } else {
      result = await response.textConverted();
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    log.warn(logId, response.status, 'Error');
    const stack = `${error.stack}\nInitial stack:\n${options.stack}`;
    throw makeHTTPError(
      `promiseAjax: error parsing body (Content-Type: ${response.headers.get('content-type')})`,
      response.status,
      response.headers.raw(),
      stack
    );
  }

  if (!isSuccess(response.status)) {
    log.warn(logId, response.status, 'Error');

    throw makeHTTPError(
      'promiseAjax: error response',
      response.status,
      response.headers.raw(),
      result,
      options.stack
    );
  }
  if (
    options.responseType === 'json' ||
    options.responseType === 'jsonwithdetails'
  ) {
    if (options.zodSchema) {
      try {
        result = parseUnknown(options.zodSchema, result);
      } catch (e) {
        log.error(logId, response.status, 'Validation error');
        throw e;
      }
    }
    if (options.validateResponse) {
      if (!_validateResponse(result, options.validateResponse)) {
        log.error(logId, response.status, 'Validation error');
        throw makeHTTPError(
          'promiseAjax: invalid response',
          response.status,
          response.headers.raw(),
          result,
          options.stack
        );
      }
    }
  }

  if (options.responseType === 'stream') {
    log.info(logId, response.status, 'Streaming');
    response.body.on('error', e => {
      log.info(logId, 'Errored while streaming:', e.message);
    });
    response.body.on('end', () => {
      log.info(logId, response.status, 'Streaming ended');
    });
    return result;
  }

  if (options.responseType === 'streamwithdetails') {
    log.info(logId, response.status, 'Streaming with details');
    response.body.on('error', e => {
      log.info(logId, 'Errored while streaming:', e.message);
    });
    response.body.on('end', () => {
      log.info(logId, response.status, 'Streaming ended');
    });

    const fullResult: StreamWithDetailsType = {
      stream: result as Readable,
      contentType: getContentType(response),
      response,
    };

    return fullResult;
  }

  log.info(logId, response.status, 'Success');

  if (options.responseType === 'byteswithdetails') {
    assertDev(result instanceof Uint8Array, 'Expected Uint8Array result');
    const fullResult: BytesWithDetailsType = {
      data: result,
      contentType: getContentType(response),
      response,
    };

    return fullResult;
  }

  if (options.responseType === 'jsonwithdetails') {
    const fullResult: JSONWithDetailsType = {
      data: result,
      contentType: getContentType(response),
      response,
    };

    return fullResult;
  }

  return result;
}

async function _retryAjax<Type extends ResponseType, OutputShape>(
  url: string | null,
  options: PromiseAjaxOptionsType<Type, OutputShape>,
  providedLimit?: number,
  providedCount?: number
): Promise<unknown> {
  const count = (providedCount || 0) + 1;
  const limit = providedLimit || 3;

  try {
    return await _promiseAjax(url, options);
  } catch (e) {
    if (
      e instanceof HTTPError &&
      e.code === -1 &&
      count < limit &&
      !options.abortSignal?.aborted
    ) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(_retryAjax(url, options, limit, count));
        }, 1000);
      });
    }
    throw e;
  }
}

type OuterAjaxReturnType<Type extends ResponseType, OutputShape> = {
  json: Promise<OutputShape>;
  jsonwithdetails: Promise<JSONWithDetailsType<OutputShape>>;
  bytes: Promise<Uint8Array>;
  byteswithdetails: Promise<BytesWithDetailsType>;
  stream: Promise<Readable>;
  streamwithdetails: Promise<StreamWithDetailsType>;
  raw: Promise<Response>;
}[Type];

function _outerAjax<Type extends ResponseType, OutputShape>(
  providedUrl: string | null,
  options: PromiseAjaxOptionsType<Type, OutputShape>
): OuterAjaxReturnType<Type, OutputShape>;

async function _outerAjax<Type extends ResponseType, OutputShape>(
  url: string | null,
  options: PromiseAjaxOptionsType<Type, OutputShape>
): Promise<unknown> {
  options.stack = new Error().stack; // just in case, save stack here.

  if (options.disableRetries) {
    return _promiseAjax(url, options);
  }

  return _retryAjax(url, options);
}

function makeHTTPError(
  message: string,
  providedCode: number,
  headers: HeaderListType,
  response: unknown,
  stack?: string
) {
  return new HTTPError(message, {
    code: providedCode,
    headers: makeKeysLowercase(headers),
    response,
    stack,
  });
}

export function makeKeysLowercase<V>(
  headers: Record<string, V>
): Record<string, V> {
  const keys = Object.keys(headers);
  const lowerCase: Record<string, V> = Object.create(null);

  keys.forEach(key => {
    lowerCase[key.toLowerCase()] = headers[key];
  });

  return lowerCase;
}

const CHAT_CALLS = {
  accountExistence: 'v1/accounts/account',
  attachmentUploadForm: 'v4/attachments/form/upload',
  attestation: 'v1/attestation',
  batchIdentityCheck: 'v1/profile/identity_check/batch',
  boostReceiptCredentials: 'v1/subscription/boost/receipt_credentials',
  challenge: 'v1/challenge',
  configV2: 'v2/config',
  createBoost: 'v1/subscription/boost/create',
  deliveryCert: 'v1/certificate/delivery',
  devices: 'v1/devices',
  directoryAuthV2: 'v2/directory/auth',
  discovery: 'v1/discovery',
  getGroupCredentials: 'v1/certificate/auth/group',
  getIceServers: 'v2/calling/relays',
  getStickerPackUpload: 'v1/sticker/pack/form',
  getBackupCredentials: 'v1/archives/auth',
  getBackupCDNCredentials: 'v1/archives/auth/read',
  getBackupUploadForm: 'v1/archives/upload/form',
  getBackupMediaUploadForm: 'v1/archives/media/upload/form',
  keys: 'v2/keys',
  linkDevice: 'v1/devices/link',
  messages: 'v1/messages',
  multiRecipient: 'v1/messages/multi_recipient',
  phoneNumberDiscoverability: 'v2/accounts/phone_number_discoverability',
  profile: 'v1/profile',
  backup: 'v1/archives',
  backupMedia: 'v1/archives/media',
  backupMediaBatch: 'v1/archives/media/batch',
  backupMediaDelete: 'v1/archives/media/delete',
  callLinkCreateAuth: 'v1/call-link/create-auth',
  redeemReceipt: 'v1/donation/redeem-receipt',
  registration: 'v1/registration',
  registerCapabilities: 'v1/devices/capabilities',
  reportMessage: 'v1/messages/report',
  setBackupId: 'v1/archives/backupid',
  setBackupSignatureKey: 'v1/archives/keys',
  signed: 'v2/keys/signed',
  storageToken: 'v1/storage/auth',
  subscriptions: 'v1/subscription',
  subscriptionConfiguration: 'v1/subscription/configuration',
  transferArchive: 'v1/devices/transfer_archive',
  updateDeviceName: 'v1/accounts/name',
  username: 'v1/accounts/username_hash',
  reserveUsername: 'v1/accounts/username_hash/reserve',
  confirmUsername: 'v1/accounts/username_hash/confirm',
  usernameLink: 'v1/accounts/username_link',
  whoami: 'v1/accounts/whoami',
};

const STORAGE_CALLS = {
  getGroupAvatarUpload: 'v1/groups/avatar/form',
  groupLog: 'v2/groups/logs',
  groupJoinedAtVersion: 'v1/groups/joined_at_version',
  groups: 'v2/groups',
  groupsViaLink: 'v1/groups/join/',
  groupToken: 'v1/groups/token',
  storageManifest: 'v1/storage/manifest',
  storageModify: 'v1/storage/',
  storageRead: 'v1/storage/read',
};

const RESOURCE_CALLS = {
  getOnboardingStoryManifest:
    'dynamic/desktop/stories/onboarding/manifest.json',
  releaseNotesManifest: 'dynamic/release-notes/release-notes-v2.json',
  releaseNotes: 'static/release-notes',
};

export type MessageType = Readonly<{
  type: number;
  destinationDeviceId: number;
  destinationRegistrationId: number;
  content: string;
}>;

type AjaxChatOptionsType = {
  host: 'chatService';
  call: keyof typeof CHAT_CALLS;
  unauthenticated?: true;
  accessKey?: string;
  groupSendToken?: GroupSendToken;
  isRegistration?: true;
};

type AjaxStorageOptionsType = {
  host: 'storageService';
  call: keyof typeof STORAGE_CALLS;
  basicAuth?: string;
  disableSessionResumption?: true;
} & ({ username: string; password: string } | object);

type AjaxResourceOptionsType = {
  host: 'resources';
  call: keyof typeof RESOURCE_CALLS;
};

type AjaxResponseType =
  | 'json'
  | 'jsonwithdetails'
  | 'bytes'
  | 'byteswithdetails';

type AjaxOptionsType<Type extends AjaxResponseType, OutputShape = unknown> = (
  | AjaxStorageOptionsType
  | AjaxResourceOptionsType
  | AjaxChatOptionsType
) & {
  contentType?: string;
  data?: Buffer | Uint8Array | string;
  headers?: HeaderListType;
  httpType: HTTPCodeType;
  jsonData?: unknown;
  redactUrl?: RedactUrl;
  responseType?: Type;
  timeout?: number;
  urlParameters?: string;
  validateResponse?: any;
  abortSignal?: AbortSignal;
} & (Type extends 'json' | 'jsonwithdetails'
    ? {
        zodSchema: Schema<unknown, OutputShape>;
      }
    : {
        zodSchema?: never;
      });

export type WebAPIConnectOptionsType = WebAPICredentials & {
  hasStoriesDisabled: boolean;
  hasBuildExpired: boolean;
};

type StickerPackManifestType = Uint8Array;

export type GroupCredentialType = {
  credential: string;
  redemptionTime: number;
};
export type GroupCredentialsType = {
  groupPublicParamsHex: string;
  authCredentialPresentationHex: string;
};
export type CallLinkAuthCredentialsType = {
  callLinkPublicParamsHex: string;
  authCredentialPresentationHex: string;
};
export type GetGroupLogOptionsType = Readonly<{
  startVersion: number | undefined;
  includeFirstState: boolean;
  includeLastState: boolean;
  maxSupportedChangeEpoch: number;
  cachedEndorsementsExpiration: number | null; // seconds
}>;
export type GroupLogResponseType = {
  changes: Proto.GroupChanges;
  groupSendEndorsementResponse: Uint8Array | null;
} & (
  | {
      paginated: false;
    }
  | {
      paginated: true;
      currentRevision: number;
      start: number;
      end: number;
    }
);

const uploadProfileZod = z.object({
  about: z.string().nullish(),
  aboutEmoji: z.string().nullish(),
  avatar: z.boolean(),
  sameAvatar: z.boolean(),
  commitment: z.string(),
  name: z.string(),
  paymentAddress: z.string().nullish(),
  phoneNumberSharing: z.string().nullish(),
  version: z.string(),
});
export type ProfileRequestDataType = z.infer<typeof uploadProfileZod>;

const uploadAvatarHeadersZod = z.object({
  acl: z.string(),
  algorithm: z.string(),
  credential: z.string(),
  date: z.string(),
  key: z.string(),
  policy: z.string(),
  signature: z.string(),
});
export type UploadAvatarHeadersType = z.infer<typeof uploadAvatarHeadersZod>;
const uploadAvatarOrOther = z.union([
  uploadAvatarHeadersZod,
  z.string(),
  z.undefined(),
]);
export type UploadAvatarHeadersOrOtherType = z.infer<
  typeof uploadAvatarOrOther
>;

const remoteConfigResponseZod = z.object({
  config: z.object({}).catchall(z.string()),
});
export type RemoteConfigResponseType = {
  config: Map<string, string> | 'unmodified';
} & Readonly<{
  serverTimestamp: number;
  configHash: string;
}>;

export type ProfileType = Readonly<{
  identityKey?: string;
  name?: string;
  about?: string;
  aboutEmoji?: string;
  avatar?: string;
  phoneNumberSharing?: string;
  unidentifiedAccess?: string;
  unrestrictedUnidentifiedAccess?: string;
  uuid?: string;
  credential?: string;

  capabilities?: CapabilitiesType;
  paymentAddress?: string;
  badges?: unknown;
}>;

export type GetAccountForUsernameOptionsType = Readonly<{
  hash: Uint8Array;
}>;

const getAccountForUsernameResultZod = z.object({
  uuid: aciSchema,
});

export type GetAccountForUsernameResultType = z.infer<
  typeof getAccountForUsernameResultZod
>;

const getDevicesResultZod = z.object({
  devices: z.array(
    z.object({
      id: z.number(),
      name: z.string().nullish(), // primary devices may not have a name
      lastSeen: z.number().nullish(),
      created: z.number().nullish(),
    })
  ),
});

export type GetDevicesResultType = z.infer<typeof getDevicesResultZod>;

export type GetIceServersResultType = Readonly<{
  relays?: ReadonlyArray<IceServerGroupType>;
}>;

export type IceServerGroupType = Readonly<{
  username: string;
  password: string;
  urls?: ReadonlyArray<string>;
  urlsWithIps?: ReadonlyArray<string>;
  hostname?: string;
  ttl?: number;
}>;

export type GetSenderCertificateResultType = Readonly<{ certificate: string }>;

const whoamiResultZod = z.object({
  uuid: z.string(),
  pni: z.string(),
  number: z.string(),
  usernameHash: z.string().nullish(),
  usernameLinkHandle: z.string().nullish(),
});
export type WhoamiResultType = z.infer<typeof whoamiResultZod>;

export type CdsLookupOptionsType = Readonly<{
  e164s: ReadonlyArray<string>;
  acisAndAccessKeys?: ReadonlyArray<{ aci: AciString; accessKey: string }>;
  returnAcisWithoutUaks?: boolean;
}>;

export type GetGroupCredentialsOptionsType = Readonly<{
  startDayInMs: number;
  endDayInMs: number;
}>;

export type GetGroupCredentialsResultType = Readonly<{
  pni?: UntaggedPniString | null;
  credentials: ReadonlyArray<GroupCredentialType>;
  callLinkAuthCredentials: ReadonlyArray<GroupCredentialType>;
}>;

const verifyServiceIdResponse = z.object({
  elements: z.array(
    z.object({
      uuid: serviceIdSchema,
      identityKey: z.string(),
    })
  ),
});

export type VerifyServiceIdRequestType = Array<{
  uuid: ServiceIdString;
  fingerprint: string;
}>;
export type VerifyServiceIdResponseType = z.infer<
  typeof verifyServiceIdResponse
>;

export type ReserveUsernameOptionsType = Readonly<{
  hashes: ReadonlyArray<Uint8Array>;
  abortSignal?: AbortSignal;
}>;

export type ReplaceUsernameLinkOptionsType = Readonly<{
  encryptedUsername: Uint8Array;
  keepLinkHandle: boolean;
}>;

export type ConfirmUsernameOptionsType = Readonly<{
  hash: Uint8Array;
  proof: Uint8Array;
  encryptedUsername: Uint8Array;
  abortSignal?: AbortSignal;
}>;

const reserveUsernameResultZod = z.object({
  usernameHash: z
    .string()
    .transform(x => Bytes.fromBase64(fromWebSafeBase64(x))),
});
export type ReserveUsernameResultType = z.infer<
  typeof reserveUsernameResultZod
>;

const confirmUsernameResultZod = z.object({
  usernameLinkHandle: z.string(),
});
export type ConfirmUsernameResultType = z.infer<
  typeof confirmUsernameResultZod
>;

const replaceUsernameLinkResultZod = z.object({
  usernameLinkHandle: z.string(),
});
export type ReplaceUsernameLinkResultType = z.infer<
  typeof replaceUsernameLinkResultZod
>;

const resolveUsernameLinkResultZod = z.object({
  usernameLinkEncryptedValue: z
    .string()
    .transform(x => Bytes.fromBase64(fromWebSafeBase64(x))),
});
export type ResolveUsernameLinkResultType = z.infer<
  typeof resolveUsernameLinkResultZod
>;

export type CreateAccountOptionsType = Readonly<{
  sessionId: string;
  number: string;
  code: string;
  newPassword: string;
  registrationId: number;
  pniRegistrationId: number;
  accessKey: Uint8Array;
  aciPublicKey: PublicKey;
  pniPublicKey: PublicKey;
  aciSignedPreKey: UploadSignedPreKeyType;
  pniSignedPreKey: UploadSignedPreKeyType;
  aciPqLastResortPreKey: UploadKyberPreKeyType;
  pniPqLastResortPreKey: UploadKyberPreKeyType;
}>;

const linkDeviceResultZod = z.object({
  uuid: aciSchema,
  pni: untaggedPniSchema,
  deviceId: z.number(),
});
export type LinkDeviceResultType = z.infer<typeof linkDeviceResultZod>;

const subscriptionConfigurationResultZod = z.object({
  currencies: z.record(z.string(), subscriptionConfigurationCurrencyZod),
  levels: z.record(
    z.string(),
    z.object({
      name: z.string(),
      badge: badgeFromServerSchema,
    })
  ),
});
export type SubscriptionConfigurationResultType = z.infer<
  typeof subscriptionConfigurationResultZod
>;

export type ReportMessageOptionsType = Readonly<{
  senderAci: AciString;
  serverGuid: string;
  token?: string;
}>;

const attachmentUploadFormResponse = z.object({
  cdn: z.literal(2).or(z.literal(3)),
  key: z.string(),
  headers: z.record(z.string()),
  signedUploadLocation: z.string(),
});

export type AttachmentUploadFormResponseType = z.infer<
  typeof attachmentUploadFormResponse
>;

export const ServerKeyCountSchema = z.object({
  count: z.number(),
  pqCount: z.number(),
});

export type LinkDeviceOptionsType = Readonly<{
  number: string;
  verificationCode: string;
  encryptedDeviceName?: string;
  newPassword: string;
  registrationId: number;
  pniRegistrationId: number;
  aciSignedPreKey: UploadSignedPreKeyType;
  pniSignedPreKey: UploadSignedPreKeyType;
  aciPqLastResortPreKey: UploadKyberPreKeyType;
  pniPqLastResortPreKey: UploadKyberPreKeyType;
}>;

export type CreateAccountResultType = Readonly<{
  aci: Aci;
  pni: Pni;
}>;

export type CreateBoostOptionsType = Readonly<{
  currency: string;
  amount: StripeDonationAmount;
  level: number;
  paymentMethod: string;
}>;
const CreateBoostResultSchema = z.object({
  clientSecret: z.string(),
});
export type CreateBoostResultType = z.infer<typeof CreateBoostResultSchema>;

export type CreateBoostReceiptCredentialsOptionsType = Readonly<{
  paymentIntentId: string;
  receiptCredentialRequest: string;
  processor: string;
}>;
const CreateBoostReceiptCredentialsResultSchema = z.object({
  receiptCredentialResponse: z.string(),
});
export type CreateBoostReceiptCredentialsResultType = z.infer<
  typeof CreateBoostReceiptCredentialsResultSchema
>;

// https://docs.stripe.com/api/payment_methods/create?api-version=2025-05-28.basil&lang=node#create_payment_method-card
type CreatePaymentMethodWithStripeOptionsType = Readonly<{
  cardDetail: CardDetail;
}>;
const CreatePaymentMethodWithStripeResultSchema = z.object({
  id: z.string(),
});
type CreatePaymentMethodWithStripeResultType = z.infer<
  typeof CreatePaymentMethodWithStripeResultSchema
>;

// https://docs.stripe.com/api/payment_intents/confirm?api-version=2025-05-28.basil
export type ConfirmIntentWithStripeOptionsType = Readonly<{
  clientSecret: string;
  idempotencyKey: string;
  paymentIntentId: string;
  paymentMethodId: string;
  returnUrl: string;
}>;
const ConfirmIntentWithStripeResultSchema = z.object({
  // https://docs.stripe.com/api/payment_intents/object#payment_intent_object-status
  status: z.string(),
  // https://docs.stripe.com/api/payment_intents/object#payment_intent_object-next_action
  next_action: z
    .object({
      type: z.string(),
      redirect_to_url: z
        .object({
          return_url: z.string(), // what we provided originally
          url: z.string(), // what we need to redirect to
        })
        .nullable(),
    })
    .nullable(),
  // https://docs.stripe.com/api/payment_intents/object#payment_intent_object-last_payment_error
  last_payment_error: z
    .object({
      type: z.string(),
      advice_code: z.string().nullable(),
      message: z.string().nullable(),
    })
    .nullable(),
});
type ConfirmIntentWithStripeResultType = z.infer<
  typeof ConfirmIntentWithStripeResultSchema
>;

export type RedeemReceiptOptionsType = Readonly<{
  receiptCredentialPresentation: string;
  visible: boolean;
  primary: boolean;
}>;

export type RequestVerificationResultType = Readonly<{
  sessionId: string;
}>;

export type SetBackupIdOptionsType = Readonly<{
  messagesBackupAuthCredentialRequest: Uint8Array;
  mediaBackupAuthCredentialRequest: Uint8Array;
}>;

export type SetBackupSignatureKeyOptionsType = Readonly<{
  headers: BackupPresentationHeadersType;
  backupIdPublicKey: Uint8Array;
}>;

export type UploadBackupOptionsType = Readonly<{
  headers: BackupPresentationHeadersType;
  stream: Readable;
}>;

export type BackupMediaItemType = Readonly<{
  sourceAttachment: Readonly<{
    cdn: number;
    key: string;
  }>;
  objectLength: number;
  mediaId: string;
  hmacKey: Uint8Array;
  encryptionKey: Uint8Array;
}>;

export type BackupMediaBatchOptionsType = Readonly<{
  headers: BackupPresentationHeadersType;
  items: ReadonlyArray<BackupMediaItemType>;
}>;

export const backupMediaBatchResponseSchema = z.object({
  responses: z
    .object({
      status: z.number(),
      failureReason: z.string().nullish(),
      cdn: z.number(),
      mediaId: z.string(),
    })
    .transform(response => ({
      ...response,
      isSuccess: isSuccess(response.status),
    }))
    .array(),
});

export type BackupMediaBatchResponseType = z.infer<
  typeof backupMediaBatchResponseSchema
>;

export type BackupListMediaOptionsType = Readonly<{
  headers: BackupPresentationHeadersType;
  cursor?: string;
  limit: number;
}>;

export const backupListMediaResponseSchema = z.object({
  storedMediaObjects: z
    .object({
      cdn: z.number(),
      mediaId: z.string(),
      objectLength: z.number(),
    })
    .array(),
  backupDir: z.string(),
  mediaDir: z.string(),
  cursor: z.string().nullish(),
});

export type BackupListMediaResponseType = z.infer<
  typeof backupListMediaResponseSchema
>;

export type BackupDeleteMediaItemType = Readonly<{
  cdn: number;
  mediaId: string;
}>;

export type BackupDeleteMediaOptionsType = Readonly<{
  headers: BackupPresentationHeadersType;
  mediaToDelete: ReadonlyArray<BackupDeleteMediaItemType>;
}>;

export type GetBackupCredentialsOptionsType = Readonly<{
  startDayInMs: number;
  endDayInMs: number;
}>;

export const backupCredentialListSchema = z
  .object({
    credential: z.string().transform(x => Bytes.fromBase64(x)),
    redemptionTime: z
      .number()
      .transform(x => durations.DurationInSeconds.fromSeconds(x)),
  })
  .array();

export const getBackupCredentialsResponseSchema = z.object({
  credentials: z.object({
    messages: backupCredentialListSchema,
    media: backupCredentialListSchema,
  }),
});

export type GetBackupCredentialsResponseType = z.infer<
  typeof getBackupCredentialsResponseSchema
>;

export type GetBackupCDNCredentialsOptionsType = Readonly<{
  headers: BackupPresentationHeadersType;
  cdnNumber: number;
}>;

export const getBackupCDNCredentialsResponseSchema = z.object({
  headers: z.record(z.string(), z.string()),
});

export type GetBackupCDNCredentialsResponseType = z.infer<
  typeof getBackupCDNCredentialsResponseSchema
>;

export type GetBackupStreamOptionsType = Readonly<{
  cdn: number;
  backupDir: string;
  backupName: string;
  headers: Record<string, string>;
  downloadOffset: number;
  onProgress: (currentBytes: number, totalBytes: number) => void;
  abortSignal?: AbortSignal;
}>;

export type GetEphemeralBackupStreamOptionsType = Readonly<{
  cdn: number;
  key: string;
  downloadOffset: number;
  onProgress: (currentBytes: number, totalBytes: number) => void;
  abortSignal?: AbortSignal;
}>;

export const getBackupInfoResponseSchema = z.object({
  cdn: z.literal(3),
  backupDir: z.string(),
  mediaDir: z.string(),
  backupName: z.string(),
  usedSpace: z.number().nullish(),
});

export type GetBackupInfoResponseType = z.infer<
  typeof getBackupInfoResponseSchema
>;

export type GetReleaseNoteOptionsType = Readonly<{
  uuid: string;
  locale: string;
}>;

export const releaseNoteSchema = z.object({
  uuid: z.string(),
  title: z.string(),
  body: z.string(),
  linkText: z.string().optional(),
  callToActionText: z.string().optional(),
  includeBoostMessage: z.boolean().optional().default(true),
  bodyRanges: z
    .array(
      z.object({
        style: z.string().optional(),
        start: z.number().optional(),
        length: z.number().optional(),
      })
    )
    .optional(),
  media: z.string().optional(),
  mediaHeight: z.coerce
    .number()
    .optional()
    .transform(x => x || undefined),
  mediaWidth: z.coerce
    .number()
    .optional()
    .transform(x => x || undefined),
  mediaContentType: z.string().optional(),
});

export type ReleaseNoteResponseType = z.infer<typeof releaseNoteSchema>;

export const releaseNotesManifestSchema = z.object({
  announcements: z
    .object({
      uuid: z.string(),
      countries: z.string().optional(),
      desktopMinVersion: z.string().optional(),
      link: z.string().optional(),
      ctaId: z.string().optional(),
    })
    .array(),
});

export type ReleaseNotesManifestResponseType = z.infer<
  typeof releaseNotesManifestSchema
>;

export type GetReleaseNoteImageAttachmentResultType = Readonly<{
  imageData: Uint8Array;
  contentType: string | null;
}>;

export type CallLinkCreateAuthResponseType = Readonly<{
  credential: string;
}>;

export const StorageServiceCredentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const callLinkCreateAuthResponseSchema = z.object({
  credential: z.string(),
}) satisfies z.ZodSchema<CallLinkCreateAuthResponseType>;

const StickerPackUploadAttributesSchema = z.object({
  acl: z.string(),
  algorithm: z.string(),
  credential: z.string(),
  date: z.string(),
  id: z.number(),
  key: z.string(),
  policy: z.string(),
  signature: z.string(),
});

const StickerPackUploadFormSchema = z.object({
  packId: z.string(),
  manifest: StickerPackUploadAttributesSchema,
  stickers: z.array(StickerPackUploadAttributesSchema),
});

const TransferArchiveSchema = z.union([
  z.object({
    cdn: z.number(),
    key: z.string(),
  }),
  z.object({
    error: z.union([
      z.literal('RELINK_REQUESTED'),
      z.literal('CONTINUE_WITHOUT_UPLOAD'),
    ]),
  }),
]);

export type TransferArchiveType = z.infer<typeof TransferArchiveSchema>;

export type GetTransferArchiveOptionsType = Readonly<{
  timeout?: number;
  abortSignal?: AbortSignal;
}>;

export type ProxiedRequestParams = Readonly<{
  method: 'GET' | 'HEAD';
  url: string;
  headers?: HeaderListType;
  signal?: AbortSignal;
}>;

const backupFileHeadersSchema = z.object({
  'content-length': z.coerce.number(),
  'last-modified': z.coerce.date(),
});

type BackupFileHeadersType = z.infer<typeof backupFileHeadersSchema>;

const secondsTimestampToDate = z.coerce
  .number()
  .transform(sec => new Date(sec * 1_000));

const subscriptionResponseSchema = z.object({
  subscription: z
    .object({
      level: z.number(),
      billingCycleAnchor: secondsTimestampToDate.optional(),
      endOfCurrentPeriod: secondsTimestampToDate.optional(),
      active: z.boolean(),
      cancelAtPeriodEnd: z.boolean().optional(),
      currency: z.string().optional(),
      amount: z.number().nonnegative().optional(),
    })
    .transform(data => {
      const result = { ...data };
      if (result.currency && result.amount) {
        result.amount = ZERO_DECIMAL_CURRENCIES.has(
          result.currency.toLowerCase()
        )
          ? result.amount
          : result.amount / 100;
      }
      return result;
    })
    .nullish(),
});

export type SubscriptionResponseType = z.infer<
  typeof subscriptionResponseSchema
>;

export type UploadSignedPreKeyType = {
  keyId: number;
  publicKey: PublicKey;
  signature: Uint8Array;
};
export type UploadPreKeyType = {
  keyId: number;
  publicKey: PublicKey;
};
export type UploadKyberPreKeyType = {
  keyId: number;
  publicKey: KEMPublicKey;
  signature: Uint8Array;
};

type SerializedSignedPreKeyType = Readonly<{
  keyId: number;
  publicKey: string;
  signature: string;
}>;

export type UploadKeysType = {
  identityKey: PublicKey;

  // If a field is not provided, the server won't update its data.
  preKeys?: Array<UploadPreKeyType>;
  pqPreKeys?: Array<UploadKyberPreKeyType>;
  pqLastResortPreKey?: UploadKyberPreKeyType;
  signedPreKey?: UploadSignedPreKeyType;
};

const ServerKeyResponseSchema = z.object({
  devices: z.array(
    z.object({
      deviceId: z.number(),
      registrationId: z.number(),
      preKey: z
        .object({
          keyId: z.number(),
          publicKey: z.string(),
        })
        .nullish(),
      signedPreKey: z
        .object({
          keyId: z.number(),
          publicKey: z.string(),
          signature: z.string(),
        })
        .nullish(),
      pqPreKey: z
        .object({
          keyId: z.number(),
          publicKey: z.string(),
          signature: z.string(),
        })
        .nullish(),
    })
  ),
  identityKey: z.string(),
});

type ServerKeyResponseType = z.infer<typeof ServerKeyResponseSchema>;

export type ServerKeysType = {
  devices: Array<{
    deviceId: number;
    registrationId: number;

    // We'll get a 404 if none of these keys are provided; we'll have at least one
    preKey?: {
      keyId: number;
      publicKey: Uint8Array;
    };
    signedPreKey?: {
      keyId: number;
      publicKey: Uint8Array;
      signature: Uint8Array;
    };
    pqPreKey?: {
      keyId: number;
      publicKey: Uint8Array;
      signature: Uint8Array;
    };
  }>;
  identityKey: Uint8Array;
};

export type ChallengeType = {
  readonly type: 'captcha';
  readonly token: string;
  readonly captcha: string;
};

export type ProxiedRequestOptionsType = {
  returnUint8Array?: boolean;
  start?: number;
  end?: number;
};

type InflightCallback = (cancelReason: string) => unknown;

const libsignalNet = getLibsignalNet();

const {
  serverUrl: chatServiceUrl,
  storageUrl,
  updatesUrl,
  resourcesUrl,
  certificateAuthority,
  contentProxyUrl,
  proxyUrl,
  version,
  stripePublishableKey,
} = window.SignalContext.config;

const cdnUrlObject: Readonly<{
  '0': string;
  [propName: string]: string;
}> = {
  0: window.SignalContext.config.cdnUrl0,
  2: window.SignalContext.config.cdnUrl2,
  3: window.SignalContext.config.cdnUrl3,
};

// We store server alerts (returned on the WS upgrade response headers) so that the app
// can query them later, which is necessary if they arrive before app state is ready
let serverAlerts: Array<ServerAlert> = [];

let username: string | undefined;
let password: string | undefined;

let activeRegistration: ExplodePromiseResultType<void> | undefined;

const PARSE_RANGE_HEADER = /\/(\d+)$/;
const PARSE_GROUP_LOG_RANGE_HEADER =
  /^versions\s+(\d{1,10})-(\d{1,10})\/(\d{1,10})/;

const libsignalRemoteConfig = new Map();
if (isRemoteConfigEnabled('desktop.libsignalNet.enforceMinimumTls')) {
  log.info('libsignal net will require TLS 1.3');
  libsignalRemoteConfig.set('enforceMinimumTls', 'true');
}
if (isRemoteConfigEnabled('desktop.libsignalNet.shadowUnauthChatWithNoise')) {
  log.info('libsignal net will shadow unauth chat connections');
  libsignalRemoteConfig.set('shadowUnauthChatWithNoise', 'true');
}
if (isRemoteConfigEnabled('desktop.libsignalNet.shadowAuthChatWithNoise')) {
  log.info('libsignal net will shadow auth chat connections');
  libsignalRemoteConfig.set('shadowAuthChatWithNoise', 'true');
}
const perMessageDeflateConfigKey = isProduction(version)
  ? 'desktop.libsignalNet.chatPermessageDeflate.prod'
  : 'desktop.libsignalNet.chatPermessageDeflate';
if (isRemoteConfigEnabled(perMessageDeflateConfigKey)) {
  libsignalRemoteConfig.set('chatPermessageDeflate', 'true');
}
libsignalNet.setRemoteConfig(libsignalRemoteConfig);

const socketManager = new SocketManager(libsignalNet, {
  url: chatServiceUrl,
  certificateAuthority,
  version,
  proxyUrl,
});

socketManager.on('statusChange', () => {
  window.Whisper.events.emit('socketStatusChange');
});

socketManager.on('online', () => {
  window.Whisper.events.emit('online');
});

socketManager.on('offline', () => {
  window.Whisper.events.emit('offline');
});

socketManager.on('authError', () => {
  window.Whisper.events.emit('unlinkAndDisconnect');
});

socketManager.on('firstEnvelope', incoming => {
  window.Whisper.events.emit('firstEnvelope', incoming);
});

socketManager.on('serverAlerts', alerts => {
  log.info(`onServerAlerts: number of alerts received: ${alerts.length}`);
  serverAlerts = alerts;
});

const cds = new CDSI(libsignalNet, {
  logger: log,
  proxyUrl,

  async getAuth() {
    return (await _ajax({
      host: 'chatService',
      call: 'directoryAuthV2',
      httpType: 'GET',
      responseType: 'json',
      // TODO DESKTOP-8719
      zodSchema: z.unknown(),
    })) as CDSAuthType;
  },
});

export async function connect({
  username: initialUsername,
  password: initialPassword,
  hasStoriesDisabled,
  hasBuildExpired,
}: WebAPIConnectOptionsType): Promise<void> {
  username = initialUsername;
  password = initialPassword;

  if (hasBuildExpired) {
    drop(socketManager.onExpiration('build'));
  }

  await socketManager.onHasStoriesDisabledChange(hasStoriesDisabled);
  await socketManager.authenticate({ username, password });
}

const inflightRequests = new Set<InflightCallback>();
function registerInflightRequest(request: InflightCallback) {
  inflightRequests.add(request);
}
function unregisterInFlightRequest(request: InflightCallback) {
  inflightRequests.delete(request);
}
export function cancelInflightRequests(reason: JobCancelReason): void {
  const logId = `cancelInflightRequests/${reason}`;
  log.warn(`${logId}: Canceling ${inflightRequests.size} requests`);
  for (const request of inflightRequests) {
    try {
      request(reason);
    } catch (error: unknown) {
      log.error(`${logId}: Failed to cancel request: ${toLogFormat(error)}`);
    }
  }
  inflightRequests.clear();
  log.warn(`${logId}: Done`);
}

let fetchAgent: Agent | undefined;
const fetchForLinkPreviews: linkPreviewFetch.FetchFn = async (href, init) => {
  if (!fetchAgent) {
    if (proxyUrl) {
      fetchAgent = await createProxyAgent(proxyUrl);
    } else {
      fetchAgent = createHTTPSAgent({
        keepAlive: false,
        maxCachedSessions: 0,
      });
    }
  }
  return fetch(href, { ...init, agent: fetchAgent });
};

function _ajax(param: AjaxOptionsType<'bytes', never>): Promise<Uint8Array>;
function _ajax(
  param: AjaxOptionsType<'byteswithdetails', never>
): Promise<BytesWithDetailsType>;
function _ajax<OutputShape>(
  param: AjaxOptionsType<'json', OutputShape>
): Promise<OutputShape>;
function _ajax<OutputShape>(
  param: AjaxOptionsType<'jsonwithdetails', OutputShape>
): Promise<JSONWithDetailsType<OutputShape>>;

async function _ajax<Type extends AjaxResponseType, OutputShape>(
  param: AjaxOptionsType<Type, OutputShape>
): Promise<unknown> {
  const continueDuringRegistration =
    param.host === 'chatService' &&
    (param.unauthenticated || param.isRegistration);
  if (activeRegistration && !continueDuringRegistration) {
    log.info('request blocked by active registration');
    const start = Date.now();
    await activeRegistration.promise;
    const duration = Date.now() - start;
    log.info(`request unblocked after ${duration}ms`);
  }

  if (!param.urlParameters) {
    param.urlParameters = '';
  }

  let host: string;
  let path: string;
  switch (param.host) {
    case 'chatService':
      [host, path] = [chatServiceUrl, CHAT_CALLS[param.call]];
      break;
    case 'resources':
      [host, path] = [resourcesUrl, RESOURCE_CALLS[param.call]];
      break;
    case 'storageService':
      [host, path] = [storageUrl, STORAGE_CALLS[param.call]];
      break;
    default:
      throw missingCaseError(param);
  }
  const useWebSocketForEndpoint = param.host === 'chatService';

  const outerParams: PromiseAjaxOptionsType<Type, OutputShape> = {
    socketManager: useWebSocketForEndpoint ? socketManager : undefined,
    basicAuth: 'basicAuth' in param ? param.basicAuth : undefined,
    certificateAuthority,
    chatServiceUrl,
    contentType: param.contentType || 'application/json; charset=utf-8',
    data:
      param.data ||
      (param.jsonData ? JSON.stringify(param.jsonData) : undefined),
    headers: param.headers,
    host,
    password: 'password' in param ? param.password : password,
    path: path + param.urlParameters,
    proxyUrl,
    responseType: param.responseType ?? ('raw' as Type),
    timeout: param.timeout,
    type: param.httpType,
    user: 'username' in param ? param.username : username,
    redactUrl: param.redactUrl,
    storageUrl,
    validateResponse: param.validateResponse,
    version,
    unauthenticated:
      'unauthenticated' in param ? param.unauthenticated : undefined,
    accessKey: 'accessKey' in param ? param.accessKey : undefined,
    groupSendToken:
      'groupSendToken' in param ? param.groupSendToken : undefined,
    abortSignal: param.abortSignal,
    zodSchema: param.zodSchema,
  };

  try {
    return await _outerAjax(null, outerParams);
  } catch (e) {
    if (!(e instanceof HTTPError)) {
      throw e;
    }
    const translatedError = translateError(e);
    if (translatedError) {
      throw translatedError;
    }
    throw e;
  }
}

function serializeSignedPreKey(
  preKey?: UploadSignedPreKeyType | UploadKyberPreKeyType
): SerializedSignedPreKeyType | undefined {
  if (preKey == null) {
    return undefined;
  }

  const { keyId, publicKey, signature } = preKey;

  return {
    keyId,
    publicKey: Bytes.toBase64(publicKey.serialize()),
    signature: Bytes.toBase64(signature),
  };
}

function serviceIdKindToQuery(kind: ServiceIdKind): string {
  let value: string;
  if (kind === ServiceIdKind.ACI) {
    value = 'aci';
  } else if (kind === ServiceIdKind.PNI) {
    value = 'pni';
  } else {
    throw new Error(`Unsupported ServiceIdKind: ${kind}`);
  }
  return `identity=${value}`;
}

export async function whoami(): Promise<WhoamiResultType> {
  return _ajax({
    host: 'chatService',
    call: 'whoami',
    httpType: 'GET',
    responseType: 'json',
    zodSchema: whoamiResultZod,
  });
}

export async function sendChallengeResponse(
  challengeResponse: ChallengeType
): Promise<void> {
  await _ajax({
    host: 'chatService',
    call: 'challenge',
    httpType: 'PUT',
    jsonData: challengeResponse,
    responseType: 'bytes',
  });
}

export async function authenticate({
  username: newUsername,
  password: newPassword,
}: WebAPICredentials): Promise<void> {
  username = newUsername;
  password = newPassword;

  await socketManager.authenticate({ username, password });
}

export async function logout(): Promise<void> {
  username = '';
  password = '';

  await socketManager.logout();
}

export function getSocketStatus(): SocketStatuses {
  return socketManager.getStatus();
}

export function getServerAlerts(): Array<ServerAlert> {
  return serverAlerts;
}

export function checkSockets(): void {
  // Intentionally not awaiting
  void socketManager.check();
}

export function isOnline(): boolean | undefined {
  return socketManager.isOnline;
}

export async function onNavigatorOnline(): Promise<void> {
  await socketManager.onNavigatorOnline();
}

export async function onNavigatorOffline(): Promise<void> {
  await socketManager.onNavigatorOffline();
}

export async function onExpiration(
  reason: SocketExpirationReason
): Promise<void> {
  await socketManager.onExpiration(reason);
}

export async function reconnect(): Promise<void> {
  await socketManager.reconnect();
}

export function registerRequestHandler(handler: IRequestHandler): void {
  socketManager.registerRequestHandler(handler);
}

export function unregisterRequestHandler(handler: IRequestHandler): void {
  socketManager.unregisterRequestHandler(handler);
}

export function onHasStoriesDisabledChange(newValue: boolean): void {
  void socketManager.onHasStoriesDisabledChange(newValue);
}

export async function getConfig(
  configHash?: string
): Promise<RemoteConfigResponseType> {
  const { data, response } = await _ajax({
    host: 'chatService',
    call: 'configV2',
    httpType: 'GET',
    responseType: 'jsonwithdetails',
    zodSchema: z.union([
      remoteConfigResponseZod,
      // When a 304 is returned, the body of the response is empty.
      z.literal(''),
    ]),
    headers: {
      ...(configHash && { 'if-none-match': configHash }),
    },
  });

  const serverTimestamp = safeParseNumber(
    response.headers.get('x-signal-timestamp') || ''
  );

  if (serverTimestamp == null) {
    throw new Error('Missing required x-signal-timestamp header');
  }

  const newConfigHash = response.headers.get('etag');
  if (newConfigHash == null) {
    throw new Error('Missing required ETag header');
  }

  const partialResponse = { serverTimestamp, configHash: newConfigHash };

  if (response.status === 304) {
    return {
      config: 'unmodified',
      ...partialResponse,
    };
  }

  if (data === '') {
    throw new Error('Empty data returned for non-304');
  }

  const { config: newConfig } = data;

  const config = new Map(
    Object.entries(newConfig).filter(
      ([name, _value]) =>
        name.startsWith('desktop.') ||
        name.startsWith('global.') ||
        name.startsWith('cds.')
    )
  );

  return {
    config,
    ...partialResponse,
  };
}

export async function getSenderCertificate(
  omitE164?: boolean
): Promise<GetSenderCertificateResultType> {
  return (await _ajax({
    host: 'chatService',
    call: 'deliveryCert',
    httpType: 'GET',
    responseType: 'json',
    validateResponse: { certificate: 'string' },
    ...(omitE164 ? { urlParameters: '?includeE164=false' } : {}),
    // TODO DESKTOP-8719
    zodSchema: z.unknown(),
  })) as GetSenderCertificateResultType;
}

export async function getStorageCredentials(): Promise<StorageServiceCredentials> {
  return _ajax({
    host: 'chatService',
    call: 'storageToken',
    httpType: 'GET',
    responseType: 'json',
    zodSchema: StorageServiceCredentialsSchema,
  });
}

export async function getOnboardingStoryManifest(): Promise<{
  version: string;
  languages: Record<string, Array<string>>;
}> {
  const res = await _ajax({
    call: 'getOnboardingStoryManifest',
    host: 'resources',
    httpType: 'GET',
    responseType: 'json',
    // TODO DESKTOP-8719
    zodSchema: z.unknown(),
  });

  return res as {
    version: string;
    languages: Record<string, Array<string>>;
  };
}

export async function redeemReceipt(
  options: RedeemReceiptOptionsType
): Promise<void> {
  await _ajax({
    host: 'chatService',
    call: 'redeemReceipt',
    httpType: 'POST',
    jsonData: options,
    responseType: 'byteswithdetails',
  });
}

export async function getReleaseNoteHash({
  uuid,
  locale,
}: {
  uuid: string;
  locale: string;
}): Promise<string | undefined> {
  const { response } = await _ajax({
    call: 'releaseNotes',
    host: 'resources',
    httpType: 'HEAD',
    urlParameters: `/${uuid}/${locale}.json`,
    responseType: 'byteswithdetails',
  });

  const etag = response.headers.get('etag');

  if (etag == null) {
    return undefined;
  }

  return etag;
}
export async function getReleaseNote({
  uuid,
  locale,
}: {
  uuid: string;
  locale: string;
}): Promise<ReleaseNoteResponseType> {
  return _ajax({
    call: 'releaseNotes',
    host: 'resources',
    httpType: 'GET',
    responseType: 'json',
    urlParameters: `/${uuid}/${locale}.json`,
    zodSchema: releaseNoteSchema,
  });
}

export async function getReleaseNotesManifest(): Promise<ReleaseNotesManifestResponseType> {
  return _ajax({
    call: 'releaseNotesManifest',
    host: 'resources',
    httpType: 'GET',
    responseType: 'json',
    zodSchema: releaseNotesManifestSchema,
  });
}

export async function getReleaseNotesManifestHash(): Promise<
  string | undefined
> {
  const { response } = await _ajax({
    call: 'releaseNotesManifest',
    host: 'resources',
    httpType: 'HEAD',
    responseType: 'byteswithdetails',
  });

  const etag = response.headers.get('etag');
  if (etag == null) {
    return undefined;
  }

  return etag;
}

export async function getReleaseNoteImageAttachment(
  path: string
): Promise<GetReleaseNoteImageAttachmentResultType> {
  const { origin: expectedOrigin } = new URL(resourcesUrl);
  const url = `${resourcesUrl}${path}`;
  const { origin } = new URL(url);
  strictAssert(origin === expectedOrigin, `Unexpected origin: ${origin}`);

  const { data: imageData, contentType } = await _outerAjax(url, {
    certificateAuthority,
    proxyUrl,
    responseType: 'byteswithdetails',
    timeout: 0,
    type: 'GET',
    version,
  });

  return {
    imageData,
    contentType,
  };
}

export async function getStorageManifest(
  options: StorageServiceCallOptionsType = {}
): Promise<Uint8Array> {
  const { credentials, greaterThanVersion } = options;

  const { data, response } = await _ajax({
    call: 'storageManifest',
    contentType: 'application/x-protobuf',
    host: 'storageService',
    httpType: 'GET',
    responseType: 'byteswithdetails',
    urlParameters: greaterThanVersion ? `/version/${greaterThanVersion}` : '',
    ...credentials,
  });

  if (response.status === 204) {
    throw makeHTTPError(
      'promiseAjax: error response',
      response.status,
      response.headers.raw(),
      data,
      new Error().stack
    );
  }

  return data;
}

export async function getStorageRecords(
  data: Uint8Array,
  options: StorageServiceCallOptionsType = {}
): Promise<Uint8Array> {
  const { credentials } = options;

  return _ajax({
    call: 'storageRead',
    contentType: 'application/x-protobuf',
    data,
    host: 'storageService',
    httpType: 'PUT',
    responseType: 'bytes',
    ...credentials,
  });
}

export async function modifyStorageRecords(
  data: Uint8Array,
  options: StorageServiceCallOptionsType = {}
): Promise<Uint8Array> {
  const { credentials } = options;

  return _ajax({
    call: 'storageModify',
    contentType: 'application/x-protobuf',
    data,
    host: 'storageService',
    httpType: 'PUT',
    // If we run into a conflict, the current manifest is returned -
    //   it will will be an Uint8Array at the response key on the Error
    responseType: 'bytes',
    ...credentials,
  });
}

export async function registerCapabilities(
  capabilities: CapabilitiesUploadType
): Promise<void> {
  await _ajax({
    host: 'chatService',
    call: 'registerCapabilities',
    httpType: 'PUT',
    jsonData: capabilities,
  });
}

export async function postBatchIdentityCheck(
  elements: VerifyServiceIdRequestType
): Promise<VerifyServiceIdResponseType> {
  const res = await _ajax({
    host: 'chatService',
    data: JSON.stringify({ elements }),
    call: 'batchIdentityCheck',
    httpType: 'POST',
    responseType: 'json',
    // TODO DESKTOP-8719
    zodSchema: z.unknown(),
  });

  const result = safeParseUnknown(verifyServiceIdResponse, res);

  if (result.success) {
    return result.data;
  }

  log.error(
    'invalid response from postBatchIdentityCheck',
    toLogFormat(result.error)
  );

  throw result.error;
}

function getProfileUrl(
  serviceId: ServiceIdString,
  {
    profileKeyVersion,
    profileKeyCredentialRequest,
  }: ProfileFetchAuthRequestOptions | ProfileFetchUnauthRequestOptions
) {
  let profileUrl = `/${serviceId}`;
  if (profileKeyVersion != null) {
    profileUrl += `/${profileKeyVersion}`;
    if (profileKeyCredentialRequest != null) {
      profileUrl +=
        `/${profileKeyCredentialRequest}` +
        '?credentialType=expiringProfileKey';
    }
  } else {
    strictAssert(
      profileKeyCredentialRequest == null,
      'getProfileUrl called without version, but with request'
    );
  }

  return profileUrl;
}

export async function getProfile(
  serviceId: ServiceIdString,
  options: ProfileFetchAuthRequestOptions
): Promise<ProfileType> {
  const { profileKeyVersion, profileKeyCredentialRequest } = options;

  return (await _ajax({
    host: 'chatService',
    call: 'profile',
    httpType: 'GET',
    urlParameters: getProfileUrl(serviceId, options),
    responseType: 'json',
    redactUrl: _createRedactor(
      serviceId,
      profileKeyVersion,
      profileKeyCredentialRequest
    ),
    // TODO DESKTOP-8719
    zodSchema: z.unknown(),
  })) as ProfileType;
}

export async function getTransferArchive({
  timeout = HOUR,
  abortSignal,
}: GetTransferArchiveOptionsType): Promise<TransferArchiveType> {
  const timeoutTime = Date.now() + timeout;

  let remainingTime: number;
  do {
    remainingTime = Math.max(timeoutTime - Date.now(), 0);

    const requestTimeoutInSecs = Math.round(
      Math.min(remainingTime, 5 * MINUTE) / SECOND
    );

    const urlParameters = timeout
      ? `?timeout=${encodeURIComponent(requestTimeoutInSecs)}`
      : undefined;

    // eslint-disable-next-line no-await-in-loop
    const { data, response } = await _ajax({
      host: 'chatService',
      call: 'transferArchive',
      httpType: 'GET',
      responseType: 'jsonwithdetails',
      urlParameters,
      // Add a bit of leeway to let server respond properly
      timeout: (requestTimeoutInSecs + 15) * SECOND,
      abortSignal,
      // We may also get a 204 with no content, indicating we should try again
      zodSchema: TransferArchiveSchema.or(z.literal('')),
    });

    if (response.status === 200) {
      strictAssert(data !== '', '200 must have data');
      return data;
    }

    strictAssert(
      response.status === 204,
      'Invalid transfer archive status code'
    );

    if (abortSignal?.aborted) {
      break;
    }

    // Timed out, see if we can retry
  } while (!timeout || remainingTime != null);

  throw new Error('Timed out');
}

export async function getAccountForUsername({
  hash,
}: GetAccountForUsernameOptionsType): Promise<GetAccountForUsernameResultType> {
  const hashBase64 = toWebSafeBase64(Bytes.toBase64(hash));
  return _ajax({
    host: 'chatService',
    call: 'username',
    httpType: 'GET',
    urlParameters: `/${hashBase64}`,
    responseType: 'json',
    redactUrl: _createRedactor(hashBase64),
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    zodSchema: getAccountForUsernameResultZod,
  });
}

export async function putProfile(
  jsonData: ProfileRequestDataType
): Promise<UploadAvatarHeadersOrOtherType> {
  return _ajax({
    host: 'chatService',
    call: 'profile',
    httpType: 'PUT',
    responseType: 'json',
    jsonData,
    zodSchema: uploadAvatarOrOther,
  });
}

export async function getProfileUnauth(
  serviceId: ServiceIdString,
  options: ProfileFetchUnauthRequestOptions
): Promise<ProfileType> {
  const {
    accessKey,
    groupSendToken,
    profileKeyVersion,
    profileKeyCredentialRequest,
  } = options;

  if (profileKeyVersion != null || profileKeyCredentialRequest != null) {
    // Without an up-to-date profile key, we won't be able to read the
    // profile anyways so there's no point in falling back to endorsements.
    strictAssert(
      groupSendToken == null,
      'Should not use endorsements for fetching a versioned profile'
    );
  }

  return (await _ajax({
    host: 'chatService',
    call: 'profile',
    httpType: 'GET',
    urlParameters: getProfileUrl(serviceId, options),
    responseType: 'json',
    unauthenticated: true,
    accessKey: accessKey ?? undefined,
    groupSendToken: groupSendToken ?? undefined,
    redactUrl: _createRedactor(
      serviceId,
      profileKeyVersion,
      profileKeyCredentialRequest
    ),
    // TODO DESKTOP-8719
    zodSchema: z.unknown(),
  })) as ProfileType;
}

export async function getBadgeImageFile(
  imageFileUrl: string
): Promise<Uint8Array> {
  strictAssert(
    isBadgeImageFileUrlValid(imageFileUrl, updatesUrl),
    'getBadgeImageFile got an invalid URL. Was bad data saved?'
  );

  return _outerAjax(imageFileUrl, {
    certificateAuthority,
    contentType: 'application/octet-stream',
    proxyUrl,
    responseType: 'bytes',
    timeout: 0,
    type: 'GET',
    redactUrl: (href: string) => {
      const parsedUrl = maybeParseUrl(href);
      if (!parsedUrl) {
        return href;
      }
      const { pathname } = parsedUrl;
      const pattern = RegExp(escapeRegExp(pathname), 'g');
      return href.replace(pattern, `[REDACTED]${pathname.slice(-3)}`);
    },
    version,
  });
}

export async function downloadOnboardingStories(
  manifestVersion: string,
  imageFiles: Array<string>
): Promise<Array<Uint8Array>> {
  return Promise.all(
    imageFiles.map(fileName =>
      _outerAjax(
        `${resourcesUrl}/static/desktop/stories/onboarding/${manifestVersion}/${fileName}.jpg`,
        {
          certificateAuthority,
          contentType: 'application/octet-stream',
          proxyUrl,
          responseType: 'bytes',
          timeout: 0,
          type: 'GET',
          version,
        }
      )
    )
  );
}

export async function getSubscriptionConfiguration(): Promise<SubscriptionConfigurationResultType> {
  return _ajax({
    host: 'chatService',
    call: 'subscriptionConfiguration',
    httpType: 'GET',
    responseType: 'json',
    zodSchema: subscriptionConfigurationResultZod,
  });
}

export async function getAvatar(path: string): Promise<Uint8Array> {
  // Using _outerAJAX, since it's not hardcoded to the Signal Server. Unlike our
  //   attachment CDN, it uses our self-signed certificate, so we pass it in.
  return _outerAjax(`${cdnUrlObject['0']}/${path}`, {
    certificateAuthority,
    contentType: 'application/octet-stream',
    proxyUrl,
    responseType: 'bytes',
    timeout: 90 * SECOND,
    type: 'GET',
    redactUrl: (href: string) => {
      const pattern = RegExp(escapeRegExp(path), 'g');
      return href.replace(pattern, `[REDACTED]${path.slice(-3)}`);
    },
    version,
  });
}

export async function deleteUsername(abortSignal?: AbortSignal): Promise<void> {
  await _ajax({
    host: 'chatService',
    call: 'username',
    httpType: 'DELETE',
    abortSignal,
  });
}

export async function reserveUsername({
  hashes,
  abortSignal,
}: ReserveUsernameOptionsType): Promise<ReserveUsernameResultType> {
  return _ajax({
    host: 'chatService',
    call: 'reserveUsername',
    httpType: 'PUT',
    jsonData: {
      usernameHashes: hashes.map(hash => toWebSafeBase64(Bytes.toBase64(hash))),
    },
    responseType: 'json',
    abortSignal,
    zodSchema: reserveUsernameResultZod,
  });
}
export async function confirmUsername({
  hash,
  proof,
  encryptedUsername,
  abortSignal,
}: ConfirmUsernameOptionsType): Promise<ConfirmUsernameResultType> {
  return _ajax({
    host: 'chatService',
    call: 'confirmUsername',
    httpType: 'PUT',
    jsonData: {
      usernameHash: toWebSafeBase64(Bytes.toBase64(hash)),
      zkProof: toWebSafeBase64(Bytes.toBase64(proof)),
      encryptedUsername: toWebSafeBase64(Bytes.toBase64(encryptedUsername)),
    },
    responseType: 'json',
    abortSignal,
    zodSchema: confirmUsernameResultZod,
  });
}

export async function replaceUsernameLink({
  encryptedUsername,
  keepLinkHandle,
}: ReplaceUsernameLinkOptionsType): Promise<ReplaceUsernameLinkResultType> {
  return _ajax({
    host: 'chatService',
    call: 'usernameLink',
    httpType: 'PUT',
    responseType: 'json',
    jsonData: {
      usernameLinkEncryptedValue: toWebSafeBase64(
        Bytes.toBase64(encryptedUsername)
      ),
      keepLinkHandle,
    },
    zodSchema: replaceUsernameLinkResultZod,
  });
}

export async function deleteUsernameLink(): Promise<void> {
  await _ajax({
    host: 'chatService',
    call: 'usernameLink',
    httpType: 'DELETE',
  });
}

export async function resolveUsernameLink(
  serverId: string
): Promise<ResolveUsernameLinkResultType> {
  return _ajax({
    host: 'chatService',
    httpType: 'GET',
    call: 'usernameLink',
    urlParameters: `/${encodeURIComponent(serverId)}`,
    responseType: 'json',
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    zodSchema: resolveUsernameLinkResultZod,
  });
}

export async function reportMessage({
  senderAci,
  serverGuid,
  token,
}: ReportMessageOptionsType): Promise<void> {
  const jsonData = { token };

  await _ajax({
    host: 'chatService',
    call: 'reportMessage',
    httpType: 'POST',
    urlParameters: urlPathFromComponents([senderAci, serverGuid]),
    responseType: 'bytes',
    jsonData,
  });
}

export async function requestVerification(
  number: string,
  captcha: string,
  transport: VerificationTransport
): Promise<RequestVerificationResultType> {
  // Create a new blank session using just a E164
  const session = await libsignalNet.createRegistrationSession({
    e164: number,
  });

  // Submit a captcha solution to the session
  await session.submitCaptcha(captcha);

  // Verify that captcha was accepted
  if (!session.sessionState.allowedToRequestCode) {
    throw new Error('requestVerification: Not allowed to send code');
  }

  // Request an SMS or Voice confirmation
  await session.requestVerification({
    transport: transport === VerificationTransport.SMS ? 'sms' : 'voice',
    client: 'ios',
    languages: [],
  });

  // Return sessionId to be used in `createAccount`
  return { sessionId: session.sessionId };
}

export async function checkAccountExistence(
  serviceId: ServiceIdString
): Promise<boolean> {
  try {
    await _ajax({
      host: 'chatService',
      httpType: 'HEAD',
      call: 'accountExistence',
      urlParameters: `/${serviceId}`,
      unauthenticated: true,
      accessKey: undefined,
      groupSendToken: undefined,
    });
    return true;
  } catch (error) {
    if (error instanceof HTTPError && error.code === 404) {
      return false;
    }

    throw error;
  }
}

export function startRegistration(): unknown {
  strictAssert(
    activeRegistration === undefined,
    'Registration already in progress'
  );

  activeRegistration = explodePromise<void>();
  log.info('starting registration');

  return activeRegistration;
}

export function finishRegistration(registration: unknown): void {
  strictAssert(activeRegistration !== undefined, 'No active registration');
  strictAssert(
    activeRegistration === registration,
    'Invalid registration baton'
  );

  log.info('finishing registration');
  const current = activeRegistration;
  activeRegistration = undefined;
  current.resolve();
}

async function _withNewCredentials<
  Result extends { uuid: AciString; deviceId?: number },
>(
  { username: newUsername, password: newPassword }: WebAPICredentials,
  callback: () => Promise<Result>
): Promise<Result> {
  // Reset old websocket credentials and disconnect.
  // AccountManager is our only caller and it will trigger
  // `registration_done` which will update credentials.
  await logout();

  // Update REST credentials, though. We need them for the call below
  username = newUsername;
  password = newPassword;

  const result = await callback();

  const { uuid: aci = newUsername, deviceId = 1 } = result;

  // Set final REST credentials to let `registerKeys` succeed.
  username = `${aci}.${deviceId}`;
  password = newPassword;

  return result;
}

export async function createAccount({
  sessionId,
  number,
  code,
  newPassword,
  registrationId,
  pniRegistrationId,
  accessKey,
  aciPublicKey,
  pniPublicKey,
  aciSignedPreKey,
  pniSignedPreKey,
  aciPqLastResortPreKey,
  pniPqLastResortPreKey,
}: CreateAccountOptionsType): Promise<CreateAccountResultType> {
  const session = await libsignalNet.resumeRegistrationSession({
    sessionId,
    e164: number,
  });
  const verified = await session.verifySession(code);

  if (!verified) {
    throw new Error('createAccount: invalid code');
  }

  const capabilities: CapabilitiesUploadType = {
    attachmentBackfill: true,
    spqr: true,
  };

  // Desktop doesn't support recovery but we need to provide a recovery password.
  // Since the value isn't used, just use a random one and then throw it away.
  const recoveryPassword = getRandomBytes(32);
  const accountAttributes = new AccountAttributes({
    aciRegistrationId: registrationId,
    pniRegistrationId,
    capabilities: new Set(
      Object.entries(capabilities).flatMap(([k, v]) => (v ? [k] : []))
    ),
    unidentifiedAccessKey: accessKey,
    unrestrictedUnidentifiedAccess: false,
    recoveryPassword,
    registrationLock: null,
    discoverableByPhoneNumber: false,
  });

  // Massages UploadSignedPreKey into SignedPublicPreKey and likewise for Kyber.
  function asSignedKey<K>(key: {
    keyId: number;
    publicKey: K;
    signature: Uint8Array;
  }): {
    id: () => number;
    publicKey: () => K;
    signature: () => Uint8Array;
  } {
    return {
      id: () => key.keyId,
      signature: () => key.signature,
      publicKey: () => key.publicKey,
    };
  }

  const { aci, pni } = await session.registerAccount({
    accountPassword: newPassword,
    accountAttributes,
    skipDeviceTransfer: true,
    aciPublicKey,
    pniPublicKey,
    aciSignedPreKey: asSignedKey(aciSignedPreKey),
    pniSignedPreKey: asSignedKey(pniSignedPreKey),
    aciPqLastResortPreKey: asSignedKey(aciPqLastResortPreKey),
    pniPqLastResortPreKey: asSignedKey(pniPqLastResortPreKey),
  });

  return { aci, pni };
}

export async function linkDevice({
  number,
  verificationCode,
  encryptedDeviceName,
  newPassword,
  registrationId,
  pniRegistrationId,
  aciSignedPreKey,
  pniSignedPreKey,
  aciPqLastResortPreKey,
  pniPqLastResortPreKey,
}: LinkDeviceOptionsType): Promise<LinkDeviceResultType> {
  const capabilities: CapabilitiesUploadType = {
    attachmentBackfill: true,
    spqr: true,
  };

  const jsonData = {
    verificationCode,
    accountAttributes: {
      fetchesMessages: true,
      name: encryptedDeviceName,
      registrationId,
      pniRegistrationId,
      capabilities,
    },
    aciSignedPreKey: serializeSignedPreKey(aciSignedPreKey),
    pniSignedPreKey: serializeSignedPreKey(pniSignedPreKey),
    aciPqLastResortPreKey: serializeSignedPreKey(aciPqLastResortPreKey),
    pniPqLastResortPreKey: serializeSignedPreKey(pniPqLastResortPreKey),
  };
  return _withNewCredentials(
    {
      username: number,
      password: newPassword,
    },
    async () => {
      const response = await _ajax({
        host: 'chatService',
        isRegistration: true,
        call: 'linkDevice',
        httpType: 'PUT',
        responseType: 'json',
        jsonData,
        zodSchema: linkDeviceResultZod,
      });

      return response;
    }
  );
}

export async function unlink(): Promise<void> {
  if (!username) {
    return;
  }

  const [, deviceId] = username.split('.');
  await _ajax({
    host: 'chatService',
    call: 'devices',
    httpType: 'DELETE',
    urlParameters: `/${deviceId}`,
  });
}

export async function getDevices(): Promise<GetDevicesResultType> {
  return _ajax({
    host: 'chatService',
    call: 'devices',
    httpType: 'GET',
    responseType: 'json',
    zodSchema: getDevicesResultZod,
  });
}

export async function updateDeviceName(deviceName: string): Promise<void> {
  await _ajax({
    host: 'chatService',
    call: 'updateDeviceName',
    httpType: 'PUT',
    jsonData: {
      deviceName,
    },
  });
}

export async function getIceServers(): Promise<GetIceServersResultType> {
  return (await _ajax({
    host: 'chatService',
    call: 'getIceServers',
    httpType: 'GET',
    responseType: 'json',
    // TODO DESKTOP-8719
    zodSchema: z.unknown(),
  })) as GetIceServersResultType;
}

type JSONSignedPreKeyType = {
  keyId: number;
  publicKey: string;
  signature: string;
};
type JSONPreKeyType = {
  keyId: number;
  publicKey: string;
};
type JSONKyberPreKeyType = {
  keyId: number;
  publicKey: string;
  signature: string;
};

type JSONKeysType = {
  preKeys?: Array<JSONPreKeyType>;
  pqPreKeys?: Array<JSONKyberPreKeyType>;
  pqLastResortPreKey?: JSONKyberPreKeyType;
  signedPreKey?: JSONSignedPreKeyType;
};

export async function registerKeys(
  genKeys: UploadKeysType,
  serviceIdKind: ServiceIdKind
): Promise<void> {
  const preKeys = genKeys.preKeys?.map(key => ({
    keyId: key.keyId,
    publicKey: Bytes.toBase64(key.publicKey.serialize()),
  }));
  const pqPreKeys = genKeys.pqPreKeys?.map(key => ({
    keyId: key.keyId,
    publicKey: Bytes.toBase64(key.publicKey.serialize()),
    signature: Bytes.toBase64(key.signature),
  }));

  if (
    !preKeys?.length &&
    !pqPreKeys?.length &&
    !genKeys.pqLastResortPreKey &&
    !genKeys.signedPreKey
  ) {
    throw new Error(
      'registerKeys: None of the four potential key types were provided!'
    );
  }
  if (preKeys && preKeys.length === 0) {
    throw new Error('registerKeys: Attempting to upload zero preKeys!');
  }
  if (pqPreKeys && pqPreKeys.length === 0) {
    throw new Error('registerKeys: Attempting to upload zero pqPreKeys!');
  }

  const keys: JSONKeysType = {
    preKeys,
    pqPreKeys,
    pqLastResortPreKey: serializeSignedPreKey(genKeys.pqLastResortPreKey),
    signedPreKey: serializeSignedPreKey(genKeys.signedPreKey),
  };

  await _ajax({
    host: 'chatService',
    isRegistration: true,
    call: 'keys',
    urlParameters: `?${serviceIdKindToQuery(serviceIdKind)}`,
    httpType: 'PUT',
    jsonData: keys,
  });
}

export async function getBackupInfo(
  headers: BackupPresentationHeadersType
): Promise<GetBackupInfoResponseType> {
  return _ajax({
    host: 'chatService',
    call: 'backup',
    httpType: 'GET',
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    headers,
    responseType: 'json',
    zodSchema: getBackupInfoResponseSchema,
  });
}

export async function getBackupStream({
  headers,
  cdn,
  backupDir,
  backupName,
  downloadOffset,
  onProgress,
  abortSignal,
}: GetBackupStreamOptionsType): Promise<Readable> {
  return _getAttachment({
    cdnPath: `/backups/${encodeURIComponent(backupDir)}/${encodeURIComponent(backupName)}`,
    cdnNumber: cdn,
    redactor: _createRedactor(backupDir, backupName),
    headers,
    options: {
      downloadOffset,
      onProgress,
      abortSignal,
    },
  });
}
export async function getBackupFileHeaders({
  headers,
  cdn,
  backupDir,
  backupName,
}: Pick<
  GetBackupStreamOptionsType,
  'headers' | 'cdn' | 'backupDir' | 'backupName'
>): Promise<BackupFileHeadersType> {
  const result = await _getAttachmentHeaders({
    cdnPath: `/backups/${encodeURIComponent(backupDir)}/${encodeURIComponent(backupName)}`,
    cdnNumber: cdn,
    redactor: _createRedactor(backupDir, backupName),
    headers,
  });
  const responseHeaders = Object.fromEntries(result.entries());

  return parseUnknown(backupFileHeadersSchema, responseHeaders as unknown);
}

export async function getEphemeralBackupStream({
  cdn,
  key,
  downloadOffset,
  onProgress,
  abortSignal,
}: GetEphemeralBackupStreamOptionsType): Promise<Readable> {
  return _getAttachment({
    cdnNumber: cdn,
    cdnPath: `/attachments/${encodeURIComponent(key)}`,
    redactor: _createRedactor(key),
    options: {
      downloadOffset,
      onProgress,
      abortSignal,
    },
  });
}

export async function getBackupMediaUploadForm(
  headers: BackupPresentationHeadersType
): Promise<AttachmentUploadFormResponseType> {
  return _ajax({
    host: 'chatService',
    call: 'getBackupMediaUploadForm',
    httpType: 'GET',
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    headers,
    responseType: 'json',
    zodSchema: attachmentUploadFormResponse,
  });
}

export function createFetchForAttachmentUpload({
  signedUploadLocation,
  headers: uploadHeaders,
  cdn,
}: AttachmentUploadFormResponseType): FetchFunctionType {
  strictAssert(cdn === 3, 'Fetch can only be created for CDN 3');
  const { origin: expectedOrigin } = new URL(signedUploadLocation);

  return async (
    endpoint: string | URL,
    init: RequestInit
  ): Promise<Response> => {
    const { origin } = new URL(endpoint);
    strictAssert(origin === expectedOrigin, `Unexpected origin: ${origin}`);

    const fetchOptions = await getFetchOptions({
      // Will be overriden
      type: 'GET',

      certificateAuthority,
      proxyUrl,
      timeout: 0,
      version,

      headers: uploadHeaders,
    });

    return fetch(endpoint, {
      ...fetchOptions,
      ...init,
      headers: {
        ...fetchOptions.headers,
        ...init.headers,
      },
    });
  };
}

export async function getBackupUploadForm(
  headers: BackupPresentationHeadersType
): Promise<AttachmentUploadFormResponseType> {
  return _ajax({
    host: 'chatService',
    call: 'getBackupUploadForm',
    httpType: 'GET',
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    headers,
    responseType: 'json',
    zodSchema: attachmentUploadFormResponse,
  });
}

export async function refreshBackup(
  headers: BackupPresentationHeadersType
): Promise<void> {
  await _ajax({
    host: 'chatService',
    call: 'backup',
    httpType: 'POST',
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    headers,
  });
}

export async function getBackupCredentials({
  startDayInMs,
  endDayInMs,
}: GetBackupCredentialsOptionsType): Promise<GetBackupCredentialsResponseType> {
  const startDayInSeconds = startDayInMs / SECOND;
  const endDayInSeconds = endDayInMs / SECOND;
  return _ajax({
    host: 'chatService',
    call: 'getBackupCredentials',
    httpType: 'GET',
    urlParameters:
      `?redemptionStartSeconds=${startDayInSeconds}&` +
      `redemptionEndSeconds=${endDayInSeconds}`,
    responseType: 'json',
    zodSchema: getBackupCredentialsResponseSchema,
  });
}

export async function getBackupCDNCredentials({
  headers,
  cdnNumber,
}: GetBackupCDNCredentialsOptionsType): Promise<GetBackupCDNCredentialsResponseType> {
  return _ajax({
    host: 'chatService',
    call: 'getBackupCDNCredentials',
    httpType: 'GET',
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    headers,
    urlParameters: `?cdn=${cdnNumber}`,
    responseType: 'json',
    zodSchema: getBackupCDNCredentialsResponseSchema,
  });
}

export async function setBackupId({
  messagesBackupAuthCredentialRequest,
  mediaBackupAuthCredentialRequest,
}: SetBackupIdOptionsType): Promise<void> {
  await _ajax({
    host: 'chatService',
    call: 'setBackupId',
    httpType: 'PUT',
    jsonData: {
      messagesBackupAuthCredentialRequest: Bytes.toBase64(
        messagesBackupAuthCredentialRequest
      ),
      mediaBackupAuthCredentialRequest: Bytes.toBase64(
        mediaBackupAuthCredentialRequest
      ),
    },
  });
}

export async function setBackupSignatureKey({
  headers,
  backupIdPublicKey,
}: SetBackupSignatureKeyOptionsType): Promise<void> {
  await _ajax({
    host: 'chatService',
    call: 'setBackupSignatureKey',
    httpType: 'PUT',
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    headers,
    jsonData: {
      backupIdPublicKey: Bytes.toBase64(backupIdPublicKey),
    },
  });
}

export async function backupMediaBatch({
  headers,
  items,
}: BackupMediaBatchOptionsType): Promise<BackupMediaBatchResponseType> {
  return _ajax({
    host: 'chatService',
    call: 'backupMediaBatch',
    httpType: 'PUT',
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    headers,
    responseType: 'json',
    jsonData: {
      items: items.map(item => {
        const {
          sourceAttachment,
          objectLength,
          mediaId,
          hmacKey,
          encryptionKey,
        } = item;

        return {
          sourceAttachment: {
            cdn: sourceAttachment.cdn,
            key: sourceAttachment.key,
          },
          objectLength,
          mediaId,
          hmacKey: Bytes.toBase64(hmacKey),
          encryptionKey: Bytes.toBase64(encryptionKey),
        };
      }),
    },
    zodSchema: backupMediaBatchResponseSchema,
  });
}

export async function backupDeleteMedia({
  headers,
  mediaToDelete,
}: BackupDeleteMediaOptionsType): Promise<void> {
  await _ajax({
    host: 'chatService',
    call: 'backupMediaDelete',
    httpType: 'POST',
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    headers,
    jsonData: {
      mediaToDelete: mediaToDelete.map(({ cdn, mediaId }) => {
        return {
          cdn,
          mediaId,
        };
      }),
    },
  });
}

export async function backupListMedia({
  headers,
  cursor,
  limit,
}: BackupListMediaOptionsType): Promise<BackupListMediaResponseType> {
  const params = new Array<string>();

  if (cursor != null) {
    params.push(`cursor=${encodeURIComponent(cursor)}`);
  }
  params.push(`limit=${limit}`);

  return _ajax({
    host: 'chatService',
    call: 'backupMedia',
    httpType: 'GET',
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    headers,
    responseType: 'json',
    urlParameters: `?${params.join('&')}`,
    zodSchema: backupListMediaResponseSchema,
  });
}

export async function callLinkCreateAuth(
  requestBase64: string
): Promise<CallLinkCreateAuthResponseType> {
  return _ajax({
    host: 'chatService',
    call: 'callLinkCreateAuth',
    httpType: 'POST',
    responseType: 'json',
    jsonData: { createCallLinkCredentialRequest: requestBase64 },
    zodSchema: callLinkCreateAuthResponseSchema,
  });
}

export async function setPhoneNumberDiscoverability(
  newValue: boolean
): Promise<void> {
  await _ajax({
    host: 'chatService',
    call: 'phoneNumberDiscoverability',
    httpType: 'PUT',
    jsonData: {
      discoverableByPhoneNumber: newValue,
    },
  });
}

export async function getMyKeyCounts(
  serviceIdKind: ServiceIdKind
): Promise<z.infer<typeof ServerKeyCountSchema>> {
  return _ajax({
    host: 'chatService',
    call: 'keys',
    urlParameters: `?${serviceIdKindToQuery(serviceIdKind)}`,
    httpType: 'GET',
    responseType: 'json',
    zodSchema: ServerKeyCountSchema,
  });
}

function handleKeys(res: ServerKeyResponseType): ServerKeysType {
  if (!Array.isArray(res.devices)) {
    throw new Error('Invalid response');
  }

  const devices = res.devices.map(device => {
    if (
      !_validateResponse(device, { signedPreKey: 'object' }) ||
      !_validateResponse(device.signedPreKey, {
        publicKey: 'string',
        signature: 'string',
      })
    ) {
      throw new Error('Invalid signedPreKey');
    }

    let preKey;
    if (device.preKey) {
      if (
        !_validateResponse(device, { preKey: 'object' }) ||
        !_validateResponse(device.preKey, { publicKey: 'string' })
      ) {
        throw new Error('Invalid preKey');
      }

      preKey = {
        keyId: device.preKey.keyId,
        publicKey: Bytes.fromBase64(device.preKey.publicKey),
      };
    }

    return {
      deviceId: device.deviceId,
      registrationId: device.registrationId,
      ...(preKey ? { preKey } : null),
      ...(device.signedPreKey
        ? {
            signedPreKey: {
              keyId: device.signedPreKey.keyId,
              publicKey: Bytes.fromBase64(device.signedPreKey.publicKey),
              signature: Bytes.fromBase64(device.signedPreKey.signature),
            },
          }
        : null),
      ...(device.pqPreKey
        ? {
            pqPreKey: {
              keyId: device.pqPreKey.keyId,
              publicKey: Bytes.fromBase64(device.pqPreKey.publicKey),
              signature: Bytes.fromBase64(device.pqPreKey.signature),
            },
          }
        : null),
    };
  });

  return {
    devices,
    identityKey: Bytes.fromBase64(res.identityKey),
  };
}

export async function getKeysForServiceId(
  serviceId: ServiceIdString,
  deviceId?: number
): Promise<ServerKeysType> {
  const keys = await _ajax({
    host: 'chatService',
    call: 'keys',
    httpType: 'GET',
    urlParameters: `/${serviceId}/${deviceId || '*'}`,
    responseType: 'json',
    zodSchema: ServerKeyResponseSchema,
  });
  return handleKeys(keys);
}

export async function getKeysForServiceIdUnauth(
  serviceId: ServiceIdString,
  deviceId?: number,
  {
    accessKey,
    groupSendToken,
  }: { accessKey?: string; groupSendToken?: GroupSendToken } = {}
): Promise<ServerKeysType> {
  const keys = await _ajax({
    host: 'chatService',
    call: 'keys',
    httpType: 'GET',
    urlParameters: `/${serviceId}/${deviceId || '*'}`,
    responseType: 'json',
    unauthenticated: true,
    accessKey,
    groupSendToken,
    zodSchema: ServerKeyResponseSchema,
  });
  return handleKeys(keys);
}

export async function sendMessagesUnauth(
  destination: ServiceIdString,
  messages: ReadonlyArray<MessageType>,
  timestamp: number,
  {
    accessKey,
    groupSendToken,
    online,
    urgent = true,
    story = false,
  }: {
    accessKey: string | null;
    groupSendToken: GroupSendToken | null;
    online?: boolean;
    story?: boolean;
    urgent?: boolean;
  }
): Promise<void> {
  const jsonData = {
    messages,
    timestamp,
    online: Boolean(online),
    urgent,
  };

  await _ajax({
    host: 'chatService',
    call: 'messages',
    httpType: 'PUT',
    urlParameters: `/${destination}?story=${booleanToString(story)}`,
    jsonData,
    responseType: 'json',
    unauthenticated: true,
    accessKey: accessKey ?? undefined,
    groupSendToken: groupSendToken ?? undefined,
    // TODO DESKTOP-8719
    zodSchema: z.unknown(),
  });
}

export async function sendMessages(
  destination: ServiceIdString,
  messages: ReadonlyArray<MessageType>,
  timestamp: number,
  {
    online,
    urgent = true,
    story = false,
  }: { online?: boolean; story?: boolean; urgent?: boolean }
): Promise<void> {
  const jsonData = {
    messages,
    timestamp,
    online: Boolean(online),
    urgent,
  };

  await _ajax({
    host: 'chatService',
    call: 'messages',
    httpType: 'PUT',
    urlParameters: `/${destination}?story=${booleanToString(story)}`,
    jsonData,
    responseType: 'json',
    // TODO DESKTOP-8719
    zodSchema: z.unknown(),
  });
}

function booleanToString(value: boolean | undefined): string {
  return value ? 'true' : 'false';
}

export async function sendWithSenderKey(
  data: Uint8Array,
  accessKeys: Uint8Array | null,
  groupSendToken: GroupSendToken | null,
  timestamp: number,
  {
    online,
    urgent = true,
    story = false,
  }: {
    online?: boolean;
    story?: boolean;
    urgent?: boolean;
  }
): Promise<MultiRecipient200ResponseType> {
  const onlineParam = `&online=${booleanToString(online)}`;
  const urgentParam = `&urgent=${booleanToString(urgent)}`;
  const storyParam = `&story=${booleanToString(story)}`;

  const response = await _ajax({
    host: 'chatService',
    call: 'multiRecipient',
    httpType: 'PUT',
    contentType: 'application/vnd.signal-messenger.mrm',
    data,
    urlParameters: `?ts=${timestamp}${onlineParam}${urgentParam}${storyParam}`,
    responseType: 'json',
    unauthenticated: true,
    accessKey: accessKeys != null ? Bytes.toBase64(accessKeys) : undefined,
    groupSendToken: groupSendToken ?? undefined,
    // TODO DESKTOP-8719
    zodSchema: z.unknown(),
  });
  const parseResult = safeParseUnknown(
    multiRecipient200ResponseSchema,
    response
  );
  if (parseResult.success) {
    return parseResult.data;
  }

  log.error(
    'invalid response from sendWithSenderKey',
    toLogFormat(parseResult.error)
  );
  return response as MultiRecipient200ResponseType;
}

function redactStickerUrl(stickerUrl: string): string {
  return stickerUrl.replace(
    /(\/stickers\/)([^/]+)(\/)/,
    (_, begin: string, packId: string, end: string) =>
      `${begin}${redactPackId(packId)}${end}`
  );
}

export async function getSticker(
  packId: string,
  stickerId: number
): Promise<Uint8Array> {
  if (!isPackIdValid(packId)) {
    throw new Error('getSticker: pack ID was invalid');
  }
  return _outerAjax(
    `${cdnUrlObject['0']}/stickers/${packId}/full/${stickerId}`,
    {
      certificateAuthority,
      proxyUrl,
      responseType: 'bytes',
      type: 'GET',
      redactUrl: redactStickerUrl,
      version,
    }
  );
}

export async function getStickerPackManifest(
  packId: string
): Promise<StickerPackManifestType> {
  if (!isPackIdValid(packId)) {
    throw new Error('getStickerPackManifest: pack ID was invalid');
  }
  return _outerAjax(`${cdnUrlObject['0']}/stickers/${packId}/manifest.proto`, {
    certificateAuthority,
    proxyUrl,
    responseType: 'bytes',
    type: 'GET',
    redactUrl: redactStickerUrl,
    version,
  });
}

type ServerV2AttachmentType = {
  key: string;
  credential: string;
  acl: string;
  algorithm: string;
  date: string;
  policy: string;
  signature: string;
};

function makePutParams(
  {
    key,
    credential,
    acl,
    algorithm,
    date,
    policy,
    signature,
  }: ServerV2AttachmentType,
  encryptedBin: Uint8Array
) {
  // Note: when using the boundary string in the POST body, it needs to be prefixed by
  //   an extra --, and the final boundary string at the end gets a -- prefix and a --
  //   suffix.
  const boundaryString = `----------------${getGuid().replace(/-/g, '')}`;
  const CRLF = '\r\n';
  const getSection = (name: string, value: string) =>
    [
      `--${boundaryString}`,
      `Content-Disposition: form-data; name="${name}"${CRLF}`,
      value,
    ].join(CRLF);

  const start = [
    getSection('key', key),
    getSection('x-amz-credential', credential),
    getSection('acl', acl),
    getSection('x-amz-algorithm', algorithm),
    getSection('x-amz-date', date),
    getSection('policy', policy),
    getSection('x-amz-signature', signature),
    getSection('Content-Type', 'application/octet-stream'),
    `--${boundaryString}`,
    'Content-Disposition: form-data; name="file"',
    `Content-Type: application/octet-stream${CRLF}${CRLF}`,
  ].join(CRLF);
  const end = `${CRLF}--${boundaryString}--${CRLF}`;

  const startBuffer = Bytes.fromString(start);
  const attachmentBuffer = encryptedBin;
  const endBuffer = Bytes.fromString(end);

  const data = Bytes.concatenate([startBuffer, attachmentBuffer, endBuffer]);

  return {
    data,
    contentType: `multipart/form-data; boundary=${boundaryString}`,
    headers: {
      'Content-Length': data.length.toString(),
    },
  };
}

export async function putStickers(
  encryptedManifest: Uint8Array,
  encryptedStickers: ReadonlyArray<Uint8Array>,
  onProgress?: () => void
): Promise<string> {
  // Get manifest and sticker upload parameters
  const { packId, manifest, stickers } = await _ajax({
    host: 'chatService',
    call: 'getStickerPackUpload',
    responseType: 'json',
    httpType: 'GET',
    urlParameters: `/${encryptedStickers.length}`,
    zodSchema: StickerPackUploadFormSchema,
  });

  // Upload manifest
  const manifestParams = makePutParams(manifest, encryptedManifest);
  // This is going to the CDN, not the service, so we use _outerAjax
  await _outerAjax(`${cdnUrlObject['0']}/`, {
    ...manifestParams,
    certificateAuthority,
    proxyUrl,
    timeout: 0,
    type: 'POST',
    version,
    responseType: 'raw',
  });

  // Upload stickers
  const queue = new PQueue({
    concurrency: 3,
    timeout: MINUTE * 30,
    throwOnTimeout: true,
  });
  await Promise.all(
    stickers.map(async (sticker: ServerV2AttachmentType, index: number) => {
      const stickerParams = makePutParams(sticker, encryptedStickers[index]);
      await queue.add(async () =>
        _outerAjax(`${cdnUrlObject['0']}/`, {
          ...stickerParams,
          certificateAuthority,
          proxyUrl,
          timeout: 0,
          type: 'POST',
          version,
          responseType: 'raw',
        })
      );
      if (onProgress) {
        onProgress();
      }
    })
  );

  // Done!
  return packId;
}

// Transit tier is the default place for normal (non-backup) attachments.
// Called "transit" because it is transitory
export async function getAttachment({
  cdnKey,
  cdnNumber,
  options,
}: {
  cdnKey: string;
  cdnNumber?: number;
  options?: {
    disableRetries?: boolean;
    timeout?: number;
    downloadOffset?: number;
    abortSignal?: AbortSignal;
  };
}): Promise<Readable> {
  return _getAttachment({
    cdnPath: `/attachments/${cdnKey}`,
    cdnNumber: cdnNumber ?? 0,
    redactor: _createRedactor(cdnKey),
    options,
  });
}

export async function getAttachmentFromBackupTier({
  mediaId,
  backupDir,
  mediaDir,
  cdnNumber,
  headers,
  options,
}: GetAttachmentFromBackupTierArgsType): Promise<Readable> {
  return _getAttachment({
    cdnPath: urlPathFromComponents(['backups', backupDir, mediaDir, mediaId]),
    cdnNumber,
    headers,
    redactor: _createRedactor(backupDir, mediaDir, mediaId),
    options,
  });
}

function getCheckedCdnUrl(cdnNumber: number, cdnPath: string) {
  const baseUrl = cdnUrlObject[cdnNumber] ?? cdnUrlObject['0'];
  const { origin: expectedOrigin } = new URL(baseUrl);
  const fullCdnUrl = `${baseUrl}${cdnPath}`;
  const { origin } = new URL(fullCdnUrl);

  strictAssert(origin === expectedOrigin, `Unexpected origin: ${origin}`);
  return fullCdnUrl;
}

async function _getAttachmentHeaders({
  cdnPath,
  cdnNumber,
  headers = {},
  redactor,
}: Omit<GetAttachmentArgsType, 'options'>): Promise<fetch.Headers> {
  const fullCdnUrl = getCheckedCdnUrl(cdnNumber, cdnPath);
  const response = await _outerAjax(fullCdnUrl, {
    headers,
    certificateAuthority,
    proxyUrl,
    responseType: 'raw',
    timeout: DEFAULT_TIMEOUT,
    type: 'HEAD',
    redactUrl: redactor,
    version,
  });
  return response.headers;
}

async function _getAttachment({
  cdnPath,
  cdnNumber,
  headers = {},
  redactor,
  options,
}: GetAttachmentArgsType): Promise<Readable> {
  const abortController = new AbortController();

  let streamWithDetails: StreamWithDetailsType | undefined;

  const cancelRequest = (reason: unknown) => {
    abortController.abort(reason);
  };

  options?.abortSignal?.addEventListener('abort', () =>
    cancelRequest(options.abortSignal?.reason)
  );

  registerInflightRequest(cancelRequest);

  let totalBytes = 0;

  // This is going to the CDN, not the service, so we use _outerAjax
  try {
    const targetHeaders = { ...headers };
    if (options?.downloadOffset) {
      targetHeaders.range = `bytes=${options.downloadOffset}-`;
    }
    const fullCdnUrl = getCheckedCdnUrl(cdnNumber, cdnPath);

    streamWithDetails = await _outerAjax(fullCdnUrl, {
      headers: targetHeaders,
      certificateAuthority,
      disableRetries: options?.disableRetries,
      proxyUrl,
      responseType: 'streamwithdetails',
      timeout: options?.timeout ?? DEFAULT_TIMEOUT,
      type: 'GET',
      redactUrl: redactor,
      version,
      abortSignal: abortController.signal,
    });

    if (targetHeaders.range == null) {
      const contentLength =
        streamWithDetails.response.headers.get('content-length');
      strictAssert(
        contentLength != null,
        'Attachment Content-Length is absent'
      );

      const maybeSize = safeParseNumber(contentLength);
      strictAssert(
        maybeSize != null,
        'Attachment Content-Length is not a number'
      );

      totalBytes = maybeSize;
    } else {
      strictAssert(
        streamWithDetails.response.status === 206,
        `Expected 206 status code for offset ${options?.downloadOffset}`
      );
      strictAssert(
        !streamWithDetails.contentType?.includes('multipart'),
        'Expected non-multipart response'
      );

      const range = streamWithDetails.response.headers.get('content-range');
      strictAssert(range != null, 'Attachment Content-Range is absent');

      const match = PARSE_RANGE_HEADER.exec(range);
      strictAssert(match != null, 'Attachment Content-Range is invalid');
      const maybeSize = safeParseNumber(match[1]);
      strictAssert(
        maybeSize != null,
        'Attachment Content-Range[1] is not a number'
      );

      totalBytes = maybeSize;
    }
  } finally {
    if (!streamWithDetails) {
      unregisterInFlightRequest(cancelRequest);
    } else {
      streamWithDetails.stream.on('close', () => {
        unregisterInFlightRequest(cancelRequest);
      });
    }
  }

  const timeoutStream = getTimeoutStream({
    name: `getAttachment(${redactor(cdnPath)})`,
    timeout: GET_ATTACHMENT_CHUNK_TIMEOUT,
    abortController,
  });

  const combinedStream = streamWithDetails.stream
    // We do this manually; pipe() doesn't flow errors through the streams for us
    .on('error', (error: Error) => {
      timeoutStream.emit('error', error);
    })
    .pipe(timeoutStream);

  if (options?.onProgress) {
    const { onProgress } = options;
    let currentBytes = options.downloadOffset ?? 0;

    combinedStream.pause();
    combinedStream.on('data', chunk => {
      currentBytes += chunk.byteLength;
      onProgress(currentBytes, totalBytes);
    });
    onProgress(0, totalBytes);
  }

  return combinedStream;
}

export async function getAttachmentUploadForm(): Promise<AttachmentUploadFormResponseType> {
  return _ajax({
    host: 'chatService',
    call: 'attachmentUploadForm',
    httpType: 'GET',
    responseType: 'json',
    zodSchema: attachmentUploadFormResponse,
  });
}

export async function putEncryptedAttachment(
  encryptedBin: (start: number, end?: number) => Readable,
  encryptedSize: number,
  uploadForm: AttachmentUploadFormResponseType
): Promise<void> {
  const { signedUploadLocation, headers } = uploadForm;

  // This is going to the CDN, not the service, so we use _outerAjax
  const { response: uploadResponse } = await _outerAjax(signedUploadLocation, {
    responseType: 'byteswithdetails',
    certificateAuthority,
    proxyUrl,
    timeout: 0,
    type: 'POST',
    version,
    headers,
    redactUrl: () => {
      const tmp = new URL(signedUploadLocation);
      tmp.search = '';
      tmp.pathname = '';
      return `${tmp}[REDACTED]`;
    },
  });

  const uploadLocation = uploadResponse.headers.get('location');
  strictAssert(uploadLocation, 'attachment upload form header has no location');

  const redactUrl = () => {
    const tmp = new URL(uploadLocation);
    tmp.search = '';
    tmp.pathname = '';
    return `${tmp}[REDACTED]`;
  };

  const MAX_RETRIES = 10;
  for (
    let start = 0, retries = 0;
    start < encryptedSize && retries < MAX_RETRIES;
    retries += 1
  ) {
    const logId = `putEncryptedAttachment(attempt=${retries})`;

    if (retries !== 0) {
      log.warn(`${logId}: resuming from ${start}`);
    }

    try {
      // This is going to the CDN, not the service, so we use _outerAjax
      // eslint-disable-next-line no-await-in-loop
      await _outerAjax(uploadLocation, {
        disableRetries: true,
        certificateAuthority,
        proxyUrl,
        timeout: 0,
        type: 'PUT',
        version,
        headers: {
          'Content-Range': `bytes ${start}-*/${encryptedSize}`,
        },
        data: () => encryptedBin(start),
        redactUrl,
        responseType: 'raw',
      });

      if (retries !== 0) {
        log.warn(`${logId}: Attachment upload succeeded`);
      }
      return;
    } catch (error) {
      log.warn(
        `${logId}: Failed to upload attachment chunk: ${toLogFormat(error)}`
      );
    }

    // eslint-disable-next-line no-await-in-loop
    const result: BytesWithDetailsType = await _outerAjax(uploadLocation, {
      certificateAuthority,
      proxyUrl,
      type: 'PUT',
      version,
      headers: {
        'Content-Range': `bytes */${encryptedSize}`,
      },
      data: new Uint8Array(0),
      redactUrl,
      responseType: 'byteswithdetails',
    });
    const { response } = result;
    strictAssert(response.status === 308, 'Invalid server response');
    const range = response.headers.get('range');
    if (range != null) {
      const match = range.match(/^bytes=0-(\d+)$/);
      strictAssert(match != null, `Invalid range header: ${range}`);
      start = parseInt(match[1], 10);
    } else {
      log.warn(`${logId}: No range header`);
    }
  }

  throw new Error('Upload failed');
}

function getHeaderPadding() {
  const max = randomInt(1, 64);
  let characters = '';

  for (let i = 0; i < max; i += 1) {
    characters += String.fromCharCode(randomInt(65, 122));
  }

  return characters;
}

export async function fetchLinkPreviewMetadata(
  href: string,
  abortSignal: AbortSignal
): Promise<null | linkPreviewFetch.LinkPreviewMetadata> {
  return linkPreviewFetch.fetchLinkPreviewMetadata(
    fetchForLinkPreviews,
    href,
    abortSignal
  );
}

export async function fetchLinkPreviewImage(
  href: string,
  abortSignal: AbortSignal
): Promise<null | linkPreviewFetch.LinkPreviewImage> {
  return linkPreviewFetch.fetchLinkPreviewImage(
    fetchForLinkPreviews,
    href,
    abortSignal
  );
}

export async function fetchJsonViaProxy(
  params: ProxiedRequestParams
): Promise<JSONWithDetailsType> {
  return _outerAjax(params.url, {
    responseType: 'jsonwithdetails',
    // TODO DESKTOP-8719
    zodSchema: z.unknown(),
    proxyUrl: contentProxyUrl,
    type: params.method,
    redirect: 'follow',
    redactUrl: () => '[REDACTED_URL]',
    headers: {
      'X-SignalPadding': getHeaderPadding(),
      ...params.headers,
    },
    version,
    abortSignal: params.signal,
  });
}

export async function fetchBytesViaProxy(
  params: ProxiedRequestParams
): Promise<BytesWithDetailsType> {
  return _outerAjax(params.url, {
    responseType: 'byteswithdetails',
    proxyUrl: contentProxyUrl,
    type: params.method,
    redirect: 'follow',
    redactUrl: () => '[REDACTED_URL]',
    headers: {
      'X-SignalPadding': getHeaderPadding(),
      ...params.headers,
    },
    version,
    abortSignal: params.signal,
  });
}

export async function makeSfuRequest(
  targetUrl: string,
  type: HTTPCodeType,
  headers: HeaderListType,
  body: Uint8Array | undefined
): Promise<BytesWithDetailsType> {
  return _outerAjax(targetUrl, {
    certificateAuthority,
    data: body,
    headers,
    proxyUrl,
    responseType: 'byteswithdetails',
    timeout: 0,
    type,
    version,
  });
}

// Groups

function generateGroupAuth(
  groupPublicParamsHex: string,
  authCredentialPresentationHex: string
) {
  return Bytes.toBase64(
    Bytes.fromString(`${groupPublicParamsHex}:${authCredentialPresentationHex}`)
  );
}

export async function getGroupCredentials({
  startDayInMs,
  endDayInMs,
}: GetGroupCredentialsOptionsType): Promise<GetGroupCredentialsResultType> {
  const startDayInSeconds = startDayInMs / SECOND;
  const endDayInSeconds = endDayInMs / SECOND;

  const response = await _ajax({
    host: 'chatService',
    call: 'getGroupCredentials',
    urlParameters:
      `?redemptionStartSeconds=${startDayInSeconds}&` +
      `redemptionEndSeconds=${endDayInSeconds}&` +
      'zkcCredential=true',
    httpType: 'GET',
    responseType: 'json',
    // TODO DESKTOP-8719
    zodSchema: z.unknown(),
  });

  return response as GetGroupCredentialsResultType;
}

export async function getExternalGroupCredential(
  options: GroupCredentialsType
): Promise<Proto.IExternalGroupCredential> {
  const basicAuth = generateGroupAuth(
    options.groupPublicParamsHex,
    options.authCredentialPresentationHex
  );

  const response = await _ajax({
    basicAuth,
    call: 'groupToken',
    httpType: 'GET',
    contentType: 'application/x-protobuf',
    responseType: 'bytes',
    host: 'storageService',
    disableSessionResumption: true,
  });

  return Proto.ExternalGroupCredential.decode(response);
}

function verifyAttributes(attributes: Proto.IAvatarUploadAttributes) {
  const { key, credential, acl, algorithm, date, policy, signature } =
    attributes;

  if (
    !key ||
    !credential ||
    !acl ||
    !algorithm ||
    !date ||
    !policy ||
    !signature
  ) {
    throw new Error(
      'verifyAttributes: Missing value from AvatarUploadAttributes'
    );
  }

  return {
    key,
    credential,
    acl,
    algorithm,
    date,
    policy,
    signature,
  };
}

export async function uploadAvatar(
  uploadAvatarRequestHeaders: UploadAvatarHeadersType,
  avatarData: Uint8Array
): Promise<string> {
  const verified = verifyAttributes(uploadAvatarRequestHeaders);
  const { key } = verified;

  const manifestParams = makePutParams(verified, avatarData);

  await _outerAjax(`${cdnUrlObject['0']}/`, {
    ...manifestParams,
    certificateAuthority,
    proxyUrl,
    timeout: 0,
    type: 'POST',
    version,
    responseType: 'raw',
  });

  return key;
}

export async function uploadGroupAvatar(
  avatarData: Uint8Array,
  options: GroupCredentialsType
): Promise<string> {
  const basicAuth = generateGroupAuth(
    options.groupPublicParamsHex,
    options.authCredentialPresentationHex
  );

  const response = await _ajax({
    basicAuth,
    call: 'getGroupAvatarUpload',
    httpType: 'GET',
    responseType: 'bytes',
    host: 'storageService',
    disableSessionResumption: true,
  });
  const attributes = Proto.AvatarUploadAttributes.decode(response);

  const verified = verifyAttributes(attributes);
  const { key } = verified;

  const manifestParams = makePutParams(verified, avatarData);

  await _outerAjax(`${cdnUrlObject['0']}/`, {
    ...manifestParams,
    certificateAuthority,
    proxyUrl,
    timeout: 0,
    type: 'POST',
    version,
    responseType: 'raw',
  });

  return key;
}

export async function getGroupAvatar(key: string): Promise<Uint8Array> {
  return _outerAjax(`${cdnUrlObject['0']}/${key}`, {
    certificateAuthority,
    proxyUrl,
    responseType: 'bytes',
    timeout: 0,
    type: 'GET',
    version,
    redactUrl: _createRedactor(key),
  });
}

export function createBoostPaymentIntent(
  options: CreateBoostOptionsType
): Promise<CreateBoostResultType> {
  return _ajax({
    unauthenticated: true,
    host: 'chatService',
    call: 'createBoost',
    httpType: 'POST',
    jsonData: options,
    responseType: 'json',
    zodSchema: CreateBoostResultSchema,
  });
}

export async function createBoostReceiptCredentials(
  options: CreateBoostReceiptCredentialsOptionsType
): Promise<JSONWithDetailsType<CreateBoostReceiptCredentialsResultType>> {
  return _ajax({
    unauthenticated: true,
    host: 'chatService',
    call: 'boostReceiptCredentials',
    httpType: 'POST',
    jsonData: options,
    responseType: 'jsonwithdetails',
    zodSchema: CreateBoostReceiptCredentialsResultSchema,
  });
}

// https://docs.stripe.com/api/payment_intents/confirm?api-version=2025-05-28.basil
export function confirmIntentWithStripe(
  options: ConfirmIntentWithStripeOptionsType
): Promise<ConfirmIntentWithStripeResultType> {
  const {
    clientSecret,
    idempotencyKey,
    paymentIntentId,
    paymentMethodId,
    returnUrl,
  } = options;
  const safePaymentIntentId = encodeURIComponent(paymentIntentId);
  const url = `https://api.stripe.com/v1/payment_intents/${safePaymentIntentId}/confirm`;
  const formData = {
    client_secret: clientSecret,
    payment_method: paymentMethodId,
    return_url: returnUrl,
  };
  const basicAuth = getBasicAuth({
    username: stripePublishableKey,
    password: '',
  });
  const formBytes = Bytes.fromString(qs.encode(formData));

  // This is going to Stripe, so we use _outerAjax
  return _outerAjax(url, {
    data: formBytes,
    headers: {
      Authorization: basicAuth,
      'Content-Type': CONTENT_TYPE_FORM_ENCODING,
      'Content-Length': formBytes.byteLength.toString(),
      'Idempotency-Key': idempotencyKey,
    },
    proxyUrl,
    redactUrl: () => {
      return url.replace(safePaymentIntentId, '[REDACTED]');
    },
    responseType: 'json',
    type: 'POST',
    version,
    zodSchema: ConfirmIntentWithStripeResultSchema,
  });
}

// https://docs.stripe.com/api/payment_methods/create?api-version=2025-05-28.basil&lang=node#create_payment_method-card
export function createPaymentMethodWithStripe(
  options: CreatePaymentMethodWithStripeOptionsType
): Promise<CreatePaymentMethodWithStripeResultType> {
  const { cardDetail } = options;
  const formData = {
    type: 'card',
    'card[cvc]': cardDetail.cvc,
    'card[exp_month]': cardDetail.expirationMonth,
    'card[exp_year]': cardDetail.expirationYear,
    'card[number]': cardDetail.number,
  };
  const basicAuth = getBasicAuth({
    username: stripePublishableKey,
    password: '',
  });
  const formBytes = Bytes.fromString(qs.encode(formData));

  // This is going to Stripe, so we use _outerAjax
  return _outerAjax('https://api.stripe.com/v1/payment_methods', {
    data: formBytes,
    headers: {
      Authorization: basicAuth,
      'Content-Type': CONTENT_TYPE_FORM_ENCODING,
      'Content-Length': formBytes.byteLength.toString(),
    },
    proxyUrl,
    responseType: 'json',
    type: 'POST',
    version,
    zodSchema: CreatePaymentMethodWithStripeResultSchema,
  });
}

export async function createGroup(
  group: Proto.IGroup,
  options: GroupCredentialsType
): Promise<Proto.IGroupResponse> {
  const basicAuth = generateGroupAuth(
    options.groupPublicParamsHex,
    options.authCredentialPresentationHex
  );
  const data = Proto.Group.encode(group).finish();

  const response = await _ajax({
    basicAuth,
    call: 'groups',
    contentType: 'application/x-protobuf',
    data,
    host: 'storageService',
    disableSessionResumption: true,
    httpType: 'PUT',
    responseType: 'bytes',
  });

  return Proto.GroupResponse.decode(response);
}

export async function getGroup(
  options: GroupCredentialsType
): Promise<Proto.IGroupResponse> {
  const basicAuth = generateGroupAuth(
    options.groupPublicParamsHex,
    options.authCredentialPresentationHex
  );

  const response = await _ajax({
    basicAuth,
    call: 'groups',
    contentType: 'application/x-protobuf',
    host: 'storageService',
    disableSessionResumption: true,
    httpType: 'GET',
    responseType: 'bytes',
  });

  return Proto.GroupResponse.decode(response);
}

export async function getGroupFromLink(
  inviteLinkPassword: string | undefined,
  auth: GroupCredentialsType
): Promise<Proto.GroupJoinInfo> {
  const basicAuth = generateGroupAuth(
    auth.groupPublicParamsHex,
    auth.authCredentialPresentationHex
  );
  const safeInviteLinkPassword = inviteLinkPassword
    ? toWebSafeBase64(inviteLinkPassword)
    : undefined;

  const response = await _ajax({
    basicAuth,
    call: 'groupsViaLink',
    contentType: 'application/x-protobuf',
    host: 'storageService',
    disableSessionResumption: true,
    httpType: 'GET',
    responseType: 'bytes',
    urlParameters: safeInviteLinkPassword
      ? `${safeInviteLinkPassword}`
      : undefined,
    redactUrl: _createRedactor(safeInviteLinkPassword),
  });

  return Proto.GroupJoinInfo.decode(response);
}

export async function modifyGroup(
  changes: Proto.GroupChange.IActions,
  options: GroupCredentialsType,
  inviteLinkBase64?: string
): Promise<Proto.IGroupChangeResponse> {
  const basicAuth = generateGroupAuth(
    options.groupPublicParamsHex,
    options.authCredentialPresentationHex
  );
  const data = Proto.GroupChange.Actions.encode(changes).finish();
  const safeInviteLinkPassword = inviteLinkBase64
    ? toWebSafeBase64(inviteLinkBase64)
    : undefined;

  const response = await _ajax({
    basicAuth,
    call: 'groups',
    contentType: 'application/x-protobuf',
    data,
    host: 'storageService',
    disableSessionResumption: true,
    httpType: 'PATCH',
    responseType: 'bytes',
    urlParameters: safeInviteLinkPassword
      ? `?inviteLinkPassword=${safeInviteLinkPassword}`
      : undefined,
    redactUrl: safeInviteLinkPassword
      ? _createRedactor(safeInviteLinkPassword)
      : undefined,
  });

  return Proto.GroupChangeResponse.decode(response);
}

export async function getGroupLog(
  options: GetGroupLogOptionsType,
  credentials: GroupCredentialsType
): Promise<GroupLogResponseType> {
  const basicAuth = generateGroupAuth(
    credentials.groupPublicParamsHex,
    credentials.authCredentialPresentationHex
  );

  const {
    startVersion,
    includeFirstState,
    includeLastState,
    maxSupportedChangeEpoch,
    cachedEndorsementsExpiration,
  } = options;

  // If we don't know starting revision - fetch it from the server
  if (startVersion === undefined) {
    const { data: joinedData } = await _ajax({
      basicAuth,
      call: 'groupJoinedAtVersion',
      contentType: 'application/x-protobuf',
      host: 'storageService',
      disableSessionResumption: true,
      httpType: 'GET',
      responseType: 'byteswithdetails',
    });

    const { joinedAtVersion } = Proto.Member.decode(joinedData);

    return getGroupLog(
      {
        ...options,
        startVersion: joinedAtVersion ?? 0,
      },
      credentials
    );
  }

  const withDetails = await _ajax({
    basicAuth,
    call: 'groupLog',
    contentType: 'application/x-protobuf',
    host: 'storageService',
    disableSessionResumption: true,
    httpType: 'GET',
    responseType: 'byteswithdetails',
    headers: {
      'Cached-Send-Endorsements': String(cachedEndorsementsExpiration ?? 0),
    },
    urlParameters:
      `/${startVersion}?` +
      `includeFirstState=${Boolean(includeFirstState)}&` +
      `includeLastState=${Boolean(includeLastState)}&` +
      `maxSupportedChangeEpoch=${Number(maxSupportedChangeEpoch)}`,
  });
  const { data, response } = withDetails;
  const changes = Proto.GroupChanges.decode(data);
  const { groupSendEndorsementResponse } = changes;

  if (response && response.status === 206) {
    const range = response.headers.get('Content-Range');
    const match = PARSE_GROUP_LOG_RANGE_HEADER.exec(range || '');

    const start = match ? parseInt(match[1], 10) : undefined;
    const end = match ? parseInt(match[2], 10) : undefined;
    const currentRevision = match ? parseInt(match[3], 10) : undefined;

    if (
      match &&
      isNumber(start) &&
      isNumber(end) &&
      isNumber(currentRevision)
    ) {
      return {
        paginated: true,
        changes,
        start,
        end,
        currentRevision,
        groupSendEndorsementResponse,
      };
    }
  }

  return {
    paginated: false,
    changes,
    groupSendEndorsementResponse,
  };
}

export async function getSubscription(
  subscriberId: Uint8Array
): Promise<SubscriptionResponseType> {
  const formattedId = toWebSafeBase64(Bytes.toBase64(subscriberId));
  return _ajax({
    host: 'chatService',
    call: 'subscriptions',
    httpType: 'GET',
    urlParameters: `/${formattedId}`,
    responseType: 'json',
    unauthenticated: true,
    accessKey: undefined,
    groupSendToken: undefined,
    redactUrl: _createRedactor(formattedId),
    zodSchema: subscriptionResponseSchema,
  });
}

export async function getHasSubscription(
  subscriberId: Uint8Array
): Promise<boolean> {
  const data = await getSubscription(subscriberId);
  if (!data.subscription) {
    return false;
  }
  return data.subscription.active;
}

export function getProvisioningResource(
  handler: IRequestHandler,
  timeout?: number
): Promise<IWebSocketResource> {
  return socketManager.getProvisioningResource(handler, timeout);
}

export async function cdsLookup({
  e164s,
  acisAndAccessKeys = [],
  returnAcisWithoutUaks,
}: CdsLookupOptionsType): Promise<CDSResponseType> {
  return cds.request({
    e164s,
    acisAndAccessKeys,
    returnAcisWithoutUaks,
  });
}

// TODO: DESKTOP-8300
const onIncorrectHeadersFromStorageService = throttle(
  () => {
    if (!isProduction(window.getVersion())) {
      window.reduxActions.toast.showToast({
        toastType: ToastType.InvalidStorageServiceHeaders,
      });
    }
  },
  5 * MINUTE,
  { trailing: false }
);
