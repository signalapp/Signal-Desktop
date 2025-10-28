// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import Long from 'long';
import { v4 as generateUuid } from 'uuid';
import { Proto, StorageState } from '@signalapp/mock-server';
import type { Page } from 'playwright/test';
import { expect } from 'playwright/test';
import type { StorageStateNewRecord } from '@signalapp/mock-server/src/api/storage-state.js';
import * as durations from '../../util/durations/index.std.js';
import type { App } from './fixtures.node.js';
import {
  Bootstrap,
  debug,
  getChatFolderRecordPredicate,
} from './fixtures.node.js';
import { bytesToUuid, uuidToBytes } from '../../util/uuidToBytes.std.js';
import { CHAT_FOLDER_DELETED_POSITION } from '../../types/ChatFolder.std.js';
import { strictAssert } from '../../util/assert.std.js';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

const ALL_CHATS_PREDICATE = getChatFolderRecordPredicate('ALL', '', false);

async function openChatFolderSettings(window: Page) {
  const openSettingsBtn = window.getByRole('tab', { name: 'Settings' });
  const openChatsSettingsBtn = window
    .getByRole('tabpanel', { name: 'Settings' })
    .getByRole('navigation')
    .getByRole('button', { name: 'Chats' });
  const openChatFoldersSettingsBtn = window
    .getByRole('group', { name: 'Chat folders' })
    .getByRole('button', { name: 'Set up' });

  await openSettingsBtn.click();
  await openChatsSettingsBtn.click();
  await openChatFoldersSettingsBtn.click();
}

function countAllChatsInStorageState(state: StorageState): number {
  return state.filterRecords(ALL_CHATS_PREDICATE).length;
}

function getAllChatsListItem(window: Page) {
  return window
    .getByTestId('ChatFoldersList')
    .locator('.Preferences__ChatFolders__ChatSelection__Item')
    .getByText('All chats');
}

function getGroupsPresetAddButton(window: Page) {
  return window
    .getByTestId('ChatFolderPreset--GroupChats')
    .locator('button:has-text("Add")');
}

function createAllChatsRecord(id: string): StorageStateNewRecord {
  return {
    type: IdentifierType.CHAT_FOLDER,
    record: {
      chatFolder: {
        id: uuidToBytes(id),
        folderType: Proto.ChatFolderRecord.FolderType.ALL,
        name: '',
        position: 0,
        showOnlyUnread: false,
        showMutedChats: false,
        includeAllIndividualChats: false,
        includeAllGroupChats: true,
        includedRecipients: [],
        excludedRecipients: [],
        deletedAtTimestampMs: Long.fromNumber(0),
      },
    },
  };
}

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

    const ALL_GROUPS_ID = generateUuid();
    const ALL_GROUPS_NAME = 'All Groups';
    const ALL_GROUPS_NAME_UPDATED = 'The Groups';

    const allChatsListItem = getAllChatsListItem(window);

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
      await expect(allGroupsListItem).toContainText(ALL_GROUPS_NAME);
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
      await expect(allGroupsListItem).toContainText(ALL_GROUPS_NAME_UPDATED);
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

    const allChatsListItem = getAllChatsListItem(window);
    const groupPresetBtn = getGroupsPresetAddButton(window);

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

    let state = await phone.expectStorageState('initial state');
    expect(state.version).toBe(1);
    expect(state.hasRecord(ALL_CHATS_PREDICATE)).toBe(false);

    // wait for initial creation of story distribution list and "all chats" chat folder
    state = await phone.waitForStorageState({ after: state });
    expect(state.version).toBe(2);
    expect(state.hasRecord(ALL_CHATS_PREDICATE)).toBe(true);

    await openChatFolderSettings(window);
    const allChatsListItem = getAllChatsListItem(window);
    const groupPresetAddButton = getGroupsPresetAddButton(window);

    // update record
    state = state.removeRecord(ALL_CHATS_PREDICATE);
    state = await phone.setStorageState(state);
    expect(state.version).toBe(3);
    expect(state.hasRecord(ALL_CHATS_PREDICATE)).toBe(false);

    // sync from phone to app
    await phone.sendFetchStorage({ timestamp: bootstrap.getTimestamp() });
    await app.waitForManifestVersion(state.version);

    await expect(allChatsListItem).toBeVisible();

    // Trigger another storage upload
    await groupPresetAddButton.click();
    state = await phone.waitForStorageState({ after: state });

    expect(state.version).toBe(4);
    expect(state.hasRecord(ALL_CHATS_PREDICATE)).toBe(true);
  });

  it('should remove duplicate all chats folders from storage service', async () => {
    const { phone } = bootstrap;
    const window = await app.getWindow();

    let state = await phone.expectStorageState('initial state');
    // wait for initial creation of story distribution list and "all chats" chat folder
    state = await phone.waitForStorageState({ after: state });

    expect(countAllChatsInStorageState(state)).toBe(1);

    await openChatFolderSettings(window);
    const allChatsListItem = getAllChatsListItem(window);
    const groupPresetAddButton = getGroupsPresetAddButton(window);

    const ONE = generateUuid();
    const TWO = generateUuid();

    state = state.addRecord(createAllChatsRecord(ONE));
    state = state.addRecord(createAllChatsRecord(TWO));

    state = await phone.setStorageState(state);
    await phone.sendFetchStorage({ timestamp: bootstrap.getTimestamp() });
    await app.waitForManifestVersion(state.version);

    expect(countAllChatsInStorageState(state)).toBe(3);

    // It should not have created two "all chats" folders
    await expect(allChatsListItem).toHaveCount(1);

    // Trigger another storage upload
    await groupPresetAddButton.click();
    state = await phone.waitForStorageState({ after: state });

    // App should have removed one of the "all chats" folders
    expect(countAllChatsInStorageState(state)).toBe(1);

    // Make sure we took the updated id
    const item = state.findRecord(ALL_CHATS_PREDICATE);
    const idBytes = item?.record.chatFolder?.id;
    strictAssert(idBytes != null, 'Missing all chats record with id');
    const id = bytesToUuid(idBytes);
    strictAssert(id != null, 'All chats record id was not valid uuid');

    // Records are processed concurrently so it could be either id
    expect([ONE, TWO].includes(id)).toBe(true);
  });
});
