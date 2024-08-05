// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { noop } from 'lodash';

import type { AvatarColorType } from '../types/Colors';
import { AvatarPreview } from './AvatarPreview';
import { Lightbox } from './Lightbox';
import type { LocalizerType } from '../types/Util';

export type PropsType = {
  avatarColor?: AvatarColorType;
  avatarUrl?: string;
  conversationTitle?: string;
  i18n: LocalizerType;
  isGroup?: boolean;
  noteToSelf?: boolean;
  onClose: () => unknown;
};

export function AvatarLightbox({
  avatarColor,
  avatarUrl,
  conversationTitle,
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
        avatarColor={avatarColor}
        avatarUrl={avatarUrl}
        conversationTitle={conversationTitle}
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
