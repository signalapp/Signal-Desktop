// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import { clamp, isNumber, maxBy } from 'lodash';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import { Avatar, AvatarSize } from './Avatar';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { DirectCallRemoteParticipant } from './DirectCallRemoteParticipant';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import type { LocalizerType } from '../types/Util';
import {
  GroupCallJoinState,
  type ActiveCallType,
  type GroupCallRemoteParticipantType,
  type GroupCallVideoRequest,
} from '../types/Calling';
import { CallMode } from '../types/CallDisposition';
import { AvatarColors } from '../types/Colors';
import type { SetRendererCanvasType } from '../state/ducks/calling';
import { useGetCallingFrameBuffer } from '../calling/useGetCallingFrameBuffer';
import { MAX_FRAME_HEIGHT } from '../calling/constants';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { missingCaseError } from '../util/missingCaseError';
import { nonRenderedRemoteParticipant } from '../util/ringrtc/nonRenderedRemoteParticipant';
import { isReconnecting } from '../util/callingIsReconnecting';
import { isGroupOrAdhocActiveCall } from '../util/isGroupOrAdhocCall';
import { assertDev } from '../util/assert';
import type { CallingImageDataCache } from './CallManager';
import { PIP_MAXIMUM_HEIGHT, PIP_MINIMUM_HEIGHT } from './CallingPip';

function BlurredBackground({
  activeCall,
  activeGroupCallSpeaker,
  i18n,
}: {
  activeCall: ActiveCallType;
  activeGroupCallSpeaker?: undefined | GroupCallRemoteParticipantType;
  i18n: LocalizerType;
}): JSX.Element {
  const {
    avatarPlaceholderGradient,
    color,
    type: conversationType,
    phoneNumber,
    profileName,
    sharedGroupNames,
    title,
  } = activeCall.conversation;
  const avatarUrl =
    activeGroupCallSpeaker?.avatarUrl ?? activeCall.conversation.avatarUrl;

  return (
    <CallBackgroundBlur avatarUrl={avatarUrl}>
      <div className="module-calling-pip__video--avatar">
        <Avatar
          avatarPlaceholderGradient={avatarPlaceholderGradient}
          avatarUrl={avatarUrl}
          badge={undefined}
          color={color || AvatarColors[0]}
          noteToSelf={false}
          conversationType={conversationType}
          i18n={i18n}
          phoneNumber={phoneNumber}
          profileName={profileName}
          title={title}
          size={AvatarSize.FORTY_EIGHT}
          sharedGroupNames={sharedGroupNames}
        />
      </div>
    </CallBackgroundBlur>
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
  height: number;
  width: number;
  updateHeight: (newHeight: number) => void;
};

export function CallingPipRemoteVideo({
  activeCall,
  getGroupCallVideoFrameSource,
  imageDataCache,
  i18n,
  setGroupCallVideoRequest,
  setRendererCanvas,
  height,
  width,
  updateHeight,
}: PropsType): JSX.Element {
  const { conversation } = activeCall;

  const getGroupCallFrameBuffer = useGetCallingFrameBuffer();

  const isPageVisible = usePageVisibility();

  const activeGroupCallSpeaker: undefined | GroupCallRemoteParticipantType =
    React.useMemo(() => {
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
    if (isGroupOrAdhocActiveCall(activeCall)) {
      if (!activeGroupCallSpeaker || !activeGroupCallSpeaker.hasRemoteVideo) {
        return;
      }
      const { videoAspectRatio } = activeGroupCallSpeaker;
      if (!isNumber(videoAspectRatio)) {
        return;
      }

      const newHeight = clamp(
        Math.floor(width * (1 / videoAspectRatio)),
        1,
        MAX_FRAME_HEIGHT
      );
      // Update only for portrait video that fits, otherwise leave things as they are
      if (
        newHeight !== height &&
        newHeight >= PIP_MINIMUM_HEIGHT &&
        newHeight <= PIP_MAXIMUM_HEIGHT
      ) {
        updateHeight(newHeight);
      }

      if (isPageVisible) {
        const participants = activeCall.remoteParticipants.map(participant => {
          if (participant === activeGroupCallSpeaker) {
            return {
              demuxId: participant.demuxId,
              width,
              height: newHeight,
            };
          }
          return nonRenderedRemoteParticipant(participant);
        });
        setGroupCallVideoRequest(participants, newHeight);
      } else {
        setGroupCallVideoRequest(
          activeCall.remoteParticipants.map(nonRenderedRemoteParticipant),
          0
        );
      }
    } else {
      // eslint-disable-next-line no-lonely-if
      if (!activeCall.hasRemoteVideo) {
        // eslint-disable-next-line no-useless-return
        return;
      }
      // TODO: DESKTOP-8537 - with direct call video stats, call updateHeight as needed
    }
  }, [
    activeCall,
    activeGroupCallSpeaker,
    height,
    isPageVisible,
    setGroupCallVideoRequest,
    updateHeight,
    width,
  ]);

  switch (activeCall.callMode) {
    case CallMode.Direct: {
      const { hasRemoteVideo } = activeCall.remoteParticipants[0];
      if (!hasRemoteVideo) {
        return (
          <div className="module-calling-pip__video--remote">
            <BlurredBackground activeCall={activeCall} i18n={i18n} />
          </div>
        );
      }
      assertDev(
        conversation.type === 'direct',
        'CallingPipRemoteVideo for direct call must be associated with direct conversation'
      );
      // TODO: DESKTOP-8537 - when black bars go away, we need to make some CSS changes
      return (
        <div className="module-calling-pip__video--remote">
          <BlurredBackground activeCall={activeCall} i18n={i18n} />
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
        return (
          <div className="module-calling-pip__video--remote">
            <BlurredBackground activeCall={activeCall} i18n={i18n} />
          </div>
        );
      }
      return (
        <div className="module-calling-pip__video--remote">
          <BlurredBackground
            activeCall={activeCall}
            activeGroupCallSpeaker={activeGroupCallSpeaker}
            i18n={i18n}
          />
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
