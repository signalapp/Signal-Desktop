// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// import { contextBridge } from 'electron';

import { getLocalStores, setLocalStores } from './pvrfLocalStoresStorage.preload.js';
import { existsSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { IS_MCS_DEMO } from './MessageReceiver.preload.js';
import { showConfirmationDialog } from '../util/showConfirmationDialog.dom.js';


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
  const filePath = join(homedir(), "Desktop", "mcs_alice_demo.txt");
  const anyDevicesToUpdate = devicesToUpdate != null && response.devices.some(device => devicesToUpdate.includes(device.deviceId));
  let doSub;
  let sas = await getLocalStores(serviceId, 1, "sas");
  if (IS_MCS_DEMO && existsSync(filePath) && anyDevicesToUpdate && !sas) {
    doSub = await doAliceAttackModal();
    if (!doSub) {
      unlinkSync(filePath);
    }
  } 

  await Promise.all(
    response.devices.map(async device => {
      console.log('new device')
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
          'this is x3dh SEND',
          deviceId,
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
        // log.info(
        //   'after x3dh',
        //   preKeyBundle,
        //   protocolAddress,
        //   sessionStore,
        //   identityKeyStore,
        //   signalProtocolStore
        // );




        const temp = await sessionStore.getSession(protocolAddress);
        log.info('got session', temp, device, temp?.getBobResponse);

        try { log.info('VTS value', temp?.getVTS?.()); } catch (e) { log.error('error getting VTS', e); }
        let buf = temp?.getVTS?.();
        try {
          //console.log('buf', buf);
          const s1 = buf.vt.tau[0]
          const s2_1 = buf.vt.tau[1][0]
          const s2_2 = buf.vt.tau[1][1]

          const h = buf.vt.h;
          const hprime = buf.vt.hprime;
          const tau = { c: s1, s: [s2_1, s2_2] };
          const vt = { h, hprime, tau };
          const vk = buf.vk;
          const secrets = buf.x;
          const alpha = buf.r1;
          const beta = buf.r2;
          const salt = buf.contrib_salt;
          const vts = { vt, vk, secrets, alpha, beta, salt };
          console.log('final vts to store', vts);
          await setLocalStores(serviceId, deviceId, JSON.stringify(vts), 'vts');
        } catch (err){
          log.error('error parsing VTS', err, err.stack);
        }
        //console.log('finished processing prekey bundle for', serviceId, deviceId);
        return Promise.resolve();
        
      } 
     catch (error) {
      //console.log('err');
        if (
          error instanceof LibSignalErrorBase &&
          error.code === ErrorCode.UntrustedIdentity
        ) {
          throw new OutgoingIdentityKeyError(serviceId, error);
        }
        throw error;
      }
      return Promise.resolve();
    })
  );
  //console.log('finished handling server keys for', serviceId);
}


async function doAliceAttackModal() {
    return await new Promise<boolean>((resolver, rejecter) => {
      showConfirmationDialog({
        dialogName: 'mcsDemoPerformMITM',
        noMouseClose: true,
        onTopOfEverything: true,
        cancelText: "Normal Message",
        confirmStyle: 'affirmative',
        title: `🔧 (DEMO) (A)Perform MITM Attack?`,
        description: `
          Simulate an attack on the server as EVE?

          You will forward ALICE's VTS value to this person instead of your real VTS.

          This will trigger BOB's warning against you.
        `,
        okText: "Execute attack",
        reject: () => {
          return resolver(false);
        },
        resolve: () => {
          return resolver(true);
        },
      });
   });
}