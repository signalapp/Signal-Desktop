// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  ErrorCode,
  KEMPublicKey,
  LibSignalErrorBase,
  PreKeyBundle,
  processPreKeyBundle,
  ProtocolAddress,
  PublicKey,
} from '@signalapp/libsignal-client';
import { GroupSendFullToken } from '@signalapp/libsignal-client/zkgroup.js';

import {
  OutgoingIdentityKeyError,
  UnregisteredUserError,
} from './Errors.std.ts';
import { Sessions, IdentityKeys } from '../LibSignalStores.node.ts';
import { Address } from '../types/Address.std.ts';
import { QualifiedAddress } from '../types/QualifiedAddress.std.ts';
import type { ServiceIdString } from '../types/ServiceId.std.ts';
import type {
  getKeysForServiceId as doGetKeysForServiceId,
  getKeysForServiceIdUnauth,
  PreKeysAuthType,
  ServerKeysType,
} from './WebAPI.preload.ts';
import { createLogger } from '../logging/log.std.ts';
import * as Bytes from '../Bytes.std.ts';
import type { GroupSendToken } from '../types/GroupSendEndorsements.std.ts';
import { ZERO_ACCESS_KEY } from '../types/SealedSender.std.ts';
import { HTTPError } from '../types/HTTPError.std.ts';
import { signalProtocolStore } from '../SignalProtocolStore.preload.ts';
import { itemStorage } from './Storage.preload.ts';

const log = createLogger('getKeysForServiceId');

type ServerType = Readonly<{
  getKeysForServiceId: typeof doGetKeysForServiceId;
  getKeysForServiceIdUnauth: typeof getKeysForServiceIdUnauth;
}>;

export async function getKeysForServiceId(
  serviceId: ServiceIdString,
  server: ServerType,
  devicesToUpdate: Array<number> | null,
  accessKey: string | null,
  groupSendToken: GroupSendToken | null
): Promise<{ accessKeyFailed?: boolean }> {
  try {
    const { preKeyBundles, accessKeyFailed } = await getServerKeys(
      serviceId,
      server,
      devicesToUpdate,
      accessKey,
      groupSendToken
    );

    await handleServerKeys(serviceId, preKeyBundles, devicesToUpdate);

    return {
      accessKeyFailed,
    };
  } catch (error) {
    if (
      (error instanceof HTTPError && error.code === 404) ||
      (error instanceof LibSignalErrorBase &&
        error.is(ErrorCode.ServiceIdNotFound))
    ) {
      await signalProtocolStore.archiveAllSessions(serviceId);

      throw new UnregisteredUserError(serviceId, error);
    }

    throw error;
  }
}

function isUnauthorizedError(error: unknown): boolean {
  return (
    error instanceof LibSignalErrorBase &&
    error.is(ErrorCode.RequestUnauthorized)
  );
}

function toPreKeysAuth(accessKey: string): PreKeysAuthType {
  if (accessKey === ZERO_ACCESS_KEY) {
    return 'unrestricted';
  }
  return { accessKey: Bytes.fromBase64(accessKey) };
}

function shouldUpdateDevice(
  deviceId: number,
  devicesToUpdate: ReadonlyArray<number> | null
): boolean {
  return devicesToUpdate == null || devicesToUpdate.includes(deviceId);
}

async function getServerKeys(
  serviceId: ServiceIdString,
  server: ServerType,
  devicesToUpdate: ReadonlyArray<number> | null,
  accessKey: string | null,
  groupSendToken: GroupSendToken | null
): Promise<{
  accessKeyFailed: boolean;
  preKeyBundles: ReadonlyArray<PreKeyBundle>;
}> {
  // Return true only when attempted with access key
  let accessKeyFailed = false;

  if (accessKey != null) {
    // Try the access key first
    try {
      const { preKeyBundles } = await server.getKeysForServiceIdUnauth(
        serviceId,
        toPreKeysAuth(accessKey)
      );
      return { preKeyBundles, accessKeyFailed };
    } catch (error) {
      accessKeyFailed = true;
      if (!isUnauthorizedError(error)) {
        throw error;
      }
    }
  }

  if (groupSendToken != null) {
    try {
      const { preKeyBundles } = await server.getKeysForServiceIdUnauth(
        serviceId,
        new GroupSendFullToken(groupSendToken)
      );
      return { preKeyBundles, accessKeyFailed };
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        throw error;
      }
    }
  }

  const keys = await server.getKeysForServiceId(serviceId);
  return {
    preKeyBundles: toPreKeyBundles(serviceId, keys, devicesToUpdate),
    accessKeyFailed,
  };
}

function toPreKeyBundles(
  serviceId: ServiceIdString,
  response: ServerKeysType,
  devicesToUpdate: ReadonlyArray<number> | null
): ReadonlyArray<PreKeyBundle> {
  const identityKey = PublicKey.deserialize(response.identityKey);

  return response.devices
    .filter(device => shouldUpdateDevice(device.deviceId, devicesToUpdate))
    .map(device => {
      const { deviceId, registrationId, pqPreKey, preKey, signedPreKey } =
        device;
      if (signedPreKey == null) {
        throw new Error(
          `getKeysForIdentifier/${serviceId}: Missing signed prekey for deviceId ${deviceId}`
        );
      }
      if (pqPreKey == null) {
        throw new Error(
          `getKeysForIdentifier/${serviceId}: Missing signed PQ prekey for deviceId ${deviceId}`
        );
      }

      return PreKeyBundle.new(
        registrationId,
        deviceId,
        preKey?.keyId || null,
        preKey ? PublicKey.deserialize(preKey.publicKey) : null,
        signedPreKey.keyId,
        PublicKey.deserialize(signedPreKey.publicKey),
        signedPreKey.signature,
        identityKey,
        pqPreKey.keyId,
        KEMPublicKey.deserialize(pqPreKey.publicKey),
        pqPreKey.signature
      );
    });
}

async function handleServerKeys(
  serviceId: ServiceIdString,
  preKeyBundles: ReadonlyArray<PreKeyBundle>,
  devicesToUpdate: ReadonlyArray<number> | null
): Promise<void> {
  const ourAci = itemStorage.user.getCheckedAci();
  const ourDeviceId = itemStorage.user.getCheckedDeviceId();
  const sessionStore = new Sessions({
    signalProtocolStore,
    ourServiceId: ourAci,
  });
  const identityKeyStore = new IdentityKeys({
    signalProtocolStore,
    ourServiceId: ourAci,
  });

  await Promise.all(
    preKeyBundles.map(async preKeyBundle => {
      const deviceId = preKeyBundle.deviceId();
      if (!shouldUpdateDevice(deviceId, devicesToUpdate)) {
        return;
      }

      if (preKeyBundle.registrationId() === 0) {
        log.info(
          `handleServerKeys/${serviceId}: Got device registrationId zero!`
        );
      }
      const protocolAddress = ProtocolAddress.new(serviceId, deviceId);
      const localAddress = ProtocolAddress.new(ourAci, ourDeviceId);

      const address = new QualifiedAddress(
        ourAci,
        new Address(serviceId, deviceId)
      );

      try {
        await signalProtocolStore.enqueueSessionJob(address, () =>
          processPreKeyBundle(
            preKeyBundle,
            protocolAddress,
            localAddress,
            sessionStore,
            identityKeyStore
          )
        );
      } catch (error) {
        if (
          error instanceof LibSignalErrorBase &&
          error.is(ErrorCode.UntrustedIdentity)
        ) {
          throw new OutgoingIdentityKeyError(serviceId, error);
        }
        throw error;
      }
    })
  );
}
