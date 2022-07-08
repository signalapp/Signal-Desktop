// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-await-in-loop */

import { assert } from 'chai';

import type { Group } from '@signalapp/mock-server';

import * as durations from '../../util/durations';
import type { App, Bootstrap } from './fixtures';
import { initStorage, debug } from './fixtures';

describe('storage service', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let group: Group;

  beforeEach(async () => {
    ({ bootstrap, app, group } = await initStorage());
  });

  afterEach(async function after() {
    if (!bootstrap) {
      return;
    }

    if (this.currentTest?.state !== 'passed') {
      await bootstrap.saveLogs();
    }

    await app.close();
    await bootstrap.teardown();
  });

  it('should pin/unpin groups', async () => {
    const { phone, desktop, contacts } = bootstrap;

    const window = await app.getWindow();

    const leftPane = window.locator('.left-pane-wrapper');
    const conversationStack = window.locator('.conversation-stack');

    debug('Verifying that the group is pinned on startup');
    await leftPane
      .locator(
        '_react=ConversationListItem' +
          '[isPinned = true] ' +
          `[title = ${JSON.stringify(group.title)}]`
      )
      .waitFor();

    debug('Unpinning group via storage service');
    {
      const state = await phone.expectStorageState('initial state');

      await phone.setStorageState(state.unpinGroup(group));
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await leftPane
        .locator(
          '_react=ConversationListItem' +
            '[isPinned = false] ' +
            `[title = ${JSON.stringify(group.title)}]`
        )
        .waitFor();
    }

    debug('Pinning group in the app');
    {
      const state = await phone.expectStorageState('consistency check');

      const convo = leftPane.locator(
        '_react=ConversationListItem' +
          '[isPinned = false] ' +
          `[title = ${JSON.stringify(group.title)}]`
      );
      await convo.click();

      const moreButton = conversationStack.locator(
        'button.module-ConversationHeader__button--more'
      );
      await moreButton.click();

      const pinButton = conversationStack.locator(
        '.react-contextmenu-item >> "Pin Conversation"'
      );
      await pinButton.click();

      const newState = await phone.waitForStorageState({
        after: state,
      });
      assert.isTrue(await newState.isGroupPinned(group), 'group not pinned');

      // AccountRecord
      const { added, removed } = newState.diff(state);
      assert.strictEqual(added.length, 1, 'only one record must be added');
      assert.strictEqual(removed.length, 1, 'only one record must be removed');
    }

    debug('Pinning > 4 conversations');
    {
      // We already have one group and first contact pinned so we need three
      // more.
      const toPin = contacts.slice(1, 4);

      // To do that we need them to appear in the left pane, though.
      for (const [i, contact] of toPin.entries()) {
        const isLast = i === toPin.length - 1;

        debug('sending a message to contact=%d', i);
        await contact.sendText(desktop, 'Hello!', {
          timestamp: bootstrap.getTimestamp(),
        });

        const state = await phone.expectStorageState('consistency check');

        debug('pinning contact=%d', i);
        const convo = leftPane.locator(
          '_react=ConversationListItem' +
            `[title = ${JSON.stringify(contact.profileName)}]`
        );
        await convo.click();

        const moreButton = conversationStack.locator(
          'button.module-ConversationHeader__button--more'
        );
        await moreButton.click();

        const pinButton = conversationStack.locator(
          '.react-contextmenu-item >> "Pin Conversation"'
        );
        await pinButton.click();

        if (isLast) {
          // Storage state shouldn't be updated because we failed to pin
          await window
            .locator('.Toast >> "You can only pin up to 4 chats"')
            .waitFor();
          break;
        }

        debug('verifying storage state change contact=%d', i);
        const newState = await phone.waitForStorageState({
          after: state,
        });
        assert.isTrue(await newState.isPinned(contact), 'contact not pinned');

        // AccountRecord
        const { added, removed } = newState.diff(state);
        assert.strictEqual(added.length, 1, 'only one record must be added');
        assert.strictEqual(
          removed.length,
          1,
          'only one record must be removed'
        );
      }
    }

    debug('Verifying the final manifest version');
    const finalState = await phone.expectStorageState('consistency check');

    assert.strictEqual(finalState.version, 5);
  });
});
