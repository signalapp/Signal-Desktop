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

import {
  OutgoingIdentityKeyError,
  UnregisteredUserError,
  HTTPError,
} from './Errors';
import { Sessions, IdentityKeys } from '../LibSignalStores';
import { Address } from '../types/Address';
import { QualifiedAddress } from '../types/QualifiedAddress';
import type { ServiceIdString } from '../types/ServiceId';
import type { ServerKeysType, WebAPIType } from './WebAPI';
import * as log from '../logging/log';
import { isRecord } from '../util/isRecord';

export async function getKeysForServiceId(
  serviceId: ServiceIdString,
  server: WebAPIType,
  devicesToUpdate?: Array<number>,
  accessKey?: string
): Promise<{ accessKeyFailed?: boolean }> {
  try {
    const { keys, accessKeyFailed } = await getServerKeys(
      serviceId,
      server,
      accessKey
    );

    await handleServerKeys(serviceId, keys, devicesToUpdate);

    return {
      accessKeyFailed,
    };
  } catch (error) {
    if (error instanceof HTTPError && error.code === 404) {
      await window.textsecure.storage.protocol.archiveAllSessions(serviceId);

      throw new UnregisteredUserError(serviceId, error);
    }

    throw error;
  }
}

async function getServerKeys(
  serviceId: ServiceIdString,
  server: WebAPIType,
  accessKey?: string
): Promise<{ accessKeyFailed?: boolean; keys: ServerKeysType }> {
  try {
    if (!accessKey) {
      return {
        keys: await server.getKeysForServiceId(serviceId),
      };
    }

    return {
      keys: await server.getKeysForServiceIdUnauth(serviceId, undefined, {
        accessKey,
      }),
    };
  } catch (error: unknown) {
    if (
      accessKey &&
      isRecord(error) &&
      typeof error.code === 'number' &&
      (error.code === 401 || error.code === 403)
    ) {
      return {
        accessKeyFailed: true,
        keys: await server.getKeysForServiceId(serviceId),
      };
    }

    throw error;
  }
}

async function handleServerKeys(
  serviceId: ServiceIdString,
  response: ServerKeysType,
  devicesToUpdate?: Array<number>
): Promise<void> {
  const ourAci = window.textsecure.storage.user.getCheckedAci();
  const sessionStore = new Sessions({ ourServiceId: ourAci });
  const identityKeyStore = new IdentityKeys({ ourServiceId: ourAci });

  await Promise.all(
    response.devices.map(async device => {
      const { deviceId, registrationId, pqPreKey, preKey, signedPreKey } =
        device;
      if (
        devicesToUpdate !== undefined &&
        !devicesToUpdate.includes(deviceId)
      ) {
        return;
      }

      if (device.registrationId === 0) {
        log.info(
          `handleServerKeys/${serviceId}: Got device registrationId zero!`
        );
      }
      if (!signedPreKey) {
        throw new Error(
          `getKeysForIdentifier/${serviceId}: Missing signed prekey for deviceId ${deviceId}`
        );
      }
      const protocolAddress = ProtocolAddress.new(serviceId, deviceId);
      const preKeyId = preKey?.keyId || null;
      const preKeyObject = preKey
        ? PublicKey.deserialize(Buffer.from(preKey.publicKey))
        : null;
      const signedPreKeyObject = PublicKey.deserialize(
        Buffer.from(signedPreKey.publicKey)
      );
      const identityKey = PublicKey.deserialize(
        Buffer.from(response.identityKey)
      );

      const pqPreKeyId = pqPreKey?.keyId || null;
      const pqPreKeyPublic = pqPreKey
        ? KEMPublicKey.deserialize(Buffer.from(pqPreKey.publicKey))
        : null;
      const pqPreKeySignature = pqPreKey
        ? Buffer.from(pqPreKey.signature)
        : null;

      const preKeyBundle = PreKeyBundle.new(
        registrationId,
        deviceId,
        preKeyId,
        preKeyObject,
        signedPreKey.keyId,
        signedPreKeyObject,
        Buffer.from(signedPreKey.signature),
        identityKey,
        pqPreKeyId,
        pqPreKeyPublic,
        pqPreKeySignature
      );

      const address = new QualifiedAddress(
        ourAci,
        new Address(serviceId, deviceId)
      );

      try {
        await window.textsecure.storage.protocol.enqueueSessionJob(
          address,
          `handleServerKeys(${serviceId})`,
          () =>
            processPreKeyBundle(
              preKeyBundle,
              protocolAddress,
              sessionStore,
              identityKeyStore
            )
        );
      } catch (error) {
        if (
          error instanceof LibSignalErrorBase &&
          error.code === ErrorCode.UntrustedIdentity
        ) {
          throw new OutgoingIdentityKeyError(serviceId, error);
        }
        throw error;
      }
    })
  );
}
