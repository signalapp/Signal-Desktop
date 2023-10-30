// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ServiceIdKind } from '@signalapp/mock-server';
import {
  IdentityKeyPair,
  PrivateKey,
  SignedPreKeyRecord,
  KEMKeyPair,
  KyberPreKeyRecord,
} from '@signalapp/libsignal-client';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { generatePni, toUntaggedPni } from '../../types/ServiceId';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';

export const debug = createDebug('mock:test:pni-unlink');

describe('pnp/PNI DecryptionError unlink', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App | undefined;

  beforeEach(async () => {
    bootstrap = new Bootstrap({
      contactCount: 0,
    });
    await bootstrap.init();

    await bootstrap.linkAndClose();
  });

  afterEach(async function (this: Mocha.Context) {
    if (app) {
      await bootstrap.maybeSaveLogs(this.currentTest, app);
      await app.close();
    }
    await bootstrap.teardown();
  });

  it('unlinks desktop if PNI identity is different on server', async () => {
    const { desktop, phone, server } = bootstrap;

    const badIdentity = IdentityKeyPair.generate();

    const signedPreKey = PrivateKey.generate();
    const signedPreKeySig = badIdentity.privateKey.sign(
      signedPreKey.getPublicKey().serialize()
    );
    const signedPreKeyRecord = SignedPreKeyRecord.new(
      1000,
      Date.now(),
      signedPreKey.getPublicKey(),
      signedPreKey,
      signedPreKeySig
    );

    const kyberPreKey = KEMKeyPair.generate();
    const kyberPreKeySig = badIdentity.privateKey.sign(
      kyberPreKey.getPublicKey().serialize()
    );
    const kyberPreKeyRecord = KyberPreKeyRecord.new(
      1001,
      Date.now(),
      kyberPreKey,
      kyberPreKeySig
    );

    debug('corrupting PNI identity key');
    const sendPromises = new Array<Promise<unknown>>();

    const pniChangeNumber = {
      identityKeyPair: badIdentity.serialize(),
      registrationId: desktop.getRegistrationId(ServiceIdKind.PNI),
      signedPreKey: signedPreKeyRecord.serialize(),
      lastResortKyberPreKey: kyberPreKeyRecord.serialize(),
      newE164: desktop.number,
    };

    // The goal of these two sync messages is to update Desktop's PNI identity
    // key while keeping the PNI itself the same so that the Desktop wouldn't
    // drop the PNI envelope from `sendText()` below.
    sendPromises.push(
      phone.sendRaw(
        desktop,
        {
          syncMessage: {
            pniChangeNumber,
          },
        },
        {
          timestamp: bootstrap.getTimestamp(),
          updatedPni: toUntaggedPni(generatePni()),
        }
      )
    );
    sendPromises.push(
      phone.sendRaw(
        desktop,
        {
          syncMessage: {
            pniChangeNumber,
          },
        },
        {
          timestamp: bootstrap.getTimestamp(),
          updatedPni: toUntaggedPni(desktop.pni),
        }
      )
    );

    debug('sending a message to our PNI');
    const stranger = await server.createPrimaryDevice({
      profileName: 'Mysterious Stranger',
    });

    const ourKey = await desktop.popSingleUseKey(ServiceIdKind.PNI);
    await stranger.addSingleUseKey(desktop, ourKey, ServiceIdKind.PNI);

    sendPromises.push(
      stranger.sendText(desktop, 'A message to PNI', {
        serviceIdKind: ServiceIdKind.PNI,
        withProfileKey: true,
        timestamp: bootstrap.getTimestamp(),
      })
    );

    debug('starting the app to process the queue');
    app = await bootstrap.startApp();

    await Promise.all(sendPromises);

    const window = await app.getWindow();

    await window.locator('.LeftPaneDialog__message >> "Unlinked"').waitFor();
  });
});
