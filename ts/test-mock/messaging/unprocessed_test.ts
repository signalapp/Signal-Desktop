// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { StorageState } from '@signalapp/mock-server';

import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:test:unprocessed');

describe('unprocessed', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 1 });

    await bootstrap.init();

    let state = StorageState.getEmpty();

    const {
      phone,
      contacts: [alice],
    } = bootstrap;

    state = state.addContact(alice, {
      identityKey: alice.publicKey.serialize(),
      profileKey: alice.profileKey.serialize(),
      whitelisted: true,
    });

    state = state.pin(alice);
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

  it('generates and loads unprocessed envelopes', async () => {
    const {
      desktop,
      contacts: [alice],
    } = bootstrap;

    debug('closing');
    await app.close();

    debug('queueing messages');
    const sends = new Array<Promise<void>>();
    for (let i = 0; i < 100; i += 1) {
      sends.push(
        alice.sendText(desktop, `hello: ${i}`, {
          timestamp: bootstrap.getTimestamp(),
          sealed: i % 2 === 0,
        })
      );
    }

    debug('starting app with unprocessed forced');
    [app] = await Promise.all([
      bootstrap.startApp({
        ciForceUnprocessed: true,
      }),
      ...sends,
    ]);

    debug('waiting for the window');
    await app.getWindow();

    debug('restarting normally');
    await app.close();
    app = await bootstrap.startApp();

    const page = await app.getWindow();

    debug('opening conversation');
    await page
      .locator(`[data-testid="${alice.device.aci}"] >> "${alice.profileName}"`)
      .click();

    await page.locator('.module-message__text >> "hello: 4"').waitFor();
    await page.locator('.module-message__text >> "hello: 5"').waitFor();
  });
});
