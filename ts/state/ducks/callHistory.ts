// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';
import { omit } from 'lodash';
import type { StateType as RootStateType } from '../reducer';
import { clearCallHistoryDataAndSync } from '../../util/callDisposition';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import type { ToastActionType } from './toast';
import { showToast } from './toast';
import { ToastType } from '../../types/Toast';
import type { CallHistoryDetails } from '../../types/CallDisposition';
import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import { drop } from '../../util/drop';

export type CallHistoryState = ReadonlyDeep<{
  // This informs the app that underlying call history data has changed.
  edition: number;
  unreadCount: number;
  callHistoryByCallId: Record<string, CallHistoryDetails>;
}>;

const CALL_HISTORY_ADD = 'callHistory/ADD';
const CALL_HISTORY_REMOVE = 'callHistory/REMOVE';
const CALL_HISTORY_RESET = 'callHistory/RESET';
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

export type CallHistoryUpdateUnread = ReadonlyDeep<{
  type: typeof CALL_HISTORY_UPDATE_UNREAD;
  payload: number;
}>;

export type CallHistoryAction = ReadonlyDeep<
  | CallHistoryAdd
  | CallHistoryRemove
  | CallHistoryReset
  | CallHistoryUpdateUnread
>;

export function getEmptyState(): CallHistoryState {
  return {
    edition: 0,
    unreadCount: 0,
    callHistoryByCallId: {},
  };
}

function updateCallHistoryUnreadCount(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CallHistoryUpdateUnread
> {
  return async dispatch => {
    try {
      const unreadCount = await window.Signal.Data.getCallHistoryUnreadCount();
      dispatch({ type: CALL_HISTORY_UPDATE_UNREAD, payload: unreadCount });
    } catch (error) {
      log.error(
        'Error updating call history unread count',
        Errors.toLogFormat(error)
      );
    }
  };
}

function markCallHistoryRead(
  conversationId: string,
  callId: string
): ThunkAction<void, RootStateType, unknown, CallHistoryUpdateUnread> {
  return async dispatch => {
    try {
      await window.Signal.Data.markCallHistoryRead(callId);
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

function markCallsTabViewed(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CallHistoryUpdateUnread
> {
  return async dispatch => {
    try {
      const conversationIds = await window.Signal.Data.markAllCallHistoryRead();
      for (const conversationId of conversationIds) {
        drop(window.ConversationController.get(conversationId)?.updateUnread());
      }
    } catch (error) {
      log.error(
        'markCallsTabViewed: Error marking all call history read',
        Errors.toLogFormat(error)
      );
    } finally {
      dispatch(updateCallHistoryUnreadCount());
    }
  };
}

function addCallHistory(callHistory: CallHistoryDetails): CallHistoryAdd {
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
  CallHistoryReset | ToastActionType
> {
  return async dispatch => {
    try {
      await clearCallHistoryDataAndSync();
      dispatch(showToast({ toastType: ToastType.CallHistoryCleared }));
    } catch (error) {
      log.error('Error clearing call history', Errors.toLogFormat(error));
    } finally {
      // Just force a reset, even if the clear failed.
      dispatch(resetCallHistory());
      dispatch(updateCallHistoryUnreadCount());
    }
  };
}

export const actions = {
  addCallHistory,
  removeCallHistory,
  resetCallHistory,
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
    default:
      return state;
  }
}
