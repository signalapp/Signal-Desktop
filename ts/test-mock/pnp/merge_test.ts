// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { UUIDKind, Proto, StorageState } from '@signalapp/mock-server';
import type { PrimaryDevice } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { uuidToBytes } from '../../util/uuidToBytes';
import { MY_STORY_ID } from '../../types/Stories';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';

export const debug = createDebug('mock:test:merge');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('pnp/merge', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let pniContact: PrimaryDevice;
  let pniIdentityKey: Uint8Array;
  let aciIdentityKey: Uint8Array;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { server, phone } = bootstrap;

    pniContact = await server.createPrimaryDevice({
      profileName: 'ACI Contact',
    });
    pniIdentityKey = pniContact.getPublicKey(UUIDKind.PNI).serialize();
    aciIdentityKey = pniContact.publicKey.serialize();

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      e164: phone.device.number,
    });

    state = state.addContact(
      pniContact,
      {
        identityState: Proto.ContactRecord.IdentityState.DEFAULT,
        whitelisted: true,

        identityKey: pniIdentityKey,

        serviceE164: pniContact.device.number,
        givenName: 'PNI Contact',
      },
      UUIDKind.PNI
    );

    state = state.addContact(pniContact, {
      identityState: Proto.ContactRecord.IdentityState.DEFAULT,
      whitelisted: true,

      serviceE164: undefined,
      identityKey: aciIdentityKey,
      profileKey: pniContact.profileKey.serialize(),
    });

    // Put both contacts in left pane
    state = state.pin(pniContact, UUIDKind.PNI);
    state = state.pin(pniContact, UUIDKind.ACI);

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

  for (const finalContact of [UUIDKind.ACI, UUIDKind.PNI]) {
    // eslint-disable-next-line no-loop-func
    it(`happens via storage service, with notification (${finalContact})`, async () => {
      const { phone } = bootstrap;

      const window = await app.getWindow();
      const leftPane = window.locator('.left-pane-wrapper');

      debug('opening conversation with the aci contact');
      await leftPane
        .locator('_react=ConversationListItem[title = "ACI Contact"]')
        .click();

      await window.locator('.module-conversation-hero').waitFor();

      debug('Send message to ACI');
      {
        const composeArea = window.locator(
          '.composition-area-wrapper, .conversation .ConversationView'
        );
        const compositionInput = composeArea.locator('_react=CompositionInput');

        await compositionInput.type('Hello ACI');
        await compositionInput.press('Enter');
      }

      debug('opening conversation with the pni contact');
      await leftPane
        .locator('_react=ConversationListItem[title = "PNI Contact"]')
        .click();

      await window.locator('.module-conversation-hero').waitFor();

      debug('Verify starting state');
      {
        // No messages
        const messages = window.locator('.module-message__text');
        assert.strictEqual(await messages.count(), 0, 'message count');

        // No notifications
        const notifications = window.locator('.SystemMessage');
        assert.strictEqual(
          await notifications.count(),
          0,
          'notification count'
        );
      }

      debug('Send message to PNI');
      {
        const composeArea = window.locator(
          '.composition-area-wrapper, .conversation .ConversationView'
        );
        const compositionInput = composeArea.locator('_react=CompositionInput');

        await compositionInput.type('Hello PNI');
        await compositionInput.press('Enter');
      }

      if (finalContact === UUIDKind.ACI) {
        debug('switching back to ACI conversation');
        await leftPane
          .locator('_react=ConversationListItem[title = "ACI Contact"]')
          .click();

        await window.locator('.module-conversation-hero').waitFor();
      }

      debug(
        'removing both contacts from storage service, adding one combined contact'
      );
      {
        const state = await phone.expectStorageState('consistency check');
        await phone.setStorageState(
          state
            .removeRecord(
              item =>
                item.record.contact?.serviceUuid ===
                pniContact.device.getUUIDByKind(UUIDKind.ACI)
            )
            .removeRecord(
              item =>
                item.record.contact?.serviceUuid ===
                pniContact.device.getUUIDByKind(UUIDKind.PNI)
            )
            .addContact(pniContact, {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              pni: pniContact.device.getUUIDByKind(UUIDKind.PNI),
              identityKey: pniContact.publicKey.serialize(),
              profileKey: pniContact.profileKey.serialize(),
            })
        );
        await phone.sendFetchStorage({
          timestamp: bootstrap.getTimestamp(),
        });
      }

      // wait for desktop to process these changes
      await window.locator('.SystemMessage').waitFor();

      debug('Verify final state');
      {
        // Should have both PNI and ACI messages
        await window.locator('.module-message__text >> "Hello ACI"').waitFor();
        await window.locator('.module-message__text >> "Hello PNI"').waitFor();

        const messages = window.locator('.module-message__text');
        assert.strictEqual(await messages.count(), 2, 'message count');

        // One notification - the merge
        const notifications = window.locator('.SystemMessage');
        assert.strictEqual(
          await notifications.count(),
          1,
          'notification count'
        );

        const first = await notifications.first();
        assert.match(
          await first.innerText(),
          /and ACI Contact are the same account. Your message history for both chats are here./
        );
      }
    });
  }
});
