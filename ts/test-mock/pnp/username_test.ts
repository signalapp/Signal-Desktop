// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Proto, StorageState } from '@signalapp/mock-server';
import type { PrimaryDevice } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { uuidToBytes } from '../../util/uuidToBytes';
import { MY_STORY_ID } from '../../types/Stories';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';

export const debug = createDebug('mock:test:username');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

const USERNAME = 'signalapp.55';

describe('pnp/username', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let usernameContact: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 0 });
    await bootstrap.init();

    const { server, phone } = bootstrap;

    usernameContact = await server.createPrimaryDevice({
      profileName: 'ACI Contact',
    });

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      e164: phone.device.number,
    });

    state = state.addContact(usernameContact, {
      username: USERNAME,
      serviceE164: undefined,
    });

    // Put contact into left pane
    state = state.pin(usernameContact);

    // Add my story
    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORY_ID),
          isBlockList: true,
          name: MY_STORY_ID,
          recipientUuids: [],
        },
      },
    });

    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function after() {
    if (this.currentTest?.state !== 'passed') {
      await bootstrap.saveLogs(app);
    }

    await app.close();
    await bootstrap.teardown();
  });

  it('drops username when contact name becomes known', async () => {
    const { phone } = bootstrap;

    const window = await app.getWindow();
    const leftPane = window.locator('.left-pane-wrapper');

    debug('find username in the left pane');
    await leftPane
      .locator(
        `[data-testid="${usernameContact.device.uuid}"] >> "@${USERNAME}"`
      )
      .waitFor();

    debug('adding profile key for username contact');
    let state: StorageState = await phone.expectStorageState(
      'consistency check'
    );
    state = state.updateContact(usernameContact, {
      profileKey: usernameContact.profileKey.serialize(),
    });
    await phone.setStorageState(state);
    await phone.sendFetchStorage({
      timestamp: bootstrap.getTimestamp(),
    });

    debug('find profile name in the left pane');
    await leftPane
      .locator(
        `[data-testid="${usernameContact.device.uuid}"] >> ` +
          `"${usernameContact.profileName}"`
      )
      .waitFor();

    debug('verify that storage service state is updated');
    {
      const newState = await phone.waitForStorageState({
        after: state,
      });

      const { added, removed } = newState.diff(state);
      assert.strictEqual(added.length, 1, 'only one record must be added');
      assert.strictEqual(removed.length, 1, 'only one record must be removed');

      assert.strictEqual(
        added[0].contact?.serviceUuid,
        usernameContact.device.uuid
      );
      assert.strictEqual(added[0].contact?.username, '');

      assert.strictEqual(
        removed[0].contact?.serviceUuid,
        usernameContact.device.uuid
      );
      assert.strictEqual(removed[0].contact?.username, USERNAME);
    }
  });
});
