// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  UUIDKind,
  Proto,
  ReceiptType,
  StorageState,
} from '@signalapp/mock-server';
import type { PrimaryDevice } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { uuidToBytes } from '../../util/uuidToBytes';
import { MY_STORY_ID } from '../../types/Stories';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';

export const debug = createDebug('mock:test:pni-signature');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('pnp/PNI Signature', function needsName() {
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
        identityState: Proto.ContactRecord.IdentityState.VERIFIED,
        whitelisted: true,

        identityKey: pniContact.getPublicKey(UUIDKind.PNI).serialize(),

        serviceE164: pniContact.device.number,
        givenName: 'PNI Contact',
      },
      UUIDKind.PNI
    );

    state = state.addContact(pniContact, {
      identityState: Proto.ContactRecord.IdentityState.VERIFIED,
      whitelisted: true,

      serviceE164: undefined,
      identityKey: pniContact.publicKey.serialize(),
      profileKey: pniContact.profileKey.serialize(),
    });

    // Just to make PNI Contact visible in the left pane
    state = state.pin(pniContact, UUIDKind.PNI);

    // Add my story
    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORY_ID),
          isBlockList: true,
          name: MY_STORY_ID,
          recipientUuids: [],
        },
      },
    });

    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function after() {
    if (this.currentTest?.state !== 'passed') {
      await bootstrap.saveLogs(app);
    }

    await app.close();
    await bootstrap.teardown();
  });

  it('should be sent by Desktop until encrypted delivery receipt', async () => {
    const { server, desktop } = bootstrap;

    const ourPNIKey = await desktop.getIdentityKey(UUIDKind.PNI);
    const ourACIKey = await desktop.getIdentityKey(UUIDKind.ACI);

    const window = await app.getWindow();

    const leftPane = window.locator('.left-pane-wrapper');
    const conversationStack = window.locator('.conversation-stack');
    const composeArea = window.locator(
      '.composition-area-wrapper, ' +
        '.ConversationView__template .react-wrapper'
    );

    debug('creating a stranger');
    const stranger = await server.createPrimaryDevice({
      profileName: 'Mysterious Stranger',
    });

    const ourKey = await desktop.popSingleUseKey(UUIDKind.PNI);
    await stranger.addSingleUseKey(desktop, ourKey, UUIDKind.PNI);

    const checkPniSignature = (
      message: Proto.IPniSignatureMessage | null | undefined,
      source: string
    ) => {
      if (!message) {
        throw new Error(
          `Missing expected pni signature message from ${source}`
        );
      }

      assert.deepEqual(
        message.pni,
        uuidToBytes(desktop.pni),
        `Incorrect pni in pni signature message from ${source}`
      );

      const isValid = ourPNIKey.verifyAlternateIdentity(
        ourACIKey,
        Buffer.from(message.signature ?? [])
      );
      assert.isTrue(isValid, `Invalid pni signature from ${source}`);
    };

    debug('sending a message to our PNI');
    await stranger.sendText(desktop, 'A message to PNI', {
      uuidKind: UUIDKind.PNI,
      withProfileKey: true,
      timestamp: bootstrap.getTimestamp(),
    });

    debug('opening conversation with the stranger');
    await leftPane
      .locator(
        '_react=ConversationListItem' +
          `[title = ${JSON.stringify(stranger.profileName)}]`
      )
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
    const compositionInput = composeArea.locator('_react=CompositionInput');

    await compositionInput.type('first');
    await compositionInput.press('Enter');

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

    await compositionInput.type('second');
    await compositionInput.press('Enter');

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
    }

    debug('Enter third message text');

    await compositionInput.type('third');
    await compositionInput.press('Enter');

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
  });

  it('should be received by Desktop and trigger contact merge', async () => {
    const { desktop, phone } = bootstrap;

    const window = await app.getWindow();

    const leftPane = window.locator('.left-pane-wrapper');
    const composeArea = window.locator(
      '.composition-area-wrapper, ' +
        '.ConversationView__template .react-wrapper'
    );

    debug('opening conversation with the pni contact');
    await leftPane
      .locator('_react=ConversationListItem[title = "PNI Contact"]')
      .click();

    debug('Enter a PNI message text');
    const compositionInput = composeArea.locator('_react=CompositionInput');

    await compositionInput.type('Hello PNI');
    await compositionInput.press('Enter');

    debug('Waiting for a PNI message');
    {
      const { source, body, uuidKind } = await pniContact.waitForMessage();

      assert.strictEqual(source, desktop, 'PNI message has valid source');
      assert.strictEqual(body, 'Hello PNI', 'PNI message has valid body');
      assert.strictEqual(
        uuidKind,
        UUIDKind.PNI,
        'PNI message has valid destination'
      );
    }

    debug('Capture storage service state before merging');
    const state = await phone.expectStorageState('state before merge');

    debug('Enter a draft text without hitting enter');
    await compositionInput.type('Draft text');

    debug('Send back the response with profile key and pni signature');

    const ourKey = await desktop.popSingleUseKey();
    await pniContact.addSingleUseKey(desktop, ourKey);

    await pniContact.sendText(desktop, 'Hello Desktop!', {
      timestamp: bootstrap.getTimestamp(),
      withPniSignature: true,
    });

    debug('Wait for merge to happen');
    await leftPane
      .locator('_react=ConversationListItem[title = "ACI Contact"]')
      .waitFor();

    debug('Wait for composition input to clear');
    await composeArea
      .locator('_react=CompositionInput[draftText = ""]')
      .waitFor();

    debug('Enter an ACI message text');
    await compositionInput.type('Hello ACI');
    await compositionInput.press('Enter');

    debug('Waiting for a ACI message');
    {
      const { source, body, uuidKind } = await pniContact.waitForMessage();

      assert.strictEqual(source, desktop, 'ACI message has valid source');
      assert.strictEqual(body, 'Hello ACI', 'ACI message has valid body');
      assert.strictEqual(
        uuidKind,
        UUIDKind.ACI,
        'ACI message has valid destination'
      );
    }

    debug('Verify final state');
    {
      const newState = await phone.waitForStorageState({
        after: state,
      });

      assert.isUndefined(
        newState.getContact(pniContact, UUIDKind.PNI),
        'PNI Contact must be removed from storage service'
      );

      const aci = newState.getContact(pniContact, UUIDKind.ACI);
      assert(aci, 'ACI Contact must be in storage service');

      assert.strictEqual(aci?.serviceUuid, pniContact.device.uuid);
      assert.strictEqual(aci?.pni, pniContact.device.pni);
    }
  });
});
