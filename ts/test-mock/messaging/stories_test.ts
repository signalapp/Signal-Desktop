// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import Long from 'long';
import { Proto, StorageState } from '@signalapp/mock-server';
import type { Group } from '@signalapp/mock-server';

import * as durations from '../../util/durations';
import { uuidToBytes } from '../../util/uuidToBytes';
import { MY_STORY_ID } from '../../types/Stories';
import { generateStoryDistributionId } from '../../types/StoryDistributionId';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:test:stories');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

const DISTRIBUTION1 = generateStoryDistributionId();
const DISTRIBUTION2 = generateStoryDistributionId();

describe('story/messaging', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let group: Group;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { phone, contacts } = bootstrap;
    const [first, second] = contacts;

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
      hasSetMyStoriesPrivacy: true,
    });

    // Create empty My Story
    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORY_ID),
          isBlockList: false,
          name: MY_STORY_ID,
          recipientServiceIds: [],
        },
      },
    });

    // Create two distribution lists corresponding to two contacts
    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(DISTRIBUTION1),
          isBlockList: false,
          name: 'first',
          recipientServiceIds: [first.device.aci],
        },
      },
    });
    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(DISTRIBUTION2),
          isBlockList: false,
          name: 'second',
          recipientServiceIds: [second.device.aci],
        },
      },
    });

    // Add a group for story send
    const members = [...contacts].slice(0, 10);
    group = await phone.createGroup({
      title: 'Mock Group',
      members: [phone, ...members],
    });

    state = state
      .addGroup(group, {
        whitelisted: true,
        storySendMode: Proto.GroupV2Record.StorySendMode.ENABLED,
      })
      .pinGroup(group);

    // Finally whitelist and pin contacts
    for (const contact of [first, second]) {
      state = state.addContact(contact, {
        whitelisted: true,
        serviceE164: contact.device.number,
        identityKey: contact.publicKey.serialize(),
        profileKey: contact.profileKey.serialize(),
        givenName: contact.profileName,
      });
      state = state.pin(contact);
    }

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

  it('allows replies on multiple distribution lists', async () => {
    const { phone, desktop, contacts } = bootstrap;
    const [first, second] = contacts;

    const window = await app.getWindow();
    const sentAt = Date.now();

    debug('waiting for storage service sync to complete');
    await app.waitForStorageService();

    debug('sending story sync message');
    await phone.sendRaw(
      desktop,
      {
        syncMessage: {
          sent: {
            timestamp: Long.fromNumber(sentAt),
            expirationStartTimestamp: Long.fromNumber(sentAt),
            storyMessage: {
              textAttachment: {
                text: 'hello',
              },
              allowsReplies: true,
            },
            storyMessageRecipients: [
              {
                destinationServiceId: first.device.aci,
                distributionListIds: [DISTRIBUTION1],
                isAllowedToReply: true,
              },
              {
                destinationServiceId: second.device.aci,
                distributionListIds: [DISTRIBUTION2],
                isAllowedToReply: true,
              },
            ],
          },
        },
      },
      { timestamp: sentAt }
    );

    debug('sending story replies');
    await first.sendRaw(
      desktop,
      {
        dataMessage: {
          body: 'first reply',
          storyContext: {
            authorAci: phone.device.aci,
            sentTimestamp: Long.fromNumber(sentAt),
          },
          timestamp: Long.fromNumber(sentAt + 1),
        },
      },
      { timestamp: sentAt + 1 }
    );
    await second.sendRaw(
      desktop,
      {
        dataMessage: {
          body: 'second reply',
          storyContext: {
            authorAci: phone.device.aci,
            sentTimestamp: Long.fromNumber(sentAt),
          },
          timestamp: Long.fromNumber(sentAt + 2),
        },
      },
      { timestamp: sentAt + 2 }
    );

    const leftPane = window.locator('#LeftPane');

    debug('Finding both replies');
    await leftPane
      .locator(`[data-testid="${first.device.aci}"] >> "first reply"`)
      .waitFor();
    await leftPane
      .locator(`[data-testid="${second.device.aci}"] >> "second reply"`)
      .waitFor();
  });

  it('allows replies to groups', async () => {
    const { desktop, contacts } = bootstrap;

    const window = await app.getWindow();

    debug('waiting for storage service sync to complete');
    await app.waitForStorageService();

    await window.getByTestId('NavTabsItem--Stories').click();

    debug('Create and send a story to the group');
    await window.getByRole('button', { name: 'Add a story' }).first().click();
    await window.getByRole('button', { name: 'Text story' }).click();
    // Note: For some reason `.click()` doesn't work here anymore.
    await window.locator('.TextAttachment').dispatchEvent('click');
    await window.getByRole('textbox', { name: 'Add text' }).fill('hello');
    await window.getByRole('button', { name: 'Next' }).click();
    await window
      .locator('.Checkbox__container')
      .getByText('Mock Group')
      .click();
    await window.getByRole('button', { name: 'Send story' }).click();

    // Grab the time the story was sent at
    const time = await window.locator('time').nth(1).getAttribute('datetime');
    if (!time) {
      throw new Error('Cannot locate story time');
    }
    const sentAt = new Date(time).valueOf();

    debug('Contact sends reply to group story', {
      story: sentAt,
      reply: sentAt + 1,
    });
    await contacts[0].sendRaw(
      desktop,
      {
        dataMessage: {
          body: 'first reply',
          storyContext: {
            authorAci: desktop.aci,
            sentTimestamp: Long.fromNumber(sentAt),
          },
          groupV2: {
            masterKey: group.masterKey,
          },
          timestamp: Long.fromNumber(sentAt + 1),
        },
      },
      { timestamp: sentAt + 1 }
    );

    debug('Ensure sender sees the reply');
    await window
      .locator('.StoryListItem__button')
      .getByText('Mock Group')
      .click();
    // For some reason we need to click the story & exit before the reply shows up
    await window.getByRole('button', { name: 'Close' }).click();
    await window
      .locator('.StoryListItem__button')
      .getByText('Mock Group')
      .click();

    await window.getByText('1 reply').click();
    await window.getByText('first reply').waitFor();
  });
});
