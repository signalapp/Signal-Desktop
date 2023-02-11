// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { UUIDKind, StorageState, Proto } from '@signalapp/mock-server';
import type { PrimaryDevice } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';
import { UUID } from '../../types/UUID';

export const debug = createDebug('mock:test:pni-change');

describe('pnp/PNI Change', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let contactA: PrimaryDevice;
  let contactB: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { server, phone } = bootstrap;

    contactA = await server.createPrimaryDevice({
      profileName: 'contactA',
    });
    contactB = await server.createPrimaryDevice({
      profileName: 'contactB',
    });

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      e164: phone.device.number,
    });

    state = state.addContact(
      contactA,
      {
        whitelisted: true,
        serviceE164: contactA.device.number,
        identityKey: contactA.getPublicKey(UUIDKind.PNI).serialize(),
        pni: contactA.device.getUUIDByKind(UUIDKind.PNI),
        givenName: 'ContactA',
      },
      UUIDKind.PNI
    );

    // Just to make PNI Contact visible in the left pane
    state = state.pin(contactA, UUIDKind.PNI);

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

  it('shows no identity change if identity key is the same', async () => {
    const { desktop, phone } = bootstrap;

    const window = await app.getWindow();

    debug('Open conversation with contactA');
    {
      const leftPane = window.locator('.left-pane-wrapper');

      await leftPane
        .locator(
          `[data-testid="${contactA.device.getUUIDByKind(UUIDKind.PNI)}"]`
        )
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
      const compositionInput = composeArea.locator(
        '[data-testid=CompositionInput]'
      );

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

    debug('Update pni on contactA via storage service');
    {
      const updatedUuid = UUID.generate().toString();

      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.serviceUuid ===
              contactA.device.getUUIDByKind(UUIDKind.PNI)
          )
          .addContact(
            contactA,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              serviceE164: contactA.device.number,
              serviceUuid: updatedUuid,
              pni: updatedUuid,
              identityKey: contactA.getPublicKey(UUIDKind.PNI).serialize(),
            },
            UUIDKind.PNI
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
      // One sent message
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'message count');

      // No notifications - PNI changed, but identity key is the same
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notification count');
    }
  });

  it('shows identity change if identity key has changed', async () => {
    const { desktop, phone } = bootstrap;

    const window = await app.getWindow();

    debug('Open conversation with contactA');
    {
      const leftPane = window.locator('.left-pane-wrapper');

      await leftPane
        .locator(
          `[data-testid="${contactA.device.getUUIDByKind(UUIDKind.PNI)}"]`
        )
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
      const compositionInput = composeArea.locator(
        '[data-testid=CompositionInput]'
      );

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

    debug('Switch e164 to contactB via storage service');
    {
      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.serviceUuid ===
              contactA.device.getUUIDByKind(UUIDKind.PNI)
          )
          .addContact(
            contactB,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              serviceE164: contactA.device.number,
              pni: contactB.device.getUUIDByKind(UUIDKind.PNI),

              // Key change - different identity key
              identityKey: contactB.publicKey.serialize(),
            },
            UUIDKind.PNI
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
      // One sent message
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'message count');

      // One notification - the safety number change
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 1, 'notification count');

      const first = await notifications.first();
      assert.match(await first.innerText(), /Safety Number has changed/);
    }
  });

  it('shows identity change when sending to contact', async () => {
    const { desktop, phone } = bootstrap;

    const window = await app.getWindow();

    debug('Open conversation with contactA');
    {
      const leftPane = window.locator('.left-pane-wrapper');

      await leftPane
        .locator(
          `[data-testid="${contactA.device.getUUIDByKind(UUIDKind.PNI)}"]`
        )
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
      const compositionInput = composeArea.locator(
        '[data-testid=CompositionInput]'
      );

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

    debug('Switch e164 to contactB via storage service');
    {
      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.serviceUuid ===
              contactA.device.getUUIDByKind(UUIDKind.PNI)
          )
          .addContact(
            contactB,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              serviceE164: contactA.device.number,
              pni: contactB.device.getUUIDByKind(UUIDKind.PNI),

              // Note: No identityKey key provided here!
            },
            UUIDKind.PNI
          )
      );

      const updatedStorageVersion = updated.version;

      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await app.waitForManifestVersion(updatedStorageVersion);
    }

    debug('Send message to contactB');
    {
      const composeArea = window.locator(
        '.composition-area-wrapper, .conversation .ConversationView'
      );
      const compositionInput = composeArea.locator(
        '[data-testid=CompositionInput]'
      );

      await compositionInput.type('message to contactB');
      await compositionInput.press('Enter');

      // We get a safety number change warning, because we get a different identity key!
      await window
        .locator('.module-SafetyNumberChangeDialog__confirm-dialog')
        .waitFor();

      await window.locator('.module-Button--primary').click();
    }

    debug('Wait for the message to contactB');
    {
      const { source, body } = await contactB.waitForMessage();

      assert.strictEqual(
        source,
        desktop,
        'first message must have valid source'
      );
      assert.strictEqual(
        body,
        'message to contactB',
        'message must have correct body'
      );
    }

    debug('Verify final state');
    {
      // First message and second message
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 2, 'message count');

      // One notification - the safety number change
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 1, 'notification count');

      const first = await notifications.first();
      assert.match(await first.innerText(), /Safety Number has changed/);
    }
  });

  it('Sends with no warning when key is the same', async () => {
    const { desktop, phone } = bootstrap;

    const window = await app.getWindow();

    debug('Open conversation with contactA');
    {
      const leftPane = window.locator('.left-pane-wrapper');

      await leftPane
        .locator(
          `[data-testid="${contactA.device.getUUIDByKind(UUIDKind.PNI)}"]`
        )
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
      const compositionInput = composeArea.locator(
        '[data-testid=CompositionInput]'
      );

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

    debug('Switch e164 to contactB via storage service');
    {
      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.serviceUuid ===
              contactA.device.getUUIDByKind(UUIDKind.PNI)
          )
          .addContact(
            contactB,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              serviceE164: contactA.device.number,
              pni: contactB.device.getUUIDByKind(UUIDKind.PNI),

              // Note: No identityKey key provided here!
            },
            UUIDKind.PNI
          )
      );

      const updatedStorageVersion = updated.version;

      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await app.waitForManifestVersion(updatedStorageVersion);
    }

    debug('Switch e164 back to contactA via storage service');
    {
      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.serviceUuid ===
              contactB.device.getUUIDByKind(UUIDKind.PNI)
          )
          .addContact(
            contactB,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              serviceE164: contactA.device.number,
              pni: contactA.device.getUUIDByKind(UUIDKind.PNI),
            },
            UUIDKind.PNI
          )
      );

      const updatedStorageVersion = updated.version;

      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await app.waitForManifestVersion(updatedStorageVersion);
    }

    debug('Send message to contactA');
    {
      const composeArea = window.locator(
        '.composition-area-wrapper, .conversation .ConversationView'
      );
      const compositionInput = composeArea.locator(
        '[data-testid=CompositionInput]'
      );

      await compositionInput.type('second message to contactA');
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
        'second message to contactA',
        'message must have correct body'
      );
    }

    debug('Verify final state');
    {
      // First message and second message
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 2, 'message count');

      // No notifications - the key is the same
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notification count');
    }
  });
});
