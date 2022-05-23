// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo, useEffect } from 'react';
import { clamp, maxBy } from 'lodash';
import type { VideoFrameSource } from 'ringrtc';
import { Avatar } from './Avatar';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { DirectCallRemoteParticipant } from './DirectCallRemoteParticipant';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import type { LocalizerType } from '../types/Util';
import type {
  ActiveCallType,
  GroupCallRemoteParticipantType,
  GroupCallVideoRequest,
} from '../types/Calling';
import { CallMode } from '../types/Calling';
import { AvatarColors } from '../types/Colors';
import type { SetRendererCanvasType } from '../state/ducks/calling';
import { useGetCallingFrameBuffer } from '../calling/useGetCallingFrameBuffer';
import { MAX_FRAME_WIDTH } from '../calling/constants';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { missingCaseError } from '../util/missingCaseError';
import { nonRenderedRemoteParticipant } from '../util/ringrtc/nonRenderedRemoteParticipant';

// This value should be kept in sync with the hard-coded CSS height. It should also be
//   less than `MAX_FRAME_HEIGHT`.
const PIP_VIDEO_HEIGHT_PX = 120;

const NoVideo = ({
  activeCall,
  i18n,
}: {
  activeCall: ActiveCallType;
  i18n: LocalizerType;
}): JSX.Element => {
  const {
    acceptedMessageRequest,
    avatarPath,
    color,
    isMe,
    name,
    phoneNumber,
    profileName,
    sharedGroupNames,
    title,
  } = activeCall.conversation;

  return (
    <div className="module-calling-pip__video--remote">
      <CallBackgroundBlur avatarPath={avatarPath} color={color}>
        <div className="module-calling-pip__video--avatar">
          <Avatar
            acceptedMessageRequest={acceptedMessageRequest}
            avatarPath={avatarPath}
            badge={undefined}
            color={color || AvatarColors[0]}
            noteToSelf={false}
            conversationType="direct"
            i18n={i18n}
            isMe={isMe}
            name={name}
            phoneNumber={phoneNumber}
            profileName={profileName}
            title={title}
            size={52}
            sharedGroupNames={sharedGroupNames}
          />
        </div>
      </CallBackgroundBlur>
    </div>
  );
};

export type PropsType = {
  activeCall: ActiveCallType;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  i18n: LocalizerType;
  setGroupCallVideoRequest: (_: Array<GroupCallVideoRequest>) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
};

export const CallingPipRemoteVideo = ({
  activeCall,
  getGroupCallVideoFrameSource,
  i18n,
  setGroupCallVideoRequest,
  setRendererCanvas,
}: PropsType): JSX.Element => {
  const { conversation } = activeCall;

  const getGroupCallFrameBuffer = useGetCallingFrameBuffer();

  const isPageVisible = usePageVisibility();

  const activeGroupCallSpeaker: undefined | GroupCallRemoteParticipantType =
    useMemo(() => {
      if (activeCall.callMode !== CallMode.Group) {
        return undefined;
      }

      return maxBy(activeCall.remoteParticipants, participant =>
        participant.presenting ? Infinity : participant.speakerTime || -Infinity
      );
    }, [activeCall.callMode, activeCall.remoteParticipants]);

  useEffect(() => {
    if (activeCall.callMode !== CallMode.Group) {
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
        })
      );
    } else {
      setGroupCallVideoRequest(
        activeCall.remoteParticipants.map(nonRenderedRemoteParticipant)
      );
    }
  }, [
    activeCall.callMode,
    activeCall.remoteParticipants,
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
      return (
        <div className="module-calling-pip__video--remote">
          <DirectCallRemoteParticipant
            conversation={conversation}
            hasRemoteVideo={hasRemoteVideo}
            i18n={i18n}
            setRendererCanvas={setRendererCanvas}
          />
        </div>
      );
    }
    case CallMode.Group:
      if (!activeGroupCallSpeaker) {
        return <NoVideo activeCall={activeCall} i18n={i18n} />;
      }
      return (
        <div className="module-calling-pip__video--remote">
          <GroupCallRemoteParticipant
            getFrameBuffer={getGroupCallFrameBuffer}
            getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
            i18n={i18n}
            isInPip
            remoteParticipant={activeGroupCallSpeaker}
          />
        </div>
      );
    default:
      throw missingCaseError(activeCall);
  }
};
