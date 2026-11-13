// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import type { PrimaryDevice } from '@signalapp/mock-server';
import { StorageState } from '@signalapp/mock-server';
import { assert } from 'chai';

import type { App } from '../playwright.node.ts';
import { Bootstrap } from '../bootstrap.node.ts';
import { MINUTE } from '../../util/durations/index.std.ts';
import {
  clickOnConversation,
  getLeftPane,
  getMessageInTimelineByTimestamp,
} from '../helpers.node.ts';

export const debug = createDebug('mock:test:closeConversation');

describe('close conversation', function (this: Mocha.Suite) {
  let bootstrap: Bootstrap;
  let app: App;

  this.timeout(MINUTE);
  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { phone, contacts } = bootstrap;
    const [alice] = contacts as [PrimaryDevice];
    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
    });

    state = state.addContact(alice, {
      identityKey: alice.publicKey.serialize(),
      profileKey: alice.profileKey.serialize(),
      whitelisted: true,
    });
    state = state.pin(alice);

    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('closes the selected conversation when it is clicked in the left pane', async () => {
    const { contacts } = bootstrap;
    const [alice] = contacts as [PrimaryDevice];

    const window = await app.getWindow();
    const selectedRow = getLeftPane(window).locator(
      `[data-testid="${alice.device.aci}"]` +
        '.module-conversation-list__item--contact-or-conversation--is-selected'
    );
    const conversationTitle = window.locator(
      '.module-ConversationHeader__header__info__title',
      { hasText: alice.profileName }
    );
    const noConversationOpen = window.locator('.Inbox__no-conversation-open');

    debug('opening the conversation');
    await clickOnConversation(window, alice);
    await conversationTitle.waitFor();
    await selectedRow.waitFor();

    debug('clicking the selected conversation closes it');
    await clickOnConversation(window, alice);
    await noConversationOpen.waitFor();
    await selectedRow.waitFor({ state: 'detached' });
    assert.isFalse(await conversationTitle.isVisible());

    debug('clicking it again reopens it');
    await clickOnConversation(window, alice);
    await conversationTitle.waitFor();
    await selectedRow.waitFor();
  });

  it('closes the panel first when the selected conversation has one open', async () => {
    const { contacts } = bootstrap;
    const [alice] = contacts as [PrimaryDevice];

    const window = await app.getWindow();
    const conversationStack = window.locator('.Inbox__conversation-stack');
    const panelBackButton = conversationStack.locator(
      '.ConversationPanel__header__back-button'
    );
    const conversationHero = window.getByTestId('conversation-hero');
    const noConversationOpen = window.locator('.Inbox__no-conversation-open');

    debug('opening chat settings');
    await clickOnConversation(window, alice);
    await conversationStack.getByRole('button', { name: 'More Info' }).click();
    await window.getByRole('menuitem', { name: 'Chat settings' }).click();
    await panelBackButton.waitFor();

    debug('clicking the selected conversation goes back to it');
    await clickOnConversation(window, alice);
    await panelBackButton.waitFor({ state: 'hidden' });
    await conversationHero.waitFor();
    assert.isFalse(await noConversationOpen.isVisible());

    debug('clicking it again closes it');
    await clickOnConversation(window, alice);
    await noConversationOpen.waitFor();
  });

  it('leaves select mode first when messages are being selected', async () => {
    const { contacts, desktop } = bootstrap;
    const [alice] = contacts as [PrimaryDevice];

    const window = await app.getWindow();
    const timestamp = bootstrap.getTimestamp();
    const message = getMessageInTimelineByTimestamp(window, timestamp);
    const selectModeActions = window.locator('.SelectModeActions');
    const noConversationOpen = window.locator('.Inbox__no-conversation-open');

    debug('selecting a message');
    await alice.sendText(desktop, 'Hello from Alice', { timestamp });
    await getLeftPane(window).getByText('Hello from Alice').waitFor();
    await clickOnConversation(window, alice);
    await message.getByText('Hello from Alice').click({ button: 'right' });
    await window.getByRole('menuitem', { name: 'Select' }).click();
    await selectModeActions.waitFor();

    debug('clicking the selected conversation leaves select mode');
    await clickOnConversation(window, alice);
    await selectModeActions.waitFor({ state: 'hidden' });
    await message.waitFor();
    assert.isFalse(await noConversationOpen.isVisible());

    debug('clicking it again closes it');
    await clickOnConversation(window, alice);
    await noConversationOpen.waitFor();
  });

  it('keeps the selected conversation open when it is chosen from New chat', async () => {
    const { contacts } = bootstrap;
    const [alice] = contacts as [PrimaryDevice];

    const window = await app.getWindow();
    const leftPane = getLeftPane(window);
    const composeSearchInput = leftPane.locator(
      '.module-left-pane__compose-search-form .module-SearchInput__input'
    );
    const conversationTitle = window.locator(
      '.module-ConversationHeader__header__info__title',
      { hasText: alice.profileName }
    );

    debug('opening the conversation');
    await clickOnConversation(window, alice);
    await conversationTitle.waitFor();

    debug('choosing the same contact from New chat');
    await window.getByRole('button', { name: 'New chat' }).click();
    await composeSearchInput.fill(alice.profileName);
    await leftPane.locator('.ListTile', { hasText: alice.profileName }).click();

    debug('the composer closes and the conversation stays open');
    await composeSearchInput.waitFor({ state: 'hidden' });
    assert.isTrue(await conversationTitle.isVisible());
    assert.isFalse(
      await window.locator('.Inbox__no-conversation-open').isVisible()
    );
  });
});
