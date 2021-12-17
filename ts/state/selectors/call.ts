import { createSelector } from 'reselect';
import { CallStateType, CallStatusEnum } from '../ducks/call';
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

const getCallStateWithFocusedConvo = createSelector(
  getCallState,
  getSelectedConversationKey,
  (callState: CallStateType, selectedConvoPubkey?: string): CallStatusEnum => {
    if (
      selectedConvoPubkey &&
      callState.ongoingWith &&
      selectedConvoPubkey === callState.ongoingWith
    ) {
      return callState.ongoingCallStatus;
    }

    return undefined;
  }
);

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
