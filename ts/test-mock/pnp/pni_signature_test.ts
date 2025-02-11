// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Long from 'long';
import { Pni } from '@signalapp/libsignal-client';
import {
  ServiceIdKind,
  Proto,
  ReceiptType,
  StorageState,
} from '@signalapp/mock-server';
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
import {
  expectSystemMessages,
  typeIntoInput,
  waitForEnabledComposer,
} from '../helpers';

export const debug = createDebug('mock:test:pni-signature');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('pnp/PNI Signature', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 0 });
    await bootstrap.init();

    const { phone } = bootstrap;

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
    });

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

    debug('Send a message to our PNI');
    await stranger.sendText(desktop, 'A message to PNI', {
      serviceIdKind: ServiceIdKind.PNI,
      withProfileKey: true,
      timestamp: bootstrap.getTimestamp(),
    });

    debug('Open conversation with the stranger');
    await leftPane
      .locator(`[data-testid="${stranger.toContact().aci}"]`)
      .click();

    debug('Accept conversation from a stranger');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    debug('Wait for a pniSignatureMessage');
    {
      const { source, content } = await stranger.waitForMessage();

      assert.strictEqual(source, desktop, 'initial message has valid source');
      checkPniSignature(content.pniSignatureMessage, 'initial message');
    }
    debug('Enter first message text');
    {
      const compositionInput = await waitForEnabledComposer(window);

      await typeIntoInput(compositionInput, 'first');
      await compositionInput.press('Enter');
    }
    debug('Wait for the first message with pni signature');
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
      debug('Send unencrypted receipt', receiptTimestamp);

      await stranger.sendUnencryptedReceipt(desktop, {
        messageTimestamp: dataMessage.timestamp?.toNumber() ?? 0,
        timestamp: receiptTimestamp,
      });
    }
    debug('Enter second message text');
    {
      const compositionInput = await waitForEnabledComposer(window);

      await typeIntoInput(compositionInput, 'second');
      await compositionInput.press('Enter');
    }
    debug('Wait for the second message with pni signature');
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
      debug('Send encrypted receipt', receiptTimestamp);

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
      const compositionInput = await waitForEnabledComposer(window);

      await typeIntoInput(compositionInput, 'third');
      await compositionInput.press('Enter');
    }
    debug('Wait for the third message without pni signature');
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

      await expectSystemMessages(window, ['You accepted the message request']);
    }
  });

  it('should be received by Desktop and trigger contact merge', async () => {
    const { desktop, phone, server } = bootstrap;

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');

    debug('Capture storage service state before messaging');
    let state = await phone.expectStorageState('state before messaging');

    debug('Create stranger');
    const STRANGER_NAME = 'Mysterious Stranger';
    const stranger = await server.createPrimaryDevice({
      profileName: STRANGER_NAME,
    });

    debug('Send a PNI sync message');
    const timestamp = bootstrap.getTimestamp();
    const destinationServiceId = stranger.device.pni;
    const destination = stranger.device.number;
    const destinationPniIdentityKey = await stranger.device.getIdentityKey(
      ServiceIdKind.PNI
    );
    const originalDataMessage = {
      body: 'Hello PNI',
      timestamp: Long.fromNumber(timestamp),
    };
    const content = {
      syncMessage: {
        sent: {
          destinationServiceId,
          destination,
          timestamp: Long.fromNumber(timestamp),
          message: originalDataMessage,
          unidentifiedStatus: [
            {
              destinationServiceId,
              destinationPniIdentityKey: destinationPniIdentityKey.serialize(),
            },
          ],
        },
      },
    };
    const sendOptions = {
      timestamp,
    };
    await phone.sendRaw(desktop, content, sendOptions);

    debug('Wait for updated storage service state with PNI contact');
    {
      const newState = await phone.waitForStorageState({
        after: state,
      });

      const aciRecord = newState.getContact(stranger, ServiceIdKind.ACI);
      assert.isUndefined(aciRecord, 'ACI contact must not be created');

      const pniRecord = newState.getContact(stranger, ServiceIdKind.PNI);
      assert.deepEqual(
        pniRecord?.identityKey,
        destinationPniIdentityKey.serialize(),
        'PNI contact must have correct identity key'
      );

      state = newState;
    }

    debug('Open conversation with the pni contact');
    const contactElem = leftPane.locator(
      `[data-testid="${stranger.device.pni}"]`
    );
    await contactElem.click();

    debug('Verify that left pane shows phone number');
    {
      const strangerName = await contactElem
        .locator('.module-contact-name')
        .first()
        .innerText();
      assert.equal(
        strangerName.slice(-4),
        destination?.slice(-4),
        'no profile, just phone number'
      );
    }

    debug('Verify that we are in MR state');
    const conversationStack = window.locator('.Inbox__conversation-stack');
    await conversationStack
      .locator('.module-message-request-actions button >> "Continue"')
      .waitFor();

    debug('Clear message request state on phone');
    {
      const newState = state.updateContact(
        stranger,
        {
          whitelisted: true,
        },
        ServiceIdKind.PNI
      );

      await phone.setStorageState(newState, state);
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });
      state = newState;
    }

    debug('Wait for MR state to disappear');
    await conversationStack
      .locator('.module-message-request-actions button >> "Continue"')
      .waitFor({ state: 'hidden' });

    debug('Send back the response with profile key and pni signature');

    const ourKey = await desktop.popSingleUseKey();
    await stranger.addSingleUseKey(desktop, ourKey);

    await stranger.sendText(desktop, 'Hello Desktop!', {
      timestamp: bootstrap.getTimestamp(),
      withPniSignature: true,
      withProfileKey: true,
    });

    debug('Wait for merge to happen');
    await leftPane
      .locator(`[data-testid="${stranger.toContact().aci}"]`)
      .waitFor();

    {
      debug('Wait for composition input to clear');
      const compositionInput = await waitForEnabledComposer(window);

      debug('Enter an ACI message text');
      await typeIntoInput(compositionInput, 'Hello ACI');
      await compositionInput.press('Enter');
    }

    debug('Wait for a ACI message');
    {
      const { source, body, serviceIdKind } = await stranger.waitForMessage();

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

      const pniRecord = newState.getContact(stranger, ServiceIdKind.PNI);
      const aciRecord = newState.getContact(stranger, ServiceIdKind.ACI);
      assert.strictEqual(
        aciRecord,
        pniRecord,
        'ACI Contact must be the same as PNI Contact storage service'
      );
      assert(aciRecord, 'ACI Contact must be in storage service');

      assert.strictEqual(aciRecord?.aci, stranger.device.aci);
      assert.strictEqual(
        aciRecord?.pni &&
          isUntaggedPniString(aciRecord?.pni) &&
          toTaggedPni(aciRecord?.pni),
        stranger.device.pni
      );
      assert.strictEqual(aciRecord?.pniSignatureVerified, true);

      // Two outgoing, one incoming
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 3, 'messages');

      // Title transition notification
      await expectSystemMessages(window, [/You started this chat with/]);

      assert.isEmpty(await phone.getOrphanedStorageKeys());
    }
  });
});
