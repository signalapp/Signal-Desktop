// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import createDebug from 'debug';
import { assert } from 'chai';
import { type PrimaryDevice, StorageState } from '@signalapp/mock-server';

import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import { typeIntoInput, waitForEnabledComposer } from '../helpers';
import { MINUTE } from '../../util/durations';

export const debug = createDebug('mock:test:libsignal');

describe('Libsignal-net', function (this: Mocha.Suite) {
  this.timeout(MINUTE);
  let bootstrap: Bootstrap;
  let app: App;
  let contact: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();
    [contact] = bootstrap.contacts;

    let state = StorageState.getEmpty();

    state = state.addContact(contact, {
      identityKey: contact.publicKey.serialize(),
      profileKey: contact.profileKey.serialize(),
      whitelisted: true,
    });

    await bootstrap.phone.setStorageState(state);

    bootstrap.server.setRemoteConfig(
      'desktop.experimentalTransportEnabled.alpha',
      { enabled: true }
    );

    bootstrap.server.setRemoteConfig(
      'desktop.experimentalTransport.enableAuth',
      { enabled: true }
    );

    // Link & close so that app can get remote config first over non-libsignal websocket,
    // and then on next app start it will connect via libsignal
    await bootstrap.linkAndClose();
    app = await bootstrap.startApp();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('can send and receive messages', async () => {
    const window = await app.getWindow();
    const { desktop } = bootstrap;

    debug('receiving incoming message');
    await contact.sendText(bootstrap.desktop, 'incoming message');

    debug('ensuring app received message, opening conversation');
    {
      const leftPane = window.locator('#LeftPane');
      const item = leftPane
        .getByTestId(contact.toContact().aci)
        .getByText('incoming message');
      await item.click();
    }

    debug('sending outgoing message');
    const input = await waitForEnabledComposer(window);
    await typeIntoInput(input, 'outgoing message');
    await input.press('Enter');

    debug('waiting for message on server side');
    const { body, source } = await contact.waitForMessage();
    assert.strictEqual(body, 'outgoing message');
    assert.strictEqual(source, desktop);

    debug('confirming app successfully sent message');
    await app.waitForMessageSend();

    debug('confirming that app was actually using libsignal');
    const { authenticated, unauthenticated } = await app.getSocketStatus();
    assert.strictEqual(authenticated.lastConnectionTransport, 'libsignal');
    assert.strictEqual(unauthenticated.lastConnectionTransport, 'libsignal');
  });
});
