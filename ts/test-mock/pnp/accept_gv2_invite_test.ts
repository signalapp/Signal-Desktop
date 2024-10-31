// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { Group, PrimaryDevice } from '@signalapp/mock-server';
import { Proto, ServiceIdKind, StorageState } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import {
  parseAndFormatPhoneNumber,
  PhoneNumberFormat,
} from '../../util/libphonenumberInstance';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';
import { expectSystemMessages } from '../helpers';

export const debug = createDebug('mock:test:gv2');

describe('pnp/accept gv2 invite', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let group: Group;
  let unknownContact: PrimaryDevice;
  let unknownPniContact: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap({
      contactCount: 10,
      unknownContactCount: 3,
    });
    await bootstrap.init();

    const { phone, contacts, unknownContacts } = bootstrap;
    const [first, second] = contacts;
    [unknownContact, unknownPniContact] = unknownContacts;

    group = await first.createGroup({
      title: 'Invited Desktop PNI',
      members: [first, second, unknownContact],
    });

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
    });

    state = state.addContact(
      unknownPniContact,
      {
        identityState: Proto.ContactRecord.IdentityState.DEFAULT,
        whitelisted: true,
        profileKey: undefined,

        serviceE164: unknownPniContact.device.number,
      },
      ServiceIdKind.PNI
    );

    await phone.setStorageState(state);

    app = await bootstrap.link();

    const { desktop } = bootstrap;

    group = await first.inviteToGroup(group, desktop, {
      serviceIdKind: ServiceIdKind.PNI,
    });

    // Verify that created group has pending member
    assert.strictEqual(group.state?.members?.length, 3);
    assert(!group.getMemberByServiceId(desktop.aci));
    assert(!group.getMemberByServiceId(desktop.pni));
    assert(!group.getPendingMemberByServiceId(desktop.aci));
    assert(group.getPendingMemberByServiceId(desktop.pni));

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');

    debug('Opening group');
    await leftPane.locator(`[data-testid="${group.id}"]`).click();

    debug('Wait for conversation open fetches to complete');
    await app.waitForConversationOpenComplete();
  });

  afterEach(async function (this: Mocha.Context) {
    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('should accept PNI invite and modify the group state', async () => {
    const { phone, contacts, desktop } = bootstrap;
    const [first, second] = contacts;

    const window = await app.getWindow();

    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('Accepting');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    group = await phone.waitForGroupUpdate(group);
    assert.strictEqual(group.revision, 2);
    assert.strictEqual(group.state?.members?.length, 4);
    assert(group.getMemberByServiceId(desktop.aci));
    assert(!group.getMemberByServiceId(desktop.pni));
    assert(!group.getPendingMemberByServiceId(desktop.aci));
    assert(!group.getPendingMemberByServiceId(desktop.pni));

    debug('Checking that notifications are present');
    await window
      .locator(
        `.SystemMessage:has-text("${first.profileName} invited you to the group.")`
      )
      .waitFor();
    await window
      .locator(
        `.SystemMessage:has-text("You accepted an invitation to the group from ${first.profileName}.")`
      )
      .waitFor();

    debug('Invite PNI again');
    group = await second.inviteToGroup(group, desktop, {
      serviceIdKind: ServiceIdKind.PNI,
    });
    assert(group.getMemberByServiceId(desktop.aci));
    assert(group.getPendingMemberByServiceId(desktop.pni));

    await window
      .locator(
        `.SystemMessage:has-text("${second.profileName} invited you to the group.")`
      )
      .waitFor();

    debug('Verify that message request state is not visible');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .waitFor({ state: 'hidden' });

    await window
      .locator('button.module-ConversationHeader__button--more')
      .click();

    await window.locator('.react-contextmenu-item >> "Group settings"').click();

    debug(
      'Checking that we see all members of group, including (previously) unknown contact'
    );
    await window
      .locator('.ConversationDetails-panel-section__title >> "4 members"')
      .waitFor();
    await window.getByText(unknownContact.profileName).waitFor();

    debug('Leave the group through settings');

    await conversationStack
      .locator('.conversation-details-panel >> "Leave group"')
      .click();

    await window
      .getByTestId('ConfirmationDialog.ConversationDetailsAction.confirmLeave')
      .getByRole('button', { name: 'Leave' })
      .click();

    debug('Get back to timeline');

    await window.locator('.ConversationPanel__header__back-button').click();

    debug('Waiting for final group update');
    group = await phone.waitForGroupUpdate(group);
    assert.strictEqual(group.revision, 4);
    assert.strictEqual(group.state?.members?.length, 3);
    assert(!group.getMemberByServiceId(desktop.aci));
    assert(!group.getMemberByServiceId(desktop.pni));
    assert(!group.getPendingMemberByServiceId(desktop.aci));
    assert(group.getPendingMemberByServiceId(desktop.pni));

    debug('Waiting for notification');
    await window
      .locator('.SystemMessage:has-text("You left the group")')
      .waitFor();
  });

  it('should decline PNI invite and modify the group state', async () => {
    const { phone, desktop } = bootstrap;

    const window = await app.getWindow();

    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('Declining');
    await conversationStack
      .locator('.module-message-request-actions button >> "Block"')
      .click();

    debug('waiting for confirmation modal');
    await window.locator('.module-Modal button >> "Block"').click();

    group = await phone.waitForGroupUpdate(group);
    assert.strictEqual(group.revision, 2);
    assert.strictEqual(group.state?.members?.length, 3);
    assert(!group.getMemberByServiceId(desktop.aci));
    assert(!group.getMemberByServiceId(desktop.pni));
    assert(!group.getPendingMemberByServiceId(desktop.aci));
    assert(!group.getPendingMemberByServiceId(desktop.pni));

    // Verify that sync message was sent.
    const { syncMessage } = await phone.waitForSyncMessage(entry =>
      Boolean(entry.syncMessage.sent?.message?.groupV2?.groupChange)
    );
    const groupChangeBuffer = syncMessage.sent?.message?.groupV2?.groupChange;
    assert.notEqual(groupChangeBuffer, null);
    const groupChange = Proto.GroupChange.decode(
      groupChangeBuffer ?? new Uint8Array(0)
    );
    assert.notEqual(groupChange.actions, null);
    const actions = Proto.GroupChange.Actions.decode(
      groupChange?.actions ?? new Uint8Array(0)
    );
    assert.strictEqual(actions.deletePendingMembers.length, 1);
  });

  it('should accept ACI invite with extra PNI on the invite list', async () => {
    const { phone, contacts, desktop } = bootstrap;
    const [first, second] = contacts;

    const window = await app.getWindow();

    debug('Waiting for the PNI invite');
    await window
      .locator(
        `.SystemMessage:has-text("${first.profileName} invited you to the group.")`
      )
      .waitFor();

    debug('Inviting ACI from another contact');
    group = await second.inviteToGroup(group, desktop, {
      serviceIdKind: ServiceIdKind.ACI,
    });

    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('Waiting for the ACI invite');
    await window
      .locator(
        `.SystemMessage:has-text("${second.profileName} invited you to the group.")`
      )
      .waitFor();

    debug('Accepting');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    debug('Checking final notification');
    await window
      .locator(
        `.SystemMessage:has-text("You accepted an invitation to the group from ${second.profileName}.")`
      )
      .waitFor();

    group = await phone.waitForGroupUpdate(group);
    assert.strictEqual(group.revision, 3);
    assert.strictEqual(group.state?.members?.length, 4);
    assert(group.getMemberByServiceId(desktop.aci));
    assert(!group.getMemberByServiceId(desktop.pni));
    assert(!group.getPendingMemberByServiceId(desktop.aci));
    assert(group.getPendingMemberByServiceId(desktop.pni));

    debug('Verifying invite list');
    await conversationStack
      .locator('.module-ConversationHeader__header__info__title')
      .click();
    await conversationStack
      .locator(
        '.ConversationDetails-panel-row__root--button >> ' +
          'text=Requests & Invites'
      )
      .click();
    await conversationStack
      .locator('.ConversationDetails__tabs__tab >> text=Invites (1)')
      .click();
    await conversationStack
      .locator(
        '.ConversationDetails-panel-row__root >> ' +
          `text=/${first.profileName}.*Invited 1/i`
      )
      .waitFor();
  });

  it('should decline ACI invite with extra PNI on the invite list', async () => {
    const { phone, contacts, desktop } = bootstrap;
    const [, second] = contacts;

    const window = await app.getWindow();

    debug('Sending another invite');

    // Invite ACI from another contact
    group = await second.inviteToGroup(group, desktop, {
      serviceIdKind: ServiceIdKind.ACI,
    });

    const conversationStack = window.locator('.Inbox__conversation-stack');

    debug('Declining');
    await conversationStack
      .locator('.module-message-request-actions button >> "Block"')
      .click();

    debug('waiting for confirmation modal');
    await window.locator('.module-Modal button >> "Block"').click();

    group = await phone.waitForGroupUpdate(group);
    assert.strictEqual(group.revision, 3);
    assert.strictEqual(group.state?.members?.length, 3);
    assert(!group.getMemberByServiceId(desktop.aci));
    assert(!group.getMemberByServiceId(desktop.pni));
    assert(!group.getPendingMemberByServiceId(desktop.aci));
    assert(group.getPendingMemberByServiceId(desktop.pni));
  });

  it('should display a single notification for remote PNI accept', async () => {
    const { phone, contacts, desktop } = bootstrap;

    const [first, second] = contacts;

    debug('Creating new group with Desktop');
    group = await phone.createGroup({
      title: 'Remote Invite',
      members: [phone, first],
    });

    debug('Inviting remote PNI to group');
    const secondKey = await second.device.popSingleUseKey(ServiceIdKind.PNI);
    await first.addSingleUseKey(second.device, secondKey, ServiceIdKind.PNI);

    group = await first.inviteToGroup(group, second.device, {
      serviceIdKind: ServiceIdKind.PNI,
      timestamp: bootstrap.getTimestamp(),

      // There is no one to receive it so don't bother.
      sendUpdateTo: [],
    });

    debug('Sending message to group');
    await first.sendText(desktop, 'howdy', {
      group,
      timestamp: bootstrap.getTimestamp(),
    });

    const window = await app.getWindow();
    const leftPane = window.locator('#LeftPane');

    debug('Opening new group');
    await leftPane.locator(`[data-testid="${group.id}"]`).click();

    debug('Accepting remote invite');
    await second.acceptPniInvite(group, {
      timestamp: bootstrap.getTimestamp(),
      sendUpdateTo: [{ device: desktop }],
    });

    await expectSystemMessages(window, [
      'You were added to the group.',
      `${second.profileName} accepted an invitation to the group from ${first.profileName}.`,
    ]);
  });

  it('should display a e164 for a PNI invite', async () => {
    const { phone, contacts, desktop } = bootstrap;

    const [first] = contacts;

    debug('Creating new group with Desktop');
    group = await phone.createGroup({
      title: 'Remote Invite',
      members: [phone, first],
    });

    debug('Sending message to group');
    await first.sendText(desktop, 'howdy', {
      group,
      timestamp: bootstrap.getTimestamp(),
    });

    const window = await app.getWindow();
    const leftPane = window.locator('#LeftPane');

    debug('Opening new group');
    await leftPane.locator(`[data-testid="${group.id}"]`).click();

    debug('Inviting remote PNI to group');
    group = await phone.inviteToGroup(group, unknownPniContact.device, {
      timestamp: bootstrap.getTimestamp(),

      serviceIdKind: ServiceIdKind.PNI,
      sendUpdateTo: [{ device: desktop }],
    });

    debug('Waiting for invite notification');
    const parsedE164 = parseAndFormatPhoneNumber(
      unknownPniContact.device.number,
      '+1',
      PhoneNumberFormat.NATIONAL
    );
    if (!parsedE164) {
      throw new Error('Failed to parse device number');
    }
    const { e164 } = parsedE164;
    await window
      .locator(`.SystemMessage:has-text("You invited ${e164} to the group")`)
      .waitFor();

    debug('Accepting remote invite');
    await unknownPniContact.acceptPniInvite(group, {
      timestamp: bootstrap.getTimestamp(),
      sendUpdateTo: [{ device: desktop }],
    });

    debug('Waiting for accept notification');
    await expectSystemMessages(window, [
      'You were added to the group.',
      /^You invited .* to the group\.$/,
      `${unknownPniContact.profileName} accepted your invitation to the group.`,
    ]);
  });
});
