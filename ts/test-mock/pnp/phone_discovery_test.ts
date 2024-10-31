// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { ServiceIdKind, Proto, StorageState } from '@signalapp/mock-server';
import type { PrimaryDevice } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { uuidToBytes } from '../../util/uuidToBytes';
import { MY_STORY_ID } from '../../types/Stories';
import { toUntaggedPni } from '../../types/ServiceId';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';
import {
  expectSystemMessages,
  typeIntoInput,
  waitForEnabledComposer,
} from '../helpers';

export const debug = createDebug('mock:test:merge');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

// PhoneNumberDiscovery notifications are also known as a Session Switchover Events (SSE).
describe('pnp/phone discovery', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let pniContact: PrimaryDevice;
  let pniIdentityKey: Uint8Array;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 0 });
    await bootstrap.init();

    const { server, phone } = bootstrap;

    pniContact = await server.createPrimaryDevice({
      profileName: 'ACI Contact',
    });
    pniIdentityKey = pniContact.getPublicKey(ServiceIdKind.PNI).serialize();

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
    });

    state = state.addContact(
      pniContact,
      {
        identityState: Proto.ContactRecord.IdentityState.DEFAULT,
        whitelisted: true,

        identityKey: pniIdentityKey,

        serviceE164: pniContact.device.number,
      },
      ServiceIdKind.PNI
    );

    // Put contact in left pane
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

  it('adds phone number discovery when we detect ACI/PNI association via Storage Service', async () => {
    const { phone } = bootstrap;

    const window = await app.getWindow();
    const leftPane = window.locator('#LeftPane');

    debug('opening conversation with the PNI');
    await leftPane.locator(`[data-testid="${pniContact.device.pni}"]`).click();

    debug('Send message to PNI and establish a session');
    {
      const compositionInput = await waitForEnabledComposer(window);

      await typeIntoInput(compositionInput, 'Hello PNI');
      await compositionInput.press('Enter');
    }

    debug(
      'adding both contacts from storage service, adding one combined contact'
    );
    {
      const state = await phone.expectStorageState('consistency check');
      await phone.setStorageState(
        state
          .removeContact(pniContact, ServiceIdKind.PNI)
          .addContact(pniContact, {
            identityState: Proto.ContactRecord.IdentityState.DEFAULT,
            whitelisted: true,
            identityKey: pniContact.publicKey.serialize(),
            profileKey: pniContact.profileKey.serialize(),
            pni: toUntaggedPni(pniContact.device.pni),
          })
      );
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });
    }

    await window.locator('.module-conversation-hero').waitFor();

    debug('Open ACI conversation');
    await leftPane.locator(`[data-testid="${pniContact.device.aci}"]`).click();

    debug('Wait for PNI conversation to go away');
    await window
      .locator(`.module-conversation-hero >> ${pniContact.profileName}`)
      .waitFor({
        state: 'hidden',
      });

    debug('Verify final state');
    {
      // Should have PNI message
      await window.locator('.module-message__text >> "Hello PNI"').waitFor();

      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'message count');

      await expectSystemMessages(window, [/.* belongs to ACI Contact/]);
    }
  });
});
