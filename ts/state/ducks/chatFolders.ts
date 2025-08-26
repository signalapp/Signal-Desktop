// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReadonlyDeep } from 'type-fest';
import { v4 as generateUuid } from 'uuid';
import type { ThunkAction } from 'redux-thunk';
import type { StateType as RootStateType } from '../reducer';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import {
  ChatFolderParamsSchema,
  type ChatFolder,
  type ChatFolderId,
  type ChatFolderParams,
} from '../../types/ChatFolder';
import { getCurrentChatFolders } from '../selectors/chatFolders';
import { DataWriter } from '../../sql/Client';
import { strictAssert } from '../../util/assert';
import { storageServiceUploadJob } from '../../services/storage';
import { parseStrict } from '../../util/schemas';
import { chatFolderCleanupService } from '../../services/expiring/chatFolderCleanupService';
import { drop } from '../../util/drop';

export type ChatFoldersState = ReadonlyDeep<{
  currentChatFolders: ReadonlyArray<ChatFolder>;
}>;

const CHAT_FOLDER_RECORD_ADD = 'chatFolders/RECORD_ADD';
const CHAT_FOLDER_RECORD_REPLACE = 'chatFolders/RECORD_REPLACE';
const CHAT_FOLDER_RECORD_REMOVE = 'chatFolders/RECORD_REMOVE';

export type ChatFolderRecordAdd = ReadonlyDeep<{
  type: typeof CHAT_FOLDER_RECORD_ADD;
  payload: ChatFolder;
}>;

export type ChatFolderRecordReplace = ReadonlyDeep<{
  type: typeof CHAT_FOLDER_RECORD_REPLACE;
  payload: ChatFolder;
}>;

export type ChatFolderRecordRemove = ReadonlyDeep<{
  type: typeof CHAT_FOLDER_RECORD_REMOVE;
  payload: ChatFolderId;
}>;

export type ChatFolderAction = ReadonlyDeep<
  ChatFolderRecordAdd | ChatFolderRecordReplace | ChatFolderRecordRemove
>;

export function getEmptyState(): ChatFoldersState {
  return {
    currentChatFolders: [],
  };
}

function addChatFolderRecord(chatFolder: ChatFolder): ChatFolderRecordAdd {
  return {
    type: CHAT_FOLDER_RECORD_ADD,
    payload: chatFolder,
  };
}

function replaceChatFolderRecord(
  chatFolder: ChatFolder
): ChatFolderRecordReplace {
  return {
    type: CHAT_FOLDER_RECORD_REPLACE,
    payload: chatFolder,
  };
}

function removeChatFolderRecord(
  chatFolderId: ChatFolderId
): ChatFolderRecordRemove {
  return {
    type: CHAT_FOLDER_RECORD_REMOVE,
    payload: chatFolderId,
  };
}

function createChatFolder(
  chatFolderParams: ChatFolderParams
): ThunkAction<void, RootStateType, unknown, ChatFolderRecordAdd> {
  return async (dispatch, getState) => {
    const chatFolders = getCurrentChatFolders(getState());

    const chatFolder: ChatFolder = {
      ...chatFolderParams,
      id: generateUuid() as ChatFolderId,
      position: chatFolders.length,
      deletedAtTimestampMs: 0,
      storageID: null,
      storageVersion: null,
      storageUnknownFields: null,
      storageNeedsSync: true,
    };

    await DataWriter.createChatFolder(chatFolder);
    storageServiceUploadJob({ reason: 'createChatFolder' });
    dispatch(addChatFolderRecord(chatFolder));
  };
}

function updateChatFolder(
  chatFolderId: ChatFolderId,
  chatFolderParams: ChatFolderParams
): ThunkAction<void, RootStateType, unknown, ChatFolderRecordReplace> {
  return async (dispatch, getState) => {
    const chatFolders = getCurrentChatFolders(getState());

    const prevChatFolder = chatFolders.find(chatFolder => {
      return chatFolder.id === chatFolderId;
    });
    strictAssert(prevChatFolder != null, 'Missing chat folder');

    const nextChatFolder: ChatFolder = {
      ...prevChatFolder,
      ...parseStrict(ChatFolderParamsSchema, chatFolderParams),
      storageNeedsSync: true,
    };

    await DataWriter.updateChatFolder(nextChatFolder);
    storageServiceUploadJob({ reason: 'updateChatFolder' });
    dispatch(replaceChatFolderRecord(nextChatFolder));
  };
}

function deleteChatFolder(
  chatFolderId: ChatFolderId
): ThunkAction<void, RootStateType, unknown, ChatFolderRecordRemove> {
  return async dispatch => {
    await DataWriter.markChatFolderDeleted(chatFolderId, Date.now(), true);
    storageServiceUploadJob({ reason: 'deleteChatFolder' });
    dispatch(removeChatFolderRecord(chatFolderId));
    drop(chatFolderCleanupService.trigger('redux: deleted chat folder'));
  };
}

export const actions = {
  addChatFolderRecord,
  replaceChatFolderRecord,
  removeChatFolderRecord,
  createChatFolder,
  updateChatFolder,
  deleteChatFolder,
};

export const useChatFolderActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function toSortedChatFolders(
  chatFolders: ReadonlyArray<ChatFolder>
): ReadonlyArray<ChatFolder> {
  return chatFolders.toSorted((a, b) => a.position - b.position);
}

export function reducer(
  state: ChatFoldersState = getEmptyState(),
  action: ChatFolderAction
): ChatFoldersState {
  switch (action.type) {
    case CHAT_FOLDER_RECORD_ADD:
      return {
        ...state,
        currentChatFolders: toSortedChatFolders([
          ...state.currentChatFolders,
          action.payload,
        ]),
      };
    case CHAT_FOLDER_RECORD_REPLACE:
      return {
        ...state,
        currentChatFolders: toSortedChatFolders(
          state.currentChatFolders.map(chatFolder => {
            return chatFolder.id === action.payload.id
              ? action.payload
              : chatFolder;
          })
        ),
      };
    case CHAT_FOLDER_RECORD_REMOVE:
      return {
        ...state,
        currentChatFolders: toSortedChatFolders(
          state.currentChatFolders.filter(chatFolder => {
            return chatFolder.id !== action.payload;
          })
        ),
      };
    default:
      return state;
  }
}
