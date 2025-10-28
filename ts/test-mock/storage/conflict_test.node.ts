// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Long from 'long';
import { expect } from 'playwright/test';
import type { Group, StorageState } from '@signalapp/mock-server';
import { Proto } from '@signalapp/mock-server';

import * as durations from '../../util/durations/index.std.js';
import { createCallLink } from '../helpers.node.js';
import type { App, Bootstrap } from './fixtures.node.js';
import {
  initStorage,
  debug,
  getCallLinkRecordPredicate,
} from './fixtures.node.js';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('storage service', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let group: Group;

  beforeEach(async () => {
    ({ bootstrap, app, group } = await initStorage());
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  for (const kind of ['contact', 'group']) {
    // eslint-disable-next-line no-loop-func
    it(`should handle ${kind} conflicts`, async () => {
      const {
        phone,
        contacts: [first],
      } = bootstrap;

      const window = await app.getWindow();

      const leftPane = window.locator('#LeftPane');
      const conversationStack = window.locator('.Inbox__conversation-stack');

      const testid = kind === 'contact' ? first.device.aci : group.id;

      debug('archiving conversation on desktop');
      {
        const state = await phone.expectStorageState('consistency check');

        await leftPane.locator(`[data-testid="${testid}"]`).click();

        await conversationStack
          .locator('button.module-ConversationHeader__button--more')
          .click();

        await window.locator('.react-contextmenu-item >> "Archive"').click();

        const newState = await phone.waitForStorageState({
          after: state,
        });

        const record =
          kind === 'contact'
            ? await newState.getContact(first)
            : await newState.getGroup(group);

        assert.ok(record, 'contact record not found');
        assert.ok(record?.archived, 'contact archived');
      }

      debug('updating contact on phone without sync message');
      let archivedVersion: number;
      {
        const state = await phone.expectStorageState('consistency check');

        let newState: StorageState;

        if (kind === 'contact') {
          newState = state.updateContact(first, { archived: true });
        } else {
          newState = state.updateGroup(group, { archived: true });
        }

        newState = await phone.setStorageState(newState);
        archivedVersion = newState.version;
      }

      debug('attempting unarchive');
      await leftPane.getByLabel('Archived Chats').click();

      await leftPane.locator(`[data-testid="${testid}"]`).click();

      await conversationStack
        .locator('button.module-ConversationHeader__button--more')
        .click();

      await window.locator('.react-contextmenu-item >> "Unarchive"').click();

      await app.waitForManifestVersion(archivedVersion);

      debug('waiting for archived chats to appear again');
      await leftPane.getByLabel('Archived Chats').waitFor();

      // Conversation should be still open
      await conversationStack
        .locator('button.module-ConversationHeader__button--more')
        .click();

      await window.locator('.react-contextmenu-item >> "Unarchive"').waitFor();

      debug('Verifying the final manifest version');
      const finalState = await phone.expectStorageState('final state');

      assert.strictEqual(finalState.version, archivedVersion);
    });
  }

  it('should handle account conflicts', async () => {
    const {
      phone,
      desktop,
      contacts: [first, second],
    } = bootstrap;

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');
    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('pinning second contact');
    {
      const state = await phone.expectStorageState('consistency check');

      await second.sendText(desktop, 'Hello!', {
        timestamp: bootstrap.getTimestamp(),
      });
      await leftPane.locator(`[data-testid="${second.device.aci}"]`).click();

      await conversationStack
        .locator('button.module-ConversationHeader__button--more')
        .click();

      await window.locator('.react-contextmenu-item >> "Pin chat"').click();

      const newState = await phone.waitForStorageState({
        after: state,
      });

      assert(newState.isPinned(second));
    }

    debug('updating pins on phone without sync message');
    let archivedVersion: number;
    {
      const state = await phone.expectStorageState('consistency check');

      let newState = state.unpin(first).unpinGroup(group);

      newState = await phone.setStorageState(newState);
      archivedVersion = newState.version;
    }

    debug('unpinning second contact');
    await conversationStack
      .locator('button.module-ConversationHeader__button--more')
      .click();

    await window.locator('.react-contextmenu-item >> "Unpin chat"').click();

    await app.waitForManifestVersion(archivedVersion);

    debug('verifying that second contact is still unpinned');
    await conversationStack
      .locator('button.module-ConversationHeader__button--more')
      .click();

    await window.locator('.react-contextmenu-item >> "Unpin chat"').waitFor();

    debug('Verifying the final manifest version');
    const finalState = await phone.expectStorageState('final state');

    assert.strictEqual(finalState.version, archivedVersion);
  });

  it('should handle story distribution list conflicts', async () => {
    const { phone } = bootstrap;

    const window = await app.getWindow();

    debug('updating distribution list in UI');
    {
      const state = await phone.expectStorageState('consistency check');

      await window.getByTestId('NavTabsItem--Stories').click();

      await window.locator('.StoriesTab__MoreActionsIcon').click();
      await window.getByRole('menuitem', { name: 'Story Privacy' }).click();

      await window
        .getByTestId('StoriesSettingsModal__list')
        .getByRole('button', { name: 'My Story' })
        .click();
      await window
        .getByTestId('DistributionListSettingsModal')
        .locator('input[name=replies-reactions]')
        .click();

      const newState = await phone.waitForStorageState({
        after: state,
      });

      const updatedList = newState.findRecord(({ type }) => {
        return type === IdentifierType.STORY_DISTRIBUTION_LIST;
      });
      assert.isFalse(updatedList?.record?.storyDistributionList?.allowsReplies);
    }

    debug('updating distribution list on phone without sync');
    let archivedVersion: number;
    {
      const state = await phone.expectStorageState('consistency check');

      let newState = state.updateRecord(
        ({ type }) => {
          return type === IdentifierType.STORY_DISTRIBUTION_LIST;
        },
        // Just changing storage ID
        record => record
      );

      newState = await phone.setStorageState(newState);
      archivedVersion = newState.version;
    }

    debug('attempting update through UI again');
    await window
      .getByTestId('DistributionListSettingsModal')
      .locator('input[name=replies-reactions]')
      .click();

    await app.waitForManifestVersion(archivedVersion);

    debug('wait for checkbox to go back to unchecked');
    {
      const checkbox = window
        .getByTestId('DistributionListSettingsModal')
        .locator('input[name=replies-reactions]');
      await expect(checkbox).not.toBeChecked();
    }

    debug('Verifying the final manifest version');
    const finalState = await phone.expectStorageState('final state');

    assert.strictEqual(finalState.version, archivedVersion);
  });

  it('should handle call link conflicts', async () => {
    const { phone } = bootstrap;

    const window = await app.getWindow();
    let state = await phone.expectStorageState('initial state');

    debug('Creating call link');
    const roomId = await createCallLink(window, { name: 'Fun link' });
    assert.exists(roomId, 'Call link roomId should exist');

    debug('Waiting for storage update');
    state = await phone.waitForStorageState({ after: state });

    assert.exists(state.findRecord(getCallLinkRecordPredicate(roomId)));

    debug('Updating storage without sync');
    const deletedAt = bootstrap.getTimestamp();
    state = state.updateRecord(getCallLinkRecordPredicate(roomId), record => ({
      ...record,
      callLink: {
        ...(record.callLink ?? {}),
        deletedAtTimestampMs: Long.fromNumber(deletedAt),
      },
    }));

    state = await phone.setStorageState(state);

    debug('Deleting link in UI');
    await window.getByText('Fun link').click();
    await window
      .locator('.CallsTab__ConversationCallDetails')
      .getByText('Delete link')
      .click();

    const confirmModal = await window.getByTestId(
      'ConfirmationDialog.CallLinkDetails__DeleteLinkModal'
    );
    await confirmModal.locator('.module-Button').getByText('Delete').click();

    debug('Waiting for manifest sync');
    await app.waitForManifestVersion(state.version);

    debug('Creating second call link');
    const otherRoomId = await createCallLink(window, { name: 'Second link' });
    assert.exists(otherRoomId, 'Call link roomId should exist');

    debug('Waiting for storage update');
    state = await phone.waitForStorageState({ after: state });

    assert.strictEqual(
      state
        .findRecord(getCallLinkRecordPredicate(roomId))
        ?.record.callLink?.deletedAtTimestampMs?.toNumber(),
      deletedAt
    );
    assert.exists(state.findRecord(getCallLinkRecordPredicate(otherRoomId)));
  });
});
