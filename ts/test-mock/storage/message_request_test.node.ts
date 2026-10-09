// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as durations from '../../util/durations/index.std.ts';
import type { App, Bootstrap } from './fixtures.node.ts';
import { initStorage, debug } from './fixtures.node.ts';
import {
  acceptConversation,
  typeIntoInput,
  waitForEnabledComposer,
} from '../helpers.node.ts';

describe('storage service', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    ({ bootstrap, app } = await initStorage());
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('should handle message request state changes', async () => {
    const { phone, desktop, server } = bootstrap;

    const initialState = await phone.expectStorageState('initial state');

    debug('Creating stranger');
    const stranger = await server.createPrimaryDevice({
      profileName: 'Mysterious Stranger',
    });

    const ourKey = await desktop.popSingleUseKey();
    await stranger.addSingleUseKey(desktop, ourKey);

    debug('Sending a message from a stranger');
    await stranger.sendText(desktop, 'Hello!', {
      withProfileKey: true,
      timestamp: bootstrap.getTimestamp(),
    });

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');

    debug('Opening conversation with a stranger');
    debug(stranger.device.aci);
    await leftPane.locator(`[data-testid="${stranger.device.aci}"]`).click();

    debug("Verify that we stored stranger's profile key");
    assert.isUndefined(initialState.getContact(stranger));
    const postMessageState = await phone.waitForStorageState({
      after: initialState,
      predicate: storageState =>
        (storageState.getContact(stranger)?.profileKey?.length ?? 0) === 32,
    });
    {
      assert.isFalse(postMessageState.getContact(stranger)?.whitelisted);
      assert.deepEqual(
        postMessageState.getContact(stranger)?.profileKey,
        stranger.profileKey.serialize()
      );
    }

    debug('Accept conversation from a stranger');
    await acceptConversation(window);

    debug('Verify that storage state was updated');
    await phone.waitForStorageState({
      after: postMessageState,
      predicate: storageState =>
        storageState.getContact(stranger)?.whitelisted === true,
    });

    // Stranger should receive our profile key
    {
      const { body, source, dataMessage } = await stranger.waitForMessage();
      assert.strictEqual(body, '', 'profile key message has no body');
      assert.strictEqual(
        source,
        desktop,
        'profile key message has valid source'
      );
      assert.isTrue(
        Buffer.from(phone.profileKey.serialize()).equals(
          dataMessage.profileKey ?? new Uint8Array(0)
        ),
        'profile key message has correct profile key'
      );
    }

    debug('Enter message text');
    const input = await waitForEnabledComposer(window);
    await typeIntoInput(input, 'hello stranger!', '');
    await input.press('Enter');

    {
      const { body, source } = await stranger.waitForMessage();
      assert.strictEqual(body, 'hello stranger!', 'text message has body');
      assert.strictEqual(source, desktop, 'text message has valid source');
    }
  });
});
