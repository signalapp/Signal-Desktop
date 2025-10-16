// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import lodash from 'lodash';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import { Avatar, AvatarSize } from './Avatar.dom.js';
import { CallBackgroundBlur } from './CallBackgroundBlur.dom.js';
import { DirectCallRemoteParticipant } from './DirectCallRemoteParticipant.dom.js';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import {
  GroupCallJoinState,
  type ActiveCallType,
  type GroupCallRemoteParticipantType,
  type GroupCallVideoRequest,
} from '../types/Calling.std.js';
import { CallMode } from '../types/CallDisposition.std.js';
import { AvatarColors } from '../types/Colors.std.js';
import type { SetRendererCanvasType } from '../state/ducks/calling.preload.js';
import { useGetCallingFrameBuffer } from '../calling/useGetCallingFrameBuffer.std.js';
import { MAX_FRAME_HEIGHT } from '../calling/constants.std.js';
import { usePageVisibility } from '../hooks/usePageVisibility.dom.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { nonRenderedRemoteParticipant } from '../util/ringrtc/nonRenderedRemoteParticipant.std.js';
import { isReconnecting } from '../util/callingIsReconnecting.std.js';
import { isGroupOrAdhocActiveCall } from '../util/isGroupOrAdhocCall.std.js';
import { assertDev } from '../util/assert.std.js';
import type { CallingImageDataCache } from './CallManager.dom.js';
import {
  PIP_MAXIMUM_HEIGHT_MULTIPLIER,
  PIP_MINIMUM_HEIGHT_MULTIPLIER,
  PIP_WIDTH_NORMAL,
} from './CallingPip.dom.js';

const { clamp, isNumber, maxBy } = lodash;

function BlurredBackground({
  activeCall,
  activeGroupCallSpeaker,
  avatarSize,
  darken,
  i18n,
}: {
  activeCall: ActiveCallType;
  activeGroupCallSpeaker?: undefined | GroupCallRemoteParticipantType;
  avatarSize: AvatarSize;
  darken?: boolean;
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
    <CallBackgroundBlur avatarUrl={avatarUrl} darken={darken}>
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
          size={avatarSize}
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

      const ratio = 1 / videoAspectRatio;
      const newHeight = clamp(Math.floor(width * ratio), 1, MAX_FRAME_HEIGHT);

      // Update only for portrait video that fits, otherwise leave things as they are
      if (
        newHeight !== height &&
        ratio >= PIP_MINIMUM_HEIGHT_MULTIPLIER &&
        ratio <= PIP_MAXIMUM_HEIGHT_MULTIPLIER
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

  const avatarSize =
    width > PIP_WIDTH_NORMAL ? AvatarSize.NINETY_SIX : AvatarSize.SIXTY_FOUR;

  switch (activeCall.callMode) {
    case CallMode.Direct: {
      const { hasRemoteVideo } = activeCall.remoteParticipants[0];
      if (!hasRemoteVideo) {
        return (
          <div className="module-calling-pip__video--remote">
            <BlurredBackground
              activeCall={activeCall}
              avatarSize={avatarSize}
              i18n={i18n}
            />
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
          <BlurredBackground
            activeCall={activeCall}
            avatarSize={avatarSize}
            darken
            i18n={i18n}
          />
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
            <BlurredBackground
              activeCall={activeCall}
              avatarSize={avatarSize}
              i18n={i18n}
            />
          </div>
        );
      }
      return (
        <div className="module-calling-pip__video--remote">
          <BlurredBackground
            activeCall={activeCall}
            activeGroupCallSpeaker={activeGroupCallSpeaker}
            avatarSize={avatarSize}
            darken={activeGroupCallSpeaker.hasRemoteVideo}
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
