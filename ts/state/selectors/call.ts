import { createSelector } from 'reselect';
import { CallStateType } from '../ducks/call';
import { ConversationsStateType, ReduxConversationType } from '../ducks/conversations';
import { StateType } from '../reducer';
import { getConversations, getSelectedConversationKey } from './conversations';

export const getCallState = (state: StateType): CallStateType => state.call;

// --- INCOMING CALLS
export const getHasIncomingCallFrom = createSelector(getCallState, (state: CallStateType):
  | string
  | undefined => {
  return state.ongoingWith && state.ongoingCallStatus === 'incoming'
    ? state.ongoingWith
    : undefined;
});

export const getHasIncomingCall = createSelector(
  getHasIncomingCallFrom,
  (withConvo: string | undefined): boolean => !!withConvo
);

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

export const getHasOngoingCallWithFocusedConvoIsOffering = createSelector(
  getCallState,
  getSelectedConversationKey,
  (callState: CallStateType, selectedConvoPubkey?: string): boolean => {
    if (
      !selectedConvoPubkey ||
      !callState.ongoingWith ||
      callState.ongoingCallStatus !== 'offering' ||
      selectedConvoPubkey !== callState.ongoingWith
    ) {
      return false;
    }

    return true;
  }
);

export const getHasOngoingCallWithFocusedConvosIsConnecting = createSelector(
  getCallState,
  getSelectedConversationKey,
  (callState: CallStateType, selectedConvoPubkey?: string): boolean => {
    if (
      !selectedConvoPubkey ||
      !callState.ongoingWith ||
      callState.ongoingCallStatus !== 'connecting' ||
      selectedConvoPubkey !== callState.ongoingWith
    ) {
      return false;
    }

    return true;
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
