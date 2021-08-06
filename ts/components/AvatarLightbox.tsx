// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { AvatarColorType } from '../types/Colors';
import { AvatarPreview } from './AvatarPreview';
import { IMAGE_JPEG } from '../types/MIME';
import { Lightbox } from './Lightbox';
import { LocalizerType } from '../types/Util';

export type PropsType = {
  avatarColor?: AvatarColorType;
  avatarPath?: string;
  conversationTitle?: string;
  i18n: LocalizerType;
  isGroup?: boolean;
  onClose: () => unknown;
};

export const AvatarLightbox = ({
  avatarColor,
  avatarPath,
  conversationTitle,
  i18n,
  isGroup,
  onClose,
}: PropsType): JSX.Element => {
  if (avatarPath) {
    return (
      <Lightbox
        // We don't know that the avatar is a JPEG, but any image `contentType` will cause
        //  it to be rendered as an image, which is what we want.
        contentType={IMAGE_JPEG}
        close={onClose}
        i18n={i18n}
        isViewOnce={false}
        objectURL={avatarPath}
      />
    );
  }

  return (
    <Lightbox
      contentType={undefined}
      close={onClose}
      i18n={i18n}
      isViewOnce={false}
      objectURL=""
    >
      <AvatarPreview
        avatarColor={avatarColor}
        conversationTitle={conversationTitle}
        i18n={i18n}
        isGroup={isGroup}
        style={{
          fontSize: '16em',
          height: '2em',
          width: '2em',
        }}
      />
    </Lightbox>
  );
};
