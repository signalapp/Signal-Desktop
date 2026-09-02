// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Proto } from '@signalapp/mock-server';

import * as durations from '../../util/durations/index.std.ts';
import { initStorage } from './fixtures.node.ts';
import { debug } from './fixtures.node.ts';
import { constantTimeEqual, getRandomBytes } from '../../Crypto.node.ts';

import type { Bootstrap } from './fixtures.node.ts';
import type { App } from './fixtures.node.ts';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('storage service/delete', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    ({ bootstrap, app } = await initStorage());
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('should roundtrip records even if they were deleted when first discovered', async () => {
    const { phone, contacts } = bootstrap;

    const alice = contacts[0];
    assert.exists(alice);

    let state = await phone.expectStorageState('initial state');

    debug('adding deleted records to storage service via phone');
    const deletedAtTimestamp = BigInt(Date.now() + durations.DAY);

    const storyDistributionList = {
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      key: Buffer.from(getRandomBytes(16)),
      record: {
        // if deletedAtTimestamp is set, name and members should not be
        storyDistributionList: {
          identifier: getRandomBytes(16),
          name: null,
          deletedAtTimestamp,
          allowsReplies: null,
          isBlockList: null,
          recipientServiceIdsBinary: null,
        },
      },
    };
    state = state.addRecord(storyDistributionList);
    const stickerPack = {
      type: IdentifierType.STICKER_PACK,
      key: Buffer.from(getRandomBytes(16)),
      record: {
        stickerPack: {
          packId: getRandomBytes(16),
          packKey: getRandomBytes(32),
          position: 1,
          deletedAtTimestamp,
        },
      },
    };
    state = state.addRecord(stickerPack);
    const callLink = {
      type: IdentifierType.CALL_LINK,
      key: Buffer.from(getRandomBytes(16)),
      record: {
        // if deletedAtTimestampMs is set, adminPassKey should not be
        callLink: {
          rootKey: getRandomBytes(16),
          adminPasskey: null,
          deletedAtTimestampMs: deletedAtTimestamp,
        },
      },
    };
    state = state.addRecord(callLink);
    const chatFolder = {
      type: IdentifierType.CHAT_FOLDER,
      key: Buffer.from(getRandomBytes(16)),
      record: {
        chatFolder: {
          id: getRandomBytes(16),
          name: 'Chat Folder',
          position: 4294967295,
          showOnlyUnread: null,
          showMutedChats: null,
          includeAllIndividualChats: null,
          includeAllGroupChats: null,
          folderType: Proto.ChatFolderRecord.FolderType.CUSTOM,
          includedRecipients: null,
          excludedRecipients: null,
          deletedAtTimestampMs: deletedAtTimestamp,
        },
      },
    };
    state = state.addRecord(chatFolder);
    const notificationProfile = {
      type: IdentifierType.NOTIFICATION_PROFILE,
      key: Buffer.from(getRandomBytes(16)),
      record: {
        notificationProfile: {
          id: getRandomBytes(16),
          name: 'Notification Profile',
          emoji: null,
          color: null,
          createdAtMs: null,
          allowAllCalls: null,
          allowAllMentions: null,
          allowedMembers: null,
          scheduleEnabled: null,
          scheduleStartTime: null,
          scheduleEndTime: null,
          scheduleDaysEnabled: null,
          deletedAtTimestampMs: deletedAtTimestamp,
        },
      },
    };
    state = state.addRecord(notificationProfile);

    state = state.pin(alice);

    const updatedState = await phone.setStorageState(state);
    await phone.sendFetchStorage({
      timestamp: bootstrap.getTimestamp(),
    });

    debug('waiting for Desktop to pick up the change');
    await app.waitForManifestVersion(updatedState.version);

    const window = await app.getWindow();
    const conversationStack = window.locator('.Inbox__conversation-stack');

    const leftPane = window.locator('#LeftPane');

    debug('verifying that contact is pinned');
    await leftPane.locator(`[data-testid="${alice.device.aci}"]`).waitFor();

    debug('unpinning via desktop');
    {
      const convo = leftPane.getByTestId(alice.device.aci);
      await convo.click();

      const moreButton = conversationStack.getByRole('button', {
        name: 'More Info',
      });
      await moreButton.click();

      const pinButton = window.getByRole('menuitem', {
        name: 'Unpin chat',
        exact: true,
      });
      await pinButton.click();
    }

    debug("waiting for desktop's storage service update to get back to phone");

    const newState = await phone.waitForStorageState({
      after: updatedState,
      predicate: maybeState => !maybeState.isPinned(alice),
    });

    debug(
      "validating what's in storage service - deleted items should still be there"
    );

    assert.isTrue(
      newState.hasRecord(
        item =>
          constantTimeEqual(item.key, storyDistributionList.key) &&
          item.record.storyDistributionList?.deletedAtTimestamp ===
            storyDistributionList.record.storyDistributionList
              ?.deletedAtTimestamp
      ),
      'looking for deleted storyDistribution list'
    );
    assert.isTrue(
      newState.hasRecord(
        item =>
          constantTimeEqual(item.key, stickerPack.key) &&
          item.record.stickerPack?.deletedAtTimestamp ===
            stickerPack.record.stickerPack?.deletedAtTimestamp
      ),
      'looking for deleted stickerPack list'
    );
    assert.isTrue(
      newState.hasRecord(
        item =>
          constantTimeEqual(item.key, callLink.key) &&
          item.record.callLink?.deletedAtTimestampMs ===
            callLink.record.callLink?.deletedAtTimestampMs
      ),
      'looking for deleted callLink list'
    );
    assert.isTrue(
      newState.hasRecord(
        item =>
          constantTimeEqual(item.key, chatFolder.key) &&
          item.record.chatFolder?.deletedAtTimestampMs ===
            chatFolder.record.chatFolder?.deletedAtTimestampMs
      ),
      'looking for deleted chatFolder list'
    );
    assert.isTrue(
      newState.hasRecord(
        item =>
          constantTimeEqual(item.key, notificationProfile.key) &&
          item.record.notificationProfile?.deletedAtTimestampMs ===
            notificationProfile.record.notificationProfile?.deletedAtTimestampMs
      ),
      'looking for deleted notificationProfile list'
    );
  });

  it('should not restore records if they were deleted and removed from storage service', async () => {
    const { phone, contacts } = bootstrap;

    const alice = contacts[0];
    assert.exists(alice);

    let initialState = await phone.expectStorageState('initial state');

    debug('adding deleted records to storage service via phone');
    const deletedAtTimestamp = BigInt(Date.now() + durations.DAY);

    const storyDistributionList = {
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      key: Buffer.from(getRandomBytes(16)),
      record: {
        // if deletedAtTimestamp is set, name and members should not be
        storyDistributionList: {
          identifier: getRandomBytes(16),
          name: null,
          deletedAtTimestamp,
          allowsReplies: null,
          isBlockList: null,
          recipientServiceIdsBinary: null,
        },
      },
    };
    initialState = initialState.addRecord(storyDistributionList);
    const stickerPack = {
      type: IdentifierType.STICKER_PACK,
      key: Buffer.from(getRandomBytes(16)),
      record: {
        stickerPack: {
          packId: getRandomBytes(16),
          packKey: getRandomBytes(32),
          position: 1,
          deletedAtTimestamp,
        },
      },
    };
    initialState = initialState.addRecord(stickerPack);
    const callLink = {
      type: IdentifierType.CALL_LINK,
      key: Buffer.from(getRandomBytes(16)),
      record: {
        // if deletedAtTimestampMs is set, adminPassKey should not be
        callLink: {
          rootKey: getRandomBytes(16),
          adminPasskey: null,
          deletedAtTimestampMs: deletedAtTimestamp,
        },
      },
    };
    initialState = initialState.addRecord(callLink);
    const chatFolder = {
      type: IdentifierType.CHAT_FOLDER,
      key: Buffer.from(getRandomBytes(16)),
      record: {
        chatFolder: {
          id: getRandomBytes(16),
          name: 'Chat Folder',
          position: 4294967295,
          showOnlyUnread: null,
          showMutedChats: null,
          includeAllIndividualChats: null,
          includeAllGroupChats: null,
          folderType: Proto.ChatFolderRecord.FolderType.CUSTOM,
          includedRecipients: null,
          excludedRecipients: null,
          deletedAtTimestampMs: deletedAtTimestamp,
        },
      },
    };
    initialState = initialState.addRecord(chatFolder);
    const notificationProfile = {
      type: IdentifierType.NOTIFICATION_PROFILE,
      key: Buffer.from(getRandomBytes(16)),
      record: {
        notificationProfile: {
          id: getRandomBytes(16),
          name: 'Notification Profile',
          emoji: null,
          color: null,
          createdAtMs: null,
          allowAllCalls: null,
          allowAllMentions: null,
          allowedMembers: null,
          scheduleEnabled: null,
          scheduleStartTime: null,
          scheduleEndTime: null,
          scheduleDaysEnabled: null,
          deletedAtTimestampMs: deletedAtTimestamp,
        },
      },
    };
    initialState = initialState.addRecord(notificationProfile);

    initialState = initialState.pin(alice);

    const firstPhoneState = await phone.setStorageState(initialState);
    await phone.sendFetchStorage({
      timestamp: bootstrap.getTimestamp(),
    });

    debug('waiting for Desktop to pick up the first change');
    await app.waitForManifestVersion(firstPhoneState.version);

    const window = await app.getWindow();
    const conversationStack = window.locator('.Inbox__conversation-stack');

    const leftPane = window.locator('#LeftPane');

    debug('verifying that contact is pinned');
    await leftPane.locator(`[data-testid="${alice.device.aci}"]`).waitFor();

    debug('unpinning via desktop');
    {
      const convo = leftPane.getByTestId(alice.device.aci);
      await convo.click();

      const moreButton = conversationStack.getByRole('button', {
        name: 'More Info',
      });
      await moreButton.click();

      const pinButton = window.getByRole('menuitem', {
        name: 'Unpin chat',
        exact: true,
      });
      await pinButton.click();
    }

    debug("waiting for desktop's storage service update to get back to phone");

    let updateState = await phone.waitForStorageState({
      after: firstPhoneState,
      predicate: maybeState => !maybeState.isPinned(alice),
    });

    debug('now removing items from storage service via phone');

    updateState = updateState.removeRecord(
      item =>
        constantTimeEqual(item.key, storyDistributionList.key) &&
        item.record.storyDistributionList?.deletedAtTimestamp ===
          storyDistributionList.record.storyDistributionList?.deletedAtTimestamp
    );
    updateState = updateState.removeRecord(
      item =>
        constantTimeEqual(item.key, stickerPack.key) &&
        item.record.stickerPack?.deletedAtTimestamp ===
          stickerPack.record.stickerPack?.deletedAtTimestamp
    );
    updateState = updateState.removeRecord(
      item =>
        constantTimeEqual(item.key, callLink.key) &&
        item.record.callLink?.deletedAtTimestampMs ===
          callLink.record.callLink?.deletedAtTimestampMs
    );
    updateState = updateState.removeRecord(
      item =>
        constantTimeEqual(item.key, chatFolder.key) &&
        item.record.chatFolder?.deletedAtTimestampMs ===
          chatFolder.record.chatFolder?.deletedAtTimestampMs
    );
    updateState = updateState.removeRecord(
      item =>
        constantTimeEqual(item.key, notificationProfile.key) &&
        item.record.notificationProfile?.deletedAtTimestampMs ===
          notificationProfile.record.notificationProfile?.deletedAtTimestampMs
    );

    updateState = updateState.pin(alice);

    const secondPhoneState = await phone.setStorageState(updateState);
    await phone.sendFetchStorage({
      timestamp: bootstrap.getTimestamp(),
    });

    debug('waiting for Desktop to pick up the second change');
    await app.waitForManifestVersion(secondPhoneState.version);

    debug('verifying that contact is pinned');
    await leftPane.locator(`[data-testid="${alice.device.aci}"]`).waitFor();

    debug('unpinning via desktop');
    {
      const convo = leftPane.getByTestId(alice.device.aci);
      await convo.click();

      const moreButton = conversationStack.getByRole('button', {
        name: 'More Info',
      });
      await moreButton.click();

      const pinButton = window.getByRole('menuitem', {
        name: 'Unpin chat',
        exact: true,
      });
      await pinButton.click();
    }

    debug("waiting for desktop's storage service update to get back to phone");

    const thirdPhoneState = await phone.waitForStorageState({
      after: secondPhoneState,
      predicate: maybeState => !maybeState.isPinned(alice),
    });

    debug(
      "validating what's in storage service - deleted items should be removed"
    );

    assert.isFalse(
      thirdPhoneState.hasRecord(item => {
        const itemId = item.record.storyDistributionList?.identifier;
        const expectedId =
          storyDistributionList.record.storyDistributionList?.identifier;

        if (!itemId || !expectedId) {
          return false;
        }
        return constantTimeEqual(itemId, expectedId);
      }),
      "don't want to find deleted storyDistribution list"
    );
    assert.isFalse(
      thirdPhoneState.hasRecord(item => {
        const itemId = item.record.stickerPack?.packId;
        const expectedId = stickerPack.record.stickerPack?.packId;

        if (!itemId || !expectedId) {
          return false;
        }
        return constantTimeEqual(itemId, expectedId);
      }),
      "don't want to find deleted stickerPack list"
    );
    assert.isFalse(
      thirdPhoneState.hasRecord(item => {
        const itemId = item.record.callLink?.rootKey;
        const expectedId = callLink.record.callLink?.rootKey;

        if (!itemId || !expectedId) {
          return false;
        }
        return constantTimeEqual(itemId, expectedId);
      }),
      "don't want to find deleted callLink list"
    );
    assert.isFalse(
      thirdPhoneState.hasRecord(item => {
        const itemId = item.record.chatFolder?.id;
        const expectedId = chatFolder.record.chatFolder?.id;

        if (!itemId || !expectedId) {
          return false;
        }
        return constantTimeEqual(itemId, expectedId);
      }),
      "don't want to find deleted chatFolder list"
    );
    assert.isFalse(
      thirdPhoneState.hasRecord(item => {
        const itemId = item.record.notificationProfile?.id;
        const expectedId = notificationProfile.record.notificationProfile?.id;

        if (!itemId || !expectedId) {
          return false;
        }
        return constantTimeEqual(itemId, expectedId);
      }),
      "don't want to find deleted notificationProfile list"
    );
  });
});
