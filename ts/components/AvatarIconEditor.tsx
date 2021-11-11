// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useState } from 'react';

import { AvatarColorPicker } from './AvatarColorPicker';
import type { AvatarColorType } from '../types/Colors';
import type { AvatarDataType } from '../types/Avatar';
import { AvatarModalButtons } from './AvatarModalButtons';
import { AvatarPreview } from './AvatarPreview';
import type { LocalizerType } from '../types/Util';
import { avatarDataToBytes } from '../util/avatarDataToBytes';

export type PropsType = {
  avatarData: AvatarDataType;
  i18n: LocalizerType;
  onClose: (avatarData?: AvatarDataType) => unknown;
};

export const AvatarIconEditor = ({
  avatarData: initialAvatarData,
  i18n,
  onClose,
}: PropsType): JSX.Element => {
  const [avatarBuffer, setAvatarBuffer] = useState<Uint8Array | undefined>();
  const [avatarData, setAvatarData] =
    useState<AvatarDataType>(initialAvatarData);

  const onColorSelected = useCallback(
    (color: AvatarColorType) => {
      setAvatarData({
        ...avatarData,
        color,
      });
    },
    [avatarData]
  );

  useEffect(() => {
    let shouldCancel = false;

    async function loadAvatar() {
      const buffer = await avatarDataToBytes(avatarData);
      if (!shouldCancel) {
        setAvatarBuffer(buffer);
      }
    }
    loadAvatar();

    return () => {
      shouldCancel = true;
    };
  }, [avatarData, setAvatarBuffer]);

  const hasChanges = avatarData !== initialAvatarData;

  return (
    <>
      <AvatarPreview
        avatarColor={avatarData.color}
        avatarValue={avatarBuffer}
        conversationTitle={avatarData.text}
        i18n={i18n}
      />
      <hr className="AvatarEditor__divider" />
      <AvatarColorPicker
        i18n={i18n}
        onColorSelected={onColorSelected}
        selectedColor={avatarData.color}
      />
      <AvatarModalButtons
        hasChanges={hasChanges}
        i18n={i18n}
        onCancel={onClose}
        onSave={() =>
          onClose({
            ...avatarData,
            buffer: avatarBuffer,
          })
        }
      />
    </>
  );
};
