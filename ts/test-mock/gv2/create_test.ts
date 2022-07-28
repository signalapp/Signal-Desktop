// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { PrimaryDevice, Group } from '@signalapp/mock-server';
import { StorageState, Proto, UUIDKind } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';
import { MY_STORIES_ID } from '../../types/Stories';
import { uuidToBytes } from '../../util/uuidToBytes';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

export const debug = createDebug('mock:test:gv2');

describe('gv2', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let aciContact: PrimaryDevice;
  let pniContact: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { phone, server } = bootstrap;

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      e164: phone.device.number,
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
    state = state.addContact(pniContact, {
      identityState: Proto.ContactRecord.IdentityState.VERIFIED,
      whitelisted: true,

      identityKey: pniContact.getPublicKey(UUIDKind.PNI).serialize(),

      // Give PNI as the uuid!
      serviceUuid: pniContact.device.pni,
      givenName: 'PNI Contact',
    });

    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORIES_ID),
          isBlockList: true,
          name: MY_STORIES_ID,
          recipientUuids: [],
        },
      },
    });

    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function after() {
    if (this.currentTest?.state !== 'passed') {
      await bootstrap.saveLogs();
    }

    await app.close();
    await bootstrap.teardown();
  });

  it('should create group and modify it', async () => {
    const { phone } = bootstrap;

    let state = await phone.expectStorageState('initial state');

    const window = await app.getWindow();

    const leftPane = window.locator('.left-pane-wrapper');
    const conversationStack = window.locator('.conversation-stack');

    debug('clicking compose and "New group" buttons');

    await leftPane.locator('.module-main-header__compose-icon').click();

    await leftPane
      .locator('_react=BaseConversationListItem[title = "New group"]')
      .click();

    debug('inviting ACI member');

    await leftPane
      .locator('.module-left-pane__compose-search-form__input')
      .fill('ACI');

    await leftPane
      .locator('_react=BaseConversationListItem[title = "ACI Contact"]')
      .click();

    debug('inviting PNI member');

    await leftPane
      .locator('.module-left-pane__compose-search-form__input')
      .fill('PNI');

    await leftPane
      .locator('_react=BaseConversationListItem[title = "PNI Contact"]')
      .click();

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

    await conversationStack
      .locator('.react-contextmenu-item >> "Group settings"')
      .click();

    debug('editing group title');
    {
      const detailsHeader = conversationStack.locator(
        '_react=ConversationDetailsHeader'
      );
      detailsHeader.locator('button >> "My group"').click();

      const modal = window.locator('.module-Modal:has-text("Edit group")');

      // Group title should be immediately focused.
      await modal.type(' (v2)');

      await modal.locator('button >> "Save"').click();
    }

    debug('waiting for the second group update');
    group = await phone.waitForGroupUpdate(group);

    assert.strictEqual(group.title, 'My group (v2)');
    assert.strictEqual(group.revision, 1);
  });
});
