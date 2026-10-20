// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes } from 'node:crypto';
import { assert } from 'chai';
import { expect } from 'playwright/test';
import {
  type Group,
  type PrimaryDevice,
  Proto,
  StorageState,
} from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations/index.std.ts';
import * as Bytes from '../../Bytes.std.ts';
import { SignalService as DesktopProto } from '../../protobuf/index.std.ts';
import { groupInvitesRoute } from '../../util/signalRoutes.std.ts';
import { toWebSafeBase64 } from '../../util/webSafeBase64.std.ts';
import { Bootstrap } from '../bootstrap.node.ts';
import type { App } from '../bootstrap.node.ts';

export const debug = createDebug('mock:test:groups:join-via-link');

const { AccessRequired } = Proto.AccessControl;

const GROUP_TITLE = 'Invite link group';

function buildGroupLink(group: Group): string {
  const { inviteLinkPassword } = group.state;
  assert.isOk(inviteLinkPassword, 'Group must have an invite link password');

  const bytes = DesktopProto.GroupInviteLink.encode({
    contents: {
      contentsV1: {
        groupMasterKey: group.masterKey,
        inviteLinkPassword,
      },
    },
  });
  const inviteCode = toWebSafeBase64(Bytes.toBase64(bytes));
  return groupInvitesRoute.toWebUrl({ inviteCode }).toString();
}

describe('groups/join via link', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let admin: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 1 });
    await bootstrap.init();

    const { phone } = bootstrap;
    [admin] = bootstrap.contacts as [PrimaryDevice];

    let state = StorageState.getEmpty();
    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
    });
    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  async function createGroupWithInviteLink(
    addFromInviteLink: Proto.AccessControl.AccessRequired
  ): Promise<Group> {
    return admin.createGroup({
      title: GROUP_TITLE,
      members: [admin],
      addFromInviteLink,
      inviteLinkPassword: randomBytes(16),
    });
  }

  it('joins a group that does not require approval', async () => {
    const { phone } = bootstrap;
    const group = await createGroupWithInviteLink(AccessRequired.ANY);

    debug('opening group link');
    await app.openSignalRoute(buildGroupLink(group));

    const window = await app.getWindow();
    const dialog = window.getByRole('dialog', { name: GROUP_TITLE });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Group · 1 member')).toBeVisible();

    debug('joining');
    await dialog.getByRole('button', { name: 'Join' }).click();
    await expect(dialog).toBeHidden();

    debug('waiting for group update on the server');
    const updatedGroup = await admin.waitForGroupUpdate(group);
    assert.isOk(
      updatedGroup.getMemberByServiceId(phone.device.aci),
      'We should be a member of the group'
    );
  });

  it('requests to join a group that requires approval', async () => {
    const { phone } = bootstrap;
    const group = await createGroupWithInviteLink(AccessRequired.ADMINISTRATOR);

    debug('opening group link');
    await app.openSignalRoute(buildGroupLink(group));

    const window = await app.getWindow();
    const dialog = window.getByRole('dialog', { name: GROUP_TITLE });
    await expect(dialog).toBeVisible();

    debug('requesting to join');
    await dialog.getByRole('button', { name: 'Request to Join' }).click();
    await expect(dialog).toBeHidden();

    debug('waiting for group update on the server');
    const updatedGroup = await admin.waitForGroupUpdate(group);
    assert.isNotOk(
      updatedGroup.getMemberByServiceId(phone.device.aci),
      'We should not be a member yet'
    );
    assert.isOk(
      updatedGroup.getPendingAdminApprovalMemberByServiceId(phone.device.aci),
      'We should be pending admin approval'
    );
  });

  it('does not join when the dialog is canceled', async () => {
    const { server } = bootstrap;
    const group = await createGroupWithInviteLink(AccessRequired.ANY);

    debug('opening group link');
    await app.openSignalRoute(buildGroupLink(group));

    const window = await app.getWindow();
    const dialog = window.getByRole('dialog', { name: GROUP_TITLE });
    await expect(dialog).toBeVisible();

    debug('canceling');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    const serverGroup = await server.getGroup(group.publicParams.serialize());
    assert.isOk(serverGroup, 'Group should exist on the server');
    assert.strictEqual(serverGroup.revision, 0, 'Group should be unchanged');
  });
});
