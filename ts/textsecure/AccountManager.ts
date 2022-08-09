// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { omit } from 'lodash';

import EventTarget from './EventTarget';
import type { WebAPIType } from './WebAPI';
import { HTTPError } from './Errors';
import type { KeyPairType, PniKeyMaterialType } from './Types.d';
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
} from '../Curve';
import { UUID, UUIDKind } from '../types/UUID';
import { isMoreRecentThan, isOlderThan } from '../util/timestamp';
import { ourProfileKeyService } from '../services/ourProfileKey';
import { assert, strictAssert } from '../util/assert';
import { getRegionCodeForNumber } from '../util/libphonenumberUtil';
import { getProvisioningUrl } from '../util/getProvisioningUrl';
import { isNotNil } from '../util/isNotNil';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';

const DAY = 24 * 60 * 60 * 1000;
const MINIMUM_SIGNED_PREKEYS = 5;
const ARCHIVE_AGE = 30 * DAY;
const PREKEY_ROTATION_AGE = DAY * 1.5;
const PROFILE_KEY_LENGTH = 32;
const SIGNED_KEY_GEN_BATCH_SIZE = 100;

export type GeneratedKeysType = {
  preKeys: Array<{
    keyId: number;
    publicKey: Uint8Array;
  }>;
  signedPreKey: {
    keyId: number;
    publicKey: Uint8Array;
    signature: Uint8Array;
    keyPair: KeyPairType;
  };
  identityKey: Uint8Array;
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

export default class AccountManager extends EventTarget {
  pending: Promise<void>;

  pendingQueue?: PQueue;

  constructor(private readonly server: WebAPIType) {
    super();

    this.pending = Promise.resolve();
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
      await window.textsecure.storage.protocol.getIdentityKeyPair(ourUuid);
    if (!identityKey) {
      throw new Error('decryptDeviceName: No identity key pair!');
    }

    const bytes = Bytes.fromBase64(base64);
    const proto = Proto.DeviceName.decode(bytes);
    assert(
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
    const identityKeyPair = await storage.protocol.getIdentityKeyPair(
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
    return this.queueTask(async () => {
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

        await this.clearSessionsAndPreKeys();

        await Promise.all(
          [UUIDKind.ACI, UUIDKind.PNI].map(async kind => {
            const keys = await this.generateKeys(
              SIGNED_KEY_GEN_BATCH_SIZE,
              kind
            );
            await this.server.registerKeys(keys, kind);
            await this.confirmKeys(keys, kind);
          })
        );
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
    const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
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

          window.CI?.setProvisioningURL(url);

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
        await clearSessionsAndPreKeys();

        const keyKinds = [UUIDKind.ACI];
        if (provisionMessage.pniKeyPair) {
          keyKinds.push(UUIDKind.PNI);
        }

        await Promise.all(
          keyKinds.map(async kind => {
            const keys = await this.generateKeys(
              SIGNED_KEY_GEN_BATCH_SIZE,
              kind
            );

            try {
              await this.server.registerKeys(keys, kind);
              await this.confirmKeys(keys, kind);
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
          })
        );
      } finally {
        this.server.finishRegistration(registrationBaton);
      }

      await this.registrationDone();
    });
  }

  async refreshPreKeys(uuidKind: UUIDKind): Promise<void> {
    return this.queueTask(async () => {
      const preKeyCount = await this.server.getMyKeys(uuidKind);
      log.info(`prekey count ${preKeyCount}`);
      if (preKeyCount >= 10) {
        return;
      }
      const keys = await this.generateKeys(SIGNED_KEY_GEN_BATCH_SIZE, uuidKind);
      await this.server.registerKeys(keys, uuidKind);
      await this.confirmKeys(keys, uuidKind);
    });
  }

  async rotateSignedPreKey(uuidKind: UUIDKind): Promise<void> {
    return this.queueTask(async () => {
      const ourUuid = window.textsecure.storage.user.getCheckedUuid(uuidKind);
      const signedKeyId = window.textsecure.storage.get('signedKeyId', 1);
      if (typeof signedKeyId !== 'number') {
        throw new Error('Invalid signedKeyId');
      }

      const store = window.textsecure.storage.protocol;
      const { server } = this;

      const existingKeys = await store.loadSignedPreKeys(ourUuid);
      existingKeys.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      const confirmedKeys = existingKeys.filter(key => key.confirmed);
      const mostRecent = confirmedKeys[0];

      if (isMoreRecentThan(mostRecent?.created_at || 0, PREKEY_ROTATION_AGE)) {
        log.warn(
          `rotateSignedPreKey(${uuidKind}): ${confirmedKeys.length} ` +
            `confirmed keys, most recent was created ${mostRecent?.created_at}. Cancelling rotation.`
        );
        return;
      }

      let identityKey: KeyPairType | undefined;
      try {
        identityKey = await store.getIdentityKeyPair(ourUuid);
      } catch (error) {
        // We swallow any error here, because we don't want to get into
        //   a loop of repeated retries.
        log.error(
          'Failed to get identity key. Canceling key rotation.',
          Errors.toLogFormat(error)
        );
        return;
      }

      if (!identityKey) {
        // TODO: DESKTOP-2855
        if (uuidKind === UUIDKind.PNI) {
          log.warn(`rotateSignedPreKey(${uuidKind}): No identity key pair!`);
          return;
        }
        throw new Error(
          `rotateSignedPreKey(${uuidKind}): No identity key pair!`
        );
      }

      const res = await generateSignedPreKey(identityKey, signedKeyId);

      log.info(
        `rotateSignedPreKey(${uuidKind}): Saving new signed prekey`,
        res.keyId
      );

      await Promise.all([
        window.textsecure.storage.put('signedKeyId', signedKeyId + 1),
        store.storeSignedPreKey(ourUuid, res.keyId, res.keyPair),
      ]);

      try {
        await server.setSignedPreKey(
          {
            keyId: res.keyId,
            publicKey: res.keyPair.pubKey,
            signature: res.signature,
          },
          uuidKind
        );
      } catch (error) {
        log.error(
          `rotateSignedPrekey(${uuidKind}) error:`,
          Errors.toLogFormat(error)
        );

        if (
          error instanceof HTTPError &&
          error.code >= 400 &&
          error.code <= 599
        ) {
          const rejections =
            1 + window.textsecure.storage.get('signedKeyRotationRejected', 0);
          await window.textsecure.storage.put(
            'signedKeyRotationRejected',
            rejections
          );
          log.error(
            `rotateSignedPreKey(${uuidKind}): Signed key rotation rejected count:`,
            rejections
          );

          return;
        }

        throw error;
      }

      const confirmed = true;
      log.info('Confirming new signed prekey', res.keyId);
      await Promise.all([
        window.textsecure.storage.remove('signedKeyRotationRejected'),
        store.storeSignedPreKey(ourUuid, res.keyId, res.keyPair, confirmed),
      ]);

      try {
        await this.cleanSignedPreKeys();
      } catch (_error) {
        // Ignoring the error
      }
    });
  }

  async queueTask<T>(task: () => Promise<T>): Promise<T> {
    this.pendingQueue = this.pendingQueue || new PQueue({ concurrency: 1 });
    const taskWithTimeout = createTaskWithTimeout(task, 'AccountManager task');

    return this.pendingQueue.add(taskWithTimeout);
  }

  async cleanSignedPreKeys(): Promise<void> {
    const ourUuid = window.textsecure.storage.user.getCheckedUuid();
    const store = window.textsecure.storage.protocol;

    const allKeys = await store.loadSignedPreKeys(ourUuid);
    allKeys.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    const confirmed = allKeys.filter(key => key.confirmed);
    const unconfirmed = allKeys.filter(key => !key.confirmed);

    const recent = allKeys[0] ? allKeys[0].keyId : 'none';
    const recentConfirmed = confirmed[0] ? confirmed[0].keyId : 'none';
    const recentUnconfirmed = unconfirmed[0] ? unconfirmed[0].keyId : 'none';
    log.info(`cleanSignedPreKeys: Most recent signed key: ${recent}`);
    log.info(
      `cleanSignedPreKeys: Most recent confirmed signed key: ${recentConfirmed}`
    );
    log.info(
      `cleanSignedPreKeys: Most recent unconfirmed signed key: ${recentUnconfirmed}`
    );
    log.info(
      'cleanSignedPreKeys: Total signed key count:',
      allKeys.length,
      '-',
      confirmed.length,
      'confirmed'
    );

    // Keep MINIMUM_SIGNED_PREKEYS keys, then drop if older than ARCHIVE_AGE
    await Promise.all(
      allKeys.map(async (key, index) => {
        if (index < MINIMUM_SIGNED_PREKEYS) {
          return;
        }
        const createdAt = key.created_at || 0;

        if (isOlderThan(createdAt, ARCHIVE_AGE)) {
          const timestamp = new Date(createdAt).toJSON();
          const confirmedText = key.confirmed ? ' (confirmed)' : '';
          log.info(
            `Removing signed prekey: ${key.keyId} with timestamp ${timestamp}${confirmedText}`
          );
          await store.removeSignedPreKey(ourUuid, key.keyId);
        }
      })
    );
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

    const response = await this.server.confirmCode(
      number,
      verificationCode,
      password,
      registrationId,
      encryptedDeviceName,
      { accessKey }
    );

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
          error && error.stack ? error.stack : error
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
    // indirectly calls `ConversationController.getConverationId()` which
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
    const conversationId = window.ConversationController.maybeMergeContacts({
      aci: ourUuid,
      e164: number,
      reason: 'createAccount',
    });

    if (!conversationId) {
      throw new Error('registrationDone: no conversationId!');
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

      // TODO: DESKTOP-3318
      [ourPni]: registrationId,
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

  async clearSessionsAndPreKeys(): Promise<void> {
    const store = window.textsecure.storage.protocol;

    log.info('clearing all sessions, prekeys, and signed prekeys');
    await Promise.all([
      store.clearPreKeyStore(),
      store.clearSignedPreKeysStore(),
      store.clearSessionStore(),
    ]);
  }

  async updatePNIIdentity(identityKeyPair: KeyPairType): Promise<void> {
    const { storage } = window.textsecure;

    log.info('AccountManager.updatePNIIdentity: generating new keys');

    await this.queueTask(async () => {
      // Server has accepted our keys which means we have the latest PNI identity
      // now that doesn't conflict the PNI identity of the primary device.
      log.info(
        'AccountManager.updatePNIIdentity: updating identity key ' +
          'and registration id'
      );

      const pni = storage.user.getCheckedUuid(UUIDKind.PNI);
      const identityKeyMap = {
        ...(storage.get('identityKeyMap') || {}),
        [pni.toString()]: identityKeyPair,
      };

      const aci = storage.user.getCheckedUuid(UUIDKind.ACI);
      const oldRegistrationIdMap = storage.get('registrationIdMap') || {};
      const registrationIdMap = {
        ...oldRegistrationIdMap,

        // TODO: DESKTOP-3318
        [pni.toString()]: oldRegistrationIdMap[aci.toString()],
      };

      await Promise.all([
        storage.put('identityKeyMap', identityKeyMap),
        storage.put('registrationIdMap', registrationIdMap),
      ]);

      await storage.protocol.hydrateCaches();
    });

    // Intentionally not awaiting becase `updatePNIIdentity` runs on an
    // Encrypted queue of MessageReceiver and we don't want to await remote
    // endpoints and block message processing.
    this.queueTask(async () => {
      try {
        const keys = await this.generateKeys(
          SIGNED_KEY_GEN_BATCH_SIZE,
          UUIDKind.PNI,
          identityKeyPair
        );
        await this.server.registerKeys(keys, UUIDKind.PNI);
        await this.confirmKeys(keys, UUIDKind.PNI);
      } catch (error) {
        log.error(
          'updatePNIIdentity: Failed to upload PNI prekeys. Moving on',
          Errors.toLogFormat(error)
        );
      }
    });
  }

  // Takes the same object returned by generateKeys
  async confirmKeys(
    keys: GeneratedKeysType,
    uuidKind: UUIDKind
  ): Promise<void> {
    const store = window.textsecure.storage.protocol;
    const key = keys.signedPreKey;
    const confirmed = true;

    if (!key) {
      throw new Error('confirmKeys: signedPreKey is null');
    }

    log.info(
      `AccountManager.confirmKeys(${uuidKind}): confirming key`,
      key.keyId
    );
    const ourUuid = window.textsecure.storage.user.getCheckedUuid(uuidKind);
    await store.storeSignedPreKey(ourUuid, key.keyId, key.keyPair, confirmed);
  }

  async generateKeys(
    count: number,
    uuidKind: UUIDKind,
    maybeIdentityKey?: KeyPairType
  ): Promise<GeneratedKeysType> {
    const { storage } = window.textsecure;

    const startId = storage.get('maxPreKeyId', 1);
    const signedKeyId = storage.get('signedKeyId', 1);
    const ourUuid = storage.user.getCheckedUuid(uuidKind);

    if (typeof startId !== 'number') {
      throw new Error('Invalid maxPreKeyId');
    }
    if (typeof signedKeyId !== 'number') {
      throw new Error('Invalid signedKeyId');
    }

    const store = storage.protocol;
    const identityKey =
      maybeIdentityKey ?? (await store.getIdentityKeyPair(ourUuid));
    strictAssert(identityKey, 'generateKeys: No identity key pair!');

    const result: Omit<GeneratedKeysType, 'signedPreKey'> = {
      preKeys: [],
      identityKey: identityKey.pubKey,
    };
    const promises = [];

    for (let keyId = startId; keyId < startId + count; keyId += 1) {
      promises.push(
        (async () => {
          const res = generatePreKey(keyId);
          await store.storePreKey(ourUuid, res.keyId, res.keyPair);
          result.preKeys.push({
            keyId: res.keyId,
            publicKey: res.keyPair.pubKey,
          });
        })()
      );
    }

    const signedPreKey = (async () => {
      const res = generateSignedPreKey(identityKey, signedKeyId);
      await store.storeSignedPreKey(ourUuid, res.keyId, res.keyPair);
      return {
        keyId: res.keyId,
        publicKey: res.keyPair.pubKey,
        signature: res.signature,
        // server.registerKeys doesn't use keyPair, confirmKeys does
        keyPair: res.keyPair,
      };
    })();

    promises.push(signedPreKey);
    promises.push(storage.put('maxPreKeyId', startId + count));
    promises.push(storage.put('signedKeyId', signedKeyId + 1));

    await Promise.all(promises);

    // This is primarily for the signed prekey summary it logs out
    this.cleanSignedPreKeys();

    return {
      ...result,
      signedPreKey: await signedPreKey,
    };
  }

  async registrationDone(): Promise<void> {
    log.info('registration done');
    this.dispatchEvent(new Event('registration'));
  }

  async setPni(pni: string, keyMaterial?: PniKeyMaterialType): Promise<void> {
    const { storage } = window.textsecure;

    const oldPni = storage.user.getUuid(UUIDKind.PNI)?.toString();
    if (oldPni === pni && !keyMaterial) {
      return;
    }

    log.info(`AccountManager.setPni(${pni}): updating from ${oldPni}`);

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
      this.queueTask(async () => {
        try {
          const keys = await this.generateKeys(
            SIGNED_KEY_GEN_BATCH_SIZE,
            UUIDKind.PNI
          );
          await this.server.registerKeys(keys, UUIDKind.PNI);
          await this.confirmKeys(keys, UUIDKind.PNI);
        } catch (error) {
          log.error(
            'setPni: Failed to upload PNI prekeys. Moving on',
            Errors.toLogFormat(error)
          );
        }
      });

      // PNI has changed and credentials are no longer valid
      await storage.put('groupCredentials', []);
    } else {
      log.warn(`AccountManager.setPni(${pni}): no key material`);
    }
  }
}
