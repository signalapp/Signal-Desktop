// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Avatar } from './Avatar';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { DirectCallRemoteParticipant } from './DirectCallRemoteParticipant';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import { LocalizerType } from '../types/Util';
import { CallMode, VideoFrameSource } from '../types/Calling';
import { ActiveCallType, SetRendererCanvasType } from '../state/ducks/calling';

export interface PropsType {
  activeCall: ActiveCallType;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  i18n: LocalizerType;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
}

export const CallingPipRemoteVideo = ({
  activeCall,
  getGroupCallVideoFrameSource,
  i18n,
  setRendererCanvas,
}: PropsType): JSX.Element => {
  const { call, conversation } = activeCall;

  if (call.callMode === CallMode.Direct) {
    if (!call.hasRemoteVideo) {
      const {
        avatarPath,
        color,
        name,
        phoneNumber,
        profileName,
        title,
      } = conversation;

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
    const { groupCallParticipants } = activeCall;
    const speaker = groupCallParticipants[0];

    return (
      <div className="module-calling-pip__video--remote">
        <GroupCallRemoteParticipant
          getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
          i18n={i18n}
          isInPip
          key={speaker.demuxId}
          remoteParticipant={speaker}
        />
      </div>
    );
  }

  throw new Error('CallingRemoteVideo: Unknown Call Mode');
};
