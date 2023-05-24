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
const NICKNAME = 'signalapp';
const CARL_USERNAME = 'carl.84';

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

  for (const type of ['profile', 'system']) {
    // eslint-disable-next-line no-loop-func
    it(`drops username when contact's ${type} name becomes known`, async () => {
      const { phone } = bootstrap;

      const window = await app.getWindow();
      const leftPane = window.locator('.left-pane-wrapper');

      debug('find username in the left pane');
      await leftPane
        .locator(
          `[data-testid="${usernameContact.device.uuid}"] >> "${USERNAME}"`
        )
        .waitFor();

      let state = await phone.expectStorageState('consistency check');

      if (type === 'profile') {
        debug('adding profile key for username contact');
        state = state.updateContact(usernameContact, {
          profileKey: usernameContact.profileKey.serialize(),
        });
      } else {
        debug('adding nickname for username contact');
        state = state.updateContact(usernameContact, {
          systemNickname: usernameContact.profileName,
        });
      }
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
        assert.strictEqual(
          removed.length,
          1,
          'only one record must be removed'
        );

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
  }

  it('reserves/confirms/deletes username', async () => {
    const { phone, server } = bootstrap;

    const window = await app.getWindow();

    debug('opening avatar context menu');
    await window
      .locator('.module-main-header .module-Avatar__contents')
      .click();

    debug('opening profile editor');
    await window
      .locator('.module-avatar-popup .module-avatar-popup__profile')
      .click();

    debug('opening username editor');
    const profileEditor = window.locator('.ProfileEditor');
    await profileEditor.locator('.ProfileEditor__row >> "Username"').click();

    debug('skipping onboarding');
    await profileEditor.locator('.module-Button >> "Continue"').click();

    debug('entering new username');
    const usernameField = profileEditor.locator('.Input__input');
    await usernameField.type(NICKNAME);

    debug('waiting for generated discriminator');
    const discriminator = profileEditor.locator(
      '.EditUsernameModalBody__discriminator:not(:empty)'
    );
    await discriminator.waitFor();

    const discriminatorValue = await discriminator.innerText();
    assert.match(discriminatorValue, /^\.\d+$/);

    const username = `${NICKNAME}${discriminatorValue}`;

    debug('saving username');
    let state = await phone.expectStorageState('consistency check');
    await profileEditor.locator('.module-Button >> "Save"').click();

    debug('checking the username is saved');
    {
      await profileEditor
        .locator(`.ProfileEditor__row >> "${username}"`)
        .waitFor();

      const uuid = await server.lookupByUsername(username);
      assert.strictEqual(uuid, phone.device.uuid);

      const newState = await phone.waitForStorageState({
        after: state,
      });

      const { added, removed } = newState.diff(state);
      assert.strictEqual(added.length, 1, 'only one record must be added');
      assert.strictEqual(removed.length, 1, 'only one record must be removed');

      assert.strictEqual(added[0]?.account?.username, username);

      state = newState;
    }

    debug('deleting username');
    await profileEditor
      .locator('button[aria-label="Copy or delete username"]')
      .click();
    await profileEditor.locator('button[aria-label="Delete"]').click();
    await window
      .locator('.module-Modal .module-Modal__button-footer button >> "Delete"')
      .click();
    await profileEditor.locator('.ProfileEditor__row >> "Username"').waitFor();

    debug('confirming username deletion');
    {
      const uuid = await server.lookupByUsername(username);
      assert.strictEqual(uuid, undefined);

      const newState = await phone.waitForStorageState({
        after: state,
      });

      const { added, removed } = newState.diff(state);
      assert.strictEqual(added.length, 1, 'only one record must be added');
      assert.strictEqual(removed.length, 1, 'only one record must be removed');

      assert.strictEqual(added[0]?.account?.username, '');

      state = newState;
    }
  });

  it('looks up contacts by username', async () => {
    const { desktop, server } = bootstrap;

    debug('creating a contact with username');
    const carl = await server.createPrimaryDevice({
      profileName: 'Carl',
    });

    await server.setUsername(carl.device.uuid, CARL_USERNAME);

    const window = await app.getWindow();

    debug('entering username into search field');
    await window.locator('button[aria-label="New chat"]').click();

    const searchInput = window.locator('.module-SearchInput__container input');
    await searchInput.type(CARL_USERNAME);

    debug('starting lookup');
    await window.locator(`div.ListTile >> "${CARL_USERNAME}"`).click();

    debug('sending a message');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('Hello Carl');
      await compositionInput.press('Enter');

      const { body, source } = await carl.waitForMessage();
      assert.strictEqual(body, 'Hello Carl');
      assert.strictEqual(source, desktop);
    }
  });
});
