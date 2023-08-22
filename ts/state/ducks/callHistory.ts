// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';
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

const CALL_HISTORY_CACHE = 'callHistory/CACHE';
const CALL_HISTORY_RESET = 'callHistory/RESET';
const CALL_HISTORY_UPDATE_UNREAD = 'callHistory/UPDATE_UNREAD';

export type CallHistoryCache = ReadonlyDeep<{
  type: typeof CALL_HISTORY_CACHE;
  payload: CallHistoryDetails;
}>;

export type CallHistoryReset = ReadonlyDeep<{
  type: typeof CALL_HISTORY_RESET;
}>;

export type CallHistoryUpdateUnread = ReadonlyDeep<{
  type: typeof CALL_HISTORY_UPDATE_UNREAD;
  payload: number;
}>;

export type CallHistoryAction = ReadonlyDeep<
  CallHistoryCache | CallHistoryReset | CallHistoryUpdateUnread
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

function cacheCallHistory(callHistory: CallHistoryDetails): CallHistoryCache {
  return {
    type: CALL_HISTORY_CACHE,
    payload: callHistory,
  };
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
      dispatch({ type: CALL_HISTORY_RESET });
      dispatch(updateCallHistoryUnreadCount());
    }
  };
}

export const actions = {
  cacheCallHistory,
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
    case CALL_HISTORY_CACHE:
      return {
        ...state,
        callHistoryByCallId: {
          ...state.callHistoryByCallId,
          [action.payload.callId]: action.payload,
        },
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
