// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import crypto from 'crypto';
import {
  Aci,
  CiphertextMessageType,
  DecryptionErrorMessage,
  IdentityKeyPair,
  IdentityKeyStore,
  KEMKeyPair,
  KyberPreKeyRecord,
  KyberPreKeyStore as KyberPreKeyStoreBase,
  PlaintextContent,
  Pni,
  PreKeyBundle,
  PreKeyRecord,
  PreKeySignalMessage,
  PreKeyStore as PreKeyStoreBase,
  PrivateKey,
  ProtocolAddress,
  PublicKey,
  SenderCertificate,
  SenderKeyDistributionMessage,
  SenderKeyRecord,
  SenderKeyStore as SenderKeyStoreBase,
  ServiceId,
  SessionRecord,
  SessionStore as SessionStoreBase,
  SignalMessage,
  SignedPreKeyRecord,
  SignedPreKeyStore as SignedPreKeyStoreBase,
  Uuid,
} from '@signalapp/libsignal-client';
import * as SignalClient from '@signalapp/libsignal-client';
import { AccountEntropyPool } from '@signalapp/libsignal-client/dist/AccountKeys';
import createDebug from 'debug';
import {
  ClientZkProfileOperations,
  ExpiringProfileKeyCredentialResponse,
  GroupMasterKey,
  GroupSecretParams,
  ProfileKey,
  ProfileKeyCredentialPresentation,
  ProfileKeyCredentialRequest,
  ServerPublicParams,
} from '@signalapp/libsignal-client/zkgroup';

import { signalservice as Proto } from '../../protos/compiled';
import {
  AciString,
  DeviceId,
  KyberPreKey,
  PniString,
  PreKey,
  ServiceIdKind,
  ServiceIdString,
} from '../types';
import { Contact } from '../data/contacts';
import { Group as GroupData } from '../data/group';
import {
  decryptStorageItem,
  decryptStorageManifest,
  deriveAccessKey,
  deriveMasterKey,
  deriveStorageKey,
  encryptProfileName,
} from '../crypto';
import {
  EnvelopeType,
  ModifyGroupOptions,
  ModifyGroupResult,
  StorageWriteResult,
} from '../server/base';
import { ServerGroup } from '../server/group';
import {
  ChangeNumberOptions,
  Device,
  DeviceKeys,
  SingleUseKey,
} from '../data/device';
import { PromiseQueue, addressToString, generateRegistrationId } from '../util';
import { Group } from './group';
import { StorageState } from './storage-state';

const debug = createDebug('mock:primary-device');

export type Config = Readonly<{
  profileName: string;
  contacts: Proto.AttachmentPointer.Params;
  trustRoot: PublicKey;
  serverPublicParams: ServerPublicParams;

  // Server callbacks
  generateNumber: () => Promise<string>;
  generatePni: () => Promise<PniString>;
  changeDeviceNumber: (
    device: Device,
    options: ChangeNumberOptions,
  ) => Promise<void>;
  send: (device: Device, message: Buffer<ArrayBuffer>) => Promise<void>;
  getSenderCertificate: () => Promise<SenderCertificate>;
  getDeviceByServiceId: (
    serviceId: ServiceIdString,
    deviceId?: DeviceId,
  ) => Promise<Device | undefined>;
  issueExpiringProfileKeyCredential: (
    device: Device,
    request: ProfileKeyCredentialRequest,
  ) => Promise<Buffer<ArrayBuffer> | undefined>;

  getGroup: (
    publicParams: Uint8Array<ArrayBuffer>,
  ) => Promise<ServerGroup | undefined>;
  createGroup: (group: Proto.Group.Params) => Promise<ServerGroup>;
  modifyGroup: (options: ModifyGroupOptions) => Promise<ModifyGroupResult>;
  waitForGroupUpdate: (group: GroupData) => Promise<void>;

  getStorageManifest: () => Proto.StorageManifest.Params | undefined;
  getStorageItem: (key: Buffer<ArrayBuffer>) => Buffer<ArrayBuffer> | undefined;
  getAllStorageKeys: () => Array<Buffer<ArrayBuffer>>;
  waitForStorageManifest: (afterVersion?: bigint) => Promise<void>;
  applyStorageWrite: (
    operation: Proto.WriteOperation.Params,
    shouldNotify?: boolean,
  ) => Promise<StorageWriteResult>;
}>;

export type EncryptOptions = Readonly<{
  timestamp?: number;
  sealed?: boolean;
  serviceIdKind?: ServiceIdKind;
  updatedPni?: PniString;
  // Sender Key
  distributionId?: string;
  group?: Group;
  skipSkdmSend?: boolean;
}>;

export type EncryptTextOptions = EncryptOptions &
  Readonly<{
    withProfileKey?: boolean;
    withPniSignature?: boolean;
  }>;

export type CreateGroupOptions = Readonly<{
  title: string;
  members: ReadonlyArray<PrimaryDevice>;
}>;

export type SendUpdateToList = ReadonlyArray<
  Readonly<{
    device: Device;
    options?: EncryptOptions;
  }>
>;

export type GroupActionsOptions = Readonly<{
  timestamp?: number;
  sendUpdateTo?: SendUpdateToList;
}>;

export type InviteToGroupOptions = Readonly<
  GroupActionsOptions & {
    serviceIdKind?: ServiceIdKind;
  }
>;

export type AcceptPniInviteOptions = GroupActionsOptions;

export type SyncSentOptions = Readonly<{
  timestamp: number;
  destinationServiceId: ServiceIdString;
}>;

export type FetchStorageOptions = Readonly<{
  timestamp: number;
}>;

export type SendStickerPackSyncOptions = Readonly<{
  type: 'install' | 'remove';
  packId: Buffer<ArrayBuffer>;
  packKey: Buffer<ArrayBuffer>;
  timestamp?: number;
}>;

export type SyncReadMessage = Readonly<{
  senderAci: AciString;
  timestamp: number;
}>;

export type SyncReadOptions = Readonly<{
  timestamp?: number;
  messages: ReadonlyArray<SyncReadMessage>;
}>;

export enum ReceiptType {
  Delivery = 'Delivery',
  Read = 'Read',
}

export type ReceiptOptions = Readonly<{
  timestamp?: number;

  type: ReceiptType;
  messageTimestamps: ReadonlyArray<number>;
}>;

export type UnencryptedReceiptOptions = Readonly<{
  timestamp?: number;
  messageTimestamp: number;
}>;

export type ContentQueueEntry = Readonly<{
  source: Device;
  serviceIdKind: ServiceIdKind;
  envelopeType: EnvelopeType;
  content: Proto.Content;
}>;

export type DecryptionErrorQueueEntry = ContentQueueEntry &
  Readonly<{
    timestamp: number;
    ratchetKey: PublicKey | undefined;
    senderDevice: number;
  }>;

export type MessageQueueEntry = ContentQueueEntry &
  Readonly<{
    body: string;
    dataMessage: Proto.DataMessage;
  }>;

export type ReceiptQueueEntry = ContentQueueEntry &
  Readonly<{
    receiptMessage: Proto.ReceiptMessage;
  }>;

export type StoryQueueEntry = ContentQueueEntry &
  Readonly<{
    storyMessage: Proto.StoryMessage;
  }>;

export type EditMessageQueueEntry = ContentQueueEntry &
  Readonly<{
    editMessage: Proto.EditMessage;
  }>;

export type SyncMessageQueueEntry = Readonly<{
  source: Device;
  syncMessage: Proto.SyncMessage;
}>;

export type PrepareChangeNumberEntry = Readonly<{
  device: Device;
  envelope: Buffer<ArrayBuffer>;
}>;

export type PrepareChangeNumberResult = ReadonlyArray<PrepareChangeNumberEntry>;

enum SyncState {
  Empty = 0,
  Contacts = 1 << 0,
  Groups = 1 << 1,
  Blocked = 1 << 2,
  Configuration = 1 << 3,
  Keys = 1 << 4,

  Complete = Contacts | Blocked | Configuration,
}

type SyncEntry = {
  state: SyncState;
  onComplete: Promise<void>;
  complete: () => void;
};

type DecryptResult = Readonly<{
  unsealedSource: Device;
  content: Proto.Content;
  envelopeType: EnvelopeType;
}>;

export const EMPTY_GROUP_ACTIONS: Proto.GroupChange.Actions.Params = {
  sourceUserId: null,
  version: null,
  groupId: null,
  addMembers: null,
  deleteMembers: null,
  modifyMemberRoles: null,
  modifyMemberProfileKeys: null,
  addMembersPendingProfileKey: null,
  deleteMembersPendingProfileKey: null,
  promoteMembersPendingProfileKey: null,
  modifyTitle: null,
  modifyAvatar: null,
  modifyDisappearingMessageTimer: null,
  modifyAttributesAccess: null,
  modifyMemberAccess: null,
  modifyAddFromInviteLinkAccess: null,
  addMembersPendingAdminApproval: null,
  deleteMembersPendingAdminApproval: null,
  promoteMembersPendingAdminApproval: null,
  modifyInviteLinkPassword: null,
  modifyDescription: null,
  modifyAnnouncementsOnly: null,
  addMembersBanned: null,
  deleteMembersBanned: null,
  promoteMembersPendingPniAciProfileKey: null,
  modifyMemberLabels: null,
  modifyMemberLabelAccess: null,
  terminateGroup: null,
};

export const EMPTY_DATA_MESSAGE: Proto.DataMessage.Params = {
  body: null,
  attachments: null,
  groupV2: null,
  flags: null,
  expireTimer: null,
  expireTimerVersion: null,
  profileKey: null,
  timestamp: null,
  quote: null,
  contact: null,
  preview: null,
  sticker: null,
  requiredProtocolVersion: null,
  isViewOnce: null,
  reaction: null,
  delete: null,
  bodyRanges: null,
  groupCallUpdate: null,
  payment: null,
  storyContext: null,
  giftBadge: null,
  pollCreate: null,
  pollTerminate: null,
  pollVote: null,
  pinMessage: null,
  unpinMessage: null,
  adminDelete: null,
};

class SignedPreKeyStore extends SignedPreKeyStoreBase {
  private lastId = 0;
  private readonly records = new Map<number, SignedPreKeyRecord>();

  async saveSignedPreKey(
    id: number,
    record: SignedPreKeyRecord,
  ): Promise<void> {
    this.records.set(id, record);
  }

  async getSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
    const result = this.records.get(id);
    if (!result) {
      throw new Error(`Signed pre key not found: ${id}`);
    }
    return result;
  }

  public getNextId(): number {
    this.lastId += 1;

    // Note: intentionally starting from 1
    return this.lastId;
  }
}

class PreKeyStore extends PreKeyStoreBase {
  private lastId = 0;
  private readonly records = new Map<number, PreKeyRecord>();

  async savePreKey(id: number, record: PreKeyRecord): Promise<void> {
    this.records.set(id, record);
  }

  async getPreKey(id: number): Promise<PreKeyRecord> {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Pre key not found: ${id}`);
    }
    return record;
  }

  async removePreKey(id: number): Promise<void> {
    this.records.delete(id);
  }

  public getNextId(): number {
    this.lastId += 1;

    // Note: intentionally starting from 1
    return this.lastId;
  }
}

class KyberPreKeyStore extends KyberPreKeyStoreBase {
  private lastId = 0;
  private readonly records = new Map<
    number,
    {
      isLastResort: boolean;
      record: KyberPreKeyRecord;
    }
  >();

  async saveKyberPreKey(id: number, record: KyberPreKeyRecord): Promise<void> {
    if (this.records.get(id)) {
      throw new Error(`saveKyberPreKey: id ${id} has already been used`);
    }
    this.records.set(id, { isLastResort: false, record });
  }

  async getKyberPreKey(id: number): Promise<KyberPreKeyRecord> {
    const item = this.records.get(id);
    if (!item?.record) {
      throw new Error(`Kyber pre key not found: ${id}`);
    }
    return item.record;
  }

  async markKyberPreKeyUsed(id: number): Promise<void> {
    const item = this.records.get(id);
    if (!item || item.isLastResort) {
      return;
    }
    this.records.delete(id);
  }

  async saveLastResortKey(
    id: number,
    record: KyberPreKeyRecord,
  ): Promise<void> {
    if (this.records.get(id)) {
      throw new Error(`saveLastResortKey: id ${id} has already been used`);
    }
    this.records.set(id, { isLastResort: true, record });
  }

  public getNextId(): number {
    this.lastId += 1;

    // Note: intentionally starting from 1
    return this.lastId;
  }
}

class IdentityStore extends IdentityKeyStore {
  private knownIdentities = new Map<string, PublicKey>();

  constructor(
    private privateKey: PrivateKey,
    private registrationId: number,
  ) {
    super();
  }

  async getIdentityKey(): Promise<PrivateKey> {
    return this.privateKey;
  }

  async getLocalRegistrationId(): Promise<number> {
    return this.registrationId;
  }

  async saveIdentity(
    name: ProtocolAddress,
    key: PublicKey,
  ): Promise<SignalClient.IdentityChange> {
    this.knownIdentities.set(addressToString(name), key);
    return SignalClient.IdentityChange.ReplacedExisting;
  }

  async isTrustedIdentity(): Promise<boolean> {
    // We trust everyone
    return true;
  }

  async getIdentity(name: ProtocolAddress): Promise<PublicKey | null> {
    return this.knownIdentities.get(addressToString(name)) ?? null;
  }

  // Not part of IdentityKeyStore API

  async updateIdentityKey(privateKey: PrivateKey): Promise<void> {
    this.privateKey = privateKey;
  }

  async updateLocalRegistrationId(registrationId: number): Promise<void> {
    this.registrationId = registrationId;
  }
}

export class SessionStore extends SessionStoreBase {
  private readonly sessions = new Map<string, SessionRecord>();

  async saveSession(
    name: ProtocolAddress,
    record: SessionRecord,
  ): Promise<void> {
    this.sessions.set(addressToString(name), record);
  }

  async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
    return this.sessions.get(addressToString(name)) ?? null;
  }

  async getExistingSessions(
    addresses: Array<ProtocolAddress>,
  ): Promise<Array<SessionRecord>> {
    return addresses.map((name) => {
      const existing = this.sessions.get(addressToString(name));
      if (!existing) {
        throw new Error('Existing session not found');
      }
      return existing;
    });
  }
}

export class SenderKeyStore extends SenderKeyStoreBase {
  private readonly keys = new Map<string, SenderKeyRecord>();

  async saveSenderKey(
    sender: ProtocolAddress,
    distributionId: Uuid,
    record: SenderKeyRecord,
  ): Promise<void> {
    this.keys.set(`${sender.toString()}.${distributionId}`, record);
  }
  async getSenderKey(
    sender: ProtocolAddress,
    distributionId: Uuid,
  ): Promise<SenderKeyRecord | null> {
    const key = this.keys.get(`${sender.toString()}.${distributionId}`);
    return key ?? null;
  }
}

export class PrimaryDevice {
  private isInitialized = false;
  private lockPromise: Promise<void> | undefined;

  private readonly syncStates = new WeakMap<Device, SyncEntry>();
  private readonly storageKey: Buffer<ArrayBuffer>;
  private readonly privateKey = PrivateKey.generate();
  private pniPrivateKey = PrivateKey.generate();
  private readonly contactsBlob: Proto.AttachmentPointer.Params;
  private privSenderCertificate: SenderCertificate | undefined;
  private readonly decryptionErrorQueue =
    new PromiseQueue<DecryptionErrorQueueEntry>({
      name: 'PrimaryDevice.decryptionErrorQueue',
    });
  private readonly messageQueue = new PromiseQueue<MessageQueueEntry>({
    name: 'PrimaryDevice.messageQueue',
  });
  private readonly receiptQueue = new PromiseQueue<ReceiptQueueEntry>({
    name: 'PrimaryDevice.receiptQueue',
  });
  private readonly storyQueue = new PromiseQueue<StoryQueueEntry>({
    name: 'PrimaryDevice.storyQueue',
  });
  private readonly editMessageQueue = new PromiseQueue<EditMessageQueueEntry>({
    name: 'PrimaryDevice.editMessageQueue',
  });
  private readonly syncMessageQueue = new PromiseQueue<SyncMessageQueueEntry>({
    name: 'PrimaryDevice.syncMessageQueue',
  });
  private privPniPublicKey = this.pniPrivateKey.getPublicKey();

  // Various stores
  private readonly signedPreKeys = new Map<ServiceIdKind, SignedPreKeyStore>();
  private readonly preKeys = new Map<ServiceIdKind, PreKeyStore>();
  private readonly kyberPreKeys = new Map<ServiceIdKind, KyberPreKeyStore>();
  private readonly sessions = new SessionStore();
  private readonly senderKeys = new Map<ServiceIdKind, SenderKeyStore>();
  private readonly identity = new Map<ServiceIdKind, IdentityStore>();

  public readonly publicKey = this.privateKey.getPublicKey();
  public readonly profileKey: ProfileKey;
  public readonly profileName: string;
  public readonly secondaryDevices = new Array<Device>();
  public readonly accountEntropyPool = AccountEntropyPool.generate();
  public readonly masterKey = deriveMasterKey(this.accountEntropyPool);
  public readonly mediaRootBackupKey = crypto.randomBytes(32);
  public readonly authCredentialSalt = crypto.randomBytes(16);

  // Forwarded in provisioning envelope
  public ephemeralBackupKey: Buffer<ArrayBuffer> | undefined;

  // Overridable to test legacy encryption modes
  public storageRecordIkm: Buffer<ArrayBuffer> | undefined =
    crypto.randomBytes(32);

  // TODO(indutny): make primary device type configurable
  public readonly userAgent = 'OWI';

  constructor(
    public readonly device: Device,
    private readonly config: Config,
  ) {
    for (const serviceIdKind of [ServiceIdKind.ACI, ServiceIdKind.PNI]) {
      const serviceId = device.getServiceIdByKind(serviceIdKind);
      if (serviceId == null) {
        continue;
      }

      this.identity.set(
        serviceIdKind,
        new IdentityStore(
          serviceIdKind === ServiceIdKind.ACI
            ? this.privateKey
            : this.pniPrivateKey,
          this.device.getCheckedRegistrationId(serviceIdKind),
        ),
      );

      this.preKeys.set(serviceIdKind, new PreKeyStore());
      this.kyberPreKeys.set(serviceIdKind, new KyberPreKeyStore());
      this.signedPreKeys.set(serviceIdKind, new SignedPreKeyStore());
      this.senderKeys.set(serviceIdKind, new SenderKeyStore());
    }

    this.contactsBlob = this.config.contacts;
    this.profileName = config.profileName;

    this.profileKey = new ProfileKey(crypto.randomBytes(32));
    this.storageKey = deriveStorageKey(this.masterKey);

    this.device.profileName = encryptProfileName(
      this.profileKey.serialize(),
      this.profileName,
    );
  }

  public async init(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Already initialized');
    }

    for (const serviceIdKind of [ServiceIdKind.ACI, ServiceIdKind.PNI]) {
      const identity = this.identity.get(serviceIdKind);
      if (identity == null) {
        continue;
      }

      const address = this.device.getAddressByKind(serviceIdKind);
      assert(address != null, 'Expected address for present identity');

      await identity.saveIdentity(address, this.getPublicKey(serviceIdKind));
      await this.device.setKeys(
        serviceIdKind,
        await this.generateKeys(this.device, serviceIdKind),
      );
    }

    this.privSenderCertificate = await this.config.getSenderCertificate();

    this.device.profileKeyCommitment = this.profileKey.getCommitment(
      Aci.parseFromServiceIdString(this.device.aci),
    );
    this.device.accessKey = deriveAccessKey(this.profileKey.serialize());

    this.isInitialized = true;
  }

  public toContact(): Contact {
    return {
      aciBinary: this.device.aciRawUuid,
      number: this.device.number,
      profileName: this.profileName,
    };
  }

  public addSecondaryDevice(device: Device): void {
    this.secondaryDevices.push(device);

    device.profileName = this.device.profileName;
    device.profileKeyCommitment = this.device.profileKeyCommitment;
    device.accessKey = this.device.accessKey;
  }

  //
  // Keys
  //

  public async generateKeys(
    device: Device,
    serviceIdKind: ServiceIdKind,
  ): Promise<
    DeviceKeys & {
      // Note: these records are only used in the PNP change number scenario
      signedPreKeyRecord: SignedPreKeyRecord;
      lastResortKeyRecord: KyberPreKeyRecord;
    }
  > {
    const isPrimary = device === this.device;

    const signedPreKey = PrivateKey.generate();
    const signedPreKeySig = this.getPrivateKey(serviceIdKind).sign(
      signedPreKey.getPublicKey().serialize(),
    );
    const signedPreKeyId =
      this.signedPreKeys.get(serviceIdKind)?.getNextId() ?? 1;
    const signedPreKeyRecord = SignedPreKeyRecord.new(
      signedPreKeyId,
      Date.now(),
      signedPreKey.getPublicKey(),
      signedPreKey,
      signedPreKeySig,
    );
    if (isPrimary) {
      await this.signedPreKeys
        .get(serviceIdKind)
        ?.saveSignedPreKey(signedPreKeyId, signedPreKeyRecord);
    }

    const lastResortKeyId =
      this.kyberPreKeys.get(serviceIdKind)?.getNextId() ?? 1;
    const lastResortKeyRecord = this.generateKyberPreKey(
      lastResortKeyId,
      serviceIdKind,
    );
    if (isPrimary) {
      await this.kyberPreKeys
        .get(serviceIdKind)
        ?.saveLastResortKey(lastResortKeyId, lastResortKeyRecord);
    }

    return {
      identityKey: this.getPublicKey(serviceIdKind),
      signedPreKey: {
        keyId: signedPreKeyId,
        publicKey: signedPreKey.getPublicKey(),
        signature: Buffer.from(signedPreKeySig),
      },
      lastResortKey: {
        keyId: lastResortKeyId,
        publicKey: lastResortKeyRecord.publicKey(),
        signature: Buffer.from(lastResortKeyRecord.signature()),
      },
      preKeyIterator: this.getPreKeyIterator(device, serviceIdKind),
      kyberPreKeyIterator: this.getKyberPreKeyIterator(device, serviceIdKind),

      signedPreKeyRecord,
      lastResortKeyRecord,
    };
  }

  private async *getPreKeyIterator(
    device: Device,
    serviceIdKind: ServiceIdKind,
  ): AsyncIterator<PreKey, undefined> {
    const preKeyStore = this.preKeys.get(serviceIdKind);
    assert.ok(preKeyStore, 'Missing preKey store');

    const isPrimary = device === this.device;
    if (!isPrimary) {
      return;
    }

    while (true) {
      const preKey = PrivateKey.generate();
      const publicKey = preKey.getPublicKey();
      const keyId = preKeyStore.getNextId();

      const record = PreKeyRecord.new(keyId, publicKey, preKey);
      await preKeyStore.savePreKey(keyId, record);

      yield { keyId, publicKey };
    }
  }

  private generateKyberPreKey(
    keyId: number,
    serviceIdKind: ServiceIdKind,
  ): KyberPreKeyRecord {
    const kyberPreKey = KEMKeyPair.generate();
    const kyberPreKeySig = this.getPrivateKey(serviceIdKind).sign(
      kyberPreKey.getPublicKey().serialize(),
    );
    const kyberPreKeyRecord = KyberPreKeyRecord.new(
      keyId,
      Date.now(),
      kyberPreKey,
      kyberPreKeySig,
    );

    return kyberPreKeyRecord;
  }

  private async *getKyberPreKeyIterator(
    device: Device,
    serviceIdKind: ServiceIdKind,
  ): AsyncIterator<KyberPreKey, undefined> {
    const kyberPreKeyStore = this.kyberPreKeys.get(serviceIdKind);
    assert.ok(kyberPreKeyStore, 'Missing kyberPreKeyStore store');

    const isPrimary = device === this.device;
    if (!isPrimary) {
      return;
    }

    while (true) {
      const keyId = kyberPreKeyStore.getNextId();
      const record = this.generateKyberPreKey(keyId, serviceIdKind);

      await kyberPreKeyStore.saveKyberPreKey(keyId, record);

      yield {
        keyId,
        publicKey: record.publicKey(),
        signature: Buffer.from(record.signature()),
      };
    }
  }

  public async getIdentityKey(
    serviceIdKind: ServiceIdKind,
  ): Promise<PrivateKey> {
    const identity = this.identity.get(serviceIdKind);
    assert.ok(identity);
    return identity.getIdentityKey();
  }

  public getPublicKey(serviceIdKind: ServiceIdKind): PublicKey {
    switch (serviceIdKind) {
      case ServiceIdKind.ACI:
        return this.publicKey;
      case ServiceIdKind.PNI:
        return this.privPniPublicKey;
    }
  }

  public async addSingleUseKey(
    target: Device,
    key: SingleUseKey,
    serviceIdKind = ServiceIdKind.ACI,
  ): Promise<void> {
    assert.ok(this.isInitialized, 'Not initialized');
    debug('adding singleUseKey for', target.debugId);

    // Outgoing stores
    const identity = this.identity.get(ServiceIdKind.ACI);
    assert(identity, 'Should have an ACI identity');

    const localAddress = this.device.address;

    const address = target.getAddressByKind(serviceIdKind);
    assert(address, `Missing address for ${serviceIdKind}`);
    await identity.saveIdentity(address, key.identityKey);

    const bundle = PreKeyBundle.new(
      target.getCheckedRegistrationId(serviceIdKind),
      target.deviceId,
      key.preKey === undefined ? null : key.preKey.keyId,
      key.preKey === undefined ? null : key.preKey.publicKey,
      key.signedPreKey.keyId,
      key.signedPreKey.publicKey,
      key.signedPreKey.signature,
      key.identityKey,
      key.pqPreKey.keyId,
      key.pqPreKey.publicKey,
      key.pqPreKey.signature,
    );
    await SignalClient.processPreKeyBundle(
      bundle,
      address,
      localAddress,
      this.sessions,
      identity,
    );
  }

  //
  // Groups
  //

  public async getAllGroups(
    storage: StorageState,
  ): Promise<ReadonlyArray<Group>> {
    const records = storage.getAllGroupRecords();

    return Promise.all(
      records.map(async ({ record }) => {
        const { groupV2 } = record;
        const { masterKey } = groupV2;
        assert.ok(masterKey, 'Group v2 record without master key');

        const secretParams = GroupSecretParams.deriveFromMasterKey(
          new GroupMasterKey(Buffer.from(masterKey)),
        );
        const publicParams = secretParams.getPublicParams().serialize();

        const serverGroup = await this.config.getGroup(publicParams);
        assert.ok(
          serverGroup,
          `Group not found: ${Buffer.from(publicParams).toString('base64')}`,
        );

        return new Group({
          secretParams,
          groupState: serverGroup.state,
        });
      }),
    );
  }

  public async createGroup({
    title,
    members: memberDevices,
  }: CreateGroupOptions): Promise<Group> {
    const groupParams = GroupSecretParams.generate();

    const members = await Promise.all(
      memberDevices.map(async (member) => {
        const presentation =
          await member.getProfileKeyPresentation(groupParams);

        return {
          aci: member.device.aci,
          profileKey: member.profileKey,
          presentation,
          joinedAtVersion: 0n,
        };
      }),
    );

    const clientGroup = Group.fromConfig({
      secretParams: groupParams,

      title,
      members,
    });

    await this.config.createGroup(clientGroup.state);

    return clientGroup;
  }

  public async waitForGroupUpdate(group: Group): Promise<Group> {
    await this.config.waitForGroupUpdate(group);

    const publicParams = group.publicParams.serialize();
    const serverGroup = await this.config.getGroup(publicParams);
    assert.ok(serverGroup, `Group not found: ${group.id}`);

    return new Group({
      secretParams: group.secretParams,
      groupState: serverGroup.state,
    });
  }

  async #modifyGroup(options: {
    group: Group;
    actions: Proto.GroupChange.Actions.Params;
    timestamp: number;
    sendUpdateTo: SendUpdateToList;
  }) {
    const { group, actions, timestamp, sendUpdateTo } = options;

    const serverGroup = await this.config.getGroup(
      group.publicParams.serialize(),
    );
    assert(serverGroup !== undefined, 'Group does not exist on server');

    const { pni } = this.device;
    const modifyResult = await this.config.modifyGroup({
      group: serverGroup,
      actions: {
        ...actions,
        version: group.revision + 1,
      },
      aciCiphertext: group.encryptServiceId(this.device.aci),
      pniCiphertext: pni ? group.encryptServiceId(pni) : undefined,
    });

    assert(!modifyResult.conflict, 'Group update conflict!');

    const updatedGroup = new Group({
      secretParams: group.secretParams,
      groupState: serverGroup.state,
    });

    if (sendUpdateTo.length) {
      const groupV2 = {
        ...updatedGroup.toContext(),
        groupChange: Proto.GroupChange.encode(modifyResult.signedChange),
      };

      await Promise.all(
        sendUpdateTo.map(async ({ device, options }) => {
          const sync = device.aci === this.device.aci;

          const encryptOptions = {
            timestamp,
            ...options,
          };

          const dataMessage: Proto.DataMessage.Params = {
            ...EMPTY_DATA_MESSAGE,
            groupV2,
            timestamp: BigInt(encryptOptions.timestamp),
          };

          const syncMessage: Proto.SyncMessage.Params = {
            content: {
              sent: {
                timestamp: BigInt(timestamp),
                message: dataMessage,
                destinationServiceIdBinary: device.aciBinary,
                destinationE164: null,
                destinationServiceId: null,
                expirationStartTimestamp: null,
                unidentifiedStatus: null,
                isRecipientUpdate: null,
                storyMessage: null,
                storyMessageRecipients: null,
                editMessage: null,
              },
            },
            read: null,
            stickerPackOperation: null,
            viewed: null,
            padding: null,
          };

          const content: Proto.Content.Params = {
            content: sync ? { syncMessage } : { dataMessage },
            pniSignatureMessage: null,
            senderKeyDistributionMessage: null,
          };

          const envelope = await this.encryptContent(
            device,
            content,
            encryptOptions,
          );
          await this.config.send(device, envelope);
        }),
      );
    }

    return updatedGroup;
  }

  public async inviteToGroup(
    group: Group,
    invitee: Device,
    {
      timestamp = Date.now(),
      serviceIdKind = ServiceIdKind.ACI,
      sendUpdateTo = [{ device: invitee, options: { serviceIdKind } }],
    }: InviteToGroupOptions = {},
  ): Promise<Group> {
    const targetServiceId = invitee.getServiceIdByKind(serviceIdKind);
    assert(
      targetServiceId != null,
      `Missing target service id for ${serviceIdKind}`,
    );
    const userId = group.encryptServiceId(targetServiceId);

    return this.#modifyGroup({
      group,
      actions: {
        ...EMPTY_GROUP_ACTIONS,
        addMembersPendingProfileKey: [
          {
            added: {
              member: {
                userId,
                role: Proto.Member.Role.DEFAULT,
                profileKey: null,
                presentation: null,
                joinedAtVersion: null,
                labelEmoji: null,
                labelString: null,
              },
              addedByUserId: null,
              timestamp: null,
            },
          },
        ],
      },
      timestamp,
      sendUpdateTo,
    });
  }

  public async acceptPniInvite(
    group: Group,
    { timestamp = Date.now(), sendUpdateTo = [] }: AcceptPniInviteOptions = {},
  ): Promise<Group> {
    const presentation = await this.getProfileKeyPresentation(
      group.secretParams,
    );

    return this.#modifyGroup({
      group,
      actions: {
        ...EMPTY_GROUP_ACTIONS,
        promoteMembersPendingPniAciProfileKey: [
          {
            presentation: presentation.serialize(),
            userId: null,
            pni: null,
            profileKey: null,
          },
        ],
      },
      timestamp,
      sendUpdateTo,
    });
  }

  public async modifyGroupDisappearingMessageTimer(
    group: Group,
    disappearingMessagesDuration: number,
    { timestamp = Date.now(), sendUpdateTo = [] }: GroupActionsOptions = {},
  ): Promise<Group> {
    return this.#modifyGroup({
      group,
      actions: {
        ...EMPTY_GROUP_ACTIONS,
        modifyDisappearingMessageTimer: {
          timer: group.encryptBlob({
            content: { disappearingMessagesDuration },
          }),
        },
      },
      timestamp,
      sendUpdateTo,
    });
  }

  //
  // Storage Service
  //

  public async waitForStorageState({
    after,
    predicate,
  }: {
    after?: StorageState;
    // Note: predicate runs on the current state, not on previous intermediate states
    predicate?: (state: StorageState) => boolean;
  } = {}): Promise<StorageState> {
    let afterVersion = after?.version;

    while (true) {
      debug(
        'waiting for storage manifest for device=%s after version=%d predicate=%s',
        this.device.debugId,
        afterVersion,
        predicate !== undefined,
      );

      await this.config.waitForStorageManifest(afterVersion);

      const state = await this.getStorageState();
      assert(state, 'Missing storage state');

      if (predicate !== undefined && !predicate(state)) {
        debug(
          'storage manifest for device=%s version=%d did not match predicate',
          this.device.debugId,
          state.version,
        );
        afterVersion = state.version;
        continue;
      }

      debug(
        'got storage manifest for device=%s version=%d',
        this.device.debugId,
        state.version,
      );

      return state;
    }
  }

  public async getStorageState(): Promise<StorageState | undefined> {
    const manifest = this.config.getStorageManifest();
    if (!manifest) {
      return undefined;
    }

    return this.convertManifestToStorageState(manifest);
  }

  public async expectStorageState(reason: string): Promise<StorageState> {
    const state = await this.getStorageState();
    if (!state) {
      throw new Error(`expectStorageState: no storage state, ${reason}`);
    }

    return state;
  }

  public async setStorageState(
    state: StorageState,
    previousState?: StorageState,
  ): Promise<StorageState> {
    const writeOperation = state.createWriteOperation({
      storageKey: this.storageKey,
      recordIkm: this.storageRecordIkm,
      previous: previousState,
    });
    assert(writeOperation.manifest, 'write operation without manifest');

    const { updated, error } = await this.config.applyStorageWrite(
      writeOperation,
      false,
    );
    if (!updated) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`setStorageState: failed to update, ${error}`);
    }

    return this.convertManifestToStorageState(writeOperation.manifest);
  }

  public async getOrphanedStorageKeys(): Promise<Array<Buffer<ArrayBuffer>>> {
    const manifest = this.config.getStorageManifest();
    if (!manifest) {
      return [];
    }

    const state = this.convertManifestToStorageState(manifest);
    const keys = this.config.getAllStorageKeys();

    return keys.filter((key) => !state.hasKey(key));
  }

  //
  // Sync
  //

  // TODO(indutny): timeout
  public async waitForSync(secondaryDevice: Device): Promise<void> {
    debug('waiting for sync with %s', secondaryDevice.debugId);
    const { onComplete } = this.getSyncState(secondaryDevice);

    await onComplete;
  }

  public resetSyncState(secondaryDevice: Device): void {
    this.syncStates.delete(secondaryDevice);
  }

  //
  // Receive/Send
  //

  public async handleEnvelope(
    source: Device | undefined,
    serviceIdKind: ServiceIdKind,
    envelopeType: EnvelopeType,
    encrypted: Buffer<ArrayBuffer>,
  ): Promise<void> {
    const {
      unsealedSource,
      content,
      envelopeType: unsealedType,
    } = await this.lock(async () => {
      return this.decrypt(source, serviceIdKind, envelopeType, encrypted);
    });

    let handled = true;
    if (content.content?.decryptionErrorMessage) {
      assert.strictEqual(
        serviceIdKind,
        ServiceIdKind.ACI,
        'Got sync message on PNI',
      );
      this.handleResendRequest(
        unsealedSource,
        serviceIdKind,
        unsealedType,
        content,
        content.content.decryptionErrorMessage,
      );
    } else if (content.content?.syncMessage) {
      assert.strictEqual(
        serviceIdKind,
        ServiceIdKind.ACI,
        'Got sync message on PNI',
      );
      await this.handleSync(unsealedSource, content.content.syncMessage);
    } else if (content.content?.dataMessage) {
      this.handleDataMessage(
        unsealedSource,
        serviceIdKind,
        unsealedType,
        content,
        content.content.dataMessage,
      );
    } else if (content.content?.storyMessage) {
      this.handleStoryMessage(
        unsealedSource,
        serviceIdKind,
        unsealedType,
        content,
        content.content.storyMessage,
      );
    } else if (content.content?.editMessage) {
      this.handleEditMessage(
        unsealedSource,
        serviceIdKind,
        unsealedType,
        content,
        content.content.editMessage,
      );
    } else if (content.content?.receiptMessage) {
      this.handleReceiptMessage(
        unsealedSource,
        serviceIdKind,
        unsealedType,
        content,
        content.content.receiptMessage,
      );
    } else {
      handled = false;
    }

    const { senderKeyDistributionMessage } = content;
    if (
      senderKeyDistributionMessage != null &&
      senderKeyDistributionMessage.length > 0
    ) {
      handled = true;
      await this.processSenderKeyDistribution(
        unsealedSource,
        senderKeyDistributionMessage,
      );
    }

    if (!handled) {
      debug('unsupported message', content);
    }
  }

  public async encryptText(
    target: Device,
    text: string,
    options: EncryptTextOptions = {},
  ): Promise<Buffer<ArrayBuffer>> {
    const encryptOptions = {
      timestamp: Date.now(),
      ...options,
    };

    let pniSignatureMessage: Proto.PniSignatureMessage.Params | null = null;
    if (options.withPniSignature) {
      const pniPrivate = this.getPrivateKey(ServiceIdKind.PNI);
      const pniPublic = this.getPublicKey(ServiceIdKind.PNI);
      const aciPublic = this.getPublicKey(ServiceIdKind.ACI);

      const pniIdentity = new IdentityKeyPair(pniPublic, pniPrivate);

      const signature = pniIdentity.signAlternateIdentity(aciPublic);

      const { pni } = this.device;
      assert(pni, 'must have pni for pni signature');
      pniSignatureMessage = {
        pni: Pni.parseFromServiceIdString(pni).getRawUuidBytes(),
        signature,
      };
    }

    const content: Proto.Content.Params = {
      content: {
        dataMessage: {
          ...EMPTY_DATA_MESSAGE,
          groupV2: options.group?.toContext() ?? null,
          body: text,
          profileKey: options.withProfileKey
            ? this.profileKey.serialize()
            : null,
          timestamp: BigInt(encryptOptions.timestamp),
        },
      },
      pniSignatureMessage,
      senderKeyDistributionMessage: null,
    };
    return this.encryptContent(target, content, encryptOptions);
  }

  public async encryptSyncSent(
    target: Device,
    text: string,
    options: SyncSentOptions,
  ): Promise<Buffer<ArrayBuffer>> {
    const dataMessage: Proto.DataMessage.Params = {
      ...EMPTY_DATA_MESSAGE,
      body: text,
      timestamp: BigInt(options.timestamp),
    };

    const content: Proto.Content.Params = {
      content: {
        syncMessage: {
          content: {
            sent: {
              destinationServiceIdBinary: ServiceId.parseFromServiceIdString(
                options.destinationServiceId,
              ).getServiceIdBinary(),
              timestamp: BigInt(options.timestamp),
              message: dataMessage,
              destinationE164: null,
              unidentifiedStatus: null,
              isRecipientUpdate: null,
              expirationStartTimestamp: null,
              storyMessage: null,
              storyMessageRecipients: null,
              editMessage: null,

              destinationServiceId: null,
            },
          },
          stickerPackOperation: null,
          read: null,
          viewed: null,
          padding: null,
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };
    return this.encryptContent(target, content, options);
  }

  public async encryptSyncRead(
    target: Device,
    options: SyncReadOptions,
  ): Promise<Buffer<ArrayBuffer>> {
    const content: Proto.Content.Params = {
      content: {
        syncMessage: {
          content: null,
          stickerPackOperation: null,
          read: options.messages.map(({ senderAci, timestamp }) => {
            return {
              senderAciBinary:
                Aci.parseFromServiceIdString(senderAci).getRawUuidBytes(),
              timestamp: BigInt(timestamp),

              // Deprecated string field
              senderAci: null,
            };
          }),
          viewed: null,
          padding: null,
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };
    return this.encryptContent(target, content, options);
  }

  public async sendFetchStorage(options: FetchStorageOptions): Promise<void> {
    const content: Proto.Content.Params = {
      content: {
        syncMessage: {
          content: {
            fetchLatest: {
              type: Proto.SyncMessage.FetchLatest.Type.STORAGE_MANIFEST,
            },
          },
          stickerPackOperation: null,
          read: null,
          viewed: null,
          padding: null,
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };

    return this.broadcast('fetch storage', content, options);
  }

  public async sendStickerPackSync(
    options: SendStickerPackSyncOptions,
  ): Promise<void> {
    const Type = Proto.SyncMessage.StickerPackOperation.Type;

    const content: Proto.Content.Params = {
      content: {
        syncMessage: {
          content: null,
          stickerPackOperation: [
            {
              packId: options.packId,
              packKey: options.packKey,
              type: options.type === 'install' ? Type.INSTALL : Type.REMOVE,
            },
          ],
          read: null,
          viewed: null,
          padding: null,
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };

    return this.broadcast('sticker pack sync', content, options);
  }

  public async encryptReceipt(
    target: Device,
    options: ReceiptOptions,
  ): Promise<Buffer<ArrayBuffer>> {
    let type: Proto.ReceiptMessage.Type;
    if (options.type === ReceiptType.Delivery) {
      type = Proto.ReceiptMessage.Type.DELIVERY;
    } else {
      assert.strictEqual(options.type, ReceiptType.Read);
      type = Proto.ReceiptMessage.Type.READ;
    }

    const content: Proto.Content.Params = {
      content: {
        receiptMessage: {
          type,
          timestamp: options.messageTimestamps.map((timestamp) =>
            BigInt(timestamp),
          ),
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };
    return this.encryptContent(target, content, options);
  }

  public async sendReceipt(
    target: Device,
    options: ReceiptOptions,
  ): Promise<void> {
    const receipt = await this.encryptReceipt(target, options);
    return this.config.send(target, receipt);
  }

  public async sendUnencryptedReceipt(
    target: Device,
    { messageTimestamp, timestamp = Date.now() }: UnencryptedReceiptOptions,
  ): Promise<void> {
    const envelope: Proto.Envelope.Params = {
      type: Proto.Envelope.Type.SERVER_DELIVERY_RECEIPT,
      clientTimestamp: BigInt(messageTimestamp),
      serverTimestamp: BigInt(timestamp),
      sourceServiceIdBinary: this.device.aciBinary,
      sourceDeviceId: this.device.deviceId,
      destinationServiceIdBinary: target.aciBinary,
      serverGuid: null,
      ephemeral: null,
      urgent: null,
      story: null,
      reportSpamToken: null,
      serverGuidBinary: null,
      content: null,
      updatedPniBinary: null,

      // Deprecated string fields
      sourceServiceId: null,
      destinationServiceId: null,
      updatedPni: null,
    };
    return this.config.send(
      target,
      Buffer.from(Proto.Envelope.encode(envelope)),
    );
  }

  public async prepareChangeNumber(
    options: EncryptOptions = {},
  ): Promise<PrepareChangeNumberResult> {
    const { timestamp = Date.now() } = options;

    const newNumber = await this.config.generateNumber();
    const newPni = await this.config.generatePni();
    const newPniRegistrationId = generateRegistrationId();
    const newPniIdentity = IdentityKeyPair.generate();

    debug(
      'sending change number to %d linked devices timestamp=%d newPni=%s',
      this.secondaryDevices.length,
      timestamp,
      newPni,
    );

    this.pniPrivateKey = newPniIdentity.privateKey;
    this.privPniPublicKey = newPniIdentity.publicKey;

    const allDevices = [this.device, ...this.secondaryDevices];

    // Update PNI
    await Promise.all(
      allDevices.map(async (device) => {
        await this.config.changeDeviceNumber(device, {
          pni: newPni,
          number: newNumber,
          pniRegistrationId: newPniRegistrationId,
        });
      }),
    );

    const identity = this.identity.get(ServiceIdKind.PNI);
    assert(identity, 'Should have a PNI identity');
    await identity.updateIdentityKey(newPniIdentity.privateKey);
    await identity.updateLocalRegistrationId(newPniRegistrationId);
    const address = this.device.checkedPniAddress;

    await identity.saveIdentity(address, this.getPublicKey(ServiceIdKind.PNI));

    // Update all keys and prepare sync message
    const results = await Promise.all(
      allDevices.map(async (device) => {
        const isPrimary = device === this.device;
        const keys = await this.generateKeys(device, ServiceIdKind.PNI);
        await device.setKeys(ServiceIdKind.PNI, keys);

        if (isPrimary) {
          return;
        }

        // Send sync message
        const { signedPreKeyRecord, lastResortKeyRecord } = keys;

        const content: Proto.Content.Params = {
          content: {
            syncMessage: {
              content: {
                pniChangeNumber: {
                  identityKeyPair: newPniIdentity.serialize(),
                  lastResortKyberPreKey: lastResortKeyRecord.serialize(),
                  signedPreKey: signedPreKeyRecord.serialize(),
                  registrationId: newPniRegistrationId,
                  newE164: newNumber,
                },
              },
              read: null,
              stickerPackOperation: null,
              viewed: null,
              padding: null,
            },
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        };

        const { pni } = this.device;
        assert(pni, 'must have pni for change number');
        const envelope = await this.encryptContent(device, content, {
          ...options,
          timestamp,
          updatedPni: pni,
        });

        return { device, envelope };
      }),
    );

    return results.filter((entry): entry is PrepareChangeNumberEntry => {
      return entry !== undefined;
    });
  }

  public async sendChangeNumber(
    result: PrepareChangeNumberResult,
  ): Promise<void> {
    await Promise.all(
      result.map(({ device, envelope }) => {
        return this.config.send(device, envelope);
      }),
    );
  }

  public async changeNumber(options: EncryptOptions = {}): Promise<void> {
    const result = await this.prepareChangeNumber(options);
    await this.sendChangeNumber(result);
  }

  public async sendText(
    target: Device,
    text: string,
    options?: EncryptTextOptions,
  ): Promise<void> {
    await this.config.send(
      target,
      await this.encryptText(target, text, options),
    );
  }

  public async sendRaw(
    target: Device,
    content: Proto.Content.Params,
    options?: EncryptOptions,
  ): Promise<void> {
    await this.config.send(
      target,
      await this.encryptContent(target, content, options),
    );
  }

  public async sendSenderKey(
    target: Device,
    options?: EncryptOptions,
  ): Promise<string> {
    const distributionId = crypto.randomUUID();

    const senderKeys = this.senderKeys.get(ServiceIdKind.ACI);
    assert(senderKeys, 'Should have a sender key store');

    const skdm = await SenderKeyDistributionMessage.create(
      target.address,
      distributionId,
      senderKeys,
    );

    if (!options?.skipSkdmSend) {
      void this.sendRaw(
        target,
        {
          content: null,
          pniSignatureMessage: null,
          senderKeyDistributionMessage: skdm.serialize(),
        },
        options,
      );
    }

    return distributionId;
  }

  public async unlink(device: Device): Promise<void> {
    const index = this.secondaryDevices.indexOf(device);
    if (index === -1) {
      throw new Error('Device was not linked');
    }
    this.secondaryDevices.splice(index, 1);
  }

  public async receive(
    source: Device,
    encrypted: Buffer<ArrayBuffer>,
  ): Promise<void> {
    const envelope = Proto.Envelope.decode(encrypted);

    if (
      envelope.sourceServiceIdBinary != null &&
      source.getServiceIdBinaryKind(envelope.sourceServiceIdBinary) !==
        ServiceIdKind.ACI
    ) {
      throw new Error(
        `Invalid envelope source. Expected: ${source.aci}, got PNI`,
      );
    }

    let envelopeType: EnvelopeType;
    if (envelope.type === Proto.Envelope.Type.DOUBLE_RATCHET) {
      envelopeType = EnvelopeType.CipherText;
    } else if (envelope.type === Proto.Envelope.Type.PREKEY_MESSAGE) {
      envelopeType = EnvelopeType.PreKey;
    } else if (envelope.type === Proto.Envelope.Type.UNIDENTIFIED_SENDER) {
      envelopeType = EnvelopeType.SealedSender;
    } else {
      throw new Error('Unsupported envelope type');
    }

    const serviceIdKind = envelope.destinationServiceIdBinary?.length
      ? this.device.getServiceIdBinaryKind(envelope.destinationServiceIdBinary)
      : ServiceIdKind.ACI;

    return this.handleEnvelope(
      source,
      serviceIdKind,
      envelopeType,
      envelope.content ? Buffer.from(envelope.content) : Buffer.alloc(0),
    );
  }

  public async waitForMessage(): Promise<MessageQueueEntry> {
    return this.messageQueue.shift();
  }
  public getMessageQueueSize(): number {
    return this.messageQueue.size;
  }

  public async waitForDecryptionError(): Promise<DecryptionErrorQueueEntry> {
    return this.decryptionErrorQueue.shift();
  }
  public getDecryptionErrorQueueSize(): number {
    return this.decryptionErrorQueue.size;
  }

  public async waitForReceipt(): Promise<ReceiptQueueEntry> {
    return this.receiptQueue.shift();
  }
  public getReceiptQueueSize(): number {
    return this.receiptQueue.size;
  }

  public async waitForStory(): Promise<StoryQueueEntry> {
    return this.storyQueue.shift();
  }
  public getStoryQueueSize(): number {
    return this.storyQueue.size;
  }

  public async waitForEditMessage(): Promise<EditMessageQueueEntry> {
    return this.editMessageQueue.shift();
  }
  public getEditQueueSize(): number {
    return this.editMessageQueue.size;
  }

  public async waitForSyncMessage(
    predicate: (entry: SyncMessageQueueEntry) => boolean = () => true,
  ): Promise<SyncMessageQueueEntry> {
    for (;;) {
      const entry = await this.syncMessageQueue.shift();
      if (!predicate(entry)) {
        continue;
      }
      return entry;
    }
  }

  //
  // Private
  //

  private async getProfileKeyPresentation(
    groupParams: GroupSecretParams,
  ): Promise<ProfileKeyCredentialPresentation> {
    const ops = new ClientZkProfileOperations(this.config.serverPublicParams);

    const ctx = ops.createProfileKeyCredentialRequestContext(
      Aci.parseFromServiceIdString(this.device.aci),
      this.profileKey,
    );
    const response = await this.config.issueExpiringProfileKeyCredential(
      this.device,
      ctx.getRequest(),
    );
    assert.ok(response, `Member device ${this.device.aci} not initialized`);

    const credential = ops.receiveExpiringProfileKeyCredential(
      ctx,
      new ExpiringProfileKeyCredentialResponse(response),
    );

    return ops.createExpiringProfileKeyCredentialPresentation(
      groupParams,
      credential,
    );
  }

  private getPrivateKey(serviceIdKind: ServiceIdKind): PrivateKey {
    switch (serviceIdKind) {
      case ServiceIdKind.ACI:
        return this.privateKey;
      case ServiceIdKind.PNI:
        return this.pniPrivateKey;
    }
  }

  private async encryptContent(
    target: Device,
    content: Proto.Content.Params,
    options?: EncryptOptions,
  ): Promise<Buffer<ArrayBuffer>> {
    const encoded = Buffer.from(Proto.Content.encode(content));

    return this.lock(async () => {
      return this.encrypt(target, encoded, options);
    });
  }

  private async broadcast(
    type: string,
    content: Proto.Content.Params,
    options?: EncryptOptions,
  ): Promise<void> {
    debug(
      'broadcasting %s to %d linked devices',
      type,
      this.secondaryDevices.length,
    );

    await Promise.all(
      this.secondaryDevices.map(async (device) => {
        const envelope = await this.encryptContent(device, content, options);

        await this.config.send(device, envelope);
      }),
    );
  }

  private getSyncState(secondaryDevice: Device): SyncEntry {
    const existing = this.syncStates.get(secondaryDevice);
    if (existing) {
      return existing;
    }

    let complete: (() => void) | undefined;
    const onComplete = new Promise<void>((resolve) => {
      complete = resolve;
    });

    if (!complete) {
      throw new Error('Failed to obtain resolve callback');
    }

    const entry = {
      state: SyncState.Empty,
      onComplete,
      complete,
    };
    this.syncStates.set(secondaryDevice, entry);

    return entry;
  }

  private async handleSync(
    source: Device,
    sync: Proto.SyncMessage,
  ): Promise<void> {
    if (sync.content?.request == null) {
      debug('got generic sync message');
      this.syncMessageQueue.push({
        source,
        syncMessage: sync,
      });
      return;
    }

    const {
      content: { request },
    } = sync;

    let stateChange: SyncState;
    let response: Proto.SyncMessage.Params;
    if (request.type === Proto.SyncMessage.Request.Type.CONTACTS) {
      debug('got sync contacts request');
      response = {
        content: {
          contacts: {
            blob: this.contactsBlob,
            complete: true,
          },
        },
        stickerPackOperation: null,
        read: null,
        viewed: null,
        padding: null,
      };
      stateChange = SyncState.Contacts;
    } else if (request.type === Proto.SyncMessage.Request.Type.BLOCKED) {
      debug('got sync blocked request');
      response = {
        content: {
          blocked: {
            numbers: null,
            groupIds: null,
            acisBinary: null,

            // Deprecated string field
            acis: null,
          },
        },
        stickerPackOperation: null,
        read: null,
        viewed: null,
        padding: null,
      };
      stateChange = SyncState.Blocked;
    } else if (request.type === Proto.SyncMessage.Request.Type.CONFIGURATION) {
      debug('got sync configuration request');
      response = {
        content: {
          configuration: {
            readReceipts: true,
            unidentifiedDeliveryIndicators: false,
            typingIndicators: false,
            linkPreviews: false,
          },
        },
        stickerPackOperation: null,
        read: null,
        viewed: null,
        padding: null,
      };
      stateChange = SyncState.Configuration;
    } else if (request.type === Proto.SyncMessage.Request.Type.KEYS) {
      debug('got sync keys request');
      response = {
        content: {
          keys: {
            master: this.masterKey,
            mediaRootBackupKey: this.mediaRootBackupKey,
            accountEntropyPool: this.accountEntropyPool,
          },
        },
        stickerPackOperation: null,
        read: null,
        viewed: null,
        padding: null,
      };
      stateChange = SyncState.Keys;
    } else {
      debug('Unsupported sync request', request);
      return;
    }

    const encrypted = await this.encryptContent(source, {
      content: {
        syncMessage: response,
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    });

    // Intentionally not awaiting since the device might be offline or
    // not responding.
    void this.config.send(source, encrypted);

    const syncEntry = this.getSyncState(source);
    syncEntry.state |= stateChange;

    if ((syncEntry.state & SyncState.Complete) === SyncState.Complete) {
      debug('sync with %s complete', source.debugId);
      syncEntry.complete();
    }
  }

  private handleResendRequest(
    source: Device,
    serviceIdKind: ServiceIdKind,
    envelopeType: EnvelopeType,
    content: Proto.Content,
    decryptionErrorMessage: Uint8Array<ArrayBuffer>,
  ): void {
    const request = DecryptionErrorMessage.deserialize(
      Buffer.from(decryptionErrorMessage),
    );

    this.decryptionErrorQueue.push({
      source,
      serviceIdKind,
      envelopeType,
      content,
      timestamp: request.timestamp(),
      ratchetKey: request.ratchetKey(),
      senderDevice: request.deviceId(),
    });
  }

  private handleDataMessage(
    source: Device,
    serviceIdKind: ServiceIdKind,
    envelopeType: EnvelopeType,
    content: Proto.Content,
    dataMessage: Proto.DataMessage,
  ): void {
    const { body } = dataMessage;
    this.messageQueue.push({
      source,
      serviceIdKind,
      body: body ?? '',
      envelopeType,
      dataMessage,
      content,
    });
  }

  private handleReceiptMessage(
    source: Device,
    serviceIdKind: ServiceIdKind,
    envelopeType: EnvelopeType,
    content: Proto.Content,
    receiptMessage: Proto.ReceiptMessage,
  ): void {
    this.receiptQueue.push({
      source,
      serviceIdKind,
      envelopeType,
      receiptMessage,
      content,
    });
  }

  private handleStoryMessage(
    source: Device,
    serviceIdKind: ServiceIdKind,
    envelopeType: EnvelopeType,
    content: Proto.Content,
    storyMessage: Proto.StoryMessage,
  ): void {
    this.storyQueue.push({
      source,
      serviceIdKind,
      envelopeType,
      storyMessage,
      content,
    });
  }

  private handleEditMessage(
    source: Device,
    serviceIdKind: ServiceIdKind,
    envelopeType: EnvelopeType,
    content: Proto.Content,
    editMessage: Proto.EditMessage,
  ): void {
    this.editMessageQueue.push({
      source,
      serviceIdKind,
      envelopeType,
      editMessage,
      content,
    });
  }

  private async encrypt(
    target: Device,
    message: Buffer<ArrayBuffer>,
    {
      timestamp = Date.now(),
      sealed = false,
      serviceIdKind = ServiceIdKind.ACI,
      updatedPni,
      distributionId,
      group,
    }: EncryptOptions = {},
  ): Promise<Buffer<ArrayBuffer>> {
    assert.ok(this.isInitialized, 'Not initialized');

    // "Pad"
    const paddedMessage = Buffer.concat([message, Buffer.from([0x80])]);

    let envelopeType: Proto.Envelope.Type;
    let content: Uint8Array<ArrayBuffer>;

    // Outgoing stores
    const identity = this.identity.get(ServiceIdKind.ACI);
    assert(identity, 'Should have an ACI identity');

    if (sealed) {
      assert(
        serviceIdKind === ServiceIdKind.ACI,
        "Can't send sealed sender to PNI",
      );

      const address = target.getAddressByKind(serviceIdKind);
      assert(address != null, 'missing address for sealed sender');

      if (distributionId) {
        const senderKey = this.senderKeys.get(ServiceIdKind.ACI);
        assert(senderKey, 'Should have an ACI sender keys');

        const ciphertext = await SignalClient.groupEncrypt(
          target.address,
          distributionId,
          senderKey,
          paddedMessage,
        );

        const usmc = SignalClient.UnidentifiedSenderMessageContent.new(
          ciphertext,
          this.senderCertificate,
          SignalClient.ContentHint.Implicit,
          group?.publicParams.getGroupIdentifier().serialize() ?? null,
        );
        const multiRecipient =
          await SignalClient.sealedSenderMultiRecipientEncrypt(
            usmc,
            [address],
            identity,
            this.sessions,
          );

        content =
          SignalClient.sealedSenderMultiRecipientMessageForSingleRecipient(
            multiRecipient,
          );
      } else {
        content = await SignalClient.sealedSenderEncryptMessage(
          paddedMessage,
          address,
          this.senderCertificate,
          this.sessions,
          identity,
        );
      }

      envelopeType = Proto.Envelope.Type.UNIDENTIFIED_SENDER;
    } else {
      const address = target.getAddressByKind(serviceIdKind);
      assert(address != null, `No address for ${serviceIdKind}`);
      const ourAddress = this.device.address;
      const ciphertext = await SignalClient.signalEncrypt(
        paddedMessage,
        address,
        ourAddress,
        this.sessions,
        identity,
      );
      content = ciphertext.serialize();

      if (ciphertext.type() === CiphertextMessageType.Whisper) {
        assert(
          serviceIdKind === ServiceIdKind.ACI,
          "Can't send non-prekey messages to PNI",
        );

        envelopeType = Proto.Envelope.Type.DOUBLE_RATCHET;
        debug('encrypting ciphertext envelope');
      } else {
        assert.strictEqual(ciphertext.type(), CiphertextMessageType.PreKey);
        envelopeType = Proto.Envelope.Type.PREKEY_MESSAGE;
        debug('encrypting prekeyBundle envelope');
      }
    }

    const destinationServiceIdBinary =
      target.getServiceIdBinaryByKind(serviceIdKind);
    assert(
      destinationServiceIdBinary != null,
      `Missing destination service id for ${serviceIdKind}`,
    );

    const envelope = Buffer.from(
      Proto.Envelope.encode({
        type: envelopeType,
        sourceServiceIdBinary: sealed ? null : this.device.aciBinary,
        sourceDeviceId: sealed ? null : this.device.deviceId,
        destinationServiceIdBinary,
        updatedPniBinary:
          updatedPni === undefined
            ? null
            : Pni.parseFromServiceIdString(updatedPni).getRawUuidBytes(),
        serverTimestamp: BigInt(timestamp),
        clientTimestamp: BigInt(timestamp),
        content,
        serverGuid: null,
        ephemeral: null,
        urgent: null,
        story: null,
        reportSpamToken: null,
        serverGuidBinary: null,

        // Deprecated string fields
        sourceServiceId: null,
        destinationServiceId: null,
        updatedPni: null,
      }),
    );

    debug('encrypting envelope finish');

    return envelope;
  }

  private async decrypt(
    source: Device | undefined,
    serviceIdKind: ServiceIdKind,
    envelopeType: EnvelopeType,
    encrypted: Uint8Array<ArrayBuffer>,
  ): Promise<DecryptResult> {
    debug('decrypting envelope type=%s start', envelopeType);

    const identity = this.identity.get(serviceIdKind);
    const preKeys = this.preKeys.get(serviceIdKind);
    const kyberPreKeys = this.kyberPreKeys.get(serviceIdKind);
    const signedPreKeys = this.signedPreKeys.get(serviceIdKind);
    const senderKeys = this.senderKeys.get(serviceIdKind);
    assert(
      identity && preKeys && signedPreKeys && kyberPreKeys && senderKeys,
      'Should have identity, prekey/kyber/signed/senderkey stores',
    );

    let decrypted: Uint8Array<ArrayBuffer>;

    if (envelopeType === EnvelopeType.Plaintext) {
      assert(source !== undefined, 'Plaintext must have source');

      const plaintext = PlaintextContent.deserialize(encrypted);
      decrypted = plaintext.body();
    } else if (envelopeType === EnvelopeType.CipherText) {
      assert(source !== undefined, 'CipherText must have source');

      const localAddress = this.device.getAddressByKind(serviceIdKind);
      assert(localAddress, `Missing local address for ${serviceIdKind}`);

      const sourceAddress = source.address;

      decrypted = await SignalClient.signalDecrypt(
        SignalMessage.deserialize(encrypted),
        sourceAddress,
        localAddress,
        this.sessions,
        identity,
      );
    } else if (envelopeType === EnvelopeType.PreKey) {
      assert(source !== undefined, 'PreKey must have source');

      const sourceAddress = source.address;

      const ourAddress = this.device.getAddressByKind(serviceIdKind);
      assert(
        ourAddress !== undefined,
        `Missing our own address for ${serviceIdKind}`,
      );

      decrypted = await SignalClient.signalDecryptPreKey(
        PreKeySignalMessage.deserialize(encrypted),
        sourceAddress,
        ourAddress,
        this.sessions,
        identity,
        preKeys,
        signedPreKeys,
        kyberPreKeys,
      );
    } else if (envelopeType === EnvelopeType.SenderKey) {
      assert(source !== undefined, 'SenderKey must have source');

      const sourceAddress = source.address;

      decrypted = await SignalClient.groupDecrypt(
        sourceAddress,
        senderKeys,
        encrypted,
      );
    } else if (envelopeType === EnvelopeType.SealedSender) {
      const usmc = await SignalClient.sealedSenderDecryptToUsmc(
        encrypted,
        identity,
      );

      const unsealedType = usmc.msgType();
      const certificate = usmc.senderCertificate();

      const sender = await this.config.getDeviceByServiceId(
        certificate.senderUuid() as ServiceIdString,
        certificate.senderDeviceId() as DeviceId,
      );
      assert(sender !== undefined, 'Unsealed sender not found');

      let subType: EnvelopeType;
      switch (unsealedType) {
        case CiphertextMessageType.PreKey:
          subType = EnvelopeType.PreKey;
          break;
        case CiphertextMessageType.Whisper:
          subType = EnvelopeType.CipherText;
          break;
        case CiphertextMessageType.SenderKey:
          subType = EnvelopeType.SenderKey;
          break;
        case CiphertextMessageType.Plaintext:
          subType = EnvelopeType.Plaintext;
          break;
        default:
          throw new Error(`Unsupported usmc type: ${unsealedType}`);
      }

      // TODO(indutny): use sealedSenderDecryptMessage once it will support
      // sender key.
      const result = await this.decrypt(
        sender,
        serviceIdKind,
        subType,
        usmc.contents(),
      );

      if (serviceIdKind === ServiceIdKind.PNI) {
        debug('sealed message on PNI', result);
        throw new Error('Got sealed message on PNI');
      }

      return result;
    } else {
      throw new Error(`Unsupported envelope type: ${envelopeType}`);
    }

    // Remove padding
    let padding = 1;
    while (decrypted[decrypted.length - padding] !== 0x80) {
      assert.strictEqual(decrypted[decrypted.length - padding], 0);
      padding++;
    }

    const content = Proto.Content.decode(decrypted.slice(0, -padding));
    debug('decrypting envelope type=%s finish', envelopeType);
    return { unsealedSource: source, content, envelopeType };
  }

  private async lock<T>(callback: () => Promise<T>): Promise<T> {
    while (this.lockPromise) {
      await this.lockPromise;
    }

    let unlock: (() => void) | undefined;
    this.lockPromise = new Promise((resolve) => {
      unlock = resolve;
    });

    try {
      return await callback();
    } finally {
      this.lockPromise = undefined;
      assert.ok(unlock);
      unlock();
    }
  }

  private get senderCertificate(): SenderCertificate {
    if (!this.privSenderCertificate) {
      throw new Error('Sender certificate not set');
    }
    return this.privSenderCertificate;
  }

  private async processSenderKeyDistribution(
    source: Device,
    rawMessage: Uint8Array<ArrayBuffer>,
  ): Promise<void> {
    const message = SenderKeyDistributionMessage.deserialize(
      Buffer.from(rawMessage),
    );

    const senderKeys = this.senderKeys.get(ServiceIdKind.ACI);
    assert(senderKeys, 'Should have a sender key store');

    debug('received SKDM from', source.debugId);
    await SignalClient.processSenderKeyDistributionMessage(
      source.address,
      message,
      senderKeys,
    );
  }

  private convertManifestToStorageState(
    manifest: Proto.StorageManifest.Params,
  ): StorageState {
    const decryptedManifest = decryptStorageManifest(this.storageKey, manifest);
    assert(decryptedManifest.version, 'Consistency check');

    const version = decryptedManifest.version;
    const items = decryptedManifest.identifiers.map(({ type, raw: key }) => {
      const keyBuffer = Buffer.from(key);
      const item = this.config.getStorageItem(keyBuffer);
      if (!item) {
        throw new Error(`Missing item ${keyBuffer.toString('base64')}`);
      }

      const decrypted = decryptStorageItem({
        storageKey: this.storageKey,
        recordIkm: this.storageRecordIkm,
        item: {
          key,
          value: item,
        },
      });
      if (!decrypted.record) {
        throw new Error(`Missing item record ${keyBuffer.toString('base64')}`);
      }
      return {
        type: type as Proto.ManifestRecord.Identifier.Type,
        key: keyBuffer,
        record: decrypted.record,
      };
    });

    return new StorageState(version, items);
  }
}
