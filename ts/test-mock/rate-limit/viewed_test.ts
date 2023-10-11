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

export const debug = createDebug('mock:test:challenge:receipts');

describe('challenge/receipts', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);
  this.retries(4);

  let bootstrap: Bootstrap;
  let app: App;
  let contact: PrimaryDevice;

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

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      e164: phone.device.number,
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

    // Just to make PNI Contact visible in the left pane
    state = state.pin(contact, ServiceIdKind.PNI);

    const ourKey = await desktop.popSingleUseKey();
    await contact.addSingleUseKey(desktop, ourKey);

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

    debug('Accept conversation from contact');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

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

    debug(`rate limited requests: ${requests}`);
    assert.strictEqual(requests, 1);

    debug('Waiting for receipts');
    const receipts = await app.waitForReceipts();

    assert.strictEqual(receipts.type, ReceiptType.Read);
    assert.strictEqual(receipts.timestamps.length, 1);
    assert.strictEqual(receipts.timestamps[0], timestamp);
  });
});
