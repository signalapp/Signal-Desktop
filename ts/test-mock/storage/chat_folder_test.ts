// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import Long from 'long';
import { v4 as generateUuid } from 'uuid';
import { Proto, StorageState } from '@signalapp/mock-server';
import type { Page } from 'playwright/test';
import { expect } from 'playwright/test';
import * as durations from '../../util/durations/index.js';
import type { App } from './fixtures.js';
import { Bootstrap, debug, getChatFolderRecordPredicate } from './fixtures.js';
import { uuidToBytes } from '../../util/uuidToBytes.js';
import { CHAT_FOLDER_DELETED_POSITION } from '../../types/ChatFolder.js';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('storage service/chat folders', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 0 });
    await bootstrap.init();

    const { phone } = bootstrap;

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
    });

    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    if (app) {
      await app.close();
    }
    await bootstrap.teardown();
  });

  async function openChatFolderSettings(window: Page) {
    const openSettingsBtn = window.locator(
      '[data-testid="NavTabsItem--Settings"]'
    );
    const openChatsSettingsBtn = window.locator('.Preferences__button--chats');
    const openChatFoldersSettingsBtn = window.locator(
      '.Preferences__control:has-text("Add a chat folder")'
    );

    await openSettingsBtn.click();
    await openChatsSettingsBtn.click();
    await openChatFoldersSettingsBtn.click();
  }

  it('should update from storage service', async () => {
    const { phone } = bootstrap;
    const window = await app.getWindow();

    const ALL_CHATS_PREDICATE = getChatFolderRecordPredicate('ALL', '', false);

    const ALL_GROUPS_ID = generateUuid();
    const ALL_GROUPS_NAME = 'All Groups';
    const ALL_GROUPS_NAME_UPDATED = 'The Groups';

    const allChatsListItem = window
      .getByTestId('ChatFoldersList')
      .locator('.Preferences__ChatFolders__ChatSelection__Item')
      .getByText('All chats');

    const allGroupsListItem = window.getByTestId(
      `ChatFolder--${ALL_GROUPS_ID}`
    );

    {
      let state = await phone.expectStorageState('initial state');
      // wait for initial creation of story distribution list and "all chats" chat folder
      state = await phone.waitForStorageState({ after: state });
      expect(state.hasRecord(ALL_CHATS_PREDICATE)).toBe(true);
    }

    await openChatFolderSettings(window);

    debug('expect all chats folder to be created');
    await expect(allChatsListItem).toBeVisible();

    debug('adding "All Groups" chat folder via storage service');
    {
      let state = await phone.expectStorageState('adding all groups');

      state = state.addRecord({
        type: IdentifierType.CHAT_FOLDER,
        record: {
          chatFolder: {
            id: uuidToBytes(ALL_GROUPS_ID),
            folderType: Proto.ChatFolderRecord.FolderType.CUSTOM,
            name: ALL_GROUPS_NAME,
            position: 1,
            showOnlyUnread: false,
            showMutedChats: false,
            includeAllIndividualChats: false,
            includeAllGroupChats: true,
            includedRecipients: [],
            excludedRecipients: [],
            deletedAtTimestampMs: Long.fromNumber(0),
          },
        },
      });

      await phone.setStorageState(state);
      await phone.sendFetchStorage({ timestamp: bootstrap.getTimestamp() });
      await app.waitForManifestVersion(state.version);

      await expect(allGroupsListItem).toBeVisible();
      await expect(allGroupsListItem).toHaveText(ALL_GROUPS_NAME);
    }

    debug('updating "All Groups" chat folder via storage service');
    {
      let state = await phone.expectStorageState('updating all groups');

      state = state.updateRecord(
        getChatFolderRecordPredicate('CUSTOM', ALL_GROUPS_NAME, false),
        item => {
          return {
            ...item,
            chatFolder: {
              ...item.chatFolder,
              name: ALL_GROUPS_NAME_UPDATED,
            },
          };
        }
      );

      await phone.setStorageState(state);
      await phone.sendFetchStorage({ timestamp: bootstrap.getTimestamp() });
      await app.waitForManifestVersion(state.version);

      await expect(allChatsListItem).toBeVisible();
      await expect(allGroupsListItem).toBeVisible();
      await expect(allGroupsListItem).toHaveText(ALL_GROUPS_NAME_UPDATED);
    }

    debug('removing "All Groups" chat folder via storage service');
    {
      let state = await phone.expectStorageState('removing all groups');

      state = state.updateRecord(
        getChatFolderRecordPredicate('CUSTOM', ALL_GROUPS_NAME_UPDATED, false),
        item => {
          return {
            ...item,
            chatFolder: {
              ...item.chatFolder,
              position: CHAT_FOLDER_DELETED_POSITION,
              deletedAtTimestampMs: Long.fromNumber(Date.now()),
            },
          };
        }
      );

      await phone.setStorageState(state);
      await phone.sendFetchStorage({ timestamp: bootstrap.getTimestamp() });
      await app.waitForManifestVersion(state.version);

      await expect(allChatsListItem).toBeVisible();
      await expect(allGroupsListItem).not.toBeAttached();
    }
  });

  it('should upload to storage service', async () => {
    const { phone } = bootstrap;
    const window = await app.getWindow();

    const ALL_CHATS_PREDICATE = getChatFolderRecordPredicate('ALL', '', false);

    const allChatsListItem = window
      .getByTestId('ChatFoldersList')
      .locator('.Preferences__ChatFolders__ChatSelection__Item')
      .getByText('All chats');

    const groupPresetBtn = window
      .getByTestId('ChatFolderPreset--GroupChats')
      .locator('button:has-text("Add")');

    const groupsFolderBtn = window
      .getByTestId('ChatFoldersList')
      .locator('.Preferences__ChatFolders__ChatSelection__Item')
      .getByText('Groups');

    const editChatFolderNameInput = window
      .getByTestId('EditChatFolderName')
      .locator('input');
    const saveChatFolderBtn = window.locator(
      '.Preferences__actions button:has-text("Save")'
    );
    const deleteChatFolderBtn = window.locator(
      '.Preferences__ChatFolders__ChatList__DeleteButton'
    );

    const confirmDeleteBtn = window
      .getByTestId('ConfirmationDialog.Preferences__DeleteChatFolderDialog')
      .locator('button:has-text("Delete")');

    let state = await phone.expectStorageState('initial state');
    // wait for initial creation of story distribution list and "all chats" chat folder
    state = await phone.waitForStorageState({ after: state });
    expect(state.hasRecord(ALL_CHATS_PREDICATE)).toBe(true);

    await openChatFolderSettings(window);

    debug('expect all chats folder to be created');
    await expect(allChatsListItem).toBeVisible();

    debug('creating group');
    {
      await groupPresetBtn.click();
      await expect(groupsFolderBtn).toBeVisible();

      debug('waiting for storage sync');
      state = await phone.waitForStorageState({ after: state });

      const found = state.hasRecord(
        getChatFolderRecordPredicate('CUSTOM', 'Groups', false)
      );

      expect(found).toBe(true);
    }

    debug('updating group');
    {
      await groupsFolderBtn.click();
      await editChatFolderNameInput.fill('My Groups');
      await saveChatFolderBtn.click();

      debug('waiting for storage sync');
      state = await phone.waitForStorageState({ after: state });

      const found = state.hasRecord(
        getChatFolderRecordPredicate('CUSTOM', 'My Groups', false)
      );

      expect(found).toBe(true);
    }

    debug('deleting group');
    {
      await groupsFolderBtn.click();
      await deleteChatFolderBtn.click();
      await confirmDeleteBtn.click();

      debug('waiting for storage sync');
      state = await phone.waitForStorageState({ after: state });

      const found = state.findRecord(
        getChatFolderRecordPredicate('CUSTOM', 'My Groups', true)
      );

      await expect(groupsFolderBtn).not.toBeAttached();
      await expect(groupPresetBtn).toBeVisible();

      expect(
        found?.record.chatFolder?.deletedAtTimestampMs?.toNumber()
      ).toBeGreaterThan(0);
    }
  });

  it('should recover from all chats folder being deleted', async () => {
    const { phone } = bootstrap;
    const window = await app.getWindow();

    const ALL_CHATS_PREDICATE = getChatFolderRecordPredicate('ALL', '', false);

    let state = await phone.expectStorageState('initial state');
    expect(state.version).toBe(1);
    expect(state.hasRecord(ALL_CHATS_PREDICATE)).toBe(false);

    // wait for initial creation of story distribution list and "all chats" chat folder
    state = await phone.waitForStorageState({ after: state });
    expect(state.version).toBe(2);
    expect(state.hasRecord(ALL_CHATS_PREDICATE)).toBe(true);

    await openChatFolderSettings(window);

    // update record
    state = state.updateRecord(ALL_CHATS_PREDICATE, item => {
      return {
        ...item,
        chatFolder: {
          ...item.chatFolder,
          position: CHAT_FOLDER_DELETED_POSITION,
          deletedAtTimestampMs: Long.fromNumber(Date.now()),
        },
      };
    });
    state = await phone.setStorageState(state);
    expect(state.version).toBe(3);
    expect(state.hasRecord(ALL_CHATS_PREDICATE)).toBe(false);

    // sync from phone to app
    await phone.sendFetchStorage({ timestamp: bootstrap.getTimestamp() });
    await app.waitForManifestVersion(state.version);

    // wait for app to insert a new "All chats" chat folder
    state = await phone.waitForStorageState({ after: state });
    expect(state.version).toBe(4);
    expect(state.hasRecord(ALL_CHATS_PREDICATE)).toBe(true);
  });
});
