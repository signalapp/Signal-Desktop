// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-await-in-loop */

import { assert } from 'chai';

import type { Group } from '@signalapp/mock-server';

import * as durations from '../../util/durations';
import type { App, Bootstrap } from './fixtures';
import { initStorage, debug } from './fixtures';

describe('storage service', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let group: Group;

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  for (const useLegacyStorageEncryption of [false, true]) {
    const suffix = `useLegacyStorageEncryption=${useLegacyStorageEncryption}`;
    // eslint-disable-next-line no-loop-func
    it(`should pin/unpin groups ${suffix}`, async () => {
      ({ bootstrap, app, group } = await initStorage({
        useLegacyStorageEncryption,
      }));

      const { phone, desktop, contacts } = bootstrap;

      const window = await app.getWindow();

      const leftPane = window.locator('#LeftPane');
      const conversationStack = window.locator('.Inbox__conversation-stack');

      debug('Verifying that the group is pinned on startup');
      await leftPane.locator(`[data-testid="${group.id}"]`).waitFor();

      debug('Unpinning group via storage service');
      {
        const state = await phone.expectStorageState('initial state');

        await phone.setStorageState(state.unpinGroup(group));
        await phone.sendFetchStorage({
          timestamp: bootstrap.getTimestamp(),
        });

        await leftPane.locator(`[data-testid="${group.id}"]`).waitFor();
      }

      debug('Pinning group in the app');
      {
        const state = await phone.expectStorageState('consistency check');

        const convo = leftPane.locator(`[data-testid="${group.id}"]`);
        await convo.click();

        const moreButton = conversationStack.locator(
          'button.module-ConversationHeader__button--more'
        );
        await moreButton.click();

        const pinButton = window.locator(
          '.react-contextmenu-item >> "Pin chat"'
        );
        await pinButton.click();

        const newState = await phone.waitForStorageState({
          after: state,
        });
        assert.isTrue(await newState.isGroupPinned(group), 'group not pinned');

        // AccountRecord
        const { added, removed } = newState.diff(state);
        assert.strictEqual(added.length, 1, 'only one record must be added');
        assert.strictEqual(
          removed.length,
          1,
          'only one record must be removed'
        );
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
            `[data-testid="${contact.toContact().aci}"]`
          );
          await convo.click();

          const moreButton = conversationStack.locator(
            'button.module-ConversationHeader__button--more'
          );
          await moreButton.click();

          const pinButton = window.locator(
            '.react-contextmenu-item >> "Pin chat"'
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
  }
});
