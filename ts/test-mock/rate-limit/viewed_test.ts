// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { PrimaryDevice } from '@signalapp/mock-server';
import { StorageState, ServiceIdKind } from '@signalapp/mock-server';
import createDebug from 'debug';
import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';
import { ReceiptType } from '../../types/Receipt';
import { toUntaggedPni } from '../../types/ServiceId';
import { typeIntoInput, waitForEnabledComposer } from '../helpers';

export const debug = createDebug('mock:test:challenge:receipts');

describe('challenge/receipts', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let contact: PrimaryDevice;
  let contactB: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap({
      contactCount: 0,
      contactsWithoutProfileKey: 40,
    });
    await bootstrap.init();
    app = await bootstrap.link();

    const { server, desktop, phone } = bootstrap;

    contact = await server.createPrimaryDevice({
      profileName: 'Jamie',
    });
    contactB = await server.createPrimaryDevice({
      profileName: 'Kim',
    });

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
      readReceipts: true,
    });

    state = state.addContact(
      contact,
      {
        whitelisted: true,
        serviceE164: contact.device.number,
        identityKey: contact.getPublicKey(ServiceIdKind.PNI).serialize(),
        pni: toUntaggedPni(contact.device.pni),
        givenName: 'Jamie',
      },
      ServiceIdKind.PNI
    );
    state = state.addContact(
      contactB,
      {
        whitelisted: true,
        serviceE164: contactB.device.number,
        identityKey: contactB.getPublicKey(ServiceIdKind.PNI).serialize(),
        pni: toUntaggedPni(contactB.device.pni),
        givenName: 'Kim',
      },
      ServiceIdKind.PNI
    );

    // Just to make PNI Contact visible in the left pane
    state = state.pin(contact, ServiceIdKind.PNI);
    state = state.pin(contactB, ServiceIdKind.PNI);

    const ourKey = await desktop.popSingleUseKey();
    await contact.addSingleUseKey(desktop, ourKey);

    const ourKeyB = await desktop.popSingleUseKey();
    await contactB.addSingleUseKey(desktop, ourKeyB);

    await phone.setStorageState(state);
  });

  afterEach(async function (this: Mocha.Context) {
    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('should wait for the challenge to be handled', async () => {
    const { server, desktop } = bootstrap;

    debug(
      `Rate limiting (desktop: ${desktop.aci}) -> (contact: ${contact.device.aci})`
    );
    server.rateLimit({ source: desktop.aci, target: contact.device.aci });

    const timestamp = bootstrap.getTimestamp();

    debug('Sending a message from contact');
    await contact.sendText(desktop, 'Hello there!', {
      timestamp,
    });

    const window = await app.getWindow();
    const leftPane = window.locator('#LeftPane');
    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug(`Opening conversation with contact (${contact.toContact().aci})`);
    await leftPane
      .locator(`[data-testid="${contact.toContact().aci}"]`)
      .click();

    debug('Accept conversation from contact - does not trigger captcha!');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    debug('Sending a message back to user - will trigger captcha!');
    {
      const input = await waitForEnabledComposer(window);
      await typeIntoInput(input, 'Hi, good to hear from you!');
      await input.press('Enter');
    }

    debug('Waiting for challenge');
    const request = await app.waitForChallenge();

    debug('Solving challenge');
    await app.solveChallenge({
      seq: request.seq,
      data: { captcha: 'anything' },
    });

    const requests = server.stopRateLimiting({
      source: desktop.aci,
      target: contact.device.aci,
    });

    debug(`Rate-limited requests: ${requests}`);
    assert.strictEqual(requests, 1, 'rate limit requests');

    debug('Waiting for outgoing read receipt');
    const receipts = await app.waitForReceipts();

    assert.strictEqual(receipts.type, ReceiptType.Read);
    assert.strictEqual(receipts.timestamps.length, 1, 'receipts');
    assert.strictEqual(receipts.timestamps[0], timestamp);
  });

  it('should send non-bubble in ConvoA when ConvoB completes challenge', async () => {
    const { server, desktop } = bootstrap;

    debug(
      `Rate limiting (desktop: ${desktop.aci}) -> (ContactA: ${contact.device.aci})`
    );
    server.rateLimit({ source: desktop.aci, target: contact.device.aci });
    debug(
      `Rate limiting (desktop: ${desktop.aci}) -> (ContactB: ${contactB.device.aci})`
    );
    server.rateLimit({ source: desktop.aci, target: contactB.device.aci });

    const window = await app.getWindow();
    const leftPane = window.locator('#LeftPane');
    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('Sending a message from ContactA');
    const timestampA = bootstrap.getTimestamp();
    await contact.sendText(desktop, 'Hello there!', {
      timestamp: timestampA,
    });

    debug(`Opening conversation with ContactA (${contact.toContact().aci})`);
    await leftPane
      .locator(`[data-testid="${contact.toContact().aci}"]`)
      .click();

    debug('Accept conversation from ContactA - does not trigger captcha!');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    debug('Sending a message from ContactB');
    const timestampB = bootstrap.getTimestamp();
    await contactB.sendText(desktop, 'Hey there!', {
      timestamp: timestampB,
    });

    debug(`Opening conversation with ContactB (${contact.toContact().aci})`);
    await leftPane
      .locator(`[data-testid="${contactB.toContact().aci}"]`)
      .click();

    debug('Accept conversation from ContactB - does not trigger captcha!');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    debug('Sending a message back to ContactB - will trigger captcha!');
    {
      const input = await waitForEnabledComposer(window);
      await typeIntoInput(input, 'Hi, good to hear from you!');
      await input.press('Enter');
    }

    debug('Waiting for challenge');
    const request = await app.waitForChallenge();

    debug('Solving challenge');
    await app.solveChallenge({
      seq: request.seq,
      data: { captcha: 'anything' },
    });

    const requestsA = server.stopRateLimiting({
      source: desktop.aci,
      target: contact.device.aci,
    });
    const requestsB = server.stopRateLimiting({
      source: desktop.aci,
      target: contactB.device.aci,
    });

    debug(`Rate-limited requests to A: ${requestsA}`);
    assert.strictEqual(requestsA, 1, 'rate limit requests');

    debug(`Rate-limited requests to B: ${requestsA}`);
    assert.strictEqual(requestsB, 1, 'rate limit requests');

    debug('Waiting for outgoing read receipt #1');
    const receipts1 = await app.waitForReceipts();

    assert.strictEqual(receipts1.type, ReceiptType.Read);
    assert.strictEqual(receipts1.timestamps.length, 1, 'receipts');
    if (
      !receipts1.timestamps.includes(timestampA) &&
      !receipts1.timestamps.includes(timestampB)
    ) {
      throw new Error(
        'receipts1: Failed to find both timestampA and timestampB'
      );
    }

    debug('Waiting for outgoing read receipt #2');
    const receipts2 = await app.waitForReceipts();

    assert.strictEqual(receipts2.type, ReceiptType.Read);
    assert.strictEqual(receipts2.timestamps.length, 1, 'receipts');
    if (
      !receipts2.timestamps.includes(timestampA) &&
      !receipts2.timestamps.includes(timestampB)
    ) {
      throw new Error(
        'receipts2: Failed to find both timestampA and timestampB'
      );
    }
  });

  it('if server rejects our captcha, should show a toast and defer challenge based on error code', async () => {
    const { server, desktop } = bootstrap;

    debug(
      `Rate limiting (desktop: ${desktop.aci}) -> (contact: ${contact.device.aci})`
    );
    server.rateLimit({ source: desktop.aci, target: contact.device.aci });
    server.rateLimit({ source: desktop.aci, target: contactB.device.aci });

    const timestamp = bootstrap.getTimestamp();

    debug('Sending a message from contact');
    await contact.sendText(desktop, 'Hello there!', {
      timestamp,
    });

    const window = await app.getWindow();
    const leftPane = window.locator('#LeftPane');
    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug(`Opening conversation with contact (${contact.toContact().aci})`);
    await leftPane
      .locator(`[data-testid="${contact.toContact().aci}"]`)
      .click();

    debug('Accept conversation from contact - does not trigger captcha!');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    debug('Sending a message back to user - will trigger captcha!');
    {
      const input = await waitForEnabledComposer(window);
      await typeIntoInput(input, 'Hi, good to hear from you!');
      await input.press('Enter');
    }

    /** First, challenge returns 428 (try again) */
    debug('Waiting for challenge');
    const firstChallengeRequest = await app.waitForChallenge();
    const challengeDialog = await window
      .getByTestId('CaptchaDialog.pending')
      .elementHandle();

    assert.exists(challengeDialog);
    server.respondToChallengesWith(428);

    debug('Solving challenge');
    await app.solveChallenge({
      seq: firstChallengeRequest.seq,
      data: { captcha: 'anything' },
    });

    debug('Waiting for verification failure toast');
    const failedChallengeToastLocator = window.locator(
      '.Toast__content >> "Verification failed. Please retry later."'
    );
    await failedChallengeToastLocator.isVisible();
    // The existing dialog is removed, but then the conversations will retry their sends,
    // which will result in another one
    await challengeDialog.isHidden();

    /** Second, challenge returns 413 (rate limit) */
    debug(
      'Waiting for second challenge, should be triggered quickly with the sends being retried'
    );
    const secondChallengeRequest = await app.waitForChallenge();

    server.respondToChallengesWith(413);

    debug('Solving challenge');
    await app.solveChallenge({
      seq: secondChallengeRequest.seq,
      data: { captcha: 'anything' },
    });

    debug('Waiting for verification failure toast');
    await failedChallengeToastLocator.isVisible();

    debug('Sending another message - this time it should not trigger captcha!');
    {
      const input = await waitForEnabledComposer(window);
      await typeIntoInput(input, 'How have you been lately?');
      await input.press('Enter');
    }

    debug('Sending a message from Contact B');
    await contactB.sendText(desktop, 'Wanna buy a cow?', {
      timestamp,
    });

    debug(`Opening conversation with Contact B (${contactB.toContact().aci})`);
    await leftPane
      .locator(`[data-testid="${contactB.toContact().aci}"]`)
      .click();

    debug('Accept conversation from Contact B - does not trigger captcha!');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    debug(
      'Sending to Contact B - we should not pop captcha because we are waiting!'
    );
    {
      const input = await waitForEnabledComposer(window);
      await typeIntoInput(input, 'You the cow guy from craigslist?');
      await input.press('Enter');
    }

    debug('Checking for no other captcha dialogs');
    assert.equal(
      await app.getPendingEventCount('captchaDialog'),
      2,
      'Just two captcha dialogs, the first one, and the one after the 428'
    );

    const requests = server.stopRateLimiting({
      source: desktop.aci,
      target: contact.device.aci,
    });

    debug(`Rate-limited requests: ${requests}`);
    assert.strictEqual(requests, 2, 'rate limit requests');

    const requestsContactB = server.stopRateLimiting({
      source: desktop.aci,
      target: contactB.device.aci,
    });

    debug(`Rate-limited requests to Contact B: ${requests}`);
    assert.strictEqual(requestsContactB, 1, 'Contact B rate limit requests');
  });
});
