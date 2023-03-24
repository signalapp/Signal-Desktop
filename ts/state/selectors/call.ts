import { createSelector } from '@reduxjs/toolkit';
import { CallStateType, CallStatusEnum } from '../ducks/call';
import { ConversationsStateType, ReduxConversationType } from '../ducks/conversations';
import { StateType } from '../reducer';
import { getConversations } from './conversations';
import { getSelectedConversationKey } from './selectedConversation';

const getCallState = (state: StateType): CallStateType => state.call;

// --- INCOMING CALLS
export const getHasIncomingCallFrom = (state: StateType) => {
  return state.call.ongoingWith && state.call.ongoingCallStatus === 'incoming'
    ? state.call.ongoingWith
    : undefined;
};

export const getHasIncomingCall = (state: StateType) => !!getHasIncomingCallFrom(state);

// --- ONGOING CALLS
export const getHasOngoingCallWith = createSelector(
  getConversations,
  getCallState,
  (convos: ConversationsStateType, callState: CallStateType): ReduxConversationType | undefined => {
    if (
      callState.ongoingWith &&
      (callState.ongoingCallStatus === 'connecting' ||
        callState.ongoingCallStatus === 'offering' ||
        callState.ongoingCallStatus === 'ongoing')
    ) {
      return convos.conversationLookup[callState.ongoingWith] || undefined;
    }
    return undefined;
  }
);

export const getHasOngoingCall = createSelector(
  getHasOngoingCallWith,
  (withConvo: ReduxConversationType | undefined): boolean => !!withConvo
);

export const getHasOngoingCallWithPubkey = createSelector(
  getHasOngoingCallWith,
  (withConvo: ReduxConversationType | undefined): string | undefined => withConvo?.id
);

export const getHasOngoingCallWithFocusedConvo = createSelector(
  getHasOngoingCallWithPubkey,
  getSelectedConversationKey,
  (withPubkey, selectedPubkey) => {
    return withPubkey && withPubkey === selectedPubkey;
  }
);

const getCallStateWithFocusedConvo = (state: StateType): CallStatusEnum => {
  const selected = state.conversations.selectedConversation;
  const ongoingWith = state.call.ongoingWith;
  if (selected && ongoingWith && selected === ongoingWith) {
    return state.call.ongoingCallStatus;
  }
  return undefined;
};

export const getCallWithFocusedConvoIsOffering = createSelector(
  getCallStateWithFocusedConvo,
  (callState: CallStatusEnum): boolean => {
    return callState === 'offering';
  }
);

export const getCallWithFocusedConvosIsConnecting = createSelector(
  getCallStateWithFocusedConvo,
  (callState: CallStatusEnum): boolean => {
    return callState === 'connecting';
  }
);

export const getCallWithFocusedConvosIsConnected = createSelector(
  getCallStateWithFocusedConvo,
  (callState: CallStatusEnum): boolean => {
    return callState === 'ongoing';
  }
);

export const getHasOngoingCallWithNonFocusedConvo = createSelector(
  getHasOngoingCallWithPubkey,
  getSelectedConversationKey,
  (withPubkey, selectedPubkey) => {
    return withPubkey && withPubkey !== selectedPubkey;
  }
);

export const getCallIsInFullScreen = createSelector(
  getCallState,
  (callState): boolean => callState.callIsInFullScreen
);
