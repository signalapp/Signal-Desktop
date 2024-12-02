// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  type PrimaryDevice,
  Proto,
  StorageState,
} from '@signalapp/mock-server';
import createDebug from 'debug';
import Long from 'long';

import * as durations from '../../util/durations';
import { uuidToBytes } from '../../util/uuidToBytes';
import { MY_STORY_ID } from '../../types/Stories';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';
import {
  expectSystemMessages,
  typeIntoInput,
  waitForEnabledComposer,
} from '../helpers';

export const debug = createDebug('mock:test:messaging');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

const DAY = 24 * 3600;

describe('messaging/expireTimerVersion', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let stranger: PrimaryDevice;
  const STRANGER_NAME = 'Stranger';

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 1 });
    await bootstrap.init();

    const { server, phone } = bootstrap;

    stranger = await server.createPrimaryDevice({
      profileName: STRANGER_NAME,
    });

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
    });

    state = state.addContact(stranger, {
      identityState: Proto.ContactRecord.IdentityState.DEFAULT,
      whitelisted: true,
      serviceE164: undefined,
      profileKey: stranger.profileKey.serialize(),
    });

    // Put both contacts in left pane
    state = state.pin(stranger);

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

  const SCENARIOS = [
    {
      name: 'they win and we start',
      theyFirst: false,
      ourTimer: 60 * DAY,
      ourVersion: 3,
      theirTimer: 90 * DAY,
      theirVersion: 4,
      finalTimer: 90 * DAY,
      finalVersion: 4,
      systemMessages: [
        'You set the disappearing message time to 60 days.',
        `${STRANGER_NAME} set the disappearing message time to 90 days.`,
      ],
    },
    {
      name: 'they win and start',
      theyFirst: true,
      ourTimer: 60 * DAY,
      ourVersion: 3,
      theirTimer: 90 * DAY,
      theirVersion: 4,
      finalTimer: 90 * DAY,
      finalVersion: 4,
      systemMessages: [
        `${STRANGER_NAME} set the disappearing message time to 90 days.`,
      ],
    },
    {
      name: 'we win and start',
      theyFirst: false,
      ourTimer: 60 * DAY,
      ourVersion: 4,
      theirTimer: 90 * DAY,
      theirVersion: 3,
      finalTimer: 60 * DAY,
      finalVersion: 4,
      systemMessages: ['You set the disappearing message time to 60 days.'],
    },
    {
      name: 'we win and they start',
      theyFirst: true,
      ourTimer: 60 * DAY,
      ourVersion: 4,
      theirTimer: 90 * DAY,
      theirVersion: 3,
      finalTimer: 60 * DAY,
      finalVersion: 4,
      systemMessages: [
        `${STRANGER_NAME} set the disappearing message time to 90 days.`,
        'You set the disappearing message time to 60 days.',
      ],
    },
    {
      name: 'race and we start',
      theyFirst: false,
      ourTimer: 60 * DAY,
      ourVersion: 4,
      theirTimer: 90 * DAY,
      theirVersion: 4,
      finalTimer: 90 * DAY,
      finalVersion: 4,
      systemMessages: [
        'You set the disappearing message time to 60 days.',
        `${STRANGER_NAME} set the disappearing message time to 90 days.`,
      ],
    },
    {
      name: 'race and they start',
      theyFirst: true,
      ourTimer: 60 * DAY,
      ourVersion: 4,
      theirTimer: 90 * DAY,
      theirVersion: 4,
      finalTimer: 60 * DAY,
      finalVersion: 4,
      systemMessages: [
        `${STRANGER_NAME} set the disappearing message time to 90 days.`,
        'You set the disappearing message time to 60 days.',
      ],
    },
  ];

  for (const scenario of SCENARIOS) {
    const testName =
      `sets correct version after ${scenario.name}, ` +
      `theyFirst=${scenario.theyFirst}`;
    // eslint-disable-next-line no-loop-func
    it(testName, async () => {
      const { phone, desktop } = bootstrap;

      const sendSync = async () => {
        debug('Send a sync message');
        const timestamp = bootstrap.getTimestamp();
        const destinationServiceId = stranger.device.aci;
        const content = {
          syncMessage: {
            sent: {
              destinationServiceId,
              timestamp: Long.fromNumber(timestamp),
              message: {
                body: 'request',
                timestamp: Long.fromNumber(timestamp),
                expireTimer: scenario.ourTimer,
                expireTimerVersion: scenario.ourVersion,
              },
              unidentifiedStatus: [
                {
                  destinationServiceId,
                },
              ],
            },
          },
        };
        const sendOptions = {
          timestamp,
        };
        await phone.sendRaw(desktop, content, sendOptions);
      };

      const sendResponse = async () => {
        debug('Send a response message');
        const timestamp = bootstrap.getTimestamp();
        const content = {
          dataMessage: {
            body: 'response',
            timestamp: Long.fromNumber(timestamp),
            expireTimer: scenario.theirTimer,
            expireTimerVersion: scenario.theirVersion,
          },
        };
        const sendOptions = {
          timestamp,
        };
        const key = await desktop.popSingleUseKey();
        await stranger.addSingleUseKey(desktop, key);
        await stranger.sendRaw(desktop, content, sendOptions);
      };

      if (scenario.theyFirst) {
        await sendResponse();
        await sendSync();
      } else {
        await sendSync();
        await sendResponse();
      }

      const window = await app.getWindow();
      const leftPane = window.locator('#LeftPane');

      debug('opening conversation with the contact');
      await leftPane
        .locator(
          `[data-testid="${stranger.device.aci}"] >> "${stranger.profileName}"`
        )
        .click();

      await expectSystemMessages(window, scenario.systemMessages);

      await window.locator('.module-conversation-hero').waitFor();

      debug('Send message to merged contact');
      {
        const compositionInput = await waitForEnabledComposer(window);

        await typeIntoInput(compositionInput, 'Hello');
        await compositionInput.press('Enter');
      }

      debug('Getting message to contact');
      const { body, dataMessage } = await stranger.waitForMessage();

      assert.strictEqual(body, 'Hello');
      assert.strictEqual(dataMessage.expireTimer, scenario.finalTimer);
      assert.strictEqual(dataMessage.expireTimerVersion, scenario.finalVersion);
    });
  }

  it('should bump version for capable recipient', async () => {
    const window = await app.getWindow();
    const leftPane = window.locator('#LeftPane');

    debug('opening conversation with the contact');
    await leftPane
      .locator(
        `[data-testid="${stranger.device.aci}"] >> "${stranger.profileName}"`
      )
      .click();

    await window.locator('.module-conversation-hero').waitFor();

    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('setting timer to 1 week');
    await conversationStack
      .locator('button.module-ConversationHeader__button--more')
      .click();

    await window
      .locator('.react-contextmenu-item >> "Disappearing messages"')
      .click();

    await window
      .locator(
        '.module-ConversationHeader__disappearing-timer__item >> "1 week"'
      )
      .click();

    debug('Getting first expiration update');
    {
      const { dataMessage } = await stranger.waitForMessage();
      assert.strictEqual(
        dataMessage.flags,
        Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE
      );
      assert.strictEqual(dataMessage.expireTimer, 604800);
      assert.strictEqual(dataMessage.expireTimerVersion, 2);
    }

    debug('setting timer to 4 weeks');
    await conversationStack
      .locator('button.module-ConversationHeader__button--more')
      .click();

    await window
      .locator('.react-contextmenu-item >> "Disappearing messages"')
      .click();

    await window
      .locator(
        '.module-ConversationHeader__disappearing-timer__item >> "4 weeks"'
      )
      .click();

    debug('Getting second expiration update');
    {
      const { dataMessage } = await stranger.waitForMessage();
      assert.strictEqual(
        dataMessage.flags,
        Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE
      );
      assert.strictEqual(dataMessage.expireTimer, 2419200);
      assert.strictEqual(dataMessage.expireTimerVersion, 3);
    }
  });
});
