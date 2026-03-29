// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// import { contextBridge } from 'electron';

import { pvrfComputeZbDemo, pvrfComputeSasDemo } from '@signalapp/libsignal-client';
import { getLocalNonce, setLocalNonce } from './pvrfLocalNonceStorage.preload.js';


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

import * as Bytes from '../Bytes.std.js';
import { setPendingBasis } from './pvrfPendingBasisStorage.preload.js';


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
        log.info(
          'this is x3dh SEND probably',
          preKeyBundle,
          protocolAddress,
          sessionStore,
          identityKeyStore,
          signalProtocolStore
        );



        await signalProtocolStore.enqueueSessionJob(address, () =>
          processPreKeyBundle(
            preKeyBundle,
            protocolAddress,
            sessionStore,
            identityKeyStore
          )
        );
        log.info(
          'after x3dh',
          preKeyBundle,
          protocolAddress,
          sessionStore,
          identityKeyStore,
          signalProtocolStore
        );



        //maybe problem if user loses their main device?
        //end goal maybe calc for 1 device, using that data for all
        //but would require synchronosity, doing device 1 first, then allowing others to run
        //remove the true || to test 
        if (deviceId == 1) {
          // 1) check if we already had a session before running X3DH
          const existingSession = await sessionStore.getSession(protocolAddress);
          if (!existingSession) 
          {
            // 2) create "sender-specific" SAS / basis for demo, Use env var if available; otherwise derive from ourAci so Alice/Bob differ.
            //const demoSas=(typeof process!=='undefined' && process.env && process.env.SIGNAL_DEMO_SAS)||ourAci.slice(-4); 
            //{ v: 0, sas: demoSas, from: ourAci, ts: Date.now() }

            const nonce = new Uint8Array(16);
            globalThis.crypto.getRandomValues(nonce);
            const nonce_b64 = Bytes.toBase64(nonce);
            const payloadObj = {
              v: 0,
              type: 'nonce',
              from: ourAci,
              ts: Date.now(),
              nonce_b64,
            };

            const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
            const payloadB64 = Bytes.toBase64(payloadBytes);
            await setPendingBasis(serviceId, deviceId, payloadB64);
            await setLocalNonce(serviceId, deviceId, nonce_b64);
            log.info(
              `PVRF demo (Alice): stored pending NONCE + localNonce for ${serviceId}.${deviceId}`
            );
            //log.info( `PVRF demo: stored pending payload for ${serviceId}.${deviceId} sas=${demoSas}`);
            const DEMO_CONTEXT = new TextEncoder().encode('demo-context-v0');
            const zb16 = pvrfComputeZbDemo(DEMO_CONTEXT, nonce);
            const sas16 = pvrfComputeSasDemo(nonce, zb16);
            log.info(`DEBUG INFO TO CHECK EQUALITY:PVRF demo (Alice): computed sas16=${Bytes.toBase64(sas16)}`);
          }

          const temp = await sessionStore.getSession(protocolAddress);
          log.info('got session', temp, device);
          log.info('SAS value', temp?.getSAS?.());
          log.info('VTS value', temp?.getVTS?.());
          const buf = temp?.getVTS?.();
          let offset = 0;

          const read32 = () => {
            const slice = buf.slice(offset, offset + 32);
            offset += 32;
            return slice;
          };

          const readU32 = () => {
            const view = new DataView(buf.buffer, buf.byteOffset + offset, 4);
            const val = view.getUint32(0, true); // little endian
            offset += 4;
            return val;
          };

          const readBytes = (len: number) => {
            const slice = buf.slice(offset, offset + len);
            offset += len;
            return slice;
          };

          // fixed-size fields
          const A = read32();      // RistrettoPoint (compressed)
          const B = read32();

          const s1 = read32();     // Scalar
          const s2_1 = read32();
          const s2_2 = read32();

          // variable-length fields
          const bytes1Len = readU32();
          const bytes1 = readBytes(bytes1Len);

          const bytes2Len = readU32();
          const bytes2 = readBytes(bytes2Len);

          // final scalars
          const r1 = read32();
          const r2 = read32();

          const h = A;
          const hprime = B;
          const tau = { c: s1, s: [s2_1, s2_2] };
          const vt = { h, hprime, tau };
          const vk = bytes1;
          const secrets = bytes2;
          const alpha = r1;
          const beta = r2;
          const vts = { vt, vk, secrets, alpha, beta };


          console.log('first check what was stored', serviceId, deviceId);
          const initial_stored_vts = await getLocalNonce(serviceId, deviceId, 'vts');
          console.log('initial stored vts', initial_stored_vts);
          console.log('this is the vts', vts);
          await setLocalNonce(serviceId, deviceId, JSON.stringify(vts), 'vts');
          console.log('loading what was stored');
          const stored_vts = await getLocalNonce(serviceId, deviceId, 'vts');
          console.log('stored vts', stored_vts);
          // below stuff doesnt really work feel free to try
          // contextBridge.exposeInMainWorld('preKeyBundle', preKeyBundle);
          // contextBridge.exposeInMainWorld('protocolAddress', protocolAddress);
          // contextBridge.exposeInMainWorld('sessionStore', sessionStore);
          // contextBridge.exposeInMainWorld('identityKeyStore', identityKeyStore);
          // contextBridge.exposeInMainWorld(
          //   'signalProtocolStore',
          //   signalProtocolStore
          // );
        }
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
