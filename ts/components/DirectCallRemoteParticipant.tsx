// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useEffect } from 'react';
import classNames from 'classnames';
import type { SetRendererCanvasType } from '../state/ducks/calling';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { AvatarColors } from '../types/Colors';
import { Avatar, AvatarSize } from './Avatar';
import { CallBackgroundBlur } from './CallBackgroundBlur';

type PropsType = {
  conversation: ConversationType;
  hasRemoteVideo: boolean;
  i18n: LocalizerType;
  isReconnecting: boolean;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
};

export function DirectCallRemoteParticipant({
  conversation,
  hasRemoteVideo,
  i18n,
  isReconnecting,
  setRendererCanvas,
}: PropsType): JSX.Element {
  const remoteVideoRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setRendererCanvas({ element: remoteVideoRef });
    return () => {
      setRendererCanvas({ element: undefined });
    };
  }, [setRendererCanvas]);

  return hasRemoteVideo ? (
    <canvas
      className={classNames(
        'module-ongoing-call__remote-video-enabled',
        isReconnecting &&
          'module-ongoing-call__remote-video-enabled--reconnecting'
      )}
      ref={remoteVideoRef}
    />
  ) : (
    renderAvatar(i18n, conversation)
  );
}

function renderAvatar(
  i18n: LocalizerType,
  {
    acceptedMessageRequest,
    avatarUrl,
    color,
    isMe,
    phoneNumber,
    profileName,
    sharedGroupNames,
    title,
  }: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'color'
    | 'isMe'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
  >
): JSX.Element {
  return (
    <div className="module-ongoing-call__remote-video-disabled">
      <CallBackgroundBlur avatarUrl={avatarUrl}>
        <Avatar
          acceptedMessageRequest={acceptedMessageRequest}
          avatarUrl={avatarUrl}
          badge={undefined}
          color={color || AvatarColors[0]}
          noteToSelf={false}
          conversationType="direct"
          i18n={i18n}
          isMe={isMe}
          phoneNumber={phoneNumber}
          profileName={profileName}
          title={title}
          sharedGroupNames={sharedGroupNames}
          size={AvatarSize.EIGHTY}
        />
      </CallBackgroundBlur>
    </div>
  );
}
