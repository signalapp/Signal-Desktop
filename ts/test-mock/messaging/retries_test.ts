// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import createDebug from 'debug';
import { EnvelopeType, StorageState } from '@signalapp/mock-server';

import type { App } from '../playwright';
import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';
import { sleep } from '../../util/sleep';

export const debug = createDebug('mock:test:retries');

describe('retries', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();
    app = await bootstrap.link();

    const { contacts, phone } = bootstrap;
    const [first] = contacts;

    let state = StorageState.getEmpty();

    state = state.addContact(first, {
      identityKey: first.publicKey.serialize(),
      profileKey: first.profileKey.serialize(),
      whitelisted: true,
    });
    state = state.pin(first);

    await phone.setStorageState(state);
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('sends a retry request on a missing sender key error', async () => {
    const { desktop, contacts } = bootstrap;
    const [first] = contacts;

    debug('send a sender key message without sending skdm first');
    const distributionId = await first.sendSenderKey(desktop, {
      timestamp: bootstrap.getTimestamp(),
      skipSkdmSend: true,
    });

    const timestamp = bootstrap.getTimestamp();
    await first.sendText(desktop, 'hello', {
      distributionId,
      sealed: true,
      timestamp,
    });

    debug('waiting for the resend request');
    const message = await first.waitForDecryptionError();
    debug(JSON.stringify(message));

    assert.equal(message.envelopeType, EnvelopeType.Plaintext);
    assert.equal(message.timestamp, timestamp);
  });

  it('does not send a retry request if message succeeded later', async () => {
    const { desktop, contacts } = bootstrap;
    const [first] = contacts;

    await app.close();

    debug('send a sender key message without sending skdm first');
    const firstDistributionId = await first.sendSenderKey(desktop, {
      timestamp: bootstrap.getTimestamp(),
      skipSkdmSend: true,
    });

    const content = 'how are you?';

    debug('send a failing message');
    const timestamp = bootstrap.getTimestamp();
    const firstMessageSend = first.sendText(desktop, content, {
      distributionId: firstDistributionId,
      sealed: true,
      timestamp,
    });

    debug('send second sender key out');
    const secondDistributionId = await first.sendSenderKey(desktop, {
      timestamp: bootstrap.getTimestamp(),
    });

    debug('send same hello message, this time it should work');
    const secondMessageSend = first.sendText(desktop, content, {
      distributionId: secondDistributionId,
      sealed: true,
      timestamp,
    });

    debug('starting');

    app = await bootstrap.startApp();

    await Promise.all([firstMessageSend, secondMessageSend]);

    debug('open conversation');
    const window = await app.getWindow();
    const leftPane = window.locator('#LeftPane');
    await leftPane.locator(`[data-testid="${first.device.aci}"]`).click();

    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('verify message receipt');
    await conversationStack
      .locator(`.module-message--incoming >> "${content}"`)
      .waitFor();

    debug('verify that no resend request was sent');
    const count = await first.getDecryptionErrorQueueSize();
    assert.equal(count, 0);
  });

  it('sends only one retry request if many failures with same timestamp', async () => {
    const { desktop, contacts } = bootstrap;
    const [first] = contacts;

    debug('send a sender key message without sending skdm first');
    const firstDistributionId = await first.sendSenderKey(desktop, {
      timestamp: bootstrap.getTimestamp(),
      skipSkdmSend: true,
    });

    const content = 'how are you?';

    debug('send a failing message');
    const timestamp = bootstrap.getTimestamp();
    await first.sendText(desktop, content, {
      distributionId: firstDistributionId,
      sealed: true,
      timestamp,
    });

    debug('send a failing message a second time');
    await first.sendText(desktop, content, {
      distributionId: firstDistributionId,
      sealed: true,
      timestamp,
    });

    debug('send a failing message a third time');
    await first.sendText(desktop, content, {
      distributionId: firstDistributionId,
      sealed: true,
      timestamp,
    });

    debug('waiting for the resend request');
    const message = await first.waitForDecryptionError();
    debug(JSON.stringify(message));

    assert.equal(message.envelopeType, EnvelopeType.Plaintext);
    assert.equal(message.timestamp, timestamp);

    debug('wait for max jitter delay');
    await sleep(500);

    debug('verify that no other resend requests were sent');
    const count = await first.getDecryptionErrorQueueSize();
    assert.equal(count, 0);
  });
});
