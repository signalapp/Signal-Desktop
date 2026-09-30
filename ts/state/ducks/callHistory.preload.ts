// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import lodash from 'lodash';
import type { StateType as RootStateType } from '../reducer.preload.ts';
import {
  clearCallHistoryDataAndSync,
  markAllCallHistoryReadAndSync,
  markCallHistoryReadWithoutSync,
} from '../../util/callDisposition.preload.ts';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import type { ToastActionType } from './toast.preload.ts';
import { showToast } from './toast.preload.ts';
import { DataReader } from '../../sql/Client.preload.ts';
import { ToastType } from '../../types/Toast.dom.tsx';
import {
  ClearCallHistoryResult,
  type CallHistoryDetails,
} from '../../types/CallDisposition.std.ts';
import { createLogger } from '../../logging/log.std.ts';
import * as Errors from '../../types/errors.std.ts';
import {
  getCallHistoryLatestCall,
  getCallHistorySelector,
} from '../selectors/callHistory.std.ts';
import {
  getCallsHistoryForRedux,
  getCallsHistoryUnreadCountsByConversationIdForRedux,
  loadCallHistory,
} from '../../services/callHistoryLoader.preload.ts';
import { makeLookup } from '../../util/makeLookup.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { getIntl } from '../selectors/user.std.ts';
import type { ShowErrorModalActionType } from './globalModals.preload.ts';
import { SHOW_ERROR_MODAL } from './globalModals.preload.ts';
import type { ErrorModalDataProps } from '../../components/ErrorModal.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';

const { debounce, omit } = lodash;

const log = createLogger('callHistory');

export type CallHistoryState = ReadonlyDeep<{
  // This informs the app that underlying call history data has changed.
  edition: number;
  unreadCountsByConversationId: Record<string, number>;
  callHistoryByCallId: Record<string, CallHistoryDetails>;
}>;

const CALL_HISTORY_ADD = 'callHistory/ADD';
const CALL_HISTORY_REMOVE = 'callHistory/REMOVE';
const CALL_HISTORY_RESET = 'callHistory/RESET';
const CALL_HISTORY_RELOAD = 'callHistory/RELOAD';
const CALL_HISTORY_UPDATE_UNREAD = 'callHistory/UPDATE_UNREAD';

export type CallHistoryAdd = ReadonlyDeep<{
  type: typeof CALL_HISTORY_ADD;
  payload: CallHistoryDetails;
}>;

export type CallHistoryRemove = ReadonlyDeep<{
  type: typeof CALL_HISTORY_REMOVE;
  payload: CallHistoryDetails['callId'];
}>;

export type CallHistoryReset = ReadonlyDeep<{
  type: typeof CALL_HISTORY_RESET;
}>;

export type CallHistoryReload = ReadonlyDeep<{
  type: typeof CALL_HISTORY_RELOAD;
  payload: {
    callsHistory: ReadonlyArray<CallHistoryDetails>;
    callsHistoryUnreadCountsByConversationId: Record<string, number>;
  };
}>;

export type CallHistoryUpdateUnread = ReadonlyDeep<{
  type: typeof CALL_HISTORY_UPDATE_UNREAD;
  payload: Record<string, number>;
}>;

export type CallHistoryAction = ReadonlyDeep<
  | CallHistoryAdd
  | CallHistoryRemove
  | CallHistoryReset
  | CallHistoryReload
  | CallHistoryUpdateUnread
>;

export function getEmptyState(): CallHistoryState {
  return {
    edition: 0,
    unreadCountsByConversationId: {},
    callHistoryByCallId: {},
  };
}

const updateCallHistoryUnreadCountDebounced = debounce(
  async (
    dispatch: ThunkDispatch<RootStateType, unknown, CallHistoryUpdateUnread>
  ) => {
    try {
      const unreadCountsByConversationId =
        await DataReader.getCallHistoryUnreadCountsByConversationId();
      dispatch({
        type: CALL_HISTORY_UPDATE_UNREAD,
        payload: unreadCountsByConversationId,
      });
    } catch (error) {
      log.error(
        'Error updating call history unread count',
        Errors.toLogFormat(error)
      );
    }
  },
  300
);

function updateConversationsUnreadCounts(
  conversationIdsOrConversationPeerIds: ReadonlyArray<string>
) {
  for (const id of conversationIdsOrConversationPeerIds) {
    const conversation = window.ConversationController.get(id);
    strictAssert(conversation, `Missing conversation: ${id}`);
    conversation.throttledUpdateUnread();
  }
}

function updateCallHistoryUnreadCount(
  conversationIdsOrConversationPeerIds: ReadonlyArray<string>
): ThunkAction<void, RootStateType, unknown, CallHistoryUpdateUnread> {
  return async dispatch => {
    updateConversationsUnreadCounts(conversationIdsOrConversationPeerIds);
    await updateCallHistoryUnreadCountDebounced(dispatch);
  };
}

function markCallHistoryRead(
  callId: string
): ThunkAction<void, RootStateType, unknown, CallHistoryUpdateUnread> {
  return async () => {
    await markCallHistoryReadWithoutSync({
      mode: 'only-target-call',
      target: { callId },
      readAt: Date.now(),
    });
  };
}

export function markCallHistoryReadInConversation(
  callId: string
): ThunkAction<void, RootStateType, unknown, CallHistoryUpdateUnread> {
  return async (_dispatch, getState) => {
    const callHistorySelector = getCallHistorySelector(getState());
    const callHistory = callHistorySelector(callId);
    if (callHistory == null) {
      return;
    }
    await markAllCallHistoryReadAndSync(callHistory, Date.now(), true);
  };
}

function markCallsTabViewed(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CallHistoryUpdateUnread
> {
  return async (_dispatch, getState) => {
    const latestCall = getCallHistoryLatestCall(getState());
    if (latestCall != null) {
      await markAllCallHistoryReadAndSync(latestCall, Date.now(), false);
    }
  };
}

export function addCallHistory(
  callHistory: CallHistoryDetails
): CallHistoryAdd {
  return {
    type: CALL_HISTORY_ADD,
    payload: callHistory,
  };
}

function removeCallHistory(
  callId: CallHistoryDetails['callId']
): CallHistoryRemove {
  return {
    type: CALL_HISTORY_REMOVE,
    payload: callId,
  };
}

function resetCallHistory(): CallHistoryReset {
  return { type: CALL_HISTORY_RESET };
}

function clearAllCallHistory(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CallHistoryReset | ToastActionType | ShowErrorModalActionType
> {
  return async (dispatch, getState) => {
    let unreadConversationIds: ReadonlyArray<string> = [];
    try {
      const latestCall = getCallHistoryLatestCall(getState());
      if (latestCall == null) {
        return;
      }

      unreadConversationIds =
        await DataReader.getCallHistoryUnreadCallConversationIds();
      const result = await clearCallHistoryDataAndSync(latestCall);

      if (result === ClearCallHistoryResult.Success) {
        dispatch(showToast({ toastType: ToastType.CallHistoryCleared }));
      } else if (result === ClearCallHistoryResult.Error) {
        const i18n = getIntl(getState());
        const payload: ErrorModalDataProps = {
          // @ts-expect-error ConfirmationDialog migration: Needs title
          title: null,
          description: i18n('icu:CallsTab__ClearCallHistoryError'),
        };
        dispatch({
          type: SHOW_ERROR_MODAL,
          payload,
        });
      } else if (result === ClearCallHistoryResult.ErrorDeletingCallLinks) {
        const i18n = getIntl(getState());
        const payload: ErrorModalDataProps = {
          // @ts-expect-error ConfirmationDialog migration: Needs title
          title: null,
          description: i18n('icu:CallsTab__ClearCallHistoryError--call-links'),
        };
        dispatch({ type: SHOW_ERROR_MODAL, payload });
      } else {
        throw missingCaseError(result);
      }
    } catch (error) {
      log.error('Error clearing call history', Errors.toLogFormat(error));
    } finally {
      // Ensure previously unread conversations are updated
      updateConversationsUnreadCounts(unreadConversationIds);

      // Just force a reload, even if the clear failed.
      dispatch(reloadCallHistory());
    }
  };
}

export function reloadCallHistory(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CallHistoryReload
> {
  return async dispatch => {
    try {
      await loadCallHistory();
      const callsHistory = getCallsHistoryForRedux();
      const callsHistoryUnreadCountsByConversationId =
        getCallsHistoryUnreadCountsByConversationIdForRedux();
      dispatch({
        type: CALL_HISTORY_RELOAD,
        payload: { callsHistory, callsHistoryUnreadCountsByConversationId },
      });
    } catch (error) {
      log.error('Error reloading call history', Errors.toLogFormat(error));
    }
  };
}

export const actions = {
  addCallHistory,
  removeCallHistory,
  resetCallHistory,
  reloadCallHistory,
  clearAllCallHistory,
  updateCallHistoryUnreadCount,
  markCallHistoryRead,
  markCallHistoryReadInConversation,
  markCallsTabViewed,
};

export const useCallHistoryActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function reducer(
  state: CallHistoryState = getEmptyState(),
  action: CallHistoryAction
): CallHistoryState {
  switch (action.type) {
    case CALL_HISTORY_RESET:
      return { ...state, edition: state.edition + 1, callHistoryByCallId: {} };
    case CALL_HISTORY_ADD:
      return {
        ...state,
        edition: state.edition + 1,
        callHistoryByCallId: {
          ...state.callHistoryByCallId,
          [action.payload.callId]: action.payload,
        },
      };
    case CALL_HISTORY_REMOVE:
      return {
        ...state,
        edition: state.edition + 1,
        callHistoryByCallId: omit(state.callHistoryByCallId, action.payload),
      };
    case CALL_HISTORY_UPDATE_UNREAD:
      return {
        ...state,
        unreadCountsByConversationId: action.payload,
      };
    case CALL_HISTORY_RELOAD:
      return {
        edition: state.edition + 1,
        unreadCountsByConversationId:
          action.payload.callsHistoryUnreadCountsByConversationId,
        callHistoryByCallId: makeLookup(action.payload.callsHistory, 'callId'),
      };
    default:
      return state;
  }
}
