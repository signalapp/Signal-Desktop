// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useEffect } from 'react';
import { SetRendererCanvasType } from '../state/ducks/calling';
import { ConversationType } from '../state/ducks/conversations';
import { ColorType } from '../types/Colors';
import { LocalizerType } from '../types/Util';
import { Avatar } from './Avatar';

interface PropsType {
  conversation: ConversationType;
  hasRemoteVideo: boolean;
  i18n: LocalizerType;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
}

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
    avatarPath,
    color,
    name,
    phoneNumber,
    profileName,
    title,
  }: {
    avatarPath?: string;
    color?: ColorType;
    title: string;
    name?: string;
    phoneNumber?: string;
    profileName?: string;
  }
): JSX.Element {
  return (
    <div className="module-ongoing-call__remote-video-disabled">
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
        size={112}
      />
    </div>
  );
}
