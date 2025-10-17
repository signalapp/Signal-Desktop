// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer.preload.js';
import type { GlobalModalsStateType } from '../ducks/globalModals.preload.js';
import { UsernameOnboardingState } from '../../types/globalModals.std.js';

export const getGlobalModalsState = (state: StateType): GlobalModalsStateType =>
  state.globalModals;

export const isShowingAnyModal = createSelector(
  getGlobalModalsState,
  (globalModalsState): boolean =>
    Object.entries(globalModalsState).some(([key, value]) => {
      if (key === 'usernameOnboardingState') {
        return value === UsernameOnboardingState.Open;
      }

      return Boolean(value);
    })
);

export const getCallLinkEditModalRoomId = createSelector(
  getGlobalModalsState,
  ({ callLinkEditModalRoomId }) => callLinkEditModalRoomId
);

export const getCallLinkAddNameModalRoomId = createSelector(
  getGlobalModalsState,
  ({ callLinkAddNameModalRoomId }) => callLinkAddNameModalRoomId
);

export const getCallLinkPendingParticipantContactId = createSelector(
  getGlobalModalsState,
  ({ callLinkPendingParticipantContactId }) =>
    callLinkPendingParticipantContactId
);

export const getConfirmLeaveCallModalState = createSelector(
  getGlobalModalsState,
  ({ confirmLeaveCallModalState }) => confirmLeaveCallModalState
);

export const getContactModalState = createSelector(
  getGlobalModalsState,
  ({ contactModalState }) => contactModalState
);

export const getIsStoriesSettingsVisible = createSelector(
  getGlobalModalsState,
  ({ isStoriesSettingsVisible }) => isStoriesSettingsVisible
);

export const getSafetyNumberChangedBlockingData = createSelector(
  getGlobalModalsState,
  ({ safetyNumberChangedBlockingData }) => safetyNumberChangedBlockingData
);

export const getDeleteMessagesProps = createSelector(
  getGlobalModalsState,
  ({ deleteMessagesProps }) => deleteMessagesProps
);

export const getDraftGifMessageSendModalProps = createSelector(
  getGlobalModalsState,
  ({ draftGifMessageSendModalProps }) => draftGifMessageSendModalProps
);

export const getEditHistoryMessages = createSelector(
  getGlobalModalsState,
  ({ editHistoryMessages }) => editHistoryMessages
);

export const getForwardMessagesProps = createSelector(
  getGlobalModalsState,
  ({ forwardMessagesProps }) => forwardMessagesProps
);

export const getEditNicknameAndNoteModalProps = createSelector(
  getGlobalModalsState,
  ({ editNicknameAndNoteModalProps }) => editNicknameAndNoteModalProps
);

export const getNotePreviewModalProps = createSelector(
  getGlobalModalsState,
  ({ notePreviewModalProps }) => notePreviewModalProps
);
