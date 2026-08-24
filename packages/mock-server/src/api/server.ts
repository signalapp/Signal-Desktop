// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { type Readable } from 'stream';
import { randomBytes } from 'crypto';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import http2, {
  SecureServerOptions,
  Http2ServerRequest,
  Http2ServerResponse,
} from 'http2';
import { parse as parseURL } from 'url';
import {
  PrivateKey,
  PublicKey,
  initLogger,
  LogLevel as SignalClientLogLevel,
} from '@signalapp/libsignal-client';
import {
  GenericServerSecretParams,
  ServerSecretParams,
} from '@signalapp/libsignal-client/zkgroup';
import createDebug from 'debug';
import WebSocket from 'ws';
import { run, type RequestHandler } from 'micro';

import { attachmentToPointer } from '../data/attachment';
import { BackupMediaBatch } from '../data/schemas';
import { PRIMARY_DEVICE_ID } from '../constants';
import {
  AciString,
  ProvisionIdString,
  ProvisioningCode,
  ServiceIdKind,
  ServiceIdString,
} from '../types';
import { serializeContacts } from '../data/contacts';
import { Group as GroupData } from '../data/group';
import {
  encryptAttachment,
  encryptProvisionMessage,
  generateServerCertificate,
} from '../crypto';
import { signalservice as Proto } from '../../protos/compiled';
import {
  BackupMediaBatchResponse,
  Server as BaseServer,
  ChallengeResponse,
  EnvelopeType,
  IsSendRateLimitedOptions,
  ModifyGroupOptions,
  ModifyGroupResult,
  ProvisionDeviceOptions,
  ProvisioningResponse,
  TransferArchiveResponse,
} from '../server/base';
import { Device, DeviceKeys } from '../data/device';
import {
  PromiseQueue,
  generateDevicePassword,
  generateRandomE164,
  generateRegistrationId,
} from '../util';

import { createHandler as createHTTPHandler } from '../server/http';
import { createHandler as createGRPCHandler } from '../server/grpc';
import { Connection as WSConnection } from '../server/ws';

import { PrimaryDevice } from './primary-device';

type TrustRoot = Readonly<{
  privateKey: string;
  publicKey: string;
}>;

type ZKParams = Readonly<{
  secretParams: string;
  publicParams: string;
  genericSecretParams: string;
  genericPublicParams: string;
  backupSecretParams: string;
  backupPublicParams: string;
}>;

type StrictConfig = Readonly<{
  trustRoot: TrustRoot;
  zkParams: ZKParams;
  https: SecureServerOptions;
  timeout: number;
  maxStorageReadKeys?: number;
  cdn3Path?: string;
  updates2Path?: string;
}>;

export type Config = Readonly<{
  trustRoot?: TrustRoot;
  zkParams?: ZKParams;
  https?: SecureServerOptions;
  timeout?: number;
  maxStorageReadKeys?: number;
  cdn3Path?: string;
  updates2Path?: string;
}>;

export type CreatePrimaryDeviceOptions = Readonly<{
  profileName: string;
  contacts?: ReadonlyArray<PrimaryDevice>;
  contactsWithoutProfileKey?: ReadonlyArray<PrimaryDevice>;
  password?: string;
  hasE164?: boolean;
}>;

export type PendingProvision = {
  complete: (response: PendingProvisionResponse) => Promise<Device>;
};

export type PendingProvisionResponse = Readonly<{
  provisionURL: string;
  primaryDevice: PrimaryDevice;
}>;

export type RateLimitOptions = Readonly<{
  source: ServiceIdString;
  target: ServiceIdString;
}>;

type ProvisionResultQueue = Readonly<{
  seenServiceIdKinds: Set<ServiceIdKind>;
  promiseQueue: PromiseQueue<Device>;
}>;

const debug = createDebug('mock:server:mock');
const libsignalDebug = createDebug('mock:server:libsignal');

const CERTS_DIR = path.join(__dirname, '..', '..', 'certs');

const CERT = fs.readFileSync(path.join(CERTS_DIR, 'full-cert.pem'));
const KEY = fs.readFileSync(path.join(CERTS_DIR, 'key.pem'));
const TRUST_ROOT: TrustRoot = JSON.parse(
  fs.readFileSync(path.join(CERTS_DIR, 'trust-root.json')).toString(),
);
const ZK_PARAMS: ZKParams = JSON.parse(
  fs.readFileSync(path.join(CERTS_DIR, 'zk-params.json')).toString(),
);

const DEFAULT_API_TIMEOUT = 60000;

initLogger(
  SignalClientLogLevel.Info,
  (
    level: SignalClientLogLevel,
    target: string,
    file: string | null,
    line: number | null,
    message: string,
  ) => {
    let fileString = '';
    if (file && line) {
      fileString = ` ${file}:${line}`;
    } else if (file) {
      fileString = ` ${file}`;
    }
    const logString = `${SignalClientLogLevel[level]} ${message} ${target}${fileString}`;

    libsignalDebug(logString);
  },
);

export class Server extends BaseServer {
  private readonly config: StrictConfig;

  private readonly trustRoot: PrivateKey;
  private readonly primaryDevices = new Map<AciString, PrimaryDevice>();
  private readonly knownNumbers = new Set<string>();
  private emptyAttachment: Proto.AttachmentPointer.Params | undefined;

  private provisionQueue: PromiseQueue<PendingProvision>;
  private provisionResultQueueByCode = new Map<
    ProvisioningCode,
    ProvisionResultQueue
  >();
  private provisionResultQueueByKey = new Map<string, ProvisionResultQueue>();
  private manifestQueueByAci = new Map<AciString, PromiseQueue<bigint>>();
  private groupQueueById = new Map<string, PromiseQueue<number>>();
  private transferArchiveByDevice = new Map<Device, TransferArchiveResponse>();
  private transferCallbacksByDevice = new Map<
    Device,
    Array<(response: TransferArchiveResponse) => void>
  >();
  private rateLimitCountByPair = new Map<
    `${ServiceIdString}:${ServiceIdString}`,
    number
  >();
  private responseForChallenges: ChallengeResponse | undefined;
  private unregisteredServiceIds = new Set<ServiceIdString>();
  private wsUpgradeResponseHeaders: Record<string, string> = {};

  constructor(config: Config = {}) {
    super();

    this.config = {
      timeout: DEFAULT_API_TIMEOUT,
      trustRoot: TRUST_ROOT,
      zkParams: ZK_PARAMS,
      ...config,

      https: {
        key: KEY,
        cert: CERT,
        allowHTTP1: true,
        ...(config.https ?? {}),
        settings: {
          ...(config.https?.settings ?? {}),
          enableConnectProtocol: true,
        },
      },
    };

    const trustPrivate = Buffer.from(
      this.config.trustRoot.privateKey,
      'base64',
    );
    this.trustRoot = PrivateKey.deserialize(trustPrivate);

    const zkSecret = Buffer.from(this.config.zkParams.secretParams, 'base64');
    this.zkSecret = new ServerSecretParams(zkSecret);

    const genericSecret = Buffer.from(
      this.config.zkParams.genericSecretParams,
      'base64',
    );
    this.genericServerSecret = new GenericServerSecretParams(genericSecret);

    const backupSecret = Buffer.from(
      this.config.zkParams.backupSecretParams,
      'base64',
    );
    this.backupServerSecret = new GenericServerSecretParams(backupSecret);

    this.certificate = generateServerCertificate(this.trustRoot);

    this.provisionQueue = this.createQueue('api/Server/provisionQueue');
  }

  public async listen(port: number, host?: string): Promise<void> {
    if (this.https) {
      throw new Error('Already listening');
    }

    const emptyData = encryptAttachment(Buffer.alloc(0));
    const emptyCDNKey = await this.storeAttachment(emptyData.blob);

    this.emptyAttachment = attachmentToPointer(emptyCDNKey, emptyData);

    const httpHandler = createHTTPHandler(this, {
      cdn3Path: this.config.cdn3Path,
      updates2Path: this.config.updates2Path,
    });

    const grpcHandler = createGRPCHandler(this);

    const server = http2
      .createSecureServer(this.config.https, (req, res) => {
        let handler: RequestHandler;
        if (req.headers['content-type'] === 'application/grpc') {
          handler = grpcHandler;
        } else {
          handler = httpHandler;
        }

        // micro is actually compatible with http2 requests, but the types are
        // not.
        void run(
          req as unknown as IncomingMessage,
          res as unknown as ServerResponse,
          handler,
        );
      })
      .on('connect', (req: Http2ServerRequest, res: Http2ServerResponse) => {
        // WebSocket
        if (req.method === 'CONNECT') {
          res.writeHead(200, this.wsUpgradeResponseHeaders);

          const websocket = new WebSocket(
            null as unknown as string,
            undefined,
            {},
          );
          (websocket as any).setSocket(req.stream, Buffer.alloc(0), {});
          const conn = new WSConnection(req, websocket, this);

          conn.start(websocket).catch((error: unknown) => {
            websocket.close();
            debug('Websocket handling error', error);
          });
          return;
        }
      });

    this.https = server;

    return new Promise((resolve) => {
      server.listen(port, host, () => resolve());
    });
  }

  public async close(): Promise<void> {
    const https = this.https;
    if (!https) {
      throw new Error('Not listening');
    }

    debug('closing server');

    await new Promise((resolve) => https.close(resolve));
  }

  //
  // Various queues
  //

  public async waitForProvision(): Promise<PendingProvision> {
    return this.provisionQueue.shift();
  }

  private async waitForStorageManifest(
    device: Device,
    afterVersion?: bigint,
  ): Promise<void> {
    let queue = this.manifestQueueByAci.get(device.aci);
    if (!queue) {
      queue = this.createQueue('api/Server/waitForStorageManifest');
      this.manifestQueueByAci.set(device.aci, queue);
    }

    let version: bigint;
    do {
      version = await queue.shift();
    } while (afterVersion !== undefined && version <= afterVersion);
  }

  public async waitForGroupUpdate(group: GroupData): Promise<void> {
    let queue = this.groupQueueById.get(group.id);
    if (!queue) {
      queue = this.createQueue('api/Server/waitForGroupUpdate');
      this.groupQueueById.set(group.id, queue);
    }

    let version: number;
    do {
      version = await queue.shift();
    } while (version <= group.revision);
  }

  //
  // Helper methods
  //

  public async createPrimaryDevice({
    profileName,
    contacts = [],
    contactsWithoutProfileKey = [],
    password,
    hasE164 = true,
  }: CreatePrimaryDeviceOptions): Promise<PrimaryDevice> {
    const number = hasE164 ? await this.generateNumber() : undefined;

    const registrationId = generateRegistrationId();
    const pniRegistrationId = generateRegistrationId();
    const devicePassword = password ?? generateDevicePassword();
    const device = await this.registerDevice({
      number,
      registrationId,
      pniRegistrationId: hasE164 ? pniRegistrationId : undefined,
      password: devicePassword,
      authCredentialSalt: randomBytes(16),
    });

    const { aci } = device;

    debug(
      'creating primary device with aci=%s registrationId=%d',
      aci,
      registrationId,
    );

    if (!this.emptyAttachment) {
      throw new Error('Mock#init must be called before starting the server');
    }

    const contactsAttachment = encryptAttachment(
      serializeContacts([
        ...contacts.map((device) => device.toContact()),
        ...contactsWithoutProfileKey.map((device) => device.toContact()),
      ]),
    );
    const contactsCDNKey = await this.storeAttachment(contactsAttachment.blob);
    debug('contacts cdn key', contactsCDNKey);
    if (this.emptyAttachment.attachmentIdentifier?.cdnKey != null) {
      debug('groups cdn key', this.emptyAttachment.attachmentIdentifier.cdnKey);
    }

    const primary = new PrimaryDevice(device, {
      profileName: profileName,
      contacts: attachmentToPointer(contactsCDNKey, contactsAttachment),
      trustRoot: this.trustRoot.getPublicKey(),
      serverPublicParams: this.zkSecret.getPublicParams(),

      generateNumber: this.generateNumber.bind(this),
      generatePni: this.generatePni.bind(this),
      changeDeviceNumber: this.changeDeviceNumber.bind(this),
      send: this.send.bind(this),
      getSenderCertificate: this.getSenderCertificate.bind(this, device),
      getDeviceByServiceId: this.getDeviceByServiceId.bind(this),
      issueExpiringProfileKeyCredential:
        this.issueExpiringProfileKeyCredential.bind(this),
      getGroup: this.getGroup.bind(this),
      createGroup: this.createGroup.bind(this),
      modifyGroup: this.modifyGroup.bind(this),
      waitForGroupUpdate: this.waitForGroupUpdate.bind(this),
      getStorageManifest: this.getStorageManifest.bind(this, device),
      getStorageItem: this.getStorageItem.bind(this, device),
      getAllStorageKeys: this.getAllStorageKeys.bind(this, device),
      waitForStorageManifest: this.waitForStorageManifest.bind(this, device),
      applyStorageWrite: this.applyStorageWrite.bind(this, device),
    });
    await primary.init();

    this.primaryDevices.set(primary.device.aci, primary);

    debug(
      'created primary device number=%s aci=%s',
      primary.device.number,
      primary.device.aci,
    );

    return primary;
  }

  public async createSecondaryDevice(primary: PrimaryDevice): Promise<Device> {
    const registrationId = generateRegistrationId();
    const pniRegistrationId = generateRegistrationId();

    const device = await this.registerDevice({
      primary: primary.device,
      registrationId,
      pniRegistrationId: primary.device.pni ? pniRegistrationId : undefined,
    });

    for (const serviceIdKind of [ServiceIdKind.ACI, ServiceIdKind.PNI]) {
      if (device.getServiceIdByKind(serviceIdKind) == null) {
        continue;
      }

      await this.updateDeviceKeys(
        device,
        serviceIdKind,
        await primary.generateKeys(device, serviceIdKind),
      );
    }

    primary.addSecondaryDevice(device);

    return device;
  }

  public unregister(
    primary: PrimaryDevice,
    serviceIdKind = ServiceIdKind.ACI,
  ): void {
    const serviceId = primary.device.getServiceIdByKind(serviceIdKind);
    if (serviceId == null) {
      return;
    }
    this.unregisteredServiceIds.add(serviceId);
  }

  public register(
    primary: PrimaryDevice,
    serviceIdKind = ServiceIdKind.ACI,
  ): void {
    const serviceId = primary.device.getServiceIdByKind(serviceIdKind);
    if (serviceId == null) {
      return;
    }
    this.unregisteredServiceIds.delete(serviceId);
  }

  public respondToChallengesWith(code = 413, data?: unknown): void {
    this.responseForChallenges = {
      code,
      data,
    };
  }

  public stopRespondingToChallenges(): void {
    this.responseForChallenges = undefined;
  }

  public getResponseForChallenges(): ChallengeResponse | undefined {
    return this.responseForChallenges;
  }

  public rateLimit({ source, target }: RateLimitOptions): void {
    this.rateLimitCountByPair.set(`${source}:${target}`, 0);
  }

  public stopRateLimiting({
    source,
    target,
  }: RateLimitOptions): number | undefined {
    const key: `${ServiceIdString}:${ServiceIdString}` = `${source}:${target}`;
    const existing = this.rateLimitCountByPair.get(key);
    this.rateLimitCountByPair.delete(key);
    return existing;
  }

  public async removeAllCDNAttachments(): Promise<void> {
    const { cdn3Path } = this.config;
    assert(cdn3Path, 'cdn3Path must be provided to store attachments');

    const dir = path.join(cdn3Path, 'attachments');
    await fsPromises.rm(dir, {
      recursive: true,
    });
  }

  public async storeAttachmentOnCdn(
    cdnNumber: number,
    cdnKey: string,
    data: Uint8Array<ArrayBuffer> | Readable,
  ): Promise<void> {
    assert.strictEqual(cdnNumber, 3, 'Only cdn 3 currently supported');
    const { cdn3Path } = this.config;
    assert(cdn3Path, 'cdn3Path must be provided to store attachments');

    const dir = path.join(cdn3Path, 'attachments');
    await fsPromises.mkdir(dir, {
      recursive: true,
    });
    await fsPromises.writeFile(path.join(dir, cdnKey), data);
  }

  public setWebsocketUpgradeResponseHeaders(
    headers: Record<string, string>,
  ): void {
    this.wsUpgradeResponseHeaders = headers;
  }

  public async storeBackupOnCdn(
    backupId: Uint8Array<ArrayBuffer>,
    data: Uint8Array<ArrayBuffer> | Readable,
  ): Promise<void> {
    const { cdn3Path } = this.config;
    assert(cdn3Path, 'cdn3Path must be provided to store attachments');

    const dir = path.join(
      cdn3Path,
      'backups',
      Buffer.from(backupId).toString('base64url'),
    );

    await fsPromises.mkdir(dir, {
      recursive: true,
    });
    await fsPromises.writeFile(path.join(dir, 'backup'), data);
  }

  //
  // Implement Server's abstract methods
  //

  public async getProvisioningResponse(
    id: ProvisionIdString,
    abortSignal?: AbortSignal,
  ): Promise<ProvisioningResponse> {
    const responseQueue = this.createQueue<PendingProvisionResponse>(
      'api/server/responseQueue',
    );
    const resultQueue = this.createQueue<Device>('api/server/resultQueue');

    const { promise, cancel } = this.provisionQueue.pushAndWait({
      complete: async (response) => {
        const { promise } = responseQueue.pushAndWait(response);
        await promise;

        return resultQueue.shift();
      },
    });

    const abortListener = () => {
      cancel();
    };
    abortSignal?.addEventListener('abort', abortListener);

    await promise;

    abortSignal?.removeEventListener('abort', abortListener);

    const {
      // tsdevice:/?uuid=<uuid>&pub_key=<base64>&capabilities=<...>
      provisionURL,
      primaryDevice,
    } = await responseQueue.shift();

    const { query } = parseURL(provisionURL, true);

    assert.strictEqual(query.uuid, id, 'id mismatch');
    if (query.pub_key == null || Array.isArray(query.pub_key)) {
      throw new Error('Expected `pub_key` in provision URL');
    }

    const publicKey = PublicKey.deserialize(
      Buffer.from(query.pub_key, 'base64'),
    );

    const aciIdentityKey = await primaryDevice.getIdentityKey(
      ServiceIdKind.ACI,
    );
    const pniIdentityKey = primaryDevice.device.pni
      ? await primaryDevice.getIdentityKey(ServiceIdKind.PNI)
      : undefined;
    const provisioningCode = await this.getProvisioningCode(
      id,
      primaryDevice.device.aci,
    );

    this.provisionResultQueueByCode.set(provisioningCode, {
      seenServiceIdKinds: new Set(),
      promiseQueue: resultQueue,
    });

    const envelopeData = Proto.ProvisionMessage.encode({
      aciIdentityKeyPrivate: aciIdentityKey.serialize(),
      aciIdentityKeyPublic: aciIdentityKey.getPublicKey().serialize(),
      pniIdentityKeyPrivate: pniIdentityKey?.serialize() ?? null,
      pniIdentityKeyPublic: pniIdentityKey?.getPublicKey().serialize() ?? null,
      number: primaryDevice.device.number ?? null,
      aciBinary: primaryDevice.device.aciRawUuid,
      pniBinary: primaryDevice.device.pniRawUuid ?? null,
      provisioningCode,
      profileKey: primaryDevice.profileKey.serialize(),
      userAgent: primaryDevice.userAgent,
      readReceipts: true,
      provisioningVersion: Proto.ProvisioningVersion.CURRENT,
      masterKey: primaryDevice.masterKey,
      ephemeralBackupKey: primaryDevice.ephemeralBackupKey ?? null,
      mediaRootBackupKey: primaryDevice.mediaRootBackupKey,
      accountEntropyPool: primaryDevice.accountEntropyPool,
      authCredentialSalt: primaryDevice.device.authCredentialSalt,
    });

    const { body, ephemeralKey } = encryptProvisionMessage(
      Buffer.from(envelopeData),
      publicKey,
    );

    const envelope = Proto.ProvisionEnvelope.encode({
      publicKey: ephemeralKey,
      body,
    });

    return { envelope: Buffer.from(envelope) };
  }

  public async handleMessage(
    source: Device | undefined,
    serviceIdKind: ServiceIdKind,
    envelopeType: EnvelopeType,
    target: Device,
    encrypted: Buffer<ArrayBuffer>,
    timestamp: bigint,
  ): Promise<void> {
    if (envelopeType !== EnvelopeType.SealedSender) {
      assert(source, 'No source for non-sealed sender envelope');
    }

    debug('got message for %s.%d', target.aci, target.deviceId);

    if (target.deviceId !== PRIMARY_DEVICE_ID) {
      if (target.isProvisioned) {
        let type: Proto.Envelope.Type;

        switch (envelopeType) {
          case EnvelopeType.CipherText:
            type = Proto.Envelope.Type.DOUBLE_RATCHET;
            break;
          case EnvelopeType.PreKey:
            type = Proto.Envelope.Type.PREKEY_MESSAGE;
            break;
          case EnvelopeType.SealedSender:
            type = Proto.Envelope.Type.UNIDENTIFIED_SENDER;
            break;
          case EnvelopeType.Plaintext:
            type = Proto.Envelope.Type.PLAINTEXT_CONTENT;
            break;
          default:
            throw new Error(`Unsupported envelope type: ${envelopeType}`);
        }
        const destinationServiceIdBinary =
          target.getServiceIdBinaryByKind(serviceIdKind);
        assert(
          destinationServiceIdBinary != null,
          `Missing destination service id for ${serviceIdKind}`,
        );
        void this.send(
          target,
          Buffer.from(
            Proto.Envelope.encode({
              type,
              sourceServiceIdBinary: source?.aciBinary ?? null,
              sourceDeviceId: source?.deviceId ?? null,
              destinationServiceIdBinary,
              serverTimestamp: timestamp,
              clientTimestamp: timestamp,
              content: encrypted,
              urgent: null,
              serverGuid: null,
              ephemeral: null,
              story: null,
              reportSpamToken: null,
              serverGuidBinary: null,
              updatedPniBinary: null,

              // Deprecated string fields
              sourceServiceId: null,
              destinationServiceId: null,
              updatedPni: null,
            }),
          ),
        );
      }
      return;
    }

    const primary = this.primaryDevices.get(target.aci);
    if (!primary) {
      debug('ignoring message, primary device not found');
      return;
    }

    await primary.handleEnvelope(
      source,
      serviceIdKind,
      envelopeType,
      encrypted,
    );
  }

  public isUnregistered(serviceId: ServiceIdString): boolean {
    return this.unregisteredServiceIds.has(serviceId);
  }

  public isSendRateLimited({
    source,
    target,
  }: IsSendRateLimitedOptions): boolean {
    const key: `${ServiceIdString}:${ServiceIdString}` = `${source}:${target}`;
    const existing = this.rateLimitCountByPair.get(key);
    if (existing === undefined) {
      return false;
    }

    const newValue = existing + 1;
    debug(
      'isSendRateLimited: source=%j target=%j count=%d',
      source,
      target,
      newValue,
    );
    this.rateLimitCountByPair.set(key, newValue);
    return true;
  }

  //
  // Override `Server`'s methods to automatically pass keys to primary
  // devices.
  //
  // TODO(indutny): use popSingleUseKey() perhaps?
  //

  public override async updateDeviceKeys(
    device: Device,
    serviceIdKind: ServiceIdKind,
    keys: DeviceKeys,
  ): Promise<void> {
    await super.updateDeviceKeys(device, serviceIdKind, keys);

    // Atomic linking updates only signed pre keys, and we should ignore it.
    if (!keys.preKeys?.length && !keys.kyberPreKeys?.length) {
      return;
    }

    const key = `${device.getServiceIdByKind(serviceIdKind)}.${device.getCheckedRegistrationId(serviceIdKind)}`;

    // Device is marked as provisioned only once we have its keys
    const resultQueue = this.provisionResultQueueByKey.get(key);
    if (!resultQueue) {
      return;
    }

    debug('updateDeviceKeys: got keys for', device.debugId, serviceIdKind);

    const { seenServiceIdKinds, promiseQueue } = resultQueue;

    assert(
      !seenServiceIdKinds.has(serviceIdKind),
      `Duplicate service id kind ${serviceIdKind} ` +
        `for device: ${device.debugId}`,
    );
    seenServiceIdKinds.add(serviceIdKind);
    if (
      !seenServiceIdKinds.has(ServiceIdKind.ACI) ||
      (device.pni && !seenServiceIdKinds.has(ServiceIdKind.PNI))
    ) {
      return;
    }

    this.provisionResultQueueByKey.delete(key);
    const { promise } = promiseQueue.pushAndWait(device);
    await promise;
  }

  public override async provisionDevice(
    options: ProvisionDeviceOptions,
  ): Promise<Device> {
    const { provisioningCode } = options;

    const queue = this.provisionResultQueueByCode.get(provisioningCode);
    assert(
      queue !== undefined,
      `Missing provision result queue for code: ${provisioningCode}`,
    );
    this.provisionResultQueueByCode.delete(provisioningCode);

    const device = await super.provisionDevice(options);

    for (const serviceIdKind of [ServiceIdKind.ACI, ServiceIdKind.PNI]) {
      const serviceId = device.getServiceIdByKind(serviceIdKind);
      if (serviceId == null) {
        continue;
      }
      const key = `${serviceId}.${device.getCheckedRegistrationId(serviceIdKind)}`;
      this.provisionResultQueueByKey.set(key, queue);
    }

    const primary = this.primaryDevices.get(device.aci);
    primary?.addSecondaryDevice(device);

    return device;
  }

  // Override `getStorageItems` to provide configurable limit for maximum
  // storage read keys.
  public override getStorageItems(
    device: Device,
    keys: ReadonlyArray<Buffer<ArrayBuffer>>,
  ): Array<Proto.StorageItem.Params> | undefined {
    if (
      this.config.maxStorageReadKeys !== undefined &&
      keys.length > this.config.maxStorageReadKeys
    ) {
      debug('getStorageItems: requested more than max keys', device.debugId);
      return undefined;
    }

    return super.getStorageItems(device, keys);
  }

  // Override updateGroup to notify about group modifications
  public override async modifyGroup(
    options: ModifyGroupOptions,
  ): Promise<ModifyGroupResult> {
    const { group } = options;
    debug('modifyGroup', group.id);

    const result = await super.modifyGroup(options);

    let queue = this.groupQueueById.get(group.id);
    if (!queue) {
      queue = this.createQueue('api/Server/modifyGroup');
      this.groupQueueById.set(group.id, queue);
    }

    queue.push(group.revision);

    return result;
  }

  protected override async onStorageManifestUpdate(
    device: Device,
    version: bigint,
  ): Promise<void> {
    debug('onStorageManifestUpdate', device.debugId);

    let queue = this.manifestQueueByAci.get(device.aci);
    if (!queue) {
      queue = this.createQueue('api/Server/onStorageManifestUpdate');
      this.manifestQueueByAci.set(device.aci, queue);
    }

    queue.push(version);
  }

  protected override async backupTransitAttachments(
    backupId: string,
    batch: BackupMediaBatch,
  ): Promise<Array<BackupMediaBatchResponse>> {
    const { cdn3Path } = this.config;
    assert(cdn3Path, 'cdn3Path must be provided to store attachments');

    const dir = path.join(cdn3Path, 'attachments');
    const mediaDir = path.join(cdn3Path, 'backups', backupId, 'media');

    await fsPromises.mkdir(mediaDir, {
      recursive: true,
    });

    return Promise.all(
      batch.items.map(async (item): Promise<BackupMediaBatchResponse> => {
        assert.strictEqual(item.sourceAttachment.cdn, 3, 'Invalid object CDN');
        const transitPath = path.join(dir, item.sourceAttachment.key);
        const finalPath = path.join(mediaDir, item.mediaId);

        // TODO(indutny): streams
        let data: Buffer<ArrayBuffer>;
        try {
          data = await fsPromises.readFile(transitPath);
        } catch (error) {
          assert(error instanceof Error);
          if ('code' in error && error.code === 'ENOENT') {
            return {
              mediaId: item.mediaId,
              result: 'sourceNotFound',
            };
          }
          throw error;
        }

        assert.strictEqual(
          data.byteLength,
          item.objectLength,
          'Invalid objectLength',
        );

        const reencrypted = encryptAttachment(data, {
          aesKey: item.encryptionKey,
          macKey: item.hmacKey,

          // Deterministic value
          iv: Buffer.alloc(16),
        });

        await fsPromises.writeFile(finalPath, reencrypted.blob);

        void this.onNewBackupMediaObject(backupId, {
          cdn: 3,
          mediaId: item.mediaId,
          objectLength: reencrypted.blob.length,
        });

        return {
          mediaId: item.mediaId,
          result: { cdn: 3 },
        };
      }),
    );
  }

  public async provideTransferArchive(
    device: Device,
    archive: TransferArchiveResponse,
  ): Promise<void> {
    const callbacks = this.transferCallbacksByDevice.get(device) ?? [];
    this.transferCallbacksByDevice.delete(device);

    this.transferArchiveByDevice.set(device, archive);
    for (const callback of callbacks) {
      callback(archive);
    }
  }

  public override async getTransferArchive(
    device: Device,
  ): Promise<TransferArchiveResponse> {
    const existing = this.transferArchiveByDevice.get(device);
    if (existing !== undefined) {
      return existing;
    }

    return new Promise((resolve) => {
      let list = this.transferCallbacksByDevice.get(device);
      if (list === undefined) {
        list = [];
        this.transferCallbacksByDevice.set(device, list);
      }
      list.push(resolve);
    });
  }

  //
  // Private
  //

  private createQueue<T>(name: string): PromiseQueue<T> {
    return new PromiseQueue({
      timeout: this.config.timeout,
      name,
    });
  }

  private async generateNumber(): Promise<string> {
    let number: string;
    do {
      number = generateRandomE164();
    } while (this.knownNumbers.has(number));
    this.knownNumbers.add(number);

    return number;
  }
}
