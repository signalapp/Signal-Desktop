// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Proto, StorageState } from '@signalapp/mock-server';
import type { PrimaryDevice } from '@signalapp/mock-server';
import { usernames } from '@signalapp/libsignal-client';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { uuidToBytes } from '../../util/uuidToBytes';
import { MY_STORY_ID } from '../../types/Stories';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';
import {
  bufferToUuid,
  typeIntoInput,
  waitForEnabledComposer,
} from '../helpers';
import { contactByEncryptedUsernameRoute } from '../../util/signalRoutes';

export const debug = createDebug('mock:test:username');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

const USERNAME = 'signalapp.55';
const NICKNAME = 'signalapp';
const CARL_USERNAME = 'carl.84';

describe('pnp/username', function (this: Mocha.Suite) {
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
          recipientServiceIds: [],
        },
      },
    });

    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  for (const type of ['profile', 'system']) {
    // eslint-disable-next-line no-loop-func
    it(`drops username when contact's ${type} name becomes known`, async () => {
      const { phone } = bootstrap;

      const window = await app.getWindow();
      const leftPane = window.locator('#LeftPane');

      debug('find username in the left pane');
      await leftPane
        .locator(
          `[data-testid="${usernameContact.device.aci}"] >> "${USERNAME}"`
        )
        .click();

      debug('Send message to username');
      {
        const compositionInput = await waitForEnabledComposer(window);

        await typeIntoInput(compositionInput, 'Hello username');
        await compositionInput.press('Enter');
      }

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
          `[data-testid="${usernameContact.device.aci}"] >> ` +
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

        assert.strictEqual(added[0].contact?.aci, usernameContact.device.aci);
        assert.strictEqual(added[0].contact?.username, '');

        assert.strictEqual(removed[0].contact?.aci, usernameContact.device.aci);
        assert.strictEqual(removed[0].contact?.username, USERNAME);
      }

      if (type === 'system') {
        // No notifications
        const notifications = window.locator('.SystemMessage');
        assert.strictEqual(
          await notifications.count(),
          0,
          'notification count'
        );
      } else {
        // One notification - the username transition
        const notifications = window.locator('.SystemMessage');
        await notifications.waitFor();
        assert.strictEqual(
          await notifications.count(),
          1,
          'notification count'
        );

        const first = await notifications.first();
        assert.strictEqual(
          await first.innerText(),
          `You started this chat with ${USERNAME}`
        );
      }
    });
  }

  it('reserves/confirms/deletes username', async () => {
    const { phone, server } = bootstrap;

    const window = await app.getWindow();

    debug('opening avatar context menu');
    await window.getByRole('button', { name: 'Profile' }).click();

    debug('opening username editor');
    const profileEditor = window.locator('.ProfileEditor');
    await profileEditor.locator('.ProfileEditor__row >> "Username"').click();

    debug('entering new username');
    const usernameField = profileEditor.locator('.Input__input');
    await typeIntoInput(usernameField, NICKNAME);

    debug('waiting for generated discriminator');
    const discriminator = profileEditor.locator(
      '.EditUsernameModalBody__discriminator__input[value]'
    );
    await discriminator.waitFor();

    const discriminatorValue = await discriminator.inputValue();
    assert.match(discriminatorValue, /^\d+$/);

    const username = `${NICKNAME}.${discriminatorValue}`;

    debug('saving username');
    let state = await phone.expectStorageState('consistency check');
    await profileEditor.locator('.module-Button >> "Save"').click();

    debug('checking the username is saved');
    {
      await profileEditor
        .locator(`.ProfileEditor__row >> "${username}"`)
        .waitFor();

      const uuid = await server.lookupByUsername(username);
      assert.strictEqual(uuid, phone.device.aci);

      const newState = await phone.waitForStorageState({
        after: state,
      });

      const { added, removed } = newState.diff(state);
      assert.strictEqual(added.length, 1, 'only one record must be added');
      assert.strictEqual(removed.length, 1, 'only one record must be removed');

      assert.strictEqual(added[0]?.account?.username, username);
      const usernameLink = added[0]?.account?.usernameLink;
      if (!usernameLink) {
        throw new Error('No username link in AccountRecord');
      }
      if (!usernameLink.entropy) {
        throw new Error('No username link entropy in AccountRecord');
      }
      if (!usernameLink.serverId) {
        throw new Error('No username link serverId in AccountRecord');
      }

      const linkUuid = bufferToUuid(Buffer.from(usernameLink.serverId));

      const encryptedLink = await server.lookupByUsernameLink(linkUuid);
      if (!encryptedLink) {
        throw new Error('Could not find link on the sever');
      }

      const linkUsername = usernames.decryptUsernameLink({
        entropy: Buffer.from(usernameLink.entropy),
        encryptedUsername: encryptedLink,
      });
      assert.strictEqual(linkUsername, username);

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

      assert.strictEqual(added[0]?.account?.username, '', 'clears username');
      assert.strictEqual(
        added[0]?.account?.usernameLink?.entropy?.length ?? 0,
        0,
        'clears usernameLink.entropy'
      );
      assert.strictEqual(
        added[0]?.account?.usernameLink?.serverId?.length ?? 0,
        0,
        'clears usernameLink.serverId'
      );

      state = newState;
    }
  });

  it('looks up contacts by username', async () => {
    const { desktop, server } = bootstrap;

    debug('creating a contact with username');
    const carl = await server.createPrimaryDevice({
      profileName: 'Carl',
    });

    await server.setUsername(carl.device.aci, CARL_USERNAME);

    const window = await app.getWindow();

    debug('entering username into search field');
    await window.getByRole('button', { name: 'New chat' }).click();

    const searchInput = window.locator('.module-SearchInput__container input');
    await typeIntoInput(searchInput, CARL_USERNAME);

    debug('starting lookup');
    await window
      .locator(`div.ListTile >> "${CARL_USERNAME}"`)
      .click({ timeout: 2000 });

    debug('sending a message');
    {
      const compositionInput = await waitForEnabledComposer(window);

      await typeIntoInput(compositionInput, 'Hello Carl');
      await compositionInput.press('Enter');

      const { body, source } = await carl.waitForMessage();
      assert.strictEqual(body, 'Hello Carl');
      assert.strictEqual(source, desktop);
    }
  });

  it('looks up contacts by username link', async () => {
    const { desktop, phone, server } = bootstrap;

    debug('creating a contact with username link');
    const carl = await server.createPrimaryDevice({
      profileName: 'Devin',
    });

    await server.setUsername(carl.device.aci, CARL_USERNAME);
    const { entropy, serverId } = await server.setUsernameLink(
      carl.device.aci,
      CARL_USERNAME
    );

    const linkUrl = contactByEncryptedUsernameRoute
      .toWebUrl({
        encryptedUsername: Buffer.concat([
          entropy,
          uuidToBytes(serverId),
        ]).toString('base64url'),
      })
      .toString();

    debug('sending link to Note to Self');
    await phone.sendText(desktop, linkUrl, {
      withProfileKey: true,
    });

    const window = await app.getWindow();

    debug('opening note to self');
    const leftPane = window.locator('#LeftPane');
    await leftPane.locator(`[data-testid="${desktop.aci}"]`).click();

    debug('clicking link');
    await window.locator('.module-message__text a').click({
      noWaitAfter: true,
    });

    debug('waiting for conversation to open');
    await window
      .locator(`.module-conversation-hero >> "${CARL_USERNAME}"`)
      .waitFor();

    debug('sending a message');
    {
      const compositionInput = await waitForEnabledComposer(window);

      await typeIntoInput(compositionInput, 'Hello Carl');
      await compositionInput.press('Enter');

      const { body, source } = await carl.waitForMessage();
      assert.strictEqual(body, 'Hello Carl');
      assert.strictEqual(source, desktop);
    }
  });
});
