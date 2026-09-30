// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import type { PrimaryDevice } from '@signalapp/mock-server';
import { StorageState, Proto } from '@signalapp/mock-server';
import { assert } from 'chai';

import type { App } from '../playwright.node.ts';
import { Bootstrap } from '../bootstrap.node.ts';
import { MINUTE } from '../../util/durations/index.std.ts';
import { uuidToBytes } from '../../util/uuidToBytes.std.ts';
import { MY_STORY_ID } from '../../types/Stories.std.ts';
import {
  clickOnConversation,
  typeIntoInput,
  expectSystemMessages,
  waitForEnabledComposer,
} from '../helpers.node.ts';

export const debug = createDebug('mock:test:safetyNumber');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('safety number', function (this: Mocha.Suite) {
  let bootstrap: Bootstrap;
  let app: App;

  this.timeout(MINUTE);
  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { phone, contacts } = bootstrap;
    const [alice] = contacts as [PrimaryDevice];
    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
      hasSetMyStoriesPrivacy: true,
    });

    state = state.addContact(alice, {
      identityKey: alice.publicKey.serialize(),
      profileKey: alice.profileKey.serialize(),
    });
    state = state.pin(alice);

    // Create a story distribution list
    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORY_ID),
          isBlockList: false,
          name: MY_STORY_ID,
          recipientServiceIdsBinary: [alice.device.aciBinary],
          deletedAtTimestamp: null,
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
    await app.close();
    await bootstrap.teardown();
  });

  async function changeIdentityKey(): Promise<PrimaryDevice> {
    const { contacts, phone, server } = bootstrap;
    const [alice] = contacts as [PrimaryDevice];

    await app.waitForStorageService();

    debug('reregistering contact');
    const newAlicePrimary = await server.reregisterPrimaryDevice({
      aci: alice.device.aci,
      profileName: 'Updated Profile Name',
    });

    debug('updating public key in storage service');
    let state = await phone.expectStorageState('after link');

    // Update identity key
    state = state.updateContact(alice, {
      identityKey: newAlicePrimary.publicKey.serialize(),
    });

    await phone.setStorageState(state);
    await phone.sendFetchStorage({
      timestamp: bootstrap.getTimestamp(),
    });

    await app.waitForStorageService();

    return newAlicePrimary;
  }

  it('show safety number change UI on regular send', async () => {
    const { contacts } = bootstrap;
    const [alice] = contacts as [PrimaryDevice];

    const window = await app.getWindow();

    await clickOnConversation(window, alice);

    const input = await waitForEnabledComposer(window);
    await typeIntoInput(input, 'Hello Alice!', '');

    const newAlicePrimary = await changeIdentityKey();

    await expectSystemMessages(window, [
      // Alice's updated key via storage service, leading to profile fetch
      /Safety Number with Alice/,
    ]);

    debug('Sending message');
    await input.press('Enter');

    debug('Waiting for safety number dialog');
    const dialog = window.getByRole('alertdialog', {
      name: 'Safety Number Changes',
    });

    debug(`Checking for alice in dialog: ${alice.profileName}`);
    await dialog.locator(`"${alice.profileName}"`).waitFor();

    debug('Confirming send');
    await dialog.getByRole('button', { name: 'Send anyway' }).click();

    debug('Getting a message');
    const { body } = await newAlicePrimary.waitForMessage();
    assert.strictEqual(body, 'Hello Alice!');
  });

  it('show safety number change UI on story send', async () => {
    const { contacts } = bootstrap;
    const [alice] = contacts as [PrimaryDevice];
    const window = await app.getWindow();

    const storiesPane = window.locator('.Stories');
    const storiesCreator = window.locator('.StoryCreator');

    await window.getByTestId('NavTabsItem--Stories').click();

    await storiesPane
      .locator('button.Stories__pane__add-story__button')
      .click();
    await storiesPane
      .locator(
        '.ContextMenu__popper .Stories__pane__add-story__option--title ' +
          '>> "Text story"'
      )
      .click();

    debug('Focusing textarea');
    // Note: For some reason `.click()` doesn't work here anymore.
    await storiesCreator.locator('.TextAttachment').dispatchEvent('click');

    debug('Entering text');
    await storiesCreator.locator('.TextAttachment__text__textarea').fill('123');

    debug('Clicking "Next"');
    await storiesCreator
      .locator('.StoryCreator__toolbar button >> "Next"')
      .click();

    debug('Selecting "My Story"');
    await window
      .locator('.SendStoryModal__distribution-list__name >> "My Story"')
      .click();

    const newAlicePrimary = await changeIdentityKey();

    debug('Hitting Send');
    await window.locator('button.SendStoryModal__send').click();

    debug('Waiting for safety number dialog');
    const dialog = window.getByRole('alertdialog', {
      name: 'Safety Number Changes',
    });
    await dialog.locator(`"${alice.profileName}"`).waitFor();

    debug('Confirming send');
    await dialog.getByRole('button', { name: 'Send anyway' }).click();

    debug('Getting a story');
    const { storyMessage } = await newAlicePrimary.waitForStory();
    assert.ok(storyMessage.attachment?.textAttachment != null);
    assert.strictEqual(storyMessage.attachment.textAttachment.text, '123');
  });
});
