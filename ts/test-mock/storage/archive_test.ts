// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as durations from '../../util/durations';
import type { App, Bootstrap } from './fixtures';
import { initStorage, debug } from './fixtures';

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

  it('should archive/unarchive contacts', async () => {
    const { phone, contacts } = bootstrap;
    const [firstContact] = contacts;

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');
    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('archiving contact');
    {
      const state = await phone.expectStorageState('consistency check');
      const newState = state
        .updateContact(firstContact, { archived: true })
        .unpin(firstContact);

      await phone.setStorageState(newState);
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await leftPane
        .locator(`[data-testid="${firstContact.toContact().aci}"]`)
        .waitFor({ state: 'hidden' });

      await leftPane
        .locator('button.module-conversation-list__item--archive-button')
        .waitFor();

      await app.waitForManifestVersion(newState.version);
    }

    debug('unarchiving pinned contact');
    {
      const state = await phone.expectStorageState('consistency check');
      const newState = state
        .updateContact(firstContact, {
          archived: false,
        })
        .pin(firstContact);

      await phone.setStorageState(newState);
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await leftPane
        .locator(`[data-testid="${firstContact.toContact().aci}"]`)
        .waitFor();

      await leftPane
        .locator('button.module-conversation-list__item--archive-button')
        .waitFor({ state: 'hidden' });

      await app.waitForManifestVersion(newState.version);
    }

    debug('archive pinned contact in the app');
    {
      const state = await phone.expectStorageState('consistency check');

      await leftPane
        .locator(`[data-testid="${firstContact.toContact().aci}"]`)
        .click();

      const moreButton = conversationStack.locator(
        'button.module-ConversationHeader__button--more'
      );
      await moreButton.click();

      const archiveButton = window.locator(
        '.react-contextmenu-item >> "Archive"'
      );
      await archiveButton.click();

      const newState = await phone.waitForStorageState({
        after: state,
      });
      assert.ok(!(await newState.isPinned(firstContact)), 'contact not pinned');
      const record = await newState.getContact(firstContact);
      assert.ok(record, 'contact record not found');
      assert.ok(record?.archived, 'contact archived');

      // AccountRecord + ContactRecord
      const { added, removed } = newState.diff(state);
      assert.strictEqual(added.length, 2, 'only two records must be added');
      assert.strictEqual(removed.length, 2, 'only two records must be removed');
    }

    debug('Verifying the final manifest version');
    const finalState = await phone.expectStorageState('consistency check');

    assert.strictEqual(finalState.version, 4);
  });
});
