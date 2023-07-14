// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { isNumber, omit, orderBy } from 'lodash';

import EventTarget from './EventTarget';
import type {
  UploadKeysType,
  UploadKyberPreKeyType,
  UploadPreKeyType,
  UploadSignedPreKeyType,
  WebAPIType,
} from './WebAPI';
import type {
  CompatPreKeyType,
  KeyPairType,
  KyberPreKeyType,
  PniKeyMaterialType,
} from './Types.d';
import ProvisioningCipher from './ProvisioningCipher';
import type { IncomingWebSocketRequest } from './WebsocketResources';
import createTaskWithTimeout from './TaskWithTimeout';
import * as Bytes from '../Bytes';
import { RemoveAllConfiguration } from '../types/RemoveAllConfiguration';
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
import { UUID, UUIDKind } from '../types/UUID';
import { isMoreRecentThan, isOlderThan } from '../util/timestamp';
import { ourProfileKeyService } from '../services/ourProfileKey';
import { assertDev, strictAssert } from '../util/assert';
import { getRegionCodeForNumber } from '../util/libphonenumberUtil';
import { getProvisioningUrl } from '../util/getProvisioningUrl';
import { isNotNil } from '../util/isNotNil';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import type { StorageAccessType } from '../types/Storage';

type StorageKeyByUuidKind = {
  [kind in UUIDKind]: keyof StorageAccessType;
};

const DAY = 24 * 60 * 60 * 1000;

const STARTING_KEY_ID = 1;
const PROFILE_KEY_LENGTH = 32;
const KEY_TOO_OLD_THRESHOLD = 14 * DAY;

export const KYBER_KEY_ID_KEY: StorageKeyByUuidKind = {
  [UUIDKind.ACI]: 'maxKyberPreKeyId',
  [UUIDKind.Unknown]: 'maxKyberPreKeyId',
  [UUIDKind.PNI]: 'maxKyberPreKeyIdPNI',
};

const LAST_RESORT_KEY_ARCHIVE_AGE = 30 * DAY;
const LAST_RESORT_KEY_ROTATION_AGE = DAY * 1.5;
const LAST_RESORT_KEY_MINIMUM = 5;
const LAST_RESORT_KEY_UPDATE_TIME_KEY: StorageKeyByUuidKind = {
  [UUIDKind.ACI]: 'lastResortKeyUpdateTime',
  [UUIDKind.Unknown]: 'lastResortKeyUpdateTime',
  [UUIDKind.PNI]: 'lastResortKeyUpdateTimePNI',
};

const PRE_KEY_ARCHIVE_AGE = 90 * DAY;
const PRE_KEY_GEN_BATCH_SIZE = 100;
const PRE_KEY_MAX_COUNT = 200;
const PRE_KEY_ID_KEY: StorageKeyByUuidKind = {
  [UUIDKind.ACI]: 'maxPreKeyId',
  [UUIDKind.Unknown]: 'maxPreKeyId',
  [UUIDKind.PNI]: 'maxPreKeyIdPNI',
};
const PRE_KEY_MINIMUM = 10;

const SIGNED_PRE_KEY_ARCHIVE_AGE = 30 * DAY;
export const SIGNED_PRE_KEY_ID_KEY: StorageKeyByUuidKind = {
  [UUIDKind.ACI]: 'signedKeyId',
  [UUIDKind.Unknown]: 'signedKeyId',
  [UUIDKind.PNI]: 'signedKeyIdPNI',
};

const SIGNED_PRE_KEY_ROTATION_AGE = DAY * 1.5;
const SIGNED_PRE_KEY_MINIMUM = 5;
const SIGNED_PRE_KEY_UPDATE_TIME_KEY: StorageKeyByUuidKind = {
  [UUIDKind.ACI]: 'signedKeyUpdateTime',
  [UUIDKind.Unknown]: 'signedKeyUpdateTime',
  [UUIDKind.PNI]: 'signedKeyUpdateTimePNI',
};

type CreateAccountOptionsType = Readonly<{
  number: string;
  verificationCode: string;
  aciKeyPair: KeyPairType;
  pniKeyPair?: KeyPairType;
  profileKey?: Uint8Array;
  deviceName?: string;
  userAgent?: string;
  readReceipts?: boolean;
  accessKey?: Uint8Array;
}>;

function getNextKeyId(kind: UUIDKind, keys: StorageKeyByUuidKind): number {
  const id = window.storage.get(keys[kind]);

  if (isNumber(id)) {
    return id;
  }

  // For PNI ids, start with existing ACI id
  if (kind === UUIDKind.PNI) {
    return window.storage.get(keys[UUIDKind.ACI], STARTING_KEY_ID);
  }

  return STARTING_KEY_ID;
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

  async requestVoiceVerification(number: string, token: string): Promise<void> {
    return this.server.requestVerificationVoice(number, token);
  }

  async requestSMSVerification(number: string, token: string): Promise<void> {
    return this.server.requestVerificationSMS(number, token);
  }

  encryptDeviceName(name: string, identityKey: KeyPairType): string | null {
    if (!name) {
      return null;
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
    const ourUuid = window.textsecure.storage.user.getCheckedUuid();
    const identityKey =
      window.textsecure.storage.protocol.getIdentityKeyPair(ourUuid);
    if (!identityKey) {
      throw new Error('decryptDeviceName: No identity key pair!');
    }

    const bytes = Bytes.fromBase64(base64);
    const proto = Proto.DeviceName.decode(bytes);
    assertDev(
      proto.ephemeralPublic && proto.syntheticIv && proto.ciphertext,
      'Missing required fields in DeviceName'
    );

    const name = decryptDeviceName(proto, identityKey.privKey);

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
      storage.user.getCheckedUuid()
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
    verificationCode: string
  ): Promise<void> {
    await this.queueTask(async () => {
      const aciKeyPair = generateKeyPair();
      const pniKeyPair = generateKeyPair();
      const profileKey = getRandomBytes(PROFILE_KEY_LENGTH);
      const accessKey = deriveAccessKey(profileKey);

      const registrationBaton = this.server.startRegistration();
      try {
        await this.createAccount({
          number,
          verificationCode,
          aciKeyPair,
          pniKeyPair,
          profileKey,
          accessKey,
        });

        const uploadKeys = async (kind: UUIDKind) => {
          const keys = await this._generateKeys(PRE_KEY_GEN_BATCH_SIZE, kind);
          await this.server.registerKeys(keys, kind);
          await this._confirmKeys(keys, kind);
        };

        await uploadKeys(UUIDKind.ACI);
        await uploadKeys(UUIDKind.PNI);
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
          const url = getProvisioningUrl(uuid, pubKey);

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
        !provisionMessage.aciKeyPair
      ) {
        throw new Error(
          'AccountManager.registerSecondDevice: Provision message was missing key data'
        );
      }

      const registrationBaton = this.server.startRegistration();

      try {
        await this.createAccount({
          number: provisionMessage.number,
          verificationCode: provisionMessage.provisioningCode,
          aciKeyPair: provisionMessage.aciKeyPair,
          pniKeyPair: provisionMessage.pniKeyPair,
          profileKey: provisionMessage.profileKey,
          deviceName,
          userAgent: provisionMessage.userAgent,
          readReceipts: provisionMessage.readReceipts,
        });

        const uploadKeys = async (kind: UUIDKind) => {
          const keys = await this._generateKeys(PRE_KEY_GEN_BATCH_SIZE, kind);

          try {
            await this.server.registerKeys(keys, kind);
            await this._confirmKeys(keys, kind);
          } catch (error) {
            if (kind === UUIDKind.PNI) {
              log.error(
                'Failed to upload PNI prekeys. Moving on',
                Errors.toLogFormat(error)
              );
              return;
            }

            throw error;
          }
        };

        await uploadKeys(UUIDKind.ACI);
        if (provisionMessage.pniKeyPair) {
          await uploadKeys(UUIDKind.PNI);
        }
      } finally {
        this.server.finishRegistration(registrationBaton);
      }

      await this.registrationDone();
    });
  }

  private getIdentityKeyOrThrow(ourUuid: UUID): KeyPairType {
    const { storage } = window.textsecure;
    const store = storage.protocol;
    let identityKey: KeyPairType | undefined;
    try {
      identityKey = store.getIdentityKeyPair(ourUuid);
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
    uuidKind: UUIDKind,
    count: number
  ): Promise<Array<UploadPreKeyType>> {
    const logId = `AccountManager.generateNewPreKeys(${uuidKind})`;
    const { storage } = window.textsecure;
    const store = storage.protocol;

    const startId = getNextKeyId(uuidKind, PRE_KEY_ID_KEY);
    log.info(`${logId}: Generating ${count} new keys starting at ${startId}`);

    const ourUuid = storage.user.getCheckedUuid(uuidKind);
    if (typeof startId !== 'number') {
      throw new Error(
        `${logId}: Invalid ${PRE_KEY_ID_KEY[uuidKind]} in storage`
      );
    }

    const toSave: Array<CompatPreKeyType> = [];
    for (let keyId = startId; keyId < startId + count; keyId += 1) {
      toSave.push(generatePreKey(keyId));
    }

    await Promise.all([
      store.storePreKeys(ourUuid, toSave),
      storage.put(PRE_KEY_ID_KEY[uuidKind], startId + count),
    ]);

    return toSave.map(key => ({
      keyId: key.keyId,
      publicKey: key.keyPair.pubKey,
    }));
  }

  private async generateNewKyberPreKeys(
    uuidKind: UUIDKind,
    count: number
  ): Promise<Array<UploadKyberPreKeyType>> {
    const logId = `AccountManager.generateNewKyberPreKeys(${uuidKind})`;
    const { storage } = window.textsecure;
    const store = storage.protocol;

    const startId = getNextKeyId(uuidKind, KYBER_KEY_ID_KEY);
    log.info(`${logId}: Generating ${count} new keys starting at ${startId}`);

    const ourUuid = storage.user.getCheckedUuid(uuidKind);
    if (typeof startId !== 'number') {
      throw new Error(
        `${logId}: Invalid ${KYBER_KEY_ID_KEY[uuidKind]} in storage`
      );
    }

    const identityKey = this.getIdentityKeyOrThrow(ourUuid);

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
        ourUuid: ourUuid.toString(),
      });
      toUpload.push({
        keyId,
        publicKey: record.publicKey().serialize(),
        signature: record.signature(),
      });
    }

    await Promise.all([
      store.storeKyberPreKeys(ourUuid, toSave),
      storage.put(KYBER_KEY_ID_KEY[uuidKind], startId + count),
    ]);

    return toUpload;
  }

  async maybeUpdateKeys(uuidKind: UUIDKind): Promise<void> {
    const logId = `maybeUpdateKeys(${uuidKind})`;
    await this.queueTask(async () => {
      const { count: preKeyCount, pqCount: kyberPreKeyCount } =
        await this.server.getMyKeyCounts(uuidKind);

      let preKeys: Array<UploadPreKeyType> | undefined;
      if (preKeyCount < PRE_KEY_MINIMUM) {
        log.info(
          `${logId}: Server prekey count is ${preKeyCount}, generating a new set`
        );
        preKeys = await this.generateNewPreKeys(
          uuidKind,
          PRE_KEY_GEN_BATCH_SIZE
        );
      }

      let pqPreKeys: Array<UploadKyberPreKeyType> | undefined;
      if (kyberPreKeyCount < PRE_KEY_MINIMUM) {
        log.info(
          `${logId}: Server kyber prekey count is ${kyberPreKeyCount}, generating a new set`
        );
        pqPreKeys = await this.generateNewKyberPreKeys(
          uuidKind,
          PRE_KEY_GEN_BATCH_SIZE
        );
      }

      const pqLastResortPreKey = await this.maybeUpdateLastResortKyberKey(
        uuidKind
      );
      const signedPreKey = await this.maybeUpdateSignedPreKey(uuidKind);

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
        keySummary.push(`${!preKeys?.length || 0} prekeys`);
      }
      if (signedPreKey) {
        keySummary.push('a signed prekey');
      }
      if (pqLastResortPreKey) {
        keySummary.push('a last-resort kyber prekey');
      }
      if (pqPreKeys?.length) {
        keySummary.push(`${!pqPreKeys?.length || 0} kyber prekeys`);
      }
      log.info(`${logId}: Uploading with ${keySummary.join(', ')}`);

      const { storage } = window.textsecure;
      const ourUuid = storage.user.getCheckedUuid(uuidKind);
      const identityKey = this.getIdentityKeyOrThrow(ourUuid);
      const toUpload = {
        identityKey: identityKey.pubKey,
        preKeys,
        pqPreKeys,
        pqLastResortPreKey,
        signedPreKey,
      };

      try {
        await this.server.registerKeys(toUpload, uuidKind);
      } catch (error) {
        log.error(`${logId} upload error:`, Errors.toLogFormat(error));

        throw error;
      }

      await this._confirmKeys(toUpload, uuidKind);

      const { count: updatedPreKeyCount, pqCount: updatedKyberPreKeyCount } =
        await this.server.getMyKeyCounts(uuidKind);
      log.info(
        `${logId}: Successfully updated; ` +
          `server prekey count: ${updatedPreKeyCount}, ` +
          `server kyber prekey count: ${updatedKyberPreKeyCount}`
      );

      await this._cleanSignedPreKeys(uuidKind);
      await this._cleanLastResortKeys(uuidKind);
      await this._cleanPreKeys(uuidKind);
      await this._cleanKyberPreKeys(uuidKind);
    });
  }

  areKeysOutOfDate(uuidKind: UUIDKind): boolean {
    const signedPreKeyTime = window.storage.get(
      SIGNED_PRE_KEY_UPDATE_TIME_KEY[uuidKind],
      0
    );
    const lastResortKeyTime = window.storage.get(
      LAST_RESORT_KEY_UPDATE_TIME_KEY[uuidKind],
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

  private async maybeUpdateSignedPreKey(
    uuidKind: UUIDKind
  ): Promise<UploadSignedPreKeyType | undefined> {
    const logId = `AccountManager.maybeUpdateSignedPreKey(${uuidKind})`;
    const store = window.textsecure.storage.protocol;

    const ourUuid = window.textsecure.storage.user.getCheckedUuid(uuidKind);
    const signedKeyId = getNextKeyId(uuidKind, SIGNED_PRE_KEY_ID_KEY);
    if (typeof signedKeyId !== 'number') {
      throw new Error(
        `${logId}: Invalid ${SIGNED_PRE_KEY_ID_KEY[uuidKind]} in storage`
      );
    }

    const keys = await store.loadSignedPreKeys(ourUuid);
    const sortedKeys = orderBy(keys, ['created_at'], ['desc']);
    const confirmedKeys = sortedKeys.filter(key => key.confirmed);
    const mostRecent = confirmedKeys[0];

    const lastUpdate = mostRecent?.created_at;
    if (isMoreRecentThan(lastUpdate || 0, SIGNED_PRE_KEY_ROTATION_AGE)) {
      log.warn(
        `${logId}: ${confirmedKeys.length} confirmed keys, ` +
          `most recent was created ${lastUpdate}. No need to update.`
      );
      const existing = window.storage.get(
        SIGNED_PRE_KEY_UPDATE_TIME_KEY[uuidKind]
      );
      if (lastUpdate && !existing) {
        log.warn(`${logId}: Updating last update time to ${lastUpdate}`);
        await window.storage.put(
          SIGNED_PRE_KEY_UPDATE_TIME_KEY[uuidKind],
          lastUpdate
        );
      }
      return;
    }

    const identityKey = this.getIdentityKeyOrThrow(ourUuid);

    const key = await generateSignedPreKey(identityKey, signedKeyId);
    log.info(`${logId}: Saving new signed prekey`, key.keyId);

    await Promise.all([
      window.textsecure.storage.put(
        SIGNED_PRE_KEY_ID_KEY[uuidKind],
        signedKeyId + 1
      ),
      store.storeSignedPreKey(ourUuid, key.keyId, key.keyPair),
    ]);

    return {
      keyId: key.keyId,
      publicKey: key.keyPair.pubKey,
      signature: key.signature,
    };
  }

  private async maybeUpdateLastResortKyberKey(
    uuidKind: UUIDKind
  ): Promise<UploadSignedPreKeyType | undefined> {
    const logId = `maybeUpdateLastResortKyberKey(${uuidKind})`;
    const store = window.textsecure.storage.protocol;

    const ourUuid = window.textsecure.storage.user.getCheckedUuid(uuidKind);
    const kyberKeyId = getNextKeyId(uuidKind, KYBER_KEY_ID_KEY);
    if (typeof kyberKeyId !== 'number') {
      throw new Error(
        `${logId}: Invalid ${KYBER_KEY_ID_KEY[uuidKind]} in storage`
      );
    }

    const keys = store.loadKyberPreKeys(ourUuid, { isLastResort: true });
    const sortedKeys = orderBy(keys, ['createdAt'], ['desc']);
    const confirmedKeys = sortedKeys.filter(key => key.isConfirmed);
    const mostRecent = confirmedKeys[0];

    const lastUpdate = mostRecent?.createdAt;
    if (isMoreRecentThan(lastUpdate || 0, LAST_RESORT_KEY_ROTATION_AGE)) {
      log.warn(
        `${logId}: ${confirmedKeys.length} confirmed keys, ` +
          `most recent was created ${lastUpdate}. No need to update.`
      );
      const existing = window.storage.get(
        LAST_RESORT_KEY_UPDATE_TIME_KEY[uuidKind]
      );
      if (lastUpdate && !existing) {
        log.warn(`${logId}: Updating last update time to ${lastUpdate}`);
        await window.storage.put(
          LAST_RESORT_KEY_UPDATE_TIME_KEY[uuidKind],
          lastUpdate
        );
      }
      return;
    }

    const identityKey = this.getIdentityKeyOrThrow(ourUuid);

    const keyId = kyberKeyId;
    const record = await generateKyberPreKey(identityKey, keyId);
    log.info(`${logId}: Saving new last resort prekey`, keyId);
    const key = {
      createdAt: Date.now(),
      data: record.serialize(),
      isConfirmed: false,
      isLastResort: true,
      keyId,
      ourUuid: ourUuid.toString(),
    };

    await Promise.all([
      window.textsecure.storage.put(KYBER_KEY_ID_KEY[uuidKind], kyberKeyId + 1),
      store.storeKyberPreKeys(ourUuid, [key]),
    ]);

    return {
      keyId,
      publicKey: record.publicKey().serialize(),
      signature: record.signature(),
    };
  }

  // Exposed only for tests
  async _cleanSignedPreKeys(uuidKind: UUIDKind): Promise<void> {
    const ourUuid = window.textsecure.storage.user.getCheckedUuid(uuidKind);
    const store = window.textsecure.storage.protocol;
    const logId = `AccountManager.cleanSignedPreKeys(${uuidKind})`;

    const allKeys = store.loadSignedPreKeys(ourUuid);
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
      await store.removeSignedPreKeys(ourUuid, toDelete);
    }
  }

  // Exposed only for tests
  async _cleanLastResortKeys(uuidKind: UUIDKind): Promise<void> {
    const ourUuid = window.textsecure.storage.user.getCheckedUuid(uuidKind);
    const store = window.textsecure.storage.protocol;
    const logId = `AccountManager.cleanLastResortKeys(${uuidKind})`;

    const allKeys = store.loadKyberPreKeys(ourUuid, { isLastResort: true });
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
      await store.removeKyberPreKeys(ourUuid, toDelete);
    }
  }

  async _cleanPreKeys(uuidKind: UUIDKind): Promise<void> {
    const ourUuid = window.textsecure.storage.user.getCheckedUuid(uuidKind);
    const store = window.textsecure.storage.protocol;
    const logId = `AccountManager.cleanPreKeys(${uuidKind})`;

    const preKeys = store.loadPreKeys(ourUuid);
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
      await store.removePreKeys(ourUuid, toDelete);
    }
  }

  async _cleanKyberPreKeys(uuidKind: UUIDKind): Promise<void> {
    const ourUuid = window.textsecure.storage.user.getCheckedUuid(uuidKind);
    const store = window.textsecure.storage.protocol;
    const logId = `AccountManager.cleanKyberPreKeys(${uuidKind})`;

    const preKeys = store.loadKyberPreKeys(ourUuid, { isLastResort: false });
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
      await store.removeKyberPreKeys(ourUuid, toDelete);
    }
  }

  async createAccount({
    number,
    verificationCode,
    aciKeyPair,
    pniKeyPair,
    profileKey,
    deviceName,
    userAgent,
    readReceipts,
    accessKey,
  }: CreateAccountOptionsType): Promise<void> {
    const { storage } = window.textsecure;
    let password = Bytes.toBase64(getRandomBytes(16));
    password = password.substring(0, password.length - 2);
    const registrationId = generateRegistrationId();
    const pniRegistrationId = generateRegistrationId();

    const previousNumber = storage.user.getNumber();
    const previousACI = storage.user.getUuid(UUIDKind.ACI)?.toString();
    const previousPNI = storage.user.getUuid(UUIDKind.PNI)?.toString();

    let encryptedDeviceName;
    if (deviceName) {
      encryptedDeviceName = this.encryptDeviceName(deviceName, aciKeyPair);
      await this.deviceNameIsEncrypted();
    }

    log.info(
      `createAccount: Number is ${number}, password has length: ${
        password ? password.length : 'none'
      }`
    );

    const response = await this.server.confirmCode({
      number,
      code: verificationCode,
      newPassword: password,
      registrationId,
      pniRegistrationId,
      deviceName: encryptedDeviceName,
      accessKey,
    });

    const ourUuid = UUID.cast(response.uuid);
    const ourPni = UUID.cast(response.pni);

    const uuidChanged = previousACI && ourUuid && previousACI !== ourUuid;

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
      log.info('createAccount: Erasing configuration (soft)');
      await storage.protocol.removeAllConfiguration(
        RemoveAllConfiguration.Soft
      );
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

    // `setCredentials` needs to be called
    // before `saveIdentifyWithAttributes` since `saveIdentityWithAttributes`
    // indirectly calls `ConversationController.getConversationId()` which
    // initializes the conversation for the given number (our number) which
    // calls out to the user storage API to get the stored UUID and number
    // information.
    await storage.user.setCredentials({
      uuid: ourUuid,
      pni: ourPni,
      number,
      deviceId: response.deviceId ?? 1,
      deviceName: deviceName ?? undefined,
      password,
    });

    // This needs to be done very early, because it changes how things are saved in the
    //   database. Your identity, for example, in the saveIdentityWithAttributes call
    //   below.
    const { conversation } = window.ConversationController.maybeMergeContacts({
      aci: ourUuid,
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
      storage.protocol.saveIdentityWithAttributes(new UUID(ourUuid), {
        ...identityAttrs,
        publicKey: aciKeyPair.pubKey,
      }),
      pniKeyPair
        ? storage.protocol.saveIdentityWithAttributes(new UUID(ourPni), {
            ...identityAttrs,
            publicKey: pniKeyPair.pubKey,
          })
        : Promise.resolve(),
    ]);

    const identityKeyMap = {
      ...(storage.get('identityKeyMap') || {}),
      [ourUuid]: aciKeyPair,
      ...(pniKeyPair
        ? {
            [ourPni]: pniKeyPair,
          }
        : {}),
    };
    const registrationIdMap = {
      ...(storage.get('registrationIdMap') || {}),
      [ourUuid]: registrationId,
      [ourPni]: pniRegistrationId,
    };

    await storage.put('identityKeyMap', identityKeyMap);
    await storage.put('registrationIdMap', registrationIdMap);
    if (profileKey) {
      await ourProfileKeyService.set(profileKey);
    }
    if (userAgent) {
      await storage.put('userAgent', userAgent);
    }

    await storage.put('read-receipt-setting', Boolean(readReceipts));

    const regionCode = getRegionCodeForNumber(number);
    await storage.put('regionCode', regionCode);
    await storage.protocol.hydrateCaches();
  }

  // Exposed only for testing
  public async _confirmKeys(
    keys: UploadKeysType,
    uuidKind: UUIDKind
  ): Promise<void> {
    const logId = `AccountManager.confirmKeys(${uuidKind})`;
    const { storage } = window.textsecure;
    const store = storage.protocol;
    const ourUuid = storage.user.getCheckedUuid(uuidKind);

    const updatedAt = Date.now();
    const { signedPreKey, pqLastResortPreKey } = keys;
    if (signedPreKey) {
      log.info(`${logId}: confirming signed prekey key`, signedPreKey.keyId);
      await store.confirmSignedPreKey(ourUuid, signedPreKey.keyId);
      await window.storage.put(
        SIGNED_PRE_KEY_UPDATE_TIME_KEY[uuidKind],
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
      await store.confirmKyberPreKey(ourUuid, pqLastResortPreKey.keyId);
      await window.storage.put(
        LAST_RESORT_KEY_UPDATE_TIME_KEY[uuidKind],
        updatedAt
      );
    } else {
      log.info(`${logId}: pqLastResortPreKey was not uploaded, not confirming`);
    }
  }

  // Very similar to maybeUpdateKeys, but will always generate prekeys and doesn't upload
  async _generateKeys(
    count: number,
    uuidKind: UUIDKind,
    maybeIdentityKey?: KeyPairType
  ): Promise<UploadKeysType> {
    const logId = `AcountManager.generateKeys(${uuidKind})`;
    const { storage } = window.textsecure;
    const store = storage.protocol;
    const ourUuid = storage.user.getCheckedUuid(uuidKind);

    const identityKey = maybeIdentityKey ?? store.getIdentityKeyPair(ourUuid);
    strictAssert(identityKey, 'generateKeys: No identity key pair!');

    const preKeys = await this.generateNewPreKeys(uuidKind, count);
    const pqPreKeys = await this.generateNewKyberPreKeys(uuidKind, count);
    const pqLastResortPreKey = await this.maybeUpdateLastResortKyberKey(
      uuidKind
    );
    const signedPreKey = await this.maybeUpdateSignedPreKey(uuidKind);

    log.info(
      `${logId}: Generated ` +
        `${preKeys.length} pre keys, ` +
        `${pqPreKeys.length} kyber pre keys, ` +
        `${pqLastResortPreKey ? 'a' : 'NO'} last resort kyber pre key, ` +
        `and ${signedPreKey ? 'a' : 'NO'} signed pre key.`
    );

    // These are primarily for the summaries they log out
    await this._cleanPreKeys(uuidKind);
    await this._cleanKyberPreKeys(uuidKind);
    await this._cleanLastResortKeys(uuidKind);
    await this._cleanSignedPreKeys(uuidKind);

    return {
      identityKey: identityKey.pubKey,
      preKeys,
      pqPreKeys,
      pqLastResortPreKey,
      signedPreKey,
    };
  }

  private async registrationDone(): Promise<void> {
    log.info('registration done');
    this.dispatchEvent(new Event('registration'));
  }

  async setPni(pni: string, keyMaterial?: PniKeyMaterialType): Promise<void> {
    const logId = `AccountManager.setPni(${pni})`;
    const { storage } = window.textsecure;

    const oldPni = storage.user.getUuid(UUIDKind.PNI)?.toString();
    if (oldPni === pni && !keyMaterial) {
      return;
    }

    log.info(`${logId}: updating from ${oldPni}`);

    if (oldPni) {
      await storage.protocol.removeOurOldPni(new UUID(oldPni));
    }

    await storage.user.setPni(pni);

    if (keyMaterial) {
      await storage.protocol.updateOurPniKeyMaterial(
        new UUID(pni),
        keyMaterial
      );

      // Intentionally not awaiting since this is processed on encrypted queue
      // of MessageReceiver.
      void this.queueTask(async () => {
        try {
          await this.maybeUpdateKeys(UUIDKind.PNI);
        } catch (error) {
          log.error(
            `${logId}: Failed to upload PNI prekeys. Moving on`,
            Errors.toLogFormat(error)
          );
        }
      });

      // PNI has changed and credentials are no longer valid
      await storage.put('groupCredentials', []);
    } else {
      log.warn(`${logId}: no key material`);
    }
  }
}
