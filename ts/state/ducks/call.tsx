import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CallStatusEnum = 'offering' | 'incoming' | 'connecting' | 'ongoing' | undefined;

export type CallStateType = {
  ongoingWith?: string;
  ongoingCallStatus?: CallStatusEnum;
  callIsInFullScreen: boolean;
};

export const initialCallState: CallStateType = {
  ongoingWith: undefined,
  ongoingCallStatus: undefined,
  callIsInFullScreen: false,
};

/**
 * This slice is the one holding the default joinable rooms fetched once in a while from the default opengroup v2 server.
 */
const callSlice = createSlice({
  name: 'call',
  initialState: initialCallState,
  reducers: {
    incomingCall(state: CallStateType, action: PayloadAction<{ pubkey: string }>) {
      const callerPubkey = action.payload.pubkey;
      if (state.ongoingWith && state.ongoingWith !== callerPubkey) {
        window.log.warn(
          `Got an incoming call action for ${callerPubkey} but we are already in a call.`
        );
        return state;
      }
      state.ongoingWith = callerPubkey;
      state.ongoingCallStatus = 'incoming';
      return state;
    },
    endCall(state: CallStateType) {
      state.ongoingCallStatus = undefined;
      state.ongoingWith = undefined;

      return state;
    },
    answerCall(state: CallStateType, action: PayloadAction<{ pubkey: string }>) {
      const callerPubkey = action.payload.pubkey;

      // to answer a call we need an incoming call form that specific pubkey

      if (state.ongoingWith !== callerPubkey || state.ongoingCallStatus !== 'incoming') {
        window.log.info('cannot answer a call we are not displaying a dialog with');
        return state;
      }
      state.ongoingCallStatus = 'connecting';
      state.callIsInFullScreen = false;
      return state;
    },
    callConnected(state: CallStateType, action: PayloadAction<{ pubkey: string }>) {
      const callerPubkey = action.payload.pubkey;
      if (callerPubkey !== state.ongoingWith) {
        window.log.info('cannot answer a call we did not start or receive first');
        return state;
      }
      const existingCallState = state.ongoingCallStatus;

      if (existingCallState !== 'connecting' && existingCallState !== 'offering') {
        window.log.info(
          'cannot answer a call we are not connecting (and so answered) to or offering a call'
        );
        return state;
      }

      state.ongoingCallStatus = 'ongoing';
      state.callIsInFullScreen = false;
      return state;
    },
    startingCallWith(state: CallStateType, action: PayloadAction<{ pubkey: string }>) {
      if (state.ongoingWith) {
        window.log.warn('cannot start a call with an ongoing call already: ongoingWith');
        return state;
      }
      if (state.ongoingCallStatus) {
        window.log.warn('cannot start a call with an ongoing call already: ongoingCallStatus');
        return state;
      }

      const callerPubkey = action.payload.pubkey;
      state.ongoingWith = callerPubkey;
      state.ongoingCallStatus = 'offering';
      state.callIsInFullScreen = false;

      return state;
    },
    setFullScreenCall(state: CallStateType, action: PayloadAction<boolean>) {
      // only set in full screen if we have an ongoing call
      if (state.ongoingWith && state.ongoingCallStatus === 'ongoing' && action.payload) {
        state.callIsInFullScreen = true;
        return state;
      }
      state.callIsInFullScreen = false;
      return state;
    },
  },
});

const { actions, reducer } = callSlice;
export const {
  incomingCall,
  endCall,
  answerCall,
  callConnected,
  startingCallWith,
  setFullScreenCall,
} = actions;
export const callReducer = reducer;
