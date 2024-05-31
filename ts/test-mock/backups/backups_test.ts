// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import Long from 'long';
import { Proto, StorageState } from '@signalapp/mock-server';

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

    debug('wait for storage service sync to finish');
    {
      const window = await app.getWindow();

      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator(
          `[data-testid="${pinned.device.aci}"] >> "${pinned.profileName}"`
        )
        .waitFor();
    }

    for (let i = 0; i < 5; i += 1) {
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

    const backupPath = bootstrap.getBackupPath('backup.bin');
    await app.exportBackupToDisk(backupPath);

    const comparator = await bootstrap.createScreenshotComparator(
      app,
      async (window, snapshot) => {
        const leftPane = window.locator('#LeftPane');
        const contactElem = leftPane.locator(
          `[data-testid="${friend.toContact().aci}"] >> "respond 4"`
        );

        debug('Waiting for messages to come through');
        await contactElem.waitFor();

        await snapshot('main screen');

        debug('Going into the conversation');
        await contactElem.click();
        await window
          .locator('.ConversationView .module-message >> "respond 4"')
          .waitFor();

        await snapshot('conversation');

        debug('Switching to stories nav tab');
        await window.getByTestId('NavTabsItem--Stories').click();

        debug('Opening story privacy');
        await window.locator('.StoriesTab__MoreActionsIcon').click();
        await window.getByRole('button', { name: 'Story Privacy' }).click();

        await snapshot('story privacy');
      },
      this.test
    );

    await app.close();

    // Restart
    await bootstrap.eraseStorage();
    app = await bootstrap.link({
      ciBackupPath: backupPath,
    });

    await comparator(app);
  });
});
