// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  PreKeyBundle,
  processPreKeyBundle,
  ProtocolAddress,
  PublicKey,
} from '@signalapp/signal-client';

import { UnregisteredUserError } from './Errors';
import { Sessions, IdentityKeys } from '../LibSignalStores';
import { ServerKeysType, WebAPIType } from './WebAPI';

export async function getKeysForIdentifier(
  identifier: string,
  server: WebAPIType,
  devicesToUpdate?: Array<number>,
  accessKey?: string
): Promise<{ accessKeyFailed?: boolean }> {
  try {
    const { keys, accessKeyFailed } = await getServerKeys(
      identifier,
      server,
      accessKey
    );

    await handleServerKeys(identifier, keys, devicesToUpdate);

    return {
      accessKeyFailed,
    };
  } catch (error) {
    if (error.name === 'HTTPError' && error.code === 404) {
      await window.textsecure.storage.protocol.archiveAllSessions(identifier);
    }
    throw new UnregisteredUserError(identifier, error);
  }
}

async function getServerKeys(
  identifier: string,
  server: WebAPIType,
  accessKey?: string
): Promise<{ accessKeyFailed?: boolean; keys: ServerKeysType }> {
  if (!accessKey) {
    return {
      keys: await server.getKeysForIdentifier(identifier),
    };
  }

  try {
    return {
      keys: await server.getKeysForIdentifierUnauth(identifier, undefined, {
        accessKey,
      }),
    };
  } catch (error) {
    if (error.code === 401 || error.code === 403) {
      return {
        accessKeyFailed: true,
        keys: await server.getKeysForIdentifier(identifier),
      };
    }

    throw error;
  }
}

async function handleServerKeys(
  identifier: string,
  response: ServerKeysType,
  devicesToUpdate?: Array<number>
): Promise<void> {
  const sessionStore = new Sessions();
  const identityKeyStore = new IdentityKeys();

  await Promise.all(
    response.devices.map(async device => {
      const { deviceId, registrationId, preKey, signedPreKey } = device;
      if (
        devicesToUpdate !== undefined &&
        !devicesToUpdate.includes(deviceId)
      ) {
        return;
      }

      if (device.registrationId === 0) {
        window.log.info(
          `handleServerKeys/${identifier}: Got device registrationId zero!`
        );
      }
      if (!signedPreKey) {
        throw new Error(
          `getKeysForIdentifier/${identifier}: Missing signed prekey for deviceId ${deviceId}`
        );
      }
      const protocolAddress = ProtocolAddress.new(identifier, deviceId);
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

      const preKeyBundle = PreKeyBundle.new(
        registrationId,
        deviceId,
        preKeyId,
        preKeyObject,
        signedPreKey.keyId,
        signedPreKeyObject,
        Buffer.from(signedPreKey.signature),
        identityKey
      );

      const address = `${identifier}.${deviceId}`;
      await window.textsecure.storage.protocol
        .enqueueSessionJob(address, () =>
          processPreKeyBundle(
            preKeyBundle,
            protocolAddress,
            sessionStore,
            identityKeyStore
          )
        )
        .catch(error => {
          if (error?.message?.includes('untrusted identity for address')) {
            // eslint-disable-next-line no-param-reassign
            error.identityKey = response.identityKey;
          }
          throw error;
        });
    })
  );
}
