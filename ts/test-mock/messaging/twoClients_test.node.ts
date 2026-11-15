// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes } from 'node:crypto';
import { Proto, StorageState } from '@signalapp/mock-server';
import { expect } from 'playwright/test';
import * as durations from '../../util/durations/index.std.ts';
import { SignalService } from '../../protobuf/index.std.ts';
import { groupInvitesRoute } from '../../util/signalRoutes.std.ts';
import type { App } from '../playwright.node.ts';
import { Bootstrap } from '../bootstrap.node.ts';
import { typeIntoInput, waitForEnabledComposer } from '../helpers.node.ts';

describe('twoClients', function twoClients(this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap1: Bootstrap;
  let bootstrap2: Bootstrap;
  let app1: App;
  let app2: App;

  beforeEach(async () => {
    bootstrap1 = new Bootstrap();
    await bootstrap1.init();

    bootstrap2 = new Bootstrap({ server: bootstrap1.server });
    await bootstrap2.init();

    let state1 = StorageState.getEmpty();
    state1 = state1.updateAccount({
      profileKey: bootstrap1.phone.profileKey.serialize(),
      linkPreviews: true,
    });

    state1 = state1.addContact(bootstrap2.phone, {
      whitelisted: true,
      profileKey: bootstrap2.phone.profileKey.serialize(),
      givenName: 'Contact2',
    });

    state1 = state1.pin(bootstrap2.phone);

    await bootstrap1.phone.setStorageState(state1);

    app1 = await bootstrap1.link();

    let state2 = StorageState.getEmpty();
    state2 = state2.updateAccount({
      profileKey: bootstrap2.phone.profileKey.serialize(),
    });

    state2 = state2.addContact(bootstrap1.phone, {
      whitelisted: true,
      profileKey: bootstrap1.phone.profileKey.serialize(),
      givenName: 'Contact1',
    });

    state2 = state2.pin(bootstrap1.phone);
    await bootstrap2.phone.setStorageState(state2);

    app2 = await bootstrap2.link();
  });

  afterEach(async function after(this: Mocha.Context) {
    if (!bootstrap1) {
      return;
    }
    await bootstrap1.maybeSaveLogs(this.currentTest, app1);
    await bootstrap2.maybeSaveLogs(this.currentTest, app2);

    await app2.close();
    await app1.close();

    await bootstrap2.teardown();
    await bootstrap1.teardown();
  });

  it('can send a message from one client to another', async () => {
    const window1 = await app1.getWindow();
    const leftPane1 = window1.locator('#LeftPane');

    await leftPane1
      .locator(`[data-testid="${bootstrap2.phone.device.aci}"]`)
      .click();
    const window2 = await app2.getWindow();

    const messageBody = 'Hello world';
    const compositionInput = await waitForEnabledComposer(window1);
    await typeIntoInput(compositionInput, messageBody, '');
    await compositionInput.press('Enter');

    const leftPane = window2.locator('#LeftPane');
    await leftPane
      .locator(`[data-testid="${bootstrap1.phone.device.aci}"]`)
      .click();

    await window2
      .locator(`.module-message__text >> "${messageBody}"`)
      .waitFor();
  });

  it('conceals a message sent with Invisible Ink until the recipient reveals it', async () => {
    const window1 = await app1.getWindow();
    const window2 = await app2.getWindow();
    await window1
      .locator(`#LeftPane [data-testid="${bootstrap2.phone.device.aci}"]`)
      .click();
    await window2
      .locator(`#LeftPane [data-testid="${bootstrap1.phone.device.aci}"]`)
      .click();

    const messageBody = 'A surprise for you 🎉 \u202E https://example.com';
    const compositionInput = await waitForEnabledComposer(window1);
    await typeIntoInput(compositionInput, messageBody, '');
    await window1.getByRole('button', { name: 'Send options' }).click({
      timeout: 5000,
    });
    await window1
      .getByRole('menuitem', { name: 'Send with Invisible Ink' })
      .click();

    const messageText = window2.locator('.module-message__text');
    const spoiler = messageText.getByRole('button', { name: 'Spoiler' });
    const concealedText = spoiler
      .locator('[aria-hidden="true"]')
      .getByText(messageBody);
    await expect(spoiler).toBeVisible();
    await expect(concealedText).toBeAttached();
    await expect(concealedText).toBeHidden();
    await spoiler.press('Enter');
    await expect(spoiler).toHaveCount(0);
    await expect(messageText.getByText(messageBody)).toBeVisible();
    await expect(messageText.getByRole('link')).toHaveCount(0);

    const nextMessage = 'This is a regular message';
    await expect(compositionInput).toBeFocused();
    await typeIntoInput(compositionInput, nextMessage, '');
    await compositionInput.press('Enter');
    await expect(messageText.getByText(nextMessage)).toBeVisible();
    await expect(
      messageText.locator('[data-spoiler]').filter({ hasText: nextMessage })
    ).toHaveCount(0);
  });

  it('omits a staged link preview when sending with Invisible Ink', async () => {
    const window1 = await app1.getWindow();
    const window2 = await app2.getWindow();
    await window1
      .locator(`#LeftPane [data-testid="${bootstrap2.phone.device.aci}"]`)
      .click();
    await window2
      .locator(`#LeftPane [data-testid="${bootstrap1.phone.device.aci}"]`)
      .click();

    const title = 'Surprise Party';
    const inviteLinkPassword = randomBytes(16);
    const group = await bootstrap1.phone.createGroup({
      title,
      members: [bootstrap1.phone],
      addFromInviteLink: Proto.AccessControl.AccessRequired.ANY,
      inviteLinkPassword,
    });
    const inviteCode = Buffer.from(
      SignalService.GroupInviteLink.encode({
        contents: {
          contentsV1: { groupMasterKey: group.masterKey, inviteLinkPassword },
        },
      })
    ).toString('base64url');
    const url = groupInvitesRoute.toWebUrl({ inviteCode }).toString();

    const compositionInput = await waitForEnabledComposer(window1);
    await typeIntoInput(compositionInput, `${url} is the invite`, '');
    await compositionInput.press('ControlOrMeta+Shift+K');
    await expect(
      window1.getByRole('button', { name: 'Send Message' })
    ).toBeVisible();
    await expect(
      window1.locator('.module-staged-link-preview').getByText(title)
    ).toBeVisible();
    await window1.getByRole('button', { name: 'Send options' }).click();
    await window1
      .getByRole('menuitem', { name: 'Send with Invisible Ink' })
      .click();

    await expect(
      window2.locator('.module-message__text').getByRole('button', {
        name: 'Spoiler',
      })
    ).toBeVisible();
    await expect(window2.locator('.module-message__link-preview')).toHaveCount(
      0
    );
  });
});
