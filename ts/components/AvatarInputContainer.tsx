// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useState } from 'react';
import { noop } from 'lodash';

import * as log from '../logging/log';
import { AvatarInput, PropsType as AvatarInputPropsType } from './AvatarInput';
import { LocalizerType } from '../types/Util';
import { imagePathToArrayBuffer } from '../util/imagePathToArrayBuffer';

type PropsType = {
  avatarPath?: string;
  i18n: LocalizerType;
  onAvatarChanged: (avatar: ArrayBuffer | undefined) => unknown;
  onAvatarLoaded?: (avatar: ArrayBuffer | undefined) => unknown;
} & Pick<
  AvatarInputPropsType,
  'contextMenuId' | 'disabled' | 'type' | 'variant'
>;

const TEMPORARY_AVATAR_VALUE = new ArrayBuffer(0);

export const AvatarInputContainer = ({
  avatarPath,
  contextMenuId,
  disabled,
  i18n,
  onAvatarChanged,
  onAvatarLoaded,
  type,
  variant,
}: PropsType): JSX.Element => {
  const startingAvatarPathRef = useRef<undefined | string>(avatarPath);

  const [avatar, setAvatar] = useState<undefined | ArrayBuffer>(
    avatarPath ? TEMPORARY_AVATAR_VALUE : undefined
  );

  useEffect(() => {
    const startingAvatarPath = startingAvatarPathRef.current;
    if (!startingAvatarPath) {
      return noop;
    }

    let shouldCancel = false;

    (async () => {
      try {
        const buffer = await imagePathToArrayBuffer(startingAvatarPath);
        if (shouldCancel) {
          return;
        }
        setAvatar(buffer);
        if (onAvatarLoaded) {
          onAvatarLoaded(buffer);
        }
      } catch (err) {
        log.warn(
          `Failed to convert image URL to array buffer. Error message: ${
            err && err.message
          }`
        );
      }
    })();

    return () => {
      shouldCancel = true;
    };
  }, [onAvatarLoaded]);

  return (
    <AvatarInput
      contextMenuId={contextMenuId}
      disabled={disabled}
      i18n={i18n}
      onChange={newAvatar => {
        setAvatar(newAvatar);
        onAvatarChanged(newAvatar);
      }}
      type={type}
      value={avatar}
      variant={variant}
    />
  );
};
