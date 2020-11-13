// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { CanvasVideoRenderer } from 'ringrtc';
import { mapDispatchToProps } from '../actions';
import { CallManager } from '../../components/CallManager';
import { calling as callingService } from '../../services/calling';
import { getMe, getConversationSelector } from '../selectors/conversations';
import { getActiveCall } from '../ducks/calling';
import { getIncomingCall } from '../selectors/calling';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';

import { SmartCallingDeviceSelection } from './CallingDeviceSelection';

function renderDeviceSelection(): JSX.Element {
  return <SmartCallingDeviceSelection />;
}

const createCanvasVideoRenderer = () => new CanvasVideoRenderer();

const getGroupCallVideoFrameSource = callingService.getGroupCallVideoFrameSource.bind(
  callingService
);

const mapStateToActiveCallProp = (state: StateType) => {
  const { calling } = state;
  const { activeCallState } = calling;

  if (!activeCallState) {
    return undefined;
  }

  const call = getActiveCall(calling);
  if (!call) {
    window.log.error(
      'There was an active call state but no corresponding call'
    );
    return undefined;
  }

  const conversation = getConversationSelector(state)(
    activeCallState.conversationId
  );
  if (!conversation) {
    window.log.error('The active call has no corresponding conversation');
    return undefined;
  }

  return {
    call,
    activeCallState,
    conversation,
  };
};

const mapStateToIncomingCallProp = (state: StateType) => {
  const call = getIncomingCall(state.calling);
  if (!call) {
    return undefined;
  }

  const conversation = getConversationSelector(state)(call.conversationId);
  if (!conversation) {
    window.log.error('The incoming call has no corresponding conversation');
    return undefined;
  }

  return {
    call,
    conversation,
  };
};

const mapStateToProps = (state: StateType) => ({
  activeCall: mapStateToActiveCallProp(state),
  availableCameras: state.calling.availableCameras,
  createCanvasVideoRenderer,
  getGroupCallVideoFrameSource,
  i18n: getIntl(state),
  incomingCall: mapStateToIncomingCallProp(state),
  me: getMe(state),
  renderDeviceSelection,
});

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCallManager = smart(CallManager);
