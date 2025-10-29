// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReadonlyDeep } from 'type-fest';
import { v4 as generateUuid } from 'uuid';
import type { ThunkAction } from 'redux-thunk';
import { throttle } from 'lodash';
import type { StateType as RootStateType } from '../reducer.preload.js';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.js';
import { useBoundActions } from '../../hooks/useBoundActions.std.js';
import {
  ChatFolderParamsSchema,
  isConversationInChatFolder,
  type ChatFolder,
  type ChatFolderId,
  type ChatFolderParams,
} from '../../types/ChatFolder.std.js';
import {
  getCurrentChatFolders,
  getSelectedChatFolder,
} from '../selectors/chatFolders.std.js';
import { DataReader, DataWriter } from '../../sql/Client.preload.js';
import { storageServiceUploadJob } from '../../services/storage.preload.js';
import { parseStrict } from '../../util/schemas.std.js';
import { chatFolderCleanupService } from '../../services/expiring/chatFolderCleanupService.preload.js';
import { drop } from '../../util/drop.std.js';
import type { ShowToastActionType } from './toast.preload.js';
import { showToast } from './toast.preload.js';
import { ToastType } from '../../types/Toast.dom.js';
import type { CurrentChatFolder } from '../../types/CurrentChatFolders.std.js';
import { CurrentChatFolders } from '../../types/CurrentChatFolders.std.js';
import { getConversationLookup } from '../selectors/conversations.dom.js';
import { getOwn } from '../../util/getOwn.std.js';
import { strictAssert } from '../../util/assert.std.js';

export type ChatFoldersState = ReadonlyDeep<{
  currentChatFolders: CurrentChatFolders;
  selectedChatFolderId: ChatFolderId | null;
  stableSelectedConversationIdInChatFolder: string | null;
}>;

const CHAT_FOLDER_RECORD_REPLACE_ALL =
  'chatFolders/CHAT_FOLDER_RECORD_REPLACE_ALL';
const CHAT_FOLDER_UPDATE_SELECTED_CHAT_FOLDER_ID =
  'chatFolders/UPDATE_SELECTED_CHAT_FOLDER_ID';
const CHAT_FOLDER_UPDATE_STABLE_SELECTED_CONVERSATION_ID_IN_CHAT_FOLDER =
  'chatFolders/CHAT_FOLDER_UPDATE_STABLE_SELECTED_CONVERSATION_ID_IN_CHAT_FOLDER';

export type ChatFolderRecordReplaceAll = ReadonlyDeep<{
  type: typeof CHAT_FOLDER_RECORD_REPLACE_ALL;
  payload: CurrentChatFolders;
}>;

export type ChatFolderUpdateSelectedChatFolderId = ReadonlyDeep<{
  type: typeof CHAT_FOLDER_UPDATE_SELECTED_CHAT_FOLDER_ID;
  payload: ChatFolderId | null;
}>;

export type ChatFolderUpdateStableConversationIdInChatFolder = ReadonlyDeep<{
  type: typeof CHAT_FOLDER_UPDATE_STABLE_SELECTED_CONVERSATION_ID_IN_CHAT_FOLDER;
  payload: string | null;
}>;

export type ChatFolderAction = ReadonlyDeep<
  | ChatFolderRecordReplaceAll
  | ChatFolderUpdateSelectedChatFolderId
  | ChatFolderUpdateStableConversationIdInChatFolder
>;

export function getEmptyState(): ChatFoldersState {
  return {
    currentChatFolders: CurrentChatFolders.createEmpty(),
    selectedChatFolderId: null,
    stableSelectedConversationIdInChatFolder: null,
  };
}

export function getInitialChatFoldersState(
  chatFolders: ReadonlyArray<CurrentChatFolder>
): ChatFoldersState {
  return toNextChatFoldersState(getEmptyState(), {
    currentChatFolders: CurrentChatFolders.fromArray(chatFolders),
  });
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
    const currentChatFolders = CurrentChatFolders.fromArray(chatFolders);
    dispatch(replaceAllChatFolderRecords(currentChatFolders));
  };
}

// Note: 100ms is just the max amount of time before
// users start to perceive a delay
const refetchChatFolders = throttle(_refetchChatFolders, 100);

function createChatFolder(
  chatFolderParams: ChatFolderParams,
  showToastOnSuccess: boolean
): ThunkAction<void, RootStateType, unknown, ShowToastActionType> {
  return async (dispatch, getState) => {
    const currentChatFolders = getCurrentChatFolders(getState());
    const size = CurrentChatFolders.size(currentChatFolders);

    const chatFolder: ChatFolder = {
      ...chatFolderParams,
      id: generateUuid() as ChatFolderId,
      position: size,
      deletedAtTimestampMs: 0,
      storageID: null,
      storageVersion: null,
      storageUnknownFields: null,
      storageNeedsSync: true,
    };

    await DataWriter.createChatFolder(chatFolder);
    storageServiceUploadJob({ reason: 'createChatFolder' });
    dispatch(_refetchChatFolders());

    if (showToastOnSuccess) {
      dispatch(
        showToast({
          toastType: ToastType.ChatFolderCreated,
          parameters: { chatFolderName: chatFolder.name },
        })
      );
    }
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

    const prevChatFolder = CurrentChatFolders.expect(
      currentChatFolders,
      chatFolderId,
      'updateChatFolder'
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
      const chatFolder = CurrentChatFolders.expect(
        currentChatFolders,
        chatFolderId,
        'updateChatFoldersPositions'
      );
      return { ...chatFolder, position: index + 1 };
    });
    await DataWriter.updateChatFolderPositions(chatFolders);
    storageServiceUploadJob({ reason: 'updateChatFoldersPositions' });
    dispatch(_refetchChatFolders());
  };
}

function updateSelectedChatFolderId(
  chatFolderId: ChatFolderId | null
): ChatFolderUpdateSelectedChatFolderId {
  return {
    type: CHAT_FOLDER_UPDATE_SELECTED_CHAT_FOLDER_ID,
    payload: chatFolderId,
  };
}

function updateStableSelectedConversationIdInChatFolder(
  conversationId: string | null
): ChatFolderUpdateStableConversationIdInChatFolder {
  return {
    type: CHAT_FOLDER_UPDATE_STABLE_SELECTED_CONVERSATION_ID_IN_CHAT_FOLDER,
    payload: conversationId,
  };
}

function updateChatFolderToggleChat(
  chatFolderId: ChatFolderId,
  conversationId: string,
  toggle: boolean,
  showToastOnSuccess: boolean
): ThunkAction<void, RootStateType, unknown, ShowToastActionType> {
  return async (dispatch, getState) => {
    const currentChatFolders = getCurrentChatFolders(getState());
    const chatFolder = CurrentChatFolders.expect(
      currentChatFolders,
      chatFolderId,
      'updateChatFolderToggleChat'
    );

    await DataWriter.updateChatFolderToggleChat(
      chatFolderId,
      conversationId,
      toggle
    );
    storageServiceUploadJob({ reason: 'toggleChatFolderChat' });
    dispatch(_refetchChatFolders());

    if (showToastOnSuccess) {
      dispatch(
        showToast({
          toastType: toggle
            ? ToastType.ChatFolderAddedChat
            : ToastType.ChatFolderRemovedChat,
          parameters: { chatFolderName: chatFolder.name },
        })
      );
    }
  };
}

export function updateChatFolderStateOnTargetConversationChanged(
  conversationId: string | undefined
): ThunkAction<
  void,
  RootStateType,
  unknown,
  | ChatFolderUpdateSelectedChatFolderId
  | ChatFolderUpdateStableConversationIdInChatFolder
> {
  return async (dispatch, getState) => {
    if (conversationId == null) {
      // Clear out the stable conversation id since it has been closed.
      dispatch(updateStableSelectedConversationIdInChatFolder(null));
      return;
    }

    const state = getState();
    const selectedChatFolder = getSelectedChatFolder(state);
    if (selectedChatFolder == null) {
      return;
    }

    const conversationLookup = getConversationLookup(state);
    const conversation = getOwn(conversationLookup, conversationId);
    strictAssert(conversation != null, 'Target conversation not found');

    if (isConversationInChatFolder(selectedChatFolder, conversation)) {
      // Make sure the targetted conversation doesn't appear from the chat folder
      // while its open (in case it gets marked read for example).
      dispatch(updateStableSelectedConversationIdInChatFolder(conversationId));
      return;
    }

    const currentChatFolders = getCurrentChatFolders(state);
    const { currentAllChatFolder } = currentChatFolders;

    dispatch(updateSelectedChatFolderId(currentAllChatFolder?.id ?? null));
    dispatch(updateStableSelectedConversationIdInChatFolder(conversationId));
  };
}

export const actions = {
  refetchChatFolders,
  createChatFolder,
  createAllChatsChatFolder,
  updateChatFolder,
  deleteChatFolder,
  updateChatFoldersPositions,
  updateSelectedChatFolderId,
  updateChatFolderToggleChat,
};

export const useChatFolderActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function getDefaultSelectedChatFolderId(
  currentChatFolders: CurrentChatFolders
): ChatFolderId | null {
  // Default to the first chat folder in the list rather than "All chats"
  return CurrentChatFolders.at(currentChatFolders, 0)?.id ?? null;
}

function toNextChatFoldersState(
  prevState: ChatFoldersState,
  changes: Partial<ChatFoldersState>
): ChatFoldersState {
  const nextState = { ...prevState, ...changes };

  // Ensure that the `selectedChatFolderId` is not referencing a chat folder
  // that is no longer current
  if (nextState.selectedChatFolderId != null) {
    const isSelectedChatFolderIdCurrent = CurrentChatFolders.has(
      nextState.currentChatFolders,
      nextState.selectedChatFolderId
    );

    if (!isSelectedChatFolderIdCurrent) {
      nextState.selectedChatFolderId = null;
    }
  }

  // Ensure `selectedChatFolderId` is set if `currentChatFolders` isnt empty
  // Components should still handle if `selectedChatFolderId` is `null` though
  // But some of them could assume they should render "All chats"
  nextState.selectedChatFolderId ??= getDefaultSelectedChatFolderId(
    nextState.currentChatFolders
  );

  // Ensure `stableSelectedConversationIdInChatFolder`
  // is reset if `selectedChatFolderId` is null or has been changed
  if (
    nextState.selectedChatFolderId == null ||
    nextState.selectedChatFolderId !== prevState.selectedChatFolderId
  ) {
    nextState.stableSelectedConversationIdInChatFolder = null;
  }

  return nextState;
}

export function reducer(
  state: ChatFoldersState = getEmptyState(),
  action: ChatFolderAction
): ChatFoldersState {
  switch (action.type) {
    case CHAT_FOLDER_RECORD_REPLACE_ALL:
      return toNextChatFoldersState(state, {
        currentChatFolders: action.payload,
      });
    case CHAT_FOLDER_UPDATE_SELECTED_CHAT_FOLDER_ID:
      return toNextChatFoldersState(state, {
        selectedChatFolderId: action.payload,
      });
    case CHAT_FOLDER_UPDATE_STABLE_SELECTED_CONVERSATION_ID_IN_CHAT_FOLDER:
      return toNextChatFoldersState(state, {
        stableSelectedConversationIdInChatFolder: action.payload,
      });
    default:
      return state;
  }
}
