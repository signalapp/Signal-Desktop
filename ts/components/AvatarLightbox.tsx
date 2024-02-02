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
  avatarPath?: string;
  conversationTitle?: string;
  i18n: LocalizerType;
  isGroup?: boolean;
  onClose: () => unknown;
};

export function AvatarLightbox({
  avatarColor,
  avatarPath,
  conversationTitle,
  i18n,
  isGroup,
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
        avatarPath={avatarPath}
        conversationTitle={conversationTitle}
        i18n={i18n}
        isGroup={isGroup}
        style={{
          fontSize: '16em',
          height: '2em',
          maxHeight: 512,
          maxWidth: 512,
          width: '2em',
        }}
      />
    </Lightbox>
  );
}
