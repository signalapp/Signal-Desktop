// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { debounce, omit } from 'lodash';
import type { StateType as RootStateType } from '../reducer';
import {
  clearCallHistoryDataAndSync,
  markAllCallHistoryReadAndSync,
} from '../../util/callDisposition';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import type { ToastActionType } from './toast';
import { showToast } from './toast';
import { DataReader, DataWriter } from '../../sql/Client';
import { ToastType } from '../../types/Toast';
import {
  ClearCallHistoryResult,
  type CallHistoryDetails,
} from '../../types/CallDisposition';
import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import { drop } from '../../util/drop';
import {
  getCallHistoryLatestCall,
  getCallHistorySelector,
} from '../selectors/callHistory';
import {
  getCallsHistoryForRedux,
  getCallsHistoryUnreadCountForRedux,
  loadCallHistory,
} from '../../services/callHistoryLoader';
import { makeLookup } from '../../util/makeLookup';
import { missingCaseError } from '../../util/missingCaseError';
import { getIntl } from '../selectors/user';
import { ButtonVariant } from '../../components/Button';
import type { ShowErrorModalActionType } from './globalModals';
import { SHOW_ERROR_MODAL } from './globalModals';

export type CallHistoryState = ReadonlyDeep<{
  // This informs the app that underlying call history data has changed.
  edition: number;
  unreadCount: number;
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
    callsHistoryUnreadCount: number;
  };
}>;

export type CallHistoryUpdateUnread = ReadonlyDeep<{
  type: typeof CALL_HISTORY_UPDATE_UNREAD;
  payload: number;
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
    unreadCount: 0,
    callHistoryByCallId: {},
  };
}

const updateCallHistoryUnreadCountDebounced = debounce(
  async (
    dispatch: ThunkDispatch<RootStateType, unknown, CallHistoryUpdateUnread>
  ) => {
    try {
      const unreadCount = await DataReader.getCallHistoryUnreadCount();
      dispatch({ type: CALL_HISTORY_UPDATE_UNREAD, payload: unreadCount });
    } catch (error) {
      log.error(
        'Error updating call history unread count',
        Errors.toLogFormat(error)
      );
    }
  },
  300
);

function updateCallHistoryUnreadCount(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CallHistoryUpdateUnread
> {
  return async dispatch => {
    await updateCallHistoryUnreadCountDebounced(dispatch);
  };
}

function markCallHistoryRead(
  conversationId: string,
  callId: string
): ThunkAction<void, RootStateType, unknown, CallHistoryUpdateUnread> {
  return async dispatch => {
    try {
      await DataWriter.markCallHistoryRead(callId);
      drop(window.ConversationController.get(conversationId)?.updateUnread());
    } catch (error) {
      log.error(
        'markCallHistoryRead: Error marking call history read',
        Errors.toLogFormat(error)
      );
    } finally {
      dispatch(updateCallHistoryUnreadCount());
    }
  };
}

export function markCallHistoryReadInConversation(
  callId: string
): ThunkAction<void, RootStateType, unknown, CallHistoryUpdateUnread> {
  return async (dispatch, getState) => {
    const callHistorySelector = getCallHistorySelector(getState());
    const callHistory = callHistorySelector(callId);
    if (callHistory == null) {
      return;
    }
    try {
      await markAllCallHistoryReadAndSync(callHistory, true);
    } finally {
      dispatch(updateCallHistoryUnreadCount());
    }
  };
}

function markCallsTabViewed(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CallHistoryUpdateUnread
> {
  return async (dispatch, getState) => {
    const latestCall = getCallHistoryLatestCall(getState());
    if (latestCall != null) {
      await markAllCallHistoryReadAndSync(latestCall, false);
      dispatch(updateCallHistoryUnreadCount());
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
    try {
      const latestCall = getCallHistoryLatestCall(getState());
      if (latestCall == null) {
        return;
      }

      const result = await clearCallHistoryDataAndSync(latestCall);
      if (result === ClearCallHistoryResult.Success) {
        dispatch(showToast({ toastType: ToastType.CallHistoryCleared }));
      } else if (result === ClearCallHistoryResult.Error) {
        const i18n = getIntl(getState());
        dispatch({
          type: SHOW_ERROR_MODAL,
          payload: {
            title: null,
            description: i18n('icu:CallsTab__ClearCallHistoryError'),
            buttonVariant: ButtonVariant.Primary,
          },
        });
      } else if (result === ClearCallHistoryResult.ErrorDeletingCallLinks) {
        const i18n = getIntl(getState());
        dispatch({
          type: SHOW_ERROR_MODAL,
          payload: {
            title: null,
            description: i18n(
              'icu:CallsTab__ClearCallHistoryError--call-links'
            ),
            buttonVariant: ButtonVariant.Primary,
          },
        });
      } else {
        throw missingCaseError(result);
      }
    } catch (error) {
      log.error('Error clearing call history', Errors.toLogFormat(error));
    } finally {
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
      const callsHistoryUnreadCount = getCallsHistoryUnreadCountForRedux();
      dispatch({
        type: CALL_HISTORY_RELOAD,
        payload: { callsHistory, callsHistoryUnreadCount },
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
        unreadCount: action.payload,
      };
    case CALL_HISTORY_RELOAD:
      return {
        edition: state.edition + 1,
        unreadCount: action.payload.callsHistoryUnreadCount,
        callHistoryByCallId: makeLookup(action.payload.callsHistory, 'callId'),
      };
    default:
      return state;
  }
}
