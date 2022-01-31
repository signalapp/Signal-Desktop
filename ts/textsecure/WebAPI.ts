// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-param-reassign */
/* eslint-disable no-bitwise */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */

import AbortController from 'abort-controller';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import ProxyAgent from 'proxy-agent';
import { Agent } from 'https';
import pProps from 'p-props';
import type { Dictionary } from 'lodash';
import { compact, escapeRegExp, isNumber, mapValues, zipObject } from 'lodash';
import { createVerify } from 'crypto';
import { pki } from 'node-forge';
import is from '@sindresorhus/is';
import PQueue from 'p-queue';
import { v4 as getGuid } from 'uuid';
import { z } from 'zod';
import Long from 'long';
import type { Readable } from 'stream';

import { assert, strictAssert } from '../util/assert';
import { isRecord } from '../util/isRecord';
import * as durations from '../util/durations';
import type { ExplodePromiseResultType } from '../util/explodePromise';
import { explodePromise } from '../util/explodePromise';
import { getUserAgent } from '../util/getUserAgent';
import { getStreamWithTimeout } from '../util/getStreamWithTimeout';
import { formatAcceptLanguageHeader } from '../util/userLanguages';
import { toWebSafeBase64 } from '../util/webSafeBase64';
import type { SocketStatus } from '../types/SocketStatus';
import { toLogFormat } from '../types/errors';
import { isPackIdValid, redactPackId } from '../types/Stickers';
import type { UUID, UUIDStringType } from '../types/UUID';
import { isValidUuid, UUIDKind } from '../types/UUID';
import * as Bytes from '../Bytes';
import {
  constantTimeEqual,
  decryptAesGcm,
  deriveSecrets,
  encryptCdsDiscoveryRequest,
  getRandomValue,
  splitUuids,
} from '../Crypto';
import { calculateAgreement, generateKeyPair } from '../Curve';
import * as linkPreviewFetch from '../linkPreviews/linkPreviewFetch';
import { isBadgeImageFileUrlValid } from '../badges/isBadgeImageFileUrlValid';

import type {
  StorageServiceCallOptionsType,
  StorageServiceCredentials,
} from '../textsecure.d';
import { SocketManager } from './SocketManager';
import type { CDSResponseType } from './CDSSocketManager';
import { CDSSocketManager } from './CDSSocketManager';
import type WebSocketResource from './WebsocketResources';
import { SignalService as Proto } from '../protobuf';

import { HTTPError } from './Errors';
import type MessageSender from './SendMessage';
import type { WebAPICredentials, IRequestHandler } from './Types.d';
import { handleStatusCode, translateError } from './Utils';
import * as log from '../logging/log';
import { maybeParseUrl } from '../util/url';

// Note: this will break some code that expects to be able to use err.response when a
//   web request fails, because it will force it to text. But it is very useful for
//   debugging failed requests.
const DEBUG = false;

type SgxConstantsType = {
  SGX_FLAGS_INITTED: Long;
  SGX_FLAGS_DEBUG: Long;
  SGX_FLAGS_MODE64BIT: Long;
  SGX_FLAGS_PROVISION_KEY: Long;
  SGX_FLAGS_EINITTOKEN_KEY: Long;
  SGX_FLAGS_RESERVED: Long;
  SGX_XFRM_LEGACY: Long;
  SGX_XFRM_AVX: Long;
  SGX_XFRM_RESERVED: Long;
};

let sgxConstantCache: SgxConstantsType | null = null;

function makeLong(value: string): Long {
  return Long.fromString(value);
}
function getSgxConstants() {
  if (sgxConstantCache) {
    return sgxConstantCache;
  }

  sgxConstantCache = {
    SGX_FLAGS_INITTED: makeLong('x0000000000000001L'),
    SGX_FLAGS_DEBUG: makeLong('x0000000000000002L'),
    SGX_FLAGS_MODE64BIT: makeLong('x0000000000000004L'),
    SGX_FLAGS_PROVISION_KEY: makeLong('x0000000000000004L'),
    SGX_FLAGS_EINITTOKEN_KEY: makeLong('x0000000000000004L'),
    SGX_FLAGS_RESERVED: makeLong('xFFFFFFFFFFFFFFC8L'),
    SGX_XFRM_LEGACY: makeLong('x0000000000000003L'),
    SGX_XFRM_AVX: makeLong('x0000000000000006L'),
    SGX_XFRM_RESERVED: makeLong('xFFFFFFFFFFFFFFF8L'),
  };

  return sgxConstantCache;
}

function _createRedactor(
  ...toReplace: ReadonlyArray<string | undefined>
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

const FIVE_MINUTES = 5 * durations.MINUTE;
const GET_ATTACHMENT_CHUNK_TIMEOUT = 10 * durations.SECOND;

type AgentCacheType = {
  [name: string]: {
    timestamp: number;
    agent: ReturnType<typeof ProxyAgent> | Agent;
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
export type HeaderListType = { [name: string]: string | ReadonlyArray<string> };
type HTTPCodeType = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

type RedactUrl = (url: string) => string;

type PromiseAjaxOptionsType = {
  socketManager?: SocketManager;
  basicAuth?: string;
  certificateAuthority?: string;
  contentType?: string;
  data?: Uint8Array | string;
  headers?: HeaderListType;
  host?: string;
  password?: string;
  path?: string;
  proxyUrl?: string;
  redactUrl?: RedactUrl;
  redirect?: 'error' | 'follow' | 'manual';
  responseType?:
    | 'json'
    | 'jsonwithdetails'
    | 'bytes'
    | 'byteswithdetails'
    | 'stream';
  serverUrl?: string;
  stack?: string;
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
    }
  | {
      unauthenticated: true;
      accessKey: undefined | string;
    }
);

type JSONWithDetailsType = {
  data: unknown;
  contentType: string | null;
  response: Response;
};
type BytesWithDetailsType = {
  data: Uint8Array;
  contentType: string | null;
  response: Response;
};

export const multiRecipient200ResponseSchema = z
  .object({
    uuids404: z.array(z.string()).optional(),
    needsSync: z.boolean().optional(),
  })
  .passthrough();
export type MultiRecipient200ResponseType = z.infer<
  typeof multiRecipient200ResponseSchema
>;

export const multiRecipient409ResponseSchema = z.array(
  z
    .object({
      uuid: z.string(),
      devices: z
        .object({
          missingDevices: z.array(z.number()).optional(),
          extraDevices: z.array(z.number()).optional(),
        })
        .passthrough(),
    })
    .passthrough()
);
export type MultiRecipient409ResponseType = z.infer<
  typeof multiRecipient409ResponseSchema
>;

export const multiRecipient410ResponseSchema = z.array(
  z
    .object({
      uuid: z.string(),
      devices: z
        .object({
          staleDevices: z.array(z.number()).optional(),
        })
        .passthrough(),
    })
    .passthrough()
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

async function _promiseAjax(
  providedUrl: string | null,
  options: PromiseAjaxOptionsType
): Promise<unknown> {
  const { proxyUrl, socketManager } = options;

  const url = providedUrl || `${options.host}/${options.path}`;
  const logType = socketManager ? '(WS)' : '(REST)';
  const redactedURL = options.redactUrl ? options.redactUrl(url) : url;

  const unauthLabel = options.unauthenticated ? ' (unauth)' : '';
  log.info(`${options.type} ${logType} ${redactedURL}${unauthLabel}`);

  const timeout = typeof options.timeout === 'number' ? options.timeout : 10000;

  const agentType = options.unauthenticated ? 'unauth' : 'auth';
  const cacheKey = `${proxyUrl}-${agentType}`;

  const { timestamp } = agents[cacheKey] || { timestamp: null };
  if (!timestamp || timestamp + FIVE_MINUTES < Date.now()) {
    if (timestamp) {
      log.info(`Cycling agent for type ${cacheKey}`);
    }
    agents[cacheKey] = {
      agent: proxyUrl
        ? new ProxyAgent(proxyUrl)
        : new Agent({ keepAlive: true }),
      timestamp: Date.now(),
    };
  }
  const { agent } = agents[cacheKey];

  const fetchOptions = {
    method: options.type,
    body: options.data,
    headers: {
      'User-Agent': getUserAgent(options.version),
      'X-Signal-Agent': 'OWD',
      ...options.headers,
    } as FetchHeaderListType,
    redirect: options.redirect,
    agent,
    ca: options.certificateAuthority,
    timeout,
    abortSignal: options.abortSignal,
  };

  if (fetchOptions.body instanceof Uint8Array) {
    // node-fetch doesn't support Uint8Array, only node Buffer
    const contentLength = fetchOptions.body.byteLength;
    fetchOptions.body = Buffer.from(fetchOptions.body);

    // node-fetch doesn't set content-length like S3 requires
    fetchOptions.headers['Content-Length'] = contentLength.toString();
  }

  const { accessKey, basicAuth, unauthenticated } = options;
  if (basicAuth) {
    fetchOptions.headers.Authorization = `Basic ${basicAuth}`;
  } else if (unauthenticated) {
    if (accessKey) {
      // Access key is already a Base64 string
      fetchOptions.headers['Unidentified-Access-Key'] = accessKey;
    }
  } else if (options.user && options.password) {
    const auth = Bytes.toBase64(
      Bytes.fromString(`${options.user}:${options.password}`)
    );
    fetchOptions.headers.Authorization = `Basic ${auth}`;
  }

  if (options.contentType) {
    fetchOptions.headers['Content-Type'] = options.contentType;
  }

  let response: Response;
  let result: string | Uint8Array | Readable | unknown;
  try {
    response = socketManager
      ? await socketManager.fetch(url, fetchOptions)
      : await fetch(url, fetchOptions);

    if (
      options.serverUrl &&
      getHostname(options.serverUrl) === getHostname(url)
    ) {
      await handleStatusCode(response.status);

      if (!unauthenticated && response.status === 401) {
        log.error('Got 401 from Signal Server. We might be unlinked.');
        window.Whisper.events.trigger('mightBeUnlinked');
      }
    }

    if (DEBUG && !isSuccess(response.status)) {
      result = await response.text();
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
    } else if (options.responseType === 'stream') {
      result = response.body;
    } else {
      result = await response.textConverted();
    }
  } catch (e) {
    log.error(options.type, logType, redactedURL, 0, 'Error');
    const stack = `${e.stack}\nInitial stack:\n${options.stack}`;
    throw makeHTTPError('promiseAjax catch', 0, {}, e.toString(), stack);
  }

  if (!isSuccess(response.status)) {
    log.error(options.type, logType, redactedURL, response.status, 'Error');

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
    if (options.validateResponse) {
      if (!_validateResponse(result, options.validateResponse)) {
        log.error(options.type, logType, redactedURL, response.status, 'Error');
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

  log.info(options.type, logType, redactedURL, response.status, 'Success');

  if (options.responseType === 'byteswithdetails') {
    assert(result instanceof Uint8Array, 'Expected Uint8Array result');
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

async function _retryAjax(
  url: string | null,
  options: PromiseAjaxOptionsType,
  providedLimit?: number,
  providedCount?: number
): Promise<unknown> {
  const count = (providedCount || 0) + 1;
  const limit = providedLimit || 3;

  try {
    return await _promiseAjax(url, options);
  } catch (e) {
    if (e instanceof HTTPError && e.code === -1 && count < limit) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(_retryAjax(url, options, limit, count));
        }, 1000);
      });
    }
    throw e;
  }
}

function _outerAjax(
  providedUrl: string | null,
  options: PromiseAjaxOptionsType & { responseType: 'json' }
): Promise<unknown>;
function _outerAjax(
  providedUrl: string | null,
  options: PromiseAjaxOptionsType & { responseType: 'jsonwithdetails' }
): Promise<JSONWithDetailsType>;
function _outerAjax(
  providedUrl: string | null,
  options: PromiseAjaxOptionsType & { responseType?: 'bytes' }
): Promise<Uint8Array>;
function _outerAjax(
  providedUrl: string | null,
  options: PromiseAjaxOptionsType & { responseType: 'byteswithdetails' }
): Promise<BytesWithDetailsType>;
function _outerAjax(
  providedUrl: string | null,
  options: PromiseAjaxOptionsType & { responseType?: 'stream' }
): Promise<Readable>;
function _outerAjax(
  providedUrl: string | null,
  options: PromiseAjaxOptionsType
): Promise<unknown>;

async function _outerAjax(
  url: string | null,
  options: PromiseAjaxOptionsType
): Promise<unknown> {
  options.stack = new Error().stack; // just in case, save stack here.

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
    headers,
    response,
    stack,
  });
}

const URL_CALLS = {
  accounts: 'v1/accounts',
  accountExistence: 'v1/accounts/account',
  attachmentId: 'v2/attachments/form/upload',
  attestation: 'v1/attestation',
  challenge: 'v1/challenge',
  config: 'v1/config',
  deliveryCert: 'v1/certificate/delivery',
  devices: 'v1/devices',
  directoryAuth: 'v1/directory/auth',
  directoryAuthV2: 'v2/directory/auth',
  discovery: 'v1/discovery',
  getGroupAvatarUpload: 'v1/groups/avatar/form',
  getGroupCredentials: 'v1/certificate/group',
  getIceServers: 'v1/accounts/turn',
  getStickerPackUpload: 'v1/sticker/pack/form',
  groupLog: 'v1/groups/logs',
  groupJoinedAtVersion: 'v1/groups/joined_at_version',
  groups: 'v1/groups',
  groupsViaLink: 'v1/groups/join',
  groupToken: 'v1/groups/token',
  keys: 'v2/keys',
  messages: 'v1/messages',
  multiRecipient: 'v1/messages/multi_recipient',
  profile: 'v1/profile',
  registerCapabilities: 'v1/devices/capabilities',
  reportMessage: 'v1/messages/report',
  signed: 'v2/keys/signed',
  storageManifest: 'v1/storage/manifest',
  storageModify: 'v1/storage/',
  storageRead: 'v1/storage/read',
  storageToken: 'v1/storage/auth',
  subscriptions: 'v1/subscription',
  supportUnauthenticatedDelivery: 'v1/devices/unauthenticated_delivery',
  updateDeviceName: 'v1/accounts/name',
  username: 'v1/accounts/username',
  whoami: 'v1/accounts/whoami',
};

const WEBSOCKET_CALLS = new Set<keyof typeof URL_CALLS>([
  // MessageController
  'messages',
  'multiRecipient',
  'reportMessage',

  // ProfileController
  'profile',

  // AttachmentControllerV2
  'attachmentId',

  // RemoteConfigController
  'config',

  // Certificate
  'deliveryCert',
  'getGroupCredentials',

  // Devices
  'devices',
  'registerCapabilities',
  'supportUnauthenticatedDelivery',

  // Directory
  'directoryAuth',
  'directoryAuthV2',

  // Storage
  'storageToken',
]);

type InitializeOptionsType = {
  url: string;
  storageUrl: string;
  updatesUrl: string;
  directoryEnclaveId: string;
  directoryTrustAnchor: string;
  directoryUrl: string;
  directoryV2Url: string;
  directoryV2PublicKey: string;
  directoryV2CodeHash: string;
  cdnUrlObject: {
    readonly '0': string;
    readonly [propName: string]: string;
  };
  certificateAuthority: string;
  contentProxyUrl: string;
  proxyUrl: string;
  version: string;
};

export type MessageType = Readonly<{
  type: number;
  destinationDeviceId: number;
  destinationRegistrationId: number;
  content: string;
}>;

type AjaxOptionsType = {
  basicAuth?: string;
  call: keyof typeof URL_CALLS;
  contentType?: string;
  data?: Uint8Array | Buffer | Uint8Array | string;
  headers?: HeaderListType;
  host?: string;
  httpType: HTTPCodeType;
  jsonData?: unknown;
  password?: string;
  redactUrl?: RedactUrl;
  responseType?: 'json' | 'bytes' | 'byteswithdetails' | 'stream';
  schema?: unknown;
  timeout?: number;
  urlParameters?: string;
  username?: string;
  validateResponse?: any;
  isRegistration?: true;
} & (
  | {
      unauthenticated?: false;
      accessKey?: string;
    }
  | {
      unauthenticated: true;
      accessKey: undefined | string;
    }
);

export type WebAPIConnectOptionsType = WebAPICredentials & {
  useWebSocket?: boolean;
};

export type WebAPIConnectType = {
  connect: (options: WebAPIConnectOptionsType) => WebAPIType;
};

export type CapabilitiesType = {
  announcementGroup: boolean;
  gv2: boolean;
  'gv1-migration': boolean;
  senderKey: boolean;
  changeNumber: boolean;
};
export type CapabilitiesUploadType = {
  announcementGroup: true;
  'gv2-3': true;
  'gv1-migration': true;
  senderKey: true;
  changeNumber: true;
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
export type GroupLogResponseType = {
  currentRevision?: number;
  start?: number;
  end?: number;
  changes: Proto.GroupChanges;
};

export type ProfileRequestDataType = {
  about: string | null;
  aboutEmoji: string | null;
  avatar: boolean;
  commitment: string;
  name: string;
  paymentAddress: string | null;
  version: string;
};

const uploadAvatarHeadersZod = z
  .object({
    acl: z.string(),
    algorithm: z.string(),
    credential: z.string(),
    date: z.string(),
    key: z.string(),
    policy: z.string(),
    signature: z.string(),
  })
  .passthrough();
export type UploadAvatarHeadersType = z.infer<typeof uploadAvatarHeadersZod>;

export type ProfileType = Readonly<{
  identityKey?: string;
  name?: string;
  about?: string;
  aboutEmoji?: string;
  avatar?: string;
  unidentifiedAccess?: string;
  unrestrictedUnidentifiedAccess?: string;
  uuid?: string;
  credential?: string;
  capabilities?: CapabilitiesType;
  paymentAddress?: string;
  badges?: unknown;
}>;

export type GetIceServersResultType = Readonly<{
  username: string;
  password: string;
  urls: ReadonlyArray<string>;
}>;

export type GetDevicesResultType = ReadonlyArray<
  Readonly<{
    id: number;
    name: string;
    lastSeen: number;
    created: number;
  }>
>;

export type GetSenderCertificateResultType = Readonly<{ certificate: string }>;

export type MakeProxiedRequestResultType =
  | Uint8Array
  | {
      result: BytesWithDetailsType;
      totalSize: number;
    };

export type WhoamiResultType = Readonly<{
  uuid?: UUIDStringType;
  pni?: UUIDStringType;
  number?: string;
  username?: string;
}>;

export type ConfirmCodeResultType = Readonly<{
  uuid: UUIDStringType;
  pni: UUIDStringType;
  deviceId?: number;
}>;

export type GetUuidsForE164sV2OptionsType = Readonly<{
  e164s: ReadonlyArray<string>;
  acis: ReadonlyArray<UUIDStringType>;
  accessKeys: ReadonlyArray<string>;
}>;

export type WebAPIType = {
  startRegistration(): unknown;
  finishRegistration(baton: unknown): void;
  confirmCode: (
    number: string,
    code: string,
    newPassword: string,
    registrationId: number,
    deviceName?: string | null,
    options?: { accessKey?: Uint8Array }
  ) => Promise<ConfirmCodeResultType>;
  createGroup: (
    group: Proto.IGroup,
    options: GroupCredentialsType
  ) => Promise<void>;
  deleteUsername: () => Promise<void>;
  getAttachment: (cdnKey: string, cdnNumber?: number) => Promise<Uint8Array>;
  getAvatar: (path: string) => Promise<Uint8Array>;
  getDevices: () => Promise<GetDevicesResultType>;
  getHasSubscription: (subscriberId: Uint8Array) => Promise<boolean>;
  getGroup: (options: GroupCredentialsType) => Promise<Proto.Group>;
  getGroupFromLink: (
    inviteLinkPassword: string,
    auth: GroupCredentialsType
  ) => Promise<Proto.GroupJoinInfo>;
  getGroupAvatar: (key: string) => Promise<Uint8Array>;
  getGroupCredentials: (
    startDay: number,
    endDay: number,
    uuidKind: UUIDKind
  ) => Promise<Array<GroupCredentialType>>;
  getGroupExternalCredential: (
    options: GroupCredentialsType
  ) => Promise<Proto.GroupExternalCredential>;
  getGroupLog: (
    startVersion: number | undefined,
    options: GroupCredentialsType
  ) => Promise<GroupLogResponseType>;
  getIceServers: () => Promise<GetIceServersResultType>;
  getKeysForIdentifier: (
    identifier: string,
    deviceId?: number
  ) => Promise<ServerKeysType>;
  getKeysForIdentifierUnauth: (
    identifier: string,
    deviceId?: number,
    options?: { accessKey?: string }
  ) => Promise<ServerKeysType>;
  getMyKeys: (uuidKind: UUIDKind) => Promise<number>;
  getProfile: (
    identifier: string,
    options: {
      profileKeyVersion: string;
      profileKeyCredentialRequest?: string;
      userLanguages: ReadonlyArray<string>;
      credentialType?: 'pni' | 'profileKey';
    }
  ) => Promise<ProfileType>;
  getProfileForUsername: (username: string) => Promise<ProfileType>;
  getProfileUnauth: (
    identifier: string,
    options: {
      accessKey: string;
      profileKeyVersion: string;
      profileKeyCredentialRequest?: string;
      userLanguages: ReadonlyArray<string>;
    }
  ) => Promise<ProfileType>;
  getBadgeImageFile: (imageUrl: string) => Promise<Uint8Array>;
  getProvisioningResource: (
    handler: IRequestHandler
  ) => Promise<WebSocketResource>;
  getSenderCertificate: (
    withUuid?: boolean
  ) => Promise<GetSenderCertificateResultType>;
  getSticker: (packId: string, stickerId: number) => Promise<Uint8Array>;
  getStickerPackManifest: (packId: string) => Promise<StickerPackManifestType>;
  getStorageCredentials: MessageSender['getStorageCredentials'];
  getStorageManifest: MessageSender['getStorageManifest'];
  getStorageRecords: MessageSender['getStorageRecords'];
  getUuidsForE164s: (
    e164s: ReadonlyArray<string>
  ) => Promise<Dictionary<UUIDStringType | null>>;
  getUuidsForE164sV2: (
    options: GetUuidsForE164sV2OptionsType
  ) => Promise<CDSResponseType>;
  fetchLinkPreviewMetadata: (
    href: string,
    abortSignal: AbortSignal
  ) => Promise<null | linkPreviewFetch.LinkPreviewMetadata>;
  fetchLinkPreviewImage: (
    href: string,
    abortSignal: AbortSignal
  ) => Promise<null | linkPreviewFetch.LinkPreviewImage>;
  makeProxiedRequest: (
    targetUrl: string,
    options?: ProxiedRequestOptionsType
  ) => Promise<MakeProxiedRequestResultType>;
  makeSfuRequest: (
    targetUrl: string,
    type: HTTPCodeType,
    headers: HeaderListType,
    body: Uint8Array | undefined
  ) => Promise<BytesWithDetailsType>;
  modifyGroup: (
    changes: Proto.GroupChange.IActions,
    options: GroupCredentialsType,
    inviteLinkBase64?: string
  ) => Promise<Proto.IGroupChange>;
  modifyStorageRecords: MessageSender['modifyStorageRecords'];
  putAttachment: (encryptedBin: Uint8Array) => Promise<string>;
  putProfile: (
    jsonData: ProfileRequestDataType
  ) => Promise<UploadAvatarHeadersType | undefined>;
  putStickers: (
    encryptedManifest: Uint8Array,
    encryptedStickers: Array<Uint8Array>,
    onProgress?: () => void
  ) => Promise<string>;
  putUsername: (newUsername: string) => Promise<void>;
  registerCapabilities: (capabilities: CapabilitiesUploadType) => Promise<void>;
  registerKeys: (genKeys: KeysType, uuidKind: UUIDKind) => Promise<void>;
  registerSupportForUnauthenticatedDelivery: () => Promise<void>;
  reportMessage: (senderE164: string, serverGuid: string) => Promise<void>;
  requestVerificationSMS: (number: string, token: string) => Promise<void>;
  requestVerificationVoice: (number: string, token: string) => Promise<void>;
  checkAccountExistence: (uuid: UUID) => Promise<boolean>;
  sendMessages: (
    destination: string,
    messageArray: ReadonlyArray<MessageType>,
    timestamp: number,
    online?: boolean
  ) => Promise<void>;
  sendMessagesUnauth: (
    destination: string,
    messageArray: ReadonlyArray<MessageType>,
    timestamp: number,
    online?: boolean,
    options?: { accessKey?: string }
  ) => Promise<void>;
  sendWithSenderKey: (
    payload: Uint8Array,
    accessKeys: Uint8Array,
    timestamp: number,
    online?: boolean
  ) => Promise<MultiRecipient200ResponseType>;
  setSignedPreKey: (
    signedPreKey: SignedPreKeyType,
    uuidKind: UUIDKind
  ) => Promise<void>;
  updateDeviceName: (deviceName: string) => Promise<void>;
  uploadAvatar: (
    uploadAvatarRequestHeaders: UploadAvatarHeadersType,
    avatarData: Uint8Array
  ) => Promise<string>;
  uploadGroupAvatar: (
    avatarData: Uint8Array,
    options: GroupCredentialsType
  ) => Promise<string>;
  whoami: () => Promise<WhoamiResultType>;
  sendChallengeResponse: (challengeResponse: ChallengeType) => Promise<void>;
  getConfig: () => Promise<
    Array<{ name: string; enabled: boolean; value: string | null }>
  >;
  authenticate: (credentials: WebAPICredentials) => Promise<void>;
  logout: () => Promise<void>;
  getSocketStatus: () => SocketStatus;
  registerRequestHandler: (handler: IRequestHandler) => void;
  unregisterRequestHandler: (handler: IRequestHandler) => void;
  checkSockets: () => void;
  onOnline: () => Promise<void>;
  onOffline: () => Promise<void>;
};

export type SignedPreKeyType = {
  keyId: number;
  publicKey: Uint8Array;
  signature: Uint8Array;
};

export type KeysType = {
  identityKey: Uint8Array;
  signedPreKey: SignedPreKeyType;
  preKeys: Array<{
    keyId: number;
    publicKey: Uint8Array;
  }>;
};

export type ServerKeysType = {
  devices: Array<{
    deviceId: number;
    registrationId: number;
    signedPreKey: {
      keyId: number;
      publicKey: Uint8Array;
      signature: Uint8Array;
    };
    preKey?: {
      keyId: number;
      publicKey: Uint8Array;
    };
  }>;
  identityKey: Uint8Array;
};

export type ChallengeType = {
  readonly type: 'recaptcha';
  readonly token: string;
  readonly captcha: string;
};

export type ProxiedRequestOptionsType = {
  returnUint8Array?: boolean;
  start?: number;
  end?: number;
};

// We first set up the data that won't change during this session of the app
export function initialize({
  url,
  storageUrl,
  updatesUrl,
  directoryEnclaveId,
  directoryTrustAnchor,
  directoryUrl,
  directoryV2Url,
  directoryV2PublicKey,
  directoryV2CodeHash,
  cdnUrlObject,
  certificateAuthority,
  contentProxyUrl,
  proxyUrl,
  version,
}: InitializeOptionsType): WebAPIConnectType {
  if (!is.string(url)) {
    throw new Error('WebAPI.initialize: Invalid server url');
  }
  if (!is.string(storageUrl)) {
    throw new Error('WebAPI.initialize: Invalid storageUrl');
  }
  if (!is.string(updatesUrl)) {
    throw new Error('WebAPI.initialize: Invalid updatesUrl');
  }
  if (!is.string(directoryEnclaveId)) {
    throw new Error('WebAPI.initialize: Invalid directory enclave id');
  }
  if (!is.string(directoryTrustAnchor)) {
    throw new Error('WebAPI.initialize: Invalid directory enclave id');
  }
  if (!is.string(directoryUrl)) {
    throw new Error('WebAPI.initialize: Invalid directory url');
  }
  if (!is.string(directoryV2Url)) {
    throw new Error('WebAPI.initialize: Invalid directory V2 url');
  }
  if (!is.string(directoryV2PublicKey)) {
    throw new Error('WebAPI.initialize: Invalid directory V2 public key');
  }
  if (!is.string(directoryV2CodeHash)) {
    throw new Error('WebAPI.initialize: Invalid directory V2 code hash');
  }
  if (!is.object(cdnUrlObject)) {
    throw new Error('WebAPI.initialize: Invalid cdnUrlObject');
  }
  if (!is.string(cdnUrlObject['0'])) {
    throw new Error('WebAPI.initialize: Missing CDN 0 configuration');
  }
  if (!is.string(cdnUrlObject['2'])) {
    throw new Error('WebAPI.initialize: Missing CDN 2 configuration');
  }
  if (!is.string(certificateAuthority)) {
    throw new Error('WebAPI.initialize: Invalid certificateAuthority');
  }
  if (!is.string(contentProxyUrl)) {
    throw new Error('WebAPI.initialize: Invalid contentProxyUrl');
  }
  if (proxyUrl && !is.string(proxyUrl)) {
    throw new Error('WebAPI.initialize: Invalid proxyUrl');
  }
  if (!is.string(version)) {
    throw new Error('WebAPI.initialize: Invalid version');
  }

  // Thanks to function-hoisting, we can put this return statement before all of the
  //   below function definitions.
  return {
    connect,
  };

  // Then we connect to the server with user-specific information. This is the only API
  //   exposed to the browser context, ensuring that it can't connect to arbitrary
  //   locations.
  function connect({
    username: initialUsername,
    password: initialPassword,
    useWebSocket = true,
  }: WebAPIConnectOptionsType) {
    let username = initialUsername;
    let password = initialPassword;
    const PARSE_RANGE_HEADER = /\/(\d+)$/;
    const PARSE_GROUP_LOG_RANGE_HEADER =
      /$versions (\d{1,10})-(\d{1,10})\/(d{1,10})/;

    let activeRegistration: ExplodePromiseResultType<void> | undefined;

    const socketManager = new SocketManager({
      url,
      certificateAuthority,
      version,
      proxyUrl,
    });

    socketManager.on('statusChange', () => {
      window.Whisper.events.trigger('socketStatusChange');
    });

    socketManager.on('authError', () => {
      window.Whisper.events.trigger('unlinkAndDisconnect');
    });

    if (useWebSocket) {
      socketManager.authenticate({ username, password });
    }

    const cdsSocketManager = new CDSSocketManager({
      url: directoryV2Url,
      publicKey: directoryV2PublicKey,
      codeHash: directoryV2CodeHash,
      certificateAuthority,
      version,
      proxyUrl,
    });

    let fetchForLinkPreviews: linkPreviewFetch.FetchFn;
    if (proxyUrl) {
      const agent = new ProxyAgent(proxyUrl);
      fetchForLinkPreviews = (href, init) => fetch(href, { ...init, agent });
    } else {
      fetchForLinkPreviews = fetch;
    }

    // Thanks, function hoisting!
    return {
      getSocketStatus,
      checkSockets,
      onOnline,
      onOffline,
      registerRequestHandler,
      unregisterRequestHandler,
      authenticate,
      logout,
      checkAccountExistence,
      confirmCode,
      createGroup,
      deleteUsername,
      finishRegistration,
      fetchLinkPreviewImage,
      fetchLinkPreviewMetadata,
      getAttachment,
      getAvatar,
      getConfig,
      getDevices,
      getGroup,
      getGroupAvatar,
      getGroupCredentials,
      getGroupExternalCredential,
      getGroupFromLink,
      getGroupLog,
      getHasSubscription,
      getIceServers,
      getKeysForIdentifier,
      getKeysForIdentifierUnauth,
      getMyKeys,
      getProfile,
      getProfileForUsername,
      getProfileUnauth,
      getBadgeImageFile,
      getProvisioningResource,
      getSenderCertificate,
      getSticker,
      getStickerPackManifest,
      getStorageCredentials,
      getStorageManifest,
      getStorageRecords,
      getUuidsForE164s,
      getUuidsForE164sV2,
      makeProxiedRequest,
      makeSfuRequest,
      modifyGroup,
      modifyStorageRecords,
      putAttachment,
      putProfile,
      putStickers,
      putUsername,
      registerCapabilities,
      registerKeys,
      registerSupportForUnauthenticatedDelivery,
      reportMessage,
      requestVerificationSMS,
      requestVerificationVoice,
      sendMessages,
      sendMessagesUnauth,
      sendWithSenderKey,
      setSignedPreKey,
      startRegistration,
      updateDeviceName,
      uploadAvatar,
      uploadGroupAvatar,
      whoami,
      sendChallengeResponse,
    };

    function _ajax(
      param: AjaxOptionsType & { responseType?: 'bytes' }
    ): Promise<Uint8Array>;
    function _ajax(
      param: AjaxOptionsType & { responseType: 'byteswithdetails' }
    ): Promise<BytesWithDetailsType>;
    function _ajax(
      param: AjaxOptionsType & { responseType: 'stream' }
    ): Promise<Readable>;
    function _ajax(
      param: AjaxOptionsType & { responseType: 'json' }
    ): Promise<unknown>;

    async function _ajax(param: AjaxOptionsType): Promise<unknown> {
      if (
        !param.unauthenticated &&
        activeRegistration &&
        !param.isRegistration
      ) {
        log.info('WebAPI: request blocked by active registration');
        const start = Date.now();
        await activeRegistration.promise;
        const duration = Date.now() - start;
        log.info(`WebAPI: request unblocked after ${duration}ms`);
      }

      if (!param.urlParameters) {
        param.urlParameters = '';
      }

      const useWebSocketForEndpoint =
        useWebSocket && WEBSOCKET_CALLS.has(param.call);

      const outerParams = {
        socketManager: useWebSocketForEndpoint ? socketManager : undefined,
        basicAuth: param.basicAuth,
        certificateAuthority,
        contentType: param.contentType || 'application/json; charset=utf-8',
        data:
          param.data ||
          (param.jsonData ? JSON.stringify(param.jsonData) : undefined),
        headers: param.headers,
        host: param.host || url,
        password: param.password ?? password,
        path: URL_CALLS[param.call] + param.urlParameters,
        proxyUrl,
        responseType: param.responseType,
        timeout: param.timeout,
        type: param.httpType,
        user: param.username ?? username,
        redactUrl: param.redactUrl,
        serverUrl: url,
        validateResponse: param.validateResponse,
        version,
        unauthenticated: param.unauthenticated,
        accessKey: param.accessKey,
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

    function uuidKindToQuery(kind: UUIDKind): string {
      let value: string;
      if (kind === UUIDKind.ACI) {
        value = 'aci';
      } else if (kind === UUIDKind.PNI) {
        value = 'pni';
      } else {
        throw new Error(`Unsupported UUIDKind: ${kind}`);
      }
      return `identity=${value}`;
    }

    async function whoami(): Promise<WhoamiResultType> {
      const response = await _ajax({
        call: 'whoami',
        httpType: 'GET',
        responseType: 'json',
      });

      if (!isRecord(response)) {
        return {};
      }

      return {
        uuid: isValidUuid(response.uuid) ? response.uuid : undefined,
        pni: isValidUuid(response.pni) ? response.pni : undefined,
        number:
          typeof response.number === 'string' ? response.number : undefined,
        username:
          typeof response.username === 'string' ? response.username : undefined,
      };
    }

    async function sendChallengeResponse(challengeResponse: ChallengeType) {
      await _ajax({
        call: 'challenge',
        httpType: 'PUT',
        jsonData: challengeResponse,
      });
    }

    async function authenticate({
      username: newUsername,
      password: newPassword,
    }: WebAPICredentials) {
      username = newUsername;
      password = newPassword;

      if (useWebSocket) {
        await socketManager.authenticate({ username, password });
      }
    }

    async function logout() {
      username = '';
      password = '';

      if (useWebSocket) {
        await socketManager.logout();
      }
    }

    function getSocketStatus(): SocketStatus {
      return socketManager.getStatus();
    }

    function checkSockets(): void {
      // Intentionally not awaiting
      socketManager.check();
    }

    async function onOnline(): Promise<void> {
      await socketManager.onOnline();
    }

    async function onOffline(): Promise<void> {
      await socketManager.onOffline();
    }

    function registerRequestHandler(handler: IRequestHandler): void {
      socketManager.registerRequestHandler(handler);
    }

    function unregisterRequestHandler(handler: IRequestHandler): void {
      socketManager.unregisterRequestHandler(handler);
    }

    async function getConfig() {
      type ResType = {
        config: Array<{ name: string; enabled: boolean; value: string | null }>;
      };
      const res = (await _ajax({
        call: 'config',
        httpType: 'GET',
        responseType: 'json',
      })) as ResType;

      return res.config.filter(
        ({ name }: { name: string }) =>
          name.startsWith('desktop.') || name.startsWith('global.')
      );
    }

    async function getSenderCertificate(omitE164?: boolean) {
      return (await _ajax({
        call: 'deliveryCert',
        httpType: 'GET',
        responseType: 'json',
        validateResponse: { certificate: 'string' },
        ...(omitE164 ? { urlParameters: '?includeE164=false' } : {}),
      })) as GetSenderCertificateResultType;
    }

    async function getStorageCredentials(): Promise<StorageServiceCredentials> {
      return (await _ajax({
        call: 'storageToken',
        httpType: 'GET',
        responseType: 'json',
        schema: { username: 'string', password: 'string' },
      })) as StorageServiceCredentials;
    }

    async function getStorageManifest(
      options: StorageServiceCallOptionsType = {}
    ): Promise<Uint8Array> {
      const { credentials, greaterThanVersion } = options;

      const { data, response } = await _ajax({
        call: 'storageManifest',
        contentType: 'application/x-protobuf',
        host: storageUrl,
        httpType: 'GET',
        responseType: 'byteswithdetails',
        urlParameters: greaterThanVersion
          ? `/version/${greaterThanVersion}`
          : '',
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

    async function getStorageRecords(
      data: Uint8Array,
      options: StorageServiceCallOptionsType = {}
    ): Promise<Uint8Array> {
      const { credentials } = options;

      return _ajax({
        call: 'storageRead',
        contentType: 'application/x-protobuf',
        data,
        host: storageUrl,
        httpType: 'PUT',
        responseType: 'bytes',
        ...credentials,
      });
    }

    async function modifyStorageRecords(
      data: Uint8Array,
      options: StorageServiceCallOptionsType = {}
    ): Promise<Uint8Array> {
      const { credentials } = options;

      return _ajax({
        call: 'storageModify',
        contentType: 'application/x-protobuf',
        data,
        host: storageUrl,
        httpType: 'PUT',
        // If we run into a conflict, the current manifest is returned -
        //   it will will be an Uint8Array at the response key on the Error
        responseType: 'bytes',
        ...credentials,
      });
    }

    async function registerSupportForUnauthenticatedDelivery() {
      await _ajax({
        call: 'supportUnauthenticatedDelivery',
        httpType: 'PUT',
        responseType: 'json',
      });
    }

    async function registerCapabilities(capabilities: CapabilitiesUploadType) {
      await _ajax({
        call: 'registerCapabilities',
        httpType: 'PUT',
        jsonData: capabilities,
      });
    }

    function getProfileUrl(
      identifier: string,
      profileKeyVersion: string,
      profileKeyCredentialRequest?: string,
      credentialType: 'pni' | 'profileKey' = 'profileKey'
    ) {
      let profileUrl = `/${identifier}/${profileKeyVersion}`;

      if (profileKeyCredentialRequest) {
        profileUrl += `/${profileKeyCredentialRequest}?credentialType=${credentialType}`;
      }

      return profileUrl;
    }

    async function getProfile(
      identifier: string,
      options: {
        profileKeyVersion: string;
        profileKeyCredentialRequest?: string;
        userLanguages: ReadonlyArray<string>;
        credentialType?: 'pni' | 'profileKey';
      }
    ) {
      const {
        profileKeyVersion,
        profileKeyCredentialRequest,
        userLanguages,
        credentialType = 'profileKey',
      } = options;

      return (await _ajax({
        call: 'profile',
        httpType: 'GET',
        urlParameters: getProfileUrl(
          identifier,
          profileKeyVersion,
          profileKeyCredentialRequest,
          credentialType
        ),
        headers: {
          'Accept-Language': formatAcceptLanguageHeader(userLanguages),
        },
        responseType: 'json',
        redactUrl: _createRedactor(
          identifier,
          profileKeyVersion,
          profileKeyCredentialRequest
        ),
      })) as ProfileType;
    }

    async function getProfileForUsername(usernameToFetch: string) {
      return (await _ajax({
        call: 'profile',
        httpType: 'GET',
        urlParameters: `username/${usernameToFetch}`,
        responseType: 'json',
        redactUrl: _createRedactor(usernameToFetch),
      })) as ProfileType;
    }

    async function putProfile(
      jsonData: ProfileRequestDataType
    ): Promise<UploadAvatarHeadersType | undefined> {
      const res = await _ajax({
        call: 'profile',
        httpType: 'PUT',
        responseType: 'json',
        jsonData,
      });

      if (!res) {
        return;
      }

      return uploadAvatarHeadersZod.parse(res);
    }

    async function getProfileUnauth(
      identifier: string,
      options: {
        accessKey: string;
        profileKeyVersion: string;
        profileKeyCredentialRequest?: string;
        userLanguages: ReadonlyArray<string>;
      }
    ) {
      const {
        accessKey,
        profileKeyVersion,
        profileKeyCredentialRequest,
        userLanguages,
      } = options;

      return (await _ajax({
        call: 'profile',
        httpType: 'GET',
        urlParameters: getProfileUrl(
          identifier,
          profileKeyVersion,
          profileKeyCredentialRequest
        ),
        headers: {
          'Accept-Language': formatAcceptLanguageHeader(userLanguages),
        },
        responseType: 'json',
        unauthenticated: true,
        accessKey,
        redactUrl: _createRedactor(
          identifier,
          profileKeyVersion,
          profileKeyCredentialRequest
        ),
      })) as ProfileType;
    }

    async function getBadgeImageFile(
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

    async function getAvatar(path: string) {
      // Using _outerAJAX, since it's not hardcoded to the Signal Server. Unlike our
      //   attachment CDN, it uses our self-signed certificate, so we pass it in.
      return _outerAjax(`${cdnUrlObject['0']}/${path}`, {
        certificateAuthority,
        contentType: 'application/octet-stream',
        proxyUrl,
        responseType: 'bytes',
        timeout: 0,
        type: 'GET',
        redactUrl: (href: string) => {
          const pattern = RegExp(escapeRegExp(path), 'g');
          return href.replace(pattern, `[REDACTED]${path.slice(-3)}`);
        },
        version,
      });
    }

    async function deleteUsername() {
      await _ajax({
        call: 'username',
        httpType: 'DELETE',
      });
    }
    async function putUsername(newUsername: string) {
      await _ajax({
        call: 'username',
        httpType: 'PUT',
        urlParameters: `/${newUsername}`,
      });
    }

    async function reportMessage(
      senderE164: string,
      serverGuid: string
    ): Promise<void> {
      await _ajax({
        call: 'reportMessage',
        httpType: 'POST',
        urlParameters: `/${senderE164}/${serverGuid}`,
        responseType: 'bytes',
      });
    }

    async function requestVerificationSMS(number: string, token: string) {
      await _ajax({
        call: 'accounts',
        httpType: 'GET',
        urlParameters: `/sms/code/${number}?captcha=${token}`,
      });
    }

    async function requestVerificationVoice(number: string, token: string) {
      await _ajax({
        call: 'accounts',
        httpType: 'GET',
        urlParameters: `/voice/code/${number}?captcha=${token}`,
      });
    }

    async function checkAccountExistence(uuid: UUID) {
      try {
        await _ajax({
          httpType: 'HEAD',
          call: 'accountExistence',
          urlParameters: `/${uuid.toString()}`,
          unauthenticated: true,
          accessKey: undefined,
        });
        return true;
      } catch (error) {
        if (error instanceof HTTPError && error.code === 404) {
          return false;
        }

        throw error;
      }
    }

    function startRegistration() {
      strictAssert(
        activeRegistration === undefined,
        'Registration already in progress'
      );

      activeRegistration = explodePromise<void>();
      log.info('WebAPI: starting registration');

      return activeRegistration;
    }

    function finishRegistration(registration: unknown) {
      strictAssert(activeRegistration !== undefined, 'No active registration');
      strictAssert(
        activeRegistration === registration,
        'Invalid registration baton'
      );

      log.info('WebAPI: finishing registration');
      const current = activeRegistration;
      activeRegistration = undefined;
      current.resolve();
    }

    async function confirmCode(
      number: string,
      code: string,
      newPassword: string,
      registrationId: number,
      deviceName?: string | null,
      options: { accessKey?: Uint8Array } = {}
    ) {
      const capabilities: CapabilitiesUploadType = {
        announcementGroup: true,
        'gv2-3': true,
        'gv1-migration': true,
        senderKey: true,
        changeNumber: true,
      };

      const { accessKey } = options;
      const jsonData = {
        capabilities,
        fetchesMessages: true,
        name: deviceName || undefined,
        registrationId,
        supportsSms: false,
        unidentifiedAccessKey: accessKey
          ? Bytes.toBase64(accessKey)
          : undefined,
        unrestrictedUnidentifiedAccess: false,
      };

      const call = deviceName ? 'devices' : 'accounts';
      const urlPrefix = deviceName ? '/' : '/code/';

      // Reset old websocket credentials and disconnect.
      // AccountManager is our only caller and it will trigger
      // `registration_done` which will update credentials.
      await logout();

      // Update REST credentials, though. We need them for the call below
      username = number;
      password = newPassword;

      const response = (await _ajax({
        isRegistration: true,
        call,
        httpType: 'PUT',
        responseType: 'json',
        urlParameters: urlPrefix + code,
        jsonData,
      })) as ConfirmCodeResultType;

      // Set final REST credentials to let `registerKeys` succeed.
      username = `${response.uuid || number}.${response.deviceId || 1}`;
      password = newPassword;

      return response;
    }

    async function updateDeviceName(deviceName: string) {
      await _ajax({
        call: 'updateDeviceName',
        httpType: 'PUT',
        jsonData: {
          deviceName,
        },
      });
    }

    async function getIceServers() {
      return (await _ajax({
        call: 'getIceServers',
        httpType: 'GET',
        responseType: 'json',
      })) as GetIceServersResultType;
    }

    async function getDevices() {
      return (await _ajax({
        call: 'devices',
        httpType: 'GET',
        responseType: 'json',
      })) as GetDevicesResultType;
    }

    type JSONSignedPreKeyType = {
      keyId: number;
      publicKey: string;
      signature: string;
    };

    type JSONKeysType = {
      identityKey: string;
      signedPreKey: JSONSignedPreKeyType;
      preKeys: Array<{
        keyId: number;
        publicKey: string;
      }>;
    };

    async function registerKeys(genKeys: KeysType, uuidKind: UUIDKind) {
      const preKeys = genKeys.preKeys.map(key => ({
        keyId: key.keyId,
        publicKey: Bytes.toBase64(key.publicKey),
      }));

      const keys: JSONKeysType = {
        identityKey: Bytes.toBase64(genKeys.identityKey),
        signedPreKey: {
          keyId: genKeys.signedPreKey.keyId,
          publicKey: Bytes.toBase64(genKeys.signedPreKey.publicKey),
          signature: Bytes.toBase64(genKeys.signedPreKey.signature),
        },
        preKeys,
      };

      await _ajax({
        isRegistration: true,
        call: 'keys',
        urlParameters: `?${uuidKindToQuery(uuidKind)}`,
        httpType: 'PUT',
        jsonData: keys,
      });
    }

    async function setSignedPreKey(
      signedPreKey: SignedPreKeyType,
      uuidKind: UUIDKind
    ) {
      await _ajax({
        call: 'signed',
        urlParameters: `?${uuidKindToQuery(uuidKind)}`,
        httpType: 'PUT',
        jsonData: {
          keyId: signedPreKey.keyId,
          publicKey: Bytes.toBase64(signedPreKey.publicKey),
          signature: Bytes.toBase64(signedPreKey.signature),
        },
      });
    }

    type ServerKeyCountType = {
      count: number;
    };

    async function getMyKeys(uuidKind: UUIDKind): Promise<number> {
      const result = (await _ajax({
        call: 'keys',
        urlParameters: `?${uuidKindToQuery(uuidKind)}`,
        httpType: 'GET',
        responseType: 'json',
        validateResponse: { count: 'number' },
      })) as ServerKeyCountType;

      return result.count;
    }

    type ServerKeyResponseType = {
      devices: Array<{
        deviceId: number;
        registrationId: number;
        signedPreKey: {
          keyId: number;
          publicKey: string;
          signature: string;
        };
        preKey?: {
          keyId: number;
          publicKey: string;
        };
      }>;
      identityKey: string;
    };

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
          preKey,
          signedPreKey: {
            keyId: device.signedPreKey.keyId,
            publicKey: Bytes.fromBase64(device.signedPreKey.publicKey),
            signature: Bytes.fromBase64(device.signedPreKey.signature),
          },
        };
      });

      return {
        devices,
        identityKey: Bytes.fromBase64(res.identityKey),
      };
    }

    async function getKeysForIdentifier(identifier: string, deviceId?: number) {
      const keys = (await _ajax({
        call: 'keys',
        httpType: 'GET',
        urlParameters: `/${identifier}/${deviceId || '*'}`,
        responseType: 'json',
        validateResponse: { identityKey: 'string', devices: 'object' },
      })) as ServerKeyResponseType;
      return handleKeys(keys);
    }

    async function getKeysForIdentifierUnauth(
      identifier: string,
      deviceId?: number,
      { accessKey }: { accessKey?: string } = {}
    ) {
      const keys = (await _ajax({
        call: 'keys',
        httpType: 'GET',
        urlParameters: `/${identifier}/${deviceId || '*'}`,
        responseType: 'json',
        validateResponse: { identityKey: 'string', devices: 'object' },
        unauthenticated: true,
        accessKey,
      })) as ServerKeyResponseType;
      return handleKeys(keys);
    }

    async function sendMessagesUnauth(
      destination: string,
      messages: ReadonlyArray<MessageType>,
      timestamp: number,
      online?: boolean,
      { accessKey }: { accessKey?: string } = {}
    ) {
      let jsonData;
      if (online) {
        jsonData = { messages, timestamp, online: true };
      } else {
        jsonData = { messages, timestamp };
      }

      await _ajax({
        call: 'messages',
        httpType: 'PUT',
        urlParameters: `/${destination}`,
        jsonData,
        responseType: 'json',
        unauthenticated: true,
        accessKey,
      });
    }

    async function sendMessages(
      destination: string,
      messages: ReadonlyArray<MessageType>,
      timestamp: number,
      online?: boolean
    ) {
      let jsonData;
      if (online) {
        jsonData = { messages, timestamp, online: true };
      } else {
        jsonData = { messages, timestamp };
      }

      await _ajax({
        call: 'messages',
        httpType: 'PUT',
        urlParameters: `/${destination}`,
        jsonData,
        responseType: 'json',
      });
    }

    async function sendWithSenderKey(
      data: Uint8Array,
      accessKeys: Uint8Array,
      timestamp: number,
      online?: boolean
    ): Promise<MultiRecipient200ResponseType> {
      const response = await _ajax({
        call: 'multiRecipient',
        httpType: 'PUT',
        contentType: 'application/vnd.signal-messenger.mrm',
        data,
        urlParameters: `?ts=${timestamp}&online=${online ? 'true' : 'false'}`,
        responseType: 'json',
        unauthenticated: true,
        accessKey: Bytes.toBase64(accessKeys),
      });
      const parseResult = multiRecipient200ResponseSchema.safeParse(response);
      if (parseResult.success) {
        return parseResult.data;
      }

      log.warn(
        'WebAPI: invalid response from sendWithSenderKey',
        toLogFormat(parseResult.error)
      );
      return response as MultiRecipient200ResponseType;
    }

    function redactStickerUrl(stickerUrl: string) {
      return stickerUrl.replace(
        /(\/stickers\/)([^/]+)(\/)/,
        (_, begin: string, packId: string, end: string) =>
          `${begin}${redactPackId(packId)}${end}`
      );
    }

    async function getSticker(packId: string, stickerId: number) {
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

    async function getStickerPackManifest(packId: string) {
      if (!isPackIdValid(packId)) {
        throw new Error('getStickerPackManifest: pack ID was invalid');
      }
      return _outerAjax(
        `${cdnUrlObject['0']}/stickers/${packId}/manifest.proto`,
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

    type ServerAttachmentType = {
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
      }: ServerAttachmentType,
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

      const startBuffer = Buffer.from(start, 'utf8');
      const attachmentBuffer = Buffer.from(encryptedBin);
      const endBuffer = Buffer.from(end, 'utf8');

      const contentLength =
        startBuffer.length + attachmentBuffer.length + endBuffer.length;
      const data = Buffer.concat(
        [startBuffer, attachmentBuffer, endBuffer],
        contentLength
      );

      return {
        data,
        contentType: `multipart/form-data; boundary=${boundaryString}`,
        headers: {
          'Content-Length': contentLength.toString(),
        },
      };
    }

    async function putStickers(
      encryptedManifest: Uint8Array,
      encryptedStickers: Array<Uint8Array>,
      onProgress?: () => void
    ) {
      // Get manifest and sticker upload parameters
      const { packId, manifest, stickers } = (await _ajax({
        call: 'getStickerPackUpload',
        responseType: 'json',
        httpType: 'GET',
        urlParameters: `/${encryptedStickers.length}`,
      })) as {
        packId: string;
        manifest: ServerAttachmentType;
        stickers: ReadonlyArray<ServerAttachmentType>;
      };

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
      });

      // Upload stickers
      const queue = new PQueue({
        concurrency: 3,
        timeout: 1000 * 60 * 2,
        throwOnTimeout: true,
      });
      await Promise.all(
        stickers.map(async (sticker: ServerAttachmentType, index: number) => {
          const stickerParams = makePutParams(
            sticker,
            encryptedStickers[index]
          );
          await queue.add(async () =>
            _outerAjax(`${cdnUrlObject['0']}/`, {
              ...stickerParams,
              certificateAuthority,
              proxyUrl,
              timeout: 0,
              type: 'POST',
              version,
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

    async function getAttachment(cdnKey: string, cdnNumber?: number) {
      const abortController = new AbortController();

      const cdnUrl = isNumber(cdnNumber)
        ? cdnUrlObject[cdnNumber] || cdnUrlObject['0']
        : cdnUrlObject['0'];
      // This is going to the CDN, not the service, so we use _outerAjax
      const stream = await _outerAjax(`${cdnUrl}/attachments/${cdnKey}`, {
        certificateAuthority,
        proxyUrl,
        responseType: 'stream',
        timeout: 0,
        type: 'GET',
        redactUrl: _createRedactor(cdnKey),
        version,
        abortSignal: abortController.signal,
      });

      return getStreamWithTimeout(stream, {
        name: `getAttachment(${cdnKey})`,
        timeout: GET_ATTACHMENT_CHUNK_TIMEOUT,
        abortController,
      });
    }

    type PutAttachmentResponseType = ServerAttachmentType & {
      attachmentIdString: string;
    };

    async function putAttachment(encryptedBin: Uint8Array) {
      const response = (await _ajax({
        call: 'attachmentId',
        httpType: 'GET',
        responseType: 'json',
      })) as PutAttachmentResponseType;

      const { attachmentIdString } = response;

      const params = makePutParams(response, encryptedBin);

      // This is going to the CDN, not the service, so we use _outerAjax
      await _outerAjax(`${cdnUrlObject['0']}/attachments/`, {
        ...params,
        certificateAuthority,
        proxyUrl,
        timeout: 0,
        type: 'POST',
        version,
      });

      return attachmentIdString;
    }

    function getHeaderPadding() {
      const max = getRandomValue(1, 64);
      let characters = '';

      for (let i = 0; i < max; i += 1) {
        characters += String.fromCharCode(getRandomValue(65, 122));
      }

      return characters;
    }

    async function fetchLinkPreviewMetadata(
      href: string,
      abortSignal: AbortSignal
    ) {
      return linkPreviewFetch.fetchLinkPreviewMetadata(
        fetchForLinkPreviews,
        href,
        abortSignal
      );
    }

    async function fetchLinkPreviewImage(
      href: string,
      abortSignal: AbortSignal
    ) {
      return linkPreviewFetch.fetchLinkPreviewImage(
        fetchForLinkPreviews,
        href,
        abortSignal
      );
    }

    async function makeProxiedRequest(
      targetUrl: string,
      options: ProxiedRequestOptionsType = {}
    ): Promise<MakeProxiedRequestResultType> {
      const { returnUint8Array, start, end } = options;
      const headers: HeaderListType = {
        'X-SignalPadding': getHeaderPadding(),
      };

      if (is.number(start) && is.number(end)) {
        headers.Range = `bytes=${start}-${end}`;
      }

      const result = await _outerAjax(targetUrl, {
        responseType: returnUint8Array ? 'byteswithdetails' : undefined,
        proxyUrl: contentProxyUrl,
        type: 'GET',
        redirect: 'follow',
        redactUrl: () => '[REDACTED_URL]',
        headers,
        version,
      });

      if (!returnUint8Array) {
        return result as Uint8Array;
      }

      const { response } = result as BytesWithDetailsType;
      if (!response.headers || !response.headers.get) {
        throw new Error('makeProxiedRequest: Problem retrieving header value');
      }

      const range = response.headers.get('content-range');
      const match = PARSE_RANGE_HEADER.exec(range || '');

      if (!match || !match[1]) {
        throw new Error(
          `makeProxiedRequest: Unable to parse total size from ${range}`
        );
      }

      const totalSize = parseInt(match[1], 10);

      return {
        totalSize,
        result: result as BytesWithDetailsType,
      };
    }

    async function makeSfuRequest(
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
        Bytes.fromString(
          `${groupPublicParamsHex}:${authCredentialPresentationHex}`
        )
      );
    }

    type CredentialResponseType = {
      credentials: Array<GroupCredentialType>;
    };

    async function getGroupCredentials(
      startDay: number,
      endDay: number,
      uuidKind: UUIDKind
    ): Promise<Array<GroupCredentialType>> {
      const response = (await _ajax({
        call: 'getGroupCredentials',
        urlParameters: `/${startDay}/${endDay}?${uuidKindToQuery(uuidKind)}`,
        httpType: 'GET',
        responseType: 'json',
      })) as CredentialResponseType;

      return response.credentials;
    }

    async function getGroupExternalCredential(
      options: GroupCredentialsType
    ): Promise<Proto.GroupExternalCredential> {
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
        host: storageUrl,
      });

      return Proto.GroupExternalCredential.decode(response);
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

    async function uploadAvatar(
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
      });

      return key;
    }

    async function uploadGroupAvatar(
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
        host: storageUrl,
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
      });

      return key;
    }

    async function getGroupAvatar(key: string): Promise<Uint8Array> {
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

    async function createGroup(
      group: Proto.IGroup,
      options: GroupCredentialsType
    ): Promise<void> {
      const basicAuth = generateGroupAuth(
        options.groupPublicParamsHex,
        options.authCredentialPresentationHex
      );
      const data = Proto.Group.encode(group).finish();

      await _ajax({
        basicAuth,
        call: 'groups',
        contentType: 'application/x-protobuf',
        data,
        host: storageUrl,
        httpType: 'PUT',
      });
    }

    async function getGroup(
      options: GroupCredentialsType
    ): Promise<Proto.Group> {
      const basicAuth = generateGroupAuth(
        options.groupPublicParamsHex,
        options.authCredentialPresentationHex
      );

      const response = await _ajax({
        basicAuth,
        call: 'groups',
        contentType: 'application/x-protobuf',
        host: storageUrl,
        httpType: 'GET',
        responseType: 'bytes',
      });

      return Proto.Group.decode(response);
    }

    async function getGroupFromLink(
      inviteLinkPassword: string,
      auth: GroupCredentialsType
    ): Promise<Proto.GroupJoinInfo> {
      const basicAuth = generateGroupAuth(
        auth.groupPublicParamsHex,
        auth.authCredentialPresentationHex
      );
      const safeInviteLinkPassword = toWebSafeBase64(inviteLinkPassword);

      const response = await _ajax({
        basicAuth,
        call: 'groupsViaLink',
        contentType: 'application/x-protobuf',
        host: storageUrl,
        httpType: 'GET',
        responseType: 'bytes',
        urlParameters: `/${safeInviteLinkPassword}`,
        redactUrl: _createRedactor(safeInviteLinkPassword),
      });

      return Proto.GroupJoinInfo.decode(response);
    }

    async function modifyGroup(
      changes: Proto.GroupChange.IActions,
      options: GroupCredentialsType,
      inviteLinkBase64?: string
    ): Promise<Proto.IGroupChange> {
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
        host: storageUrl,
        httpType: 'PATCH',
        responseType: 'bytes',
        urlParameters: safeInviteLinkPassword
          ? `?inviteLinkPassword=${safeInviteLinkPassword}`
          : undefined,
        redactUrl: safeInviteLinkPassword
          ? _createRedactor(safeInviteLinkPassword)
          : undefined,
      });

      return Proto.GroupChange.decode(response);
    }

    async function getGroupLog(
      startVersion: number | undefined,
      options: GroupCredentialsType
    ): Promise<GroupLogResponseType> {
      const basicAuth = generateGroupAuth(
        options.groupPublicParamsHex,
        options.authCredentialPresentationHex
      );

      // If we don't know starting revision - fetch it from the server
      if (startVersion === undefined) {
        const { data: joinedData } = await _ajax({
          basicAuth,
          call: 'groupJoinedAtVersion',
          contentType: 'application/x-protobuf',
          host: storageUrl,
          httpType: 'GET',
          responseType: 'byteswithdetails',
        });

        const { joinedAtVersion } = Proto.Member.decode(joinedData);

        return getGroupLog(joinedAtVersion, options);
      }

      const withDetails = await _ajax({
        basicAuth,
        call: 'groupLog',
        contentType: 'application/x-protobuf',
        host: storageUrl,
        httpType: 'GET',
        responseType: 'byteswithdetails',
        urlParameters: `/${startVersion}`,
      });
      const { data, response } = withDetails;
      const changes = Proto.GroupChanges.decode(data);

      if (response && response.status === 206) {
        const range = response.headers.get('Content-Range');
        const match = PARSE_GROUP_LOG_RANGE_HEADER.exec(range || '');

        const start = match ? parseInt(match[0], 10) : undefined;
        const end = match ? parseInt(match[1], 10) : undefined;
        const currentRevision = match ? parseInt(match[2], 10) : undefined;

        if (
          match &&
          is.number(start) &&
          is.number(end) &&
          is.number(currentRevision)
        ) {
          return {
            changes,
            start,
            end,
            currentRevision,
          };
        }
      }

      return {
        changes,
      };
    }

    async function getHasSubscription(
      subscriberId: Uint8Array
    ): Promise<boolean> {
      const formattedId = toWebSafeBase64(Bytes.toBase64(subscriberId));
      const data = await _ajax({
        call: 'subscriptions',
        httpType: 'GET',
        urlParameters: `/${formattedId}`,
        responseType: 'json',
        unauthenticated: true,
        accessKey: undefined,
        redactUrl: _createRedactor(formattedId),
      });

      return (
        isRecord(data) &&
        isRecord(data.subscription) &&
        Boolean(data.subscription.active)
      );
    }

    function getProvisioningResource(
      handler: IRequestHandler
    ): Promise<WebSocketResource> {
      return socketManager.getProvisioningResource(handler);
    }

    async function getDirectoryAuth(): Promise<{
      username: string;
      password: string;
    }> {
      return (await _ajax({
        call: 'directoryAuth',
        httpType: 'GET',
        responseType: 'json',
      })) as { username: string; password: string };
    }

    async function getDirectoryAuthV2(): Promise<{
      username: string;
      password: string;
    }> {
      return (await _ajax({
        call: 'directoryAuthV2',
        httpType: 'GET',
        responseType: 'json',
      })) as { username: string; password: string };
    }

    function validateAttestationQuote({
      serverStaticPublic,
      quote: quoteBytes,
    }: {
      serverStaticPublic: Uint8Array;
      quote: Uint8Array;
    }) {
      const SGX_CONSTANTS = getSgxConstants();
      const quote = Buffer.from(quoteBytes);

      const quoteVersion = quote.readInt16LE(0) & 0xffff;
      if (quoteVersion < 0 || quoteVersion > 2) {
        throw new Error(`Unknown version ${quoteVersion}`);
      }

      const miscSelect = quote.slice(64, 64 + 4);
      if (!miscSelect.every(byte => byte === 0)) {
        throw new Error('Quote miscSelect invalid!');
      }

      const reserved1 = quote.slice(68, 68 + 28);
      if (!reserved1.every(byte => byte === 0)) {
        throw new Error('Quote reserved1 invalid!');
      }

      const flags = Long.fromBytesLE(
        Array.from(quote.slice(96, 96 + 8).values())
      );
      if (
        flags.and(SGX_CONSTANTS.SGX_FLAGS_RESERVED).notEquals(0) ||
        flags.and(SGX_CONSTANTS.SGX_FLAGS_INITTED).equals(0) ||
        flags.and(SGX_CONSTANTS.SGX_FLAGS_MODE64BIT).equals(0)
      ) {
        throw new Error(`Quote flags invalid ${flags.toString()}`);
      }

      const xfrm = Long.fromBytesLE(
        Array.from(quote.slice(104, 104 + 8).values())
      );
      if (xfrm.and(SGX_CONSTANTS.SGX_XFRM_RESERVED).notEquals(0)) {
        throw new Error(`Quote xfrm invalid ${xfrm}`);
      }

      const mrenclave = quote.slice(112, 112 + 32);
      const enclaveIdBytes = Bytes.fromHex(directoryEnclaveId);
      if (mrenclave.compare(enclaveIdBytes) !== 0) {
        throw new Error('Quote mrenclave invalid!');
      }

      const reserved2 = quote.slice(144, 144 + 32);
      if (!reserved2.every(byte => byte === 0)) {
        throw new Error('Quote reserved2 invalid!');
      }

      const reportData = quote.slice(368, 368 + 64);
      const serverStaticPublicBytes = serverStaticPublic;
      if (
        !reportData.every((byte, index) => {
          if (index >= 32) {
            return byte === 0;
          }
          return byte === serverStaticPublicBytes[index];
        })
      ) {
        throw new Error('Quote report_data invalid!');
      }

      const reserved3 = quote.slice(208, 208 + 96);
      if (!reserved3.every(byte => byte === 0)) {
        throw new Error('Quote reserved3 invalid!');
      }

      const reserved4 = quote.slice(308, 308 + 60);
      if (!reserved4.every(byte => byte === 0)) {
        throw new Error('Quote reserved4 invalid!');
      }

      const signatureLength = quote.readInt32LE(432) >>> 0;
      if (signatureLength !== quote.byteLength - 436) {
        throw new Error(`Bad signatureLength ${signatureLength}`);
      }

      // const signature = quote.slice(436, 436 + signatureLength);
    }

    function validateAttestationSignatureBody(
      signatureBody: {
        timestamp: string;
        version: number;
        isvEnclaveQuoteBody: string;
        isvEnclaveQuoteStatus: string;
      },
      encodedQuote: string
    ) {
      // Parse timestamp as UTC
      const { timestamp } = signatureBody;
      const utcTimestamp = timestamp.endsWith('Z')
        ? timestamp
        : `${timestamp}Z`;
      const signatureTime = new Date(utcTimestamp).getTime();

      const now = Date.now();
      if (signatureBody.version !== 3) {
        throw new Error('Attestation signature invalid version!');
      }
      if (!encodedQuote.startsWith(signatureBody.isvEnclaveQuoteBody)) {
        throw new Error('Attestion signature mismatches quote!');
      }
      if (signatureBody.isvEnclaveQuoteStatus !== 'OK') {
        throw new Error('Attestation signature status not "OK"!');
      }
      if (signatureTime < now - 24 * 60 * 60 * 1000) {
        throw new Error('Attestation signature timestamp older than 24 hours!');
      }
    }

    async function validateAttestationSignature(
      signature: Uint8Array,
      signatureBody: string,
      certificates: string
    ) {
      const CERT_PREFIX = '-----BEGIN CERTIFICATE-----';
      const pem = compact(
        certificates.split(CERT_PREFIX).map(match => {
          if (!match) {
            return null;
          }

          return `${CERT_PREFIX}${match}`;
        })
      );
      if (pem.length < 2) {
        throw new Error(
          `validateAttestationSignature: Expect two or more entries; got ${pem.length}`
        );
      }

      const verify = createVerify('RSA-SHA256');
      verify.update(Buffer.from(Bytes.fromString(signatureBody)));
      const isValid = verify.verify(pem[0], Buffer.from(signature));
      if (!isValid) {
        throw new Error('Validation of signature across signatureBody failed!');
      }

      const caStore = pki.createCaStore([directoryTrustAnchor]);
      const chain = compact(pem.map(cert => pki.certificateFromPem(cert)));
      const isChainValid = pki.verifyCertificateChain(caStore, chain);
      if (!isChainValid) {
        throw new Error('Validation of certificate chain failed!');
      }

      const leafCert = chain[0];
      const fieldCN = leafCert.subject.getField('CN');
      if (
        !fieldCN ||
        fieldCN.value !== 'Intel SGX Attestation Report Signing'
      ) {
        throw new Error('Leaf cert CN field had unexpected value');
      }
      const fieldO = leafCert.subject.getField('O');
      if (!fieldO || fieldO.value !== 'Intel Corporation') {
        throw new Error('Leaf cert O field had unexpected value');
      }
      const fieldL = leafCert.subject.getField('L');
      if (!fieldL || fieldL.value !== 'Santa Clara') {
        throw new Error('Leaf cert L field had unexpected value');
      }
      const fieldST = leafCert.subject.getField('ST');
      if (!fieldST || fieldST.value !== 'CA') {
        throw new Error('Leaf cert ST field had unexpected value');
      }
      const fieldC = leafCert.subject.getField('C');
      if (!fieldC || fieldC.value !== 'US') {
        throw new Error('Leaf cert C field had unexpected value');
      }
    }

    async function putRemoteAttestation(auth: {
      username: string;
      password: string;
    }) {
      const keyPair = generateKeyPair();
      const { privKey, pubKey } = keyPair;
      // Remove first "key type" byte from public key
      const slicedPubKey = pubKey.slice(1);
      const pubKeyBase64 = Bytes.toBase64(slicedPubKey);
      // Do request
      const data = JSON.stringify({ clientPublic: pubKeyBase64 });
      const result: JSONWithDetailsType = (await _outerAjax(null, {
        certificateAuthority,
        type: 'PUT',
        contentType: 'application/json; charset=utf-8',
        host: directoryUrl,
        path: `${URL_CALLS.attestation}/${directoryEnclaveId}`,
        user: auth.username,
        password: auth.password,
        responseType: 'jsonwithdetails',
        data,
        timeout: 30000,
        version,
      })) as JSONWithDetailsType;

      const { data: responseBody, response } = result as {
        data: {
          attestations: Record<
            string,
            {
              ciphertext: string;
              iv: string;
              quote: string;
              serverEphemeralPublic: string;
              serverStaticPublic: string;
              signature: string;
              signatureBody: string;
              tag: string;
              certificates: string;
            }
          >;
        };
        response: Response;
      };

      const attestationsLength = Object.keys(responseBody.attestations).length;
      if (attestationsLength > 3) {
        throw new Error(
          'Got more than three attestations from the Contact Discovery Service'
        );
      }
      if (attestationsLength < 1) {
        throw new Error(
          'Got no attestations from the Contact Discovery Service'
        );
      }

      const cookie = response.headers.get('set-cookie');

      // Decode response
      return {
        cookie,
        attestations: await pProps(
          responseBody.attestations,
          async attestation => {
            const decoded = {
              ...attestation,
              ciphertext: Bytes.fromBase64(attestation.ciphertext),
              iv: Bytes.fromBase64(attestation.iv),
              quote: Bytes.fromBase64(attestation.quote),
              serverEphemeralPublic: Bytes.fromBase64(
                attestation.serverEphemeralPublic
              ),
              serverStaticPublic: Bytes.fromBase64(
                attestation.serverStaticPublic
              ),
              signature: Bytes.fromBase64(attestation.signature),
              tag: Bytes.fromBase64(attestation.tag),
            };

            // Validate response
            validateAttestationQuote(decoded);
            validateAttestationSignatureBody(
              JSON.parse(decoded.signatureBody),
              attestation.quote
            );
            await validateAttestationSignature(
              decoded.signature,
              decoded.signatureBody,
              decoded.certificates
            );

            // Derive key
            const ephemeralToEphemeral = calculateAgreement(
              decoded.serverEphemeralPublic,
              privKey
            );
            const ephemeralToStatic = calculateAgreement(
              decoded.serverStaticPublic,
              privKey
            );
            const masterSecret = Bytes.concatenate([
              ephemeralToEphemeral,
              ephemeralToStatic,
            ]);
            const publicKeys = Bytes.concatenate([
              slicedPubKey,
              decoded.serverEphemeralPublic,
              decoded.serverStaticPublic,
            ]);
            const [clientKey, serverKey] = deriveSecrets(
              masterSecret,
              publicKeys,
              new Uint8Array(0)
            );

            // Decrypt ciphertext into requestId
            const requestId = decryptAesGcm(
              serverKey,
              decoded.iv,
              Bytes.concatenate([decoded.ciphertext, decoded.tag])
            );

            return {
              clientKey,
              serverKey,
              requestId,
            };
          }
        ),
      };
    }

    async function getUuidsForE164s(
      e164s: ReadonlyArray<string>
    ): Promise<Dictionary<UUIDStringType | null>> {
      const directoryAuth = await getDirectoryAuth();
      const attestationResult = await putRemoteAttestation(directoryAuth);

      // Encrypt data for discovery
      const data = await encryptCdsDiscoveryRequest(
        attestationResult.attestations,
        e164s
      );
      const { cookie } = attestationResult;

      // Send discovery request
      const discoveryResponse = (await _outerAjax(null, {
        certificateAuthority,
        type: 'PUT',
        headers: cookie
          ? {
              cookie,
            }
          : undefined,
        contentType: 'application/json; charset=utf-8',
        host: directoryUrl,
        path: `${URL_CALLS.discovery}/${directoryEnclaveId}`,
        user: directoryAuth.username,
        password: directoryAuth.password,
        responseType: 'json',
        timeout: 30000,
        data: JSON.stringify(data),
        version,
      })) as {
        requestId: string;
        iv: string;
        data: string;
        mac: string;
      };

      // Decode discovery request response
      const decodedDiscoveryResponse = mapValues(discoveryResponse, value => {
        return Bytes.fromBase64(value);
      }) as unknown as {
        [K in keyof typeof discoveryResponse]: Uint8Array;
      };

      const returnedAttestation = Object.values(
        attestationResult.attestations
      ).find(at =>
        constantTimeEqual(at.requestId, decodedDiscoveryResponse.requestId)
      );
      if (!returnedAttestation) {
        throw new Error('No known attestations returned from CDS');
      }

      // Decrypt discovery response
      const decryptedDiscoveryData = decryptAesGcm(
        returnedAttestation.serverKey,
        decodedDiscoveryResponse.iv,
        Bytes.concatenate([
          decodedDiscoveryResponse.data,
          decodedDiscoveryResponse.mac,
        ])
      );

      // Process and return result
      const uuids = splitUuids(decryptedDiscoveryData);

      if (uuids.length !== e164s.length) {
        throw new Error(
          'Returned set of UUIDs did not match returned set of e164s!'
        );
      }

      return zipObject(e164s, uuids);
    }

    async function getUuidsForE164sV2({
      e164s,
      acis,
      accessKeys,
    }: GetUuidsForE164sV2OptionsType): Promise<CDSResponseType> {
      const auth = await getDirectoryAuthV2();

      return cdsSocketManager.request({
        auth,
        e164s,
        acis,
        accessKeys,
      });
    }
  }
}
