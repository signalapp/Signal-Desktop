// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { UUIDKind, Proto, StorageState } from '@signalapp/mock-server';
import type { PrimaryDevice } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';

export const debug = createDebug('mock:test:pni-signature');

describe('pnp/learn', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let contactA: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { server, phone } = bootstrap;

    contactA = await server.createPrimaryDevice({
      profileName: 'contactA',
    });

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      e164: phone.device.number,
    });

    state = state.addContact(
      contactA,
      {
        whitelisted: false,
        identityKey: contactA.getPublicKey(UUIDKind.ACI).serialize(),
        serviceE164: undefined,
        givenName: 'ContactA',
      },
      UUIDKind.ACI
    );

    // Just to make PNI Contact visible in the left pane
    state = state.pin(contactA, UUIDKind.ACI);

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

  it('shows Learned Number notification if we find out number later', async () => {
    const { desktop, phone } = bootstrap;

    const window = await app.getWindow();

    debug('Open conversation with contactA');
    {
      const leftPane = window.locator('.left-pane-wrapper');

      await leftPane
        .locator('_react=ConversationListItem[title = "ContactA"]')
        .click();

      await window.locator('.module-conversation-hero').waitFor();
    }

    debug('Verify starting state');
    {
      // No messages
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 0, 'message count');

      // No notifications
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notification count');
    }

    debug('Send message to contactA');
    {
      const composeArea = window.locator(
        '.composition-area-wrapper, .conversation .ConversationView'
      );
      const compositionInput = composeArea.locator('_react=CompositionInput');

      await compositionInput.type('message to contactA');
      await compositionInput.press('Enter');
    }

    debug('Wait for the message to contactA');
    {
      const { source, body } = await contactA.waitForMessage();

      assert.strictEqual(
        source,
        desktop,
        'first message must have valid source'
      );
      assert.strictEqual(
        body,
        'message to contactA',
        'message must have correct body'
      );
    }

    debug('Add phone number to contactA via storage service');
    {
      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.serviceUuid ===
              contactA.device.getUUIDByKind(UUIDKind.ACI)
          )
          .addContact(
            contactA,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              identityKey: contactA.getPublicKey(UUIDKind.ACI).serialize(),
              givenName: 'ContactA',
              serviceE164: contactA.device.number,
            },
            UUIDKind.ACI
          )
      );

      const updatedStorageVersion = updated.version;

      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await app.waitForManifestVersion(updatedStorageVersion);
    }

    debug('Verify final state');
    {
      // One outgoing message
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'messages');

      // One 'learned number' notification
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 1, 'notifications');

      const first = await notifications.first();
      assert.match(await first.innerText(), /belongs to ContactA$/);
    }
  });

  it('Does not show Learned Number notification if no sent, not in allowlist', async () => {
    const { phone } = bootstrap;

    const window = await app.getWindow();

    debug('Open conversation with contactA');
    {
      const leftPane = window.locator('.left-pane-wrapper');

      await leftPane
        .locator('_react=ConversationListItem[title = "ContactA"]')
        .click();

      await window.locator('.module-conversation-hero').waitFor();
    }

    debug('Verify starting state');
    {
      // No messages
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 0, 'message count');

      // No notifications
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notification count');
    }

    debug('Add phone number to contactA via storage service');
    {
      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.serviceUuid ===
              contactA.device.getUUIDByKind(UUIDKind.ACI)
          )
          .addContact(
            contactA,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: false,
              identityKey: contactA.getPublicKey(UUIDKind.ACI).serialize(),
              givenName: 'ContactA',
              serviceE164: contactA.device.number,
            },
            UUIDKind.ACI
          )
      );

      const updatedStorageVersion = updated.version;

      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await app.waitForManifestVersion(updatedStorageVersion);
    }

    debug('Verify final state');
    {
      // No messages
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 0, 'messages');

      // No 'learned number' notification
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notifications');
    }
  });
});
