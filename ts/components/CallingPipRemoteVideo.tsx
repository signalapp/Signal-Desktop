// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo, useEffect } from 'react';
import { maxBy } from 'lodash';
import { Avatar } from './Avatar';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { DirectCallRemoteParticipant } from './DirectCallRemoteParticipant';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import { LocalizerType } from '../types/Util';
import {
  ActiveCallType,
  CallMode,
  GroupCallRemoteParticipantType,
  GroupCallVideoRequest,
  VideoFrameSource,
} from '../types/Calling';
import { SetRendererCanvasType } from '../state/ducks/calling';
import { useGetCallingFrameBuffer } from '../calling/useGetCallingFrameBuffer';
import { usePageVisibility } from '../util/hooks';
import { missingCaseError } from '../util/missingCaseError';
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

  const activeGroupCallSpeaker:
    | undefined
    | GroupCallRemoteParticipantType = useMemo(() => {
    if (activeCall.callMode !== CallMode.Group) {
      return undefined;
    }

    return maxBy(
      activeCall.remoteParticipants,
      participant => participant.speakerTime || -Infinity
    );
  }, [activeCall.callMode, activeCall.remoteParticipants]);

  useEffect(() => {
    if (activeCall.callMode !== CallMode.Group) {
      return;
    }

    if (isPageVisible) {
      setGroupCallVideoRequest(
        activeCall.remoteParticipants.map(participant => {
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
