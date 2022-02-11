// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as durations from '../../util/durations';
import type { App, Bootstrap } from './fixtures';
import { initStorage, debug } from './fixtures';

describe('storage service', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    ({ bootstrap, app } = await initStorage());
  });

  afterEach(async () => {
    await app.close();
    await bootstrap.teardown();
  });

  it('should handle message request state changes', async () => {
    const { phone, desktop, server } = bootstrap;

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

    const leftPane = window.locator('.left-pane-wrapper');
    const conversationStack = window.locator('.conversation-stack');

    debug('Opening conversation with a stranger');
    await leftPane
      .locator(
        '_react=ConversationListItem' +
          `[title = ${JSON.stringify(stranger.profileName)}]`
      )
      .click();

    const initialState = await phone.expectStorageState('initial state');
    assert.strictEqual(initialState.version, 1);
    assert.isUndefined(initialState.getContact(stranger));

    debug('Accept conversation from a stranger');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    debug('Verify that storage state was updated');
    {
      const nextState = await phone.waitForStorageState({
        after: initialState,
      });
      assert.strictEqual(nextState.version, 2);
      assert.isTrue(nextState.getContact(stranger)?.whitelisted);

      // ContactRecord
      const { added, removed } = nextState.diff(initialState);
      assert.strictEqual(added.length, 1, 'only one record must be added');
      assert.strictEqual(removed.length, 0, 'no records should be removed');
    }

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
        phone.profileKey
          .serialize()
          .equals(dataMessage.profileKey ?? new Uint8Array(0)),
        'profile key message has correct profile key'
      );
    }

    debug('Enter message text');
    const composeArea = window.locator(
      '.composition-area-wrapper, ' +
        '.ConversationView__template .react-wrapper'
    );
    const input = composeArea.locator('_react=CompositionInput');

    await input.type('hello stranger!');
    await input.press('Enter');

    {
      const { body, source } = await stranger.waitForMessage();
      assert.strictEqual(body, 'hello stranger!', 'text message has body');
      assert.strictEqual(source, desktop, 'text message has valid source');
    }

    debug('Verifying the final manifest version');
    const finalState = await phone.expectStorageState('consistency check');
    assert.strictEqual(finalState.version, 2);
  });
});
