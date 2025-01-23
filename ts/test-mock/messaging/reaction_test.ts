// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { StorageState } from '@signalapp/mock-server';
import { type Page } from 'playwright';
import { expect } from 'playwright/test';
import { assert } from 'chai';

import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import { MINUTE } from '../../util/durations';
import { strictAssert } from '../../util/assert';
import {
  clickOnConversation,
  getMessageInTimelineByTimestamp,
  sendTextMessage,
  sendReaction,
  createGroup,
} from '../helpers';

export const debug = createDebug('mock:test:reactions');

async function getReactionsForMessage(page: Page, timestamp: number) {
  const reactionsByEmoji: Record<string, Array<string>> = {};

  try {
    const message = await getMessageInTimelineByTimestamp(page, timestamp);

    await message.locator('.module-message__reactions').click();

    const reactionRows = await page
      .locator('.module-reaction-viewer__body__row')
      .all();

    for (const row of reactionRows) {
      // eslint-disable-next-line no-await-in-loop
      const emoji = await row.locator('img').getAttribute('title');
      // eslint-disable-next-line no-await-in-loop
      const reactor = await row
        .locator('.module-reaction-viewer__body__row__name')
        .innerText();

      strictAssert(emoji, 'emoji must exist');
      reactionsByEmoji[emoji] = (reactionsByEmoji[emoji] ?? []).concat([
        reactor,
      ]);
    }
    // dismiss reaction popup
    await page.keyboard.press('Escape');
  } catch {
    // pass
  }
  return reactionsByEmoji;
}

async function expectMessageToHaveReactions(
  page: Page,
  timestamp: number,
  reactionsBySender: Record<string, Array<string>>,
  options?: { timeout: number }
): Promise<void> {
  return expect(async () => {
    assert.deepEqual(
      await getReactionsForMessage(page, timestamp),
      reactionsBySender
    );
  }).toPass({ timeout: options?.timeout ?? 10000 });
}

describe('reactions', function (this: Mocha.Suite) {
  let bootstrap: Bootstrap;
  let app: App;

  this.timeout(MINUTE);
  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { phone, contacts } = bootstrap;
    const [alice, bob, charlie] = contacts;
    let state = StorageState.getEmpty();

    state = state.addContact(alice, {
      identityKey: alice.publicKey.serialize(),
      profileKey: alice.profileKey.serialize(),
    });
    state = state.addContact(bob, {
      identityKey: bob.publicKey.serialize(),
      profileKey: bob.profileKey.serialize(),
    });
    state = state.addContact(charlie, {
      identityKey: charlie.publicKey.serialize(),
      profileKey: charlie.profileKey.serialize(),
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

  it('should correctly match on participant, timestamp, and author in 1:1 conversation', async () => {
    this.timeout(10000);
    const { contacts, phone, desktop } = bootstrap;
    const [alice, bob, charlie] = contacts;

    const window = await app.getWindow();

    const alice1on1Timestamp = Date.now();
    const outgoingTimestamp = alice1on1Timestamp;

    await sendTextMessage({
      from: alice,
      to: desktop,
      text: 'hi from alice',
      timestamp: alice1on1Timestamp,
      desktop,
    });

    // To test the case where we have different outgoing messages with the same
    // timestamps, we need to send these without awaiting since otherwise desktop will
    // drop them since they have the same timestamp (DESKTOP-7301)
    await Promise.all([
      sendTextMessage({
        from: phone,
        to: bob,
        text: 'hi bob',
        timestamp: outgoingTimestamp,
        desktop,
      }),

      sendTextMessage({
        from: phone,
        to: charlie,
        text: 'hi charlie',
        timestamp: outgoingTimestamp,
        desktop,
      }),
    ]);

    // [❌ invalid reaction] bob trying to trick us by reacting to a message in a
    // conversation he's not a part of
    await sendReaction({
      from: bob,
      to: desktop,
      emoji: '👻',
      targetAuthor: alice,
      targetMessageTimestamp: alice1on1Timestamp,
      desktop,
    });

    // [❌ invalid reaction] phone sending message with wrong author but right timestamp
    await sendReaction({
      from: phone,
      to: desktop,
      emoji: '💀',
      targetAuthor: bob,
      targetMessageTimestamp: alice1on1Timestamp,
      desktop,
    });

    // [✅ incoming message] alice reacting to her own message
    await sendReaction({
      from: alice,
      to: desktop,
      emoji: '👍',
      targetAuthor: alice,
      targetMessageTimestamp: alice1on1Timestamp,
      desktop,
    });

    await clickOnConversation(window, alice);
    await expectMessageToHaveReactions(window, alice1on1Timestamp, {
      '👍': [alice.profileName],
    });

    // [✅ incoming message] phone sending message with right author
    await sendReaction({
      from: phone,
      to: alice,
      emoji: '👋',
      targetAuthor: alice,
      targetMessageTimestamp: alice1on1Timestamp,
      desktop,
    });

    await expectMessageToHaveReactions(window, alice1on1Timestamp, {
      '👍': [alice.profileName],
      '👋': ['You'],
    });

    // now, receive reactions from those messages with same timestamp
    // [✅ outgoing message] bob reacting to our message
    await sendReaction({
      from: bob,
      to: desktop,
      emoji: '👋',
      targetAuthor: phone,
      targetMessageTimestamp: outgoingTimestamp,
      desktop,
    });

    // [✅ outgoing message] alice reacting to our message
    await sendReaction({
      from: charlie,
      to: desktop,
      emoji: '👋',
      targetAuthor: phone,
      targetMessageTimestamp: outgoingTimestamp,
      desktop,
    });

    await clickOnConversation(window, bob);
    await expectMessageToHaveReactions(window, outgoingTimestamp, {
      '👋': [bob.profileName],
    });

    await clickOnConversation(window, charlie);
    await expectMessageToHaveReactions(window, outgoingTimestamp, {
      '👋': [charlie.profileName],
    });
  });

  it('should correctly match on participant, timestamp, and author in group conversation', async () => {
    this.timeout(10000);

    const { contacts, phone, desktop } = bootstrap;
    const [alice, bob, charlie, danielle] = contacts;

    const groupMembers = [alice, bob, charlie];
    const groupForSending = {
      group: await createGroup(phone, groupMembers, 'ReactionGroup'),
      members: groupMembers,
    };

    const window = await app.getWindow();
    const leftPane = window.locator('#LeftPane');

    const now = Date.now();
    const myGroupTimestamp = now;
    const aliceGroupTimestamp = now + 1;
    const bobGroupTimestamp = now + 2;
    const charlieGroupTimestamp = now + 3;

    // [✅ outgoing message]: charlie reacting to bob's group message, early
    await sendReaction({
      from: charlie,
      to: desktop,
      emoji: '👋',
      targetAuthor: bob,
      targetMessageTimestamp: bobGroupTimestamp,
      desktop,
    });

    // Send a bunch of messages in the group
    await sendTextMessage({
      from: phone,
      to: groupForSending,
      text: "hello group, it's me",
      timestamp: myGroupTimestamp,
      desktop,
    });

    await sendTextMessage({
      from: alice,
      to: groupForSending,
      text: "hello group, it's alice",
      timestamp: aliceGroupTimestamp,
      desktop,
    });

    await sendTextMessage({
      from: bob,
      to: groupForSending,
      text: "hello group, it's bob",
      timestamp: bobGroupTimestamp,
      desktop,
    });

    await sendTextMessage({
      from: charlie,
      to: groupForSending,
      text: "hello group, it's charlie",
      timestamp: charlieGroupTimestamp,
      desktop,
    });

    await leftPane.getByText('ReactionGroup').click();

    // [❌ invalid reaction] danielle reacting to our group message, but she's not in the
    // group!
    await sendReaction({
      from: danielle,
      to: desktop,
      emoji: '👻',
      targetAuthor: phone,
      targetMessageTimestamp: myGroupTimestamp,
      desktop,
    });

    // [✅ outgoing message]: alice reacting to our group message
    await sendReaction({
      from: alice,
      to: desktop,
      emoji: '👍',
      targetAuthor: phone,
      targetMessageTimestamp: myGroupTimestamp,
      desktop,
    });

    // [✅ outgoing message]: bob reacting to our group message
    await sendReaction({
      from: bob,
      to: desktop,
      emoji: '👍',
      targetAuthor: phone,
      targetMessageTimestamp: myGroupTimestamp,
      desktop,
    });

    // [✅ outgoing message]: charlie reacting to alice's group message
    await sendReaction({
      from: charlie,
      to: desktop,
      emoji: '😛',
      targetAuthor: alice,
      targetMessageTimestamp: aliceGroupTimestamp,
      desktop,
    });

    await expectMessageToHaveReactions(window, myGroupTimestamp, {
      '👍': [bob.profileName, alice.profileName],
    });

    await expectMessageToHaveReactions(window, aliceGroupTimestamp, {
      '😛': [charlie.profileName],
    });

    await expectMessageToHaveReactions(window, bobGroupTimestamp, {
      '👋': [charlie.profileName],
    });
  });
});
