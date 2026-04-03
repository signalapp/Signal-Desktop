// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  type PrimaryDevice,
  type Group,
  Proto,
  ServiceIdKind,
} from '@signalapp/mock-server';
import { StorageState } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations/index.std.ts';
import { Bootstrap } from '../bootstrap.node.ts';
import type { App } from '../bootstrap.node.ts';
import { uuidToBytes } from '../../util/uuidToBytes.std.ts';
import { MY_STORY_ID } from '../../types/Stories.std.ts';

export const debug = createDebug('mock:test:groups');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('groups/terminate', function (this: Mocha.Suite) {
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

    // Add my story
    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORY_ID),
          isBlockList: true,
          name: MY_STORY_ID,
          deletedAtTimestamp: null,
          recipientServiceIdsBinary: null,
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

  it('should terminate group', async () => {
    const { phone } = bootstrap;

    let state = await phone.expectStorageState('initial state');

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');

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

    debug('waiting for PNI invitation modal');

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
      assert.strictEqual(groups.length, 1, '1 group');

      [group] = groups as [Group];
      assert.strictEqual(group.title, 'My group', 'group title');
      assert.strictEqual(group.revision, 0, 'group revision');
      assert.strictEqual(group.state.members?.length, 2, 'member count');
    }

    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('opening group settings');

    await conversationStack.getByRole('button', { name: 'More Info' }).click();

    await window.getByRole('menuitem', { name: 'Group settings' }).click();

    await conversationStack
      .locator('.conversation-details-panel')
      .getByRole('button', { name: 'End group' })
      .click();

    await window
      .getByTestId(
        'ConfirmationDialog.ConversationDetailsAction.promptTerminateGroup'
      )
      .getByRole('button', { name: 'End group' })
      .click();

    await window
      .getByTestId(
        'ConfirmationDialog.ConversationDetailsAction.confirmTerminateGroup'
      )
      .getByRole('button', { name: 'End group' })
      .click();

    debug('Waiting for final group update');
    group = await phone.waitForGroupUpdate(group);

    debug('Waiting for notification');
    await window
      .locator('.SystemMessage:has-text("You ended the group")')
      .waitFor();

    debug('Waiting for composition area notice');
    await window.getByTestId('CompositionArea--group-terminated').waitFor();
  });
});
