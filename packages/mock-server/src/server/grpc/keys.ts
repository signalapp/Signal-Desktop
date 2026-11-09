// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import { Buffer } from 'buffer';
import { RequestHandler } from 'micro';
import { Aci, Pni, PublicKey, KEMPublicKey } from '@signalapp/libsignal-client';
import { DeviceId, ServiceIdKind, ServiceIdString } from '../../types';
import { org } from '../../../protos/compiled';
import { Server } from '../base';
import { toServiceIdKind } from './utils/serviceId';
import { grpcRoute, authenticatedGrpcRoute } from './utils/route';

type DevicePreKeyBundleParams = org.signal.chat.keys.DevicePreKeyBundle.Params;

/**
 * Routes for [keys.proto](../../../protos/server/org/signal/chat/keys.proto).
 * Keep routes in the same order as they are declared in the proto file.
 */
export function createKeysRoutes(
  server: Server,
): ReadonlyArray<RequestHandler> {
  const onGetPreKeyCount = authenticatedGrpcRoute(
    server,
    'org.signal.chat.keys.Keys/GetPreKeyCount',
    async (_body, device) => {
      return {
        aciEcPreKeyCount: await device.getPreKeyCount(ServiceIdKind.ACI),
        aciKemPreKeyCount: await device.getKyberPreKeyCount(ServiceIdKind.ACI),
        pniEcPreKeyCount: await device.getPreKeyCount(ServiceIdKind.PNI),
        pniKemPreKeyCount: await device.getKyberPreKeyCount(ServiceIdKind.PNI),
      };
    },
  );

  const onSetOneTimeEcPreKeys = authenticatedGrpcRoute(
    server,
    'org.signal.chat.keys.Keys/SetOneTimeEcPreKeys',
    async ({ identityType, preKeys }, device) => {
      await server.updateDeviceKeys(device, toServiceIdKind(identityType), {
        preKeys: preKeys.map(({ keyId, publicKey }) => ({
          keyId,
          publicKey: PublicKey.deserialize(publicKey),
        })),
      });
      return {};
    },
  );

  const onSetOneTimeKemSignedPreKeys = authenticatedGrpcRoute(
    server,
    'org.signal.chat.keys.Keys/SetOneTimeKemSignedPreKeys',
    async ({ identityType, preKeys }, device) => {
      await server.updateDeviceKeys(device, toServiceIdKind(identityType), {
        kyberPreKeys: preKeys.map(({ keyId, publicKey, signature }) => ({
          keyId,
          publicKey: KEMPublicKey.deserialize(publicKey),
          signature: Buffer.from(signature),
        })),
      });
      return {};
    },
  );

  const onSetEcSignedPreKey = authenticatedGrpcRoute(
    server,
    'org.signal.chat.keys.Keys/SetEcSignedPreKey',
    async ({ identityType, signedPreKey }, device) => {
      assert(signedPreKey != null, 'Missing signedPreKey');
      await server.updateDeviceKeys(device, toServiceIdKind(identityType), {
        signedPreKey: {
          keyId: signedPreKey.keyId,
          publicKey: PublicKey.deserialize(signedPreKey.publicKey),
          signature: Buffer.from(signedPreKey.signature),
        },
      });
      return {};
    },
  );

  const onSetKemLastResortPreKey = authenticatedGrpcRoute(
    server,
    'org.signal.chat.keys.Keys/SetKemLastResortPreKey',
    async ({ identityType, signedPreKey }, device) => {
      assert(signedPreKey != null, 'Missing signedPreKey');
      await server.updateDeviceKeys(device, toServiceIdKind(identityType), {
        lastResortKey: {
          keyId: signedPreKey.keyId,
          publicKey: KEMPublicKey.deserialize(signedPreKey.publicKey),
          signature: Buffer.from(signedPreKey.signature),
        },
      });
      return {};
    },
  );

  const onGetPreKeysAnonymous = grpcRoute(
    server,
    'org.signal.chat.keys.KeysAnonymous/GetPreKeys',
    async ({ request }) => {
      assert(request?.targetIdentifier != null, 'Missing targetIdentifier');
      const { identityType, uuid } = request.targetIdentifier;
      const target =
        identityType === org.signal.chat.common.IdentityType.IDENTITY_TYPE_PNI
          ? Pni.fromUuidBytes(Buffer.from(uuid))
          : Aci.fromUuidBytes(Buffer.from(uuid));
      const serviceId = target.getServiceIdString() as ServiceIdString;

      // TODO: Check the unidentified access key or group send token
      const allDevices = await server.getAllDevicesByServiceId(serviceId);
      const matchingDevices = allDevices.filter((device) => {
        return request.deviceId == null || device.deviceId === request.deviceId;
      });

      const [primary] = matchingDevices;
      if (primary == null) {
        return { response: { targetNotFound: {} } };
      }

      const serviceIdKind = primary.getServiceIdKind(serviceId);
      const identityKey = await primary.getIdentityKey(serviceIdKind);

      const devicePreKeys = new Map<DeviceId, DevicePreKeyBundleParams>();

      await Promise.all(
        matchingDevices.map(async (device) => {
          const { signedPreKey, preKey, pqPreKey } =
            await device.popSingleUseKey(serviceIdKind);

          const bundle: DevicePreKeyBundleParams = {
            ecSignedPreKey: {
              keyId: signedPreKey.keyId,
              publicKey: signedPreKey.publicKey.serialize(),
              signature: signedPreKey.signature,
            },
            ecOneTimePreKey: preKey
              ? {
                  keyId: preKey.keyId,
                  publicKey: preKey.publicKey.serialize(),
                }
              : null,
            kemOneTimePreKey: {
              keyId: pqPreKey.keyId,
              publicKey: pqPreKey.publicKey.serialize(),
              signature: pqPreKey.signature,
            },
            registrationId: device.getCheckedRegistrationId(serviceIdKind),
          };

          devicePreKeys.set(device.deviceId, bundle);
        }),
      );

      return {
        response: {
          preKeys: {
            identityKey: identityKey.serialize(),
            devicePreKeys,
            unrestrictedUnidentifiedAccess: false,
            unidentifiedAccessKeyFingerprint: null,
          },
        },
      };
    },
  );

  return [
    onGetPreKeyCount,
    onSetOneTimeEcPreKeys,
    onSetOneTimeKemSignedPreKeys,
    onSetEcSignedPreKey,
    onSetKemLastResortPreKey,
    onGetPreKeysAnonymous,
  ];
}
