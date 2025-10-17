// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import lodash from 'lodash';

import type { AvatarColorType } from '../types/Colors.std.js';
import { AvatarPreview } from './AvatarPreview.dom.js';
import { Lightbox } from './Lightbox.dom.js';
import type { LocalizerType } from '../types/Util.std.js';

const { noop } = lodash;

export type PropsType = {
  avatarPlaceholderGradient?: Readonly<[string, string]>;
  avatarColor?: AvatarColorType;
  avatarUrl?: string;
  conversationTitle?: string;
  hasAvatar?: boolean;
  i18n: LocalizerType;
  isGroup?: boolean;
  noteToSelf?: boolean;
  onClose: () => unknown;
};

export function AvatarLightbox({
  avatarPlaceholderGradient,
  avatarColor,
  avatarUrl,
  conversationTitle,
  hasAvatar,
  i18n,
  isGroup,
  noteToSelf,
  onClose,
}: PropsType): JSX.Element {
  return (
    <Lightbox
      closeLightbox={onClose}
      i18n={i18n}
      isViewOnce
      media={[]}
      playbackDisabled={false}
      saveAttachment={noop}
      toggleForwardMessagesModal={noop}
      onMediaPlaybackStart={noop}
      onNextAttachment={noop}
      onPrevAttachment={noop}
      onSelectAttachment={noop}
      selectedIndex={0}
    >
      <AvatarPreview
        avatarPlaceholderGradient={avatarPlaceholderGradient}
        avatarColor={avatarColor}
        avatarUrl={avatarUrl}
        conversationTitle={conversationTitle}
        hasAvatar={hasAvatar}
        i18n={i18n}
        isGroup={isGroup}
        noteToSelf={noteToSelf}
        style={{
          fontSize: '16em',
          width: 'auto',
          minHeight: '64px',
          height: '100%',
          maxHeight: `min(${512}px, 100%)`,
          aspectRatio: '1 / 1',
        }}
      />
    </Lightbox>
  );
}
