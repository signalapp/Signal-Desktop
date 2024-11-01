// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo, useEffect } from 'react';
import { clamp, maxBy } from 'lodash';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import { Avatar, AvatarSize } from './Avatar';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { DirectCallRemoteParticipant } from './DirectCallRemoteParticipant';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import type { LocalizerType } from '../types/Util';
import type {
  ActiveCallType,
  GroupCallRemoteParticipantType,
  GroupCallVideoRequest,
} from '../types/Calling';
import { GroupCallJoinState } from '../types/Calling';
import { CallMode } from '../types/CallDisposition';
import { AvatarColors } from '../types/Colors';
import type { SetRendererCanvasType } from '../state/ducks/calling';
import { useGetCallingFrameBuffer } from '../calling/useGetCallingFrameBuffer';
import { MAX_FRAME_WIDTH } from '../calling/constants';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { missingCaseError } from '../util/missingCaseError';
import { nonRenderedRemoteParticipant } from '../util/ringrtc/nonRenderedRemoteParticipant';
import { isReconnecting } from '../util/callingIsReconnecting';
import { isGroupOrAdhocActiveCall } from '../util/isGroupOrAdhocCall';
import { assertDev } from '../util/assert';
import type { CallingImageDataCache } from './CallManager';

// This value should be kept in sync with the hard-coded CSS height. It should also be
//   less than `MAX_FRAME_HEIGHT`.
const PIP_VIDEO_HEIGHT_PX = 120;

function NoVideo({
  activeCall,
  i18n,
}: {
  activeCall: ActiveCallType;
  i18n: LocalizerType;
}): JSX.Element {
  const {
    acceptedMessageRequest,
    avatarUrl,
    color,
    type: conversationType,
    isMe,
    phoneNumber,
    profileName,
    sharedGroupNames,
    title,
  } = activeCall.conversation;

  return (
    <div className="module-calling-pip__video--remote">
      <CallBackgroundBlur avatarUrl={avatarUrl}>
        <div className="module-calling-pip__video--avatar">
          <Avatar
            acceptedMessageRequest={acceptedMessageRequest}
            avatarUrl={avatarUrl}
            badge={undefined}
            color={color || AvatarColors[0]}
            noteToSelf={false}
            conversationType={conversationType}
            i18n={i18n}
            isMe={isMe}
            phoneNumber={phoneNumber}
            profileName={profileName}
            title={title}
            size={AvatarSize.FORTY_EIGHT}
            sharedGroupNames={sharedGroupNames}
          />
        </div>
      </CallBackgroundBlur>
    </div>
  );
}

export type PropsType = {
  activeCall: ActiveCallType;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  i18n: LocalizerType;
  imageDataCache: React.RefObject<CallingImageDataCache>;
  setGroupCallVideoRequest: (
    _: Array<GroupCallVideoRequest>,
    speakerHeight: number
  ) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
};

export function CallingPipRemoteVideo({
  activeCall,
  getGroupCallVideoFrameSource,
  imageDataCache,
  i18n,
  setGroupCallVideoRequest,
  setRendererCanvas,
}: PropsType): JSX.Element {
  const { conversation } = activeCall;

  const getGroupCallFrameBuffer = useGetCallingFrameBuffer();

  const isPageVisible = usePageVisibility();

  const activeGroupCallSpeaker: undefined | GroupCallRemoteParticipantType =
    useMemo(() => {
      if (!isGroupOrAdhocActiveCall(activeCall)) {
        return undefined;
      }

      if (activeCall.joinState !== GroupCallJoinState.Joined) {
        return undefined;
      }

      return maxBy(activeCall.remoteParticipants, participant =>
        participant.presenting ? Infinity : participant.speakerTime || -Infinity
      );
    }, [activeCall]);

  useEffect(() => {
    if (!isGroupOrAdhocActiveCall(activeCall)) {
      return;
    }

    if (isPageVisible) {
      setGroupCallVideoRequest(
        activeCall.remoteParticipants.map(participant => {
          if (participant === activeGroupCallSpeaker) {
            return {
              demuxId: participant.demuxId,
              width: clamp(
                Math.floor(PIP_VIDEO_HEIGHT_PX * participant.videoAspectRatio),
                1,
                MAX_FRAME_WIDTH
              ),
              height: PIP_VIDEO_HEIGHT_PX,
            };
          }
          return nonRenderedRemoteParticipant(participant);
        }),
        PIP_VIDEO_HEIGHT_PX
      );
    } else {
      setGroupCallVideoRequest(
        activeCall.remoteParticipants.map(nonRenderedRemoteParticipant),
        0
      );
    }
  }, [
    activeCall,
    activeGroupCallSpeaker,
    isPageVisible,
    setGroupCallVideoRequest,
  ]);

  switch (activeCall.callMode) {
    case CallMode.Direct: {
      const { hasRemoteVideo } = activeCall.remoteParticipants[0];
      if (!hasRemoteVideo) {
        return <NoVideo activeCall={activeCall} i18n={i18n} />;
      }
      assertDev(
        conversation.type === 'direct',
        'CallingPipRemoteVideo for direct call must be associated with direct conversation'
      );
      return (
        <div className="module-calling-pip__video--remote">
          <DirectCallRemoteParticipant
            conversation={conversation}
            hasRemoteVideo={hasRemoteVideo}
            i18n={i18n}
            isReconnecting={isReconnecting(activeCall)}
            setRendererCanvas={setRendererCanvas}
          />
        </div>
      );
    }
    case CallMode.Group:
    case CallMode.Adhoc:
      if (!activeGroupCallSpeaker) {
        return <NoVideo activeCall={activeCall} i18n={i18n} />;
      }
      return (
        <div className="module-calling-pip__video--remote">
          <GroupCallRemoteParticipant
            getFrameBuffer={getGroupCallFrameBuffer}
            getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
            imageDataCache={imageDataCache}
            i18n={i18n}
            isInPip
            joinedAt={activeCall.joinedAt}
            remoteParticipant={activeGroupCallSpeaker}
            remoteParticipantsCount={activeCall.remoteParticipants.length}
            isActiveSpeakerInSpeakerView={false}
            isCallReconnecting={isReconnecting(activeCall)}
          />
        </div>
      );
    default:
      throw missingCaseError(activeCall);
  }
}
