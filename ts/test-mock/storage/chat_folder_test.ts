// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import Long from 'long';
import { v4 as generateUuid } from 'uuid';
import { Proto, StorageState } from '@signalapp/mock-server';
import { expect } from 'playwright/test';
import * as durations from '../../util/durations';
import type { App } from './fixtures';
import { Bootstrap, debug } from './fixtures';
import { uuidToBytes } from '../../util/uuidToBytes';
import { CHAT_FOLDER_DELETED_POSITION } from '../../types/ChatFolder';

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

  it('should update from storage service', async () => {
    const { phone } = bootstrap;
    const window = await app.getWindow();

    const openSettingsBtn = window.locator(
      '[data-testid="NavTabsItem--Settings"]'
    );
    const openChatsSettingsBtn = window.locator('.Preferences__button--chats');
    const openChatFoldersSettingsBtn = window.locator(
      '.Preferences__control:has-text("Add a chat folder")'
    );

    const ALL_CHATS_ID = generateUuid();
    const ALL_GROUPS_ID = generateUuid();
    const ALL_GROUPS_NAME = 'All Groups';
    const ALL_GROUPS_NAME_UPDATED = 'The Groups';

    const allChatsListItem = window.getByTestId(`ChatFolder--${ALL_CHATS_ID}`);
    const allGroupsListItem = window.getByTestId(
      `ChatFolder--${ALL_GROUPS_ID}`
    );

    await openSettingsBtn.click();
    await openChatsSettingsBtn.click();
    await openChatFoldersSettingsBtn.click();

    debug('adding ALL chat folder via storage service');
    {
      let state = await phone.expectStorageState('initial state');

      state = state.addRecord({
        type: IdentifierType.CHAT_FOLDER,
        record: {
          chatFolder: {
            id: uuidToBytes(ALL_CHATS_ID),
            folderType: Proto.ChatFolderRecord.FolderType.ALL,
            name: null,
            position: 0,
            showOnlyUnread: false,
            showMutedChats: false,
            includeAllIndividualChats: true,
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

      await expect(allChatsListItem).toBeVisible();
    }

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
        item => {
          return item.record.chatFolder?.name === ALL_GROUPS_NAME;
        },
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
        item => {
          return item.record.chatFolder?.name === ALL_GROUPS_NAME_UPDATED;
        },
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

    const openSettingsBtn = window.locator(
      '[data-testid="NavTabsItem--Settings"]'
    );
    const openChatsSettingsBtn = window.locator('.Preferences__button--chats');
    const openChatFoldersSettingsBtn = window.locator(
      '.Preferences__control:has-text("Add a chat folder")'
    );

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
      .getByTestId(
        'ConfirmationDialog.Preferences__EditChatFolderPage__DeleteChatFolderDialog'
      )
      .locator('button:has-text("Delete")');

    let state = await phone.expectStorageState('initial state');
    // wait for initial creation of story distribution list
    state = await phone.waitForStorageState({ after: state });

    debug('creating group');
    {
      await openSettingsBtn.click();
      await openChatsSettingsBtn.click();
      await openChatFoldersSettingsBtn.click();

      await groupPresetBtn.click();
      await expect(groupsFolderBtn).toBeVisible();

      debug('waiting for storage sync');
      state = await phone.waitForStorageState({ after: state });

      const found = state.hasRecord(item => {
        return (
          item.type === IdentifierType.CHAT_FOLDER &&
          item.record.chatFolder?.name === 'Groups'
        );
      });

      expect(found).toBe(true);
    }

    debug('updating group');
    {
      await groupsFolderBtn.click();
      await editChatFolderNameInput.fill('My Groups');
      await saveChatFolderBtn.click();

      debug('waiting for storage sync');
      state = await phone.waitForStorageState({ after: state });

      const found = state.hasRecord(item => {
        return (
          item.type === IdentifierType.CHAT_FOLDER &&
          item.record.chatFolder?.name === 'My Groups'
        );
      });

      expect(found).toBe(true);
    }

    debug('deleting group');
    {
      await groupsFolderBtn.click();
      await deleteChatFolderBtn.click();
      await confirmDeleteBtn.click();

      debug('waiting for storage sync');
      state = await phone.waitForStorageState({ after: state });

      const found = state.findRecord(item => {
        return (
          item.type === IdentifierType.CHAT_FOLDER &&
          item.record.chatFolder?.name === 'My Groups'
        );
      });

      await expect(groupsFolderBtn).not.toBeAttached();
      await expect(groupPresetBtn).toBeVisible();

      expect(
        found?.record.chatFolder?.deletedAtTimestampMs?.toNumber()
      ).toBeGreaterThan(0);
    }
  });
});
