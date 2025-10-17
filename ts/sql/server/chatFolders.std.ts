// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { v4 as generateUuid } from 'uuid';
import {
  type ChatFolderId,
  type ChatFolder,
  CHAT_FOLDER_DELETED_POSITION,
  CHAT_FOLDER_DEFAULTS,
  ChatFolderType,
} from '../../types/ChatFolder.std.js';
import type { ReadableDB, WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';
import { strictAssert } from '../../util/assert.std.js';
import type { CurrentChatFolder } from '../../types/CurrentChatFolders.std.js';
import { isCurrentChatFolder } from '../../types/CurrentChatFolders.std.js';

export type ChatFolderRow = Readonly<
  Omit<
    ChatFolder,
    | 'showOnlyUnread'
    | 'showMutedChats'
    | 'includeAllIndividualChats'
    | 'includeAllGroupChats'
    | 'includedConversationIds'
    | 'excludedConversationIds'
    | 'storageNeedsSync'
  > & {
    showOnlyUnread: 0 | 1;
    showMutedChats: 0 | 1;
    includeAllIndividualChats: 0 | 1;
    includeAllGroupChats: 0 | 1;
    includedConversationIds: string;
    excludedConversationIds: string;
    storageNeedsSync: 0 | 1;
  }
>;

function chatFolderToRow(chatFolder: ChatFolder): ChatFolderRow {
  return {
    ...chatFolder,
    showOnlyUnread: chatFolder.showOnlyUnread ? 1 : 0,
    showMutedChats: chatFolder.showMutedChats ? 1 : 0,
    includeAllIndividualChats: chatFolder.includeAllIndividualChats ? 1 : 0,
    includeAllGroupChats: chatFolder.includeAllGroupChats ? 1 : 0,
    includedConversationIds: JSON.stringify(chatFolder.includedConversationIds),
    excludedConversationIds: JSON.stringify(chatFolder.excludedConversationIds),
    storageNeedsSync: chatFolder.storageNeedsSync ? 1 : 0,
  };
}

function rowToChatFolder(chatFolderRow: ChatFolderRow): ChatFolder {
  return {
    ...chatFolderRow,
    showOnlyUnread: chatFolderRow.showOnlyUnread === 1,
    showMutedChats: chatFolderRow.showMutedChats === 1,
    includeAllIndividualChats: chatFolderRow.includeAllIndividualChats === 1,
    includeAllGroupChats: chatFolderRow.includeAllGroupChats === 1,
    includedConversationIds: JSON.parse(chatFolderRow.includedConversationIds),
    excludedConversationIds: JSON.parse(chatFolderRow.excludedConversationIds),
    storageNeedsSync: chatFolderRow.storageNeedsSync === 1,
  };
}

export function getAllChatFolders(db: ReadableDB): ReadonlyArray<ChatFolder> {
  const [query, params] = sql`
    SELECT * FROM chatFolders
  `;
  return db
    .prepare(query)
    .all<ChatFolderRow>(params)
    .map(row => rowToChatFolder(row));
}

export function getCurrentChatFolders(
  db: ReadableDB
): ReadonlyArray<CurrentChatFolder> {
  const [query, params] = sql`
    SELECT *
    FROM chatFolders
    WHERE folderType IS NOT ${ChatFolderType.UNKNOWN}
    AND deletedAtTimestampMs IS 0
    ORDER BY position ASC
  `;
  return db
    .prepare(query)
    .all<ChatFolderRow>(params)
    .map(row => {
      const chatFolder = rowToChatFolder(row);
      strictAssert(
        isCurrentChatFolder(chatFolder),
        `Query returned row that is not a current chat folder (${chatFolder.id})`
      );
      return chatFolder;
    });
}

export function getChatFolder(
  db: ReadableDB,
  chatFolderId: ChatFolderId
): ChatFolder | null {
  const [query, params] = sql`
    SELECT * FROM chatFolders
    WHERE id = ${chatFolderId};
  `;
  const row = db.prepare(query).get<ChatFolderRow>(params);
  if (row == null) {
    return null;
  }
  return rowToChatFolder(row);
}

function _insertChatFolder(db: WritableDB, chatFolder: ChatFolder): void {
  const chatFolderRow = chatFolderToRow(chatFolder);
  const [chatFolderQuery, chatFolderParams] = sql`
    INSERT INTO chatFolders (
      id,
      folderType,
      name,
      position,
      showOnlyUnread,
      showMutedChats,
      includeAllIndividualChats,
      includeAllGroupChats,
      includedConversationIds,
      excludedConversationIds,
      deletedAtTimestampMs,
      storageID,
      storageVersion,
      storageUnknownFields,
      storageNeedsSync
    ) VALUES (
      ${chatFolderRow.id},
      ${chatFolderRow.folderType},
      ${chatFolderRow.name},
      ${chatFolderRow.position},
      ${chatFolderRow.showOnlyUnread},
      ${chatFolderRow.showMutedChats},
      ${chatFolderRow.includeAllIndividualChats},
      ${chatFolderRow.includeAllGroupChats},
      ${chatFolderRow.includedConversationIds},
      ${chatFolderRow.excludedConversationIds},
      ${chatFolderRow.deletedAtTimestampMs},
      ${chatFolderRow.storageID},
      ${chatFolderRow.storageVersion},
      ${chatFolderRow.storageUnknownFields},
      ${chatFolderRow.storageNeedsSync}
    )
  `;
  db.prepare(chatFolderQuery).run(chatFolderParams);
}

export function createChatFolder(db: WritableDB, chatFolder: ChatFolder): void {
  return db.transaction(() => {
    _insertChatFolder(db, chatFolder);
  })();
}

export function hasAllChatsChatFolder(db: ReadableDB): boolean {
  const [query, params] = sql`
    SELECT EXISTS (
      SELECT 1 FROM chatFolders
      WHERE folderType IS ${ChatFolderType.ALL}
      AND deletedAtTimestampMs IS 0
      LIMIT 1
    )
  `;
  const result = db.prepare(query, { pluck: true }).get<number>(params);
  return result === 1;
}

export function createAllChatsChatFolder(db: WritableDB): ChatFolder {
  return db.transaction(() => {
    const allChatsChatFolder: ChatFolder = {
      ...CHAT_FOLDER_DEFAULTS,
      id: generateUuid() as ChatFolderId,
      folderType: ChatFolderType.ALL,
      position: 0,
      deletedAtTimestampMs: 0,
      storageID: null,
      storageVersion: null,
      storageUnknownFields: null,
      storageNeedsSync: true,
    };

    // shift all positions over 1
    _resetAllChatFolderPositions(db, 1);
    _insertChatFolder(db, allChatsChatFolder);

    return allChatsChatFolder;
  })();
}

export function upsertAllChatsChatFolderFromSync(
  db: WritableDB,
  chatFolder: ChatFolder
): void {
  return db.transaction(() => {
    strictAssert(
      chatFolder.folderType === ChatFolderType.ALL,
      'Chat folder must have folderType=ALL'
    );

    if (hasAllChatsChatFolder(db)) {
      const chatFolderRow = chatFolderToRow(chatFolder);
      const [query, params] = sql`
        UPDATE chatFolders
        SET
          id = ${chatFolderRow.id},
          position = ${chatFolderRow.position},
          storageID = ${chatFolderRow.storageID},
          storageVersion = ${chatFolderRow.storageVersion},
          storageUnknownFields = ${chatFolderRow.storageUnknownFields},
          storageNeedsSync = ${chatFolderRow.storageNeedsSync}
        WHERE
          folderType = ${ChatFolderType.ALL}
      `;
      db.prepare(query).run(params);
    } else {
      _insertChatFolder(db, chatFolder);
    }
  })();
}

export function updateChatFolder(db: WritableDB, chatFolder: ChatFolder): void {
  const chatFolderRow = chatFolderToRow(chatFolder);
  const [chatFolderQuery, chatFolderParams] = sql`
    UPDATE chatFolders
    SET
      id = ${chatFolderRow.id},
      folderType = ${chatFolderRow.folderType},
      name = ${chatFolderRow.name},
      position = ${chatFolderRow.position},
      showOnlyUnread = ${chatFolderRow.showOnlyUnread},
      showMutedChats = ${chatFolderRow.showMutedChats},
      includeAllIndividualChats = ${chatFolderRow.includeAllIndividualChats},
      includeAllGroupChats = ${chatFolderRow.includeAllGroupChats},
      includedConversationIds = ${chatFolderRow.includedConversationIds},
      excludedConversationIds = ${chatFolderRow.excludedConversationIds},
      deletedAtTimestampMs = ${chatFolderRow.deletedAtTimestampMs},
      storageID = ${chatFolderRow.storageID},
      storageVersion = ${chatFolderRow.storageVersion},
      storageUnknownFields = ${chatFolderRow.storageUnknownFields},
      storageNeedsSync = ${chatFolderRow.storageNeedsSync}
    WHERE
      id = ${chatFolderRow.id}
  `;
  db.prepare(chatFolderQuery).run(chatFolderParams);
}

export function updateChatFolderToggleChat(
  db: WritableDB,
  chatFolderId: ChatFolderId,
  conversationId: string,
  toggle: boolean
): void {
  return db.transaction(() => {
    const chatFolder = getChatFolder(db, chatFolderId);
    strictAssert(
      chatFolder != null,
      `Missing chat folder for id: ${chatFolderId}`
    );

    const included = new Set<string>(chatFolder.includedConversationIds);
    const excluded = new Set<string>(chatFolder.excludedConversationIds);

    if (toggle) {
      // add
      included.add(conversationId);
      excluded.delete(conversationId);
    } else {
      // remove
      included.delete(conversationId);
      excluded.add(conversationId);
    }

    updateChatFolder(db, {
      ...chatFolder,
      includedConversationIds: Array.from(included),
      excludedConversationIds: Array.from(excluded),
      storageNeedsSync: true,
    });
  })();
}

const EMPTY_ARRAY = JSON.stringify([]);

export function markChatFolderDeleted(
  db: WritableDB,
  id: ChatFolderId,
  deletedAtTimestampMs: number,
  storageNeedsSync: boolean
): void {
  return db.transaction(() => {
    const [query, params] = sql`
      UPDATE chatFolders
      SET
        position = ${CHAT_FOLDER_DELETED_POSITION},
        deletedAtTimestampMs = ${deletedAtTimestampMs},
        storageNeedsSync = ${storageNeedsSync ? 1 : 0},
        includedConversationIds = ${EMPTY_ARRAY},
        excludedConversationIds = ${EMPTY_ARRAY}
      WHERE id = ${id}
    `;
    db.prepare(query).run(params);
    _resetAllChatFolderPositions(db, 0);
  })();
}

function _resetAllChatFolderPositions(db: WritableDB, offset: number) {
  const [query, params] = sql`
    SELECT id FROM chatFolders
    WHERE deletedAtTimestampMs IS 0
    ORDER BY position ASC
  `;

  db.prepare(query, { pluck: true })
    .all<ChatFolderId>(params)
    .forEach((id, index) => {
      const [update, updateParams] = sql`
        UPDATE chatFolders
        SET
          position = ${offset + index},
          storageNeedsSync = 1
        WHERE id = ${id}
      `;
      db.prepare(update).run(updateParams);
    });
}

export function updateChatFolderPositions(
  db: WritableDB,
  chatFolders: ReadonlyArray<ChatFolder>
): void {
  return db.transaction(() => {
    for (const chatFolder of chatFolders) {
      const [query, params] = sql`
        UPDATE chatFolders
        SET
          position = ${chatFolder.position},
          storageNeedsSync = 1
        WHERE id = ${chatFolder.id}
      `;
      db.prepare(query).run(params);
    }
  })();
}

export function updateChatFolderDeletedAtTimestampMsFromSync(
  db: WritableDB,
  chatFolderId: ChatFolderId,
  deletedAtTimestampMs: number
): void {
  return db.transaction(() => {
    const [update, updateParams] = sql`
      UPDATE chatFolders
      SET deletedAtTimestampMs = ${deletedAtTimestampMs}
      WHERE id = ${chatFolderId}
    `;
    db.prepare(update).run(updateParams);
  })();
}

export function getOldestDeletedChatFolder(db: ReadableDB): ChatFolder | null {
  const [query, params] = sql`
    SELECT *
    FROM chatFolders
    WHERE deletedAtTimestampMs > 0
    ORDER BY deletedAtTimestampMs ASC
    LIMIT 1
  `;
  const row = db.prepare(query).get<ChatFolderRow>(params);
  if (row == null) {
    return null;
  }
  return rowToChatFolder(row);
}

export function deleteExpiredChatFolders(
  db: WritableDB,
  messageQueueTime: number
): ReadonlyArray<ChatFolderId> {
  const before = Date.now() - messageQueueTime;
  const [query, params] = sql`
    DELETE FROM chatFolders
    WHERE deletedAtTimestampMs > 0
      AND deletedAtTimestampMs < ${before}
    RETURNING id
  `;
  return db.prepare(query, { pluck: true }).all<ChatFolderId>(params);
}
