// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useEffect } from 'react';
import type { SetRendererCanvasType } from '../state/ducks/calling';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { AvatarColors } from '../types/Colors';
import { Avatar } from './Avatar';

type PropsType = {
  conversation: ConversationType;
  hasRemoteVideo: boolean;
  i18n: LocalizerType;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
};

export const DirectCallRemoteParticipant: React.FC<PropsType> = ({
  conversation,
  hasRemoteVideo,
  i18n,
  setRendererCanvas,
}) => {
  const remoteVideoRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setRendererCanvas({ element: remoteVideoRef });
    return () => {
      setRendererCanvas({ element: undefined });
    };
  }, [setRendererCanvas]);

  return hasRemoteVideo ? (
    <canvas
      className="module-ongoing-call__remote-video-enabled"
      ref={remoteVideoRef}
    />
  ) : (
    renderAvatar(i18n, conversation)
  );
};

function renderAvatar(
  i18n: LocalizerType,
  {
    acceptedMessageRequest,
    avatarPath,
    color,
    isMe,
    name,
    phoneNumber,
    profileName,
    sharedGroupNames,
    title,
  }: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'color'
    | 'isMe'
    | 'name'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
  >
): JSX.Element {
  return (
    <div className="module-ongoing-call__remote-video-disabled">
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
        sharedGroupNames={sharedGroupNames}
        size={112}
      />
    </div>
  );
}
