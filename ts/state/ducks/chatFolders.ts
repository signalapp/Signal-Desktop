// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReadonlyDeep } from 'type-fest';
import { v4 as generateUuid } from 'uuid';
import type { ThunkAction } from 'redux-thunk';
import { throttle } from 'lodash';
import type { StateType as RootStateType } from '../reducer.js';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.js';
import { useBoundActions } from '../../hooks/useBoundActions.js';
import {
  ChatFolderParamsSchema,
  lookupCurrentChatFolder,
  toCurrentChatFolders,
  type ChatFolder,
  type ChatFolderId,
  type ChatFolderParams,
  type CurrentChatFolders,
} from '../../types/ChatFolder.js';
import { getCurrentChatFolders } from '../selectors/chatFolders.js';
import { DataReader, DataWriter } from '../../sql/Client.js';
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
const CHAT_FOLDER_CHANGE_SELECTED_CHAT_FOLDER_ID =
  'chatFolders/CHANGE_SELECTED_CHAT_FOLDER_ID';

export type ChatFolderRecordReplaceAll = ReadonlyDeep<{
  type: typeof CHAT_FOLDER_RECORD_REPLACE_ALL;
  payload: CurrentChatFolders;
}>;

export type ChatFolderChangeSelectedChatFolderId = ReadonlyDeep<{
  type: typeof CHAT_FOLDER_CHANGE_SELECTED_CHAT_FOLDER_ID;
  payload: ChatFolderId | null;
}>;

export type ChatFolderAction = ReadonlyDeep<
  ChatFolderRecordReplaceAll | ChatFolderChangeSelectedChatFolderId
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

function _refetchChatFolders(): ThunkAction<
  void,
  RootStateType,
  unknown,
  ChatFolderRecordReplaceAll
> {
  return async dispatch => {
    const chatFolders = await DataReader.getCurrentChatFolders();
    const currentChatFolders = toCurrentChatFolders(chatFolders);
    dispatch(replaceAllChatFolderRecords(currentChatFolders));
  };
}

// Note: 100ms is just the max amount of time before
// users start to perceive a delay
const refetchChatFolders = throttle(_refetchChatFolders, 100);

function createChatFolder(
  chatFolderParams: ChatFolderParams
): ThunkAction<void, RootStateType, unknown, never> {
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
    dispatch(_refetchChatFolders());
  };
}

function createAllChatsChatFolder(): ThunkAction<
  void,
  RootStateType,
  unknown,
  ChatFolderRecordReplaceAll
> {
  return async dispatch => {
    await DataWriter.createAllChatsChatFolder();
    storageServiceUploadJob({ reason: 'createAllChatsChatFolder' });
    dispatch(_refetchChatFolders());
  };
}

function updateChatFolder(
  chatFolderId: ChatFolderId,
  chatFolderParams: ChatFolderParams
): ThunkAction<void, RootStateType, unknown, never> {
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
    dispatch(_refetchChatFolders());
  };
}

function deleteChatFolder(
  chatFolderId: ChatFolderId
): ThunkAction<void, RootStateType, unknown, never> {
  return async dispatch => {
    await DataWriter.markChatFolderDeleted(chatFolderId, Date.now(), true);
    storageServiceUploadJob({ reason: 'deleteChatFolder' });
    dispatch(_refetchChatFolders());
    drop(chatFolderCleanupService.trigger('redux: deleted chat folder'));
  };
}

function updateChatFoldersPositions(
  chatFolderIds: ReadonlyArray<ChatFolderId>
): ThunkAction<void, RootStateType, unknown, never> {
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
    dispatch(_refetchChatFolders());
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
  refetchChatFolders,
  createChatFolder,
  createAllChatsChatFolder,
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
