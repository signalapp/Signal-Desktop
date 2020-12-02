// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo, useEffect } from 'react';
import { maxBy } from 'lodash';
import { Avatar } from './Avatar';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { DirectCallRemoteParticipant } from './DirectCallRemoteParticipant';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import { LocalizerType } from '../types/Util';
import {
  CallMode,
  GroupCallRemoteParticipantType,
  GroupCallVideoRequest,
  VideoFrameSource,
} from '../types/Calling';
import { ActiveCallType, SetRendererCanvasType } from '../state/ducks/calling';
import { usePageVisibility } from '../util/hooks';
import { nonRenderedRemoteParticipant } from '../util/ringrtc/nonRenderedRemoteParticipant';

// This value should be kept in sync with the hard-coded CSS height.
const PIP_VIDEO_HEIGHT_PX = 120;

const NoVideo = ({
  activeCall,
  i18n,
}: {
  activeCall: ActiveCallType;
  i18n: LocalizerType;
}): JSX.Element => {
  const {
    avatarPath,
    color,
    name,
    phoneNumber,
    profileName,
    title,
  } = activeCall.conversation;

  return (
    <div className="module-calling-pip__video--remote">
      <CallBackgroundBlur avatarPath={avatarPath} color={color}>
        <div className="module-calling-pip__video--avatar">
          <Avatar
            avatarPath={avatarPath}
            color={color || 'ultramarine'}
            noteToSelf={false}
            conversationType="direct"
            i18n={i18n}
            name={name}
            phoneNumber={phoneNumber}
            profileName={profileName}
            title={title}
            size={52}
          />
        </div>
      </CallBackgroundBlur>
    </div>
  );
};

export interface PropsType {
  activeCall: ActiveCallType;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  i18n: LocalizerType;
  setGroupCallVideoRequest: (_: Array<GroupCallVideoRequest>) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
}

export const CallingPipRemoteVideo = ({
  activeCall,
  getGroupCallVideoFrameSource,
  i18n,
  setGroupCallVideoRequest,
  setRendererCanvas,
}: PropsType): JSX.Element => {
  const { call, conversation, groupCallParticipants } = activeCall;

  const isPageVisible = usePageVisibility();

  const activeGroupCallSpeaker:
    | undefined
    | GroupCallRemoteParticipantType = useMemo(() => {
    if (call.callMode !== CallMode.Group) {
      return undefined;
    }

    return maxBy(
      groupCallParticipants,
      participant => participant.speakerTime || -Infinity
    );
  }, [call.callMode, groupCallParticipants]);

  useEffect(() => {
    if (call.callMode !== CallMode.Group) {
      return;
    }

    if (isPageVisible) {
      setGroupCallVideoRequest(
        groupCallParticipants.map(participant => {
          const isVisible =
            participant === activeGroupCallSpeaker &&
            participant.hasRemoteVideo;
          if (isVisible) {
            return {
              demuxId: participant.demuxId,
              width: Math.floor(
                PIP_VIDEO_HEIGHT_PX * participant.videoAspectRatio
              ),
              height: PIP_VIDEO_HEIGHT_PX,
            };
          }
          return nonRenderedRemoteParticipant(participant);
        })
      );
    } else {
      setGroupCallVideoRequest(
        groupCallParticipants.map(nonRenderedRemoteParticipant)
      );
    }
  }, [
    call.callMode,
    groupCallParticipants,
    activeGroupCallSpeaker,
    isPageVisible,
    setGroupCallVideoRequest,
  ]);

  if (call.callMode === CallMode.Direct) {
    if (!call.hasRemoteVideo) {
      return <NoVideo activeCall={activeCall} i18n={i18n} />;
    }

    return (
      <div className="module-calling-pip__video--remote">
        <DirectCallRemoteParticipant
          conversation={conversation}
          hasRemoteVideo={call.hasRemoteVideo}
          i18n={i18n}
          setRendererCanvas={setRendererCanvas}
        />
      </div>
    );
  }

  if (call.callMode === CallMode.Group) {
    if (!activeGroupCallSpeaker) {
      return <NoVideo activeCall={activeCall} i18n={i18n} />;
    }

    return (
      <div className="module-calling-pip__video--remote">
        <GroupCallRemoteParticipant
          getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
          i18n={i18n}
          isInPip
          remoteParticipant={activeGroupCallSpeaker}
        />
      </div>
    );
  }

  throw new Error('CallingRemoteVideo: Unknown Call Mode');
};
