// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import Long from 'long';
import { Proto, StorageState } from '@signalapp/mock-server';
import { expect } from 'playwright/test';

import { generateStoryDistributionId } from '../../types/StoryDistributionId';
import { MY_STORY_ID } from '../../types/Stories';
import { uuidToBytes } from '../../util/uuidToBytes';
import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:test:backups');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

const DISTRIBUTION1 = generateStoryDistributionId();

describe('backups', function (this: Mocha.Suite) {
  this.timeout(100 * durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    let state = StorageState.getEmpty();

    const { phone, contacts } = bootstrap;
    const [friend, pinned] = contacts;

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      e164: phone.device.number,
      givenName: phone.profileName,
      readReceipts: true,
      hasCompletedUsernameOnboarding: true,
    });

    state = state.addContact(friend, {
      identityKey: friend.publicKey.serialize(),
      profileKey: friend.profileKey.serialize(),
    });

    state = state.addContact(pinned, {
      identityKey: pinned.publicKey.serialize(),
      profileKey: pinned.profileKey.serialize(),
      whitelisted: true,
    });

    state = state.pin(pinned);

    // Create empty My Story
    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORY_ID),
          isBlockList: true,
          name: MY_STORY_ID,
          recipientServiceIds: [pinned.device.aci],
        },
      },
    });

    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(DISTRIBUTION1),
          isBlockList: false,
          name: 'friend',
          recipientServiceIds: [friend.device.aci],
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

  it('exports and imports backup', async function () {
    const { contacts, phone, desktop, server } = bootstrap;
    const [friend, pinned] = contacts;

    {
      debug('wait for storage service sync to finish');
      const window = await app.getWindow();

      const leftPane = window.locator('#LeftPane');
      const contact = leftPane.locator(
        `[data-testid="${pinned.device.aci}"] >> "${pinned.profileName}"`
      );
      await contact.click();

      debug('setting bubble color');
      const conversationStack = window.locator('.Inbox__conversation-stack');
      await conversationStack
        .locator('button.module-ConversationHeader__button--more')
        .click();

      await window
        .locator('.react-contextmenu-item >> "Chat settings"')
        .click();

      await conversationStack
        .locator('.ConversationDetails__chat-color')
        .click();
      await conversationStack
        .locator('.ChatColorPicker__bubble--infrared')
        .click();

      const backButton = conversationStack.locator(
        '.ConversationPanel__header__back-button'
      );
      // Go back from colors
      await backButton.first().click();
      // Go back from settings
      await backButton.last().click();
    }

    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await server.send(
        desktop,
        // eslint-disable-next-line no-await-in-loop
        await phone.encryptSyncSent(desktop, `to pinned ${i}`, {
          timestamp: bootstrap.getTimestamp(),
          destinationServiceId: pinned.device.aci,
        })
      );

      const theirTimestamp = bootstrap.getTimestamp();

      // eslint-disable-next-line no-await-in-loop
      await friend.sendText(desktop, `msg ${i}`, {
        timestamp: theirTimestamp,
      });

      const ourTimestamp = bootstrap.getTimestamp();

      // eslint-disable-next-line no-await-in-loop
      await server.send(
        desktop,
        // eslint-disable-next-line no-await-in-loop
        await phone.encryptSyncSent(desktop, `respond ${i}`, {
          timestamp: ourTimestamp,
          destinationServiceId: friend.device.aci,
        })
      );

      const reactionTimestamp = bootstrap.getTimestamp();

      // eslint-disable-next-line no-await-in-loop
      await friend.sendRaw(
        desktop,
        {
          dataMessage: {
            timestamp: Long.fromNumber(reactionTimestamp),
            reaction: {
              emoji: '👍',
              targetAuthorAci: desktop.aci,
              targetTimestamp: Long.fromNumber(ourTimestamp),
            },
          },
        },
        {
          timestamp: reactionTimestamp,
        }
      );
    }

    await app.uploadBackup();

    const comparator = await bootstrap.createScreenshotComparator(
      app,
      async (window, snapshot) => {
        const leftPane = window.locator('#LeftPane');
        const pinnedElem = leftPane.locator(
          `[data-testid="${pinned.toContact().aci}"] >> "to pinned 4"`
        );

        debug('Waiting for messages to pinned contact to come through');
        await pinnedElem.click();

        const contactElem = leftPane.locator(
          `[data-testid="${friend.toContact().aci}"] >> "respond 4"`
        );

        debug('Waiting for messages to regular contact to come through');
        await contactElem.waitFor();

        await snapshot('styled bubbles');

        debug('Waiting for unread count');
        const unreadCount = await leftPane
          .locator(
            '.module-conversation-list__item--contact-or-conversation__unread-indicator.module-conversation-list__item--contact-or-conversation__unread-indicator--unread-messages'
          )
          .last();
        await unreadCount.waitFor();

        debug('Going into the conversation');
        await contactElem.click();
        await window
          .locator('.ConversationView .module-message >> "respond 4"')
          .waitFor();

        debug('Waiting for conversation to be marked read');
        await unreadCount.waitFor({ state: 'hidden' });

        debug('Switching to stories nav tab');
        await window.getByTestId('NavTabsItem--Stories').click();

        debug('Opening story privacy');
        await window.locator('.StoriesTab__MoreActionsIcon').click();
        await window.getByRole('button', { name: 'Story Privacy' }).click();
        await expect(
          window.locator('.StoriesSettingsModal__overlay')
        ).toHaveCSS('opacity', '1');

        await snapshot('story privacy');
      },
      this.test
    );

    await app.close();

    // Restart
    await bootstrap.eraseStorage();
    app = await bootstrap.link();
    await app.waitForBackupImportComplete();

    // Make sure that contact sync happens after backup import, otherwise the
    // app won't show contacts as "system"
    await app.waitForContactSync();

    await comparator(app);
  });
});
