// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Long from 'long';
import { Proto, StorageState } from '@signalapp/mock-server';
import * as durations from '../../util/durations';
import type { App } from './fixtures';
import { Bootstrap, debug, getCallLinkRecordPredicate } from './fixtures';
import { createCallLink } from '../helpers';
import { uuidToBytes } from '../../util/uuidToBytes';
import { MY_STORY_ID } from '../../types/Stories';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('storage service', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 0 });
    await bootstrap.init();

    const { phone } = bootstrap;

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
    });

    // Add my story
    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORY_ID),
          isBlockList: true,
          name: MY_STORY_ID,
          recipientServiceIds: [],
        },
      },
    });

    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    if (app) {
      await app.close();
    }
    await bootstrap.teardown();
  });

  it('should save created call links and restore on relink', async () => {
    const { phone } = bootstrap;

    let state;

    const window = await app.getWindow();
    state = await phone.expectStorageState('initial state');

    debug('Creating call link');
    const roomId = await createCallLink(window, { name: 'Fun link' });
    assert.exists(roomId, 'Call link roomId should exist');

    debug('Waiting for storage update');
    state = await phone.waitForStorageState({ after: state });

    const record = state.findRecord(getCallLinkRecordPredicate(roomId));
    assert.ok(record, 'Saves call link record with matching roomId');
    const deletedAt = Long.fromValue(
      record.record.callLink?.deletedAtTimestampMs ?? 0
    ).toNumber();
    assert.notOk(deletedAt, 'deletedAt falsey');

    debug('Creating link then deleting it');
    const roomIdDelete = await createCallLink(window, {
      name: 'Link to delete',
    });
    assert.exists(roomIdDelete, 'Call link roomId should exist');

    debug('Waiting for storage update');
    state = await phone.waitForStorageState({ after: state });

    const recordToDelete = state.findRecord(
      getCallLinkRecordPredicate(roomIdDelete)
    );
    assert.ok(recordToDelete, 'Saves call link record with matching roomId');

    const deletedAtBeforeDelete = Long.fromValue(
      recordToDelete.record.callLink?.deletedAtTimestampMs ?? 0
    ).toNumber();
    assert.notOk(deletedAtBeforeDelete, 'deletedAt falsey');

    debug('Deleting call link');
    const callLinkItem = await window.getByText('Link to delete');
    await callLinkItem.click();
    const callLinkDetails = await window.locator(
      '.CallsTab__ConversationCallDetails'
    );
    await callLinkDetails.waitFor();
    const deleteButton = await window.getByText('Delete link');
    await deleteButton.click();
    const confirmModal = await window.getByTestId(
      'ConfirmationDialog.CallLinkDetails__DeleteLinkModal'
    );
    await confirmModal.waitFor();
    const deleteConfirm = await window
      .locator('.module-Button')
      .getByText('Delete');
    await deleteConfirm.click();

    debug('Waiting for storage update');
    state = await phone.waitForStorageState({ after: state });

    const recordAfterDelete = state.findRecord(
      getCallLinkRecordPredicate(roomIdDelete)
    );
    assert.ok(recordAfterDelete, 'Call link record still present');
    const deletedAtAfterDelete = Long.fromValue(
      recordAfterDelete.record.callLink?.deletedAtTimestampMs ?? 0
    ).toNumber();
    assert.ok(deletedAtAfterDelete, 'deletedAt present');
  });
});
