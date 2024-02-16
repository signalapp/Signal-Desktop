// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { isNumber, omit, orderBy } from 'lodash';
import type { KyberPreKeyRecord } from '@signalapp/libsignal-client';

import EventTarget from './EventTarget';
import type {
  UploadKeysType,
  UploadKyberPreKeyType,
  UploadPreKeyType,
  UploadSignedPreKeyType,
  WebAPIType,
} from './WebAPI';
import type {
  CompatSignedPreKeyType,
  CompatPreKeyType,
  KeyPairType,
  KyberPreKeyType,
  PniKeyMaterialType,
} from './Types.d';
import ProvisioningCipher from './ProvisioningCipher';
import type { IncomingWebSocketRequest } from './WebsocketResources';
import createTaskWithTimeout from './TaskWithTimeout';
import * as Bytes from '../Bytes';
import * as Errors from '../types/errors';
import { senderCertificateService } from '../services/senderCertificate';
import {
  deriveAccessKey,
  generateRegistrationId,
  getRandomBytes,
  decryptDeviceName,
  encryptDeviceName,
} from '../Crypto';
import {
  generateKeyPair,
  generateSignedPreKey,
  generatePreKey,
  generateKyberPreKey,
} from '../Curve';
import type { ServiceIdString, AciString, PniString } from '../types/ServiceId';
import {
  ServiceIdKind,
  normalizePni,
  toTaggedPni,
  isUntaggedPniString,
} from '../types/ServiceId';
import { normalizeAci } from '../util/normalizeAci';
import { drop } from '../util/drop';
import { isMoreRecentThan, isOlderThan } from '../util/timestamp';
import { ourProfileKeyService } from '../services/ourProfileKey';
import { strictAssert } from '../util/assert';
import { getRegionCodeForNumber } from '../util/libphonenumberUtil';
import { isNotNil } from '../util/isNotNil';
import { missingCaseError } from '../util/missingCaseError';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import type { StorageAccessType } from '../types/Storage';
import { linkDeviceRoute } from '../util/signalRoutes';

type StorageKeyByServiceIdKind = {
  [kind in ServiceIdKind]: keyof StorageAccessType;
};

const DAY = 24 * 60 * 60 * 1000;

const STARTING_KEY_ID = 1;
const PROFILE_KEY_LENGTH = 32;
const MASTER_KEY_LENGTH = 32;
const KEY_TOO_OLD_THRESHOLD = 14 * DAY;

export const KYBER_KEY_ID_KEY: StorageKeyByServiceIdKind = {
  [ServiceIdKind.ACI]: 'maxKyberPreKeyId',
  [ServiceIdKind.Unknown]: 'maxKyberPreKeyId',
  [ServiceIdKind.PNI]: 'maxKyberPreKeyIdPNI',
};

const LAST_RESORT_KEY_ARCHIVE_AGE = 30 * DAY;
const LAST_RESORT_KEY_ROTATION_AGE = DAY * 1.5;
const LAST_RESORT_KEY_MINIMUM = 5;
const LAST_RESORT_KEY_UPDATE_TIME_KEY: StorageKeyByServiceIdKind = {
  [ServiceIdKind.ACI]: 'lastResortKeyUpdateTime',
  [ServiceIdKind.Unknown]: 'lastResortKeyUpdateTime',
  [ServiceIdKind.PNI]: 'lastResortKeyUpdateTimePNI',
};

const PRE_KEY_ARCHIVE_AGE = 90 * DAY;
const PRE_KEY_GEN_BATCH_SIZE = 100;
const PRE_KEY_MAX_COUNT = 200;
const PRE_KEY_ID_KEY: StorageKeyByServiceIdKind = {
  [ServiceIdKind.ACI]: 'maxPreKeyId',
  [ServiceIdKind.Unknown]: 'maxPreKeyId',
  [ServiceIdKind.PNI]: 'maxPreKeyIdPNI',
};
const PRE_KEY_MINIMUM = 10;

const SIGNED_PRE_KEY_ARCHIVE_AGE = 30 * DAY;
export const SIGNED_PRE_KEY_ID_KEY: StorageKeyByServiceIdKind = {
  [ServiceIdKind.ACI]: 'signedKeyId',
  [ServiceIdKind.Unknown]: 'signedKeyId',
  [ServiceIdKind.PNI]: 'signedKeyIdPNI',
};

const SIGNED_PRE_KEY_ROTATION_AGE = DAY * 1.5;
const SIGNED_PRE_KEY_MINIMUM = 5;
const SIGNED_PRE_KEY_UPDATE_TIME_KEY: StorageKeyByServiceIdKind = {
  [ServiceIdKind.ACI]: 'signedKeyUpdateTime',
  [ServiceIdKind.Unknown]: 'signedKeyUpdateTime',
  [ServiceIdKind.PNI]: 'signedKeyUpdateTimePNI',
};

enum AccountType {
  Primary = 'Primary',
  Linked = 'Linked',
}

type CreateAccountSharedOptionsType = Readonly<{
  number: string;
  verificationCode: string;
  aciKeyPair: KeyPairType;
  pniKeyPair: KeyPairType;
  profileKey: Uint8Array;
  masterKey: Uint8Array | undefined;
}>;

type CreatePrimaryDeviceOptionsType = Readonly<{
  type: AccountType.Primary;

  deviceName?: undefined;
  ourAci?: undefined;
  ourPni?: undefined;
  userAgent?: undefined;

  readReceipts: true;

  accessKey: Uint8Array;
  sessionId: string;
}> &
  CreateAccountSharedOptionsType;

type CreateLinkedDeviceOptionsType = Readonly<{
  type: AccountType.Linked;

  deviceName: string;
  ourAci: AciString;
  ourPni: PniString;
  userAgent?: string;

  readReceipts: boolean;

  accessKey?: undefined;
  sessionId?: undefined;
}> &
  CreateAccountSharedOptionsType;

type CreateAccountOptionsType =
  | CreatePrimaryDeviceOptionsType
  | CreateLinkedDeviceOptionsType;

function getNextKeyId(
  kind: ServiceIdKind,
  keys: StorageKeyByServiceIdKind
): number {
  const id = window.storage.get(keys[kind]);

  if (isNumber(id)) {
    return id;
  }

  // For PNI ids, start with existing ACI id
  if (kind === ServiceIdKind.PNI) {
    return window.storage.get(keys[ServiceIdKind.ACI], STARTING_KEY_ID);
  }

  return STARTING_KEY_ID;
}

function kyberPreKeyToUploadSignedPreKey(
  record: KyberPreKeyRecord
): UploadSignedPreKeyType {
  return {
    keyId: record.id(),
    publicKey: record.publicKey().serialize(),
    signature: record.signature(),
  };
}

function kyberPreKeyToStoredSignedPreKey(
  record: KyberPreKeyRecord,
  ourServiceId: ServiceIdString
): Omit<KyberPreKeyType, 'id'> {
  return {
    createdAt: Date.now(),
    data: record.serialize(),
    isConfirmed: false,
    isLastResort: true,
    keyId: record.id(),
    ourServiceId,
  };
}

function signedPreKeyToUploadSignedPreKey({
  keyId,
  keyPair,
  signature,
}: CompatSignedPreKeyType): UploadSignedPreKeyType {
  return {
    keyId,
    publicKey: keyPair.pubKey,
    signature,
  };
}

export default class AccountManager extends EventTarget {
  pending: Promise<void>;

  pendingQueue?: PQueue;

  constructor(private readonly server: WebAPIType) {
    super();

    this.pending = Promise.resolve();
  }

  private async queueTask<T>(task: () => Promise<T>): Promise<T> {
    this.pendingQueue = this.pendingQueue || new PQueue({ concurrency: 1 });
    const taskWithTimeout = createTaskWithTimeout(task, 'AccountManager task');

    return this.pendingQueue.add(taskWithTimeout);
  }

  encryptDeviceName(
    name: string,
    identityKey: KeyPairType
  ): string | undefined {
    if (!name) {
      return undefined;
    }
    const encrypted = encryptDeviceName(name, identityKey.pubKey);

    const proto = new Proto.DeviceName();
    proto.ephemeralPublic = encrypted.ephemeralPublic;
    proto.syntheticIv = encrypted.syntheticIv;
    proto.ciphertext = encrypted.ciphertext;

    const bytes = Proto.DeviceName.encode(proto).finish();
    return Bytes.toBase64(bytes);
  }

  async decryptDeviceName(base64: string): Promise<string> {
    const ourAci = window.textsecure.storage.user.getCheckedAci();
    const identityKey =
      window.textsecure.storage.protocol.getIdentityKeyPair(ourAci);
    if (!identityKey) {
      throw new Error('decryptDeviceName: No identity key pair!');
    }

    const bytes = Bytes.fromBase64(base64);
    const proto = Proto.DeviceName.decode(bytes);
    strictAssert(
      proto.ephemeralPublic,
      'Missing ephemeralPublic field in DeviceName'
    );
    strictAssert(proto.syntheticIv, 'Missing syntheticIv field in DeviceName');
    strictAssert(proto.ciphertext, 'Missing ciphertext field in DeviceName');

    const name = decryptDeviceName(
      {
        ephemeralPublic: proto.ephemeralPublic,
        syntheticIv: proto.syntheticIv,
        ciphertext: proto.ciphertext,
      },
      identityKey.privKey
    );

    return name;
  }

  async maybeUpdateDeviceName(): Promise<void> {
    const isNameEncrypted =
      window.textsecure.storage.user.getDeviceNameEncrypted();
    if (isNameEncrypted) {
      return;
    }
    const { storage } = window.textsecure;
    const deviceName = storage.user.getDeviceName();
    const identityKeyPair = storage.protocol.getIdentityKeyPair(
      storage.user.getCheckedAci()
    );
    strictAssert(
      identityKeyPair !== undefined,
      "Can't encrypt device name without identity key pair"
    );
    const base64 = this.encryptDeviceName(deviceName || '', identityKeyPair);

    if (base64) {
      await this.server.updateDeviceName(base64);
    }
  }

  async deviceNameIsEncrypted(): Promise<void> {
    await window.textsecure.storage.user.setDeviceNameEncrypted();
  }

  async registerSingleDevice(
    number: string,
    verificationCode: string,
    sessionId: string
  ): Promise<void> {
    await this.queueTask(async () => {
      const aciKeyPair = generateKeyPair();
      const pniKeyPair = generateKeyPair();
      const profileKey = getRandomBytes(PROFILE_KEY_LENGTH);
      const accessKey = deriveAccessKey(profileKey);
      const masterKey = getRandomBytes(MASTER_KEY_LENGTH);

      const registrationBaton = this.server.startRegistration();
      try {
        await this.createAccount({
          type: AccountType.Primary,
          number,
          verificationCode,
          sessionId,
          aciKeyPair,
          pniKeyPair,
          profileKey,
          accessKey,
          masterKey,
          readReceipts: true,
        });
      } finally {
        this.server.finishRegistration(registrationBaton);
      }
      await this.registrationDone();
    });
  }

  async registerSecondDevice(
    setProvisioningUrl: (url: string) => void,
    confirmNumber: (number?: string) => Promise<string>
  ): Promise<void> {
    const provisioningCipher = new ProvisioningCipher();
    const pubKey = await provisioningCipher.getPublicKey();

    let envelopeCallbacks:
      | {
          resolve(data: Proto.ProvisionEnvelope): void;
          reject(error: Error): void;
        }
      | undefined;
    const envelopePromise = new Promise<Proto.ProvisionEnvelope>(
      (resolve, reject) => {
        envelopeCallbacks = { resolve, reject };
      }
    );

    const wsr = await this.server.getProvisioningResource({
      handleRequest(request: IncomingWebSocketRequest) {
        if (
          request.path === '/v1/address' &&
          request.verb === 'PUT' &&
          request.body
        ) {
          const proto = Proto.ProvisioningUuid.decode(request.body);
          const { uuid } = proto;
          if (!uuid) {
            throw new Error('registerSecondDevice: expected a UUID');
          }
          const url = linkDeviceRoute
            .toAppUrl({
              uuid,
              pubKey: Bytes.toBase64(pubKey),
            })
            .toString();

          window.SignalCI?.setProvisioningURL(url);

          setProvisioningUrl(url);
          request.respond(200, 'OK');
        } else if (
          request.path === '/v1/message' &&
          request.verb === 'PUT' &&
          request.body
        ) {
          const envelope = Proto.ProvisionEnvelope.decode(request.body);
          request.respond(200, 'OK');
          wsr.close();
          envelopeCallbacks?.resolve(envelope);
        } else {
          log.error('Unknown websocket message', request.path);
        }
      },
    });

    log.info('provisioning socket open');

    wsr.addEventListener('close', ({ code, reason }) => {
      log.info(`provisioning socket closed. Code: ${code} Reason: ${reason}`);

      // Note: if we have resolved the envelope already - this has no effect
      envelopeCallbacks?.reject(new Error('websocket closed'));
    });

    const envelope = await envelopePromise;
    const provisionMessage = await provisioningCipher.decrypt(envelope);

    await this.queueTask(async () => {
      const deviceName = await confirmNumber(provisionMessage.number);
      if (typeof deviceName !== 'string' || deviceName.length === 0) {
        throw new Error(
          'AccountManager.registerSecondDevice: Invalid device name'
        );
      }
      if (
        !provisionMessage.number ||
        !provisionMessage.provisioningCode ||
        !provisionMessage.aciKeyPair ||
        !provisionMessage.pniKeyPair ||
        !provisionMessage.profileKey ||
        !provisionMessage.aci ||
        !isUntaggedPniString(provisionMessage.untaggedPni)
      ) {
        throw new Error(
          'AccountManager.registerSecondDevice: Provision message was missing key data'
        );
      }

      const ourAci = normalizeAci(provisionMessage.aci, 'provisionMessage.aci');
      const ourPni = normalizePni(
        toTaggedPni(provisionMessage.untaggedPni),
        'provisionMessage.pni'
      );

      const registrationBaton = this.server.startRegistration();
      try {
        await this.createAccount({
          type: AccountType.Linked,
          number: provisionMessage.number,
          verificationCode: provisionMessage.provisioningCode,
          aciKeyPair: provisionMessage.aciKeyPair,
          pniKeyPair: provisionMessage.pniKeyPair,
          profileKey: provisionMessage.profileKey,
          deviceName,
          userAgent: provisionMessage.userAgent,
          ourAci,
          ourPni,
          readReceipts: Boolean(provisionMessage.readReceipts),
          masterKey: provisionMessage.masterKey,
        });
      } finally {
        this.server.finishRegistration(registrationBaton);
      }

      await this.registrationDone();
    });
  }

  private getIdentityKeyOrThrow(ourServiceId: ServiceIdString): KeyPairType {
    const { storage } = window.textsecure;
    const store = storage.protocol;
    let identityKey: KeyPairType | undefined;
    try {
      identityKey = store.getIdentityKeyPair(ourServiceId);
    } catch (error) {
      const errorText = Errors.toLogFormat(error);
      throw new Error(
        `getIdentityKeyOrThrow: Failed to fetch identity key - ${errorText}`
      );
    }

    if (!identityKey) {
      throw new Error('getIdentityKeyOrThrow: Missing identity key');
    }

    return identityKey;
  }

  private async generateNewPreKeys(
    serviceIdKind: ServiceIdKind,
    count = PRE_KEY_GEN_BATCH_SIZE
  ): Promise<Array<UploadPreKeyType>> {
    const ourServiceId =
      window.textsecure.storage.user.getCheckedServiceId(serviceIdKind);
    const logId = `AccountManager.generateNewPreKeys(${serviceIdKind})`;
    const { storage } = window.textsecure;
    const store = storage.protocol;

    const startId = getNextKeyId(serviceIdKind, PRE_KEY_ID_KEY);
    log.info(`${logId}: Generating ${count} new keys starting at ${startId}`);

    if (typeof startId !== 'number') {
      throw new Error(
        `${logId}: Invalid ${PRE_KEY_ID_KEY[serviceIdKind]} in storage`
      );
    }

    const toSave: Array<CompatPreKeyType> = [];
    for (let keyId = startId; keyId < startId + count; keyId += 1) {
      toSave.push(generatePreKey(keyId));
    }

    await Promise.all([
      store.storePreKeys(ourServiceId, toSave),
      storage.put(PRE_KEY_ID_KEY[serviceIdKind], startId + count),
    ]);

    return toSave.map(key => ({
      keyId: key.keyId,
      publicKey: key.keyPair.pubKey,
    }));
  }

  private async generateNewKyberPreKeys(
    serviceIdKind: ServiceIdKind,
    count = PRE_KEY_GEN_BATCH_SIZE
  ): Promise<Array<UploadKyberPreKeyType>> {
    const logId = `AccountManager.generateNewKyberPreKeys(${serviceIdKind})`;
    const { storage } = window.textsecure;
    const store = storage.protocol;

    const startId = getNextKeyId(serviceIdKind, KYBER_KEY_ID_KEY);
    log.info(`${logId}: Generating ${count} new keys starting at ${startId}`);

    if (typeof startId !== 'number') {
      throw new Error(
        `${logId}: Invalid ${KYBER_KEY_ID_KEY[serviceIdKind]} in storage`
      );
    }

    const ourServiceId = storage.user.getCheckedServiceId(serviceIdKind);
    const identityKey = this.getIdentityKeyOrThrow(ourServiceId);

    const toSave: Array<Omit<KyberPreKeyType, 'id'>> = [];
    const toUpload: Array<UploadKyberPreKeyType> = [];
    const now = Date.now();
    for (let keyId = startId; keyId < startId + count; keyId += 1) {
      const record = generateKyberPreKey(identityKey, keyId);
      toSave.push({
        createdAt: now,
        data: record.serialize(),
        isConfirmed: false,
        isLastResort: false,
        keyId,
        ourServiceId,
      });
      toUpload.push({
        keyId,
        publicKey: record.publicKey().serialize(),
        signature: record.signature(),
      });
    }

    await Promise.all([
      store.storeKyberPreKeys(ourServiceId, toSave),
      storage.put(KYBER_KEY_ID_KEY[serviceIdKind], startId + count),
    ]);

    return toUpload;
  }

  async maybeUpdateKeys(
    serviceIdKind: ServiceIdKind,
    forceUpdate = false
  ): Promise<void> {
    const logId = `maybeUpdateKeys(${serviceIdKind})`;
    await this.queueTask(async () => {
      const { storage } = window.textsecure;
      let identityKey: KeyPairType;

      try {
        const ourServiceId = storage.user.getCheckedServiceId(serviceIdKind);
        identityKey = this.getIdentityKeyOrThrow(ourServiceId);
      } catch (error) {
        if (serviceIdKind === ServiceIdKind.PNI) {
          log.info(
            `${logId}: Not enough information to update PNI keys`,
            Errors.toLogFormat(error)
          );
          return;
        }

        throw error;
      }

      const { count: preKeyCount, pqCount: kyberPreKeyCount } =
        await this.server.getMyKeyCounts(serviceIdKind);

      let preKeys: Array<UploadPreKeyType> | undefined;
      if (preKeyCount < PRE_KEY_MINIMUM || forceUpdate) {
        log.info(
          `${logId}: Server prekey count is ${preKeyCount}, generating a new set`
        );
        preKeys = await this.generateNewPreKeys(serviceIdKind);
      }

      let pqPreKeys: Array<UploadKyberPreKeyType> | undefined;
      if (kyberPreKeyCount < PRE_KEY_MINIMUM || forceUpdate) {
        log.info(
          `${logId}: Server kyber prekey count is ${kyberPreKeyCount}, generating a new set`
        );
        pqPreKeys = await this.generateNewKyberPreKeys(serviceIdKind);
      }

      const pqLastResortPreKey = await this.maybeUpdateLastResortKyberKey(
        serviceIdKind,
        forceUpdate
      );
      const signedPreKey = await this.maybeUpdateSignedPreKey(
        serviceIdKind,
        forceUpdate
      );

      if (
        !preKeys?.length &&
        !signedPreKey &&
        !pqLastResortPreKey &&
        !pqPreKeys?.length
      ) {
        log.info(`${logId}: No new keys are needed; returning early`);
        return;
      }

      const keySummary: Array<string> = [];
      if (preKeys?.length) {
        keySummary.push(`${preKeys.length} prekeys`);
      }
      if (signedPreKey) {
        keySummary.push('a signed prekey');
      }
      if (pqLastResortPreKey) {
        keySummary.push('a last-resort kyber prekey');
      }
      if (pqPreKeys?.length) {
        keySummary.push(`${pqPreKeys.length} kyber prekeys`);
      }
      log.info(`${logId}: Uploading with ${keySummary.join(', ')}`);

      const toUpload = {
        identityKey: identityKey.pubKey,
        preKeys,
        pqPreKeys,
        pqLastResortPreKey,
        signedPreKey,
      };

      await this.server.registerKeys(toUpload, serviceIdKind);
      await this._confirmKeys(toUpload, serviceIdKind);

      const { count: updatedPreKeyCount, pqCount: updatedKyberPreKeyCount } =
        await this.server.getMyKeyCounts(serviceIdKind);
      log.info(
        `${logId}: Successfully updated; ` +
          `server prekey count: ${updatedPreKeyCount}, ` +
          `server kyber prekey count: ${updatedKyberPreKeyCount}`
      );

      await this._cleanSignedPreKeys(serviceIdKind);
      await this._cleanLastResortKeys(serviceIdKind);
      await this._cleanPreKeys(serviceIdKind);
      await this._cleanKyberPreKeys(serviceIdKind);
    });
  }

  areKeysOutOfDate(serviceIdKind: ServiceIdKind): boolean {
    const signedPreKeyTime = window.storage.get(
      SIGNED_PRE_KEY_UPDATE_TIME_KEY[serviceIdKind],
      0
    );
    const lastResortKeyTime = window.storage.get(
      LAST_RESORT_KEY_UPDATE_TIME_KEY[serviceIdKind],
      0
    );

    if (isOlderThan(signedPreKeyTime, KEY_TOO_OLD_THRESHOLD)) {
      return true;
    }
    if (isOlderThan(lastResortKeyTime, KEY_TOO_OLD_THRESHOLD)) {
      return true;
    }

    return false;
  }

  private async generateSignedPreKey(
    serviceIdKind: ServiceIdKind,
    identityKey: KeyPairType
  ): Promise<CompatSignedPreKeyType> {
    const logId = `AccountManager.generateSignedPreKey(${serviceIdKind})`;

    const signedKeyId = getNextKeyId(serviceIdKind, SIGNED_PRE_KEY_ID_KEY);
    if (typeof signedKeyId !== 'number') {
      throw new Error(
        `${logId}: Invalid ${SIGNED_PRE_KEY_ID_KEY[serviceIdKind]} in storage`
      );
    }

    const key = await generateSignedPreKey(identityKey, signedKeyId);
    log.info(`${logId}: Saving new signed prekey`, key.keyId);

    await window.textsecure.storage.put(
      SIGNED_PRE_KEY_ID_KEY[serviceIdKind],
      signedKeyId + 1
    );

    return key;
  }

  private async maybeUpdateSignedPreKey(
    serviceIdKind: ServiceIdKind,
    forceUpdate = false
  ): Promise<UploadSignedPreKeyType | undefined> {
    const ourServiceId =
      window.textsecure.storage.user.getCheckedServiceId(serviceIdKind);
    const identityKey = this.getIdentityKeyOrThrow(ourServiceId);
    const logId = `AccountManager.maybeUpdateSignedPreKey(${serviceIdKind}, ${ourServiceId})`;
    const store = window.textsecure.storage.protocol;

    const keys = await store.loadSignedPreKeys(ourServiceId);
    const sortedKeys = orderBy(keys, ['created_at'], ['desc']);
    const confirmedKeys = sortedKeys.filter(key => key.confirmed);
    const mostRecent = confirmedKeys[0];

    const lastUpdate = mostRecent?.created_at;
    if (
      !forceUpdate &&
      isMoreRecentThan(lastUpdate || 0, SIGNED_PRE_KEY_ROTATION_AGE)
    ) {
      log.warn(
        `${logId}: ${confirmedKeys.length} confirmed keys, ` +
          `most recent was created ${lastUpdate}. No need to update.`
      );
      const existing = window.storage.get(
        SIGNED_PRE_KEY_UPDATE_TIME_KEY[serviceIdKind]
      );
      if (lastUpdate && !existing) {
        log.warn(`${logId}: Updating last update time to ${lastUpdate}`);
        await window.storage.put(
          SIGNED_PRE_KEY_UPDATE_TIME_KEY[serviceIdKind],
          lastUpdate
        );
      }
      return;
    }

    const key = await this.generateSignedPreKey(serviceIdKind, identityKey);
    log.info(`${logId}: Saving new signed prekey`, key.keyId);

    await store.storeSignedPreKey(ourServiceId, key.keyId, key.keyPair);

    return signedPreKeyToUploadSignedPreKey(key);
  }

  private async generateLastResortKyberKey(
    serviceIdKind: ServiceIdKind,
    identityKey: KeyPairType
  ): Promise<KyberPreKeyRecord> {
    const logId = `generateLastRestortKyberKey(${serviceIdKind})`;

    const kyberKeyId = getNextKeyId(serviceIdKind, KYBER_KEY_ID_KEY);
    if (typeof kyberKeyId !== 'number') {
      throw new Error(
        `${logId}: Invalid ${KYBER_KEY_ID_KEY[serviceIdKind]} in storage`
      );
    }

    const keyId = kyberKeyId;
    const record = await generateKyberPreKey(identityKey, keyId);
    log.info(`${logId}: Saving new last resort prekey`, keyId);

    await window.textsecure.storage.put(
      KYBER_KEY_ID_KEY[serviceIdKind],
      kyberKeyId + 1
    );

    return record;
  }

  private async maybeUpdateLastResortKyberKey(
    serviceIdKind: ServiceIdKind,
    forceUpdate = false
  ): Promise<UploadSignedPreKeyType | undefined> {
    const ourServiceId =
      window.textsecure.storage.user.getCheckedServiceId(serviceIdKind);
    const identityKey = this.getIdentityKeyOrThrow(ourServiceId);
    const logId = `maybeUpdateLastResortKyberKey(${serviceIdKind}, ${ourServiceId})`;
    const store = window.textsecure.storage.protocol;

    const keys = store.loadKyberPreKeys(ourServiceId, { isLastResort: true });
    const sortedKeys = orderBy(keys, ['createdAt'], ['desc']);
    const confirmedKeys = sortedKeys.filter(key => key.isConfirmed);
    const mostRecent = confirmedKeys[0];

    const lastUpdate = mostRecent?.createdAt;
    if (
      !forceUpdate &&
      isMoreRecentThan(lastUpdate || 0, LAST_RESORT_KEY_ROTATION_AGE)
    ) {
      log.warn(
        `${logId}: ${confirmedKeys.length} confirmed keys, ` +
          `most recent was created ${lastUpdate}. No need to update.`
      );
      const existing = window.storage.get(
        LAST_RESORT_KEY_UPDATE_TIME_KEY[serviceIdKind]
      );
      if (lastUpdate && !existing) {
        log.warn(`${logId}: Updating last update time to ${lastUpdate}`);
        await window.storage.put(
          LAST_RESORT_KEY_UPDATE_TIME_KEY[serviceIdKind],
          lastUpdate
        );
      }
      return;
    }

    const record = await this.generateLastResortKyberKey(
      serviceIdKind,
      identityKey
    );
    log.info(`${logId}: Saving new last resort prekey`, record.id());
    const key = kyberPreKeyToStoredSignedPreKey(record, ourServiceId);

    await store.storeKyberPreKeys(ourServiceId, [key]);

    return kyberPreKeyToUploadSignedPreKey(record);
  }

  // Exposed only for tests
  async _cleanSignedPreKeys(serviceIdKind: ServiceIdKind): Promise<void> {
    const ourServiceId =
      window.textsecure.storage.user.getCheckedServiceId(serviceIdKind);
    const store = window.textsecure.storage.protocol;
    const logId = `AccountManager.cleanSignedPreKeys(${serviceIdKind})`;

    const allKeys = store.loadSignedPreKeys(ourServiceId);
    const sortedKeys = orderBy(allKeys, ['created_at'], ['desc']);
    const confirmed = sortedKeys.filter(key => key.confirmed);
    const unconfirmed = sortedKeys.filter(key => !key.confirmed);

    const recent = sortedKeys[0] ? sortedKeys[0].keyId : 'none';
    const recentConfirmed = confirmed[0] ? confirmed[0].keyId : 'none';
    const recentUnconfirmed = unconfirmed[0] ? unconfirmed[0].keyId : 'none';
    log.info(`${logId}: Most recent signed key: ${recent}`);
    log.info(`${logId}: Most recent confirmed signed key: ${recentConfirmed}`);
    log.info(
      `${logId}: Most recent unconfirmed signed key: ${recentUnconfirmed}`
    );
    log.info(
      `${logId}: Total signed key count:`,
      sortedKeys.length,
      '-',
      confirmed.length,
      'confirmed'
    );

    // Keep SIGNED_PRE_KEY_MINIMUM keys, drop if older than SIGNED_PRE_KEY_ARCHIVE_AGE

    const toDelete: Array<number> = [];
    sortedKeys.forEach((key, index) => {
      if (index < SIGNED_PRE_KEY_MINIMUM) {
        return;
      }
      const createdAt = key.created_at || 0;

      if (isOlderThan(createdAt, SIGNED_PRE_KEY_ARCHIVE_AGE)) {
        const timestamp = new Date(createdAt).toJSON();
        const confirmedText = key.confirmed ? ' (confirmed)' : '';
        log.info(
          `${logId}: Removing signed prekey: ${key.keyId} with ` +
            `timestamp ${timestamp}${confirmedText}`
        );
        toDelete.push(key.keyId);
      }
    });
    if (toDelete.length > 0) {
      log.info(`${logId}: Removing ${toDelete.length} signed prekeys`);
      await store.removeSignedPreKeys(ourServiceId, toDelete);
    }
  }

  // Exposed only for tests
  async _cleanLastResortKeys(serviceIdKind: ServiceIdKind): Promise<void> {
    const ourServiceId =
      window.textsecure.storage.user.getCheckedServiceId(serviceIdKind);
    const store = window.textsecure.storage.protocol;
    const logId = `AccountManager.cleanLastResortKeys(${serviceIdKind})`;

    const allKeys = store.loadKyberPreKeys(ourServiceId, {
      isLastResort: true,
    });
    const sortedKeys = orderBy(allKeys, ['createdAt'], ['desc']);
    const confirmed = sortedKeys.filter(key => key.isConfirmed);
    const unconfirmed = sortedKeys.filter(key => !key.isConfirmed);

    const recent = sortedKeys[0] ? sortedKeys[0].keyId : 'none';
    const recentConfirmed = confirmed[0] ? confirmed[0].keyId : 'none';
    const recentUnconfirmed = unconfirmed[0] ? unconfirmed[0].keyId : 'none';
    log.info(`${logId}: Most recent last resort key: ${recent}`);
    log.info(
      `${logId}: Most recent confirmed last resort key: ${recentConfirmed}`
    );
    log.info(
      `${logId}: Most recent unconfirmed last resort key: ${recentUnconfirmed}`
    );
    log.info(
      `${logId}: Total last resort key count:`,
      sortedKeys.length,
      '-',
      confirmed.length,
      'confirmed'
    );

    // Keep LAST_RESORT_KEY_MINIMUM keys, drop if older than LAST_RESORT_KEY_ARCHIVE_AGE

    const toDelete: Array<number> = [];
    sortedKeys.forEach((key, index) => {
      if (index < LAST_RESORT_KEY_MINIMUM) {
        return;
      }
      const createdAt = key.createdAt || 0;

      if (isOlderThan(createdAt, LAST_RESORT_KEY_ARCHIVE_AGE)) {
        const timestamp = new Date(createdAt).toJSON();
        const confirmedText = key.isConfirmed ? ' (confirmed)' : '';
        log.info(
          `${logId}: Removing last resort key: ${key.keyId} with ` +
            `timestamp ${timestamp}${confirmedText}`
        );
        toDelete.push(key.keyId);
      }
    });
    if (toDelete.length > 0) {
      log.info(`${logId}: Removing ${toDelete.length} last resort keys`);
      await store.removeKyberPreKeys(ourServiceId, toDelete);
    }
  }

  async _cleanPreKeys(serviceIdKind: ServiceIdKind): Promise<void> {
    const store = window.textsecure.storage.protocol;
    const logId = `AccountManager.cleanPreKeys(${serviceIdKind})`;
    const ourServiceId =
      window.textsecure.storage.user.getCheckedServiceId(serviceIdKind);

    const preKeys = store.loadPreKeys(ourServiceId);
    const toDelete: Array<number> = [];
    const sortedKeys = orderBy(preKeys, ['createdAt'], ['desc']);

    sortedKeys.forEach((key, index) => {
      if (index < PRE_KEY_MAX_COUNT) {
        return;
      }
      const createdAt = key.createdAt || 0;

      if (isOlderThan(createdAt, PRE_KEY_ARCHIVE_AGE)) {
        toDelete.push(key.keyId);
      }
    });

    log.info(`${logId}: ${sortedKeys.length} total prekeys`);
    if (toDelete.length > 0) {
      log.info(`${logId}: Removing ${toDelete.length} obsolete prekeys`);
      await store.removePreKeys(ourServiceId, toDelete);
    }
  }

  async _cleanKyberPreKeys(serviceIdKind: ServiceIdKind): Promise<void> {
    const store = window.textsecure.storage.protocol;
    const logId = `AccountManager.cleanKyberPreKeys(${serviceIdKind})`;
    const ourServiceId =
      window.textsecure.storage.user.getCheckedServiceId(serviceIdKind);

    const preKeys = store.loadKyberPreKeys(ourServiceId, {
      isLastResort: false,
    });
    const toDelete: Array<number> = [];
    const sortedKeys = orderBy(preKeys, ['createdAt'], ['desc']);

    sortedKeys.forEach((key, index) => {
      if (index < PRE_KEY_MAX_COUNT) {
        return;
      }
      const createdAt = key.createdAt || 0;

      if (isOlderThan(createdAt, PRE_KEY_ARCHIVE_AGE)) {
        toDelete.push(key.keyId);
      }
    });

    log.info(`${logId}: ${sortedKeys.length} total prekeys`);
    if (toDelete.length > 0) {
      log.info(`${logId}: Removing ${toDelete.length} kyber keys`);
      await store.removeKyberPreKeys(ourServiceId, toDelete);
    }
  }

  private async createAccount(
    options: CreateAccountOptionsType
  ): Promise<void> {
    const {
      number,
      verificationCode,
      aciKeyPair,
      pniKeyPair,
      profileKey,
      masterKey,
      readReceipts,
      userAgent,
    } = options;

    const { storage } = window.textsecure;
    let password = Bytes.toBase64(getRandomBytes(16));
    password = password.substring(0, password.length - 2);
    const registrationId = generateRegistrationId();
    const pniRegistrationId = generateRegistrationId();

    const previousNumber = storage.user.getNumber();
    const previousACI = storage.user.getAci();
    const previousPNI = storage.user.getPni();

    log.info(
      `createAccount: Number is ${number}, password has length: ${
        password ? password.length : 'none'
      }`
    );

    let uuidChanged: boolean;
    if (options.type === AccountType.Primary) {
      uuidChanged = true;
    } else if (options.type === AccountType.Linked) {
      uuidChanged = previousACI != null && previousACI !== options.ourAci;
    } else {
      throw missingCaseError(options);
    }

    // We only consider the number changed if we didn't have a UUID before
    const numberChanged =
      !previousACI && previousNumber && previousNumber !== number;

    if (uuidChanged || numberChanged) {
      if (uuidChanged) {
        log.warn(
          'createAccount: New uuid is different from old uuid; deleting all previous data'
        );
      }
      if (numberChanged) {
        log.warn(
          'createAccount: New number is different from old number; deleting all previous data'
        );
      }

      try {
        await storage.protocol.removeAllData();
        log.info('createAccount: Successfully deleted previous data');
      } catch (error) {
        log.error(
          'Something went wrong deleting data from previous number',
          Errors.toLogFormat(error)
        );
      }
    } else {
      log.info('createAccount: Erasing configuration');
      await storage.protocol.removeAllConfiguration();
    }

    await senderCertificateService.clear();

    const previousUuids = [previousACI, previousPNI].filter(isNotNil);

    if (previousUuids.length > 0) {
      await Promise.all([
        storage.put(
          'identityKeyMap',
          omit(storage.get('identityKeyMap') || {}, previousUuids)
        ),
        storage.put(
          'registrationIdMap',
          omit(storage.get('registrationIdMap') || {}, previousUuids)
        ),
      ]);
    }

    let ourAci: AciString;
    let ourPni: PniString;
    let deviceId: number;

    const aciPqLastResortPreKey = await this.generateLastResortKyberKey(
      ServiceIdKind.ACI,
      aciKeyPair
    );
    const pniPqLastResortPreKey = await this.generateLastResortKyberKey(
      ServiceIdKind.PNI,
      pniKeyPair
    );
    const aciSignedPreKey = await this.generateSignedPreKey(
      ServiceIdKind.ACI,
      aciKeyPair
    );
    const pniSignedPreKey = await this.generateSignedPreKey(
      ServiceIdKind.PNI,
      pniKeyPair
    );

    const keysToUpload = {
      aciPqLastResortPreKey: kyberPreKeyToUploadSignedPreKey(
        aciPqLastResortPreKey
      ),
      aciSignedPreKey: signedPreKeyToUploadSignedPreKey(aciSignedPreKey),
      pniPqLastResortPreKey: kyberPreKeyToUploadSignedPreKey(
        pniPqLastResortPreKey
      ),
      pniSignedPreKey: signedPreKeyToUploadSignedPreKey(pniSignedPreKey),
    };

    if (options.type === AccountType.Primary) {
      const response = await this.server.createAccount({
        number,
        code: verificationCode,
        newPassword: password,
        registrationId,
        pniRegistrationId,
        accessKey: options.accessKey,
        sessionId: options.sessionId,
        aciPublicKey: aciKeyPair.pubKey,
        pniPublicKey: pniKeyPair.pubKey,
        ...keysToUpload,
      });

      ourAci = normalizeAci(response.uuid, 'createAccount');
      strictAssert(
        isUntaggedPniString(response.pni),
        'Response pni must be untagged'
      );
      ourPni = toTaggedPni(response.pni);
      deviceId = 1;
    } else if (options.type === AccountType.Linked) {
      const encryptedDeviceName = this.encryptDeviceName(
        options.deviceName,
        aciKeyPair
      );
      await this.deviceNameIsEncrypted();

      const response = await this.server.linkDevice({
        number,
        verificationCode,
        encryptedDeviceName,
        newPassword: password,
        registrationId,
        pniRegistrationId,
        ...keysToUpload,
      });

      ourAci = normalizeAci(response.uuid, 'createAccount');
      strictAssert(
        isUntaggedPniString(response.pni),
        'Response pni must be untagged'
      );
      ourPni = toTaggedPni(response.pni);
      deviceId = response.deviceId ?? 1;

      strictAssert(
        ourAci === options.ourAci,
        'Server response has unexpected ACI'
      );
      strictAssert(
        ourPni === options.ourPni,
        'Server response has unexpected PNI'
      );
    } else {
      throw missingCaseError(options);
    }

    // `setCredentials` needs to be called
    // before `saveIdentifyWithAttributes` since `saveIdentityWithAttributes`
    // indirectly calls `ConversationController.getConversationId()` which
    // initializes the conversation for the given number (our number) which
    // calls out to the user storage API to get the stored UUID and number
    // information.
    await storage.user.setCredentials({
      aci: ourAci,
      pni: ourPni,
      number,
      deviceId,
      deviceName: options.deviceName,
      password,
    });

    // This needs to be done very early, because it changes how things are saved in the
    //   database. Your identity, for example, in the saveIdentityWithAttributes call
    //   below.
    const { conversation } = window.ConversationController.maybeMergeContacts({
      aci: ourAci,
      pni: ourPni,
      e164: number,
      reason: 'createAccount',
    });

    if (!conversation) {
      throw new Error('registrationDone: no conversation!');
    }

    const identityAttrs = {
      firstUse: true,
      timestamp: Date.now(),
      verified: storage.protocol.VerifiedStatus.VERIFIED,
      nonblockingApproval: true,
    };

    // update our own identity key, which may have changed
    // if we're relinking after a reinstall on the master device
    await Promise.all([
      storage.protocol.saveIdentityWithAttributes(ourAci, {
        ...identityAttrs,
        publicKey: aciKeyPair.pubKey,
      }),
      storage.protocol.saveIdentityWithAttributes(ourPni, {
        ...identityAttrs,
        publicKey: pniKeyPair.pubKey,
      }),
    ]);

    const identityKeyMap = {
      ...(storage.get('identityKeyMap') || {}),
      [ourAci]: aciKeyPair,
      [ourPni]: pniKeyPair,
    };
    const registrationIdMap = {
      ...(storage.get('registrationIdMap') || {}),
      [ourAci]: registrationId,
      [ourPni]: pniRegistrationId,
    };

    await storage.put('identityKeyMap', identityKeyMap);
    await storage.put('registrationIdMap', registrationIdMap);
    await ourProfileKeyService.set(profileKey);
    if (userAgent) {
      await storage.put('userAgent', userAgent);
    }
    if (masterKey) {
      await storage.put('masterKey', Bytes.toBase64(masterKey));
    }

    await storage.put('read-receipt-setting', Boolean(readReceipts));

    const regionCode = getRegionCodeForNumber(number);
    await storage.put('regionCode', regionCode);
    await storage.protocol.hydrateCaches();

    const store = storage.protocol;

    await store.storeSignedPreKey(
      ourAci,
      aciSignedPreKey.keyId,
      aciSignedPreKey.keyPair
    );
    await store.storeSignedPreKey(
      ourPni,
      pniSignedPreKey.keyId,
      pniSignedPreKey.keyPair
    );
    await store.storeKyberPreKeys(ourAci, [
      kyberPreKeyToStoredSignedPreKey(aciPqLastResortPreKey, ourAci),
    ]);
    await store.storeKyberPreKeys(ourPni, [
      kyberPreKeyToStoredSignedPreKey(pniPqLastResortPreKey, ourPni),
    ]);

    await this._confirmKeys(
      {
        pqLastResortPreKey: keysToUpload.aciPqLastResortPreKey,
        signedPreKey: keysToUpload.aciSignedPreKey,
      },
      ServiceIdKind.ACI
    );
    await this._confirmKeys(
      {
        pqLastResortPreKey: keysToUpload.pniPqLastResortPreKey,
        signedPreKey: keysToUpload.pniSignedPreKey,
      },
      ServiceIdKind.PNI
    );

    const uploadKeys = async (kind: ServiceIdKind) => {
      try {
        const keys = await this._generateSingleUseKeys(kind);
        await this.server.registerKeys(keys, kind);
      } catch (error) {
        if (kind === ServiceIdKind.PNI) {
          log.error(
            'Failed to upload PNI prekeys. Moving on',
            Errors.toLogFormat(error)
          );
          return;
        }

        throw error;
      }
    };

    await Promise.all([
      uploadKeys(ServiceIdKind.ACI),
      uploadKeys(ServiceIdKind.PNI),
    ]);
  }

  // Exposed only for testing
  public async _confirmKeys(
    {
      signedPreKey,
      pqLastResortPreKey,
    }: Readonly<{
      signedPreKey?: UploadSignedPreKeyType;
      pqLastResortPreKey?: UploadSignedPreKeyType;
    }>,
    serviceIdKind: ServiceIdKind
  ): Promise<void> {
    const ourServiceId =
      window.textsecure.storage.user.getCheckedServiceId(serviceIdKind);
    const logId = `AccountManager.confirmKeys(${serviceIdKind})`;
    const { storage } = window.textsecure;
    const store = storage.protocol;

    const updatedAt = Date.now();
    if (signedPreKey) {
      log.info(`${logId}: confirming signed prekey key`, signedPreKey.keyId);
      await store.confirmSignedPreKey(ourServiceId, signedPreKey.keyId);
      await window.storage.put(
        SIGNED_PRE_KEY_UPDATE_TIME_KEY[serviceIdKind],
        updatedAt
      );
    } else {
      log.info(`${logId}: signedPreKey was not uploaded, not confirming`);
    }

    if (pqLastResortPreKey) {
      log.info(
        `${logId}: confirming last resort key`,
        pqLastResortPreKey.keyId
      );
      await store.confirmKyberPreKey(ourServiceId, pqLastResortPreKey.keyId);
      await window.storage.put(
        LAST_RESORT_KEY_UPDATE_TIME_KEY[serviceIdKind],
        updatedAt
      );
    } else {
      log.info(`${logId}: pqLastResortPreKey was not uploaded, not confirming`);
    }
  }

  // Very similar to maybeUpdateKeys, but will always generate prekeys and doesn't upload
  async _generateSingleUseKeys(
    serviceIdKind: ServiceIdKind,
    count = PRE_KEY_GEN_BATCH_SIZE
  ): Promise<UploadKeysType> {
    const ourServiceId =
      window.textsecure.storage.user.getCheckedServiceId(serviceIdKind);
    const logId = `AccountManager.generateKeys(${serviceIdKind}, ${ourServiceId})`;

    const preKeys = await this.generateNewPreKeys(serviceIdKind, count);
    const pqPreKeys = await this.generateNewKyberPreKeys(serviceIdKind, count);

    log.info(
      `${logId}: Generated ` +
        `${preKeys.length} pre keys, ` +
        `${pqPreKeys.length} kyber pre keys`
    );

    // These are primarily for the summaries they log out
    await this._cleanPreKeys(serviceIdKind);
    await this._cleanKyberPreKeys(serviceIdKind);

    return {
      identityKey: this.getIdentityKeyOrThrow(ourServiceId).pubKey,
      preKeys,
      pqPreKeys,
    };
  }

  private async registrationDone(): Promise<void> {
    log.info('registration done');
    this.dispatchEvent(new Event('registration'));
  }

  async setPni(
    pni: PniString,
    keyMaterial?: PniKeyMaterialType
  ): Promise<void> {
    const logId = `AccountManager.setPni(${pni})`;
    const { storage } = window.textsecure;

    const oldPni = storage.user.getPni();
    if (oldPni === pni && !keyMaterial) {
      return;
    }

    log.info(`${logId}: updating from ${oldPni}`);

    if (oldPni) {
      await storage.protocol.removeOurOldPni(oldPni);
      await window.ConversationController.clearShareMyPhoneNumber();
    }

    await storage.user.setPni(pni);

    if (keyMaterial) {
      await storage.protocol.updateOurPniKeyMaterial(pni, keyMaterial);

      // Intentionally not awaiting since this is processed on encrypted queue
      // of MessageReceiver. Note that `maybeUpdateKeys` runs on the queue so
      // we don't have to wrap it with `queueTask`.
      drop(
        (async () => {
          try {
            await this.maybeUpdateKeys(ServiceIdKind.PNI, true);
          } catch (error) {
            log.error(
              `${logId}: Failed to upload PNI prekeys. Moving on`,
              Errors.toLogFormat(error)
            );
          }
        })()
      );

      // PNI has changed and credentials are no longer valid
      await storage.put('groupCredentials', []);
    } else {
      log.warn(`${logId}: no key material`);
    }
  }
}
