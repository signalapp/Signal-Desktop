// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { memoize } from 'lodash';
import { mapDispatchToProps } from '../actions';
import { CallManager } from '../../components/CallManager';
import { calling as callingService } from '../../services/calling';
import { getUserUuid, getIntl } from '../selectors/user';
import { getMe, getConversationSelector } from '../selectors/conversations';
import { getActiveCall } from '../ducks/calling';
import { ConversationType } from '../ducks/conversations';
import { getIncomingCall } from '../selectors/calling';
import {
  ActiveCallType,
  CallMode,
  GroupCallPeekedParticipantType,
  GroupCallRemoteParticipantType,
} from '../../types/Calling';
import { StateType } from '../reducer';
import { missingCaseError } from '../../util/missingCaseError';
import { SmartCallingDeviceSelection } from './CallingDeviceSelection';

function renderDeviceSelection(): JSX.Element {
  return <SmartCallingDeviceSelection />;
}

const getGroupCallVideoFrameSource = callingService.getGroupCallVideoFrameSource.bind(
  callingService
);

const mapStateToActiveCallProp = (
  state: StateType
): undefined | ActiveCallType => {
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

  const conversationSelectorByUuid = memoize<
    (uuid: string) => undefined | ConversationType
  >(uuid => {
    const conversationId = window.ConversationController.ensureContactIds({
      uuid,
    });
    return conversationId ? conversationSelector(conversationId) : undefined;
  });

  const baseResult = {
    conversation,
    hasLocalAudio: activeCallState.hasLocalAudio,
    hasLocalVideo: activeCallState.hasLocalVideo,
    joinedAt: activeCallState.joinedAt,
    pip: activeCallState.pip,
    settingsDialogOpen: activeCallState.settingsDialogOpen,
    showParticipantsList: activeCallState.showParticipantsList,
  };

  switch (call.callMode) {
    case CallMode.Direct:
      return {
        ...baseResult,
        callEndedReason: call.callEndedReason,
        callMode: CallMode.Direct,
        callState: call.callState,
        peekedParticipants: [],
        remoteParticipants: [
          {
            hasRemoteVideo: Boolean(call.hasRemoteVideo),
          },
        ],
      };
    case CallMode.Group: {
      const ourUuid = getUserUuid(state);

      const remoteParticipants: Array<GroupCallRemoteParticipantType> = [];
      const peekedParticipants: Array<GroupCallPeekedParticipantType> = [];

      for (let i = 0; i < call.remoteParticipants.length; i += 1) {
        const remoteParticipant = call.remoteParticipants[i];

        const remoteConversation = conversationSelectorByUuid(
          remoteParticipant.uuid
        );
        if (!remoteConversation) {
          window.log.error(
            'Remote participant has no corresponding conversation'
          );
          continue;
        }

        remoteParticipants.push({
          avatarPath: remoteConversation.avatarPath,
          color: remoteConversation.color,
          demuxId: remoteParticipant.demuxId,
          firstName: remoteConversation.firstName,
          hasRemoteAudio: remoteParticipant.hasRemoteAudio,
          hasRemoteVideo: remoteParticipant.hasRemoteVideo,
          isBlocked: Boolean(remoteConversation.isBlocked),
          isSelf: remoteParticipant.uuid === ourUuid,
          name: remoteConversation.name,
          profileName: remoteConversation.profileName,
          speakerTime: remoteParticipant.speakerTime,
          title: remoteConversation.title,
          uuid: remoteParticipant.uuid,
          videoAspectRatio: remoteParticipant.videoAspectRatio,
        });
      }

      for (let i = 0; i < call.peekInfo.uuids.length; i += 1) {
        const peekedParticipantUuid = call.peekInfo.uuids[i];

        const peekedConversation = conversationSelectorByUuid(
          peekedParticipantUuid
        );
        if (!peekedConversation) {
          window.log.error(
            'Remote participant has no corresponding conversation'
          );
          continue;
        }

        peekedParticipants.push({
          avatarPath: peekedConversation.avatarPath,
          color: peekedConversation.color,
          firstName: peekedConversation.firstName,
          isSelf: peekedParticipantUuid === ourUuid,
          name: peekedConversation.name,
          profileName: peekedConversation.profileName,
          title: peekedConversation.title,
          uuid: peekedParticipantUuid,
        });
      }

      return {
        ...baseResult,
        callMode: CallMode.Group,
        connectionState: call.connectionState,
        deviceCount: call.peekInfo.deviceCount,
        joinState: call.joinState,
        maxDevices: call.peekInfo.maxDevices,
        peekedParticipants,
        remoteParticipants,
      };
    }
    default:
      throw missingCaseError(call);
  }
};

const mapStateToIncomingCallProp = (state: StateType) => {
  const call = getIncomingCall(state);
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
  me: {
    ...getMe(state),
    // `getMe` returns a `ConversationType` which might not have a UUID, at least
    //   according to the type. This ensures one is set.
    uuid: getUserUuid(state),
  },
  renderDeviceSelection,
});

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCallManager = smart(CallManager);
