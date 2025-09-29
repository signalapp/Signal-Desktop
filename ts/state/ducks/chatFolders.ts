// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReadonlyDeep } from 'type-fest';
import { v4 as generateUuid } from 'uuid';
import type { ThunkAction } from 'redux-thunk';
import type { StateType as RootStateType } from '../reducer.js';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.js';
import { useBoundActions } from '../../hooks/useBoundActions.js';
import {
  ChatFolderParamsSchema,
  lookupCurrentChatFolder,
  toCurrentChatFolders,
  getSortedCurrentChatFolders,
  type ChatFolder,
  type ChatFolderId,
  type ChatFolderParams,
  type CurrentChatFolders,
} from '../../types/ChatFolder.js';
import { getCurrentChatFolders } from '../selectors/chatFolders.js';
import { DataWriter } from '../../sql/Client.js';
import { storageServiceUploadJob } from '../../services/storage.js';
import { parseStrict } from '../../util/schemas.js';
import { chatFolderCleanupService } from '../../services/expiring/chatFolderCleanupService.js';
import { drop } from '../../util/drop.js';
import {
  TARGETED_CONVERSATION_CHANGED,
  type TargetedConversationChangedActionType,
} from './conversations.js';

export type ChatFoldersState = ReadonlyDeep<{
  currentChatFolders: CurrentChatFolders;
  selectedChatFolderId: ChatFolderId | null;
  stableSelectedConversationIdInChatFolder: string | null;
}>;

const CHAT_FOLDER_RECORD_REPLACE_ALL =
  'chatFolders/CHAT_FOLDER_RECORD_REPLACE_ALL';
const CHAT_FOLDER_RECORD_ADD = 'chatFolders/RECORD_ADD';
const CHAT_FOLDER_RECORD_REPLACE = 'chatFolders/RECORD_REPLACE';
const CHAT_FOLDER_RECORD_REMOVE = 'chatFolders/RECORD_REMOVE';
const CHAT_FOLDER_CHANGE_SELECTED_CHAT_FOLDER_ID =
  'chatFolders/CHANGE_SELECTED_CHAT_FOLDER_ID';

export type ChatFolderRecordReplaceAll = ReadonlyDeep<{
  type: typeof CHAT_FOLDER_RECORD_REPLACE_ALL;
  payload: CurrentChatFolders;
}>;

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

export type ChatFolderChangeSelectedChatFolderId = ReadonlyDeep<{
  type: typeof CHAT_FOLDER_CHANGE_SELECTED_CHAT_FOLDER_ID;
  payload: ChatFolderId | null;
}>;

export type ChatFolderAction = ReadonlyDeep<
  | ChatFolderRecordReplaceAll
  | ChatFolderRecordAdd
  | ChatFolderRecordReplace
  | ChatFolderRecordRemove
  | ChatFolderChangeSelectedChatFolderId
>;

export function getEmptyState(): ChatFoldersState {
  return {
    currentChatFolders: {
      order: [],
      lookup: {},
    },
    selectedChatFolderId: null,
    stableSelectedConversationIdInChatFolder: null,
  };
}

function replaceAllChatFolderRecords(
  currentChatFolders: CurrentChatFolders
): ChatFolderRecordReplaceAll {
  return {
    type: CHAT_FOLDER_RECORD_REPLACE_ALL,
    payload: currentChatFolders,
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
      position: chatFolders.order.length,
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
    const currentChatFolders = getCurrentChatFolders(getState());

    const prevChatFolder = lookupCurrentChatFolder(
      currentChatFolders,
      chatFolderId
    );

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

function updateChatFoldersPositions(
  chatFolderIds: ReadonlyArray<ChatFolderId>
): ThunkAction<void, RootStateType, unknown, ChatFolderRecordReplaceAll> {
  return async (dispatch, getState) => {
    const currentChatFolders = getCurrentChatFolders(getState());
    const chatFolders = chatFolderIds.map((chatFolderId, index) => {
      const chatFolder = lookupCurrentChatFolder(
        currentChatFolders,
        chatFolderId
      );
      return { ...chatFolder, position: index + 1 };
    });
    await DataWriter.updateChatFolderPositions(chatFolders);
    storageServiceUploadJob({ reason: 'updateChatFoldersPositions' });
    dispatch(replaceAllChatFolderRecords(toCurrentChatFolders(chatFolders)));
  };
}

function updateSelectedChangeFolderId(
  chatFolderId: ChatFolderId | null
): ChatFolderChangeSelectedChatFolderId {
  return {
    type: CHAT_FOLDER_CHANGE_SELECTED_CHAT_FOLDER_ID,
    payload: chatFolderId,
  };
}

export const actions = {
  replaceAllChatFolderRecords,
  addChatFolderRecord,
  replaceChatFolderRecord,
  removeChatFolderRecord,
  createChatFolder,
  updateChatFolder,
  deleteChatFolder,
  updateChatFoldersPositions,
  updateSelectedChangeFolderId,
};

export const useChatFolderActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function reducer(
  state: ChatFoldersState = getEmptyState(),
  action: ChatFolderAction | TargetedConversationChangedActionType
): ChatFoldersState {
  switch (action.type) {
    case CHAT_FOLDER_RECORD_REPLACE_ALL:
      return {
        ...state,
        currentChatFolders: action.payload,
      };
    case CHAT_FOLDER_RECORD_ADD:
      return {
        ...state,
        currentChatFolders: toCurrentChatFolders([
          ...getSortedCurrentChatFolders(state.currentChatFolders),
          action.payload,
        ]),
      };
    case CHAT_FOLDER_RECORD_REPLACE:
      return {
        ...state,
        currentChatFolders: toCurrentChatFolders([
          ...getSortedCurrentChatFolders(state.currentChatFolders).filter(
            chatFolder => {
              return chatFolder.id !== action.payload.id;
            }
          ),
          action.payload,
        ]),
      };
    case CHAT_FOLDER_RECORD_REMOVE:
      return {
        ...state,
        currentChatFolders: toCurrentChatFolders(
          getSortedCurrentChatFolders(state.currentChatFolders).filter(
            chatFolder => {
              return chatFolder.id !== action.payload;
            }
          )
        ),
      };
    case CHAT_FOLDER_CHANGE_SELECTED_CHAT_FOLDER_ID:
      return {
        ...state,
        selectedChatFolderId: action.payload,
        stableSelectedConversationIdInChatFolder: null,
      };
    case TARGETED_CONVERSATION_CHANGED:
      return {
        ...state,
        stableSelectedConversationIdInChatFolder:
          action.payload.conversationId ?? null,
      };
    default:
      return state;
  }
}
