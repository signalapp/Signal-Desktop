// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs, { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import os from 'node:os';
import createDebug from 'debug';
import { Proto, StorageState } from '@signalapp/mock-server';
import { assert } from 'chai';
import { expect } from 'playwright/test';
import Long from 'long';

import * as Bytes from '../../Bytes.std.js';
import { generateStoryDistributionId } from '../../types/StoryDistributionId.std.js';
import { MY_STORY_ID } from '../../types/Stories.std.js';
import { generateAci } from '../../types/ServiceId.std.js';
import { generateBackup } from '../../test-helpers/generateBackup.node.js';
import { IMAGE_JPEG } from '../../types/MIME.std.js';
import { uuidToBytes } from '../../util/uuidToBytes.std.js';
import * as durations from '../../util/durations/index.std.js';
import type { App } from '../playwright.node.js';
import { Bootstrap, type LinkOptionsType } from '../bootstrap.node.js';
import {
  getMessageInTimelineByTimestamp,
  sendTextMessage,
  sendReaction,
} from '../helpers.node.js';
import { toBase64 } from '../../Bytes.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { BackupLevel } from '../../services/backups/types.std.js';
import { generateNotificationProfileId } from '../../types/NotificationProfile-node.node.js';

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
  this.timeout(durations.MINUTE);

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

  async function generateTestDataThenRestoreBackup(
    thisVal: Mocha.Context,
    exportBackupFn: () => void,
    getBootstrapLinkParams: () => LinkOptionsType
  ) {
    let state = StorageState.getEmpty();

    const { phone, contacts } = bootstrap;
    const [friend, pinned] = contacts;

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
      readReceipts: true,
      hasCompletedUsernameOnboarding: true,
      backupTier: Long.fromNumber(BackupLevel.Paid),
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
          recipientServiceIdsBinary: [pinned.device.aciBinary],
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
          recipientServiceIdsBinary: [friend.device.aciBinary],
        },
      },
    });

    const notificationProfileName1 = 'Work';
    const now = Date.now();
    state = state.addRecord({
      type: IdentifierType.NOTIFICATION_PROFILE,
      record: {
        notificationProfile: {
          id: Bytes.fromHex(generateNotificationProfileId()),
          name: notificationProfileName1,
          color: 0xffff0000,
          createdAtMs: Long.fromNumber(now),
          allowAllCalls: true,
        },
      },
    });

    const notificationProfileName2 = 'Driving';
    state = state.addRecord({
      type: IdentifierType.NOTIFICATION_PROFILE,
      record: {
        notificationProfile: {
          id: Bytes.fromHex(generateNotificationProfileId()),
          name: notificationProfileName2,
          color: 0xff00ff00,
          createdAtMs: Long.fromNumber(now + 1),
          allowAllMentions: true,
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
    const ciphertextCat = await bootstrap.encryptAndStoreAttachmentOnCDN(
      plaintextCat,
      IMAGE_JPEG
    );
    sends.push(
      sendTextMessage({
        from: pinned,
        to: desktop,
        text: 'cat photo',
        desktop,
        timestamp: catTimestamp,
        attachments: [ciphertextCat],
      })
    );

    await Promise.all(sends);

    let catPlaintextHash: string;
    {
      const window = await app.getWindow();
      await getMessageInTimelineByTimestamp(window, catTimestamp)
        .locator('img')
        .waitFor();

      const [catMessage] = await app.getMessagesBySentAt(catTimestamp);
      const [image] = catMessage.attachments ?? [];
      strictAssert(image.plaintextHash, 'plaintextHash was calculated');
      strictAssert(image.digest, 'digest was calculated at download time');
      strictAssert(
        ciphertextCat.digest,
        'digest was calculated at upload time'
      );
      assert.strictEqual(image.digest, toBase64(ciphertextCat.digest));
      catPlaintextHash = image.plaintextHash;
    }

    await exportBackupFn();

    const comparator = await bootstrap.createScreenshotComparator(
      app,
      async (window, snapshot) => {
        const leftPane = window.locator('#LeftPane');
        const pinnedElem = leftPane.locator(
          `[data-testid="${pinned.device.aci}"] >> "cat photo"`
        );

        debug('Waiting for messages to pinned contact to come through');
        await pinnedElem.click();

        const contactElem = leftPane.locator(
          `[data-testid="${friend.device.aci}"] >> "respond 4"`
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
        await window.getByRole('menuitem', { name: 'Story Privacy' }).click();
        await expect(
          window.locator('.StoriesSettingsModal__overlay')
        ).toHaveCSS('opacity', '1');

        await snapshot('story privacy');

        debug('Closing story privacy dialog');
        await window.locator('.module-Modal__close-button').click();

        debug('Switching to settings tab');
        await window.getByTestId('NavTabsItem--Settings').click();

        debug('Opening Notification Profiles list screen');
        await window.getByRole('button', { name: 'Notifications' }).click();
        await window.getByTestId('ManageNotificationProfiles').click();
        await expect(
          window.getByTestId(`EditProfile--${notificationProfileName1}`)
        ).toBeVisible();
        await expect(
          window.getByTestId(`EditProfile--${notificationProfileName2}`)
        ).toBeVisible();

        await snapshot('notification profile list');
      },
      thisVal.test
    );

    await app.close();

    // Restart
    await bootstrap.eraseStorage();
    await server.removeAllCDNAttachments();
    const bootstrapLinkParams = getBootstrapLinkParams();
    app = await bootstrap.link(bootstrapLinkParams);
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

    {
      const [catMessage] = await app.getMessagesBySentAt(catTimestamp);
      const [image] = catMessage.attachments ?? [];
      if (!bootstrapLinkParams.localBackup) {
        strictAssert(
          image.digest,
          'digest was calculated after download from media tier'
        );
        assert.strictEqual(image.digest, toBase64(ciphertextCat.digest));
      }
      assert.strictEqual(image.plaintextHash, catPlaintextHash);
    }

    await comparator(app);
  }

  it('exports and imports local backup', async function () {
    let snapshotDir: string;

    await generateTestDataThenRestoreBackup(
      this,
      async () => {
        const backupsBaseDir = await fs.mkdtemp(
          join(os.tmpdir(), 'SignalBackups')
        );
        snapshotDir = await app.exportLocalBackup(backupsBaseDir);
        assert.exists(
          snapshotDir,
          'Local backup export should return backup dir'
        );
      },
      () => ({ localBackup: snapshotDir })
    );
  });

  it('exports and imports regular backup', async function () {
    await generateTestDataThenRestoreBackup(
      this,
      async () => {
        await app.uploadBackup();
      },
      () => ({})
    );
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

  it('handles remote ephemeral backup cancellation', async function () {
    const ephemeralBackupKey = randomBytes(32);

    const { phone, server } = bootstrap;

    phone.ephemeralBackupKey = ephemeralBackupKey;

    app = await bootstrap.link({
      ephemeralBackup: {
        error: 'RELINK_REQUESTED',
      },
    });

    const window = await app.getWindow();
    const modal = window.getByTestId(
      'ConfirmationDialog.InstallScreenBackupImportStep.error'
    );

    await modal.waitFor();

    await modal.getByRole('button', { name: 'Retry' }).click();

    await window
      .locator('.module-InstallScreenQrCodeNotScannedStep__qr-code--loaded')
      .waitFor();

    debug('waiting for provision');
    const provision = await server.waitForProvision();

    debug('waiting for provision URL');
    const provisionURL = await app.waitForProvisionURL();

    debug('completing provision');
    await provision.complete({
      provisionURL,
      primaryDevice: phone,
    });
  });
});
