// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import createDebug from 'debug';
import Long from 'long';
import { Proto, StorageState } from '@signalapp/mock-server';
import { expect } from 'playwright/test';

import { generateStoryDistributionId } from '../../types/StoryDistributionId';
import { MY_STORY_ID } from '../../types/Stories';
import { generateAci } from '../../types/ServiceId';
import { generateBackup } from '../../test-both/helpers/generateBackup';
import { IMAGE_JPEG } from '../../types/MIME';
import { uuidToBytes } from '../../util/uuidToBytes';
import * as durations from '../../util/durations';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import {
  getMessageInTimelineByTimestamp,
  sendTextMessage,
  sendReaction,
} from '../helpers';

export const debug = createDebug('mock:test:backups');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

const DISTRIBUTION1 = generateStoryDistributionId();

const CAT_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'cat-screenshot.png'
);

describe('backups', function (this: Mocha.Suite) {
  this.timeout(100 * durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('exports and imports regular backup', async function () {
    let state = StorageState.getEmpty();

    const { phone, contacts } = bootstrap;
    const [friend, pinned] = contacts;

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
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

    const { desktop, server } = bootstrap;

    {
      const window = await app.getWindow();

      debug('wait for storage service sync to finish');

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

    const sends = new Array<Promise<void>>();

    for (let i = 0; i < 5; i += 1) {
      sends.push(
        sendTextMessage({
          from: phone,
          to: pinned,
          text: `to pinned ${i}`,
          desktop,
          timestamp: bootstrap.getTimestamp(),
        })
      );

      const theirTimestamp = bootstrap.getTimestamp();

      sends.push(
        sendTextMessage({
          from: friend,
          to: desktop,
          text: `msg ${i}`,
          desktop,
          timestamp: theirTimestamp,
        })
      );

      const ourTimestamp = bootstrap.getTimestamp();

      sends.push(
        sendTextMessage({
          from: phone,
          to: friend,
          text: `respond ${i}`,
          desktop,
          timestamp: ourTimestamp,
        })
      );

      const reactionTimestamp = bootstrap.getTimestamp();
      sends.push(
        sendReaction({
          from: friend,
          to: desktop,
          targetAuthor: desktop,
          targetMessageTimestamp: ourTimestamp,
          reactionTimestamp,
          desktop,
          emoji: '👍',
        })
      );
    }

    const catTimestamp = bootstrap.getTimestamp();
    const plaintextCat = await readFile(CAT_PATH);
    const ciphertextCat = await bootstrap.storeAttachmentOnCDN(
      plaintextCat,
      IMAGE_JPEG
    );
    sends.push(
      pinned.sendRaw(
        desktop,
        {
          dataMessage: {
            timestamp: Long.fromNumber(catTimestamp),
            attachments: [ciphertextCat],
          },
        },
        {
          timestamp: catTimestamp,
        }
      )
    );

    await Promise.all(sends);

    {
      const window = await app.getWindow();
      await getMessageInTimelineByTimestamp(window, catTimestamp)
        .locator('img')
        .waitFor();
    }

    await app.uploadBackup();

    const comparator = await bootstrap.createScreenshotComparator(
      app,
      async (window, snapshot) => {
        const leftPane = window.locator('#LeftPane');
        const pinnedElem = leftPane.locator(
          `[data-testid="${pinned.toContact().aci}"] >> "Photo"`
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
    await server.removeAllCDNAttachments();
    app = await bootstrap.link();
    await app.waitForBackupImportComplete();

    // Make sure that contact sync happens after backup import, otherwise the
    // app won't show contacts as "system"
    await app.waitForContactSync();

    debug('Waiting for attachments to be downloaded');
    {
      const window = await app.getWindow();
      await window
        .locator('.BackupMediaDownloadProgress__button-close')
        .click();
    }

    await comparator(app);
  });

  it('imports ephemeral backup', async function () {
    const ephemeralBackupKey = randomBytes(32);
    const cdnKey = randomBytes(16).toString('hex');

    const { phone, server } = bootstrap;

    const contact1 = generateAci();
    const contact2 = generateAci();

    phone.ephemeralBackupKey = ephemeralBackupKey;

    // Store backup attachment in transit tier
    const { stream: backupStream } = generateBackup({
      aci: phone.device.aci,
      profileKey: phone.profileKey.serialize(),
      mediaRootBackupKey: phone.mediaRootBackupKey,
      backupKey: ephemeralBackupKey,
      conversations: 2,
      conversationAcis: [contact1, contact2],
      messages: 50,
    });

    await server.storeAttachmentOnCdn(3, cdnKey, backupStream);

    app = await bootstrap.link({
      ephemeralBackup: {
        cdn: 3,
        key: cdnKey,
      },
    });

    await app.waitForBackupImportComplete();

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');

    const contact1Elem = leftPane.locator(
      `[data-testid="${contact1}"] >> "Message 48"`
    );
    const contact2Elem = leftPane.locator(
      `[data-testid="${contact2}"] >> "Message 49"`
    );
    await contact1Elem.waitFor();

    await contact2Elem.click();
    await window.locator('.module-message >> "Message 33"').waitFor();
  });
});
