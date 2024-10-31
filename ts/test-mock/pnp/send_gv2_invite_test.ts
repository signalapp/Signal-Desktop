// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { PrimaryDevice, Group } from '@signalapp/mock-server';
import { StorageState, Proto, ServiceIdKind } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';
import { MY_STORY_ID } from '../../types/Stories';
import { uuidToBytes } from '../../util/uuidToBytes';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

export const debug = createDebug('mock:test:gv2');

describe('pnp/send gv2 invite', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let aciContact: PrimaryDevice;
  let pniContact: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap({
      contactCount: 0,
    });
    await bootstrap.init();

    const { phone, server } = bootstrap;

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
    });

    aciContact = await server.createPrimaryDevice({
      profileName: 'ACI Contact',
    });
    state = state.addContact(aciContact, {
      identityState: Proto.ContactRecord.IdentityState.VERIFIED,
      whitelisted: true,

      identityKey: aciContact.publicKey.serialize(),
      profileKey: aciContact.profileKey.serialize(),
    });

    pniContact = await server.createPrimaryDevice({
      profileName: 'My profile is a secret',
    });
    state = state.addContact(
      pniContact,
      {
        identityState: Proto.ContactRecord.IdentityState.VERIFIED,
        whitelisted: true,

        identityKey: pniContact.getPublicKey(ServiceIdKind.PNI).serialize(),

        givenName: 'PNI Contact',
      },
      ServiceIdKind.PNI
    );

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

  it('should create group and modify it', async () => {
    const { phone } = bootstrap;

    let state = await phone.expectStorageState('initial state');

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');
    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('clicking compose and "New group" buttons');

    await window.getByRole('button', { name: 'New chat' }).click();

    await leftPane.getByTestId('ComposeStepButton--group').click();

    debug('inviting ACI member');

    await leftPane
      .locator('.module-left-pane__compose-search-form__input')
      .fill('ACI');

    await leftPane.locator('.ListTile >> "ACI Contact"').click();

    debug('inviting PNI member');

    await leftPane
      .locator('.module-left-pane__compose-search-form__input')
      .fill('PNI');

    await leftPane.locator('.ListTile >> "PNI Contact"').click();

    await leftPane
      .locator('.module-left-pane__footer button >> "Next"')
      .click();

    debug('entering group title');

    await leftPane.type('My group');

    await leftPane
      .locator('.module-left-pane__footer button >> "Create"')
      .click();

    debug('waiting for invitation modal');

    {
      const modal = window.locator(
        '.module-GroupDialog:has-text("Invitation sent")'
      );

      await modal.locator('button >> "Okay"').click();
    }

    debug('waiting for group data from storage service');

    let group: Group;
    {
      state = await phone.waitForStorageState({ after: state });
      const groups = await phone.getAllGroups(state);
      assert.strictEqual(groups.length, 1);

      [group] = groups;
      assert.strictEqual(group.title, 'My group');
      assert.strictEqual(group.revision, 0);
      assert.strictEqual(group.state.members?.length, 2);
      assert.strictEqual(group.state.membersPendingProfileKey?.length, 1);
    }

    debug('opening group settings');

    await conversationStack
      .locator('button.module-ConversationHeader__button--more')
      .click();

    await window.locator('.react-contextmenu-item >> "Group settings"').click();

    debug('editing group title');
    {
      const detailsHeader = conversationStack.locator(
        '[data-testid=ConversationDetailsHeader]'
      );
      await detailsHeader.locator('button >> "My group"').click();

      const modal = window.locator('.module-Modal:has-text("Edit group")');
      await modal.locator('input').fill('My group (v2)');
      await modal.locator('button >> "Save"').click();
    }

    debug('waiting for the second group update');
    group = await phone.waitForGroupUpdate(group);

    assert.strictEqual(group.title, 'My group (v2)');
    assert.strictEqual(group.revision, 1);
  });
});
