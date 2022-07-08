// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { Group } from '@signalapp/mock-server';
import { UUIDKind } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';

export const debug = createDebug('mock:test:gv2');

describe('gv2', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let group: Group;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { contacts } = bootstrap;

    const [first, second] = contacts;

    group = await first.createGroup({
      title: 'Invite by PNI',
      members: [first, second],
    });

    app = await bootstrap.link();

    const { desktop } = bootstrap;

    group = await first.inviteToGroup(group, desktop, {
      uuidKind: UUIDKind.PNI,
    });

    // Verify that created group has pending member
    assert.strictEqual(group.state?.members?.length, 2);
    assert(!group.getMemberByUUID(desktop.uuid));
    assert(!group.getMemberByUUID(desktop.pni));
    assert(!group.getPendingMemberByUUID(desktop.uuid));
    assert(group.getPendingMemberByUUID(desktop.pni));

    const window = await app.getWindow();

    const leftPane = window.locator('.left-pane-wrapper');

    debug('Opening group');
    await leftPane
      .locator(
        '_react=ConversationListItem' +
          `[title = ${JSON.stringify(group.title)}]`
      )
      .click();
  });

  afterEach(async function after() {
    if (this.currentTest?.state !== 'passed') {
      await bootstrap.saveLogs();
    }

    await app.close();
    await bootstrap.teardown();
  });

  it('should accept PNI invite and modify the group state', async () => {
    const { phone, contacts, desktop } = bootstrap;
    const [first, second] = contacts;

    const window = await app.getWindow();

    const conversationStack = window.locator('.conversation-stack');

    debug('Accepting');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    group = await phone.waitForGroupUpdate(group);
    assert.strictEqual(group.revision, 2);
    assert.strictEqual(group.state?.members?.length, 3);
    assert(group.getMemberByUUID(desktop.uuid));
    assert(!group.getMemberByUUID(desktop.pni));
    assert(!group.getPendingMemberByUUID(desktop.uuid));
    assert(!group.getPendingMemberByUUID(desktop.pni));

    debug('Checking that notifications are present');
    await window
      .locator(`"${first.profileName} invited you to the group."`)
      .waitFor();
    await window
      .locator(
        `"You accepted an invitation to the group from ${first.profileName}."`
      )
      .waitFor();

    debug('Invite PNI again');
    group = await second.inviteToGroup(group, desktop, {
      uuidKind: UUIDKind.PNI,
    });
    assert(group.getMemberByUUID(desktop.uuid));
    assert(group.getPendingMemberByUUID(desktop.pni));

    await window
      .locator(`"${second.profileName} invited you to the group."`)
      .waitFor();

    debug('Verify that message request state is not visible');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .waitFor({ state: 'hidden' });

    debug('Leave the group through settings');

    await conversationStack
      .locator('button.module-ConversationHeader__button--more')
      .click();

    await conversationStack
      .locator('.react-contextmenu-item >> "Group settings"')
      .click();

    await conversationStack
      .locator('.conversation-details-panel >> "Leave group"')
      .click();

    await window.locator('.module-Modal button >> "Leave"').click();

    debug('Waiting for final group update');
    group = await phone.waitForGroupUpdate(group);
    assert.strictEqual(group.revision, 4);
    assert.strictEqual(group.state?.members?.length, 2);
    assert(!group.getMemberByUUID(desktop.uuid));
    assert(!group.getMemberByUUID(desktop.pni));
    assert(!group.getPendingMemberByUUID(desktop.uuid));
    assert(group.getPendingMemberByUUID(desktop.pni));
  });

  it('should decline PNI invite and modify the group state', async () => {
    const { phone, desktop } = bootstrap;

    const window = await app.getWindow();

    const conversationStack = window.locator('.conversation-stack');

    debug('Declining');
    await conversationStack
      .locator('.module-message-request-actions button >> "Delete"')
      .click();

    debug('waiting for confirmation modal');
    await window.locator('.module-Modal button >> "Delete and Leave"').click();

    group = await phone.waitForGroupUpdate(group);
    assert.strictEqual(group.revision, 2);
    assert.strictEqual(group.state?.members?.length, 2);
    assert(!group.getMemberByUUID(desktop.uuid));
    assert(!group.getMemberByUUID(desktop.pni));
    assert(!group.getPendingMemberByUUID(desktop.uuid));
    assert(!group.getPendingMemberByUUID(desktop.pni));
  });

  it('should accept ACI invite with extra PNI on the invite list', async () => {
    const { phone, contacts, desktop } = bootstrap;
    const [first, second] = contacts;

    const window = await app.getWindow();

    debug('Sending another invite');

    // Invite ACI from another contact
    group = await second.inviteToGroup(group, desktop, {
      uuidKind: UUIDKind.ACI,
    });

    const conversationStack = window.locator('.conversation-stack');

    debug('Accepting');
    await conversationStack
      .locator('.module-message-request-actions button >> "Accept"')
      .click();

    debug('Verifying notifications');
    await window
      .locator(`"${first.profileName} invited you to the group."`)
      .waitFor();
    await window.locator('"You were invited to the group."').waitFor();
    await window
      .locator(
        `"You accepted an invitation to the group from ${second.profileName}."`
      )
      .waitFor();

    group = await phone.waitForGroupUpdate(group);
    assert.strictEqual(group.revision, 3);
    assert.strictEqual(group.state?.members?.length, 3);
    assert(group.getMemberByUUID(desktop.uuid));
    assert(!group.getMemberByUUID(desktop.pni));
    assert(!group.getPendingMemberByUUID(desktop.uuid));
    assert(group.getPendingMemberByUUID(desktop.pni));
  });

  it('should decline ACI invite with extra PNI on the invite list', async () => {
    const { phone, contacts, desktop } = bootstrap;
    const [, second] = contacts;

    const window = await app.getWindow();

    debug('Sending another invite');

    // Invite ACI from another contact
    group = await second.inviteToGroup(group, desktop, {
      uuidKind: UUIDKind.ACI,
    });

    const conversationStack = window.locator('.conversation-stack');

    debug('Declining');
    await conversationStack
      .locator('.module-message-request-actions button >> "Delete"')
      .click();

    debug('waiting for confirmation modal');
    await window.locator('.module-Modal button >> "Delete and Leave"').click();

    group = await phone.waitForGroupUpdate(group);
    assert.strictEqual(group.revision, 3);
    assert.strictEqual(group.state?.members?.length, 2);
    assert(!group.getMemberByUUID(desktop.uuid));
    assert(!group.getMemberByUUID(desktop.pni));
    assert(!group.getPendingMemberByUUID(desktop.uuid));
    assert(group.getPendingMemberByUUID(desktop.pni));
  });
});
