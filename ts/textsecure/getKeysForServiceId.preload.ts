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
} from './Errors.std.js';
import { Sessions, IdentityKeys } from '../LibSignalStores.preload.js';
import { Address } from '../types/Address.std.js';
import { QualifiedAddress } from '../types/QualifiedAddress.std.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import type {
  getKeysForServiceId as doGetKeysForServiceId,
  getKeysForServiceIdUnauth,
  ServerKeysType,
} from './WebAPI.preload.js';
import { createLogger } from '../logging/log.std.js';
import { isRecord } from '../util/isRecord.std.js';
import type { GroupSendToken } from '../types/GroupSendEndorsements.std.js';
import { HTTPError } from '../types/HTTPError.std.js';
import { onFailedToSendWithEndorsements } from '../util/groupSendEndorsements.preload.js';
import { signalProtocolStore } from '../SignalProtocolStore.preload.js';
import { itemStorage } from './Storage.preload.js';

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
    const { keys, accessKeyFailed } = await getServerKeys(
      serviceId,
      server,
      accessKey,
      groupSendToken
    );

    await handleServerKeys(serviceId, keys, devicesToUpdate);

    return {
      accessKeyFailed,
    };
  } catch (error) {
    if (error instanceof HTTPError && error.code === 404) {
      await signalProtocolStore.archiveAllSessions(serviceId);

      throw new UnregisteredUserError(serviceId, error);
    }

    throw error;
  }
}

function isUnauthorizedError(error: unknown) {
  return (
    isRecord(error) &&
    typeof error.code === 'number' &&
    (error.code === 401 || error.code === 403)
  );
}

async function getServerKeys(
  serviceId: ServiceIdString,
  server: ServerType,
  accessKey: string | null,
  groupSendToken: GroupSendToken | null
): Promise<{ accessKeyFailed: boolean; keys: ServerKeysType }> {
  // Return true only when attempted with access key
  let accessKeyFailed = false;

  if (accessKey != null) {
    // Try the access key first
    try {
      const keys = await server.getKeysForServiceIdUnauth(
        serviceId,
        undefined,
        { accessKey }
      );
      return { keys, accessKeyFailed };
    } catch (error) {
      accessKeyFailed = true;
      if (!isUnauthorizedError(error)) {
        throw error;
      }
    }
  }

  if (groupSendToken != null) {
    try {
      const keys = await server.getKeysForServiceIdUnauth(
        serviceId,
        undefined,
        { groupSendToken }
      );
      return { keys, accessKeyFailed };
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        throw error;
      } else {
        onFailedToSendWithEndorsements(error);
      }
    }
  }

  return {
    keys: await server.getKeysForServiceId(serviceId),
    accessKeyFailed,
  };
}

async function handleServerKeys(
  serviceId: ServiceIdString,
  response: ServerKeysType,
  devicesToUpdate: Array<number> | null
): Promise<void> {
  const ourAci = itemStorage.user.getCheckedAci();
  const sessionStore = new Sessions({ ourServiceId: ourAci });
  const identityKeyStore = new IdentityKeys({ ourServiceId: ourAci });

  await Promise.all(
    response.devices.map(async device => {
      const { deviceId, registrationId, pqPreKey, preKey, signedPreKey } =
        device;
      if (devicesToUpdate != null && !devicesToUpdate.includes(deviceId)) {
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
      if (!pqPreKey) {
        throw new Error(
          `getKeysForIdentifier/${serviceId}: Missing signed PQ prekey for deviceId ${deviceId}`
        );
      }
      const protocolAddress = ProtocolAddress.new(serviceId, deviceId);
      const preKeyId = preKey?.keyId || null;
      const preKeyObject = preKey
        ? PublicKey.deserialize(preKey.publicKey)
        : null;
      const signedPreKeyObject = PublicKey.deserialize(signedPreKey.publicKey);
      const identityKey = PublicKey.deserialize(response.identityKey);

      const { keyId: pqPreKeyId, signature: pqPreKeySignature } = pqPreKey;
      const pqPreKeyPublic = KEMPublicKey.deserialize(pqPreKey.publicKey);

      const preKeyBundle = PreKeyBundle.new(
        registrationId,
        deviceId,
        preKeyId,
        preKeyObject,
        signedPreKey.keyId,
        signedPreKeyObject,
        signedPreKey.signature,
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
        await signalProtocolStore.enqueueSessionJob(address, () =>
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
