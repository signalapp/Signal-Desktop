// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable more/no-then */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import PQueue from 'p-queue';

import EventTarget from './EventTarget';
import { WebAPIType } from './WebAPI';
import MessageReceiver from './MessageReceiver';
import { KeyPairType, SignedPreKeyType } from '../libsignal.d';
import utils from './Helpers';
import ProvisioningCipher from './ProvisioningCipher';
import WebSocketResource, {
  IncomingWebSocketRequest,
} from './WebsocketResources';
import { isMoreRecentThan, isOlderThan } from '../util/timestamp';

const ARCHIVE_AGE = 30 * 24 * 60 * 60 * 1000;
const PREKEY_ROTATION_AGE = 24 * 60 * 60 * 1000;

function getIdentifier(id: string) {
  if (!id || !id.length) {
    return id;
  }

  const parts = id.split('.');
  if (!parts.length) {
    return id;
  }

  return parts[0];
}

type GeneratedKeysType = {
  preKeys: Array<{
    keyId: number;
    publicKey: ArrayBuffer;
  }>;
  signedPreKey: {
    keyId: number;
    publicKey: ArrayBuffer;
    signature: ArrayBuffer;
    keyPair: KeyPairType;
  };
  identityKey: ArrayBuffer;
};

export default class AccountManager extends EventTarget {
  server: WebAPIType;

  pending: Promise<void>;

  pendingQueue?: PQueue;

  constructor(username: string, password: string) {
    super();

    this.server = window.WebAPI.connect({ username, password });
    this.pending = Promise.resolve();
  }

  async requestVoiceVerification(number: string) {
    return this.server.requestVerificationVoice(number);
  }

  async requestSMSVerification(number: string) {
    return this.server.requestVerificationSMS(number);
  }

  async encryptDeviceName(name: string, providedIdentityKey?: KeyPairType) {
    if (!name) {
      return null;
    }
    const identityKey =
      providedIdentityKey ||
      (await window.textsecure.storage.protocol.getIdentityKeyPair());
    if (!identityKey) {
      throw new Error('Identity key was not provided and is not in database!');
    }
    const encrypted = await window.Signal.Crypto.encryptDeviceName(
      name,
      identityKey.pubKey
    );

    const proto = new window.textsecure.protobuf.DeviceName();
    proto.ephemeralPublic = encrypted.ephemeralPublic;
    proto.syntheticIv = encrypted.syntheticIv;
    proto.ciphertext = encrypted.ciphertext;

    const arrayBuffer = proto.encode().toArrayBuffer();
    return MessageReceiver.arrayBufferToStringBase64(arrayBuffer);
  }

  async decryptDeviceName(base64: string) {
    const identityKey = await window.textsecure.storage.protocol.getIdentityKeyPair();

    const arrayBuffer = MessageReceiver.stringToArrayBufferBase64(base64);
    const proto = window.textsecure.protobuf.DeviceName.decode(arrayBuffer);
    const encrypted = {
      ephemeralPublic: proto.ephemeralPublic.toArrayBuffer(),
      syntheticIv: proto.syntheticIv.toArrayBuffer(),
      ciphertext: proto.ciphertext.toArrayBuffer(),
    };

    const name = await window.Signal.Crypto.decryptDeviceName(
      encrypted,
      identityKey.privKey
    );

    return name;
  }

  async maybeUpdateDeviceName() {
    const isNameEncrypted = window.textsecure.storage.user.getDeviceNameEncrypted();
    if (isNameEncrypted) {
      return;
    }
    const deviceName = window.textsecure.storage.user.getDeviceName();
    const base64 = await this.encryptDeviceName(deviceName);

    if (base64) {
      await this.server.updateDeviceName(base64);
    }
  }

  async deviceNameIsEncrypted() {
    await window.textsecure.storage.user.setDeviceNameEncrypted();
  }

  async maybeDeleteSignalingKey() {
    const key = window.textsecure.storage.user.getSignalingKey();
    if (key) {
      await this.server.removeSignalingKey();
    }
  }

  async registerSingleDevice(number: string, verificationCode: string) {
    const registerKeys = this.server.registerKeys.bind(this.server);
    const createAccount = this.createAccount.bind(this);
    const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
    const generateKeys = this.generateKeys.bind(this, 100);
    const confirmKeys = this.confirmKeys.bind(this);
    const registrationDone = this.registrationDone.bind(this);
    return this.queueTask(async () =>
      window.libsignal.KeyHelper.generateIdentityKeyPair().then(
        async identityKeyPair => {
          const profileKey = window.libsignal.crypto.getRandomBytes(32);
          const accessKey = await window.Signal.Crypto.deriveAccessKey(
            profileKey
          );

          return createAccount(
            number,
            verificationCode,
            identityKeyPair,
            profileKey,
            null,
            null,
            null,
            { accessKey }
          )
            .then(clearSessionsAndPreKeys)
            .then(async () => generateKeys())
            .then(async (keys: GeneratedKeysType) =>
              registerKeys(keys).then(async () => confirmKeys(keys))
            )
            .then(async () => registrationDone());
        }
      )
    );
  }

  async registerSecondDevice(
    setProvisioningUrl: Function,
    confirmNumber: (number?: string) => Promise<string>,
    progressCallback: Function
  ) {
    const createAccount = this.createAccount.bind(this);
    const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
    const generateKeys = this.generateKeys.bind(this, 100, progressCallback);
    const confirmKeys = this.confirmKeys.bind(this);
    const registrationDone = this.registrationDone.bind(this);
    const registerKeys = this.server.registerKeys.bind(this.server);
    const getSocket = this.server.getProvisioningSocket.bind(this.server);
    const queueTask = this.queueTask.bind(this);
    const provisioningCipher = new ProvisioningCipher();
    let gotProvisionEnvelope = false;
    return provisioningCipher.getPublicKey().then(
      async (pubKey: ArrayBuffer) =>
        new Promise((resolve, reject) => {
          const socket = getSocket();
          socket.onclose = event => {
            window.log.info('provisioning socket closed. Code:', event.code);
            if (!gotProvisionEnvelope) {
              reject(new Error('websocket closed'));
            }
          };
          socket.onopen = () => {
            window.log.info('provisioning socket open');
          };
          const wsr = new WebSocketResource(socket, {
            keepalive: { path: '/v1/keepalive/provisioning' },
            handleRequest(request: IncomingWebSocketRequest) {
              if (
                request.path === '/v1/address' &&
                request.verb === 'PUT' &&
                request.body
              ) {
                const proto = window.textsecure.protobuf.ProvisioningUuid.decode(
                  request.body
                );
                const url = [
                  'tsdevice:/?uuid=',
                  proto.uuid,
                  '&pub_key=',
                  encodeURIComponent(btoa(utils.getString(pubKey))),
                ].join('');

                if (window.CI) {
                  window.CI.setProvisioningURL(url);
                }

                setProvisioningUrl(url);
                request.respond(200, 'OK');
              } else if (
                request.path === '/v1/message' &&
                request.verb === 'PUT' &&
                request.body
              ) {
                const envelope = window.textsecure.protobuf.ProvisionEnvelope.decode(
                  request.body,
                  'binary'
                );
                request.respond(200, 'OK');
                gotProvisionEnvelope = true;
                wsr.close();
                resolve(
                  provisioningCipher
                    .decrypt(envelope)
                    .then(async provisionMessage =>
                      queueTask(async () =>
                        confirmNumber(provisionMessage.number).then(
                          async deviceName => {
                            if (
                              typeof deviceName !== 'string' ||
                              deviceName.length === 0
                            ) {
                              throw new Error(
                                'AccountManager.registerSecondDevice: Invalid device name'
                              );
                            }
                            if (
                              !provisionMessage.number ||
                              !provisionMessage.provisioningCode ||
                              !provisionMessage.identityKeyPair
                            ) {
                              throw new Error(
                                'AccountManager.registerSecondDevice: Provision message was missing key data'
                              );
                            }

                            return createAccount(
                              provisionMessage.number,
                              provisionMessage.provisioningCode,
                              provisionMessage.identityKeyPair,
                              provisionMessage.profileKey,
                              deviceName,
                              provisionMessage.userAgent,
                              provisionMessage.readReceipts,
                              { uuid: provisionMessage.uuid }
                            )
                              .then(clearSessionsAndPreKeys)
                              .then(generateKeys)
                              .then(async (keys: GeneratedKeysType) =>
                                registerKeys(keys).then(async () =>
                                  confirmKeys(keys)
                                )
                              )
                              .then(registrationDone);
                          }
                        )
                      )
                    )
                );
              } else {
                window.log.error('Unknown websocket message', request.path);
              }
            },
          });
        })
    );
  }

  async refreshPreKeys() {
    const generateKeys = this.generateKeys.bind(this, 100);
    const registerKeys = this.server.registerKeys.bind(this.server);

    return this.queueTask(async () =>
      this.server.getMyKeys().then(async preKeyCount => {
        window.log.info(`prekey count ${preKeyCount}`);
        if (preKeyCount < 10) {
          return generateKeys().then(registerKeys);
        }
        return null;
      })
    );
  }

  async rotateSignedPreKey() {
    return this.queueTask(async () => {
      const signedKeyId = window.textsecure.storage.get('signedKeyId', 1);
      if (typeof signedKeyId !== 'number') {
        throw new Error('Invalid signedKeyId');
      }

      const store = window.textsecure.storage.protocol;
      const { server, cleanSignedPreKeys } = this;

      const existingKeys = await store.loadSignedPreKeys();
      existingKeys.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      const confirmedKeys = existingKeys.filter(key => key.confirmed);

      if (
        confirmedKeys.length >= 3 &&
        isMoreRecentThan(confirmedKeys[0].created_at, PREKEY_ROTATION_AGE)
      ) {
        window.log.warn(
          'rotateSignedPreKey: 3+ confirmed keys, most recent is less than a day old. Cancelling rotation.'
        );
        return;
      }

      // eslint-disable-next-line consistent-return
      return store
        .getIdentityKeyPair()
        .then(
          async (identityKey: KeyPairType) =>
            window.libsignal.KeyHelper.generateSignedPreKey(
              identityKey,
              signedKeyId
            ),
          () => {
            // We swallow any error here, because we don't want to get into
            //   a loop of repeated retries.
            window.log.error(
              'Failed to get identity key. Canceling key rotation.'
            );
            return null;
          }
        )
        .then(async (res: SignedPreKeyType | null) => {
          if (!res) {
            return null;
          }
          window.log.info('Saving new signed prekey', res.keyId);
          return Promise.all([
            window.textsecure.storage.put('signedKeyId', signedKeyId + 1),
            store.storeSignedPreKey(res.keyId, res.keyPair),
            server.setSignedPreKey({
              keyId: res.keyId,
              publicKey: res.keyPair.pubKey,
              signature: res.signature,
            }),
          ])
            .then(async () => {
              const confirmed = true;
              window.log.info('Confirming new signed prekey', res.keyId);
              return Promise.all([
                window.textsecure.storage.remove('signedKeyRotationRejected'),
                store.storeSignedPreKey(res.keyId, res.keyPair, confirmed),
              ]);
            })
            .then(cleanSignedPreKeys);
        })
        .catch(async (e: Error) => {
          window.log.error(
            'rotateSignedPrekey error:',
            e && e.stack ? e.stack : e
          );

          if (
            e instanceof Error &&
            e.name === 'HTTPError' &&
            e.code &&
            e.code >= 400 &&
            e.code <= 599
          ) {
            const rejections =
              1 + window.textsecure.storage.get('signedKeyRotationRejected', 0);
            await window.textsecure.storage.put(
              'signedKeyRotationRejected',
              rejections
            );
            window.log.error('Signed key rotation rejected count:', rejections);
          } else {
            throw e;
          }
        });
    });
  }

  async queueTask(task: () => Promise<any>) {
    this.pendingQueue = this.pendingQueue || new PQueue({ concurrency: 1 });
    const taskWithTimeout = window.textsecure.createTaskWithTimeout(task);

    return this.pendingQueue.add(taskWithTimeout);
  }

  async cleanSignedPreKeys() {
    const MINIMUM_KEYS = 3;
    const store = window.textsecure.storage.protocol;
    return store.loadSignedPreKeys().then(async allKeys => {
      allKeys.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      const confirmed = allKeys.filter(key => key.confirmed);
      const unconfirmed = allKeys.filter(key => !key.confirmed);

      const recent = allKeys[0] ? allKeys[0].keyId : 'none';
      const recentConfirmed = confirmed[0] ? confirmed[0].keyId : 'none';
      window.log.info(`Most recent signed key: ${recent}`);
      window.log.info(`Most recent confirmed signed key: ${recentConfirmed}`);
      window.log.info(
        'Total signed key count:',
        allKeys.length,
        '-',
        confirmed.length,
        'confirmed'
      );

      let confirmedCount = confirmed.length;

      // Keep MINIMUM_KEYS confirmed keys, then drop if older than a week
      await Promise.all(
        confirmed.map(async (key, index) => {
          if (index < MINIMUM_KEYS) {
            return;
          }
          const createdAt = key.created_at || 0;

          if (isOlderThan(createdAt, ARCHIVE_AGE)) {
            window.log.info(
              'Removing confirmed signed prekey:',
              key.keyId,
              'with timestamp:',
              new Date(createdAt).toJSON()
            );
            await store.removeSignedPreKey(key.keyId);
            confirmedCount -= 1;
          }
        })
      );

      const stillNeeded = MINIMUM_KEYS - confirmedCount;

      // If we still don't have enough total keys, we keep as many unconfirmed
      // keys as necessary. If not necessary, and over a week old, we drop.
      await Promise.all(
        unconfirmed.map(async (key, index) => {
          if (index < stillNeeded) {
            return;
          }

          const createdAt = key.created_at || 0;
          if (isOlderThan(createdAt, ARCHIVE_AGE)) {
            window.log.info(
              'Removing unconfirmed signed prekey:',
              key.keyId,
              'with timestamp:',
              new Date(createdAt).toJSON()
            );
            await store.removeSignedPreKey(key.keyId);
          }
        })
      );
    });
  }

  async createAccount(
    number: string,
    verificationCode: string,
    identityKeyPair: KeyPairType,
    profileKey: ArrayBuffer | undefined,
    deviceName: string | null,
    userAgent?: string | null,
    readReceipts?: boolean | null,
    options: { accessKey?: ArrayBuffer; uuid?: string } = {}
  ): Promise<void> {
    const { accessKey, uuid } = options;
    let password = btoa(
      utils.getString(window.libsignal.crypto.getRandomBytes(16))
    );
    password = password.substring(0, password.length - 2);
    const registrationId = window.libsignal.KeyHelper.generateRegistrationId();

    const previousNumber = getIdentifier(
      window.textsecure.storage.get('number_id')
    );
    const previousUuid = getIdentifier(
      window.textsecure.storage.get('uuid_id')
    );

    let encryptedDeviceName;
    if (deviceName) {
      encryptedDeviceName = await this.encryptDeviceName(
        deviceName,
        identityKeyPair
      );
      await this.deviceNameIsEncrypted();
    }

    window.log.info(
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

    const numberChanged = previousNumber && previousNumber !== number;
    const uuidChanged = previousUuid && uuid && previousUuid !== uuid;

    if (numberChanged || uuidChanged) {
      if (numberChanged) {
        window.log.warn(
          'New number is different from old number; deleting all previous data'
        );
      }
      if (uuidChanged) {
        window.log.warn(
          'New uuid is different from old uuid; deleting all previous data'
        );
      }

      try {
        await window.textsecure.storage.protocol.removeAllData();
        window.log.info('Successfully deleted previous data');
      } catch (error) {
        window.log.error(
          'Something went wrong deleting data from previous number',
          error && error.stack ? error.stack : error
        );
      }
    }

    await Promise.all([
      window.textsecure.storage.remove('identityKey'),
      window.textsecure.storage.remove('password'),
      window.textsecure.storage.remove('registrationId'),
      window.textsecure.storage.remove('number_id'),
      window.textsecure.storage.remove('device_name'),
      window.textsecure.storage.remove('regionCode'),
      window.textsecure.storage.remove('userAgent'),
      window.textsecure.storage.remove('profileKey'),
      window.textsecure.storage.remove('read-receipts-setting'),
    ]);

    // `setNumberAndDeviceId` and `setUuidAndDeviceId` need to be called
    // before `saveIdentifyWithAttributes` since `saveIdentityWithAttributes`
    // indirectly calls `ConversationController.getConverationId()` which
    // initializes the conversation for the given number (our number) which
    // calls out to the user storage API to get the stored UUID and number
    // information.
    await window.textsecure.storage.user.setNumberAndDeviceId(
      number,
      response.deviceId || 1,
      deviceName
    );

    if (uuid) {
      await window.textsecure.storage.user.setUuidAndDeviceId(
        uuid,
        response.deviceId || 1
      );
    }

    // This needs to be done very early, because it changes how things are saved in the
    //   database. Your identity, for example, in the saveIdentityWithAttributes call
    //   below.
    const conversationId = window.ConversationController.ensureContactIds({
      e164: number,
      uuid,
      highTrust: true,
    });

    if (!conversationId) {
      throw new Error('registrationDone: no conversationId!');
    }

    // update our own identity key, which may have changed
    // if we're relinking after a reinstall on the master device
    await window.textsecure.storage.protocol.saveIdentityWithAttributes(
      uuid || number,
      {
        publicKey: identityKeyPair.pubKey,
        firstUse: true,
        timestamp: Date.now(),
        verified: window.textsecure.storage.protocol.VerifiedStatus.VERIFIED,
        nonblockingApproval: true,
      }
    );

    await window.textsecure.storage.put('identityKey', identityKeyPair);
    await window.textsecure.storage.put('password', password);
    await window.textsecure.storage.put('registrationId', registrationId);
    if (profileKey) {
      await window.textsecure.storage.put('profileKey', profileKey);
    }
    if (userAgent) {
      await window.textsecure.storage.put('userAgent', userAgent);
    }

    await window.textsecure.storage.put(
      'read-receipt-setting',
      Boolean(readReceipts)
    );

    const regionCode = window.libphonenumber.util.getRegionCodeForNumber(
      number
    );
    await window.textsecure.storage.put('regionCode', regionCode);
    await window.textsecure.storage.protocol.hydrateCaches();
  }

  async clearSessionsAndPreKeys() {
    const store = window.textsecure.storage.protocol;

    window.log.info('clearing all sessions, prekeys, and signed prekeys');
    await Promise.all([
      store.clearPreKeyStore(),
      store.clearSignedPreKeysStore(),
      store.clearSessionStore(),
    ]);
  }

  async getGroupCredentials(startDay: number, endDay: number) {
    return this.server.getGroupCredentials(startDay, endDay);
  }

  // Takes the same object returned by generateKeys
  async confirmKeys(keys: GeneratedKeysType) {
    const store = window.textsecure.storage.protocol;
    const key = keys.signedPreKey;
    const confirmed = true;

    if (!key) {
      throw new Error('confirmKeys: signedPreKey is null');
    }

    window.log.info('confirmKeys: confirming key', key.keyId);
    await store.storeSignedPreKey(key.keyId, key.keyPair, confirmed);
  }

  async generateKeys(count: number, providedProgressCallback?: Function) {
    const progressCallback =
      typeof providedProgressCallback === 'function'
        ? providedProgressCallback
        : null;
    const startId = window.textsecure.storage.get('maxPreKeyId', 1);
    const signedKeyId = window.textsecure.storage.get('signedKeyId', 1);

    if (typeof startId !== 'number') {
      throw new Error('Invalid maxPreKeyId');
    }
    if (typeof signedKeyId !== 'number') {
      throw new Error('Invalid signedKeyId');
    }

    const store = window.textsecure.storage.protocol;
    return store.getIdentityKeyPair().then(async identityKey => {
      const result: any = {
        preKeys: [],
        identityKey: identityKey.pubKey,
      };
      const promises = [];

      for (let keyId = startId; keyId < startId + count; keyId += 1) {
        promises.push(
          window.libsignal.KeyHelper.generatePreKey(keyId).then(async res => {
            await store.storePreKey(res.keyId, res.keyPair);
            result.preKeys.push({
              keyId: res.keyId,
              publicKey: res.keyPair.pubKey,
            });
            if (progressCallback) {
              progressCallback();
            }
          })
        );
      }

      promises.push(
        window.libsignal.KeyHelper.generateSignedPreKey(
          identityKey,
          signedKeyId
        ).then(async res => {
          await store.storeSignedPreKey(res.keyId, res.keyPair);
          result.signedPreKey = {
            keyId: res.keyId,
            publicKey: res.keyPair.pubKey,
            signature: res.signature,
            // server.registerKeys doesn't use keyPair, confirmKeys does
            keyPair: res.keyPair,
          };
        })
      );

      promises.push(
        window.textsecure.storage.put('maxPreKeyId', startId + count)
      );
      promises.push(
        window.textsecure.storage.put('signedKeyId', signedKeyId + 1)
      );

      return Promise.all(promises).then(async () =>
        // This is primarily for the signed prekey summary it logs out
        this.cleanSignedPreKeys().then(() => result as GeneratedKeysType)
      );
    });
  }

  async registrationDone() {
    window.log.info('registration done');
    this.dispatchEvent(new Event('registration'));
  }
}
