// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  Aci,
  Pni,
  PublicKey,
  SenderCertificate,
  usernames,
} from '@signalapp/libsignal-client';
import {
  AuthCredentialPresentation,
  BackupAuthCredentialPresentation,
  BackupAuthCredentialRequest,
  BackupCredentialType,
  BackupLevel,
  CallLinkAuthCredentialResponse,
  CreateCallLinkCredentialRequest,
  CreateCallLinkCredentialResponse,
  GenericServerSecretParams,
  GroupPublicParams,
  ProfileKeyCredentialRequest,
  ServerSecretParams,
  ServerZkAuthOperations,
  ServerZkProfileOperations,
  UuidCiphertext,
} from '@signalapp/libsignal-client/zkgroup';
import assert from 'assert';
import http2 from 'http2';
import crypto from 'crypto';
import createDebug from 'debug';
import { v4 as uuidv4, parse as parseUuid } from 'uuid';
import { AddressInfo } from 'net';

import { signalservice as Proto } from '../../protos/compiled';
import {
  DAY_IN_SECONDS,
  MAX_GROUP_CREDENTIALS_DAYS,
  PRIMARY_DEVICE_ID,
  PROFILE_KEY_CREDENTIAL_EXPIRATION,
} from '../constants';
import { ServerCertificate, generateSenderCertificate } from '../crypto';
import { ChangeNumberOptions, Device, DeviceKeys } from '../data/device';
import {
  BackupMediaBatch,
  BackupSignedPresentation,
  CreateCallLink,
  DeleteCallLink,
  Message,
  RegisterAccountResponse,
  SetBackupId,
  SetBackupKey,
  UpdateCallLink,
  VerificationSessionStorage,
} from '../data/schemas';
import {
  AciString,
  AttachmentId,
  DeviceId,
  PniString,
  ProvisionIdString,
  ProvisioningCode,
  RegistrationId,
  ServiceIdKind,
  ServiceIdString,
} from '../types';
import { getTodayInSeconds } from '../util';
import { ModifyGroupResult, ServerGroup } from './group';
import { ServerCall } from './call';
import {
  CallingError,
  CallingErrorCode,
  CallingEraId,
  getRandomCallingDemuxId,
  getRandomCallingEraId,
  CallingRoomId,
  CallInfo,
  CallingUserId,
  CallType,
  CallingDemuxId,
} from '../calling';
import { SfuService } from '../sfu/service';
import { SfuClientStatus } from '../sfu/call';
import {
  getRandomIcePassword,
  getRandomIceUsernameFragment,
  IcePassword,
  IceUsernameFragment,
} from '../sfu/ice';
import { Port, ServerMediaAddress } from '../sfu/config';
import { CallingPublicKey } from '../sfu/crypto';
import type { JsonValue, PartialDeep } from 'type-fest';

export enum EnvelopeType {
  CipherText = 'CipherText',
  Plaintext = 'Plaintext',
  PreKey = 'PreKey',
  SealedSender = 'SealedSender',
  SenderKey = 'SenderKey',
}

export type ProvisioningResponse = Readonly<{
  envelope: Buffer<ArrayBuffer>;
}>;

export type CredentialsRange = Readonly<{
  from: number;
  to: number;
}>;

export type StorageCredentials = Readonly<{
  username: string;
  password: string;
}>;

export type Credentials = Array<{
  credential: string;
  redemptionTime: number;
}>;

export type BackupCredentials = Readonly<{
  messages: Credentials;
  media: Credentials;
}>;

export type ChallengeResponse = Readonly<{
  code: number;
  data: unknown;
}>;

export type PreparedMultiDeviceMessage = Readonly<{
  timestamp: bigint;
  targets: ReadonlyArray<[Device, Message]>;
}>;

export type SenderCertificateOptions = Readonly<{
  includeE164?: boolean;
}>;

export type ProvisionDeviceOptions = Readonly<{
  aci: AciString;
  password: string;
  provisioningCode: ProvisioningCode;
  registrationId: RegistrationId;
  pniRegistrationId: RegistrationId | undefined;
}>;

export type RegisterDeviceOptions = Readonly<
  (
    | {
        primary?: undefined;
        provisionId?: ProvisionIdString;
        number: string | undefined;
        password: string;
        authCredentialSalt: Buffer<ArrayBuffer>;
      }
    | {
        primary: Device;
        provisionId?: undefined;
        number?: undefined;
        password?: string;
        authCredentialSalt?: undefined;
      }
  ) & {
    registrationId: RegistrationId;
    pniRegistrationId: RegistrationId | undefined;
  }
>;

export type PrepareMultiDeviceMessageResult = Readonly<
  | {
      status: 'stale';
      staleDevices: ReadonlyArray<number>;
    }
  | {
      status: 'incomplete';
      missingDevices: ReadonlyArray<number>;
      extraDevices: ReadonlyArray<number>;
    }
  | {
      status: 'unknown';
    }
  | {
      status: 'ok';
      targetServiceId: ServiceIdString;
      result: PreparedMultiDeviceMessage;
    }
>;

export type ConfirmUsernameResult = Readonly<{
  usernameHash: Uint8Array<ArrayBuffer>;
  usernameLinkHandle: Uint8Array<ArrayBuffer>;
}>;

export type SetUsernameLinkResult = Readonly<{
  entropy: Uint8Array<ArrayBuffer>;
  serverId: Uint8Array<ArrayBuffer>;
}>;

export type StorageWriteResult = Readonly<
  | {
      updated: false;
      manifest: Proto.StorageManifest.Params;
      error?: void;
    }
  | {
      updated: true;
      manifest?: void;
      error?: void;
    }
  | {
      updated?: void;
      error: string;
    }
>;

export type ModifyGroupOptions = Readonly<{
  group: ServerGroup;
  actions: Proto.GroupChange.Actions.Params;
  aciCiphertext: Uint8Array<ArrayBuffer>;
  pniCiphertext: Uint8Array<ArrayBuffer> | undefined;
}>;

export type EncryptedStickerPack = Readonly<{
  id: Buffer<ArrayBuffer>;
  manifest: Buffer<ArrayBuffer>;
  stickers: ReadonlyArray<Buffer<ArrayBuffer>>;
}>;

export type IsSendRateLimitedOptions = Readonly<{
  source: ServiceIdString;
  target: ServiceIdString;
}>;

export { type ModifyGroupResult };

interface WebSocket {
  sendMessage: (message: Buffer<ArrayBuffer> | 'empty') => Promise<void>;
  close: (code: number) => void;
}

interface SerializableCredential {
  serialize: () => Uint8Array<ArrayBuffer>;
}

type AuthEntry = Readonly<{
  readonly password: string;
  readonly device: Device;
}>;

type StorageAuthEntry = Readonly<{
  username: string;
  password: string;
  device: Device;
}>;

type MessageQueueEntry = (socket: WebSocket) => Promise<void>;

export type ServerJoinCallRequest = Readonly<{
  roomId: CallingRoomId;
  userId: CallingUserId;
  isAllowedToInitiateGroupCall: boolean;
  clientIceUsernameFragment: IceUsernameFragment;
  clientIcePassword: IcePassword;
  clientPublicKey: CallingPublicKey;
  clientHkdfExtraInfo: Uint8Array<ArrayBuffer> | null;
  callType: CallType;
  isAdmin: boolean;
  // roomId: CallingRoomId | null;
  newClientsRequireApproval: boolean;
  approvedUsers: ReadonlyArray<CallingUserId> | null;
}>;

export type ServerJoinCallResponse = Readonly<{
  demuxId: CallingDemuxId;
  serverMediaAddress: ServerMediaAddress;
  serverIceUsernameFragment: IceUsernameFragment;
  serverIcePassword: IcePassword;
  serverPublicKey: CallingPublicKey;
  callEraId: CallingEraId;
  callCreatorUserId: CallingUserId;
  clientStatus: SfuClientStatus;
}>;

export type CallLinkEntry = Readonly<{
  adminPasskey: Buffer<ArrayBuffer>;
  encryptedName: string;
  restrictions: 'none' | 'adminApproval';
  revoked: boolean;
  expiration: number;
}>;

export type BackupInfo = Readonly<{
  cdn: 3;
  backupDir: string;
  mediaDir: string;
  backupName: string;
  usedSpace?: number;
}>;

export class BackupAuthError extends Error {}

export type BackupMediaObject = Readonly<{
  cdn: 3;
  mediaId: string;
  objectLength: number;
}>;

export type BackupMediaList = Readonly<{
  storedMediaObjects: ReadonlyArray<BackupMediaObject>;
  backupDir: string;
  mediaDir: string;
  cursor: string | undefined;
}>;

export type BackupMediaCursor = {
  readonly backupId: string;
  remainingMedia: ReadonlyArray<BackupMediaObject>;
};

export type ListBackupMediaOptions = Readonly<{
  cursor: string | undefined;
  limit: number;
}>;

export type BackupMediaCopyResult =
  | Readonly<{ cdn: 3 }>
  | 'sourceNotFound'
  | 'wrongSourceLength'
  | 'outOfSpace';

export type BackupMediaBatchResponse = Readonly<{
  mediaId: string;
  result: BackupMediaCopyResult;
}>;

export type BackupMediaBatchResult = Readonly<{
  responses: ReadonlyArray<BackupMediaBatchResponse>;
}>;

export type TransferArchiveResponse = Readonly<
  | {
      error: 'RELINK_REQUESTED' | 'CONTINUE_WITHOUT_UPLOAD';
    }
  | {
      cdn: 3;
      key: string;
    }
>;

export type AttachmentUploadForm = Readonly<{
  cdn: 3;
  key: string;
  headers: Record<string, string>;
  signedUploadLocation: string;
}>;

export type RemoteConfigValueType = {
  enabled: boolean;
  value?: string;
};

export type HardcodedResponseError = {
  code: number;
  data: PartialDeep<JsonValue>;
};

const debug = createDebug('mock:server:base');

// NOTE: This class is currently extended only by src/api/server.ts
export abstract class Server {
  private readonly devices = new Map<AciString, Array<Device>>();
  private readonly primaryByServiceId = new Map<ServiceIdString, Device>();
  private readonly devicesByAuth = new Map<string, AuthEntry>();
  private readonly usedServiceIds = new Set<ServiceIdString>();
  private readonly usedProvisionIds = new Set<ProvisionIdString>();
  private readonly storageAuthByUsername = new Map<string, StorageAuthEntry>();
  private readonly storageAuthByDevice = new Map<Device, StorageAuthEntry>();
  private readonly storageManifestByAci = new Map<
    AciString,
    Proto.StorageManifest.Params
  >();
  private readonly storageItemsByAci = new Map<
    AciString,
    Map<string, Buffer<ArrayBuffer>>
  >();
  private readonly provisioningCodes = new Map<
    string,
    Map<ProvisioningCode, ProvisionIdString>
  >();
  private readonly attachments = new Map<AttachmentId, Buffer<ArrayBuffer>>();
  private readonly stickerPacks = new Map<string, EncryptedStickerPack>();
  private readonly webSockets = new Map<Device, WebSocket>();
  private readonly messageQueue = new WeakMap<
    Device,
    Array<MessageQueueEntry>
  >();
  private readonly groups = new Map<string, ServerGroup>();
  private readonly aciByUsername = new Map<string, AciString>();
  private readonly aciByReservedUsername = new Map<string, AciString>();
  private readonly usernameByAci = new Map<AciString, string>();
  private readonly reservedUsernameByAci = new Map<AciString, string>();
  private readonly usernameLinkIdByServiceId = new Map<
    ServiceIdString,
    string
  >();
  private readonly usernameLinkById = new Map<string, Buffer<ArrayBuffer>>();
  private readonly callsByRoomId = new Map<CallingRoomId, ServerCall>();
  private readonly callLinksByRoomId = new Map<string, CallLinkEntry>();
  private readonly backupAuthReqByAci = new Map<
    AciString,
    {
      messages: BackupAuthCredentialRequest;
      media: BackupAuthCredentialRequest;
    }
  >();
  private readonly backupKeyById = new Map<string, PublicKey>();
  private readonly backupCDNPasswordById = new Map<string, string>();
  private readonly backupMediaById = new Map<
    string,
    Array<BackupMediaObject>
  >();
  private readonly backupMediaCursorById = new Map<string, BackupMediaCursor>();
  private readonly remoteConfig = new Map<string, RemoteConfigValueType>();

  protected privCertificate: ServerCertificate | undefined;
  protected privZKSecret: ServerSecretParams | undefined;
  protected privGenericServerSecret: GenericServerSecretParams | undefined;
  protected privBackupServerSecret: GenericServerSecretParams | undefined;
  protected https: http2.Http2SecureServer | undefined;
  protected verificationStore = new Map<string, VerificationSessionStorage>();
  protected backupAuth = { username: 'fake', password: 'fake1234' };

  protected registerResponseData: Partial<RegisterAccountResponse> | undefined;
  protected registerResponseError: HardcodedResponseError | undefined;

  protected sfuService = new SfuService();

  public address(): AddressInfo {
    if (!this.https) {
      throw new Error('Not listening');
    }

    const result = this.https.address();
    if (result == null || typeof result !== 'object') {
      throw new Error('Invalid .address() result');
    }
    return result;
  }

  //
  // Service Ids
  //

  public async generateAci(): Promise<AciString> {
    let result: AciString;
    do {
      result = uuidv4() as AciString;
    } while (this.usedServiceIds.has(result));
    this.usedServiceIds.add(result);
    return result;
  }

  public async generatePni(): Promise<PniString> {
    let result: PniString;
    do {
      result = `PNI:${uuidv4()}` as PniString;
    } while (this.usedServiceIds.has(result));
    this.usedServiceIds.add(result);
    return result;
  }

  //
  // Provisioning
  //

  public async generateProvisionId(): Promise<ProvisionIdString> {
    let result: ProvisionIdString;
    do {
      result = uuidv4() as ProvisionIdString;
    } while (this.usedProvisionIds.has(result));
    this.usedProvisionIds.add(result);
    return result;
  }

  public async releaseProvisionId(id: ProvisionIdString): Promise<void> {
    this.usedProvisionIds.delete(id);
  }

  public abstract getProvisioningResponse(
    id: ProvisionIdString,
    abortSignal?: AbortSignal,
  ): Promise<ProvisioningResponse>;

  public setRegisterResponseData(data: Partial<RegisterAccountResponse>): void {
    this.registerResponseData = data;
  }
  public getRegisterResponseData():
    | Partial<RegisterAccountResponse>
    | undefined {
    return this.registerResponseData;
  }

  public setRegisterResponseError(
    error: HardcodedResponseError | undefined,
  ): void {
    this.registerResponseError = error;
  }
  public getRegisterResponseError(): HardcodedResponseError | undefined {
    return this.registerResponseError;
  }

  public async registerDevice({
    primary,
    provisionId,
    number: maybeNumber,
    registrationId,
    pniRegistrationId,
    password,
    authCredentialSalt: maybeAuthCredentialSalt,
  }: RegisterDeviceOptions): Promise<Device> {
    if (provisionId && !this.usedProvisionIds.has(provisionId)) {
      throw new Error('Use generateProvisionId() to create new provision id');
    }

    let aci: AciString;
    let pni: PniString | undefined;
    let number: string | undefined;
    let authCredentialSalt: Buffer<ArrayBuffer>;
    if (primary) {
      ({ aci, pni, number, authCredentialSalt } = primary);
    } else {
      [aci, pni] = await Promise.all([
        this.generateAci(),
        maybeNumber ? this.generatePni() : Promise.resolve(undefined),
      ]);
      number = maybeNumber;
      assert(maybeAuthCredentialSalt != null, 'Missing auth credential salt');
      authCredentialSalt = maybeAuthCredentialSalt;
    }

    let list = this.devices.get(aci);
    if (!list) {
      list = [];
      this.devices.set(aci, list);
    }
    const deviceId = (list.length + 1) as DeviceId;
    const isPrimary = deviceId === PRIMARY_DEVICE_ID;

    const device = new Device({
      aci,
      pni,
      number,
      deviceId,
      registrationId,
      pniRegistrationId,
      isProvisioned: !!password,
      authCredentialSalt,
    });

    if (isPrimary) {
      assert(!this.primaryByServiceId.has(aci), 'Duplicate primary device');
      this.primaryByServiceId.set(aci, device);
      if (pni != null) {
        this.primaryByServiceId.set(pni, device);
      }
    }

    if (password) {
      this.setDeviceAuthPassword(device, password);
    }

    list.push(device);

    debug('registered device number=%j aci=%s pni=%s', number, aci, pni);
    return device;
  }

  // Called from primary device
  public async getProvisioningCode(
    id: ProvisionIdString,
    aci: AciString,
  ): Promise<ProvisioningCode> {
    let entry = this.provisioningCodes.get(aci);
    if (!entry) {
      entry = new Map<ProvisioningCode, ProvisionIdString>();
      this.provisioningCodes.set(aci, entry);
    }
    let code: ProvisioningCode;
    do {
      code = crypto.randomBytes(8).toString('hex') as ProvisioningCode;
    } while (entry.has(code));
    entry.set(code, id);
    return code;
  }

  // Called from secondary device
  public async provisionDevice({
    aci,
    password,
    provisioningCode,
    registrationId,
    pniRegistrationId,
  }: ProvisionDeviceOptions): Promise<Device> {
    const entry = this.provisioningCodes.get(aci);
    if (!entry) {
      throw new Error('Invalid number for provisioning');
    }

    const provisionIdString = entry.get(provisioningCode);
    if (!provisionIdString) {
      throw new Error('Invalid provisioning code');
    }
    entry.delete(provisioningCode);

    const [primary] = this.devices.get(aci) ?? [];
    assert(primary !== undefined, 'Missing primary device when provisioning');

    const device = await this.registerDevice({
      primary,
      registrationId,
      pniRegistrationId,
      password,
    });

    debug('provisioned device id=%j aci=%j', device.deviceId, device.aci);
    return device;
  }

  private setDeviceAuthPassword(device: Device, password: string) {
    // This is awkward, but WebSockets use it.
    const username = `${device.aci}.${device.deviceId}`;

    // Add auth only after successfully registering the device
    assert(
      !this.devicesByAuth.has(username),
      'Duplicate username in `provisionDevice`',
    );
    const authEntry = {
      password,
      device,
    };
    this.devicesByAuth.set(username, authEntry);
  }

  public async updateDeviceKeys(
    device: Device,
    serviceIdKind: ServiceIdKind,
    keys: Omit<DeviceKeys, 'identityKey'>,
  ): Promise<void> {
    debug('setting device=%s keys', device.debugId);
    const primary = this.primaryByServiceId.get(device.aci);
    assert(primary, 'must have primary device');
    await device.setKeys(serviceIdKind, {
      ...keys,
      identityKey: await primary.getIdentityKey(serviceIdKind),
    });
  }

  public async changeDeviceNumber(
    device: Device,
    options: ChangeNumberOptions,
  ): Promise<void> {
    const oldPni = device.pni;
    assert(oldPni != null, 'Must have old PNI for change number');
    await device.changeNumber(options);

    const oldPrimary = this.primaryByServiceId.get(oldPni);
    if (oldPrimary === device) {
      this.primaryByServiceId.delete(oldPni);
      this.primaryByServiceId.set(options.pni, device);
    }
  }

  // Verification Sessions

  public getVerificationSession(
    id: string,
  ): VerificationSessionStorage | undefined {
    return this.verificationStore.get(id);
  }

  public saveVerificationSession(store: VerificationSessionStorage): void {
    this.verificationStore.set(store.session.id, store);
  }

  //
  // Auth
  //

  public async auth(
    username: string,
    password: string,
  ): Promise<Device | undefined> {
    const entry = this.devicesByAuth.get(username);
    if (!entry) {
      debug('auth failed, username=%j is unknown', username);
      return;
    }
    if (entry.password !== password) {
      debug('auth failed, invalid login/password %j:%j', username, password);
      return;
    }
    return entry.device;
  }

  //
  // Remote config
  //
  public setRemoteConfig(key: string, value: RemoteConfigValueType): void {
    this.remoteConfig.set(key, value);
  }

  public getRemoteConfig(): Map<string, RemoteConfigValueType> {
    return this.remoteConfig;
  }

  //
  // CDN
  //

  protected async storeAttachment(
    attachment: Buffer<ArrayBuffer>,
  ): Promise<AttachmentId> {
    const id = crypto
      .createHash('sha256')
      .update(attachment)
      .digest('hex') as AttachmentId;
    this.attachments.set(id, attachment);
    return id;
  }

  public async fetchAttachment(
    id: AttachmentId,
  ): Promise<Buffer<ArrayBuffer> | undefined> {
    return this.attachments.get(id);
  }

  public async fetchStickerPack(
    packId: string,
  ): Promise<Buffer<ArrayBuffer> | undefined> {
    return this.stickerPacks.get(packId)?.manifest;
  }

  public async fetchSticker(
    packId: string,
    stickerId: number,
  ): Promise<Buffer<ArrayBuffer> | undefined> {
    return this.stickerPacks.get(packId)?.stickers[stickerId];
  }

  public async storeStickerPack(pack: EncryptedStickerPack): Promise<void> {
    this.stickerPacks.set(pack.id.toString('hex'), pack);
  }

  public async getAttachmentUploadForm(
    folder: string,
    key: string,
  ): Promise<AttachmentUploadForm> {
    const { port } = this.address();

    // These are the only two in the TLS certificate
    const signedUploadLocation = `https://localhost:${port}/cdn3/${folder}/${key}`;
    return {
      cdn: 3,
      key,
      headers: {
        // TODO(indutny): verify on request
        expectedHeaders: crypto.randomBytes(16).toString('hex'),
      },
      signedUploadLocation,
    };
  }

  //
  // Messages
  //

  public async prepareMultiDeviceMessage(
    source: Device | undefined,
    targetServiceId: ServiceIdString,
    messages: ReadonlyArray<Message>,
    timestamp: bigint,
  ): Promise<PrepareMultiDeviceMessageResult> {
    if (this.isUnregistered(targetServiceId)) {
      return { status: 'unknown' };
    }

    const devices = await this.getAllDevicesByServiceId(targetServiceId);
    if (devices.length === 0) {
      return { status: 'unknown' };
    }

    const deviceById = new Map<DeviceId, Device>();
    for (const device of devices) {
      deviceById.set(device.deviceId, device);
    }

    const targets = new Array<[Device, Message]>();

    const extraDevices = new Set<DeviceId>();
    const staleDevices = new Set<DeviceId>();
    for (const message of messages) {
      const { destinationDeviceId, destinationRegistrationId } = message;

      const target = deviceById.get(destinationDeviceId);
      if (!target) {
        extraDevices.add(destinationDeviceId);
        continue;
      }

      const serviceIdKind = target.getServiceIdKind(targetServiceId);

      deviceById.delete(destinationDeviceId);

      if (
        target.getCheckedRegistrationId(serviceIdKind) !==
        destinationRegistrationId
      ) {
        staleDevices.add(destinationDeviceId);
        continue;
      }

      targets.push([target, message]);
    }

    if (source?.aci === targetServiceId) {
      deviceById.delete(source.deviceId);
    }

    if (staleDevices.size !== 0) {
      return { status: 'stale', staleDevices: Array.from(staleDevices) };
    }

    if (extraDevices.size !== 0 || deviceById.size !== 0) {
      return {
        status: 'incomplete',
        missingDevices: Array.from(deviceById.keys()),
        extraDevices: Array.from(extraDevices),
      };
    }

    return { status: 'ok', targetServiceId, result: { timestamp, targets } };
  }

  public async handlePreparedMultiDeviceMessage(
    source: Device | undefined,
    targetServiceId: ServiceIdString,
    prepared: PreparedMultiDeviceMessage,
  ): Promise<void> {
    for (const [target, message] of prepared.targets) {
      let envelopeType: EnvelopeType;
      if (message.type === Proto.Envelope.Type.DOUBLE_RATCHET) {
        envelopeType = EnvelopeType.CipherText;
      } else if (message.type === Proto.Envelope.Type.PREKEY_MESSAGE) {
        envelopeType = EnvelopeType.PreKey;
      } else if (message.type === Proto.Envelope.Type.UNIDENTIFIED_SENDER) {
        envelopeType = EnvelopeType.SealedSender;
      } else if (message.type === Proto.Envelope.Type.PLAINTEXT_CONTENT) {
        envelopeType = EnvelopeType.Plaintext;
      } else {
        throw new Error(`Unsupported envelope type: ${message.type}`);
      }

      const serviceIdKind = target.getServiceIdKind(targetServiceId);

      await this.handleMessage(
        source,
        serviceIdKind,
        envelopeType,
        target,
        Buffer.from(message.content, 'base64'),
        prepared.timestamp,
      );
    }
  }

  public abstract handleMessage(
    source: Device | undefined,
    serviceIdKind: ServiceIdKind,
    envelopeType: EnvelopeType,
    target: Device,
    encrypted: Buffer<ArrayBuffer>,
    timestamp: bigint,
  ): Promise<void>;

  public async addWebSocket(device: Device, socket: WebSocket): Promise<void> {
    debug('adding websocket for device=%s', device.debugId);
    const existing = this.webSockets.get(device);
    if (existing !== undefined) {
      debug('closing stale socket for devices=%s', device.debugId);
      existing.close(4409);
    }
    this.webSockets.set(device, socket);

    // Don't wait for send to be over
    void this.sendQueue(device, socket);
  }

  public removeWebSocket(device: Device, socket: WebSocket): void {
    const existing = this.webSockets.get(device);
    if (existing !== socket) {
      return;
    }

    debug('removing websocket for device=%s', device.debugId);
    this.webSockets.delete(device);
  }

  // TODO(indutny): timeout
  public async send(
    target: Device,
    message: Buffer<ArrayBuffer>,
  ): Promise<void> {
    const socket = this.webSockets.get(target);
    if (socket) {
      debug('sending message to %s socket', target.debugId);
      try {
        await socket.sendMessage(message);

        return;
      } catch (error) {
        assert(error instanceof Error);
        debug(
          'failed to send message to socket of %s, error %s',
          target.debugId,
          error.message,
        );
      }
    }

    debug('queueing message for device=%s', target.debugId);

    let queue = this.messageQueue.get(target);
    if (!queue) {
      queue = [];
      this.messageQueue.set(target, queue);
    }

    const { promise, resolve, reject } = Promise.withResolvers<void>();

    queue.push(async (socket) => {
      try {
        await socket.sendMessage(message);
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    await promise;
    debug('queued message sent to device=%s', target.debugId);
  }

  //
  // Groups
  //

  public async createGroup(group: Proto.Group.Params): Promise<ServerGroup> {
    const result = new ServerGroup({
      zkSecret: this.zkSecret,
      profileOps: new ServerZkProfileOperations(this.zkSecret),
      state: group,
    });

    const key = Buffer.from(result.publicParams.serialize()).toString('base64');

    if (this.groups.get(key)) {
      throw new Error('Duplicate group');
    }

    this.groups.set(key, result);

    return result;
  }

  public async modifyGroup({
    group,
    actions,
    aciCiphertext,
    pniCiphertext,
  }: ModifyGroupOptions): Promise<ModifyGroupResult> {
    return group.modify(
      new UuidCiphertext(Buffer.from(aciCiphertext)),
      pniCiphertext
        ? new UuidCiphertext(Buffer.from(pniCiphertext))
        : undefined,
      actions,
    );
  }

  public async getGroup(
    publicParams: Uint8Array<ArrayBuffer>,
  ): Promise<ServerGroup | undefined> {
    return this.groups.get(Buffer.from(publicParams).toString('base64'));
  }

  //
  // Storage
  //

  public async getStorageAuth(device: Device): Promise<StorageCredentials> {
    let auth = this.storageAuthByDevice.get(device);
    if (!auth) {
      do {
        auth = {
          username: crypto.randomBytes(8).toString('hex'),
          password: crypto.randomBytes(8).toString('hex'),
          device,
        };
      } while (this.storageAuthByUsername.has(auth.username));

      this.storageAuthByDevice.set(device, auth);
      this.storageAuthByUsername.set(auth.username, auth);

      debug('register new storage username=%j', auth.username);
    }

    return {
      username: auth.username,
      password: auth.password,
    };
  }

  public async storageAuth(
    username: string,
    password: string,
  ): Promise<Device | undefined> {
    const auth = this.storageAuthByUsername.get(username);
    if (!auth) {
      debug('auth failed, username=%j is unknown', username);
      return;
    }
    if (auth.password !== password) {
      debug('auth failed, invalid login/password %j:%j', username, password);
    }

    return auth.device;
  }

  public getStorageManifest(
    device: Device,
  ): Proto.StorageManifest.Params | undefined {
    return this.storageManifestByAci.get(device.aci);
  }

  public async applyStorageWrite(
    device: Device,
    { manifest, clearAll, insertItem, deleteKey }: Proto.WriteOperation.Params,
    shouldNotify = true,
  ): Promise<StorageWriteResult> {
    if (!manifest) {
      return { error: 'missing `writeOperation.manifest`' };
    }
    if (!manifest.version) {
      return { error: 'missing `writeOperation.manifest.version`' };
    }

    const existing = this.getStorageManifest(device);
    if (existing) {
      // Atomicity
      assert(existing.version, 'consistency check');
      if (manifest.version !== existing.version + 1n) {
        debug(
          'not updating storage manifest, current version=%j new version=%j',
          existing.version.toString(),
          manifest.version.toString(),
        );
        return { updated: false, manifest: existing };
      }
    }

    if (clearAll) {
      debug('clearing storage items for=%j', device.debugId);
      this.clearStorageItems(device);
    }

    for (const item of insertItem ?? []) {
      assert(item.key instanceof Uint8Array, 'insertItem.key must be a Buffer');
      assert(
        item.value instanceof Uint8Array,
        'insertItem.value must be a Buffer',
      );
      this.setStorageItem(
        device,
        Buffer.from(item.key),
        Buffer.from(item.value),
      );
    }

    for (const key of deleteKey ?? []) {
      this.deleteStorageItem(device, Buffer.from(key));
    }

    debug(
      'updating storage manifest to version=%d for=%j',
      manifest.version,
      device.debugId,
    );
    this.storageManifestByAci.set(device.aci, manifest);

    if (shouldNotify) {
      await this.onStorageManifestUpdate(device, manifest.version);
    }

    return { updated: true };
  }

  private clearStorageItems(device: Device): void {
    this.storageItemsByAci.get(device.aci)?.clear();
  }

  private setStorageItem(
    device: Device,
    key: Buffer<ArrayBuffer>,
    value: Buffer<ArrayBuffer>,
  ): void {
    let map = this.storageItemsByAci.get(device.aci);
    if (!map) {
      map = new Map();
      this.storageItemsByAci.set(device.aci, map);
    }

    map.set(key.toString('hex'), value);
  }

  public getStorageItem(
    device: Device,
    key: Buffer<ArrayBuffer>,
  ): Buffer<ArrayBuffer> | undefined {
    const map = this.storageItemsByAci.get(device.aci);
    if (!map) {
      return undefined;
    }

    return map.get(key.toString('hex'));
  }

  public getAllStorageKeys(device: Device): Array<Buffer<ArrayBuffer>> {
    const map = this.storageItemsByAci.get(device.aci);
    if (!map) {
      return [];
    }

    return Array.from(map.keys()).map((hex) => Buffer.from(hex, 'hex'));
  }

  public getStorageItems(
    device: Device,
    keys: ReadonlyArray<Buffer<ArrayBuffer>>,
  ): Array<Proto.StorageItem.Params> | undefined {
    const result = new Array<Proto.StorageItem.Params>();

    for (const key of keys) {
      const value = this.getStorageItem(device, key);
      if (value !== undefined) {
        result.push({ key, value });
      }
    }

    return result;
  }

  public deleteStorageItem(device: Device, key: Buffer<ArrayBuffer>): void {
    const map = this.storageItemsByAci.get(device.aci);
    if (!map) {
      return;
    }

    map.delete(key.toString('hex'));
  }

  protected abstract onStorageManifestUpdate(
    device: Device,
    version: bigint,
  ): Promise<void>;

  //
  // Calls
  //

  public async joinCall(
    request: ServerJoinCallRequest,
  ): Promise<ServerJoinCallResponse> {
    let call = this.callsByRoomId.get(request.roomId);
    if (call == null) {
      if (!request.isAllowedToInitiateGroupCall) {
        throw new CallingError(CallingErrorCode.NoPermissionToCreateCall);
      }

      call = new ServerCall({
        eraId: getRandomCallingEraId(),
        roomId: request.roomId,
        creatorUserId: request.userId,
      });

      this.callsByRoomId.set(request.roomId, call);
    }

    const demuxId = getRandomCallingDemuxId();

    const serverIceUsernameFragment = getRandomIceUsernameFragment();
    const serverIcePassword = getRandomIcePassword();

    const response = await this.sfuService.joinCall({
      eraId: call.eraId,
      demuxId,
      roomId: call.roomId,
      userId: request.userId,
      clientIceUsernameFragment: request.clientIceUsernameFragment,
      clientIcePassword: request.clientIcePassword,
      clientPublicKey: request.clientPublicKey,
      clientHkdfExtraInfo: request.clientHkdfExtraInfo,
      serverIceUsernameFragment,
      serverIcePassword,
      callType: request.callType,
      isAdmin: request.isAdmin,
      newClientsRequireApproval: request.newClientsRequireApproval,
      approvedUsers: request.approvedUsers,
    });

    // TODO
    const mediaServer: ServerMediaAddress = {
      addresses: [] as ServerMediaAddress['addresses'],
      hostname: null,
      ports: {
        udp: 0 as Port,
        tcp: 0 as Port,
        tls: null,
      },
    };

    return {
      demuxId,
      serverMediaAddress: mediaServer,
      serverIceUsernameFragment: serverIceUsernameFragment,
      serverIcePassword: serverIcePassword,
      serverPublicKey: response.serverPublicKey,
      callEraId: call.eraId,
      callCreatorUserId: call.creatorUserId,
      clientStatus: response.clientStatus,
    };
  }

  public async removeCall(
    roomId: CallingRoomId,
    eraId: CallingEraId,
  ): Promise<void> {
    const existing = this.callsByRoomId.get(roomId);
    if (existing == null) {
      return;
    }

    if (existing.eraId !== eraId) {
      throw new CallingError(
        CallingErrorCode.InternalError,
        'did not match era id',
      );
    }

    this.callsByRoomId.delete(roomId);

    // TODO: Should this cleanup sfuService and drop all the clients?
    throw new Error('incomplete');
  }

  public async peekCall(
    roomId: CallingRoomId,
    userId: CallingUserId,
  ): Promise<CallInfo> {
    const call = this.callsByRoomId.get(roomId);
    if (call == null) {
      throw new CallingError(CallingErrorCode.CallNotFound);
    }

    const response = await this.sfuService.peekCall({
      eraId: call.eraId,
      userId: userId,
    });

    return response.info;
  }

  //
  // Usernames
  //

  public async reserveUsername(
    aci: AciString,
    { usernameHashes }: { usernameHashes: Array<Uint8Array<ArrayBuffer>> },
  ): Promise<Uint8Array<ArrayBuffer> | undefined> {
    // Clear previously reserved usernames
    const reserved = this.reservedUsernameByAci.get(aci);
    if (reserved !== undefined) {
      this.reservedUsernameByAci.delete(aci);
      this.aciByReservedUsername.delete(reserved);
    }

    for (const hash of usernameHashes) {
      const hashHex = Buffer.from(hash).toString('hex');
      if (this.aciByReservedUsername.has(hashHex)) {
        continue;
      }
      if (this.aciByUsername.has(hashHex)) {
        continue;
      }

      this.reservedUsernameByAci.set(aci, hashHex);
      this.aciByReservedUsername.set(hashHex, aci);
      return hash;
    }

    return undefined;
  }

  public async confirmUsername(
    aci: AciString,
    {
      usernameHash,
      zkProof,
      usernameCiphertext,
    }: {
      usernameHash: Uint8Array<ArrayBuffer>;
      zkProof: Uint8Array<ArrayBuffer>;
      usernameCiphertext: Uint8Array<ArrayBuffer>;
    },
  ): Promise<ConfirmUsernameResult | undefined> {
    // Clear previously reserved usernames
    const reserved = this.reservedUsernameByAci.get(aci);
    if (reserved !== Buffer.from(usernameHash).toString('hex')) {
      return undefined;
    }

    try {
      usernames.verifyProof(zkProof, usernameHash);
    } catch (error) {
      debug('failed to verify username proof of %s: %O', aci, error);
      return undefined;
    }

    this.reservedUsernameByAci.delete(aci);
    this.aciByReservedUsername.delete(reserved);

    this.aciByUsername.set(reserved, aci);
    this.usernameByAci.set(aci, reserved);

    const usernameLinkHandle = await this.replaceUsernameLink(
      aci,
      usernameCiphertext,
    );

    return { usernameHash, usernameLinkHandle };
  }

  public async deleteUsername(aci: AciString): Promise<void> {
    const hash = this.usernameByAci.get(aci);
    if (!hash) {
      return;
    }

    this.aciByUsername.delete(hash);
    this.usernameByAci.delete(aci);

    await this.deleteUsernameLink(aci);
  }

  public async deleteUsernameLink(aci: AciString): Promise<void> {
    const previousId = this.usernameLinkIdByServiceId.get(aci);
    if (previousId !== undefined) {
      this.usernameLinkById.delete(previousId);
    }
    this.usernameLinkIdByServiceId.delete(aci);
  }

  public async lookupByUsernameHash(
    usernameHash: Buffer<ArrayBuffer>,
  ): Promise<AciString | undefined> {
    return this.aciByUsername.get(usernameHash.toString('hex'));
  }

  public async replaceUsernameLink(
    aci: AciString,
    encryptedValue: Uint8Array<ArrayBuffer>,
    { keepLinkHandle = false }: { keepLinkHandle?: boolean } = {},
  ): Promise<Uint8Array<ArrayBuffer>> {
    const previousId = this.usernameLinkIdByServiceId.get(aci);

    const nextId = keepLinkHandle && previousId ? previousId : uuidv4();

    if (previousId !== undefined) {
      this.usernameLinkById.delete(previousId);
    }

    this.usernameLinkIdByServiceId.set(aci, nextId);
    this.usernameLinkById.set(nextId, Buffer.from(encryptedValue));

    return parseUuid(nextId) as Uint8Array<ArrayBuffer>;
  }

  public async lookupByUsernameLink(
    lookupId: string,
  ): Promise<Buffer<ArrayBuffer> | undefined> {
    return this.usernameLinkById.get(lookupId);
  }

  // For easier testing
  public async lookupByUsername(
    username: string,
  ): Promise<AciString | undefined> {
    return this.aciByUsername.get(
      Buffer.from(usernames.hash(username)).toString('hex'),
    );
  }

  // For easier testing
  public async setUsername(aci: AciString, username: string): Promise<void> {
    const hash = Buffer.from(usernames.hash(username)).toString('hex');
    this.usernameByAci.set(aci, hash);
    this.aciByUsername.set(hash, aci);
  }

  // For easier testing
  public async setUsernameLink(
    aci: AciString,
    username: string,
  ): Promise<SetUsernameLinkResult> {
    const { entropy, encryptedUsername } =
      usernames.createUsernameLink(username);

    const serverId = await this.replaceUsernameLink(aci, encryptedUsername);

    return {
      entropy,
      serverId,
    };
  }

  //
  // Call Links
  //

  public async createCallLinkAuth(
    device: Device,
    request: CreateCallLinkCredentialRequest,
  ): Promise<CreateCallLinkCredentialResponse> {
    return request.issueCredential(
      Aci.parseFromServiceIdString(device.aci),
      getTodayInSeconds(),
      this.genericServerSecret,
    );
  }

  public hasCallLink(roomId: string): boolean {
    return this.callLinksByRoomId.has(roomId);
  }

  public async createCallLink(
    roomId: string,
    { adminPasskey }: CreateCallLink,
  ): Promise<CallLinkEntry> {
    const callLink: CallLinkEntry = {
      adminPasskey,
      encryptedName: '',
      restrictions: 'none',
      revoked: false,
      expiration: new Date('2101-01-01').getTime(),
    };
    this.callLinksByRoomId.set(roomId, callLink);
    return callLink;
  }

  public async getCallLink(roomId: string): Promise<CallLinkEntry | undefined> {
    return this.callLinksByRoomId.get(roomId);
  }

  public async updateCallLink(
    roomId: string,
    { adminPasskey, name, restrictions, revoked }: UpdateCallLink,
  ): Promise<CallLinkEntry> {
    const callLink = this.callLinksByRoomId.get(roomId);
    if (!callLink) {
      throw new Error('Call link not found');
    }
    if (!callLink.adminPasskey.equals(adminPasskey)) {
      throw new Error('Invalid admin passkey');
    }
    const newCallLink: CallLinkEntry = {
      adminPasskey,
      encryptedName: name ?? callLink.encryptedName,
      restrictions: restrictions ?? callLink.restrictions,
      revoked: revoked ?? callLink.revoked,
      expiration: callLink.expiration,
    };
    this.callLinksByRoomId.set(roomId, newCallLink);
    return newCallLink;
  }

  public async deleteCallLink(
    roomId: string,
    { adminPasskey }: DeleteCallLink,
  ): Promise<void> {
    const callLink = this.callLinksByRoomId.get(roomId);
    if (!callLink) {
      throw new Error('Call link not found');
    }
    if (!callLink.adminPasskey.equals(adminPasskey)) {
      throw new Error('Invalid admin passkey');
    }
    this.callLinksByRoomId.delete(roomId);
  }

  //
  // Utils
  //

  public async getDeviceByServiceId(
    serviceId: ServiceIdString,
    deviceId = PRIMARY_DEVICE_ID,
  ): Promise<Device | undefined> {
    const primary = this.primaryByServiceId.get(serviceId);
    if (primary == null) {
      return undefined;
    }

    const list = this.devices.get(primary.aci);
    if (list === undefined) {
      return undefined;
    }
    return list.find((device) => device.deviceId === deviceId);
  }

  public async removeDeviceByServiceId(
    serviceId: ServiceIdString,
    deviceId: DeviceId,
  ): Promise<void> {
    const primary = this.primaryByServiceId.get(serviceId);
    if (primary == null) {
      return;
    }

    const list = this.devices.get(primary.aci);
    if (list === undefined) {
      return;
    }
    const index = list.findIndex((device) => device.deviceId === deviceId);
    assert(index !== -1, `Missing device for ${deviceId}`);

    const device = list[index];
    assert(device != null);
    list.splice(index, 1);

    const idByAci = `${device.aci}.${deviceId}`;
    this.devicesByAuth.delete(idByAci);
  }

  public async getAllDevicesByServiceId(
    serviceId: ServiceIdString,
  ): Promise<ReadonlyArray<Device>> {
    const primary = this.primaryByServiceId.get(serviceId);
    if (!primary) {
      return [];
    }

    return this.devices.get(primary.aci) ?? [];
  }

  public async getSenderCertificate(
    device: Device,
    { includeE164 = true }: SenderCertificateOptions = {},
  ): Promise<SenderCertificate> {
    return generateSenderCertificate(this.certificate, {
      number: includeE164 ? device.number : undefined,
      aci: device.aci,
      deviceId: device.deviceId,
      identityKey: await device.getIdentityKey(ServiceIdKind.ACI),
    });
  }

  public async getGroupCredentials(
    { aci, pni, authCredentialSalt }: Device,
    range: CredentialsRange,
  ): Promise<Credentials> {
    const auth = new ServerZkAuthOperations(this.zkSecret);

    return this.issueCredentials(range, (redemptionTime) => {
      if (pni == null) {
        return auth.issueAuthCredentialZkcWithoutPni(
          Aci.parseFromServiceIdString(aci),
          authCredentialSalt,
          redemptionTime,
        );
      }

      return auth.issueAuthCredentialWithPniZkc(
        Aci.parseFromServiceIdString(aci),
        Pni.parseFromServiceIdString(pni),
        redemptionTime,
      );
    });
  }

  public async verifyGroupCredentials(
    publicParams: Buffer<ArrayBuffer>,
    credential: Buffer<ArrayBuffer>,
  ): Promise<AuthCredentialPresentation> {
    const auth = new ServerZkAuthOperations(this.zkSecret);

    const groupParams = new GroupPublicParams(publicParams);
    const presentation = new AuthCredentialPresentation(credential);

    auth.verifyAuthCredentialPresentation(groupParams, presentation);

    // TODO(indutny): verify credential timestamp

    return presentation;
  }

  public async getCallLinkAuthCredentials(
    { aci }: Device,
    range: CredentialsRange,
  ): Promise<Credentials> {
    return this.issueCredentials(range, (redemptionTime) => {
      return CallLinkAuthCredentialResponse.issueCredential(
        Aci.parseFromServiceIdString(aci),
        redemptionTime,
        this.genericServerSecret,
      );
    });
  }

  public async issueExpiringProfileKeyCredential(
    { aci, profileKeyCommitment }: Device,
    request: ProfileKeyCredentialRequest,
  ): Promise<Buffer<ArrayBuffer> | undefined> {
    if (!profileKeyCommitment) {
      return undefined;
    }

    const today = getTodayInSeconds();

    const profile = new ServerZkProfileOperations(this.zkSecret);
    return Buffer.from(
      profile
        .issueExpiringProfileKeyCredential(
          request,
          Aci.parseFromServiceIdString(aci),
          profileKeyCommitment,
          today + PROFILE_KEY_CREDENTIAL_EXPIRATION,
        )
        .serialize(),
    );
  }

  public async setBackupId(
    { aci }: Device,
    {
      messagesBackupAuthCredentialRequest,
      mediaBackupAuthCredentialRequest,
    }: SetBackupId,
  ): Promise<void> {
    this.backupAuthReqByAci.set(aci, {
      messages: new BackupAuthCredentialRequest(
        messagesBackupAuthCredentialRequest,
      ),
      media: new BackupAuthCredentialRequest(mediaBackupAuthCredentialRequest),
    });
  }

  public async setBackupKey(
    signedPresentation: BackupSignedPresentation,
    { backupIdPublicKey }: SetBackupKey,
  ): Promise<void> {
    const publicKey = PublicKey.deserialize(backupIdPublicKey);
    const backupId = this.authenticateBackup(signedPresentation, publicKey);
    this.backupKeyById.set(backupId, publicKey);
    if (!this.backupCDNPasswordById.get(backupId)) {
      const password = crypto.randomBytes(16).toString('hex');
      this.backupCDNPasswordById.set(backupId, password);
    }
  }

  public async refreshBackup(
    signedPresentation: BackupSignedPresentation,
  ): Promise<void> {
    this.authenticateBackup(signedPresentation);

    // No-op for tests
  }

  public async getBackupInfo(
    signedPresentation: BackupSignedPresentation,
  ): Promise<BackupInfo> {
    const backupId = this.authenticateBackup(signedPresentation);

    return {
      cdn: 3,
      backupDir: backupId,
      mediaDir: 'media',
      backupName: 'backup',
    };
  }

  public async listBackupMedia(
    signedPresentation: BackupSignedPresentation,
    { cursor, limit }: ListBackupMediaOptions,
  ): Promise<BackupMediaList> {
    const backupId = this.authenticateBackup(signedPresentation);

    let cursorData: BackupMediaCursor | undefined;
    let newCursor: string | undefined;
    if (cursor !== undefined) {
      cursorData = this.backupMediaCursorById.get(cursor);
    }
    if (cursorData === undefined) {
      newCursor = crypto.randomBytes(8).toString('hex');
      cursorData = {
        backupId,
        remainingMedia: this.backupMediaById.get(backupId)?.slice() ?? [],
      };
      this.backupMediaCursorById.set(newCursor, cursorData);
    } else {
      assert.strictEqual(cursorData.backupId, backupId);
    }

    const storedMediaObjects = cursorData.remainingMedia.slice(0, limit);

    // End of list
    if (storedMediaObjects.length < limit) {
      assert(newCursor !== undefined);

      this.backupMediaCursorById.delete(newCursor);
      newCursor = undefined;
    } else {
      cursorData.remainingMedia = cursorData.remainingMedia.slice(limit);
    }

    return {
      storedMediaObjects,
      backupDir: backupId,
      mediaDir: 'media',
      cursor: newCursor,
    };
  }

  public async getBackupMediaUploadForm(
    signedPresentation: BackupSignedPresentation,
  ): Promise<AttachmentUploadForm> {
    this.authenticateBackup(signedPresentation);
    const form = await this.getAttachmentUploadForm('attachments', uuidv4());
    return form;
  }

  public async getBackupUploadForm(
    signedPresentation: BackupSignedPresentation,
  ): Promise<AttachmentUploadForm> {
    const backupId = this.authenticateBackup(signedPresentation);
    const form = await this.getAttachmentUploadForm(
      'backups',
      `${backupId}/backup`,
    );
    return form;
  }

  public async backupMediaBatch(
    signedPresentation: BackupSignedPresentation,
    batch: BackupMediaBatch,
  ): Promise<BackupMediaBatchResult> {
    const backupId = this.authenticateBackup(signedPresentation);
    const responses = await this.backupTransitAttachments(backupId, batch);
    return { responses };
  }

  public async getBackupCDNAuth(
    signedPresentation: BackupSignedPresentation,
  ): Promise<Record<string, string>> {
    const backupId = this.authenticateBackup(signedPresentation);
    const password = this.backupCDNPasswordById.get(backupId);
    assert(password !== undefined);

    const basic = Buffer.from(`${backupId}:${password}`);
    const authorization = `Basic ${basic.toString('base64')}`;

    return {
      authorization,
    };
  }

  public getBackupAuth(): { username: string; password: string } {
    return this.backupAuth;
  }
  public setBackupAuth(auth: { username: string; password: string }): void {
    this.backupAuth = auth;
  }

  public async authorizeBackupCDN(
    backupId: string,
    password: string,
  ): Promise<boolean> {
    const expected = this.backupCDNPasswordById.get(backupId);
    if (expected === undefined) {
      return false;
    }

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(password))) {
      return false;
    }

    return true;
  }

  public async getBackupCredentials(
    { aci, backupLevel }: Device,
    range: CredentialsRange,
  ): Promise<BackupCredentials | undefined> {
    const req = this.backupAuthReqByAci.get(aci);
    if (req === undefined) {
      return undefined;
    }

    const messages = this.issueCredentials(range, (redemptionTime) => {
      return req.messages.issueCredential(
        redemptionTime,
        BackupLevel.Free,
        BackupCredentialType.Messages,
        this.backupServerSecret,
      );
    });

    const media = this.issueCredentials(range, (redemptionTime) => {
      return req.media.issueCredential(
        redemptionTime,
        backupLevel,
        BackupCredentialType.Media,
        this.backupServerSecret,
      );
    });

    return {
      messages,
      media,
    };
  }

  protected async onNewBackupMediaObject(
    backupId: string,
    media: BackupMediaObject,
  ): Promise<void> {
    let list = this.backupMediaById.get(backupId);
    if (list === undefined) {
      list = [];
      this.backupMediaById.set(backupId, list);
    }
    list.push(media);
  }

  protected abstract backupTransitAttachments(
    backupId: string,
    batch: BackupMediaBatch,
  ): Promise<Array<BackupMediaBatchResponse>>;

  public abstract getTransferArchive(
    device: Device,
  ): Promise<TransferArchiveResponse>;

  public abstract isUnregistered(serviceId: ServiceIdString): boolean;

  public abstract isSendRateLimited(options: IsSendRateLimitedOptions): boolean;

  public abstract getResponseForChallenges(): ChallengeResponse | undefined;

  //
  // Private
  //

  protected set certificate(value: ServerCertificate) {
    if (this.privCertificate) {
      throw new Error('Certificate already set');
    }
    this.privCertificate = value;
  }

  protected get certificate(): ServerCertificate {
    if (!this.privCertificate) {
      throw new Error('Certificate not set');
    }
    return this.privCertificate;
  }

  protected set genericServerSecret(value: GenericServerSecretParams) {
    if (this.privGenericServerSecret) {
      throw new Error('zkgroup generic secret already set');
    }
    this.privGenericServerSecret = value;
  }

  protected get genericServerSecret(): GenericServerSecretParams {
    if (!this.privGenericServerSecret) {
      throw new Error('zkgroup generic secret not set');
    }
    return this.privGenericServerSecret;
  }

  protected set backupServerSecret(value: GenericServerSecretParams) {
    if (this.privBackupServerSecret) {
      throw new Error('zkgroup backup secret already set');
    }
    this.privBackupServerSecret = value;
  }

  protected get backupServerSecret(): GenericServerSecretParams {
    if (!this.privBackupServerSecret) {
      throw new Error('zkgroup backup secret not set');
    }
    return this.privBackupServerSecret;
  }

  protected set zkSecret(value: ServerSecretParams) {
    if (this.privZKSecret) {
      throw new Error('zkgroup secret already set');
    }
    this.privZKSecret = value;
  }

  protected get zkSecret(): ServerSecretParams {
    if (!this.privZKSecret) {
      throw new Error('zkgroup secret not set');
    }
    return this.privZKSecret;
  }

  private async sendQueue(device: Device, socket: WebSocket): Promise<void> {
    let queue = this.messageQueue.get(device);
    if (queue) {
      this.messageQueue.delete(device);
    } else {
      queue = [];
    }

    debug('sending queued %d messages to %s', queue.length, device.debugId);
    try {
      await Promise.all(
        queue.map((fn) => fn(socket)).concat(socket.sendMessage('empty')),
      );
    } catch {
      // Ignore errors, socket likely closed
    }
    debug('sent queued %d messages to %s', queue.length, device.debugId);
  }

  private issueCredentials(
    { from, to }: CredentialsRange,
    issueOne: (redemptionTime: number) => SerializableCredential,
  ): Credentials {
    const today = getTodayInSeconds();
    if (
      from > to ||
      from < today ||
      to > today + DAY_IN_SECONDS * MAX_GROUP_CREDENTIALS_DAYS
    ) {
      throw new Error('Invalid redemption range');
    }

    const result: Credentials = [];

    for (
      let redemptionTime = from;
      redemptionTime <= to;
      redemptionTime += DAY_IN_SECONDS
    ) {
      result.push({
        credential: Buffer.from(issueOne(redemptionTime).serialize()).toString(
          'base64',
        ),
        redemptionTime,
      });
    }
    return result;
  }

  private authenticateBackup(
    signedPresentation: BackupSignedPresentation,
    newPublicKey?: PublicKey,
  ): string {
    let presentation: BackupAuthCredentialPresentation;
    try {
      presentation = new BackupAuthCredentialPresentation(
        signedPresentation.presentation,
      );
      presentation.verify(this.backupServerSecret);
    } catch (e) {
      throw new BackupAuthError(
        'Could not verify backup credential presentation',
        { cause: e },
      );
    }

    // Backup id is used in urls, so encode it properly
    const backupId = Buffer.from(presentation.getBackupId()).toString(
      'base64url',
    );

    const validatingKey = this.backupKeyById.get(backupId) ?? newPublicKey;
    if (!validatingKey) {
      throw new BackupAuthError('No backup public key to validate against');
    }

    const isValid = validatingKey.verify(
      signedPresentation.presentation,
      signedPresentation.presentationSignature,
    );
    if (!isValid) {
      throw new BackupAuthError('Invalid signature');
    }

    return backupId;
  }
}
