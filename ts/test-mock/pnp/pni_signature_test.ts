// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Pni } from '@signalapp/libsignal-client';
import {
  ServiceIdKind,
  Proto,
  ReceiptType,
  StorageState,
} from '@signalapp/mock-server';
import type { PrimaryDevice } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { uuidToBytes } from '../../util/uuidToBytes';
import { MY_STORY_ID } from '../../types/Stories';
import { isUntaggedPniString, toTaggedPni } from '../../types/ServiceId';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';
import {
  DELETE_SENT_PROTO_BATCHER_WAIT_MS,
  RECEIPT_BATCHER_WAIT_MS,
} from '../../types/Receipt';
import { sleep } from '../../util/sleep';

export const debug = createDebug('mock:test:pni-signature');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('pnp/PNI Signature', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let pniContact: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { server, phone } = bootstrap;

    pniContact = await server.createPrimaryDevice({
      profileName: 'ACI Contact',
    });

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      e164: phone.device.number,
    });

    state = state.addContact(
      pniContact,
      {
        whitelisted: true,
        serviceE164: pniContact.device.number,
        identityKey: pniContact.getPublicKey(ServiceIdKind.PNI).serialize(),
        givenName: 'PNI Contact',
      },
      ServiceIdKind.PNI
    );

    state = state.addContact(pniContact, {
      whitelisted: true,
      serviceE164: undefined,
      identityKey: pniContact.publicKey.serialize(),
      profileKey: pniContact.profileKey.serialize(),
    });

    // Just to make PNI Contact visible in the left pane
    state = state.pin(pniContact, ServiceIdKind.PNI);

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

  it('should be sent by Desktop until encrypted delivery receipt', async () => {
    const { server, desktop } = bootstrap;

    const ourPniKey = await desktop.getIdentityKey(ServiceIdKind.PNI);
    const ourAciKey = await desktop.getIdentityKey(ServiceIdKind.ACI);

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');
    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('creating a stranger');
    const stranger = await server.createPrimaryDevice({
      profileName: 'Mysterious Stranger',
    });

    const ourKey = await desktop.popSingleUseKey(ServiceIdKind.PNI);
    await stranger.addSingleUseKey(desktop, ourKey, ServiceIdKind.PNI);

    const checkPniSignature = (
      message: Proto.IPniSignatureMessage | null | undefined,
      source: string
    ) => {
      if (!message) {
        throw new Error(
          `Missing expected pni signature message from ${source}`
        );
      }

      if (!message.pni) {
        throw new Error(
          `Missing expected pni on pni signature message from ${source}`
        );
      }

      assert.deepEqual(
        Pni.fromUuidBytes(Buffer.from(message.pni)).getServiceIdString(),
        desktop.pni,
        `Incorrect pni in pni signature message from ${source}`
      );

      const isValid = ourPniKey.verifyAlternateIdentity(
        ourAciKey,
        Buffer.from(message.signature ?? [])
      );
      assert.isTrue(isValid, `Invalid pni signature from ${source}`);
    };

    debug('sending a message to our PNI');
    await stranger.sendText(desktop, 'A message to PNI', {
      serviceIdKind: ServiceIdKind.PNI,
      withProfileKey: true,
      timestamp: bootstrap.getTimestamp(),
    });

    debug('opening conversation with the stranger');
    await leftPane
      .locator(`[data-testid="${stranger.toContact().aci}"]`)
      .click();

    debug('Accept conversation from a stranger');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    debug('Waiting for a pniSignatureMessage');
    {
      const { source, content } = await stranger.waitForMessage();

      assert.strictEqual(source, desktop, 'initial message has valid source');
      checkPniSignature(content.pniSignatureMessage, 'initial message');
    }
    debug('Enter first message text');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('first');
      await compositionInput.press('Enter');
    }
    debug('Waiting for the first message with pni signature');
    {
      const { source, content, body, dataMessage } =
        await stranger.waitForMessage();

      assert.strictEqual(
        source,
        desktop,
        'first message must have valid source'
      );
      assert.strictEqual(body, 'first', 'first message must have valid body');
      checkPniSignature(content.pniSignatureMessage, 'first message');

      const receiptTimestamp = bootstrap.getTimestamp();
      debug('Sending unencrypted receipt', receiptTimestamp);

      await stranger.sendUnencryptedReceipt(desktop, {
        messageTimestamp: dataMessage.timestamp?.toNumber() ?? 0,
        timestamp: receiptTimestamp,
      });
    }
    debug('Enter second message text');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('second');
      await compositionInput.press('Enter');
    }
    debug('Waiting for the second message with pni signature');
    {
      const { source, content, body, dataMessage } =
        await stranger.waitForMessage();

      assert.strictEqual(
        source,
        desktop,
        'second message must have valid source'
      );
      assert.strictEqual(body, 'second', 'second message must have valid body');
      checkPniSignature(content.pniSignatureMessage, 'second message');

      const receiptTimestamp = bootstrap.getTimestamp();
      debug('Sending encrypted receipt', receiptTimestamp);

      await stranger.sendReceipt(desktop, {
        type: ReceiptType.Delivery,
        messageTimestamps: [dataMessage.timestamp?.toNumber() ?? 0],
        timestamp: receiptTimestamp,
      });
      // Wait for receipts to be batched and processed (+ buffer)
      await sleep(
        RECEIPT_BATCHER_WAIT_MS + DELETE_SENT_PROTO_BATCHER_WAIT_MS + 20
      );
    }

    debug('Enter third message text');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('third');
      await compositionInput.press('Enter');
    }
    debug('Waiting for the third message without pni signature');
    {
      const { source, content, body } = await stranger.waitForMessage();

      assert.strictEqual(
        source,
        desktop,
        'third message must have valid source'
      );
      assert.strictEqual(body, 'third', 'third message must have valid body');
      assert(
        !content.pniSignatureMessage,
        'third message must not have pni signature message'
      );
    }

    debug('Verify final state');
    {
      // One incoming, three outgoing
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 4, 'message count');

      // No notifications
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notification count');
    }
  });

  it('should be received by Desktop and trigger contact merge', async () => {
    const { desktop, phone } = bootstrap;

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');

    debug('opening conversation with the pni contact');
    await leftPane
      .locator('.module-conversation-list__item--contact-or-conversation')
      .first()
      .click();

    debug('Enter a PNI message text');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('Hello PNI');
      await compositionInput.press('Enter');
    }

    debug('Waiting for a PNI message');
    {
      const { source, body, serviceIdKind } = await pniContact.waitForMessage();

      assert.strictEqual(source, desktop, 'PNI message has valid source');
      assert.strictEqual(body, 'Hello PNI', 'PNI message has valid body');
      assert.strictEqual(
        serviceIdKind,
        ServiceIdKind.PNI,
        'PNI message has valid destination'
      );
    }

    debug('Capture storage service state before merging');
    const state = await phone.expectStorageState('state before merge');

    debug('Enter a draft text without hitting enter');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('Draft text');
    }

    debug('Send back the response with profile key and pni signature');

    const ourKey = await desktop.popSingleUseKey();
    await pniContact.addSingleUseKey(desktop, ourKey);

    await pniContact.sendText(desktop, 'Hello Desktop!', {
      timestamp: bootstrap.getTimestamp(),
      withPniSignature: true,
    });

    debug('Wait for merge to happen');
    await leftPane
      .locator(`[data-testid="${pniContact.toContact().aci}"]`)
      .waitFor();

    {
      debug('Wait for composition input to clear');
      const compositionInput = await app.waitForEnabledComposer();

      debug('Enter an ACI message text');
      await compositionInput.type('Hello ACI');
      await compositionInput.press('Enter');
    }

    debug('Waiting for a ACI message');
    {
      const { source, body, serviceIdKind } = await pniContact.waitForMessage();

      assert.strictEqual(source, desktop, 'ACI message has valid source');
      assert.strictEqual(body, 'Hello ACI', 'ACI message has valid body');
      assert.strictEqual(
        serviceIdKind,
        ServiceIdKind.ACI,
        'ACI message has valid destination'
      );
    }

    debug('Verify final state');

    {
      const newState = await phone.waitForStorageState({
        after: state,
      });

      const pniRecord = newState.getContact(pniContact, ServiceIdKind.PNI);
      const aciRecord = newState.getContact(pniContact, ServiceIdKind.ACI);
      assert.strictEqual(
        aciRecord,
        pniRecord,
        'ACI Contact must be the same as PNI Contact storage service'
      );
      assert(aciRecord, 'ACI Contact must be in storage service');

      assert.strictEqual(aciRecord?.aci, pniContact.device.aci);
      assert.strictEqual(
        aciRecord?.pni &&
          isUntaggedPniString(aciRecord?.pni) &&
          toTaggedPni(aciRecord?.pni),
        pniContact.device.pni
      );
      assert.strictEqual(aciRecord?.pniSignatureVerified, true);

      // Two outgoing, one incoming
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 3, 'messages');

      // No notifications
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notifications');

      assert.isEmpty(await phone.getOrphanedStorageKeys());
    }
  });
});
