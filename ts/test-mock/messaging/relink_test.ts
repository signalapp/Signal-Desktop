// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { Proto, StorageState } from '@signalapp/mock-server';

import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import { expectSystemMessages } from '../helpers';

export const debug = createDebug('mock:test:relink');

describe('messaging/relink', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const {
      phone,
      contacts: [first, second, third],
    } = bootstrap;

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
      hasSetMyStoriesPrivacy: true,
    });

    state = state.addContact(first, {
      serviceE164: first.device.number,
      profileKey: first.profileKey.serialize(),
      givenName: first.profileName,

      // Intentionally incorrect identity key!
      identityKey: third.publicKey.serialize(),
    });

    state = state.addContact(second, {
      serviceE164: second.device.number,
      identityKey: second.publicKey.serialize(),
      profileKey: second.profileKey.serialize(),
      givenName: second.profileName,
      identityState: Proto.ContactRecord.IdentityState.VERIFIED,
    });

    state = state.pin(first);

    await phone.setStorageState(state);
    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('updates pin state on relink', async () => {
    const {
      contacts: [first, second],
      desktop,
      phone,
      server,
    } = bootstrap;

    {
      const window = await app.getWindow();

      const leftPane = window.locator('#LeftPane');

      debug('waiting for pinned contact');
      await leftPane
        .locator(
          `[data-testid="${first.device.aci}"] >> "${first.profileName}"`
        )
        .waitFor();

      await app.unlink();
      await app.waitForUnlink();
      await phone.unlink(desktop);
      await server.removeDevice(desktop.number, desktop.deviceId);

      await app.close();

      debug('change pinned contact, identity key');
      let state = await phone.expectStorageState('after link');

      // Fix identity key
      state = state.updateContact(first, {
        identityKey: first.publicKey.serialize(),
      });

      state = state.unpin(first);
      state = state.pin(second);

      await phone.setStorageState(state);
    }

    debug('relinking');
    app = await bootstrap.link();

    {
      const window = await app.getWindow();

      const leftPane = window.locator('#LeftPane');
      debug('waiting for different pinned contact');
      await leftPane
        .locator(
          `[data-testid="${second.device.aci}"] >> "${second.profileName}"`
        )
        .click();

      await expectSystemMessages(window, [
        /You marked your Safety Number with .* as verified from another device/,
      ]);

      debug('change pinned contact again');
      let state = await phone.expectStorageState('after relink');
      state = state.unpin(second);
      state = state.pin(first);

      await phone.setStorageState(state);
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      // Wait for that storage service version to be processed
      await app.waitForManifestVersion(state.version);

      debug('open old pinned contact');
      await leftPane
        .locator(
          `[data-testid="${first.device.aci}"] >> "${first.profileName}"`
        )
        .click();

      await expectSystemMessages(window, [/Safety Number has changed/]);
    }
  });
});
