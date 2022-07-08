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

  it('should archive/unarchive contacts', async () => {
    const { phone, contacts } = bootstrap;
    const [firstContact] = contacts;

    const window = await app.getWindow();

    const leftPane = window.locator('.left-pane-wrapper');
    const conversationStack = window.locator('.conversation-stack');

    debug('archiving contact');
    {
      const state = await phone.expectStorageState('consistency check');

      await phone.setStorageState(
        state
          .updateContact(firstContact, { archived: true })
          .unpin(firstContact)
      );
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await leftPane
        .locator(
          '_react=ConversationListItem' +
            `[title = ${JSON.stringify(firstContact.profileName)}]`
        )
        .waitFor({ state: 'hidden' });

      await leftPane
        .locator('button.module-conversation-list__item--archive-button')
        .waitFor();
    }

    debug('unarchiving pinned contact');
    {
      const state = await phone.expectStorageState('consistency check');

      await phone.setStorageState(
        state.updateContact(firstContact, { archived: false }).pin(firstContact)
      );
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await leftPane
        .locator(
          '_react=ConversationListItem' +
            '[isPinned = true]' +
            `[title = ${JSON.stringify(firstContact.profileName)}]`
        )
        .waitFor();

      await leftPane
        .locator('button.module-conversation-list__item--archive-button')
        .waitFor({ state: 'hidden' });
    }

    debug('archive pinned contact in the app');
    {
      const state = await phone.expectStorageState('consistency check');

      await leftPane
        .locator(
          '_react=ConversationListItem' +
            `[title = ${JSON.stringify(firstContact.profileName)}]`
        )
        .click();

      const moreButton = conversationStack.locator(
        'button.module-ConversationHeader__button--more'
      );
      await moreButton.click();

      const archiveButton = conversationStack.locator(
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
