// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { Group } from '@signalapp/mock-server';

import * as durations from '../../util/durations/index.std.ts';
import type { App, Bootstrap } from './fixtures.node.ts';
import { initStorage, debug } from './fixtures.node.ts';

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
    // oxlint-disable-next-line no-loop-func
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
        const modifiedState = state.unpinGroup(group);

        const newState = await phone.setStorageState(modifiedState);
        await phone.sendFetchStorage({
          timestamp: bootstrap.getTimestamp(),
        });

        await app.waitForManifestVersion(newState.version);
      }

      debug('Pinning group in the app');
      {
        const state = await phone.expectStorageState('consistency check');
        assert.isFalse(state.isGroupPinned(group));

        const convo = leftPane.getByTestId(group.id);
        await convo.click();

        const moreButton = conversationStack.getByRole('button', {
          name: 'More Info',
        });
        await moreButton.click();

        const pinButton = window.getByRole('menuitem', {
          name: 'Pin chat',
          exact: true,
        });
        await pinButton.click();

        await phone.waitForStorageState({
          after: state,
          predicate: storageState => storageState.isGroupPinned(group),
        });
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
          // oxlint-disable-next-line no-await-in-loop
          await contact.sendText(desktop, 'Hello!', {
            timestamp: bootstrap.getTimestamp(),
          });

          // oxlint-disable-next-line no-await-in-loop
          const state = await phone.expectStorageState('consistency check');
          assert.isFalse(state.isPinned(contact));

          debug('pinning contact=%d', i);
          const convo = leftPane.locator(
            `[data-testid="${contact.device.aci}"]`
          );
          // oxlint-disable-next-line no-await-in-loop
          await convo.click();

          const moreButton = conversationStack.getByRole('button', {
            name: 'More Info',
          });
          // oxlint-disable-next-line no-await-in-loop
          await moreButton.click();

          const pinButton = window.getByRole('menuitem', {
            name: 'Pin chat',
            exact: true,
          });
          // oxlint-disable-next-line no-await-in-loop
          await pinButton.click();

          if (isLast) {
            // The fifth chat should remain unpinned.
            // oxlint-disable-next-line no-await-in-loop
            await window
              .locator('.Toast >> "You can only pin up to 4 chats"')
              .waitFor();
            break;
          }

          debug('verifying storage state change contact=%d', i);
          // oxlint-disable-next-line no-await-in-loop
          await phone.waitForStorageState({
            after: state,
            predicate: storageState => storageState.isPinned(contact),
          });
        }
      }

      debug('Verifying the final pinned conversations');
      const finalState = await phone.expectStorageState('consistency check');

      assert.isTrue(finalState.isGroupPinned(group));
      for (const [index, contact] of contacts.slice(0, 4).entries()) {
        assert.strictEqual(finalState.isPinned(contact), index < 3);
      }
      assert.lengthOf(
        finalState.getAccountRecord()?.pinnedConversations ?? [],
        4
      );
    });
  }
});
