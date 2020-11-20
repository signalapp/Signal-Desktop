// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { CallManager } from '../../components/CallManager';
import { calling as callingService } from '../../services/calling';
import { getMe, getConversationSelector } from '../selectors/conversations';
import { getActiveCall, GroupCallParticipantInfoType } from '../ducks/calling';
import { getIncomingCall } from '../selectors/calling';
import {
  CallMode,
  GroupCallPeekedParticipantType,
  GroupCallRemoteParticipantType,
} from '../../types/Calling';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';

import { SmartCallingDeviceSelection } from './CallingDeviceSelection';

function renderDeviceSelection(): JSX.Element {
  return <SmartCallingDeviceSelection />;
}

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

  const conversationSelector = getConversationSelector(state);
  const conversation = conversationSelector(activeCallState.conversationId);
  if (!conversation) {
    window.log.error('The active call has no corresponding conversation');
    return undefined;
  }

  // TODO: The way we deal with remote participants isn't ideal. See DESKTOP-949.
  let isCallFull = false;
  const groupCallPeekedParticipants: Array<GroupCallPeekedParticipantType> = [];
  const groupCallParticipants: Array<GroupCallRemoteParticipantType> = [];
  if (call.callMode === CallMode.Group) {
    isCallFull = call.peekInfo.deviceCount >= call.peekInfo.maxDevices;

    call.peekInfo.conversationIds.forEach((conversationId: string) => {
      const peekedConversation = conversationSelector(conversationId);

      if (!peekedConversation) {
        window.log.error(
          'Peeked participant has no corresponding conversation'
        );
        return;
      }

      groupCallPeekedParticipants.push({
        avatarPath: peekedConversation.avatarPath,
        color: peekedConversation.color,
        firstName: peekedConversation.firstName,
        isSelf: conversationId === state.user.ourConversationId,
        name: peekedConversation.name,
        profileName: peekedConversation.profileName,
        title: peekedConversation.title,
      });
    });

    call.remoteParticipants.forEach(
      (remoteParticipant: GroupCallParticipantInfoType) => {
        const remoteConversation = conversationSelector(
          remoteParticipant.conversationId
        );

        if (!remoteConversation) {
          window.log.error(
            'Remote participant has no corresponding conversation'
          );
          return;
        }

        groupCallParticipants.push({
          avatarPath: remoteConversation.avatarPath,
          color: remoteConversation.color,
          demuxId: remoteParticipant.demuxId,
          firstName: remoteConversation.firstName,
          hasRemoteAudio: remoteParticipant.hasRemoteAudio,
          hasRemoteVideo: remoteParticipant.hasRemoteVideo,
          isSelf: remoteParticipant.isSelf,
          name: remoteConversation.name,
          profileName: remoteConversation.profileName,
          title: remoteConversation.title,
          videoAspectRatio: remoteParticipant.videoAspectRatio,
        });
      }
    );
  }

  return {
    activeCallState,
    call,
    conversation,
    isCallFull,
    groupCallPeekedParticipants,
    groupCallParticipants,
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
  getGroupCallVideoFrameSource,
  i18n: getIntl(state),
  incomingCall: mapStateToIncomingCallProp(state),
  me: getMe(state),
  renderDeviceSelection,
});

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCallManager = smart(CallManager);
